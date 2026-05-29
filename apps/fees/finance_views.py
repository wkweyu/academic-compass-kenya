from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
import csv

from django.db import transaction
from django.db.models import F, Sum
from django.http import HttpResponse, StreamingHttpResponse
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.fees.models import (
    FeeBalance,
    ScheduledExportJob,
    TermCloseConversionDetail,
    TermClosePeriod,
    VoteHead,
)
from apps.fees.services.activity_log import log_finance_activity


class FinanceAccessPermission(permissions.BasePermission):
    allowed_roles = {'bursar', 'finance', 'finance_staff', 'accountant'}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        return getattr(user, 'role', '').lower() in self.allowed_roles



# Use the new log_finance_activity utility for finance actions
def _log_finance_activity(*, school, actor, action: str, description: str, metadata: dict | None = None, result: str = '', message: str = '', object_id: str = ''):
    log_finance_activity(
        school=school,
        user=actor,
        action=action,
        object_id=object_id,
        details=metadata,
        result=result,
        message=description or message,
    )


def _next_term(year: int, term: int):
    if term == 3:
        return year + 1, 1
    return year, term + 1


def _source_rows_for_period(school, year: int, term: int):
    return list(
        FeeBalance.objects.filter(school=school, year=year, term=term)
        .select_related('student', 'vote_head')
        .annotate(recomputed_closing=F('opening_balance') + F('amount_invoiced') - F('amount_paid'))
    )


def _group_preview(rows, target_year: int, target_term: int):
    student_map = defaultdict(lambda: {
        'student_id': None,
        'student_name': None,
        'admission_number': None,
        'arrears': Decimal('0.00'),
        'prepayment': Decimal('0.00'),
        'sources': [],
    })

    for row in rows:
        closing = Decimal(row.recomputed_closing or 0)
        if closing == 0:
            continue

        bucket = student_map[row.student_id]
        bucket['student_id'] = row.student_id
        bucket['student_name'] = row.student.full_name
        bucket['admission_number'] = row.student.admission_number

        if closing > 0:
            bucket['arrears'] += closing
            target_type = 'ARREARS'
            target_amount = closing
        else:
            bucket['prepayment'] += closing
            target_type = 'PREPAYMENT'
            target_amount = abs(closing)

        bucket['sources'].append(
            {
                'vote_head_id': row.vote_head_id,
                'vote_head_name': row.vote_head.name,
                'source_closing_balance': float(closing),
                'target_type': target_type,
                'target_amount': float(target_amount),
                'target_year': target_year,
                'target_term': target_term,
            }
        )

    return [
        {
            **item,
            'arrears': float(item['arrears']),
            'prepayment': float(item['prepayment']),
        }
        for item in student_map.values()
        if item['arrears'] != 0 or item['prepayment'] != 0
    ]


class TermClosePreviewAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        year = request.query_params.get('year')
        term = request.query_params.get('term')
        if not year or not term:
            return Response({'detail': 'year and term are required.'}, status=status.HTTP_400_BAD_REQUEST)

        year = int(year)
        term = int(term)
        target_year, target_term = _next_term(year, term)

        rows = _source_rows_for_period(school, year, term)
        per_student = _group_preview(rows, target_year, target_term)

        total_arrears = sum(Decimal(str(item['arrears'])) for item in per_student)
        total_prepayment = sum(Decimal(str(item['prepayment'])) for item in per_student)

        return Response(
            {
                'source_period': {'year': year, 'term': term},
                'target_period': {'year': target_year, 'term': target_term},
                'totals': {
                    'arrears': float(total_arrears),
                    'prepayment': float(total_prepayment),
                    'students_affected': len(per_student),
                },
                'students': per_student,
            }
        )


class TermCloseRolloverAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    @transaction.atomic
    def post(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        year = request.data.get('year')
        term = request.data.get('term')
        force = bool(request.data.get('force', False))
        if not year or not term:
            return Response({'detail': 'year and term are required.'}, status=status.HTTP_400_BAD_REQUEST)

        year = int(year)
        term = int(term)
        target_year, target_term = _next_term(year, term)

        period, created = TermClosePeriod.objects.select_for_update().get_or_create(
            school=school,
            year=year,
            term=term,
            defaults={
                'target_year': target_year,
                'target_term': target_term,
                'status': 'CLOSING',
                'started_by': request.user,
            },
        )

        if not created:
            if period.status == 'CLOSED' and not force:
                return Response(
                    {'detail': 'Period already closed. Pass force=true to rerun.'},
                    status=status.HTTP_409_CONFLICT,
                )
            if period.status == 'CLOSING':
                return Response(
                    {'detail': 'Period close already in progress.'},
                    status=status.HTTP_409_CONFLICT,
                )
            period.status = 'CLOSING'
            period.started_by = request.user
            period.started_at = timezone.now()
            period.target_year = target_year
            period.target_term = target_term
            period.save(update_fields=['status', 'started_by', 'started_at', 'target_year', 'target_term'])

        rows = _source_rows_for_period(school, year, term)
        preview = _group_preview(rows, target_year, target_term)

        arrears_votehead, _ = VoteHead.objects.get_or_create(
            school=school,
            name='Arrears',
            defaults={'priority': 999, 'fee_applicable': False, 'description': 'System generated carry-forward arrears'},
        )
        prepayment_votehead, _ = VoteHead.objects.get_or_create(
            school=school,
            name='Prepayment',
            defaults={'priority': 998, 'fee_applicable': False, 'description': 'System generated carry-forward prepayment'},
        )

        TermCloseConversionDetail.objects.filter(period=period).delete()

        processed = 0
        for student_row in preview:
            student_id = student_row['student_id']
            arrears = Decimal(str(student_row['arrears']))
            prepayment = Decimal(str(student_row['prepayment']))

            # Integrity checks before writes.
            source_pos = sum(
                Decimal(str(s['source_closing_balance']))
                for s in student_row['sources']
                if s['source_closing_balance'] > 0
            )
            source_neg = sum(
                Decimal(str(s['source_closing_balance']))
                for s in student_row['sources']
                if s['source_closing_balance'] < 0
            )
            if source_pos != arrears or source_neg != prepayment:
                period.status = 'FAILED'
                period.notes = 'Delta validation failed during carry-forward conversion.'
                period.save(update_fields=['status', 'notes'])
                _log_finance_activity(
                    school=school,
                    actor=request.user,
                    action='FINANCE_TERM_CLOSE_FAILED',
                    description='Term close failed due to conversion integrity mismatch.',
                    metadata={
                        'source_year': year,
                        'source_term': term,
                        'target_year': target_year,
                        'target_term': target_term,
                        'student_id': student_id,
                    },
                )
                return Response(
                    {
                        'detail': 'Conversion validation mismatch. Transaction rolled back.',
                        'student_id': student_id,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if arrears > 0:
                balance, _ = FeeBalance.objects.get_or_create(
                    school=school,
                    student_id=student_id,
                    vote_head=arrears_votehead,
                    year=target_year,
                    term=target_term,
                    defaults={
                        'opening_balance': arrears,
                        'amount_invoiced': Decimal('0.00'),
                        'amount_paid': Decimal('0.00'),
                        'closing_balance': arrears,
                    },
                )
                if balance.opening_balance != arrears:
                    balance.opening_balance = arrears
                    balance.closing_balance = (
                        Decimal(balance.opening_balance)
                        + Decimal(balance.amount_invoiced)
                        - Decimal(balance.amount_paid)
                    )
                    balance.save(update_fields=['opening_balance', 'closing_balance'])

            if prepayment < 0:
                balance, _ = FeeBalance.objects.get_or_create(
                    school=school,
                    student_id=student_id,
                    vote_head=prepayment_votehead,
                    year=target_year,
                    term=target_term,
                    defaults={
                        'opening_balance': prepayment,
                        'amount_invoiced': Decimal('0.00'),
                        'amount_paid': Decimal('0.00'),
                        'closing_balance': prepayment,
                    },
                )
                if balance.opening_balance != prepayment:
                    balance.opening_balance = prepayment
                    balance.closing_balance = (
                        Decimal(balance.opening_balance)
                        + Decimal(balance.amount_invoiced)
                        - Decimal(balance.amount_paid)
                    )
                    balance.save(update_fields=['opening_balance', 'closing_balance'])

            for source in student_row['sources']:
                TermCloseConversionDetail.objects.create(
                    period=period,
                    school=school,
                    student_id=student_id,
                    source_year=year,
                    source_term=term,
                    target_year=target_year,
                    target_term=target_term,
                    source_vote_head_id=source['vote_head_id'],
                    source_closing_balance=Decimal(str(source['source_closing_balance'])),
                    target_type=source['target_type'],
                    target_amount=Decimal(str(source['target_amount'])),
                )
            processed += 1

        period.status = 'CLOSED'
        period.closed_by = request.user
        period.closed_at = timezone.now()
        period.rows_processed = processed
        period.notes = 'Carry-forward completed successfully.'
        period.save(update_fields=['status', 'closed_by', 'closed_at', 'rows_processed', 'notes'])

        _log_finance_activity(
            school=school,
            actor=request.user,
            action='FINANCE_TERM_CLOSE_COMPLETED',
            description='Completed term close rollover.',
            metadata={
                'source_year': year,
                'source_term': term,
                'target_year': target_year,
                'target_term': target_term,
                'rows_processed': processed,
                'force': force,
                'period_id': period.id,
            },
        )

        return Response(
            {
                'detail': 'Term close and rollover completed.',
                'period_id': period.id,
                'source_period': {'year': year, 'term': term},
                'target_period': {'year': target_year, 'term': target_term},
                'rows_processed': processed,
            }
        )


class TermCloseConversionReportAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        year = request.query_params.get('year')
        term = request.query_params.get('term')
        student_id = request.query_params.get('student_id')

        queryset = TermCloseConversionDetail.objects.filter(school=school).select_related('student', 'source_vote_head', 'period')
        if year:
            queryset = queryset.filter(source_year=int(year))
        if term:
            queryset = queryset.filter(source_term=int(term))
        if student_id:
            queryset = queryset.filter(student_id=int(student_id))

        rows = [
            {
                'period_id': row.period_id,
                'student_id': row.student_id,
                'student_name': row.student.full_name,
                'admission_number': row.student.admission_number,
                'source_year': row.source_year,
                'source_term': row.source_term,
                'target_year': row.target_year,
                'target_term': row.target_term,
                'source_vote_head': row.source_vote_head.name,
                'source_closing_balance': float(row.source_closing_balance),
                'target_type': row.target_type,
                'target_amount': float(row.target_amount),
                'created_at': row.created_at.isoformat(),
            }
            for row in queryset.order_by('student_id', 'target_type', 'source_vote_head__priority', 'source_vote_head__name')
        ]

        return Response({'count': len(rows), 'results': rows})


def _term_reference_date(year: int, term: int) -> date:
    if term == 1:
        return date(year, 4, 30)
    if term == 2:
        return date(year, 8, 31)
    return date(year, 12, 31)


def _bucket_for_days(days: int) -> str:
    if days <= 30:
        return '0-30'
    if days <= 60:
        return '31-60'
    if days <= 90:
        return '61-90'
    return '90+'


class OutstandingBalancesReportAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        year = request.query_params.get('year')
        term = request.query_params.get('term')
        student_id = request.query_params.get('student_id')
        class_id = request.query_params.get('class_id')

        queryset = (
            FeeBalance.objects.filter(school=school, closing_balance__gt=0)
            .select_related('student', 'student__current_class', 'vote_head')
            .order_by('student_id', 'vote_head__priority', 'vote_head__name')
        )
        if year:
            queryset = queryset.filter(year=int(year))
        if term:
            queryset = queryset.filter(term=int(term))
        if student_id:
            queryset = queryset.filter(student_id=int(student_id))
        if class_id:
            queryset = queryset.filter(student__current_class_id=int(class_id))

        student_rows = defaultdict(
            lambda: {
                'student_id': None,
                'student_name': None,
                'admission_number': None,
                'class_name': None,
                'outstanding_amount': Decimal('0.00'),
                'vote_heads': [],
            }
        )
        for row in queryset:
            bucket = student_rows[row.student_id]
            bucket['student_id'] = row.student_id
            bucket['student_name'] = row.student.full_name
            bucket['admission_number'] = row.student.admission_number
            bucket['class_name'] = row.student.current_class.name if row.student.current_class else None
            bucket['outstanding_amount'] += Decimal(row.closing_balance)
            bucket['vote_heads'].append(
                {
                    'vote_head': row.vote_head.name,
                    'year': row.year,
                    'term': row.term,
                    'amount': float(row.closing_balance),
                }
            )

        results = [
            {
                **item,
                'outstanding_amount': float(item['outstanding_amount']),
            }
            for item in student_rows.values()
        ]
        total_outstanding = sum(Decimal(str(item['outstanding_amount'])) for item in results)

        return Response(
            {
                'count': len(results),
                'total_outstanding': float(total_outstanding),
                'results': sorted(results, key=lambda item: item['student_name'] or ''),
            }
        )


class StudentAgingReportAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        as_of_date_param = request.query_params.get('as_of_date')
        as_of = timezone.localdate()
        if as_of_date_param:
            try:
                as_of = date.fromisoformat(as_of_date_param)
            except ValueError:
                return Response({'detail': 'as_of_date must be YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        student_id = request.query_params.get('student_id')
        class_id = request.query_params.get('class_id')

        queryset = (
            FeeBalance.objects.filter(school=school, closing_balance__gt=0)
            .select_related('student', 'student__current_class', 'vote_head')
            .order_by('student_id', 'year', 'term')
        )
        if student_id:
            queryset = queryset.filter(student_id=int(student_id))
        if class_id:
            queryset = queryset.filter(student__current_class_id=int(class_id))

        bucket_totals = {'0-30': Decimal('0.00'), '31-60': Decimal('0.00'), '61-90': Decimal('0.00'), '90+': Decimal('0.00')}
        by_student = defaultdict(
            lambda: {
                'student_id': None,
                'student_name': None,
                'admission_number': None,
                'class_name': None,
                'buckets': {'0-30': Decimal('0.00'), '31-60': Decimal('0.00'), '61-90': Decimal('0.00'), '90+': Decimal('0.00')},
                'total': Decimal('0.00'),
            }
        )
        by_class = defaultdict(
            lambda: {
                'class_id': None,
                'class_name': None,
                'buckets': {'0-30': Decimal('0.00'), '31-60': Decimal('0.00'), '61-90': Decimal('0.00'), '90+': Decimal('0.00')},
                'total': Decimal('0.00'),
            }
        )
        by_votehead = defaultdict(
            lambda: {
                'vote_head_id': None,
                'vote_head_name': None,
                'buckets': {'0-30': Decimal('0.00'), '31-60': Decimal('0.00'), '61-90': Decimal('0.00'), '90+': Decimal('0.00')},
                'total': Decimal('0.00'),
            }
        )

        for row in queryset:
            reference_date = _term_reference_date(row.year, row.term)
            age_days = max((as_of - reference_date).days, 0)
            bucket_name = _bucket_for_days(age_days)

            amount = Decimal(row.closing_balance)
            bucket_totals[bucket_name] += amount

            student_bucket = by_student[row.student_id]
            student_bucket['student_id'] = row.student_id
            student_bucket['student_name'] = row.student.full_name
            student_bucket['admission_number'] = row.student.admission_number
            student_bucket['class_name'] = row.student.current_class.name if row.student.current_class else None
            student_bucket['buckets'][bucket_name] += amount
            student_bucket['total'] += amount

            class_key = row.student.current_class_id or 0
            class_bucket = by_class[class_key]
            class_bucket['class_id'] = row.student.current_class_id
            class_bucket['class_name'] = row.student.current_class.name if row.student.current_class else 'Unassigned'
            class_bucket['buckets'][bucket_name] += amount
            class_bucket['total'] += amount

            votehead_key = row.vote_head_id
            votehead_bucket = by_votehead[votehead_key]
            votehead_bucket['vote_head_id'] = row.vote_head_id
            votehead_bucket['vote_head_name'] = row.vote_head.name
            votehead_bucket['buckets'][bucket_name] += amount
            votehead_bucket['total'] += amount

        results = []
        for item in by_student.values():
            results.append(
                {
                    **item,
                    'buckets': {key: float(value) for key, value in item['buckets'].items()},
                    'total': float(item['total']),
                }
            )

        class_results = []
        for item in by_class.values():
            class_results.append(
                {
                    **item,
                    'buckets': {key: float(value) for key, value in item['buckets'].items()},
                    'total': float(item['total']),
                }
            )

        votehead_results = []
        for item in by_votehead.values():
            votehead_results.append(
                {
                    **item,
                    'buckets': {key: float(value) for key, value in item['buckets'].items()},
                    'total': float(item['total']),
                }
            )

        return Response(
            {
                'as_of_date': as_of.isoformat(),
                'totals': {key: float(value) for key, value in bucket_totals.items()},
                'count': len(results),
                'results': sorted(results, key=lambda item: item['student_name'] or ''),
                'by_class': sorted(class_results, key=lambda item: item['class_name'] or ''),
                'by_votehead': sorted(votehead_results, key=lambda item: item['vote_head_name'] or ''),
            }
        )


class CollectionEffectivenessReportAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        start_year = request.query_params.get('start_year')
        end_year = request.query_params.get('end_year')

        queryset = FeeBalance.objects.filter(school=school)
        if start_year:
            queryset = queryset.filter(year__gte=int(start_year))
        if end_year:
            queryset = queryset.filter(year__lte=int(end_year))

        grouped = (
            queryset.values('year', 'term')
            .annotate(
                invoiced=Sum('amount_invoiced'),
                paid=Sum('amount_paid'),
                closing=Sum('closing_balance'),
            )
            .order_by('year', 'term')
        )

        rows = []
        total_invoiced = Decimal('0.00')
        total_paid = Decimal('0.00')
        for row in grouped:
            invoiced = Decimal(row['invoiced'] or 0)
            paid = Decimal(row['paid'] or 0)
            closing = Decimal(row['closing'] or 0)

            arrears = closing if closing > 0 else Decimal('0.00')
            prepayment = abs(closing) if closing < 0 else Decimal('0.00')
            rate = (paid / invoiced * Decimal('100.00')) if invoiced > 0 else Decimal('0.00')

            total_invoiced += invoiced
            total_paid += paid

            rows.append(
                {
                    'year': row['year'],
                    'term': row['term'],
                    'amount_invoiced': float(invoiced),
                    'amount_paid': float(paid),
                    'collection_rate': float(rate.quantize(Decimal('0.01'))),
                    'arrears_closing': float(arrears),
                    'prepayment_closing': float(prepayment),
                }
            )

        overall_rate = (total_paid / total_invoiced * Decimal('100.00')) if total_invoiced > 0 else Decimal('0.00')
        return Response(
            {
                'count': len(rows),
                'summary': {
                    'total_invoiced': float(total_invoiced),
                    'total_paid': float(total_paid),
                    'overall_collection_rate': float(overall_rate.quantize(Decimal('0.01'))),
                },
                'results': rows,
            }
        )


class DebtAnalyticsReportAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        as_of_date_param = request.query_params.get('as_of_date')
        as_of = timezone.localdate()
        if as_of_date_param:
            try:
                as_of = date.fromisoformat(as_of_date_param)
            except ValueError:
                return Response({'detail': 'as_of_date must be YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        year = request.query_params.get('year')
        term = request.query_params.get('term')
        class_id = request.query_params.get('class_id')

        queryset = (
            FeeBalance.objects.filter(school=school, closing_balance__gt=0)
            .select_related('student', 'student__current_class', 'vote_head')
            .order_by('student_id', 'year', 'term')
        )
        if year:
            queryset = queryset.filter(year=int(year))
        if term:
            queryset = queryset.filter(term=int(term))
        if class_id:
            queryset = queryset.filter(student__current_class_id=int(class_id))

        by_student = defaultdict(
            lambda: {
                'student_id': None,
                'student_name': None,
                'admission_number': None,
                'class_name': None,
                'buckets': {'0-30': Decimal('0.00'), '31-60': Decimal('0.00'), '61-90': Decimal('0.00'), '90+': Decimal('0.00')},
                'total_outstanding': Decimal('0.00'),
                'terms_with_arrears': set(),
                'risk_band': 'LOW',
            }
        )

        for row in queryset:
            student_bucket = by_student[row.student_id]
            student_bucket['student_id'] = row.student_id
            student_bucket['student_name'] = row.student.full_name
            student_bucket['admission_number'] = row.student.admission_number
            student_bucket['class_name'] = row.student.current_class.name if row.student.current_class else None

            amount = Decimal(row.closing_balance or 0)
            reference_date = _term_reference_date(row.year, row.term)
            age_days = max((as_of - reference_date).days, 0)
            bucket_name = _bucket_for_days(age_days)
            student_bucket['buckets'][bucket_name] += amount
            student_bucket['total_outstanding'] += amount
            student_bucket['terms_with_arrears'].add((row.year, row.term))

        rows = []
        total_outstanding = Decimal('0.00')
        high_risk_count = 0
        chronic_count = 0

        for data in by_student.values():
            total = data['total_outstanding']
            bucket_61_90 = data['buckets']['61-90']
            bucket_90_plus = data['buckets']['90+']

            if total > 0 and (bucket_90_plus / total) >= Decimal('0.40'):
                risk_band = 'HIGH'
            elif bucket_90_plus > 0 or bucket_61_90 > 0:
                risk_band = 'MEDIUM'
            else:
                risk_band = 'LOW'

            if risk_band == 'HIGH':
                high_risk_count += 1
            if len(data['terms_with_arrears']) >= 2:
                chronic_count += 1

            total_outstanding += total
            rows.append(
                {
                    'student_id': data['student_id'],
                    'student_name': data['student_name'],
                    'admission_number': data['admission_number'],
                    'class_name': data['class_name'],
                    'buckets': {key: float(value) for key, value in data['buckets'].items()},
                    'total_outstanding': float(total),
                    'terms_with_arrears': len(data['terms_with_arrears']),
                    'risk_band': risk_band,
                }
            )

        rows = sorted(rows, key=lambda item: item['total_outstanding'], reverse=True)
        top_10_total = sum(Decimal(str(item['total_outstanding'])) for item in rows[:10])
        concentration_top10_share = (
            (top_10_total / total_outstanding * Decimal('100.00')).quantize(Decimal('0.01'))
            if total_outstanding > 0
            else Decimal('0.00')
        )

        return Response(
            {
                'as_of_date': as_of.isoformat(),
                'count': len(rows),
                'summary': {
                    'total_outstanding': float(total_outstanding),
                    'students_with_arrears': len(rows),
                    'high_risk_students': high_risk_count,
                    'chronic_arrears_students': chronic_count,
                    'top10_concentration_pct': float(concentration_top10_share),
                },
                'results': rows,
            }
        )


class FinanceActivityLogAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        action = request.query_params.get('action')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        limit = int(request.query_params.get('limit', 50) or 50)
        limit = max(1, min(limit, 200))

        queryset = ActivityLog.objects.filter(school=school).select_related('actor')
        if action:
            queryset = queryset.filter(action=action)
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        rows = [
            {
                'id': item.id,
                'action': item.action,
                'description': item.description,
                'actor_id': item.actor_id,
                'actor_name': item.actor.full_name if item.actor else None,
                'metadata': item.metadata or {},
                'created_at': item.created_at.isoformat(),
            }
            for item in queryset.order_by('-created_at')[:limit]
        ]
        return Response({'count': len(rows), 'results': rows})

    def post(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action')
        description = request.data.get('description')
        metadata = request.data.get('metadata') or {}

        if not action or not description:
            return Response({'detail': 'action and description are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(metadata, dict):
            return Response({'detail': 'metadata must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

        _log_finance_activity(
            school=school,
            actor=request.user,
            action=str(action)[:100],
            description=str(description)[:500],
            metadata=metadata,
        )
        return Response({'detail': 'Activity logged.'}, status=status.HTTP_201_CREATED)


class FinanceReportsExportCSVView(APIView):
    permission_classes = [FinanceAccessPermission]

    class _Echo:
        def write(self, value):
            return value

    def _iter_csv(self, rows):
        pseudo_buffer = self._Echo()
        writer = csv.writer(pseudo_buffer)
        for row in rows:
            yield writer.writerow(row)

    def _build_outstanding_rows(self, request, school):
        queryset = (
            FeeBalance.objects.filter(school=school, closing_balance__gt=0)
            .select_related('student', 'student__current_class')
            .order_by('student__admission_number', 'year', 'term')
        )
        year = request.query_params.get('year')
        term = request.query_params.get('term')
        student_id = request.query_params.get('student_id')
        class_id = request.query_params.get('class_id')
        if year:
            queryset = queryset.filter(year=int(year))
        if term:
            queryset = queryset.filter(term=int(term))
        if student_id:
            queryset = queryset.filter(student_id=int(student_id))
        if class_id:
            queryset = queryset.filter(student__current_class_id=int(class_id))

        yield ['Admission Number', 'Student Name', 'Class', 'Year', 'Term', 'Closing Balance']
        for balance in queryset:
            yield [
                balance.student.admission_number,
                balance.student.full_name,
                balance.student.current_class.name if balance.student.current_class else '',
                balance.year,
                balance.term,
                float(balance.closing_balance or 0),
            ]

    def _build_student_aging_rows(self, request, school):
        today = timezone.localdate()
        as_of_raw = request.query_params.get('as_of_date')
        as_of_date = today
        if as_of_raw:
            parsed = parse_date(as_of_raw)
            if parsed:
                as_of_date = parsed

        queryset = (
            FeeBalance.objects.filter(school=school, closing_balance__gt=0)
            .select_related('student', 'student__current_class')
            .order_by('student__admission_number', 'year', 'term')
        )
        student_id = request.query_params.get('student_id')
        class_id = request.query_params.get('class_id')
        if student_id:
            queryset = queryset.filter(student_id=int(student_id))
        if class_id:
            queryset = queryset.filter(student__current_class_id=int(class_id))

        student_totals = {}
        for balance in queryset:
            student = balance.student
            key = student.id
            if key not in student_totals:
                student_totals[key] = {
                    'admission_number': student.admission_number,
                    'student_name': student.full_name,
                    'class_name': student.current_class.name if student.current_class else '',
                    '0_30': Decimal('0.00'),
                    '31_60': Decimal('0.00'),
                    '61_90': Decimal('0.00'),
                    '90_plus': Decimal('0.00'),
                    'total': Decimal('0.00'),
                }

            reference_date = _term_reference_date(balance.year, balance.term)
            age_days = max((as_of_date - reference_date).days, 0)
            amount = balance.closing_balance or Decimal('0.00')
            if age_days <= 30:
                student_totals[key]['0_30'] += amount
            elif age_days <= 60:
                student_totals[key]['31_60'] += amount
            elif age_days <= 90:
                student_totals[key]['61_90'] += amount
            else:
                student_totals[key]['90_plus'] += amount
            student_totals[key]['total'] += amount

        yield ['Admission Number', 'Student Name', 'Class', '0-30', '31-60', '61-90', '90+', 'Total']
        for student_data in sorted(student_totals.values(), key=lambda item: item['admission_number']):
            yield [
                student_data['admission_number'],
                student_data['student_name'],
                student_data['class_name'],
                float(student_data['0_30']),
                float(student_data['31_60']),
                float(student_data['61_90']),
                float(student_data['90_plus']),
                float(student_data['total']),
            ]

    def _build_collection_effectiveness_rows(self, request, school):
        start_year = request.query_params.get('start_year')
        end_year = request.query_params.get('end_year')

        queryset = FeeBalance.objects.filter(school=school)
        if start_year:
            queryset = queryset.filter(year__gte=int(start_year))
        if end_year:
            queryset = queryset.filter(year__lte=int(end_year))

        grouped = (
            queryset.values('year', 'term')
            .annotate(
                invoiced=Sum('amount_invoiced'),
                paid=Sum('amount_paid'),
                closing=Sum('closing_balance'),
            )
            .order_by('year', 'term')
        )

        yield ['Year', 'Term', 'Invoiced', 'Paid', 'Collection Rate (%)', 'Arrears', 'Prepayment']
        for row in grouped:
            invoiced = Decimal(row['invoiced'] or 0)
            paid = Decimal(row['paid'] or 0)
            closing = Decimal(row['closing'] or 0)
            arrears = closing if closing > 0 else Decimal('0.00')
            prepayment = abs(closing) if closing < 0 else Decimal('0.00')
            rate = (paid / invoiced * Decimal('100.00')) if invoiced > 0 else Decimal('0.00')
            yield [
                row['year'],
                row['term'],
                float(invoiced),
                float(paid),
                float(rate.quantize(Decimal('0.01'))),
                float(arrears),
                float(prepayment),
            ]

    def _build_activity_rows(self, request, school):
        queryset = ActivityLog.objects.filter(school=school).select_related('actor')
        action = request.query_params.get('action')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if action:
            queryset = queryset.filter(action=action)
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        yield ['Timestamp', 'User', 'Action', 'Context']
        for row in queryset.order_by('-created_at')[:1000]:
            yield [
                timezone.localtime(row.created_at).isoformat(),
                row.actor.full_name if row.actor else 'System',
                row.action,
                row.description,
            ]

    def _build_rows(self, report, request, school):
        if report == 'outstanding':
            yield from self._build_outstanding_rows(request, school)
        elif report == 'student_aging':
            yield from self._build_student_aging_rows(request, school)
        elif report == 'collection_effectiveness':
            yield from self._build_collection_effectiveness_rows(request, school)
        else:
            yield from self._build_activity_rows(request, school)

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        report = request.query_params.get('report')
        stream = request.query_params.get('stream') == 'true'
        if report not in {'outstanding', 'student_aging', 'collection_effectiveness', 'activity_log'}:
            return Response(
                {'detail': 'report must be one of: outstanding, student_aging, collection_effectiveness, activity_log.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_cls = StreamingHttpResponse if stream else HttpResponse
        response = response_cls(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="finance-{report}-report.csv"'
        rows = self._build_rows(report, request, school)

        if stream:
            response.streaming_content = self._iter_csv(rows)
            return response

        writer = csv.writer(response)
        for row in rows:
            writer.writerow(row)

        return response


def _materialize_due_scheduled_exports(school):
    now = timezone.now()
    due_jobs = ScheduledExportJob.objects.filter(school=school, status='SCHEDULED', run_at__lte=now)
    due_jobs.update(status='READY', executed_at=now)


class ScheduledExportJobsAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    ALLOWED_REPORTS = {'outstanding', 'student_aging', 'collection_effectiveness', 'activity_log'}

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        _materialize_due_scheduled_exports(school)

        status_filter = request.query_params.get('status')
        limit = int(request.query_params.get('limit', 50) or 50)
        limit = max(1, min(limit, 200))

        queryset = ScheduledExportJob.objects.filter(school=school)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        rows = [
            {
                'id': job.id,
                'report': job.report,
                'filters': job.filters or {},
                'run_at': job.run_at.isoformat(),
                'status': job.status,
                'executed_at': job.executed_at.isoformat() if job.executed_at else None,
                'notes': job.notes,
                'created_at': job.created_at.isoformat(),
                'download_url': f'/api/finance/reports/export-jobs/{job.id}/download/' if job.status in {'READY', 'COMPLETED'} else None,
            }
            for job in queryset.order_by('-run_at', '-id')[:limit]
        ]

        return Response({'count': len(rows), 'results': rows})

    def post(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        report = request.data.get('report')
        run_at_raw = request.data.get('run_at')
        filters = request.data.get('filters') or {}
        notes = request.data.get('notes') or ''

        if report not in self.ALLOWED_REPORTS:
            return Response({'detail': 'Invalid report type.'}, status=status.HTTP_400_BAD_REQUEST)
        if not run_at_raw:
            return Response({'detail': 'run_at is required (ISO datetime).'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(filters, dict):
            return Response({'detail': 'filters must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            run_at = datetime.fromisoformat(str(run_at_raw).replace('Z', '+00:00'))
        except ValueError:
            return Response({'detail': 'run_at must be a valid ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.is_naive(run_at):
            run_at = timezone.make_aware(run_at, timezone.get_current_timezone())

        job = ScheduledExportJob.objects.create(
            school=school,
            created_by=request.user,
            report=report,
            filters=filters,
            run_at=run_at,
            notes=str(notes)[:500],
        )

        _log_finance_activity(
            school=school,
            actor=request.user,
            action='FINANCE_EXPORT_SCHEDULED',
            description=f'Scheduled {report} export.',
            metadata={
                'scheduled_export_id': job.id,
                'report': report,
                'run_at': job.run_at.isoformat(),
                'filters': filters,
            },
        )

        return Response(
            {
                'detail': 'Scheduled export created.',
                'job': {
                    'id': job.id,
                    'report': job.report,
                    'filters': job.filters or {},
                    'run_at': job.run_at.isoformat(),
                    'status': job.status,
                    'notes': job.notes,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class ScheduledExportJobDownloadAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request, job_id):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        _materialize_due_scheduled_exports(school)

        try:
            job = ScheduledExportJob.objects.get(id=job_id, school=school)
        except ScheduledExportJob.DoesNotExist:
            return Response({'detail': 'Scheduled export not found.'}, status=status.HTTP_404_NOT_FOUND)

        if job.status == 'CANCELLED':
            return Response({'detail': 'Scheduled export was cancelled.'}, status=status.HTTP_409_CONFLICT)
        if job.status == 'SCHEDULED':
            return Response({'detail': 'Scheduled export is not due yet.'}, status=status.HTTP_409_CONFLICT)

        report_view = FinanceReportsExportCSVView()

        params = {'report': job.report}
        for key, value in (job.filters or {}).items():
            if value is None:
                continue
            params[key] = str(value)

        class _ProxyRequest:
            def __init__(self, query_params):
                self.query_params = query_params

        rows = report_view._build_rows(job.report, _ProxyRequest(params), school)
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="scheduled-{job.report}-report-{job.id}.csv"'
        writer = csv.writer(response)
        for row in rows:
            writer.writerow(row)

        if job.status != 'COMPLETED':
            job.status = 'COMPLETED'
            job.executed_at = timezone.now()
            job.save(update_fields=['status', 'executed_at', 'updated_at'])

            _log_finance_activity(
                school=school,
                actor=request.user,
                action='FINANCE_SCHEDULED_EXPORT_DOWNLOADED',
                description=f'Downloaded scheduled {job.report} export.',
                metadata={
                    'scheduled_export_id': job.id,
                    'report': job.report,
                },
            )

        return response


class ScheduledExportJobCancelAPIView(APIView):
    permission_classes = [FinanceAccessPermission]

    def post(self, request, job_id):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            job = ScheduledExportJob.objects.get(id=job_id, school=school)
        except ScheduledExportJob.DoesNotExist:
            return Response({'detail': 'Scheduled export not found.'}, status=status.HTTP_404_NOT_FOUND)

        if job.status == 'COMPLETED':
            return Response({'detail': 'Completed exports cannot be cancelled.'}, status=status.HTTP_409_CONFLICT)
        if job.status == 'CANCELLED':
            return Response({'detail': 'Scheduled export already cancelled.'}, status=status.HTTP_200_OK)

        job.status = 'CANCELLED'
        job.save(update_fields=['status', 'updated_at'])

        _log_finance_activity(
            school=school,
            actor=request.user,
            action='FINANCE_SCHEDULED_EXPORT_CANCELLED',
            description=f'Cancelled scheduled {job.report} export.',
            metadata={'scheduled_export_id': job.id, 'report': job.report},
        )

        return Response({'detail': 'Scheduled export cancelled.'}, status=status.HTTP_200_OK)

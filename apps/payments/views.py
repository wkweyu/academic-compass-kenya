from decimal import Decimal
import csv

from django.http import HttpResponse, StreamingHttpResponse
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.fees.models import PaymentTransaction
from apps.payments.models import PaymentEvent
from apps.payments.serializers import PaymentEventSerializer
from apps.payments.services.reconciliation import ReconciliationService
from apps.fees.services.activity_log import log_finance_activity


class FinanceAccessPermission(permissions.BasePermission):
    """Allow admins and finance roles to access finance operations endpoints."""

    allowed_roles = {'bursar', 'finance', 'finance_staff', 'accountant'}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        return getattr(user, 'role', '').lower() in self.allowed_roles


class PaymentEventListView(ListAPIView):
    serializer_class = PaymentEventSerializer
    permission_classes = [FinanceAccessPermission]

    def get_queryset(self):
        queryset = PaymentEvent.unscoped.select_related('student', 'school').order_by('-created_at')

        user = self.request.user
        if not (user.is_superuser or user.is_staff) and getattr(user, 'school_id', None):
            queryset = queryset.filter(school_id=user.school_id)

        status_value = self.request.query_params.get('status')
        provider = self.request.query_params.get('provider')
        search = self.request.query_params.get('search')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if status_value:
            queryset = queryset.filter(status=status_value)
        if provider:
            queryset = queryset.filter(provider=provider)
        if search:
            queryset = queryset.filter(
                Q(transaction_code__icontains=search)
                | Q(reference__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
            )
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        return queryset


class PaymentEventDetailView(RetrieveAPIView):
    serializer_class = PaymentEventSerializer
    permission_classes = [FinanceAccessPermission]

    def get_queryset(self):
        queryset = PaymentEvent.unscoped.select_related('student', 'school', 'ingress_log', 'payment_transaction')
        user = self.request.user
        if not (user.is_superuser or user.is_staff) and getattr(user, 'school_id', None):
            queryset = queryset.filter(school_id=user.school_id)
        return queryset


class UnresolvedPaymentEventListView(ListAPIView):
    serializer_class = PaymentEventSerializer
    permission_classes = [FinanceAccessPermission]

    def get_queryset(self):
        queryset = PaymentEvent.unscoped.select_related('student', 'school').filter(
            status__in=['UNRESOLVED_STUDENT', 'INVALID_REFERENCE']
        ).order_by('-created_at')

        user = self.request.user
        if not (user.is_superuser or user.is_staff) and getattr(user, 'school_id', None):
            queryset = queryset.filter(school_id=user.school_id)

        return queryset


class ReprocessPaymentEventView(APIView):
    permission_classes = [FinanceAccessPermission]

    def post(self, request, pk):
        event = PaymentEvent.unscoped.select_related('payment_config', 'school').filter(pk=pk).first()
        if not event:
            return Response({'detail': 'Payment event not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = ReconciliationService.reprocess(event)
        except ValueError as exc:
            return Response(
                {'detail': str(exc), 'event_id': str(event.id)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log_finance_activity(
            school=event.school,
            user=request.user,
            action='REPROCESS',
            object_id=str(event.id),
            details={
                'payment_event_id': str(event.id),
                'provider': event.provider,
                'transaction_code': event.transaction_code,
                'retry_count': result.retry_count,
                'status': result.status,
            },
            result=result.status,
            message='Reprocessed unresolved payment event.'
        )

        return Response(
            {
                'detail': 'Reprocess completed.',
                'event': PaymentEventSerializer(result).data,
            },
            status=status.HTTP_200_OK,
        )


class PaymentDashboardView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        queryset = PaymentEvent.unscoped.all()

        user = request.user
        if not (user.is_superuser or user.is_staff) and getattr(user, 'school_id', None):
            queryset = queryset.filter(school_id=user.school_id)

        today = timezone.localdate()
        base = queryset.aggregate(
            total_events=Count('id'),
            reconciled_events=Count('id', filter=Q(status='RECONCILED')),
            unresolved_events=Count('id', filter=Q(status__in=['UNRESOLVED_STUDENT', 'INVALID_REFERENCE'])),
            duplicate_events=Count('id', filter=Q(status='DUPLICATE')),
            today_amount=Sum('amount', filter=Q(created_at__date=today)),
            total_amount=Sum('amount'),
        )

        providers = list(
            queryset.values('provider')
            .annotate(
                count=Count('id'),
                amount=Sum('amount'),
            )
            .order_by('provider')
        )

        def to_float(value):
            if isinstance(value, Decimal):
                return float(value)
            if value is None:
                return 0.0
            return float(value)

        return Response(
            {
                'total_events': base.get('total_events', 0) or 0,
                'reconciled_events': base.get('reconciled_events', 0) or 0,
                'unresolved_events': base.get('unresolved_events', 0) or 0,
                'duplicate_events': base.get('duplicate_events', 0) or 0,
                'total_amount': to_float(base.get('total_amount')),
                'today_amount': to_float(base.get('today_amount')),
                'providers': [
                    {
                        'provider': item['provider'],
                        'count': item['count'],
                        'amount': to_float(item['amount']),
                    }
                    for item in providers
                ],
            }
        )


class DailyCollectionsReportView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school and not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = PaymentTransaction.objects.all()
        if school:
            queryset = queryset.filter(school=school)
        if start_date:
            queryset = queryset.filter(date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__date__lte=end_date)

        grouped = (
            queryset.annotate(day=TruncDate('date'))
            .values('day')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-day')
        )

        return Response(
            {
                'count': len(grouped),
                'results': [
                    {
                        'date': item['day'].isoformat() if item['day'] else None,
                        'count': item['count'],
                        'amount': float(item['total'] or 0),
                    }
                    for item in grouped
                ],
            }
        )


class ProviderCollectionsReportView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school and not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = PaymentEvent.unscoped.filter(status='RECONCILED')
        if school:
            queryset = queryset.filter(school=school)
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        grouped = (
            queryset.values('provider')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('provider')
        )

        return Response(
            {
                'count': len(grouped),
                'results': [
                    {
                        'provider': row['provider'],
                        'count': row['count'],
                        'amount': float(row['total'] or 0),
                    }
                    for row in grouped
                ],
            }
        )


class VoteheadCollectionsReportView(APIView):
    permission_classes = [FinanceAccessPermission]

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school and not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = PaymentTransaction.objects.all()
        if school:
            queryset = queryset.filter(school=school)
        if start_date:
            queryset = queryset.filter(date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__date__lte=end_date)

        totals = {}
        for txn in queryset.only('apportion_log'):
            allocations = txn.apportion_log or {}
            if not isinstance(allocations, dict):
                continue
            for votehead_name, value in allocations.items():
                try:
                    amount = Decimal(str(value))
                except Exception:
                    continue
                totals[votehead_name] = totals.get(votehead_name, Decimal('0.00')) + amount

        rows = [
            {'vote_head': vote_head, 'amount': float(amount)}
            for vote_head, amount in sorted(totals.items(), key=lambda item: item[0].lower())
        ]
        return Response({'count': len(rows), 'results': rows})


class PaymentReportsExportCSVView(APIView):
    permission_classes = [FinanceAccessPermission]

    class _Echo:
        def write(self, value):
            return value

    def _build_rows(self, report, school, start_date, end_date):
        if report == 'daily':
            queryset = PaymentTransaction.objects.all()
            if school:
                queryset = queryset.filter(school=school)
            if start_date:
                queryset = queryset.filter(date__date__gte=start_date)
            if end_date:
                queryset = queryset.filter(date__date__lte=end_date)

            grouped = (
                queryset.annotate(day=TruncDate('date'))
                .values('day')
                .annotate(total=Sum('amount'), count=Count('id'))
                .order_by('-day')
            )

            yield ['Date', 'Transactions', 'Amount']
            for item in grouped:
                yield [
                    item['day'].isoformat() if item['day'] else '',
                    item['count'],
                    float(item['total'] or 0),
                ]

        elif report == 'providers':
            queryset = PaymentEvent.unscoped.filter(status='RECONCILED')
            if school:
                queryset = queryset.filter(school=school)
            if start_date:
                queryset = queryset.filter(created_at__date__gte=start_date)
            if end_date:
                queryset = queryset.filter(created_at__date__lte=end_date)

            grouped = (
                queryset.values('provider')
                .annotate(total=Sum('amount'), count=Count('id'))
                .order_by('provider')
            )

            yield ['Provider', 'Transactions', 'Amount']
            for row in grouped:
                yield [row['provider'], row['count'], float(row['total'] or 0)]

        else:
            queryset = PaymentTransaction.objects.all()
            if school:
                queryset = queryset.filter(school=school)
            if start_date:
                queryset = queryset.filter(date__date__gte=start_date)
            if end_date:
                queryset = queryset.filter(date__date__lte=end_date)

            totals = {}
            for txn in queryset.only('apportion_log'):
                allocations = txn.apportion_log or {}
                if not isinstance(allocations, dict):
                    continue
                for votehead_name, value in allocations.items():
                    try:
                        amount = Decimal(str(value))
                    except Exception:
                        continue
                    totals[votehead_name] = totals.get(votehead_name, Decimal('0.00')) + amount

            yield ['Votehead', 'Amount']
            for vote_head, amount in sorted(totals.items(), key=lambda item: item[0].lower()):
                yield [vote_head, float(amount)]

    def _iter_csv(self, rows):
        pseudo_buffer = self._Echo()
        writer = csv.writer(pseudo_buffer)
        for row in rows:
            yield writer.writerow(row)

    def get(self, request):
        school = getattr(request.user, 'school', None)
        if not school and not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'User has no school assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        report = request.query_params.get('report')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        stream = request.query_params.get('stream') == 'true'
        if report not in {'daily', 'providers', 'voteheads'}:
            return Response({'detail': 'report must be one of: daily, providers, voteheads.'}, status=status.HTTP_400_BAD_REQUEST)

        response_cls = StreamingHttpResponse if stream else HttpResponse
        response = response_cls(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="payment-{report}-report.csv"'
        rows = self._build_rows(report, school, start_date, end_date)

        if stream:
            response.streaming_content = self._iter_csv(rows)
            return response

        writer = csv.writer(response)
        for row in rows:
            writer.writerow(row)

        return response

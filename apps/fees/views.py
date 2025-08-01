from rest_framework import generics, permissions
from .models import VoteHead, FeeStructure,PaymentTransaction,FeeBalance,Student,DebitTransaction
from .serializers import VoteHeadSerializer, FeeStructureSerializer,PaymentTransactionSerializer,FeeBalanceSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from apps.settings.models import TermSetting
from apps.students.models import Student
from rest_framework import permissions


class VoteHeadListCreateView(generics.ListCreateAPIView):
    queryset = VoteHead.objects.all()
    serializer_class = VoteHeadSerializer
    permission_classes = [permissions.IsAuthenticated]


class FeeStructureListCreateView(generics.ListCreateAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [permissions.IsAuthenticated]


class PaymentTransactionListCreateView(generics.ListCreateAPIView):
    queryset = PaymentTransaction.objects.all()
    serializer_class = PaymentTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]



class FeeBalanceListCreateView(generics.ListCreateAPIView):
    queryset = FeeBalance.objects.all()
    serializer_class = FeeBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]


class DailyCollectionReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        date = request.GET.get('date')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        if date:
            transactions = PaymentTransaction.objects.filter(school=school, date__date=date)
        elif start_date and end_date:
            transactions = PaymentTransaction.objects.filter(school=school, date__date__range=[start_date, end_date])
        else:
            return Response({'error': 'Provide either "date" or "start_date" & "end_date".'}, status=400)

        total_amount = transactions.aggregate(total=Sum('amount'))['total'] or 0
        by_mode = transactions.values('mode').annotate(total=Sum('amount'))

        # Build votehead-wise total from apportion logs
        votehead_totals = {}
        for t in transactions:
            for item in t.apportion_log:
                vh = item['vote_head']
                amount = item['amount']
                votehead_totals[vh] = votehead_totals.get(vh, 0) + float(amount)

        return Response({
            'total_collected': total_amount,
            'collections_by_mode': by_mode,
            'collections_by_vote_head': votehead_totals,
            'transaction_count': transactions.count()
        })


class BulkDebitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        school = request.user.school
        year = request.data.get('year')
        term = request.data.get('term')
        class_name = request.data.get('class_name')
        stream = request.data.get('stream')
        student_group = request.data.get('student_group')

        if not (year and term):
            return Response({'error': 'Year and term are required'}, status=400)

        students = Student.objects.filter(school=school)
        if class_name:
            students = students.filter(class_name=class_name)
        if stream:
            students = students.filter(stream=stream)
        if student_group:
            students = students.filter(student_group=student_group)

        vote_heads = VoteHead.objects.filter(school=school, fee_applicable=True)

        count = 0
        for student in students:
            
            for vh in vote_heads:
                # Example: transport charge varies, term fees from FeeStructure
                if vh.name == 'Transport':
                    transport_amount = get_student_transport_amount(student, year, term)
                    if transport_amount > 0:
                        count += 1
                        self.record_debit(school, student, vh, year, term, transport_amount)
                else:
                    try:
                        fs = FeeStructure.objects.get(school=school, year=year, term=term, vote_head=vh)
                        amount = fs.amount
                        if amount > 0:
                            count += 1
                            self.record_debit(school, student, vh, year, term, amount)
                    except FeeStructure.DoesNotExist:
                        continue
            
            if student.is_on_transport and student.transport_route:
                votehead = VoteHead.objects.get(name="Transport")
                if student.transport_type == 'one_way':
                    charge = student.transport_route.one_way_charge
                    
                else:
                    charge = student.transport_route.two_way_charge

            if charge > 0:
                DebitTransaction.objects.create(
                    student=student,
                    vote_head=votehead,
                    amount=charge,
                    year=year,
                    term=term,
                    description=f"Transport charge ({student.transport_type})"
                )            
        return Response({'status': f"{count} debit transactions recorded."})

    def record_debit(self, school, student, vote_head, year, term, amount):
        invoice_no = f"INV{timezone.now().strftime('%Y%m%d%H%M%S')}{student.id}"
        DebitTransaction.objects.update_or_create(
            school=school,
            student=student,
            vote_head=vote_head,
            year=year,
            term=term,
            defaults={
                'amount': amount,
                'invoice_number': invoice_no,
                'date': timezone.now()
            }
        )
        balance, created = FeeBalance.objects.get_or_create(
            school=school,
            student=student,
            vote_head=vote_head,
            year=year,
            term=term,
            defaults={'opening_balance': 0, 'amount_invoiced': 0, 'amount_paid': 0}
        )
        balance.amount_invoiced += amount
        balance.update_balance()

# Placeholder function for transport rates — customize as needed
def get_student_transport_amount(student, year, term):
    # Could fetch from a TransportFee table or route setting
    return student.transport_fee if hasattr(student, 'transport_fee') else 0



class InvoicePrintView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id, year, term):
        school = request.user.school

        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({"error": "Student not found."}, status=404)

        try:
            term_setting = TermSetting.objects.get(school=school, year=year, term=term)
        except TermSetting.DoesNotExist:
            return Response({"error": "Term settings missing."}, status=400)

        debits = DebitTransaction.objects.filter(
            school=school, student=student, year=year, term=term
        )

        payments = PaymentTransaction.objects.filter(
            school=school, student=student, date__range=[term_setting.start_date, term_setting.end_date]
        )

        balances = FeeBalance.objects.filter(
            school=school, student=student, year=year, term=term
        )

        # Build structured response
        debit_data = [
            {
                "vote_head": d.vote_head.name,
                "amount": float(d.amount),
                "invoice_no": d.invoice_number,
                "date": d.date.strftime("%d-%m-%Y")
            } for d in debits
        ]

        payment_data = [
            {
                "mode": p.mode,
                "amount": float(p.amount),
                "transaction_code": p.transaction_code,
                "date": p.date.strftime("%d-%m-%Y")
            } for p in payments
        ]

        balance_data = [
            {
                "vote_head": b.vote_head.name,
                "invoiced": float(b.amount_invoiced),
                "paid": float(b.amount_paid),
                "balance": float(b.closing_balance)
            } for b in balances
        ]

        return Response({
            "school": school.name,
            "student": student.full_name,
            "adm_no": student.adm_no,
            "class": student.class_name,
            "term": term,
            "year": year,
            "term_dates": {
                "start": term_setting.start_date.strftime("%d-%m-%Y"),
                "end": term_setting.end_date.strftime("%d-%m-%Y")
            },
            "debits": debit_data,
            "payments": payment_data,
            "balances": balance_data
        })

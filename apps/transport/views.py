from django.shortcuts import render
from rest_framework import viewsets, permissions
from .models import TransportRoute
from .serializers import TransportRouteSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from apps.students.models import Student
from apps.fees.models import DebitTransaction, PaymentTransaction, VoteHead
from apps.core.middleware import get_current_school




class TransportRouteViewSet(viewsets.ModelViewSet):
    queryset = TransportRoute.objects.all()
    serializer_class = TransportRouteSerializer
    permission_classes = [permissions.IsAuthenticated]


class TransportChargeReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        term = request.GET.get('term')
        year = request.GET.get('year')
        route_id = request.GET.get('route')
        transport_type = request.GET.get('transport_type')
        school = get_current_school()

        transport_votehead = FeeVoteHead.objects.get(name="Transport")

        students = Student.objects.filter(school=school, is_on_transport=True)
        if route_id:
            students = students.filter(transport_route_id=route_id)
        if transport_type:
            students = students.filter(transport_type=transport_type)

        report = []
        total_billed = total_paid = total_balance = 0

        for student in students:
            charge_qs = DebitTransaction.objects.filter(
                student=student,
                vote_head=transport_votehead,
                term=term,
                year=year
            )
            charge_amount = charge_qs.aggregate(Sum('amount'))['amount__sum'] or 0

            paid_qs = PaymentTransaction.objects.filter(
                student=student,
                vote_head=transport_votehead,
                term=term,
                year=year
            )
            amount_paid = paid_qs.aggregate(Sum('amount'))['amount__sum'] or 0

            balance = charge_amount - amount_paid

            report.append({
                'student_name': student.full_name,
                'adm_no': student.adm_no,
                'route': student.transport_route.name if student.transport_route else '',
                'transport_type': student.transport_type,
                'charge_amount': charge_amount,
                'amount_paid': amount_paid,
                'balance': balance
            })

            total_billed += charge_amount
            total_paid += amount_paid
            total_balance += balance

        return Response({
            'data': report,
            'totals': {
                'total_billed': total_billed,
                'total_paid': total_paid,
                'total_balance': total_balance
            }
        })



class TransportReceiptView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        school = get_current_school()

        try:
            transaction = PaymentTransaction.objects.get(id=payment_id)
        except PaymentTransaction.DoesNotExist:
            return Response({'error': 'Receipt not found.'}, status=404)

        if transaction.student.school != school:
            return Response({'error': 'Unauthorized.'}, status=403)

        votehead = FeeVoteHead.objects.get(name="Transport")

        total_debits = DebitTransaction.objects.filter(
            student=transaction.student,
            vote_head=votehead,
            term=transaction.term,
            year=transaction.year
        ).aggregate(total=models.Sum('amount'))['total'] or 0

        total_paid = PaymentTransaction.objects.filter(
            student=transaction.student,
            vote_head=votehead,
            term=transaction.term,
            year=transaction.year
        ).aggregate(total=models.Sum('amount'))['total'] or 0

        remaining_balance = total_debits - total_paid

        serializer = TransportReceiptSerializer(transaction)
        receipt_data = serializer.data
        receipt_data['remaining_balance'] = remaining_balance

        return Response(receipt_data)

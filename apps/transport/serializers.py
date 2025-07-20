from rest_framework import serializers
from students.models import Student
from fees.models import DebitTransaction, PaymentTransaction
from transport.models import TransportRoute



class TransportRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportRoute
        fields = '__all__'


class TransportChargeReportSerializer(serializers.Serializer):
    student_name = serializers.CharField()
    adm_no = serializers.CharField()
    route = serializers.CharField()
    transport_type = serializers.CharField()
    charge_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    balance = serializers.DecimalField(max_digits=10, decimal_places=2)



class TransportReceiptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name')
    adm_no = serializers.CharField(source='student.adm_no')
    route = serializers.CharField(source='student.transport_route.name')
    transport_type = serializers.CharField(source='student.transport_type')

    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'student_name', 'adm_no', 'route', 'transport_type',
            'amount', 'transaction_code', 'payment_mode', 'term', 'year', 'date_created'
        ]

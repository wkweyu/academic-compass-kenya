from rest_framework import serializers

from .models import PaymentEvent, PaymentIngressLog


class PaymentIngressLogSerializer(serializers.ModelSerializer):
    resolved_school_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentIngressLog
        fields = [
            'id',
            'provider',
            'short_code',
            'source_ip',
            'received_at',
            'resolved_school',
            'resolved_school_name',
        ]
        read_only_fields = fields

    def get_resolved_school_name(self, obj):
        return obj.resolved_school.name if obj.resolved_school else None


class PaymentEventSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    school_name = serializers.SerializerMethodField()
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    sms_status_display = serializers.CharField(source='get_sms_status_display', read_only=True)
    ingress_received_at = serializers.DateTimeField(source='ingress_log.received_at', read_only=True)
    routed_at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = PaymentEvent
        fields = [
            'id',
            'idempotency_key',
            'provider',
            'provider_display',
            'transaction_code',
            'amount',
            'phone_number',
            'reference',
            'status',
            'status_display',
            'error_message',
            'student',
            'student_name',
            'school',
            'school_name',
            'payment_transaction',
            'retry_count',
            'processed_at',
            'sms_status',
            'sms_status_display',
            'sms_sent_at',
            'ingress_received_at',
            'routed_at',
            'system_version',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else None

    def get_school_name(self, obj):
        return obj.school.name if obj.school else None

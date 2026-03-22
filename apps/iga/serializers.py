from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    Activity,
    ActivityBudget,
    ActivityExpense,
    ExpenseStatus,
    InventoryMovement,
    InventoryStock,
    Product,
    ProduceSale,
    ProductionRecord,
)
from .services import (
    InventoryError,
    adjust_inventory,
    approve_expense,
    create_expense,
    record_internal_consumption,
    record_production,
    record_sale,
    record_spoilage,
    reject_expense,
)


class SchoolScopedSerializerMixin:
    def _get_school(self):
        request = self.context.get('request')
        return getattr(getattr(request, 'user', None), 'school', None)

    def _validate_school_match(self, instance, field_name):
        school = self._get_school()
        if school and instance and instance.school_id != school.id:
            raise serializers.ValidationError({field_name: 'Selected record does not belong to your school.'})

    def _handle_service_validation_error(self, exc):
        if isinstance(exc, DjangoValidationError):
            if getattr(exc, 'message_dict', None):
                raise serializers.ValidationError(exc.message_dict) from exc
            raise serializers.ValidationError(exc.messages) from exc
        raise exc


class ActivitySerializer(SchoolScopedSerializerMixin, serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.full_name', read_only=True)

    class Meta:
        model = Activity
        fields = '__all__'
        read_only_fields = ('school', 'created_at', 'updated_at')


class ProductSerializer(SchoolScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ('school', 'created_at', 'updated_at')


class InventoryStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = InventoryStock
        fields = '__all__'
        read_only_fields = ('school', 'created_at', 'updated_at', 'last_updated')


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = InventoryMovement
        fields = '__all__'
        read_only_fields = ('school', 'created_at', 'updated_at')


class ProductionRecordSerializer(SchoolScopedSerializerMixin, serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = ProductionRecord
        fields = '__all__'
        read_only_fields = ('school', 'created_at', 'updated_at', 'recorded_by')

    def validate(self, attrs):
        self._validate_school_match(attrs.get('activity'), 'activity')
        self._validate_school_match(attrs.get('product'), 'product')
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        school = request.user.school
        try:
            return record_production(
                school=school,
                activity=validated_data['activity'],
                product=validated_data['product'],
                quantity=validated_data['quantity'],
                unit=validated_data.get('unit'),
                production_date=validated_data.get('production_date'),
                recorded_by=request.user,
                notes=validated_data.get('notes', ''),
            )
        except DjangoValidationError as exc:
            self._handle_service_validation_error(exc)


class ProduceSaleSerializer(SchoolScopedSerializerMixin, serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = ProduceSale
        fields = '__all__'
        read_only_fields = (
            'school',
            'created_at',
            'updated_at',
            'recorded_by',
            'total_amount',
            'accounting_entry',
            'accounting_posted_at',
        )

    def validate(self, attrs):
        self._validate_school_match(attrs.get('activity'), 'activity')
        self._validate_school_match(attrs.get('product'), 'product')
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        school = request.user.school
        try:
            return record_sale(
                school=school,
                activity=validated_data['activity'],
                product=validated_data['product'],
                quantity=validated_data['quantity'],
                unit_price=validated_data.get('unit_price'),
                customer_name=validated_data.get('customer_name', ''),
                sale_date=validated_data.get('sale_date'),
                payment_method=validated_data.get('payment_method'),
                recorded_by=request.user,
                reference=validated_data.get('reference', ''),
            )
        except (InventoryError, DjangoValidationError) as exc:
            if isinstance(exc, InventoryError):
                raise serializers.ValidationError({'quantity': str(exc)}) from exc
            self._handle_service_validation_error(exc)


class ActivityExpenseSerializer(SchoolScopedSerializerMixin, serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)

    class Meta:
        model = ActivityExpense
        fields = '__all__'
        read_only_fields = (
            'school',
            'created_at',
            'updated_at',
            'recorded_by',
            'approved_by',
            'approved_at',
            'status',
            'accounting_entry',
            'accounting_posted_at',
        )

    def validate(self, attrs):
        self._validate_school_match(attrs.get('activity'), 'activity')
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        try:
            return create_expense(
                school=request.user.school,
                activity=validated_data['activity'],
                expense_category=validated_data['expense_category'],
                description=validated_data['description'],
                amount=validated_data['amount'],
                expense_date=validated_data.get('expense_date'),
                recorded_by=request.user,
                procurement_reference=validated_data.get('procurement_reference', ''),
            )
        except DjangoValidationError as exc:
            self._handle_service_validation_error(exc)

    def update(self, instance, validated_data):
        if instance.status != ExpenseStatus.PENDING:
            raise serializers.ValidationError('Only pending expenses can be edited.')
        return super().update(instance, validated_data)


class ActivityBudgetSerializer(SchoolScopedSerializerMixin, serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True)

    class Meta:
        model = ActivityBudget
        fields = '__all__'
        read_only_fields = ('school', 'created_at', 'updated_at')

    def validate(self, attrs):
        self._validate_school_match(attrs.get('activity'), 'activity')
        return attrs


class ExpenseDecisionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class InventoryActionSerializer(SchoolScopedSerializerMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    activity = serializers.PrimaryKeyRelatedField(queryset=Activity.objects.all(), required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        self._validate_school_match(attrs.get('product'), 'product')
        activity = attrs.get('activity')
        if activity:
            self._validate_school_match(activity, 'activity')
        return attrs


class InventoryAdjustmentSerializer(SchoolScopedSerializerMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    activity = serializers.PrimaryKeyRelatedField(queryset=Activity.objects.all(), required=False, allow_null=True)
    quantity_delta = serializers.DecimalField(max_digits=12, decimal_places=2)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        self._validate_school_match(attrs.get('product'), 'product')
        activity = attrs.get('activity')
        if activity:
            self._validate_school_match(activity, 'activity')
        return attrs


class InventoryActionResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    movement_id = serializers.IntegerField(required=False)
    stock_id = serializers.IntegerField(required=False)
    accounting_entry = serializers.JSONField(required=False)


def execute_spoilage_action(*, serializer):
    request = serializer.context['request']
    try:
        return record_spoilage(
            school=request.user.school,
            product=serializer.validated_data['product'],
            quantity=serializer.validated_data['quantity'],
            activity=serializer.validated_data.get('activity'),
            reference=serializer.validated_data.get('reference', ''),
            recorded_by=request.user,
            notes=serializer.validated_data.get('notes', ''),
        )
    except (InventoryError, DjangoValidationError) as exc:
        if isinstance(exc, InventoryError):
            raise serializers.ValidationError({'quantity': str(exc)}) from exc
        serializer._handle_service_validation_error(exc)


def execute_internal_use_action(*, serializer):
    request = serializer.context['request']
    try:
        return record_internal_consumption(
            school=request.user.school,
            product=serializer.validated_data['product'],
            quantity=serializer.validated_data['quantity'],
            activity=serializer.validated_data.get('activity'),
            reference=serializer.validated_data.get('reference', ''),
            recorded_by=request.user,
            notes=serializer.validated_data.get('notes', ''),
        )
    except (InventoryError, DjangoValidationError) as exc:
        if isinstance(exc, InventoryError):
            raise serializers.ValidationError({'quantity': str(exc)}) from exc
        serializer._handle_service_validation_error(exc)


def execute_adjustment_action(*, serializer):
    request = serializer.context['request']
    try:
        return adjust_inventory(
            school=request.user.school,
            product=serializer.validated_data['product'],
            quantity_delta=serializer.validated_data['quantity_delta'],
            activity=serializer.validated_data.get('activity'),
            reference=serializer.validated_data.get('reference', ''),
            recorded_by=request.user,
            notes=serializer.validated_data.get('notes', ''),
        )
    except (InventoryError, DjangoValidationError, ValueError) as exc:
        if isinstance(exc, InventoryError):
            raise serializers.ValidationError({'quantity_delta': str(exc)}) from exc
        if isinstance(exc, ValueError):
            raise serializers.ValidationError({'quantity_delta': str(exc)}) from exc
        serializer._handle_service_validation_error(exc)


def execute_approval(*, expense, approver):
    try:
        return approve_expense(expense=expense, approver=approver)
    except ValueError as exc:
        raise serializers.ValidationError({'status': str(exc)}) from exc


def execute_rejection(*, expense, approver, reason=''):
    try:
        return reject_expense(expense=expense, approver=approver, reason=reason)
    except ValueError as exc:
        raise serializers.ValidationError({'status': str(exc)}) from exc

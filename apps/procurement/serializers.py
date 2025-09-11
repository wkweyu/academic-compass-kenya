from rest_framework import serializers
from .models import Supplier, ItemCategory, Item, LPO, StockTransaction,PaymentVoucher, PettyCashTransaction, FeesInKindTransaction


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class ItemCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCategory
        fields = '__all__'


class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    preferred_supplier_name = serializers.CharField(source='preferred_supplier.name', read_only=True)

    class Meta:
        model = Item
        fields = '__all__'


class LPOSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = LPO
        fields = '__all__'


class StockTransactionSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    related_lpo_number = serializers.CharField(source='related_lpo.lpo_number', read_only=True)

    class Meta:
        model = StockTransaction
        fields = '__all__'
        


class PaymentVoucherSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    vote_head_name = serializers.CharField(source='vote_head.name', read_only=True)

    class Meta:
        model = PaymentVoucher
        fields = '__all__'


class PettyCashTransactionSerializer(serializers.ModelSerializer):
    vote_head_name = serializers.CharField(source='vote_head.name', read_only=True)
    related_voucher_number = serializers.CharField(source='related_voucher.voucher_number', read_only=True)

    class Meta:
        model = PettyCashTransaction
        fields = '__all__'


class FeesInKindTransactionSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    vote_head_name = serializers.CharField(source='vote_head.name', read_only=True)

    class Meta:
        model = FeesInKindTransaction
        fields = '__all__'


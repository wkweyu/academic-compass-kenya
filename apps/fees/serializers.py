from rest_framework import serializers
from .models import VoteHead, FeeStructure,PaymentTransaction,FeeBalance,DebitTransaction
from core.middleware import get_current_school

class VoteHeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoteHead
        fields = '__all__'
        
    def create(self, validated_data):
        validated_data['school'] = get_current_school()
        return super().create(validated_data)

class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = '__all__'

class PaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = '__all__'
        
       

class FeeBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeBalance
        fields = '__all__'



class DebitTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DebitTransaction
        fields = '__all__'
    
    def create(self, validated_data):
        validated_data['school'] = get_current_school()
        return super().create(validated_data)

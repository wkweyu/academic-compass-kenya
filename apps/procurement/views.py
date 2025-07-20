from rest_framework import viewsets,status
from .models import Supplier, ItemCategory, Item, LPO, StockTransaction
from .serializers import (
    SupplierSerializer, ItemCategorySerializer, ItemSerializer, 
    LPOSerializer, StockTransactionSerializer,PaymentVoucherSerializer, PettyCashTransactionSerializer, 
    FeesInKindTransactionSerializer
)
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsSchoolUser
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from .models import Supplier, LPO, PaymentVoucher, FeesInKindTransaction,PaymentVoucher, PettyCashTransaction, FeesInKindTransaction
from core.permissions import IsSchoolUser
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import StockTransaction, Item
from .serializers import StockTransactionSerializer
from core.permissions import IsSchoolUser
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from rest_framework.generics import RetrieveAPIView
from django.db.models import Sum
from django.utils.dateparse import parse_date
from rest_framework import generics





class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]


class ItemCategoryViewSet(viewsets.ModelViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]


class LPOViewSet(viewsets.ModelViewSet):
    queryset = LPO.objects.all()
    serializer_class = LPOSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]


class StockTransactionViewSet(viewsets.ModelViewSet):
    queryset = StockTransaction.objects.all()
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]



class PaymentVoucherViewSet(viewsets.ModelViewSet):
    queryset = PaymentVoucher.objects.all()
    serializer_class = PaymentVoucherSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]


class PettyCashTransactionViewSet(viewsets.ModelViewSet):
    queryset = PettyCashTransaction.objects.all()
    serializer_class = PettyCashTransactionSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]


class FeesInKindTransactionViewSet(viewsets.ModelViewSet):
    queryset = FeesInKindTransaction.objects.all()
    serializer_class = FeesInKindTransactionSerializer
    permission_classes = [IsAuthenticated, IsSchoolUser]



class SupplierLedgerAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get(self, request, supplier_id):
        try:
            supplier = Supplier.objects.get(id=supplier_id)

            ledger_entries = []

            # Opening balance
            balance = supplier.opening_balance
            ledger_entries.append({
                'date': supplier.created_at.date(),
                'type': 'Opening Balance',
                'reference': 'OB',
                'debit': supplier.opening_balance,
                'credit': 0,
                'balance': balance
            })

            # Purchases via LPOs
            lpos = LPO.objects.filter(supplier=supplier)
            for lpo in lpos:
                balance += lpo.total_amount
                ledger_entries.append({
                    'date': lpo.date,
                    'type': 'LPO',
                    'reference': lpo.lpo_number,
                    'debit': lpo.total_amount,
                    'credit': 0,
                    'balance': balance
                })

            # Payments via Payment Vouchers
            vouchers = PaymentVoucher.objects.filter(supplier=supplier, status='Paid')
            for voucher in vouchers:
                balance -= voucher.amount
                ledger_entries.append({
                    'date': voucher.date,
                    'type': 'Payment Voucher',
                    'reference': voucher.voucher_number,
                    'debit': 0,
                    'credit': voucher.amount,
                    'balance': balance
                })

            # Fees In-Kind transactions
            fees_in_kind = FeesInKindTransaction.objects.filter(supplier=supplier)
            for tx in fees_in_kind:
                balance -= tx.amount
                ledger_entries.append({
                    'date': tx.date.date(),
                    'type': 'Fees In-Kind',
                    'reference': f"Student: {tx.student.full_name}",
                    'debit': 0,
                    'credit': tx.amount,
                    'balance': balance
                })

            # Sort by date
            ledger_entries.sort(key=lambda x: x['date'])

            return Response({
                'supplier': supplier.name,
                'kra_pin': supplier.kra_pin,
                'ledger': ledger_entries
            }, status=status.HTTP_200_OK)

        except Supplier.DoesNotExist:
            return Response({'detail': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)


# Stock Issuance API
class StockIssuanceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def post(self, request):
        item_id = request.data.get('item')
        quantity = int(request.data.get('quantity'))
        issued_to = request.data.get('issued_to')
        description = request.data.get('description', '')

        if not item_id or not quantity or not issued_to:
            return Response({'detail': 'item, quantity, and issued_to are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({'detail': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check available stock
        purchases = StockTransaction.objects.filter(item=item, transaction_type='Purchase').aggregate(total=Sum('quantity'))['total'] or 0
        issues = StockTransaction.objects.filter(item=item, transaction_type='Issue').aggregate(total=Sum('quantity'))['total'] or 0
        balance = purchases - issues

        if quantity > balance:
            return Response({'detail': f'Not enough stock available. Current balance: {balance}'}, status=status.HTTP_400_BAD_REQUEST)

        # Record issuance transaction
        stock_tx = StockTransaction.objects.create(
            item=item,
            transaction_type='Issue',
            quantity=quantity,
            issued_to=issued_to,
            description=description
        )

        serializer = StockTransactionSerializer(stock_tx)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# Stock Balance API
class StockBalanceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get(self, request, item_id):
        try:
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({'detail': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

        purchases = StockTransaction.objects.filter(item=item, transaction_type='Purchase').aggregate(total=Sum('quantity'))['total'] or 0
        issues = StockTransaction.objects.filter(item=item, transaction_type='Issue').aggregate(total=Sum('quantity'))['total'] or 0
        adjustments = StockTransaction.objects.filter(item=item, transaction_type='Adjustment').aggregate(total=Sum('quantity'))['total'] or 0

        balance = purchases + adjustments - issues

        return Response({
            'item': item.name,
            'purchases': purchases,
            'issues': issues,
            'adjustments': adjustments,
            'balance': balance
        }, status=status.HTTP_200_OK)
        
        

class StoreMovementReportAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get(self, request):
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        item_id = request.GET.get('item')

        if not start_date or not end_date:
            return Response({'detail': 'start_date and end_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        transactions = StockTransaction.objects.filter(
            transaction_date__date__gte=parse_date(start_date),
            transaction_date__date__lte=parse_date(end_date)
        )

        if item_id:
            transactions = transactions.filter(item_id=item_id)

        serializer = StockTransactionSerializer(transactions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

# LPO Register
class LPORegisterAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get(self, request):
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        if not start_date or not end_date:
            return Response({'detail': 'start_date and end_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        lpos = LPO.objects.filter(
            date__gte=parse_date(start_date),
            date__lte=parse_date(end_date)
        )

        serializer = LPOSerializer(lpos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Payment Voucher Register
class PaymentVoucherRegisterAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get(self, request):
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        if not start_date or not end_date:
            return Response({'detail': 'start_date and end_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        vouchers = PaymentVoucher.objects.filter(
            date__gte=parse_date(start_date),
            date__lte=parse_date(end_date)
        )

        serializer = PaymentVoucherSerializer(vouchers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Petty Cash Register
class PettyCashRegisterAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get(self, request):
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        if not start_date or not end_date:
            return Response({'detail': 'start_date and end_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        petty_cash = PettyCashTransaction.objects.filter(
            date__gte=parse_date(start_date),
            date__lte=parse_date(end_date)
        )

        serializer = PettyCashTransactionSerializer(petty_cash, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

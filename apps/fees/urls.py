from django.urls import path
from .views import VoteHeadListCreateView, FeeStructureListCreateView,PaymentTransactionListCreateView,FeeBalanceListCreateView, DailyCollectionReportView, BulkDebitView, InvoicePrintView
urlpatterns = [
    path('vote-heads/', VoteHeadListCreateView.as_view()),
    path('fee-structures/', FeeStructureListCreateView.as_view()),
    path('payments/', PaymentTransactionListCreateView.as_view()),
    path('balances/', FeeBalanceListCreateView.as_view()),
    path('reports/daily-collections/', DailyCollectionReportView.as_view()),
    path('bulk-debits/', BulkDebitView.as_view()),
    path('invoices/<int:student_id>/<int:year>/<int:term>/', InvoicePrintView.as_view()),
    
]

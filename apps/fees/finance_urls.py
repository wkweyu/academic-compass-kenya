from django.urls import path

from apps.fees.finance_views import (
    CollectionEffectivenessReportAPIView,
    DebtAnalyticsReportAPIView,
    FinanceActivityLogAPIView,
    FinanceReportsExportCSVView,
    OutstandingBalancesReportAPIView,
    ScheduledExportJobCancelAPIView,
    ScheduledExportJobDownloadAPIView,
    ScheduledExportJobsAPIView,
    StudentAgingReportAPIView,
    TermCloseConversionReportAPIView,
    TermClosePreviewAPIView,
    TermCloseRolloverAPIView,
)

urlpatterns = [
    path('term-close/preview/', TermClosePreviewAPIView.as_view(), name='finance-term-close-preview'),
    path('term-close/rollover/', TermCloseRolloverAPIView.as_view(), name='finance-term-close-rollover'),
    path('term-close/conversion-report/', TermCloseConversionReportAPIView.as_view(), name='finance-term-close-conversion-report'),
    path('reports/outstanding/', OutstandingBalancesReportAPIView.as_view(), name='finance-reports-outstanding'),
    path('reports/student-aging/', StudentAgingReportAPIView.as_view(), name='finance-reports-student-aging'),
    path('reports/collection-effectiveness/', CollectionEffectivenessReportAPIView.as_view(), name='finance-reports-collection-effectiveness'),
    path('reports/debt-analytics/', DebtAnalyticsReportAPIView.as_view(), name='finance-reports-debt-analytics'),
    path('reports/export/', FinanceReportsExportCSVView.as_view(), name='finance-reports-export-csv'),
    path('reports/export-jobs/', ScheduledExportJobsAPIView.as_view(), name='finance-scheduled-export-jobs'),
    path('reports/export-jobs/<int:job_id>/download/', ScheduledExportJobDownloadAPIView.as_view(), name='finance-scheduled-export-download'),
    path('reports/export-jobs/<int:job_id>/cancel/', ScheduledExportJobCancelAPIView.as_view(), name='finance-scheduled-export-cancel'),
    path('activity-log/', FinanceActivityLogAPIView.as_view(), name='finance-activity-log'),
]

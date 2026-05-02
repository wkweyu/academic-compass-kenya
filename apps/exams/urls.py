
from django.urls import path
from . import views
from .views import ExamListView, MarksEntryView, ResultSlipView, ExamResultSlipView, ReportCardConfigViewSet
from .views import ExamResultSlipView, ReportCardConfigViewSet
from rest_framework.routers import DefaultRouter
from apps.grading.views import GradeScaleListView, GradeScaleCreateView, GradeScaleViewSet


app_name = 'exams'



router = DefaultRouter()
router.register(r'grading', GradeScaleViewSet, basename='grading')
router.register(r'report-configs', ReportCardConfigViewSet, basename='reportcardconfig')


urlpatterns = [
    path('', ExamListView.as_view(), name='exam_list'),
    path('add/', views.exam_add, name='exam_add'),
    #path('<int:pk>/', views.exam_detail, name='exam_detail'),
    #path('<int:pk>/edit/', views.exam_edit, name='exam_edit'),
    #path('<int:pk>/delete/', views.exam_delete, name='exam_delete'),
    path('exams/<int:exam_id>/enter-marks/', MarksEntryView.as_view(), name='enter_marks'),
    path('exams/result-slip/<int:student_id>/<int:term>/<int:academic_year>/', ResultSlipView.as_view(), name='result_slip'),
    path('<int:pk>/result-slip/', ExamResultSlipView.as_view(), name='result_slip'),
    path('grading/', GradeScaleListView.as_view(), name='gradescale_list'),
    path('grading/add/', GradeScaleCreateView.as_view(), name='gradescale_add'),
]

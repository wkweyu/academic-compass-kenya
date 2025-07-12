
from django.urls import path
from . import views

app_name = 'grading'

urlpatterns = [
    path('', views.score_list, name='score_list'),
    path('add/', views.score_add, name='score_add'),
    path('exam/<int:exam_id>/scores/', views.exam_scores, name='exam_scores'),
    path('student/<int:student_id>/report/', views.student_report, name='student_report'),
    path('reports/', views.report_list, name='report_list'),
]

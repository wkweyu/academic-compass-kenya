
from django.urls import path
from . import views
from .views import marks_entry_step1, marks_entry_step2, manage_gradescale, upload_marks_csv, download_marks_template

app_name = 'grading'

urlpatterns = [
    path('', views.score_list, name='score_list'),
    #path('add/', views.score_add, name='score_add'),
    #path('exam/<int:exam_id>/scores/', views.exam_scores, name='exam_scores'),
    #path('student/<int:student_id>/report/', views.student_report, name='student_report'),
    #path('reports/', views.report_list, name='report_list'),
    path('marks-entry/', marks_entry_step1, name='marks_entry'),
    path('gradescale/manage/', manage_gradescale, name='manage_gradescale'),
    path('marks/upload/<int:exam_id>/', upload_marks_csv, name='upload_marks_csv'),
    path('marks-entry/step2/', marks_entry_step2, name='marks_entry_step2'),
    path('marks/template/<int:exam_id>/', download_marks_template, name='download_marks_template'),

]

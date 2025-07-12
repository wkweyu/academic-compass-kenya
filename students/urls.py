
from django.urls import path
from . import views

app_name = 'students'

urlpatterns = [
    path('', views.student_list, name='student_list'),
    path('add/', views.student_add, name='student_add'),
    path('<int:pk>/', views.student_detail, name='student_detail'),
    path('<int:pk>/edit/', views.student_edit, name='student_edit'),
    path('<int:pk>/delete/', views.student_delete, name='student_delete'),
    path('transfer/', views.student_transfer, name='student_transfer'),
    path('promote/', views.batch_promotion, name='batch_promotion'),
    path('api/streams/<int:class_id>/', views.get_streams, name='get_streams'),
]

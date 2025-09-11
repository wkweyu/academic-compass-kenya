from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import (
    class_subject_allocation_list,
    class_subject_allocation_create,
    StudentViewSet,
)

app_name = 'students'

# DRF Router for API endpoints
router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = [
    # HTML views
    path('', views.student_list, name='student_list'),
    path('add/', views.student_add, name='student_add'),
    path('<int:pk>/', views.student_detail, name='student_detail'),
    path('<int:pk>/edit/', views.student_edit, name='student_edit'),
    path('<int:pk>/delete/', views.student_delete, name='student_delete'),
    path('transfer/', views.student_transfer, name='student_transfer'),
    path('promote/', views.batch_promotion, name='batch_promotion'),
    path('api/streams/<int:class_id>/', views.get_streams, name='get_streams'),
    path('class-allocations/', class_subject_allocation_list, name='class_allocations'),
    path('class-allocations/create/', class_subject_allocation_create, name='create_class_allocation'),

    # API endpoints
    path('api/', include(router.urls)),
]

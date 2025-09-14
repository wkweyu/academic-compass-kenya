from django.urls import path
from . import views
from .views import (
    class_subject_allocation_list, 
    class_subject_allocation_create,
    get_streams,
    ClassListCreateAPIView,
    ClassRetrieveUpdateDestroyAPIView,
    StreamListCreateAPIView,
    StreamRetrieveUpdateDestroyAPIView
)

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
    path('class-allocations/', views.class_subject_allocation_list, name='class_allocations'),
    path('class-allocations/create/', views.class_subject_allocation_create, name='create_class_allocation'),

    # API endpoints
    path('api/classes/', ClassListCreateAPIView.as_view(), name='api-classes-list'),
    path('api/classes/<int:pk>/', ClassRetrieveUpdateDestroyAPIView.as_view(), name='api-classes-detail'),
    path('api/streams/', StreamListCreateAPIView.as_view(), name='api-streams-list'),
    path('api/streams/<int:pk>/', StreamRetrieveUpdateDestroyAPIView.as_view(), name='api-streams-detail'),
]
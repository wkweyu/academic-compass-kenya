from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet,
    ClassListCreateAPIView,
    ClassRetrieveUpdateDestroyAPIView,
    StreamListCreateAPIView,
    StreamRetrieveUpdateDestroyAPIView,
)

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = router.urls + [
    path('classes/', ClassListCreateAPIView.as_view(), name='class-list-create'),
    path('classes/<int:pk>/', ClassRetrieveUpdateDestroyAPIView.as_view(), name='class-detail'),
    path('streams/', StreamListCreateAPIView.as_view(), name='stream-list-create'),
    path('streams/<int:pk>/', StreamRetrieveUpdateDestroyAPIView.as_view(), name='stream-detail'),
]

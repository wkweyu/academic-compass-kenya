# teachers/api_urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter
from .api_views import TeacherViewSet

router = DefaultRouter()
router.register(r'', TeacherViewSet, basename='teacher')

urlpatterns = router.urls

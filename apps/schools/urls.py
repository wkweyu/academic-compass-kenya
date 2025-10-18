from django.urls import path
from .views import SchoolDetailView, SchoolCreateView

urlpatterns = [
    path('', SchoolDetailView.as_view(), name='school-detail'),
    path('create/', SchoolCreateView.as_view(), name='school-create'),
]
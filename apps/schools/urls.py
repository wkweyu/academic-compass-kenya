from django.urls import path
from .views import SchoolListCreateView

urlpatterns = [
    path('', SchoolListCreateView.as_view(),name='school-list'),
]

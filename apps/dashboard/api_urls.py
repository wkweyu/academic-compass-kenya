from django.urls import path
from . import api_views

urlpatterns = [
    path('', api_views.dashboard_data, name='dashboard_data'),
]

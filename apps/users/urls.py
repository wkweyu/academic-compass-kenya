from django.urls import path
from .views import UserListView
from .views import CurrentUserView

urlpatterns = [
    path('me/', CurrentUserView.as_view()),
    path('', UserListView.as_view()),
]

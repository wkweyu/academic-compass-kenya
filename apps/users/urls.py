from django.urls import path
from .views import CurrentUserView, UserListView, UserRoleChangePreviewView, UserRoleChangeView

urlpatterns = [
    path('me/', CurrentUserView.as_view()),
    path('', UserListView.as_view()),
    path('<int:user_id>/role-change/preview/', UserRoleChangePreviewView.as_view()),
    path('<int:user_id>/role-change/', UserRoleChangeView.as_view()),
]

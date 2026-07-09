from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.CurrentUserView.as_view()),
    path('me/complete-first-login/', views.CompleteFirstLoginView.as_view()),
    path('repair-platform-links/', views.PlatformUserRepairView.as_view()),
    path('enable-login/', views.EnableLoginView.as_view()),
    path('', views.UserListView.as_view()),
    path('<int:user_id>/reset-password/', views.UserResetPasswordView.as_view()),
    path('<int:user_id>/resend-login/', views.ResendLoginDetailsView.as_view()),
    path('<int:user_id>/login-history/', views.LoginHistoryListView.as_view()),
    path('<int:user_id>/', UserDeleteView.as_view()),
    path('<int:user_id>/role-change/preview/', UserRoleChangePreviewView.as_view()),
    path('<int:user_id>/role-change/', UserRoleChangeView.as_view()),
]

from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.CurrentUserView.as_view()),
    path('me/complete-first-login/', views.CompleteFirstLoginView.as_view()),
    path('repair-platform-links/', views.PlatformUserRepairView.as_view()),
    path('enable-login/', views.EnableLoginView.as_view()),
    path('teachers/<int:entity_id>/enable-login/', views.EntityEnableLoginView.as_view(), {'entity_type': 'teacher'}),
    path('staff/<int:entity_id>/enable-login/', views.EntityEnableLoginView.as_view(), {'entity_type': 'staff'}),
    path('external-contacts/<int:entity_id>/enable-login/', views.EntityEnableLoginView.as_view(), {'entity_type': 'external_contact'}),
    path('teachers/<int:entity_id>/disable-login/', views.EntityDisableLoginView.as_view(), {'entity_type': 'teacher'}),
    path('staff/<int:entity_id>/disable-login/', views.EntityDisableLoginView.as_view(), {'entity_type': 'staff'}),
    path('external-contacts/<int:entity_id>/disable-login/', views.EntityDisableLoginView.as_view(), {'entity_type': 'external_contact'}),
    path('', views.UserListView.as_view()),
    path('<int:user_id>/reset-password/', views.UserResetPasswordView.as_view()),
    path('<int:user_id>/resend-login/', views.ResendLoginDetailsView.as_view()),
    path('<int:user_id>/login-history/', views.LoginHistoryListView.as_view()),
    path('<int:user_id>/disable-login/', views.DisableLoginView.as_view()),
    path('<int:user_id>/assign-role/', views.UserAssignRoleView.as_view()),
    path('<int:user_id>/', views.UserDeleteView.as_view()),
    path('<int:user_id>/role-change/preview/', views.UserRoleChangePreviewView.as_view()),
    path('<int:user_id>/role-change/', views.UserRoleChangeView.as_view()),
]

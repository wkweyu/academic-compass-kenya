from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User
from .services import AccountService

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active', 'login_enabled', 'created_at')
    list_filter = ('is_active', 'is_staff', 'login_enabled', 'role', 'created_at')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('-created_at',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('CBC SaaS Info', {
            'fields': ('role', 'school', 'entity_type', 'entity_id', 'status', 'login_enabled', 'expires_at', 'auth_user_id')
        }),
        ('Additional Info', {
            'fields': ('phone', 'notification_preferences')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('email', 'phone', 'first_name', 'last_name', 'role', 'school')
        }),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Ensure Supabase is in sync when saved via Admin
        try:
            AccountService._sync_supabase_user(obj)
        except Exception:
            # We don't want to crash the admin save if Supabase is down,
            # but in a production app we might want to show a warning.
            pass

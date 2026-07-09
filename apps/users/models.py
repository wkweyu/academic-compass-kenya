
from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.schools.models import School

class User(AbstractUser):
    """
    Custom user model for CBC System
    Note: Roles are stored in Supabase user_roles table, not here
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, null=True, blank=True)
    auth_user_id = models.UUIDField(unique=True, null=True, blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    role = models.CharField(max_length=50, default='staff')
    entity_type = models.CharField(max_length=50, blank=True, db_index=True)
    entity_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    status = models.CharField(
        max_length=30,
        choices=[
            ('INVITED', 'Invited'),
            ('PENDING_EMAIL_VERIFICATION', 'Pending Email Verification'),
            ('ACTIVE', 'Active'),
            ('DISABLED', 'Disabled'),
            ('LOCKED', 'Locked'),
            ('EXPIRED', 'Expired'),
        ],
        default='ACTIVE',
        db_index=True,
    )
    login_enabled = models.BooleanField(default=False, db_index=True)
    force_password_change = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    notification_preferences = models.JSONField(default=dict, blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def check_password(self, raw_password):
        """Guard against NULL password field — return False instead of crashing."""
        if self.password is None:
            return False
        return super().check_password(raw_password)


class LoginHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    successful = models.BooleanField(default=True)
    failure_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'login_history'
        ordering = ['-login_time']
        verbose_name = 'Login History'
        verbose_name_plural = 'Login Histories'

    def __str__(self):
        return f"{self.user.email} at {self.login_time}"

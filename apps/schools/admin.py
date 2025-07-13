from django.contrib import admin
from .models import School

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'phone', 'email', 'active', 'created_at')
    search_fields = ('name', 'code')
    readonly_fields = ('code', 'created_at')
    ordering = ('code',)

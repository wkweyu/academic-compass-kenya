
from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from .models import Subject

class SubjectResource(resources.ModelResource):
    class Meta:
        model = Subject
        import_id_fields = ('code',)
        fields = ('name', 'code', 'description', 'is_core', 'grade_levels')

@admin.register(Subject)
class SubjectAdmin(ImportExportModelAdmin):
    resource_class = SubjectResource
    list_display = ('name', 'code', 'is_core', 'grade_levels', 'created_at')
    list_filter = ('is_core', 'created_at')
    search_fields = ('name', 'code', 'description')
    ordering = ('name',)
    
    fieldsets = (
        ('Subject Information', {
            'fields': ('name', 'code', 'description')
        }),
        ('Configuration', {
            'fields': ('is_core', 'grade_levels')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')

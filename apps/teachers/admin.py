
from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from .models import Teacher, TeacherSubjectAssignment

class TeacherResource(resources.ModelResource):
    class Meta:
        model = Teacher
        import_id_fields = ('tsc_number',)
        fields = ('full_name', 'tsc_number', 'gender', 'date_of_birth', 
                 'phone', 'email', 'date_joined')

@admin.register(Teacher)
class TeacherAdmin(ImportExportModelAdmin):
    resource_class = TeacherResource
    list_display = ('full_name', 'tsc_number', 'gender', 'phone', 'email', 
                   'years_of_service', 'is_active', 'created_at')
    list_filter = ('gender', 'is_active', 'date_joined', 'created_at')
    search_fields = ('full_name', 'tsc_number', 'email', 'phone')
    readonly_fields = ('age', 'years_of_service', 'created_at', 'updated_at')
    ordering = ('full_name',)
    
    fieldsets = (
        ('Personal Information', {
            'fields': ('full_name', 'tsc_number', 'gender', 'date_of_birth', 'age')
        }),
        ('Contact Information', {
            'fields': ('phone', 'email')
        }),
        ('Employment Information', {
            'fields': ('date_joined', 'years_of_service', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(TeacherSubjectAssignment)
class TeacherSubjectAssignmentAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'subject', 'class_assigned', 'stream', 'academic_year', 'is_active')
    list_filter = ('academic_year', 'is_active', 'subject', 'class_assigned')
    search_fields = ('teacher__full_name', 'subject__name', 'class_assigned__name')
    ordering = ('teacher', 'subject')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'teacher', 'subject', 'class_assigned', 'stream'
        )

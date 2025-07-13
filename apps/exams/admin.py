
from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from .models import Exam

class ExamResource(resources.ModelResource):
    class Meta:
        model = Exam
        fields = ('name', 'subject', 'class_assigned', 'stream', 'term', 
                 'academic_year', 'exam_type', 'exam_date', 'max_marks')

@admin.register(Exam)
class ExamAdmin(ImportExportModelAdmin):
    resource_class = ExamResource
    list_display = ('name', 'subject', 'class_stream', 'term', 'academic_year', 
                   'exam_type', 'exam_date', 'total_students', 'submitted_count', 'is_published')
    list_filter = ('term', 'academic_year', 'exam_type', 'subject', 'class_assigned', 'is_published')
    search_fields = ('name', 'subject__name', 'class_assigned__name')
    ordering = ('-exam_date', 'subject')
    date_hierarchy = 'exam_date'
    
    fieldsets = (
        ('Exam Information', {
            'fields': ('name', 'subject', 'class_assigned', 'stream')
        }),
        ('Academic Details', {
            'fields': ('term', 'academic_year', 'exam_type')
        }),
        ('Exam Settings', {
            'fields': ('exam_date', 'max_marks', 'duration_minutes', 'instructions')
        }),
        ('Status', {
            'fields': ('is_published', 'created_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('total_students', 'submitted_count', 'average_score', 'created_at', 'updated_at')
    
    def class_stream(self, obj):
        stream_info = f" {obj.stream.name}" if obj.stream else ""
        return f"{obj.class_assigned.name}{stream_info}"
    class_stream.short_description = 'Class/Stream'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'subject', 'class_assigned', 'stream', 'created_by'
        )

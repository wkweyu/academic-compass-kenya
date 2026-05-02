
from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from apps.exams.models import Exam 
from django.contrib import admin
#from apps.grading.models import GradeScale

class ExamResource(resources.ModelResource):
    class Meta:
        model = Exam
        fields = ('name', 'subject', 'class_assigned', 'stream', 'term', 
                 'academic_year', 'exam_type', 'exam_date', 'max_marks')

@admin.register(Exam)
class ExamAdmin(ImportExportModelAdmin):
    resource_class = ExamResource
    list_display = ('name', 'subject', 'stream', 'term', 'academic_year', 
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
    readonly_fields = ('created_at', 'updated_at', 'get_total_students', 'get_submitted_count', 'get_average_score')

    list_display = ('name', 'subject', 'stream', 'term', 'academic_year',
                    'exam_type', 'exam_date', 'get_total_students', 'get_submitted_count', 'is_published')

    def get_total_students(self, obj):
        return obj.total_students
    get_total_students.short_description = 'Total Students'

    def get_submitted_count(self, obj):
        return obj.submitted_count
    get_submitted_count.short_description = 'Submitted'

    def get_average_score(self, obj):
        return obj.average_score
    get_average_score.short_description = 'Average Score'
    

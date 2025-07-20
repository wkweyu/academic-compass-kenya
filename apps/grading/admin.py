
from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from .models import Score, StudentReport, GradeScale

class ScoreResource(resources.ModelResource):
    class Meta:
        model = Score
        fields = ('student__admission_number', 'exam__name', 'marks', 'grade', 'is_absent')

@admin.register(Score)
class ScoreAdmin(ImportExportModelAdmin):
    resource_class = ScoreResource
    list_display = ('student', 'exam', 'marks', 'grade', 'percentage', 'is_absent', 'entered_by', 'created_at')
    list_filter = ('exam__subject', 'exam__class_assigned', 'exam__term', 'exam__academic_year', 'grade', 'is_absent')
    search_fields = ('student__full_name', 'student__admission_number', 'exam__name')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Score Information', {
            'fields': ('student', 'exam', 'marks', 'grade', 'is_absent')
        }),
        ('Additional Information', {
            'fields': ('remarks', 'entered_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('grade', 'percentage', 'created_at', 'updated_at')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'student', 'exam', 'entered_by'
        )

@admin.register(StudentReport)
class StudentReportAdmin(admin.ModelAdmin):
    list_display = ('student', 'term', 'academic_year', 'average_marks', 'overall_grade', 
                   'class_position', 'is_published', 'generated_at')
    list_filter = ('term', 'academic_year', 'overall_grade', 'is_published')
    search_fields = ('student__full_name', 'student__admission_number')
    ordering = ('-academic_year', '-term', 'student')
    
    fieldsets = (
        ('Report Information', {
            'fields': ('student', 'term', 'academic_year')
        }),
        ('Performance', {
            'fields': ('total_marks', 'average_marks', 'overall_grade', 'class_position', 'stream_position')
        }),
        ('Comments', {
            'fields': ('teacher_comment', 'head_teacher_comment')
        }),
        ('Status', {
            'fields': ('is_published', 'generated_by')
        }),
        ('Timestamps', {
            'fields': ('generated_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('generated_at', 'updated_at')
    
    actions = ['calculate_totals_action', 'publish_reports', 'unpublish_reports']
    
    def calculate_totals_action(self, request, queryset):
        for report in queryset:
            report.calculate_totals()
        self.message_user(request, f"Calculated totals for {queryset.count()} reports.")
    calculate_totals_action.short_description = "Calculate totals for selected reports"
    
    def publish_reports(self, request, queryset):
        queryset.update(is_published=True)
        self.message_user(request, f"Published {queryset.count()} reports.")
    publish_reports.short_description = "Publish selected reports"
    
    def unpublish_reports(self, request, queryset):
        queryset.update(is_published=False)
        self.message_user(request, f"Unpublished {queryset.count()} reports.")
    unpublish_reports.short_description = "Unpublish selected reports"

@admin.register(GradeScale)
class GradeScaleAdmin(admin.ModelAdmin):
    list_display = ('school', 'academic_year', 'grade', 'min_score', 'max_score', 'points', 'remarks')
    list_filter = ('school', 'academic_year')
    search_fields = ('grade', 'remarks')
    ordering = ('-academic_year', '-min_score')

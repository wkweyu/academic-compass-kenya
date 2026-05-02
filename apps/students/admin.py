
from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from .models import Class, Stream, Student, StudentTransfer, StudentPromotion

class StudentResource(resources.ModelResource):
    class Meta:
        model = Student
        import_id_fields = ('admission_number',)
        fields = ('admission_number', 'full_name', 'gender', 'date_of_birth', 
                 'kcpe_index', 'current_class', 'current_stream', 'guardian_name', 
                 'guardian_phone', 'guardian_email')

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'grade_level', 'stream_count', 'created_at')
    list_filter = ('grade_level', 'created_at')
    search_fields = ('name', 'description')
    ordering = ('grade_level', 'name')
    
    def stream_count(self, obj):
        return obj.streams.count()
    stream_count.short_description = 'Streams'

@admin.register(Stream)
class StreamAdmin(admin.ModelAdmin):
    list_display = ('name', 'class_assigned', 'year', 'current_enrollment', 'capacity')
    list_filter = ('class_assigned', 'year')
    search_fields = ('name', 'class_assigned__name')
    ordering = ('class_assigned', 'name')
    
    def get_queryset(self, request):
        # Use base manager instead of school-scoped manager
        return Stream._base_manager.all()

@admin.register(Student)
class StudentAdmin(ImportExportModelAdmin):
    resource_class = StudentResource
    list_display = ('admission_number', 'full_name', 'gender', 'current_class_stream', 
                   'guardian_name', 'is_active', 'created_at')
    list_filter = ('gender', 'current_class', 'current_stream', 'admission_year', 
                  'is_active', 'created_at')
    search_fields = ('admission_number', 'full_name', 'guardian_name', 'kcpe_index')
    readonly_fields = ('admission_number', 'age', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Personal Information', {
            'fields': ('admission_number', 'full_name', 'gender', 'date_of_birth', 'photo', 'age')
        }),
        ('Academic Information', {
            'fields': ('kcpe_index', 'current_class', 'current_stream', 'admission_year')
        }),
        ('Guardian Information', {
            'fields': ('guardian_name', 'guardian_phone', 'guardian_email', 'guardian_relationship')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Filter stream dropdown to only current year + user’s school
        if db_field.name == "current_stream":
            try:
                user_school = request.user.school
                kwargs["queryset"] = Stream.objects.filter(
                    school=user_school,
                    year=now().year
                )
            except Exception:
                kwargs["queryset"] = Stream.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(StudentTransfer)
class StudentTransferAdmin(admin.ModelAdmin):
    list_display = ('student', 'from_class_stream', 'to_class_stream', 'transfer_date', 'created_by')
    list_filter = ('transfer_date', 'from_class', 'to_class')
    search_fields = ('student__full_name', 'student__admission_number', 'reason')
    ordering = ('-transfer_date',)
    
    def from_class_stream(self, obj):
        return f"{obj.from_class} {obj.from_stream}" if obj.from_class and obj.from_stream else "N/A"
    from_class_stream.short_description = 'From'
    
    def to_class_stream(self, obj):
        return f"{obj.to_class} {obj.to_stream}" if obj.to_class and obj.to_stream else "N/A"
    to_class_stream.short_description = 'To'

@admin.register(StudentPromotion)
class StudentPromotionAdmin(admin.ModelAdmin):
    list_display = ('student', 'from_class', 'to_class', 'academic_year', 'promotion_date', 'created_by')
    list_filter = ('academic_year', 'promotion_date', 'from_class', 'to_class')
    search_fields = ('student__full_name', 'student__admission_number')
    ordering = ('-promotion_date',)


from django.contrib import admin
from .models import ClassSubjectAllocation

@admin.register(ClassSubjectAllocation)
class ClassSubjectAllocationAdmin(admin.ModelAdmin):
    list_display = ('academic_year', 'term', 'school_class', 'stream', 'subject', 'subject_teacher', 'class_teacher')
    list_filter = ('academic_year', 'term', 'school_class')
    search_fields = ('subject__name', 'school_class__name', 'stream__name')
    ordering = ('-academic_year', 'term', 'school_class', 'stream')
    

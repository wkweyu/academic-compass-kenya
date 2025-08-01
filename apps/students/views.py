
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.db.models import Q
from django.core.paginator import Paginator
from .models import Student, Class, Stream, StudentTransfer, StudentPromotion
from .forms import StudentForm, StudentTransferForm

@login_required
def student_list(request):
    """List all students with search and filtering"""
    students = Student.objects.select_related('current_class', 'current_stream').filter(is_active=True)
    
    # Search functionality
    search_query = request.GET.get('search', '')
    if search_query:
        students = students.filter(
            Q(full_name__icontains=search_query) |
            Q(admission_number__icontains=search_query) |
            Q(guardian_name__icontains=search_query)
        )
    
    # Class filter
    class_filter = request.GET.get('class', '')
    if class_filter:
        students = students.filter(current_class_id=class_filter)
    
    # Stream filter
    stream_filter = request.GET.get('stream', '')
    if stream_filter:
        students = students.filter(current_stream_id=stream_filter)
    
    # Pagination
    paginator = Paginator(students, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Get filter options
    classes = Class.objects.all().order_by('grade_level', 'name')
    streams = Stream.objects.all().order_by('class_assigned', 'name')
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'class_filter': class_filter,
        'stream_filter': stream_filter,
        'classes': classes,
        'streams': streams,
        'total_students': students.count(),
    }
    
    return render(request, 'students/student_list.html', context)

@login_required
def student_detail(request, pk):
    """View student details"""
    student = get_object_or_404(Student, pk=pk)
    transfers = student.transfers.all()[:5]  # Last 5 transfers
    promotions = student.promotions.all()[:5]  # Last 5 promotions
    recent_scores = student.scores.select_related('exam').all()[:10]  # Last 10 scores
    
    context = {
        'student': student,
        'transfers': transfers,
        'promotions': promotions,
        'recent_scores': recent_scores,
    }
    
    return render(request, 'students/student_detail.html', context)

@login_required
def student_add(request):
    if request.method == 'POST':
        form = StudentForm(request.POST or None, request.FILES or None, user=request.user)
        if form.is_valid():
            student = form.save(commit=False)
            student.school = request.user.school  # ✅ Assign school here
            student.save()
            messages.success(request, f'Student {student.full_name} has been added successfully.')
            return redirect('students:student_detail', pk=student.pk)
    else:
        form = StudentForm(user=request.user)

    return render(request, 'students/student_form.html', {
        'form': form,
        'title': 'Add New Student'
    })


@login_required
def student_edit(request, pk):
    """Edit student information"""
    student = get_object_or_404(Student, pk=pk)
    
    if request.method == 'POST':
        form = StudentForm(request.POST, request.FILES, instance=student,user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, f'Student {student.full_name} has been updated successfully.')
            return redirect('students:student_detail', pk=student.pk)
    else:
        form = StudentForm(instance=student, user=request.user)
    
    return render(request, 'students/student_form.html', {
        'form': form,
        'student': student,
        'title': f'Edit {student.full_name}'
    })

@login_required
def student_delete(request, pk):
    """Delete student (soft delete)"""
    student = get_object_or_404(Student, pk=pk)
    
    if request.method == 'POST':
        student.is_active = False
        student.save()
        messages.success(request, f'Student {student.full_name} has been deactivated.')
        return redirect('students:student_list')
    
    return render(request, 'students/student_confirm_delete.html', {
        'student': student
    })

@login_required
def student_transfer(request):
    """Transfer student between classes/streams"""
    if request.method == 'POST':
        form = StudentTransferForm(request.POST)
        if form.is_valid():
            transfer = form.save(commit=False)
            transfer.created_by = request.user
            
            # Update student's current class and stream
            student = transfer.student
            transfer.from_class = student.current_class
            transfer.from_stream = student.current_stream
            
            student.current_class = transfer.to_class
            student.current_stream = transfer.to_stream
            student.save()
            
            transfer.save()
            
            messages.success(request, f'Student {student.full_name} has been transferred successfully.')
            return redirect('students:student_detail', pk=student.pk)
    else:
        form = StudentTransferForm()
    
    return render(request, 'students/student_transfer.html', {
        'form': form,
        'title': 'Transfer Student'
    })

@login_required
def batch_promotion(request):
    """Batch promote students"""
    if request.method == 'POST':
        source_class_id = request.POST.get('source_class')
        source_stream_id = request.POST.get('source_stream')
        target_class_id = request.POST.get('target_class')
        target_stream_id = request.POST.get('target_stream')
        academic_year = request.POST.get('academic_year')
        
        source_class = get_object_or_404(Class, pk=source_class_id)
        target_class = get_object_or_404(Class, pk=target_class_id)
        
        source_stream = None
        target_stream = None
        
        if source_stream_id:
            source_stream = get_object_or_404(Stream, pk=source_stream_id)
        if target_stream_id:
            target_stream = get_object_or_404(Stream, pk=target_stream_id)
        
        # Get students to promote
        students_query = Student.objects.filter(current_class=source_class, is_active=True)
        if source_stream:
            students_query = students_query.filter(current_stream=source_stream)
        
        students = list(students_query)
        promoted_count = 0
        
        for student in students:
            # Create promotion record
            StudentPromotion.objects.create(
                student=student,
                from_class=student.current_class,
                to_class=target_class,
                academic_year=academic_year,
                created_by=request.user
            )
            
            # Update student
            student.current_class = target_class
            if target_stream:
                student.current_stream = target_stream
            student.save()
            
            promoted_count += 1
        
        messages.success(request, f'Successfully promoted {promoted_count} students from {source_class.name} to {target_class.name}.')
        return redirect('students:student_list')
    
    classes = Class.objects.all().order_by('grade_level', 'name')
    
    return render(request, 'students/batch_promotion.html', {
        'classes': classes,
        'title': 'Batch Promotion'
    })

def get_streams(request, class_id):
    """AJAX endpoint to get streams for a class"""
    streams = Stream.objects.filter(class_assigned_id=class_id).values('id', 'name')
    return JsonResponse(list(streams), safe=False)

from django.shortcuts import render, redirect
from django.contrib import messages
from .forms import ClassSubjectAllocationForm
from .models import ClassSubjectAllocation


def class_subject_allocation_create(request):
    if request.method == 'POST':
        form = ClassSubjectAllocationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Subject allocation saved successfully.")
            return redirect('class_allocations')
    else:
        form = ClassSubjectAllocationForm()

    return render(request, 'students/class_subject_allocation_form.html', {
        'form': form,
        'title': 'Allocate Subject to Class'
    })


def class_subject_allocation_list(request):
    allocations = ClassSubjectAllocation.objects.all().order_by('-academic_year', 'term', 'school_class')
    return render(request, 'classes/class_subject_allocation_list.html', {
        'allocations': allocations,
        'title': 'Class Subject Allocations'
    })

# --- API Views ---
from rest_framework import viewsets, permissions
from .serializers import StudentSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

class StudentViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows students to be viewed or edited.
    """
    queryset = Student.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['current_class', 'current_stream', 'status', 'gender']
    search_fields = ['full_name', 'admission_number', 'guardian_name']

    def get_queryset(self):
        """
        This view should return a list of all the students
        for the currently authenticated user's school.
        """
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'school'):
            return Student.objects.filter(school=user.school, is_active=True).order_by('-created_at')
        return Student.objects.none() # Return empty queryset if no school

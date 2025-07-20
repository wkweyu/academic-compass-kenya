
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.core.paginator import Paginator
from .models import Teacher
from .forms import TeacherForm 

@login_required
def teacher_list(request):
    """List all teachers with search and filtering"""
    teachers = Teacher.objects.filter(is_active=True)
    
    # Search functionality
    search_query = request.GET.get('search', '')
    if search_query:
        teachers = teachers.filter(
            Q(full_name__icontains=search_query) |
            Q(tsc_number__icontains=search_query) |
            Q(email__icontains=search_query)
        )
    
    # Pagination
    paginator = Paginator(teachers, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'total_teachers': teachers.count(),
    }
    
    return render(request, 'teachers/teacher_list.html', context)

@login_required
def teacher_detail(request, pk):
    """View teacher details"""
    teacher = get_object_or_404(Teacher, pk=pk)
    subject_assignments = teacher.subject_assignments.select_related('subject', 'class_assigned', 'stream').filter(is_active=True)
    
    context = {
        'teacher': teacher,
        'subject_assignments': subject_assignments,
    }
    
    return render(request, 'teachers/teacher_detail.html', context)

@login_required
def teacher_add(request):
    """Add new teacher"""
    if request.method == 'POST':
        form = TeacherForm(request.POST)
        if form.is_valid():
            teacher = form.save()
            messages.success(request, f'Teacher {teacher.full_name} added successfully!')
            return redirect('teachers:teacher_detail', pk=teacher.pk)
    else:
        form = TeacherForm()
    
    return render(request, 'teachers/teacher_form.html', {
        'title': 'Add New Teacher',
        'form': form  # Make sure to pass the form to the template
    })

@login_required
def teacher_edit(request, pk):
    """Edit teacher"""
    teacher = get_object_or_404(Teacher, pk=pk)
    
    if request.method == 'POST':
        form = TeacherForm(request.POST, instance=teacher)
        if form.is_valid():
            teacher = form.save()
            messages.success(request, f'Teacher {teacher.full_name} updated successfully!')
            return redirect('teachers:teacher_detail', pk=teacher.pk)
    else:
        form = TeacherForm(instance=teacher)
    
    return render(request, 'teachers/teacher_form.html', {
        'teacher': teacher,
        'title': f'Edit {teacher.full_name}',
        'form': form  # Make sure to pass the form to the template
    })

@login_required
def teacher_delete(request, pk):
    """Delete teacher - placeholder view"""
    teacher = get_object_or_404(Teacher, pk=pk)
    
    if request.method == 'POST':
        teacher.is_active = False
        teacher.save()
        messages.success(request, f'Teacher {teacher.full_name} has been deactivated.')
        return redirect('teachers:teacher_list')
    
    return render(request, 'teachers/teacher_confirm_delete.html', {
        'teacher': teacher
    })


from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.core.paginator import Paginator
from .models import Exam

@login_required
def exam_list(request):
    """List all exams"""
    exams = Exam.objects.select_related('subject', 'class_assigned', 'stream').all()
    
    # Search functionality
    search_query = request.GET.get('search', '')
    if search_query:
        exams = exams.filter(
            Q(name__icontains=search_query) |
            Q(subject__name__icontains=search_query)
        )
    
    # Pagination
    paginator = Paginator(exams, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'total_exams': exams.count(),
    }
    
    return render(request, 'exams/exam_list.html', context)

@login_required
def exam_detail(request, pk):
    """View exam details"""
    exam = get_object_or_404(Exam, pk=pk)
    
    context = {
        'exam': exam,
    }
    
    return render(request, 'exams/exam_detail.html', context)

@login_required
def exam_add(request):
    """Add new exam - placeholder"""
    return render(request, 'exams/exam_form.html', {
        'title': 'Add New Exam'
    })

@login_required
def exam_edit(request, pk):
    """Edit exam - placeholder"""
    exam = get_object_or_404(Exam, pk=pk)
    return render(request, 'exams/exam_form.html', {
        'exam': exam,
        'title': f'Edit {exam.name}'
    })

@login_required
def exam_delete(request, pk):
    """Delete exam - placeholder"""
    exam = get_object_or_404(Exam, pk=pk)
    
    if request.method == 'POST':
        exam.delete()
        messages.success(request, f'Exam {exam.name} has been deleted.')
        return redirect('exams:exam_list')
    
    return render(request, 'exams/exam_confirm_delete.html', {
        'exam': exam
    })


from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.core.paginator import Paginator
from .models import Subject

@login_required
def subject_list(request):
    """List all subjects"""
    subjects = Subject.objects.all()
    
    # Search functionality
    search_query = request.GET.get('search', '')
    if search_query:
        subjects = subjects.filter(
            Q(name__icontains=search_query) |
            Q(code__icontains=search_query)
        )
    
    # Pagination
    paginator = Paginator(subjects, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'total_subjects': subjects.count(),
    }
    
    return render(request, 'subjects/subject_list.html', context)

@login_required
def subject_detail(request, pk):
    """View subject details"""
    subject = get_object_or_404(Subject, pk=pk)
    
    context = {
        'subject': subject,
    }
    
    return render(request, 'subjects/subject_detail.html', context)

@login_required
def subject_add(request):
    """Add new subject - placeholder"""
    return render(request, 'subjects/subject_form.html', {
        'title': 'Add New Subject'
    })

@login_required
def subject_edit(request, pk):
    """Edit subject - placeholder"""
    subject = get_object_or_404(Subject, pk=pk)
    return render(request, 'subjects/subject_form.html', {
        'subject': subject,
        'title': f'Edit {subject.name}'
    })

@login_required
def subject_delete(request, pk):
    """Delete subject - placeholder"""
    subject = get_object_or_404(Subject, pk=pk)
    
    if request.method == 'POST':
        subject.delete()
        messages.success(request, f'Subject {subject.name} has been deleted.')
        return redirect('subjects:subject_list')
    
    return render(request, 'subjects/subject_confirm_delete.html', {
        'subject': subject
    })

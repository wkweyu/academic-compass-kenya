
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.core.paginator import Paginator
from .models import Score, StudentReport

@login_required
def score_list(request):
    """List all scores"""
    scores = Score.objects.select_related('student', 'exam', 'exam__subject').all()
    
    # Search functionality
    search_query = request.GET.get('search', '')
    if search_query:
        scores = scores.filter(
            Q(student__full_name__icontains=search_query) |
            Q(student__admission_number__icontains=search_query) |
            Q(exam__name__icontains=search_query)
        )
    
    # Pagination
    paginator = Paginator(scores, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'total_scores': scores.count(),
    }
    
    return render(request, 'grading/score_list.html', context)

@login_required
def score_add(request):
    """Add new score - placeholder"""
    return render(request, 'grading/score_form.html', {
        'title': 'Add New Score'
    })

@login_required
def exam_scores(request, exam_id):
    """View scores for a specific exam"""
    exam = get_object_or_404(Exam, pk=exam_id)
    scores = exam.scores.select_related('student').all()
    
    context = {
        'exam': exam,
        'scores': scores,
    }
    
    return render(request, 'grading/exam_scores.html', context)

@login_required
def student_report(request, student_id):
    """View student report"""
    student = get_object_or_404(Student, pk=student_id)
    reports = student.reports.all().order_by('-academic_year', '-term')
    
    context = {
        'student': student,
        'reports': reports,
    }
    
    return render(request, 'grading/student_report.html', context)

@login_required
def report_list(request):
    """List all reports"""
    reports = StudentReport.objects.select_related('student').all()
    
    # Pagination
    paginator = Paginator(reports, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'total_reports': reports.count(),
    }
    
    return render(request, 'grading/report_list.html', context)

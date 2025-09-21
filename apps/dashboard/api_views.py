# apps/dashboard/api_views.py
from django.db.models import Count, Avg, F
from rest_framework.decorators import api_view
from rest_framework.response import Response
from apps.exams.models import Exam
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.grading.models import Score, GradeScale

@api_view(['GET'])
def dashboard_data(request):
    """
    Returns aggregated data for the dashboard.
    """
    # Stats
    total_exams = Exam.objects.count()
    active_exams = Exam.objects.filter(is_published=True).count()
    total_students = Student.objects.filter(is_active=True).count()
    total_subjects = Subject.objects.count()
    
    # Score completion
    completed_scores = Score.objects.exclude(marks__isnull=True).count()
    pending_scores = Score.objects.filter(marks__isnull=True).count()
    total_scores = completed_scores + pending_scores
    completed_percentage = round((completed_scores / total_scores) * 100, 2) if total_scores > 0 else 0

    stats = {
        "totalExams": total_exams,
        "activeExams": active_exams,
        "totalStudents": total_students,
        "totalSubjects": total_subjects,
        "completedScores": completed_percentage,
        "pendingResults": pending_scores,
    }

    # Recent exams (latest 5)
    recent_exams_qs = Exam.objects.select_related('class_assigned', 'stream').order_by('-exam_date')[:5]
    recent_exams = [
        {
            "name": e.name,
            "class": e.class_assigned.name if e.class_assigned else "",
            "stream": e.stream.name if e.stream else "",
            "date": e.exam_date.strftime("%Y-%m-%d"),
            "status": "Active" if e.is_published else "Completed"
        }
        for e in recent_exams_qs
    ]

    # Performance overview (average scores by subject)
    performance_data_qs = Score.objects.select_related('exam__subject').values('exam__subject__name').annotate(
        average=Avg('marks')
    )
    performance_data = []
    for p in performance_data_qs:
        subject_name = p['exam__subject__name']
        avg_score = round(p['average'] or 0, 2)
        
        # Determine grade
        grade_scale = GradeScale.objects.filter(min_score__lte=avg_score, max_score__gte=avg_score).first()
        grade = grade_scale.grade if grade_scale else "N/A"

        performance_data.append({
            "subject": subject_name,
            "average": avg_score,
            "grade": grade,
        })

    return Response({
        "stats": stats,
        "recentExams": recent_exams,
        "performanceData": performance_data,
    })

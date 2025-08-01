
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Avg
from django.core.paginator import Paginator
from django.db import transaction
from .models import Exam, ReportCardConfig
from apps.grading.models import Score, GradeScale
from apps.grading import forms
from django.views import View
from apps.students.models import Student
from .forms import ExamScoreFormSet, ExamForm
from django.views.generic import ListView, DetailView

from apps.students.models import Student


class MarksEntryView(View):
    template_name = 'exams/marks_entry.html'

    def get(self, request, exam_id):
        exam = get_object_or_404(Exam, pk=exam_id)
        students = Student.objects.filter(
            current_class=exam.class_assigned,
            is_active=True
        )

        if exam.stream:
            students = students.filter(current_stream=exam.stream)

        ScoreFormSet = ExamScoreFormSet(queryset=Score.objects.filter(exam=exam))
        formset = ScoreFormSet(queryset=Score.objects.none(), initial=[
            {'student': student, 'exam': exam} for student in students
        ])

        return render(request, self.template_name, {
            'exam': exam,
            'formset': formset,
        })

    @transaction.atomic
    def post(self, request, exam_id):
        exam = get_object_or_404(Exam, pk=exam_id, school=request.user.school)
        formset = ExamScoreFormSet(request.POST)

        if formset.is_valid():
            # Fetch grading rules once to avoid N+1 queries
            grade_rules = GradeScale.objects.filter(
                school=request.user.school,
                academic_year=exam.academic_year
            ).order_by('-min_score')

            scores = formset.save(commit=False)
            for score in scores:
                score.exam = exam
                score.entered_by = request.user
                # Pass the prefetched rules to the save method
                score.save(grade_scale_rules=grade_rules)

            messages.success(request, "Marks successfully saved.")
            return redirect('exams:exam_list')
        else:
            messages.error(request, "Please correct the errors below.")

        return render(request, self.template_name, {
            'exam': exam,
            'formset': formset
        })



class ResultSlipView(View):
    template_name = 'exams/result_slip.html'

    def get(self, request, student_id, term, academic_year):
        student = get_object_or_404(Student, pk=student_id, school=request.user.school)

        # Correctly filter exams for the student's class, stream, term, and year
        exams = Exam.objects.filter(
            school=request.user.school,
            class_assigned=student.current_class,
            stream=student.current_stream,
            term__term=term,
            academic_year=academic_year
        ).select_related('subject')

        scores = Score.objects.filter(
            exam__in=exams,
            student=student
        ).select_related('exam', 'exam__subject')

        # Fetch grade scale for the specific school and year
        grade_scale = GradeScale.objects.filter(
            school=request.user.school,
            academic_year=academic_year
        ).order_by('-min_score')

        subject_results = []
        total_marks = 0
        total_points = 0
        subject_count = 0
        total_max_marks = 0

        for score in scores:
            grade, points = self.get_grade_and_points(grade_scale, score.percentage)
            subject_results.append({
                'subject': score.exam.subject.name,
                'marks': score.marks,
                'percentage': score.percentage,
                'grade': grade,
                'points': points
            })
            total_marks += score.marks
            total_max_marks += score.exam.max_marks
            if points:
                total_points += points
            subject_count += 1

        avg_percentage = (total_marks / total_max_marks) * 100 if total_max_marks else 0
        mean_grade, _ = self.get_grade_and_points(grade_scale, avg_percentage)

        context = {
            'student': student,
            'subject_results': subject_results,
            'total_marks': total_marks,
            'total_points': total_points,
            'mean_percentage': round(avg_percentage, 2),
            'mean_grade': mean_grade,
            'academic_year': academic_year,
            'term': term,
        }
        return render(request, self.template_name, context)

    def get_grade_and_points(self, grade_scale, percentage):
        if percentage is None:
            return 'N/A', 0
        for rule in grade_scale:
            if rule.min_score <= percentage <= rule.max_score:
                return rule.grade, rule.points
        return 'N/A', 0


class ExamResultSlipView(DetailView):
    model = Exam
    template_name = 'exams/result_slip.html'
    context_object_name = 'exam'

    def get_queryset(self):
        # Ensure users can only see exam results for their own school
        return Exam.objects.filter(school=self.request.user.school)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        exam = self.get_object()

        scores = Score.objects.filter(exam=exam)\
            .select_related('student')\
            .order_by('-marks')

        context['scores'] = scores
        context['average_score'] = scores.aggregate(avg=Avg('marks'))['avg'] or 0
        return context



from rest_framework import viewsets
from .serializers import  ReportCardConfigSerializer
from rest_framework.permissions import IsAuthenticated

class ReportCardConfigViewSet(viewsets.ModelViewSet):
    queryset = ReportCardConfig.objects.all()
    serializer_class = ReportCardConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        school = self.request.user.school
        return ReportCardConfig.objects.filter(school=school).order_by('-academic_year')

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, configured_by=self.request.user)

class ExamListView(ListView):
    model = Exam
    template_name = 'exams/exam_list.html'
    context_object_name = 'exams'
    
@login_required
def exam_add(request):
    if request.method == 'POST':
        form = ExamForm(request.POST)
        if form.is_valid():
            exam = form.save(commit=False)
            exam.school = request.user.school
            exam.save()
            return redirect('exams:exam_list')  # or wherever you want
    else:
        form = ExamForm()
    return render(request, 'exams/exam_form.html', {'form': form})

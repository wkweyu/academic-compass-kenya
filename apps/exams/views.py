
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.core.paginator import Paginator
from apps.exams.models import Exam, ReportCardConfig 
from apps.grading import forms
from apps.grading.models import Score
from django.views import View
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from apps.students.models import Student
from .forms import ExamScoreFormSet
from django.views.generic import ListView
from django.views import View
from django.shortcuts import render, get_object_or_404

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

    def post(self, request, exam_id):
        exam = get_object_or_404(Exam, pk=exam_id)
        ScoreFormSet = ExamScoreFormSet(request.POST)

        if ScoreFormSet.is_valid():
            instances = ScoreFormSet.save(commit=False)
            for instance in instances:
                instance.exam = exam
                instance.save()
            messages.success(request, "Marks successfully saved.")
            return redirect('exams:exam_list')
        else:
            messages.error(request, "Please correct errors below.")

        return render(request, self.template_name, {
            'exam': exam,
            'formset': ScoreFormSet
        })



class ResultSlipView(View):
    template_name = 'exams/result_slip.html'

    def get(self, request, student_id, term, academic_year):
        student = get_object_or_404(Student, pk=student_id)
        exams = Exam.objects.filter(
            class_assigned=student.current_class,
            term=term,
            academic_year=academic_year
        ).select_related('subject')

        scores = Score.objects.filter(
            exam__in=exams,
            student=student
        ).select_related('exam', 'exam__subject')

        grading_system = GradingSystem.objects.all()

        subject_results = []
        total_marks = 0
        total_points = 0
        subject_count = 0

        for score in scores:
            grade, points = self.get_grade_and_points(grading_system, score.marks)
            subject_results.append({
                'subject': score.exam.subject.name,
                'marks': score.marks,
                'grade': grade,
                'points': points
            })
            total_marks += score.marks
            total_points += points
            subject_count += 1

        mean_score = total_marks / subject_count if subject_count else 0
        mean_grade, mean_points = self.get_grade_and_points(grading_system, mean_score)

        context = {
            'student': student,
            'subject_results': subject_results,
            'total_marks': total_marks,
            'total_points': total_points,
            'mean_score': round(mean_score, 2),
            'mean_grade': mean_grade,
            'academic_year': academic_year,
            'term': term,
        }
        return render(request, self.template_name, context)

    def get_grade_and_points(self, grading_system, marks):
        for grade_row in grading_system:
            if grade_row.lower_limit <= marks <= grade_row.upper_limit:
                return grade_row.grade, grade_row.points
        return 'N/A', 0


from django.views.generic import DetailView
from apps.exams.models import Exam 

# exams/views.py or grading/views.py


class ExamResultSlipView(DetailView):
    model = Exam
    template_name = 'exams/result_slip.html'
    context_object_name = 'exam'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        exam = self.get_object()

        scores = Score.objects.filter(exam=exam)\
            .select_related('student')\
            .order_by('-marks')

        context['scores'] = scores
        context['average_score'] = scores.aggregate(avg=models.Avg('marks'))['avg'] or 0
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
class ExamForm(forms.ModelForm):
    class Meta:
        model = Exam
        fields = ['name', 'exam_type', 'term', 'academic_year', 'max_marks']

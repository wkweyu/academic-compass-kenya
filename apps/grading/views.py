# grading/views.py

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.forms import modelformset_factory
from django.contrib.auth.decorators import login_required

from apps.grading.models import Score
from apps.grading.forms import ExamSelectionForm
from students.models import Student
from apps.exams.models import Exam 


@login_required
def score_list(request):
    scores = Score.objects.select_related('student', 'exam').order_by('-created_at')[:50]
    return render(request, 'grading/score_list.html', {'scores': scores})


@login_required
def marks_entry_step1(request):
    form = ExamSelectionForm(request.POST or None, school=request.user.school)
    if request.method == 'POST' and form.is_valid():
        data = form.cleaned_data
        return redirect(
            'grading:marks_entry_step2',
            class_id=data['class_assigned'].id,
            stream_id=data['stream'].id if data['stream'] else 0,
            exam_id=data['exam'].id,
            subject_id=data['subject'].id
        )
    return render(request, 'grading/marks_step1_select_exam.html', {'form': form})


@login_required
def marks_entry_step2(request, class_id, stream_id, exam_id, subject_id):
    exam = get_object_or_404(Exam, id=exam_id)

    students = Student.objects.filter(class_assigned_id=class_id, is_active=True)
    if stream_id != 0:
        students = students.filter(stream_id=stream_id)
    students = students.order_by('adm_no')

    ScoreFormSet = modelformset_factory(Score, fields=('marks',), extra=0, can_delete=False)

    queryset = Score.objects.filter(exam=exam, student__in=students).select_related('student')
    existing_map = {score.student_id: score for score in queryset}

    # Ensure each student has a Score record
    for student in students:
        if student.id not in existing_map:
            Score.objects.create(exam=exam, student=student)

    updated_queryset = Score.objects.filter(exam=exam, student__in=students).select_related('student')

    if request.method == 'POST':
        formset = ScoreFormSet(request.POST, queryset=updated_queryset)
        if formset.is_valid():
            instances = formset.save(commit=False)
            for instance in instances:
                instance.exam = exam
                instance.entered_by = request.user
                instance.grade = instance.calculate_grade()
                instance.save()
            messages.success(request, "Marks successfully saved.")
            return redirect('grading:marks_entry_step1')
    else:
        formset = ScoreFormSet(queryset=updated_queryset)

    return render(request, 'grading/marks_step2_entry_form.html', {
        'formset': formset,
        'exam': exam,
        'students': students,
    })

# grading/views.py (bottom)
from .models import GradeScale
from .forms import GradeScaleForm
from django.forms import modelformset_factory
from django.contrib.auth.decorators import login_required
from django.utils.timezone import now

@login_required
def manage_gradescale(request):
    current_school = request.user.school
    current_year = now().year

    GradeFormSet = modelformset_factory(
        GradeScale, form=GradeScaleForm, extra=1, can_delete=True
    )

    queryset = GradeScale.objects.filter(
        school=current_school,
        academic_year=current_year
    ).order_by('-min_score')

    if request.method == 'POST':
        formset = GradeFormSet(request.POST, queryset=queryset)
        if formset.is_valid():
            instances = formset.save(commit=False)
            for instance in instances:
                instance.school = current_school
                instance.academic_year = current_year
                instance.save()
            # delete marked
            for obj in formset.deleted_objects:
                obj.delete()
            messages.success(request, "Grade scale updated successfully.")
            return redirect('grading:manage_gradescale')
    else:
        formset = GradeFormSet(queryset=queryset)

    return render(request, 'grading/manage_gradescale.html', {
        'formset': formset,
        'year': current_year,
    })
    
    
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .serializers import GradeScaleSerializer

class GradeScaleViewSet(viewsets.ModelViewSet):
    queryset = GradeScale.objects.all()
    serializer_class = GradeScaleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        school = self.request.user.school
        return GradeScale.objects.filter(school=school).order_by('-academic_year', '-min_score')

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

from django.views.generic import ListView, CreateView, UpdateView
from .models import GradeScale

from django.urls import reverse_lazy

class GradeScaleListView(ListView):
    model = GradeScale
    template_name = 'exams/gradescale_list.html'
    context_object_name = 'gradescales'

    def get_queryset(self):
        return GradeScale.objects.filter(school=self.request.user.school)

class GradeScaleCreateView(CreateView):
    model = GradeScale
    fields = ['academic_year', 'grade', 'min_score', 'max_score', 'points', 'remarks']
    template_name = 'exams/gradescale_form.html'
    success_url = reverse_lazy('exams:gradescale_list')

    def form_valid(self, form):
        form.instance.school = self.request.user.school
        return super().form_valid(form)


@login_required
def upload_marks_csv(request, exam_id):
    exam = get_object_or_404(Exam, pk=exam_id)
    current_school = request.user.school
    current_year = now().year

    if request.method == 'POST':
        form = CSVMarksUploadForm(request.POST, request.FILES)
        if form.is_valid():
            file = request.FILES['csv_file']
            data_set = file.read().decode('UTF-8')
            io_string = io.StringIO(data_set)
            reader = csv.DictReader(io_string)

            errors = []
            saved = 0

            grading = GradeScale.objects.filter(
                school=current_school, academic_year=current_year
            ).order_by('-min_score')

            for row in reader:
                adm_no = row.get("admission_number")
                marks = row.get("marks")

                try:
                    student = Student.objects.get(adm_no=adm_no, current_class=exam.class_assigned)
                    marks = float(marks)

                    grade_row = next((g for g in grading if g.min_score <= marks <= g.max_score), None)
                    grade = grade_row.grade if grade_row else 'N/A'

                    Score.objects.update_or_create(
                        exam=exam,
                        student=student,
                        defaults={'marks': marks, 'grade': grade}
                    )
                    saved += 1
                except Exception as e:
                    errors.append(f"{adm_no}: {str(e)}")

            if errors:
                messages.warning(request, f"{len(errors)} rows had issues: {errors}")
            messages.success(request, f"{saved} marks successfully imported.")
            return redirect('exams:enter_marks', exam_id=exam.id)
    else:
        form = CSVMarksUploadForm()

    return render(request, 'grading/upload_marks_csv.html', {
        'form': form,
        'exam': exam
    })
    
@login_required
def download_marks_template(request, exam_id):
    exam = get_object_or_404(Exam, pk=exam_id)

    students = Student.objects.filter(
        current_class=exam.class_assigned,
        is_active=True
    )
    if exam.stream:
        students = students.filter(current_stream=exam.stream)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="marks_template_{exam.id}.csv"'

    writer = csv.writer(response)
    writer.writerow(['admission_number', 'student_name', 'marks'])  # headers

    for student in students:
        writer.writerow([student.adm_no, student.full_name(), ''])  # blank marks

    return response

# grading/views.py (end)
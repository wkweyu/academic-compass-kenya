from django import forms
from django.forms import modelformset_factory
from apps.grading.models import Score
from .models import Exam

class ExamScoreForm(forms.ModelForm):
    class Meta:
        model = Score
        fields = ['student', 'marks']
        widgets = {
            'student': forms.HiddenInput(),
            'marks': forms.NumberInput(attrs={'class': 'form-control', 'min': 0}),
        }

ExamScoreFormSet = modelformset_factory(
    Score,
    form=ExamScoreForm,
    extra=0,
    can_delete=False
)

class ExamForm(forms.ModelForm):
    class Meta:
        model = Exam
        fields = [
            'name', 'exam_type', 'subject', 'class_assigned', 'stream',
            'term', 'academic_year', 'exam_date', 'max_marks', 'duration_minutes',
            'instructions'
        ]

    def __init__(self, *args, **kwargs):
        # You can add school filtering for querysets here if needed
        # e.g., self.fields['subject'].queryset = Subject.objects.filter(school=...)
        super().__init__(*args, **kwargs)

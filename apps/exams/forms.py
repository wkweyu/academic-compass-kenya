from django import forms
from django.forms import modelformset_factory
from apps.grading.models import Score

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

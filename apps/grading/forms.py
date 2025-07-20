from django import forms
from students.models import Class, Stream
from subjects.models import Subject
from apps.exams.models import Exam 
from django.forms import modelformset_factory, ModelForm
from apps.grading.models import Score

class MarksEntryFilterForm(forms.Form):
    class_assigned = forms.ModelChoiceField(queryset=Class.objects.all(), label="Class")
    stream = forms.ModelChoiceField(queryset=Stream.objects.all(), required=False)
    subject = forms.ModelChoiceField(queryset=Subject.objects.all())
    exam = forms.ModelChoiceField(queryset=Exam.objects.none())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'class_assigned' in self.data:
            class_id = self.data.get('class_assigned')
            if class_id:
                self.fields['exam'].queryset = Exam.objects.filter(class_assigned_id=class_id)

class ExamSelectionForm(forms.Form):
    class_assigned = forms.ModelChoiceField(queryset=Class.objects.all(), label="Class")
    stream = forms.ModelChoiceField(queryset=Stream.objects.all(), required=False)
    exam = forms.ModelChoiceField(queryset=Exam.objects.none())
    subject = forms.ModelChoiceField(queryset=Subject.objects.all())

    def __init__(self, *args, **kwargs):
        school = kwargs.pop('school', None)
        super().__init__(*args, **kwargs)
        if school:
            self.fields['class_assigned'].queryset = Class.objects.filter(school=school)
            self.fields['stream'].queryset = Stream.objects.filter(school=school)
            self.fields['subject'].queryset = Subject.objects.filter(school=school)
            self.fields['exam'].queryset = Exam.objects.filter(class_assigned__school=school)

class MarksEntryForm(ModelForm):
    class Meta:
        model = Score
        fields = ['student', 'exam', 'marks']  # Changed from 'subject' to 'exam'
        widgets = {
            'marks': forms.NumberInput(attrs={'class': 'form-control', 'min': 0}),
        }

MarksEntryFormSet = modelformset_factory(
    Score,
    form=MarksEntryForm,
    extra=0,
    can_delete=False
)

# grading/forms.py
from django import forms
from apps.grading.models import GradeScale

class GradeScaleForm(forms.ModelForm):
    class Meta:
        model = GradeScale
        fields = ['grade', 'min_score', 'max_score', 'points', 'remarks']
        
# grading/forms.py



class CSVMarksUploadForm(forms.Form):
    csv_file = forms.FileField(label="Upload CSV")


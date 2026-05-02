from django import forms
from .models import Subject

class SubjectForm(forms.ModelForm):
    class Meta:
        model = Subject
        fields = ['name', 'code', 'description', 'is_core', 'grade_levels']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
        }
    
    def clean_code(self):
        code = self.cleaned_data['code']
        return code.upper()
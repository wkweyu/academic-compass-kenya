
from django import forms
from .models import Student, Class, Stream, StudentTransfer

from django.utils.timezone import now
from apps.students.models import Stream

class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = [
            'full_name', 'gender', 'date_of_birth', 'photo', 'kcpe_index',
            'current_class', 'current_stream', 'admission_year',
            'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_relationship'
        ]
        widgets = {
            'full_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter full name'}),
            'gender': forms.Select(attrs={'class': 'form-control'}),
            'date_of_birth': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'photo': forms.FileInput(attrs={'class': 'form-control', 'accept': 'image/*'}),
            'kcpe_index': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'KCPE Index Number'}),
            'current_class': forms.Select(attrs={'class': 'form-control'}),
            'current_stream': forms.Select(attrs={'class': 'form-control'}),
            'admission_year': forms.NumberInput(attrs={'class': 'form-control'}),
            'guardian_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Guardian full name'}),
            'guardian_phone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '+254xxxxxxxxx or 07xxxxxxxx'}),
            'guardian_email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'guardian@email.com'}),
            'guardian_relationship': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., Parent, Guardian'}),
        }

    def __init__(self, *args, **kwargs):
        
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)

        current_year = now().year

        if user and hasattr(user, 'school') and user.school:
            # When user is passed with valid school (e.g., from a view)
            self.fields['current_stream'].queryset = Stream.school_objects.filter(
                school=user.school,
                year=current_year
            )
        else:
            # Fallback for shell/admin/tests
            self.fields['current_stream'].queryset = Stream.objects.filter(year=current_year)

        # Apply form-control class to all fields
        for field in self.fields.values():
            field.widget.attrs.update({'class': 'form-control'})

class StudentTransferForm(forms.ModelForm):
    class Meta:
        model = StudentTransfer
        fields = ['student', 'to_class', 'to_stream', 'reason']
        widgets = {
            'student': forms.Select(attrs={'class': 'form-control'}),
            'to_class': forms.Select(attrs={'class': 'form-control'}),
            'to_stream': forms.Select(attrs={'class': 'form-control'}),
            'reason': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Reason for transfer (optional)'}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['student'].queryset = Student.objects.filter(is_active=True).order_by('full_name')
        self.fields['to_stream'].queryset = Stream.objects.none()
        
        if 'to_class' in self.data:
            try:
                class_id = int(self.data.get('to_class'))
                self.fields['to_stream'].queryset = Stream.objects.filter(class_assigned_id=class_id)
            except (ValueError, TypeError):
                pass
from django import forms
from .models import ClassSubjectAllocation

class ClassSubjectAllocationForm(forms.ModelForm):
    class Meta:
        model = ClassSubjectAllocation
        fields = '__all__'
        widgets = {
            'academic_year': forms.NumberInput(attrs={'class': 'form-control'}),
            'term': forms.Select(attrs={'class': 'form-control'}),
            'school_class': forms.Select(attrs={'class': 'form-control'}),
            'stream': forms.Select(attrs={'class': 'form-control'}),
            'subject': forms.Select(attrs={'class': 'form-control'}),
            'subject_teacher': forms.Select(attrs={'class': 'form-control'}),
            'class_teacher': forms.Select(attrs={'class': 'form-control'}),
        }

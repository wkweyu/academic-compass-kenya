from django import forms
from django.utils.timezone import now
from .models import Student, Stream, StudentTransfer, ClassSubjectAllocation


class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = [
            'full_name', 'gender', 'date_of_birth', 'photo', 'kcpe_index',
            'current_class', 'current_stream', 'admission_year',
            'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_relationship'
        ]
        widgets = {
            'date_of_birth': forms.DateInput(attrs={'type': 'date'}),
            'photo': forms.FileInput(attrs={'accept': 'image/*'}),
            'guardian_phone': forms.TextInput(attrs={'placeholder': '+254xxxxxxxxx or 07xxxxxxxx'}),
            'guardian_email': forms.EmailInput(attrs={'placeholder': 'guardian@email.com'}),
            'guardian_relationship': forms.TextInput(attrs={'placeholder': 'e.g., Parent, Guardian'}),
        }

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)

        current_year = now().year

        if user and getattr(user, "school", None):
            self.fields['current_stream'].queryset = Stream.school_objects.filter(
                school=user.school,
                year=current_year
            )
        else:
            self.fields['current_stream'].queryset = Stream.objects.filter(year=current_year)

        # Apply bootstrap styling globally
        for field in self.fields.values():
            field.widget.attrs.setdefault('class', 'form-control')


class StudentTransferForm(forms.ModelForm):
    class Meta:
        model = StudentTransfer
        fields = ['student', 'to_class', 'to_stream', 'reason']
        widgets = {
            'reason': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Reason for transfer (optional)'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['student'].queryset = Student.objects.filter(is_active=True).order_by('full_name')
        self.fields['to_stream'].queryset = Stream.objects.none()

        # Handle dynamic filtering
        if 'to_class' in self.data:
            try:
                class_id = int(self.data.get('to_class'))
                self.fields['to_stream'].queryset = Stream.objects.filter(class_assigned_id=class_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk:
            # Editing an existing transfer → show correct streams
            self.fields['to_stream'].queryset = Stream.objects.filter(
                class_assigned_id=self.instance.to_class_id
            )

        for field in self.fields.values():
            field.widget.attrs.setdefault('class', 'form-control')


class ClassSubjectAllocationForm(forms.ModelForm):
    class Meta:
        model = ClassSubjectAllocation
        fields = '__all__'
        widgets = {
            'academic_year': forms.NumberInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs.setdefault('class', 'form-control')

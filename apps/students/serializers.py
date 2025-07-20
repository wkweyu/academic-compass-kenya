from core.middleware import get_current_school

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = '__all__'

    def create(self, validated_data):
        validated_data['school'] = get_current_school()
        return super().create(validated_data)

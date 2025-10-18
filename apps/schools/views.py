from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import School
from .serializers import SchoolSerializer

class SchoolDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # In a single-school setup, always return the first school.
        return School.objects.first()

    def get(self, request, *args, **kwargs):
        school = self.get_object()
        if not school:
            return Response({"detail": "School profile not found. Please create one."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(school)
        return Response(serializer.data)

class SchoolCreateView(generics.CreateAPIView):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        # Prevent creating a new school if one already exists
        if School.objects.exists():
            return Response(
                {"detail": "A school profile already exists. You can update it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        school = serializer.instance

        # Associate this school with the user who created it.
        # This is useful for tracking, but the rest of the app will use School.objects.first()
        user = request.user
        user.school = school
        user.save()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
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
        # Check if user already has a school
        user = request.user
        if user.school:
            return Response(
                {"detail": "You already have a school profile. You can update it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if a school already exists globally (single-school mode)
        if School.objects.exists():
            existing_school = School.objects.first()
            # Link the user to the existing school
            user.school = existing_school
            user.save()
            serializer = self.get_serializer(existing_school)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        school = serializer.instance

        # Associate this school with the user who created it
        user.school = school
        user.save()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
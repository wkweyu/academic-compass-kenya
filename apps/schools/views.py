from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import School
from .serializers import SchoolSerializer

class SchoolDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            # Assumes a user is associated with one school.
            return self.request.user.school
        except School.DoesNotExist:
            return None

    def get(self, request, *args, **kwargs):
        school = self.get_object()
        if not school:
            return Response({"detail": "School profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(school)
        return Response(serializer.data)

class SchoolCreateView(generics.CreateAPIView):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if hasattr(request.user, 'school') and request.user.school:
            return Response(
                {"detail": "You already have a school profile. Please refresh the page and try updating it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        # Associate the new school with the user
        user = request.user
        user.school = serializer.instance
        user.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
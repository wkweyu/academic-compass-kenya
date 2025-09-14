from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.views import obtain_auth_token

def root_view(request):
    return HttpResponse("""
    <h1>SkoolTrack Pro API Server</h1>
    <p>This is the Django backend API server.</p>
    <p>For the frontend interface, please visit: <a href="http://localhost:5173">http://localhost:5173</a></p>
    <p>Available API endpoints:</p>
    <ul>
        <li><a href="/admin/">Admin Panel</a></li>
        <li><a href="/students/">Students</a></li>
        <li><a href="/exams/">Exams</a></li>
        <li><a href="/api/schools/">Schools API</a></li>
        <li><a href="/api/students/classes/">Classes API</a></li>
        <li><a href="/api/students/streams/">Streams API</a></li>
        <li><a href="/dashboard/">Dashboard API</a></li>
    </ul>
    """)

# Temporary endpoints to prevent 404 errors - made public
@api_view(['GET'])
@permission_classes([AllowAny])
def temporary_dashboard(request):
    return Response({
        "stats": {
            "totalExams": 0,
            "activeExams": 0,
            "totalStudents": 0,
            "totalSubjects": 0,
            "completedScores": 0,
            "pendingResults": 0,
        },
        "recentExams": [],
        "performanceData": []
    })

urlpatterns = [
    # Root
    path('', root_view, name='root'),

    # Admin
    path('admin/', admin.site.urls),

    # Authentication (Token + Session)
    path('api/auth/', include('dj_rest_auth.urls')),                # login, logout, user
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),  # register
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),  # Token authentication
    path('accounts/', include('allauth.urls')),                     # optional for social/allauth routes

    # App URLs
    path('students/', include('apps.students.urls')),               # Template views
    path('teachers/', include('apps.teachers.urls')),
    path('subjects/', include('apps.subjects.urls')),
    path('exams/', include('apps.exams.urls')),
    path('grading/', include('apps.grading.urls')),

    # API URLs
    path('api/schools/', include('apps.schools.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/fees/', include('apps.fees.urls')),
    path('api/transport/', include('apps.transport.urls')),
    path('api/procurement/', include('apps.procurement.urls')),
    path('api/students/', include('apps.students.api_urls')),       # Student API endpoints

    # Temporary endpoint to prevent frontend 404 errors
    path('dashboard/', temporary_dashboard),
]

# Serve media/static during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
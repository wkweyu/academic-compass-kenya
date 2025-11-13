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


urlpatterns = [
    # Root
    path('', root_view, name='root'),

    # Admin
    path('admin/', admin.site.urls),

    # Authentication
    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
    path('accounts/', include('allauth.urls')),

    # App URLs
    path('students/', include('apps.students.urls')),
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
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/students/', include('apps.students.api_urls')),
    path('api/teachers/', include('apps.teachers.api_urls')),

    # Dashboard API
    path('api/dashboard/', include('apps.dashboard.urls')),
    
]


# Serve media/static during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
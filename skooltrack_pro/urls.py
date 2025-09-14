from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse

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
    </ul>
    """)

urlpatterns = [
    # Root
    path('', root_view, name='root'),

    # Admin
    path('admin/', admin.site.urls),

    # Authentication (clean, cookie-based)
    path('api/auth/', include('dj_rest_auth.urls')),                # login, logout, user
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),  # register
    path('accounts/', include('allauth.urls')),                     # optional for social/allauth routes

    # App URLs
    path('students/', include('apps.students.urls')),
    path('teachers/', include('apps.teachers.urls')),
    path('subjects/', include('apps.subjects.urls')),
    path('exams/', include('apps.exams.urls')),
    path('grading/', include('apps.grading.urls')),

    path('api/schools/', include('apps.schools.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/fees/', include('apps.fees.urls')),
    path('api/transport/', include('apps.transport.urls')),
    path('api/procurement/', include('apps.procurement.urls')),
    path('api/students/', include('apps.students.api_urls')),
]

# Serve media/static during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

<<<<<<< HEAD

def root_view(request):
    return HttpResponse(
        
        "<h1>SkoolTrack Pro API Server</h1>"
        "<p>This is the Django backend API server.</p>"
        '<p>For the frontend interface, please visit: '
        '<a href="http://localhost:5173">http://localhost:5173</a></p>'
        "<p>Available API endpoints:</p>"
        "<ul>"
        '<li><a href="/admin/">Admin Panel</a></li>'
        '<li><a href="/api/students/">Students API</a></li>'
        '<li><a href="/api/teachers/">Teachers API</a></li>'
        '<li><a href="/api/subjects/">Subjects API</a></li>'
        '<li><a href="/api/exams/">Exams API</a></li>'
        '<li><a href="/api/grading/">Grading API</a></li>'
        '<li><a href="/api/schools/">Schools API</a></li>'
        '<li><a href="/api/users/">Users API</a></li>'
        '<li><a href="/api/fees/">Fees API</a></li>'
        '<li><a href="/api/transport/">Transport API</a></li>'
        '<li><a href="/api/procurement/">Procurement API</a></li>'
        "</ul>"
    )

=======
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
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1

urlpatterns = [
    # Root
    path('', root_view, name='root'),
<<<<<<< HEAD

    # Admin
    path('admin/', admin.site.urls),

    # JWT Auth
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

=======
    
    # Admin
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    # Authentication
    path('auth/', include('dj_rest_auth.urls')),
    path('auth/registration/', include('dj_rest_auth.registration.urls')),
    path('accounts/', include('allauth.urls')),

<<<<<<< HEAD
    # APIs
    path('api/students/', include('apps.students.api_urls')),
    path('api/teachers/', include('apps.teachers.urls')),
    path('api/subjects/', include('apps.subjects.urls')),
    path('api/exams/', include('apps.exams.urls')),
    path('api/grading/', include('apps.grading.urls')),
=======
    # Apps
    path('students/', include('apps.students.urls')),
    path('teachers/', include('apps.teachers.urls')),
    path('subjects/', include('apps.subjects.urls')),
    path('exams/', include('apps.exams.urls')),
    path('grading/', include('apps.grading.urls')),


>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    path('api/schools/', include('apps.schools.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/fees/', include('apps.fees.urls')),
    path('api/transport/', include('apps.transport.urls')),
<<<<<<< HEAD
    path('api/procurement/', include('apps.procurement.urls')),
]

# Serve static & media in dev
=======

    #Procurement
    path('api/procurement/', include('apps.procurement.urls')),
    path('api/students/', include('apps.students.api_urls')),

]

# Serve media files during development
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

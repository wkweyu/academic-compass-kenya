from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.views import obtain_auth_token
from django.db import connection

def root_view(request):
    """Enhanced root view with health check info"""
    return HttpResponse("""
    <html>
    <head>
        <title>SkoolTrack Pro API</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h1 { color: #2563eb; }
            .status { padding: 10px; background: #10b981; color: white; border-radius: 4px; display: inline-block; }
            ul { line-height: 1.8; }
            a { color: #2563eb; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>✅ SkoolTrack Pro API Server</h1>
            <div class="status">Django Backend is Running</div>
            
            <h2>🔍 Health Checks:</h2>
            <ul>
                <li><a href="/health/">/health/</a> - Backend health status</li>
                <li><a href="/api-test/">/api-test/</a> - Authentication test (requires login)</li>
            </ul>
            
            <h2>📚 API Endpoints:</h2>
            <ul>
                <li><a href="/admin/">Admin Panel</a></li>
                <li><a href="/api/teachers/">/api/teachers/</a> - Teachers API</li>
                <li><a href="/api/students/">/api/students/</a> - Students API</li>
                <li><a href="/api/schools/">/api/schools/</a> - Schools API</li>
                <li><a href="/api/dashboard/">/api/dashboard/</a> - Dashboard API</li>
            </ul>
            
            <h2>🖥️ Frontend:</h2>
            <ul>
                <li><a href="http://localhost:8080">http://localhost:8080</a> (Development)</li>
            </ul>
            
            <h2>📖 Setup Guide:</h2>
            <p>If you're having issues registering teachers, check <code>BACKEND_SETUP.md</code> for troubleshooting steps.</p>
        </div>
    </body>
    </html>
    """)

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint - no authentication required"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return Response({
            "status": "healthy",
            "message": "Django backend is running",
            "database": "connected"
        })
    except Exception as e:
        return Response({
            "status": "unhealthy",
            "database": "connection failed",
            "error": str(e)
        }, status=500)

@api_view(['GET'])
def api_test(request):
    """Test endpoint - requires authentication"""
    return Response({
        "message": "API is working",
        "authenticated": request.user.is_authenticated,
        "user": request.user.email if request.user.is_authenticated else None,
        "school_id": getattr(request.user, 'school_id', None) if request.user.is_authenticated else None,
        "has_school": bool(getattr(request.user, 'school', None)) if request.user.is_authenticated else False
    })

urlpatterns = [
    # Root and health
    path('', root_view, name='root'),
    path('health/', health_check, name='health-check'),
    path('api-test/', api_test, name='api-test'),

    # Admin
    path('admin/', admin.site.urls),

    # Authentication
    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
    path('accounts/', include('allauth.urls')),

    # App URLs (HTML views)
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
    path('api/iga/', include('apps.iga.urls')),
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
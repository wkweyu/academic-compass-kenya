from django.http import HttpResponse

def root_view(request):
    return HttpResponse("""
        <h1>SkoolTrack Pro API Server</h1>
        <p>This is the Django backend API server.</p>
        <p>For the frontend interface, please visit: 
        <a href="http://localhost:5173">http://localhost:5173</a></p>
        <p>Available API endpoints:</p>
        <ul>
            <li><a href="/admin/">Admin Panel</a></li>
            <li><a href="/api/students/">Students API</a></li>
            <li><a href="/api/schools/">Schools API</a></li>
            <li><a href="/api/users/">Users API</a></li>
        </ul>
    """)

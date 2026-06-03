from threading import local

_request_local = local()

def get_current_school():
    request = getattr(_request_local, 'request', None)
    if request:
        if hasattr(request, 'current_school_cached'):
            return request.current_school_cached
        
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            school = getattr(user, 'school', None)
            request.current_school_cached = school
            return school
    return getattr(_request_local, 'school', None)

# Update your middleware to also set school on the request
class SchoolContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _request_local.request = request
        _request_local.school = None
        
        response = self.get_response(request)
        
        # Clean up to avoid memory leaks
        _request_local.request = None
        _request_local.school = None
        return response
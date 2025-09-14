from threading import local

_request_local = local()

def get_current_school():
    return getattr(_request_local, 'school', None)

# Update your middleware to also set school on the request
class SchoolContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            # Set both thread-local and request attribute
            _request_local.school = user.school
            request.current_school = user.school  # Add this line
        else:
            _request_local.school = None
            request.current_school = None  # Add this line
        
        response = self.get_response(request)
        return response
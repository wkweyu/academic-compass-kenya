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
        school = None
        if user and user.is_authenticated:
            school = getattr(user, 'school', None)
        _request_local.school = school
        request.current_school = school

        response = self.get_response(request)
        return response
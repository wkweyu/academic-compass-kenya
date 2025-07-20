from threading import local

_request_local = local()

def get_current_school():
    return getattr(_request_local, 'school', None)

class SchoolContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            _request_local.school = user.school
        else:
            _request_local.school = None
        response = self.get_response(request)
        return response

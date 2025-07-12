
"""
WSGI config for CBC Student Exam Management System
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cbc_system.settings')

application = get_wsgi_application()

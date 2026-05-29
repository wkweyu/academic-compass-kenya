from .settings import *

TEST_RUNNER = 'test_runner.CustomTestRunner'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'skooltrack_pro_test',
        'USER': 'djtest',
        'PASSWORD': 'djtest',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

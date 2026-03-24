"""Django settings for skooltrack_pro Student Exam Management System."""

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent


def csv_config(name, default=""):
    raw_value = config(name, default=default)
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(',') if item.strip()]


def append_unique(items, values):
    for value in values:
        if value and value not in items:
            items.append(value)
    return items

# Security settings
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-this-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
FRONTEND_URL = config('FRONTEND_URL', default='').strip()
RENDER_EXTERNAL_HOSTNAME = config('RENDER_EXTERNAL_HOSTNAME', default='').strip()
SUPABASE_PROJECT_URL = config('SUPABASE_URL', default=config('VITE_SUPABASE_URL', default='')).strip()
SUPABASE_ANON_KEY = config('SUPABASE_ANON_KEY', default=config('VITE_SUPABASE_ANON_KEY', default='')).strip()
ALLOWED_HOSTS = csv_config('ALLOWED_HOSTS', default='localhost,127.0.0.1,testserver')

if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Applications
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
]

THIRD_PARTY_APPS = [
    'corsheaders',
    'whitenoise.runserver_nostatic',
    'rest_framework',
    'rest_framework.authtoken',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'dj_rest_auth',
    'dj_rest_auth.registration',
    'import_export',
    'widget_tweaks',
]

LOCAL_APPS = [
    'apps.users.apps.UsersConfig',
    'apps.schools.apps.SchoolsConfig',
    'apps.students.apps.StudentsConfig',
    'apps.subjects.apps.SubjectsConfig',
    'apps.teachers.apps.TeachersConfig',
    'apps.grading.apps.GradingConfig',
    'apps.exams.apps.ExamsConfig',
    'apps.settings.apps.SettingsConfig',
    'apps.fees.apps.FeesConfig',
    'apps.transport.apps.TransportConfig',
    'apps.procurement.apps.ProcurementConfig',
    'apps.iga.apps.IgaConfig',
    'apps.core.apps.CoreConfig',
    'apps.attendance.apps.AttendanceConfig',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# Middleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'skooltrack_pro.urls'

# Templates
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'skooltrack_pro.wsgi.application'

# Database (Postgres/Supabase)
DB_SSL_REQUIRE = config('DB_SSL_REQUIRE', default=not DEBUG, cast=bool)

# Use SQLite for testing or in CI/sandbox environment
if 'test' in sys.argv or config('CI', default=False, cast=bool):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    SUPABASE_URL = config('SUPABASE_DB_URL', default=None)
    if SUPABASE_URL:
        DATABASES = {
            'default': dj_database_url.config(
                default=SUPABASE_URL,
                conn_max_age=600,
                ssl_require=DB_SSL_REQUIRE,
            )
        }
    else:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': config('DB_NAME', default='skooltrack_pro'),
                'USER': config('DB_USER', default='postgres'),
                'PASSWORD': config('DB_PASSWORD', default='123'),
                'HOST': config('DB_HOST', default='localhost'),
                'PORT': config('DB_PORT', default='5432'),
                'OPTIONS': {'sslmode': 'require'} if DB_SSL_REQUIRE else {},
            }
        }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

# Static / Media
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Sites framework
SITE_ID = 1

# Authentication
AUTH_USER_MODEL = 'users.User'
LOGIN_URL = '/auth/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/auth/login/'


AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]
#Email login configuration
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_EMAIL_VERIFICATION = 'optional'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.users.authentication.SupabaseJWTAuthentication',
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

COOKIE_SECURE = config('COOKIE_SECURE', default=not DEBUG, cast=bool)
COOKIE_SAMESITE = config('COOKIE_SAMESITE', default='Lax')

# Simple JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_COOKIE": "access_token",          # Cookie name
    "AUTH_COOKIE_SECURE": COOKIE_SECURE,
    "AUTH_COOKIE_HTTP_ONLY": True,          # JS cannot read cookie
    "AUTH_COOKIE_PATH": "/",                 # Cookie path
    "AUTH_COOKIE_SAMESITE": COOKIE_SAMESITE,
    "REFRESH_COOKIE": "refresh_token",
    "REFRESH_COOKIE_SECURE": COOKIE_SECURE,
    "REFRESH_COOKIE_HTTP_ONLY": True,
    "REFRESH_COOKIE_PATH": "/",
    "REFRESH_COOKIE_SAMESITE": COOKIE_SAMESITE,
}

SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_SAMESITE = COOKIE_SAMESITE
CSRF_COOKIE_SAMESITE = COOKIE_SAMESITE

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = config('USE_X_FORWARDED_HOST', default=True, cast=bool)
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=not DEBUG, cast=bool)
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000 if not DEBUG else 0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=not DEBUG, cast=bool)
SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=not DEBUG, cast=bool)
SECURE_CONTENT_TYPE_NOSNIFF = True

# CORS
LOCAL_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
]

CORS_ALLOWED_ORIGINS = csv_config('CORS_ALLOWED_ORIGINS')
append_unique(CORS_ALLOWED_ORIGINS, LOCAL_DEV_ORIGINS)
append_unique(CORS_ALLOWED_ORIGINS, [FRONTEND_URL])

CSRF_TRUSTED_ORIGINS = csv_config('CSRF_TRUSTED_ORIGINS')
append_unique(CSRF_TRUSTED_ORIGINS, LOCAL_DEV_ORIGINS)
append_unique(CSRF_TRUSTED_ORIGINS, [FRONTEND_URL])
if RENDER_EXTERNAL_HOSTNAME:
    render_origin = f'https://{RENDER_EXTERNAL_HOSTNAME}'
    append_unique(CSRF_TRUSTED_ORIGINS, [render_origin])

CORS_ALLOW_CREDENTIALS = True

# Import Export
IMPORT_EXPORT_USE_TRANSACTIONS = True

# Twilio Configuration
TWILIO_ACCOUNT_SID = config('TWILIO_ACCOUNT_SID', default='your_twilio_account_sid')
TWILIO_AUTH_TOKEN = config('TWILIO_AUTH_TOKEN', default='your_twilio_auth_token')
TWILIO_PHONE_NUMBER = config('TWILIO_PHONE_NUMBER', default='your_twilio_phone_number')

# Render Production Deployment

This repository is prepared for a two-service Render deployment:

- `academic-compass-api` for the Django API
- `academic-compass-web` for the Vite frontend

The database stays on Supabase.

## What is included

- Gunicorn for the Django process
- WhiteNoise for Django static files
- Environment-based host, CORS, CSRF, SSL, and cookie settings
- Backend support for `SUPABASE_URL` and `SUPABASE_ANON_KEY` so Django can authenticate Supabase sessions
- A Render blueprint at [render.yaml](render.yaml)
- Frontend support for `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`

## Supabase database URL

Copy the Postgres connection string from Supabase and set it as `SUPABASE_DB_URL`.

Recommended format:

`postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require`

## Deploy on Render

### Blueprint deploy

1. Push this repository to GitHub.
2. In Render, select **New +** → **Blueprint**.
3. Choose the repository.
4. Render reads [render.yaml](render.yaml).
5. Fill in the requested environment variables.

### Manual deploy

#### Backend service

- Runtime: Python
- Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Pre-deploy command: `python manage.py migrate`
- Start command: `gunicorn skooltrack_pro.wsgi:application --bind 0.0.0.0:$PORT`
- Health check path: `/health/`

#### Frontend service

- Runtime: Static Site
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Rewrite rule: `/* -> /index.html`

## Required environment variables

### Backend

- `SECRET_KEY`
- `DEBUG=false`
- `SUPABASE_DB_URL`
- `FRONTEND_URL=https://<your-frontend>.onrender.com`
- `CORS_ALLOWED_ORIGINS=https://<your-frontend>.onrender.com`
- `CSRF_TRUSTED_ORIGINS=https://<your-frontend>.onrender.com,https://<your-backend>.onrender.com`

Recommended:

- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=Lax`
- `SECURE_SSL_REDIRECT=true`
- `DB_SSL_REQUIRE=true`

### Frontend

- `VITE_API_URL=https://<your-backend>.onrender.com`
- `VITE_SUPABASE_URL=https://<your-project-id>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<your-anon-key>`

## First production checks

1. Open `https://<backend>/health/`
2. Open the frontend site
3. Confirm login works
4. Confirm API requests reach the backend and return JSON

## If you use cross-site auth cookies later

If you decide to rely on cookies across different domains, change:

- `COOKIE_SAMESITE=None`
- keep `COOKIE_SECURE=true`

## Common failure points

- Wrong `SUPABASE_DB_URL`
- Missing `sslmode=require`
- Wrong `VITE_API_URL`
- Missing CORS or CSRF trusted origins
- Missing SPA rewrite rule on the static site
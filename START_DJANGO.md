# 🚀 Quick Start: Django Backend

## The Problem
If you see errors like:
- "Failed to load staff data"
- "Failed to create staff member"  
- "CORS request did not succeed"
- "Network Error"

**This means your Django backend server is NOT running.**

## The Solution

### Step 1: Start Django Server
Open a terminal in your project folder and run:

```bash
python manage.py runserver
```

You should see:
```
Starting development server at http://127.0.0.1:8000/
```

### Step 2: Keep Terminal Open
**IMPORTANT**: Keep this terminal window open while using the app!

### Step 3: Verify It's Working
Open your browser and visit:
- http://localhost:8000/health/ (should show "healthy")
- http://localhost:8000/api/teachers/ (should show JSON or login page)

### Step 4: Test Your App
Now go back to your React app at http://localhost:8080 and try again!

---

## Common Issues

### "Port already in use"
Another Django server is already running. Find and close it, or use a different port:
```bash
python manage.py runserver 8001
```
Then update `src/api/api.ts` to use port 8001.

### "Module not found" errors
Install dependencies:
```bash
pip install -r requirements.txt
```

### Database errors
Run migrations:
```bash
python manage.py migrate
```

---

## Production Note
For production deployment, you'll need to:
1. Use a proper WSGI server (gunicorn, uwsgi)
2. Configure CORS for your production domain
3. Set up proper environment variables

But for development, just `python manage.py runserver` is enough!

# Backend Setup & Troubleshooting Guide

## Critical Steps to Register Staff/Teachers

### 1. Start Django Server
```bash
# Navigate to project root
cd /path/to/your/project

# Activate virtual environment (if using one)
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Run Django server
python manage.py runserver
```

**Expected output:**
```
Starting development server at http://127.0.0.1:8000/
```

If you see errors, check:
- Database connection in `.env` file
- All dependencies installed: `pip install -r requirements.txt`

### 2. Apply Database Migrations
```bash
# Create migrations for teachers app
python manage.py makemigrations teachers

# Apply all migrations
python manage.py migrate
```

### 3. Verify User Has School ID

**Check in Django shell:**
```bash
python manage.py shell
```

Then run:
```python
from apps.users.models import User
user = User.objects.first()  # or get your specific user
print(f"User: {user.email}")
print(f"School ID: {user.school_id}")

# If school_id is None, you need to create a school profile first
if not user.school_id:
    from apps.schools.models import School
    school = School.objects.create(
        name="My School",
        code="SCH001",
        address="123 Main St",
        phone="0712345678",
        email="school@example.com"
    )
    user.school = school
    user.save()
    print(f"Created school and assigned to user: {school.id}")
```

### 4. Test API Endpoint

**Open browser and visit:**
```
http://localhost:8000/api/teachers/
```

**Expected:** JSON response or login prompt
**If 404:** Django server not running or URL misconfigured

### 5. Check Authentication Token

**In browser console (F12):**
```javascript
console.log('Auth Token:', localStorage.getItem('authToken'));
```

**If null:** You need to log in first to get a valid token

### 6. Verify CORS Settings

In `skooltrack_pro/settings.py`, ensure:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
```

## Common Issues & Solutions

### Issue: "Failed to load staff"
**Cause:** User not logged in or has no school_id
**Solution:** 
1. Log in first
2. Create school profile if missing (see step 3)

### Issue: "404 Not Found"
**Cause:** Django server not running
**Solution:** Run `python manage.py runserver`

### Issue: "CORS Error"
**Cause:** Frontend port not in CORS settings
**Solution:** Add your frontend port to `CORS_ALLOWED_ORIGINS`

### Issue: "Network Error"
**Cause:** Cannot reach Django server
**Solution:** 
1. Check Django is running on port 8000
2. Check firewall settings
3. Verify `API_URL` in `src/api/api.ts` is correct

## Verification Checklist

- [ ] Django server running on port 8000
- [ ] Migrations applied (`python manage.py migrate`)
- [ ] User is logged in (has authToken in localStorage)
- [ ] User has school_id set
- [ ] CORS configured for frontend port (8080)
- [ ] Can access http://localhost:8000/api/teachers/ in browser
- [ ] Teacher model properly configured with `db_table = 'teachers'`
- [ ] RLS policies in Supabase allow the operation

## Testing Save Functionality

After completing setup:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to save a teacher
4. Check console logs for detailed error messages
5. Look for:
   - "staffService.createStaff called with data:" (should show your form data)
   - "staffService.createStaff response:" (should show created teacher)
   - Any error messages with response details

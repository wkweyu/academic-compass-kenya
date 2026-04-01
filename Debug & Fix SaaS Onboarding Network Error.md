Debug & Fix SaaS Onboarding Network Error
# TASK: Debug and Fix Production Network Error (Render Deployment)

## CONTEXT
The application is a multi-tenant school ERP with:
- Frontend (Vite) deployed on Render
- Backend API deployed on Render
- Supabase integration

### Environment Variables (Frontend)
VITE_API_URL=https://academic-compass-api.onrender.com/api
VITE_SUPABASE_URL=https://basvqricgupbxgznsfms.supabase.co
VITE_SUPABASE_ANON_KEY=<already configured>

### ISSUE
- School onboarding works locally (http://localhost:5173)
- In production (Render), onboarding fails with NETWORK ERROR
- Direct API test:
  https://academic-compass-api.onrender.com/api/health/ returns 404

---

# OBJECTIVE
Identify and fix ALL causes of:
1. API 404 errors
2. Network errors during onboarding
3. Misconfigured routes or environment variables
4. CORS issues
5. Deployment inconsistencies

DO NOT duplicate logic. Reuse existing working code where possible.

---

# STEP 1: BACKEND ROUTE VALIDATION

## TASK
Check if `/api/health/` route exists in backend.

### ACTIONS
- Search backend for route definition:
  -  @app.route('/api/health')
  - Express: app.use('/api', ...)

### FIXES
- Ensure `/api/health` route exists
- Ensure NO trailing slash mismatch:
  - `/api/health` vs `/api/health/`

### ADD fallback test route if missing:
```python
@app.route('/api/health', methods=['GET'])
def health():
    return {"status": "ok"}, 200
STEP 2: VERIFY BASE API PREFIX
TASK

Ensure backend actually uses /api prefix

CHECK:
Is backend mounted like:
app.use('/api', router)

OR

Routes defined without /api prefix?
FIX OPTIONS:
OPTION A (Preferred)

Ensure all backend routes use /api

OPTION B

If backend does NOT use /api:
Update frontend:

VITE_API_URL=https://academic-compass-api.onrender.com
STEP 3: CORS CONFIGURATION (CRITICAL)
TASK

Fix CORS blocking frontend requests

ADD/VERIFY:


CORS(app, supports_credentials=True)
OR restrict:
CORS(app, origins=["https://your-frontend-domain.onrender.com"])
Express:
app.use(cors({
  origin: "https://your-frontend-domain.onrender.com",
  credentials: true
}))
STEP 4: VERIFY FRONTEND API CALLS
TASK

Ensure frontend uses correct API URL

CHECK:
All API calls use:
import.meta.env.VITE_API_URL
FIX:

Replace hardcoded localhost URLs:

// ❌ WRONG
fetch('http://localhost:5000/api/...')

// ✅ CORRECT
fetch(`${import.meta.env.VITE_API_URL}/...`)
STEP 5: DEBUG NETWORK ERROR
TASK

Log real error in frontend

MODIFY FETCH:
try {
  const res = await fetch(...)
  const data = await res.json()
} catch (err) {
  console.error("API ERROR:", err)
}
ALSO CHECK:
Browser DevTools → Network tab
Look for:
CORS errors
404
500
Mixed content (http vs https)
STEP 6: RENDER DEPLOYMENT CHECK
TASK

Ensure backend is actually running correctly

VERIFY:
Render service logs
No crash on startup
Correct start command:
Node: npm start
STEP 7: FIX TRAILING SLASH ISSUES
TASK

Normalize API calls

RULE:

Use consistent format:

`${API_URL}/health`
NOT
`${API_URL}/health/`
STEP 8: ONBOARDING FLOW DEBUG
TASK

Trace failing request

ACTION:
Identify onboarding API endpoint
Test it directly via browser/Postman
EXPECT:
Should return 200 or meaningful error
STEP 9: ADD FALLBACK ERROR HANDLING
TASK

Prevent UI "hanging"

IMPLEMENT:
if (!res.ok) {
  throw new Error(`API failed: ${res.status}`)
}
STEP 10: FINAL VALIDATION CHECKLIST
 /api/health returns 200
 No CORS errors
 No localhost URLs in production
 Onboarding API returns valid response
 Render logs show no crashes
 Frontend uses correct ENV variables
OUTPUT REQUIREMENTS

Copilot should:

Identify root cause(s)
Apply minimal safe fixes
Avoid breaking working local setup
Reuse existing logic
Clearly comment changes
SUCCESS CRITERIA
Production onboarding works
No network errors
API responds correctly
App behaves same as localhost

---

# 🔍 What’s MOST LIKELY WRONG (based on your screenshot)

Let me be direct:

### 🚨 Primary issue:
👉 Your backend **does NOT have `/api/health/` route**

OR

👉 Your backend **does not use `/api` prefix at all**

---

# ⚡ Quick Manual Test (do this now)

Try these in browser:

1.  

https://academic-compass-api.onrender.com/health


2.  

https://academic-compass-api.onrender.com/api/health


3.  

https://academic-compass-api.onrender.com/


👉 One of these will work — that tells you the mismatch.

---

# 💡 Final Advice

This is not a “big bug” — it’s almost always:

- wrong base URL  
- missing `/api` prefix  
- CORS  
- trailing slash mismatch  

---

If you want, next step I can:
✅ Trace your onboarding API end-to-end  
✅ Fix your backend routes structure cleanly  
✅ Standardize your SaaS API architecture  

Just tell me 👍

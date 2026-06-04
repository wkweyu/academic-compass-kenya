# Render Supabase Auth Incident Runbook

- status: Ready for production execution
- incident: `/health/` returns HTTP 500 because Django cannot open a PostgreSQL connection
- proven_exception: `django.db.utils.OperationalError: FATAL: (ECIRCUITBREAKER) too many authentication failures, new connections are temporarily blocked`
- scope: Render backend service `academic-compass-api`

## Purpose

Use this runbook to resolve the production deployment incident where Render starts successfully but the `/health/` endpoint returns HTTP 500 because Supabase rejects database authentication attempts.

This runbook does not change business logic, migrations, or database construction code. It is an operational procedure for validating the active runtime credential source and replacing invalid production credentials.

## Proven Evidence

### Health endpoint failure point

- File: `skooltrack_pro/urls.py`
- Failing statement:

```python
with connection.cursor() as cursor:
```

### Exact exception observed in Render logs

```text
django.db.utils.OperationalError: connection to server at "aws-0-eu-north-1.pooler.supabase.com" (13.60.109.208), port 5432 failed: FATAL:  (ECIRCUITBREAKER) too many authentication failures, new connections are temporarily blocked
```

### Interpretation already proven

1. Render can resolve the Supabase hostname.
2. Render can reach the Supabase pooler on port `5432`.
3. The failure occurs during PostgreSQL authentication.
4. Repeated failed logins triggered the Supabase pooler circuit breaker.

## Preconditions

Complete all items before changing production credentials.

1. Confirm you have access to the Render backend service environment.
2. Confirm you have access to the Supabase project database settings.
3. Confirm you can trigger a manual redeploy in Render after updating environment variables.
4. Confirm the latest deployed application still contains the temporary diagnostics:
   - traceback logging in `skooltrack_pro/urls.py`
   - startup DB config logging in `skooltrack_pro/settings.py`

## Required Inputs

Fill in these values before execution.

```text
<RENDER_SERVICE>            academic-compass-api
<SUPABASE_PROJECT_REF>      basvqricgupbxgznsfms
<SUPABASE_POOLER_HOST>      aws-0-eu-north-1.pooler.supabase.com
<EXPECTED_DB_NAME>          postgres
<EXPECTED_DB_USER>          postgres.<project-ref>
<NEW_FULL_DB_URL>           postgresql://<user>:<password>@<host>:5432/postgres?sslmode=require
```

## Step 1: Capture Current Production Evidence

Do not change anything before collecting the current evidence.

### 1A. Capture the startup DB config line from Render logs

Look for this exact prefix:

```text
DATABASE STARTUP CONFIG host=
```

Record the full line.

Expected shape:

```text
DATABASE STARTUP CONFIG host=<host> name=<name> user=<user>
```

### 1B. Capture the health-check traceback

Look for these exact markers in Render logs:

```text
HEALTH CHECK FAILURE
ECIRCUITBREAKER
```

Save at least one full traceback block showing the failing `connection.cursor()` call.

## Step 2: Determine the Active Credential Source

Use the startup log captured in Step 1.

### Branch A: `SUPABASE_DB_URL` branch is active

If the startup log shows:

```text
host=aws-0-eu-north-1.pooler.supabase.com
name=postgres
user=postgres.<project-ref>
```

then Render is using `SUPABASE_DB_URL`, and the username is correct but the embedded password is invalid or stale.

### Branch B: Fallback `DB_*` branch is active

If the startup log shows:

```text
user=postgres
```

then Render is not using the intended Supabase URL branch and Django is falling through to the fallback `DB_USER` path.

## Step 3: Correct Production Credentials Only

### 3A. Reset the database password in Supabase

In the Supabase project:

1. Open database settings.
2. Reset the Postgres password.
3. Copy the newly generated full connection string for the transaction pooler.

Required format:

```text
postgresql://postgres.<project-ref>:<password>@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### 3B. Replace `SUPABASE_DB_URL` in Render

In the Render backend service:

1. Open Environment.
2. Replace the full value of `SUPABASE_DB_URL`.
3. Do not update only a separate password variable.
4. Save changes.

### 3C. Remove conflicting fallback variables if present

If the Render environment contains any of the following, remove them unless intentionally required elsewhere:

- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`

This step is only to prevent future fallback ambiguity.

## Step 4: Redeploy and Wait for the Circuit Breaker to Clear

1. Trigger a manual deploy in Render after saving the updated environment.
2. Wait for the deployment to restart with the new runtime environment.
3. Allow time for the Supabase pooler to clear the temporary authentication block.

## Step 5: Verify the Remediation

### 5A. Confirm startup DB config

Capture the new startup line and verify it shows:

```text
host=aws-0-eu-north-1.pooler.supabase.com
name=postgres
user=postgres.<project-ref>
```

### 5B. Confirm `/health/` is healthy

Request:

```text
GET /health/
```

Pass condition:

```json
{
  "status": "healthy",
  "message": "Django backend is running",
  "database": "connected"
}
```

Expected status: `200 OK`

### 5C. Confirm error disappearance in logs

Render logs must not show any of the following after the successful deploy:

- `HEALTH CHECK FAILURE`
- `password authentication failed`
- `ECIRCUITBREAKER`
- `django.db.utils.OperationalError`

## Step 6: Remove Temporary Diagnostics After Recovery

Only after `/health/` remains healthy:

1. Remove the temporary traceback logging from `skooltrack_pro/urls.py`.
2. Remove the temporary startup DB config logging from `skooltrack_pro/settings.py`.
3. Redeploy once more.
4. Re-check `/health/` and `/api/health/`.

## Evidence Capture Template

Copy this block into the incident log once the procedure is complete.

```text
render_supabase_auth_incident_record
timestamp_utc: <TIMESTAMP_UTC>
service: academic-compass-api
startup_log_before: <FULL_STARTUP_LINE>
health_trace_before: <SHORT_TRACE_REFERENCE>
active_branch_before: SUPABASE_DB_URL | DB_FALLBACK
credential_action: reset_supabase_password_and_replace_full_url
startup_log_after: <FULL_STARTUP_LINE>
health_status_after: 200 | 500
health_body_after: <BODY>
error_markers_after: none | <LIST>
final_result: PASS | FAIL
notes: <FREEFORM>
```

## Decision Rule

Mark the incident resolved only if all three conditions hold:

1. Startup log shows the expected Supabase host and username.
2. `GET /health/` returns `200 OK`.
3. Render logs no longer show authentication or `ECIRCUITBREAKER` errors.

# Production Term-Close Repair Runbook

- status: Ready for production execution
- repair_mechanism: Existing `force=true` rerun path
- owner: Finance or engineering operator with production access

## Purpose

Use this runbook to repair affected production term-close periods by rerunning the existing rollover endpoint with `force=true`.

This is the supported repair path implemented in [apps/fees/finance_views.py](../apps/fees/finance_views.py).

## Preconditions

Complete all items before running the repair:

1. Confirm you are connected to the production environment, not local or staging.
2. Confirm a production backup or point-in-time recovery option is available.
3. Confirm the deployment containing the remediation code is already live.
4. Confirm you have an authenticated finance-authorized production user for the affected school.
5. Fill in all placeholders in this document before executing commands.

## Placeholders

Replace every placeholder below before execution.

```text
<PROD_BASE_URL>         Example: https://app.example.com
<AUTH_TOKEN>            Production bearer token for an authorized finance user
<SCHOOL_ID>             School being repaired
<YEAR>                  Source year to repair
<TERM>                  Source term to repair
<TARGET_YEAR>           Expected carry-forward year
<TARGET_TERM>           Expected carry-forward term
<PERIOD_ID>             Period id returned by the repair or found in verification
<DB_HOST>               Production database host
<DB_PORT>               Production database port
<DB_NAME>               Production database name
<DB_USER>               Production database user
```

## Step 1: Identify the Affected Period

Record the exact period you are repairing.

```text
school_id   = <SCHOOL_ID>
source_year = <YEAR>
source_term = <TERM>
target_year = <TARGET_YEAR>
target_term = <TARGET_TERM>
```

If you already know the period id, record it. Otherwise obtain it during the verification queries below.

## Step 2: Dry Verification Before Repair

Run these checks before the repair and save the output.

### 2A. API preview check

```bash
curl --request GET "<PROD_BASE_URL>/api/finance/term-close/preview/?year=<YEAR>&term=<TERM>" \
  --header "Authorization: Bearer <AUTH_TOKEN>"
```

### 2B. Database period check

```sql
SELECT id, school_id, year, term, target_year, target_term, status, rows_processed, started_at, closed_at
FROM fees_term_close_period
WHERE school_id = <SCHOOL_ID>
  AND year = <YEAR>
  AND term = <TERM>;
```

### 2C. Database conversion-detail check

```sql
SELECT period_id, student_id, source_vote_head_id, source_closing_balance, target_type, target_amount
FROM fees_term_close_conversion_detail
WHERE period_id = <PERIOD_ID>
ORDER BY student_id, target_type, source_vote_head_id;
```

### 2D. Database target-balance check

```sql
SELECT fb.student_id, vh.name AS vote_head, fb.year, fb.term, fb.opening_balance, fb.amount_invoiced, fb.amount_paid, fb.closing_balance
FROM fees_feebalance fb
JOIN fees_votehead vh ON vh.id = fb.vote_head_id
WHERE fb.school_id = <SCHOOL_ID>
  AND fb.year = <TARGET_YEAR>
  AND fb.term = <TARGET_TERM>
  AND vh.name IN ('Arrears', 'Prepayment')
ORDER BY fb.student_id, vh.name;
```

## Step 3: Execute the Repair

Run one period at a time.

### Option A: Production API call

```bash
curl --request POST "<PROD_BASE_URL>/api/finance/term-close/rollover/" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer <AUTH_TOKEN>" \
  --data '{"year": <YEAR>, "term": <TERM>, "force": true}'
```

Expected success shape:

```json
{
  "detail": "Term close and rollover completed.",
  "period_id": <PERIOD_ID>,
  "source_period": {"year": <YEAR>, "term": <TERM>},
  "target_period": {"year": <TARGET_YEAR>, "term": <TARGET_TERM>},
  "rows_processed": <ROWS_PROCESSED>
}
```

### Option B: Production Django shell call

Use this only if you are operating inside the production application environment.

```python
from rest_framework.test import APIClient
from apps.users.models import User

client = APIClient()
user = User._base_manager.get(email="<AUTHORIZED_USER_EMAIL>")
client.force_authenticate(user)

response = client.post(
    "/api/finance/term-close/rollover/",
    {"year": <YEAR>, "term": <TERM>, "force": True},
    format="json",
)

print(response.status_code)
print(response.data)
```

## Step 4: Immediate Post-Repair Verification

Run all of these checks after the repair and save the output.

### 4A. Conversion report API check

```bash
curl --request GET "<PROD_BASE_URL>/api/finance/term-close/conversion-report/?year=<YEAR>&term=<TERM>" \
  --header "Authorization: Bearer <AUTH_TOKEN>"
```

### 4B. Period status check

```sql
SELECT id, school_id, year, term, target_year, target_term, status, rows_processed, started_at, closed_at
FROM fees_term_close_period
WHERE school_id = <SCHOOL_ID>
  AND year = <YEAR>
  AND term = <TERM>;
```

Pass conditions:

```text
status = CLOSED
closed_at is not null
target_year = <TARGET_YEAR>
target_term = <TARGET_TERM>
```

### 4C. Conversion-detail completeness check

```sql
SELECT period_id, student_id, source_vote_head_id, source_closing_balance, target_type, target_amount
FROM fees_term_close_conversion_detail
WHERE period_id = <PERIOD_ID>
ORDER BY student_id, target_type, source_vote_head_id;
```

Pass conditions:

```text
1. Positive source balances have ARREARS rows.
2. Negative source balances have PREPAYMENT rows.
3. Mixed-sign source sets produce both target types where expected.
```

### 4D. Target-balance existence check

```sql
SELECT fb.student_id, vh.name AS vote_head, fb.year, fb.term, fb.opening_balance, fb.amount_invoiced, fb.amount_paid, fb.closing_balance
FROM fees_feebalance fb
JOIN fees_votehead vh ON vh.id = fb.vote_head_id
WHERE fb.school_id = <SCHOOL_ID>
  AND fb.year = <TARGET_YEAR>
  AND fb.term = <TARGET_TERM>
  AND vh.name IN ('Arrears', 'Prepayment')
ORDER BY fb.student_id, vh.name;
```

Pass conditions:

```text
1. Arrears rows exist for carried-forward positive balances.
2. Prepayment rows exist for carried-forward negative balances.
3. Closing balances match the carried-forward amounts.
```

## Step 5: Reconciliation Queries

Use these SQL checks to confirm source-to-target conservation.

### 5A. Source totals by sign

```sql
SELECT
  student_id,
  SUM(CASE WHEN closing_balance > 0 THEN closing_balance ELSE 0 END) AS source_positive_total,
  SUM(CASE WHEN closing_balance < 0 THEN closing_balance ELSE 0 END) AS source_negative_total
FROM fees_feebalance
WHERE school_id = <SCHOOL_ID>
  AND year = <YEAR>
  AND term = <TERM>
GROUP BY student_id
ORDER BY student_id;
```

### 5B. Converted totals by target type

```sql
SELECT
  student_id,
  SUM(CASE WHEN target_type = 'ARREARS' THEN target_amount ELSE 0 END) AS arrears_total,
  SUM(CASE WHEN target_type = 'PREPAYMENT' THEN target_amount ELSE 0 END) AS prepayment_total
FROM fees_term_close_conversion_detail
WHERE period_id = <PERIOD_ID>
GROUP BY student_id
ORDER BY student_id;
```

### 5C. Target brought-forward totals

```sql
SELECT
  fb.student_id,
  SUM(CASE WHEN vh.name = 'Arrears' THEN fb.closing_balance ELSE 0 END) AS target_arrears_balance,
  SUM(CASE WHEN vh.name = 'Prepayment' THEN ABS(fb.closing_balance) ELSE 0 END) AS target_prepayment_balance
FROM fees_feebalance fb
JOIN fees_votehead vh ON vh.id = fb.vote_head_id
WHERE fb.school_id = <SCHOOL_ID>
  AND fb.year = <TARGET_YEAR>
  AND fb.term = <TARGET_TERM>
  AND vh.name IN ('Arrears', 'Prepayment')
GROUP BY fb.student_id
ORDER BY fb.student_id;
```

Expected interpretation:

```text
source_positive_total == arrears_total == target_arrears_balance
ABS(source_negative_total) == prepayment_total == target_prepayment_balance
```

## Step 6: Rollback Decision Rule

Stop and escalate immediately if any of the following occur:

1. The API returns a non-200 response.
2. The period ends in `FAILED` or remains in `CLOSING`.
3. Conversion-detail rows are still missing after the rerun.
4. Target `Arrears` or `Prepayment` balances are still missing.
5. Source-to-target conservation does not hold.

If rollback is required:

1. Stop further repairs.
2. Preserve the failing API response and SQL outputs.
3. Use the production backup or PITR process defined by your infra team.
4. Re-run the verification queries after restore.

## Step 7: Evidence Capture Template

Copy this block into your incident log or deployment notes and fill it in.

```text
production_term_close_repair_record
timestamp_utc: <TIMESTAMP_UTC>
operator: <OPERATOR_NAME>
environment: production
school_id: <SCHOOL_ID>
source_period: (<YEAR>, <TERM>)
target_period: (<TARGET_YEAR>, <TARGET_TERM>)
period_id: <PERIOD_ID>
api_status_code: <STATUS_CODE>
api_response: <RESPONSE_JSON>
precheck_summary: <SHORT_SUMMARY>
postcheck_summary: <SHORT_SUMMARY>
conservation_result: PASS | FAIL
final_result: PASS | FAIL
notes: <FREEFORM_NOTES>
```

## Step 8: Gate Re-Run After Repair

After all affected periods are repaired:

1. Re-run the production readiness gate.
2. Re-check migration state and schema drift on production.
3. Update [docs/finance_audit_execution_log.md](d:/Software%20development/academic-compass-kenya-main/docs/finance_audit_execution_log.md) with the production outputs.
4. Do not mark production safe until the repaired periods and schema checks both pass.

## Quick Copy Block

Use this condensed block if you only need the core commands.

```bash
# 1. Preview
curl --request GET "<PROD_BASE_URL>/api/finance/term-close/preview/?year=<YEAR>&term=<TERM>" \
  --header "Authorization: Bearer <AUTH_TOKEN>"

# 2. Repair
curl --request POST "<PROD_BASE_URL>/api/finance/term-close/rollover/" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer <AUTH_TOKEN>" \
  --data '{"year": <YEAR>, "term": <TERM>, "force": true}'

# 3. Conversion report
curl --request GET "<PROD_BASE_URL>/api/finance/term-close/conversion-report/?year=<YEAR>&term=<TERM>" \
  --header "Authorization: Bearer <AUTH_TOKEN>"
```
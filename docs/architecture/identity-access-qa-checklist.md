# Identity and Access QA Checklist

## Purpose
This checklist maps IAM architecture contracts to concrete validation cases for regression and release readiness.

## Preconditions
- Test environment has Supabase and backend connectivity configured.
- At least two schools exist for tenant-isolation validation.
- Test users exist for platform staff, school admin, teacher or staff entity, and non-privileged user.

## User Lifecycle
- Validate enable login transitions account to an active lifecycle path.
- Validate disable login sets login_enabled false and status DISABLED.
- Validate expired account is denied and marked EXPIRED where applicable.
- Validate last active school admin cannot be disabled, expired, or deleted.

## Entity Linkage
- Validate one entity can be linked to only one account.
- Validate second enable call for same entity returns conflict behavior.
- Validate entity_type and entity_id validation rejects incomplete linkage payloads.

## Authentication
- Validate valid Supabase bearer token authenticates through Django backend.
- Validate request is denied when local user is missing for Supabase identity.
- Validate disabled and inactive users are denied.
- Validate expiry gate denies access and updates local account state.

## Authorization
- Validate school admin can manage users only in same school.
- Validate school admin cannot manage platform-level accounts.
- Validate platform staff can perform platform-scope operations.
- Validate cross-school enable, disable, and role-change attempts are denied.

## Supabase Responsibilities
- Validate provisioning sync creates or updates Supabase auth user.
- Validate disable workflow attempts Supabase session revocation.
- Validate auth introspection endpoint is used for bearer token validation path.

## Email Responsibilities
- Validate invite or welcome communication trigger on provisioning path when enabled.
- Validate reset password triggers temporary credential flow and force change flag.
- Validate resend login details triggers communication and does not bypass permission checks.

## Audit Logging
- Validate ENABLE_LOGIN event emitted with actor, target, school, and timestamp.
- Validate DISABLE_LOGIN event emitted with actor and target context.
- Validate ROLE_CHANGE event includes old_role and new_role metadata.
- Validate PASSWORD_RESET and INVITE_SENT actions are captured where invoked.

## Login History
- Validate successful login activity appears in login history endpoint.
- Validate login history includes ip_address and user_agent where available.
- Validate ordering is newest first.

## Password Lifecycle
- Validate temporary password generation during reset or resend paths.
- Validate force_password_change is set after reset or resend operations.
- Validate complete-first-login flow clears first-login password requirement.

## API Design and Error Semantics
- Validate tenant-aware listing behavior for school and platform scopes.
- Validate dedicated disable endpoints work for both user-id and entity routes.
- Validate dedicated assign-role endpoint updates role and returns success payload.
- Validate 409 conflict for entity already linked and last-admin disable attempts.
- Validate 404 for missing user or missing linked account in resource flows.
- Validate 400 for payload and business validation failures.

## Recommended Minimal Regression Set
- Enable login happy path for teacher entity.
- Disable login by user id happy path.
- Disable login by entity path happy path.
- Assign role happy path with audit metadata check.
- Cross-tenant denial for school admin.
- Last-admin guard rejection.
- Login-history endpoint retrieval.
- Reset password path with force change flag assertion.

## Evidence Capture
For each executed case, capture:
- Request payload
- Response code and body
- Relevant audit log entry id
- Relevant login history row id where applicable
- Test actor role and school scope

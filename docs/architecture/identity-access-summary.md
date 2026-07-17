# Identity and Access Architecture Summary

## Executive Summary
The Identity and Access Management architecture is now documented as a single baseline that aligns audited behavior with current implementation contracts. The model uses Supabase for identity and sessions, and Django for tenant-aware authorization, lifecycle policy, and audit traceability.

## Why This Matters
- Reduces ambiguity across backend, frontend, and operations teams.
- Prevents regression to overloaded account workflows by preserving dedicated endpoint contracts.
- Establishes a shared language for lifecycle status, role management, and security event capture.

## Key Decisions
- Supabase is the identity and session authority.
- Django service layer is the authorization and policy enforcement authority.
- Account-to-entity linkage is explicit through entity_type and entity_id.
- Email is the primary user-facing identifier; auth_user_id is the cross-system identity key.
- Last active school admin protection is a hard policy control.

## Core Risk Controls Captured
- Tenant isolation for school-scoped account management.
- Explicit conflict handling for already-linked entities.
- Dedicated disable and assign-role endpoints.
- Session revocation on disable.
- Audit event requirements for sensitive IAM actions.
- Login history requirements for operational forensics.

## Operational Impact
- Support and admin teams can diagnose IAM issues faster using a common contract.
- QA teams can test against explicit API semantics and lifecycle expectations.
- Future IAM changes can be reviewed against this baseline for compatibility and security impact.

## Primary Reference
- Baseline architecture: docs/architecture/identity-access.md

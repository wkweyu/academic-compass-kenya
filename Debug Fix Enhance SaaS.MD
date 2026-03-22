Debug + Fix + Enhance SaaS Admin Platform
The system already has:

SaaS admin platform
school onboarding
platform user management (partially implemented)
school deletion logic (partially implemented)

Your task is to:

DEBUG and FIX onboarding hanging issue
FIX and COMPLETE platform user management
DEBUG and FIX school deletion issue
DO NOT break existing working features
REUSE existing logic before creating new code
❗ GLOBAL RULES (STRICT)

Follow these rules:

DO NOT rewrite existing modules unless necessary
ALWAYS search for existing functions before adding new ones
ADD logging before fixing bugs
USE database transactions for critical operations
DO NOT duplicate models or services
PRESERVE multi-tenancy (school_id logic)
FIX root causes — not UI symptoms
ALL fixes must be traceable via logs
🧩 ISSUE 1 — Onboarding Hangs at "Creating"
Problem

When clicking "Onboard School", the system hangs at:

creating...

No completion, no error shown.

Step 1 — Debug First (MANDATORY)

Before fixing, do:

Add logging to onboarding flow:

Search for:

onboard_school()
create_school()
provision_school()

Add logs:

logger.info("Step 1: Creating school record")


✔ remain stable and scalable

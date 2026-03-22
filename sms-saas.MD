School Management System - Process Flow Implementation Guide
🎯 Overview

Refactor and enhance the existing School Management SaaS Admin Platform

You are working on an existing multi-tenant SaaS system.

### Critical Rules

1.  DO NOT break existing functionality
2.  REUSE existing models, services, and routes where possible
3.  EXTEND instead of rewriting
4.  ENSURE all queries enforce `school_id`
5.  USE transactions for critical operations
6.  LOG all actions in ActivityLog
7.  FOLLOW modular architecture (services layer)

🔄 PROCESS FLOW 1: Lead-to-School Conversion Flow
Current State

    Leads exist but cannot be properly converted to schools

    Missing the handshake between Lead and School records

    No onboarding initialization when school is created

What Needs to Happen
1.1 Lead Conversion Process

When a staff member clicks "Convert to School" on a lead:
typescript

/*
INSTRUCTIONS FOR AI:

Create a service function that:
1. Takes a leadId and staffId
2. Validates the lead can be converted (not already converted)
3. Updates the associated School record:
   - Changes status from 'LEAD' to 'ONBOARDING'
   - Sets convertedAt timestamp
   - Adds conversion metadata
4. Creates an OnboardingProgress record for this school
5. Creates initial onboarding tasks:
   - Task 1: "Complete basic school information" (assign to same staff)
   - Task 2: "Set up school admin account" (assign to same staff)
   - Task 3: "Schedule training call" (due in 3 days)
6. Logs the conversion in ActivityLog
7. Returns the updated school and onboarding progress

Use a database transaction to ensure all steps succeed or fail together.
*/

1.2 Lead Stage Transitions

Allow dragging leads through pipeline stages:
typescript

/*
INSTRUCTIONS FOR AI:

Create a function that handles lead stage changes:
1. Define valid stage transitions:
   NEW → CONTACTED → DEMO_SCHEDULED → DEMO_COMPLETED → NEGOTIATION → CONTRACT_SENT → WON
   Any stage → LOST (with reason required)
   
2. When stage changes:
   - If moving to WON: Auto-convert to school (call function above)
   - If moving to LOST: Require loss reason, set lostAt
   - If moving to DEMO_SCHEDULED: Create calendar task
   
3. Update school status to match lead stage:
   - WON → School status ONBOARDING
   - LOST → School status CHURNED (with reason)
   - Others → School status LEAD
   
4. Create activity log entry
*/

1.3 Lead Assignment Rules

Auto-assign leads to available staff:
typescript

/*
INSTRUCTIONS FOR AI:

Create an auto-assignment function that:
1. When a lead is created without assignedToId:
   - Check lead source and priority
   - Find staff with role 'SALES_REP' who have:
     * Fewer than 50 active leads
     * Last assignment was oldest (round-robin)
   - If no sales reps available, assign to MANAGER with alert

2. When lead stage changes:
   - DEMO_COMPLETED → Check if should reassign to ONBOARDING_SPECIALIST
   - WON → Auto-reassign to ONBOARDING_SPECIALIST

3. Send notification to assigned staff:
   - In-app notification
   - Optional: Email if configured
*/

🔄 PROCESS FLOW 2: School Onboarding Flow
Current State

    Schools can be created but onboarding steps aren't tracked

    No progress tracking or task management

    Missing handoff process

What Needs to Happen
2.1 Onboarding Step Progression
typescript

/*
INSTRUCTIONS FOR AI:

Create an onboarding step management system:

Define 7 required steps:
1. BASIC_INFO: School details, address, contact
2. PLAN_SELECTION: Choose plan, set limits
3. ADMIN_SETUP: Create school admin accounts
4. DATA_IMPORT: Upload students/teachers/classes
5. CONFIGURATION: Academic calendar, grading
6. TRAINING: Staff trains school admin
7. HANDBOOK: Final review and go-live

Create a function to process each step:
- Validate step can be completed (previous steps done)
- Save step data to school.details or appropriate tables
- Mark step as completed in OnboardingProgress
- Determine next step based on completed steps
- If step requires staff action, create task
- Log completion

Create a function to get onboarding progress:
- Return current step
- Show completed steps with checkmarks
- Calculate percentage complete
- List pending tasks for current step
- Identify any blockers
*/

2.2 Onboarding Tasks
typescript

/*
INSTRUCTIONS FOR AI:

Create a task management system for onboarding:

When onboarding starts, create these default tasks:
1. "Verify school contact information" (due in 2 days)
2. "Schedule admin account creation call" (due in 3 days)
3. "Send data import template" (due in 4 days)
4. "Review imported data for accuracy" (due in 7 days)
5. "Schedule training session" (due in 10 days)

Task features needed:
- Staff can create custom tasks for any onboarding
- Tasks can be assigned to specific staff members
- Due dates with overdue highlighting
- Status: PENDING, IN_PROGRESS, COMPLETE, BLOCKED
- Blocked tasks require a reason and notify manager
- When all tasks for a step are complete, auto-advance step

Create a dashboard view showing:
- Tasks assigned to current staff
- Tasks overdue
- Tasks by school
- Completion timeline
*/

2.3 Onboarding Handoff
typescript

/*
INSTRUCTIONS FOR AI:

Create the handoff process when onboarding completes:

When staff clicks "Complete Onboarding":

1. Validate all required steps are done:
   - All 7 steps marked complete
   - No pending required tasks
   - School admin has logged in at least once

2. Update records:
   - School status from ONBOARDING to ACTIVE
   - Set goLiveDate in school.details
   - OnboardingProgress.handedOverToSchoolAt = now()
   - OnboardingProgress.handedOverByStaffId = current staff

3. Transfer school assignment:
   - If different staff for account management, transfer
   - Otherwise keep same staff as account manager

4. Send notifications:
   - To school admin: "Your school is now live!"
   - To account manager: "New school ready for account management"
   - To onboarding staff: "Handoff complete"

5. Schedule follow-ups:
   - 7-day check-in: "How's the first week going?"
   - 30-day business review
   - 90-day renewal discussion

6. Create handoff summary:
   - Include completed steps
   - List any pending optional items
   - Notes from onboarding staff
   - Link to training materials
*/

🔄 PROCESS FLOW 3: Staff Assignment & Transfer Flow
Current State

    Schools have assigned staff but no transfer process

    No workload balancing

    Missing handoff procedures

What Needs to Happen
3.1 Staff Workload Management
typescript

/*
INSTRUCTIONS FOR AI:

Create workload tracking for staff:

Define capacity limits by role:
- SALES_REP: Max 50 active leads
- ONBOARDING_SPECIALIST: Max 10 active onboardings
- ACCOUNT_MANAGER: Max 100 active schools
- MANAGER: No limit (oversight only)

Create functions to:
1. Get current workload for a staff member:
   - Count leads by stage
   - Count active onboardings
   - Count active schools
   - Calculate percentage of capacity used

2. Check if staff can accept new assignment:
   - Compare current counts against limits
   - Return true/false with reason

3. Find available staff for assignment:
   - By role
   - With lowest current load
   - Who haven't been assigned recently (fair distribution)

4. Alert managers when staff exceed 80% capacity
5. Auto-reassign when staff leaves or goes on leave
*/

3.2 School Transfer Process
typescript

/*
INSTRUCTIONS FOR AI:

Create a school transfer process:

When staff initiates transfer of a school:

1. Validate transfer is allowed:
   - Staff has permission to transfer
   - Target staff exists and is active
   - Target staff has capacity for this school

2. Show transfer wizard:
   - Step 1: Select target staff
   - Step 2: Choose transfer reason:
     * Workload balancing
     * Role change (sales → onboarding → account mgmt)
     * Staff departure
     * Specialization (e.g., K-12 specialist)
   - Step 3: Add transfer notes
   - Step 4: Select what to transfer:
     * All school data (default)
     * Active tasks (option to reassign or close)
     * Communication history

3. Execute transfer:
   - Update school.assignedStaffId
   - Add transfer record to school.details.transfers[]
   - Reassign open tasks to new staff (or close with note)
   - Create handoff notification for both staff
   - Schedule introduction call if requested

4. Log transfer with full audit trail:
   - Who initiated
   - From staff, to staff
   - Reason and notes
   - Timestamp
   - What was transferred
*/

3.3 Staff Role Changes
typescript

/*
INSTRUCTIONS FOR AI:

Handle staff role changes:

When staff role is updated (e.g., Sales Rep → Onboarding Specialist):

1. Check current assignments:
   - List all schools/leads currently assigned
   - Flag those that don't match new role
   - Example: Sales Rep has active onboardings (should transfer)

2. Offer options:
   - Auto-reassign mismatched items to appropriate staff
   - Keep some with manager approval
   - Complete current work before role change

3. Update permissions based on new role:
   - Sales: Can create leads, view pipeline
   - Onboarding: Full access during onboarding, view after
   - Account Manager: View all, manage billing, support
   - Manager: Everything + staff management

4. Notify affected parties:
   - Schools with changed account manager
   - Team members
   - Manager for approval if needed

5. Create audit log of role change
*/

🔄 PROCESS FLOW 4: School Health Monitoring
Current State

    No visibility into school engagement

    Can't identify at-risk schools

    Missing renewal/upsell triggers

What Needs to Happen
4.1 Health Score Calculation
typescript

/*
INSTRUCTIONS FOR AI:

Create a school health scoring system:

Calculate health score (0-100) based on:

Engagement Metrics (40%):
- Days since last login (0-30 days = 100%, 30-60 = 50%, 60+ = 0%)
- Active users / total users ratio
- Features used vs available
- Support ticket volume (too many = low, none = medium)

Data Completeness (30%):
- Student records complete
- Teacher profiles complete
- Classes/sections created
- Attendance being recorded
- Grades being entered

Payment Health (20%):
- Payment status (active = 100%, past_due = 50%, canceled = 0%)
- Days until renewal
- Payment method valid

Account Health (10%):
- Has designated school admin
- Admin logged in recently
- Training completed

Create functions to:
1. Calculate score for a school daily (cron job)
2. Store historical scores for trending
3. Identify patterns: improving, declining, stable

Create alerts:
- Score < 50: At-risk, notify account manager
- Score dropped 20+ points in 30 days: Investigate
- Score > 90: Happy customer, upsell opportunity
*/

4.2 Churn Prediction & Prevention
typescript

/*
INSTRUCTIONS FOR AI:

Create churn prevention system:

Identify at-risk schools based on:
- Health score below 50 for 7+ days
- No logins for 30+ days
- Payment failures
- Support tickets about cancellation
- Competitor mentions in communications
- Contract end date approaching

When school is at-risk:

1. Notify account manager immediately
2. Create "Retention Task" for account manager:
   - Task: "Contact school regarding low engagement"
   - Due in 2 days
   - Priority: High

3. Track interventions:
   - What actions taken
   - School response
   - Follow-up scheduled
   - Outcome

4. Escalate if no improvement:
   - After 2 weeks: Notify manager
   - After 1 month: Consider downgrade/suspension

5. If churn happens:
   - Record churn reason
   - Offer survey
   - Schedule retention follow-up (30/60/90 days)
   - Archive data appropriately
*/

4.3 Upsell Opportunities
typescript

/*
INSTRUCTIONS FOR AI:

Identify upsell opportunities:

Monitor for triggers:

Plan Limit Triggers:
- Students approaching 90% of plan limit
- Teachers at limit
- Storage usage high
- Feature usage suggests need for upgrade

Feature Adoption Triggers:
- Using basic attendance, could use advanced
- Manual grade entry, could use auto-calculation
- No parent app usage (could upsell parent portal)

Timing Triggers:
- 60 days before renewal
- After successful training completion
- After positive support interaction

When trigger detected:

1. Create opportunity record:
   - School ID
   - Trigger type
   - Recommended action
   - Estimated value
   - Priority (1-5)

2. Notify account manager:
   - Show in dashboard
   - Add to weekly report
   - Flag as "quick win" if high probability

3. Track progress:
   - Contact made
   - Proposal sent
   - Negotiation
   - Won/Lost with reason

4. If won, trigger provisioning:
   - Update plan limits
   - Enable new features
   - Update billing
   - Send welcome to new features
*/

🔄 PROCESS FLOW 5: Communication & Notification Flow
Current State

    No structured communication tracking

    Missing notification templates

    No follow-up scheduling

What Needs to Happen
5.1 Communication Log
typescript

/*
INSTRUCTIONS FOR AI:

Create a communication logging system:

For each school, track all communications:

Types:
- Email (sent/received)
- Call (with notes)
- Meeting (with agenda, attendees)
- Note (internal only)
- Task (related to communication)

When logging communication:

1. Capture:
   - Type
   - Date/time
   - Participants (staff, school contact)
   - Subject/summary
   - Details/content
   - Attachments (if any)
   - Follow-up required? (yes/no)
   - Follow-up date

2. Associate with:
   - School
   - Lead (if before conversion)
   - Specific task or onboarding step
   - Deal/opportunity

3. Make searchable:
   - By date range
   - By staff member
   - By keyword
   - By school

4. Create timeline view:
   - Chronological list
   - Color-coded by type
   - Expandable details
   - Filterable
*/

5.2 Notification Templates
typescript

/*
INSTRUCTIONS FOR AI:

Create a notification template system:

Define templates for common scenarios:

Lead/Pre-Sales:
- "New lead assigned to you" (staff)
- "Demo scheduled for [School]" (staff)
- "Lead stage changed to [Stage]" (staff)
- "Lead converted to school" (staff)

Onboarding:
- "Onboarding started for [School]" (staff)
- "Step [Step] completed" (staff)
- "Task assigned: [Task]" (staff)
- "Task overdue: [Task]" (staff)
- "Onboarding complete - ready for handoff" (staff + school admin)
- "Welcome to [Platform]!" (school admin)

Account Management:
- "School health score dropped" (staff alert)
- "Upsell opportunity detected" (staff)
- "Renewal approaching in 30 days" (staff + school admin)
- "Payment failed" (school admin + staff)
- "New support ticket" (staff)

System:
- "Staff role changed" (staff)
- "School transferred to you" (staff)
- "Daily summary: Your tasks" (staff)
- "Weekly report: Your schools" (staff)

Template features:
- Variables: {{schoolName}}, {{staffName}}, {{taskName}}, etc.
- Multiple channels: in-app, email, SMS (optional)
- Scheduling: immediate, digest, specific time
- Preview before sending
- Edit before sending (for manual sends)

Create a function to send notification:
1. Get template by key
2. Replace variables with actual data
3. Check recipient preferences (email on/off)
4. Create notification record
5. Send via selected channels
6. Track delivery and open rates
*/

5.3 Follow-up Scheduling
typescript

/*
INSTRUCTIONS FOR AI:

Create a follow-up scheduling system:

Automatic follow-ups based on triggers:

Lead Stage Triggers:
- After demo: "Follow up in 2 days"
- After proposal sent: "Follow up in 5 days if no response"
- After lost: "Follow up in 90 days for re-engagement"

Onboarding Triggers:
- After data import: "Check data quality in 2 days"
- After training: "Follow up in 7 days on usage"
- After handoff: "30-day business review"

Account Triggers:
- Low health score: "Weekly check-in"
- High health score: "Quarterly business review"
- 60 days pre-renewal: "Start renewal discussion"

Manual follow-ups:
- Staff can create custom follow-ups
- Set date/time
- Set recurrence (daily, weekly, monthly)
- Assign to self or other staff

When follow-up is due:

1. Create notification for assigned staff
2. Show in dashboard "Today's Follow-ups"
3. Allow snooze (1 day, 3 days, 1 week)
4. Track completion
5. If missed, escalate to manager after 3 days

Follow-up templates:
- Quick call: "Checking in on [School]"
- Data review: "Review [Metric] for [School]"
- Renewal: "Discuss renewal options for [School]"
- Custom: Staff-written
*/

✅ IMPLEMENTATION PRIORITY
Phase 1 (Week 1-2) - Core Flows

    Lead-to-School conversion with transaction

    Onboarding step progression (basic)

    Task creation for onboarding

Phase 2 (Week 3-4) - Staff Management

    Staff workload tracking

    School transfer process

    Role-based permissions

Phase 3 (Week 5-6) - Monitoring

    Health score calculation

    At-risk identification

    Upsell opportunity detection

Phase 4 (Week 7-8) - Communication

    Communication log

    Notification templates

    Follow-up scheduling

🎯 SUCCESS CRITERIA

After implementation, you should be able to:

    Convert a lead to a school in one click, with onboarding automatically created

    Track a school through 7 onboarding steps with clear progress

    Transfer a school between staff with full audit trail

    See health scores for all schools with at-risk alerts

    Log all communications and schedule follow-ups

    Receive notifications for important events

📝 FOR THE AI: IMPLEMENTATION APPROACH

When generating code for each flow:

    Start with the data model - Ensure Prisma schema supports the flow

    Create the service function - Core business logic with transactions

    Add validation - Check permissions, data integrity, business rules

    Implement logging - Every action recorded in ActivityLog

    Add notifications - Alert relevant parties

    Create API endpoints - Connect to frontend

    Write basic tests - At least the happy path

Remember: Each flow should be implemented as a complete, testable unit before moving to the next.

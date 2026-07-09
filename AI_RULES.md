Business logic belongs in services, not views.
All authentication flows go through AccountService.
All Supabase operations go through SupabaseAuthService.
Only NotificationService sends email.
No duplicate API endpoints.
No hardcoded passwords.
Every account action must be audited.
New features must include tests.
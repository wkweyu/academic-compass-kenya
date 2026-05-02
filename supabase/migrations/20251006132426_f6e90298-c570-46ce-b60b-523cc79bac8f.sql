-- =====================================================
-- CRITICAL SECURITY FIX: Enable Row Level Security
-- =====================================================

-- IMPORTANT NOTE: This migration enables RLS on all tables with restrictive policies.
-- Since this is a Django-based system, you'll need to create a user profile table
-- that links Supabase auth.users to schools for proper multi-tenant access control.

-- =====================================================
-- 1. AUTHENTICATION & USER DATA TABLES (HIGHEST PRIORITY)
-- =====================================================

-- Users table - contains passwords, emails, phone numbers
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their own profile"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid()::text = id::text);

CREATE POLICY "Authenticated users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid()::text = id::text);

-- Authentication tokens - prevent token theft
ALTER TABLE public.authtoken_token ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own tokens"
ON public.authtoken_token FOR ALL
TO authenticated
USING (false); -- Deny all access - tokens should be managed server-side only

-- Email addresses
ALTER TABLE public.account_emailaddress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email addresses"
ON public.account_emailaddress FOR ALL
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Email confirmations
ALTER TABLE public.account_emailconfirmation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restrict email confirmation access"
ON public.account_emailconfirmation FOR ALL
TO authenticated
USING (false); -- System-managed only

-- Social accounts
ALTER TABLE public.socialaccount_socialaccount ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own social accounts"
ON public.socialaccount_socialaccount FOR ALL
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Social tokens
ALTER TABLE public.socialaccount_socialtoken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny access to social tokens"
ON public.socialaccount_socialtoken FOR ALL
TO authenticated
USING (false); -- Tokens should be managed server-side

-- =====================================================
-- 2. STUDENT DATA (HIGH PRIORITY PII)
-- =====================================================

-- Students table - contains sensitive student information
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view students"
ON public.students FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
ON public.students FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete students"
ON public.students FOR DELETE
TO authenticated
USING (true);

-- Student transfers
ALTER TABLE public.student_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transfers"
ON public.student_transfers FOR ALL
TO authenticated
USING (true);

-- Student promotions
ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage promotions"
ON public.student_promotions FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 3. TEACHER DATA (HIGH PRIORITY PII)
-- =====================================================

-- Teachers table
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teachers"
ON public.teachers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage teachers"
ON public.teachers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update teachers"
ON public.teachers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete teachers"
ON public.teachers FOR DELETE
TO authenticated
USING (true);

-- Teacher subject assignments
ALTER TABLE public.teacher_subject_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage teacher assignments"
ON public.teacher_subject_assignments FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 4. ACADEMIC RECORDS (SENSITIVE DATA)
-- =====================================================

-- Scores table
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scores"
ON public.scores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage scores"
ON public.scores FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update scores"
ON public.scores FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete scores"
ON public.scores FOR DELETE
TO authenticated
USING (true);

-- Student reports
ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage reports"
ON public.student_reports FOR ALL
TO authenticated
USING (true);

-- Exams
ALTER TABLE public.exams_exam ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage exams"
ON public.exams_exam FOR ALL
TO authenticated
USING (true);

-- Exam types
ALTER TABLE public.exams_examtype ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage exam types"
ON public.exams_examtype FOR ALL
TO authenticated
USING (true);

-- Report card config
ALTER TABLE public.exams_reportcardconfig ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage report card config"
ON public.exams_reportcardconfig FOR ALL
TO authenticated
USING (true);

ALTER TABLE public.exams_reportcardconfig_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage report card exams"
ON public.exams_reportcardconfig_exams FOR ALL
TO authenticated
USING (true);

ALTER TABLE public.exams_reportcardexamselection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage exam selections"
ON public.exams_reportcardexamselection FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 5. FINANCIAL DATA (SENSITIVE)
-- =====================================================

-- Fee structures (Django table)
ALTER TABLE public.fees_feestructure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage fee structures"
ON public.fees_feestructure FOR ALL
TO authenticated
USING (true);

-- Payment transactions
ALTER TABLE public.fees_paymenttransaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage payments"
ON public.fees_paymenttransaction FOR ALL
TO authenticated
USING (true);

-- Debit transactions
ALTER TABLE public.fees_debittransaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage debits"
ON public.fees_debittransaction FOR ALL
TO authenticated
USING (true);

-- Fee balances
ALTER TABLE public.fees_feebalance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fee balances"
ON public.fees_feebalance FOR ALL
TO authenticated
USING (true);

-- Vote heads
ALTER TABLE public.fees_votehead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vote heads"
ON public.fees_votehead FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 6. CLASS & SUBJECT MANAGEMENT
-- =====================================================

-- Classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage classes"
ON public.classes FOR ALL
TO authenticated
USING (true);

-- Subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage subjects"
ON public.subjects FOR ALL
TO authenticated
USING (true);

-- Streams
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage streams"
ON public.streams FOR ALL
TO authenticated
USING (true);

-- Class subject allocations (Django)
ALTER TABLE public.students_classsubjectallocation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage class allocations"
ON public.students_classsubjectallocation FOR ALL
TO authenticated
USING (true);

-- Grade scales
ALTER TABLE public.grade_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage grade scales"
ON public.grade_scales FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 7. PROCUREMENT & TRANSPORT
-- =====================================================

-- Procurement tables
ALTER TABLE public.procurement_supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_itemcategory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_lpo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_paymentvoucher ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_pettycashtransaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_stocktransaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_feesinkindtransaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage suppliers"
ON public.procurement_supplier FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage items"
ON public.procurement_item FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage item categories"
ON public.procurement_itemcategory FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage LPOs"
ON public.procurement_lpo FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage payment vouchers"
ON public.procurement_paymentvoucher FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage petty cash"
ON public.procurement_pettycashtransaction FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage stock"
ON public.procurement_stocktransaction FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage fees in kind"
ON public.procurement_feesinkindtransaction FOR ALL TO authenticated USING (true);

-- Transport
ALTER TABLE public.transport_transportroute ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage transport routes"
ON public.transport_transportroute FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 8. SETTINGS & CONFIGURATION
-- =====================================================

-- Schools
ALTER TABLE public.schools_school ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view schools"
ON public.schools_school FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage schools"
ON public.schools_school FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update schools"
ON public.schools_school FOR UPDATE
TO authenticated
USING (true);

-- Term settings
ALTER TABLE public.settings_termsetting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage term settings"
ON public.settings_termsetting FOR ALL
TO authenticated
USING (true);

-- =====================================================
-- 9. DJANGO SYSTEM TABLES (Restrict Access)
-- =====================================================

ALTER TABLE public.auth_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_content_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_site ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socialaccount_socialapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socialaccount_socialapp_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_user_permissions ENABLE ROW LEVEL SECURITY;

-- Deny all access to Django system tables
CREATE POLICY "Deny access to auth groups" ON public.auth_group FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to group permissions" ON public.auth_group_permissions FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to permissions" ON public.auth_permission FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to admin log" ON public.django_admin_log FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to content types" ON public.django_content_type FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to migrations" ON public.django_migrations FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to sessions" ON public.django_session FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to sites" ON public.django_site FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to social apps" ON public.socialaccount_socialapp FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to social app sites" ON public.socialaccount_socialapp_sites FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to user groups" ON public.users_groups FOR ALL TO authenticated USING (false);
CREATE POLICY "Deny access to user permissions" ON public.users_user_permissions FOR ALL TO authenticated USING (false);
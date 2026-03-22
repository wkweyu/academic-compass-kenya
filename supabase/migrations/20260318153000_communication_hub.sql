-- Communication Hub: announcements, system alerts, support tickets, and messaging logs

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_scope TEXT NOT NULL DEFAULT 'all' CHECK (target_scope IN ('all', 'active', 'trial', 'inactive', 'specific_schools')),
  target_school_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  audience TEXT NOT NULL DEFAULT 'all_users' CHECK (audience IN ('all_users', 'school_admins')),
  delivery_channel TEXT NOT NULL DEFAULT 'dashboard' CHECK (delivery_channel IN ('dashboard', 'email', 'sms', 'dashboard_and_email')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  link_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'support' CHECK (category IN ('support', 'billing', 'training', 'bug', 'feature_request', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_school', 'resolved', 'closed')),
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL DEFAULT 'school_admin' CHECK (sender_role IN ('school_admin', 'platform_staff', 'system')),
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_status ON public.platform_announcements(status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_school_status ON public.support_tickets(school_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id, created_at ASC);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform console can manage announcements" ON public.platform_announcements;
CREATE POLICY "Platform console can manage announcements" ON public.platform_announcements
  FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "Platform console can manage support tickets" ON public.support_tickets;
CREATE POLICY "Platform console can manage support tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "School admins can view own support tickets" ON public.support_tickets;
CREATE POLICY "School admins can view own support tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "School admins can create own support tickets" ON public.support_tickets;
CREATE POLICY "School admins can create own support tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform console can manage support ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Platform console can manage support ticket messages" ON public.support_ticket_messages
  FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "School admins can view public ticket messages" ON public.support_ticket_messages;
CREATE POLICY "School admins can view public ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    NOT is_internal
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.school_id = public.get_user_school_id()
        AND public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "School admins can add public ticket replies" ON public.support_ticket_messages;
CREATE POLICY "School admins can add public ticket replies" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_internal
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.school_id = public.get_user_school_id()
        AND public.is_admin(auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.get_active_platform_announcements()
RETURNS SETOF public.platform_announcements
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
BEGIN
  SELECT public.get_user_school_id() INTO v_school_id;

  RETURN QUERY
  SELECT announcement.*
  FROM public.platform_announcements AS announcement
  LEFT JOIN public.schools_school AS school
    ON school.id = v_school_id
  WHERE announcement.status = 'published'
    AND announcement.delivery_channel IN ('dashboard', 'dashboard_and_email')
    AND announcement.starts_at <= NOW()
    AND (announcement.expires_at IS NULL OR announcement.expires_at >= NOW())
    AND (
      announcement.audience = 'all_users'
      OR (announcement.audience = 'school_admins' AND public.is_admin(auth.uid()))
    )
    AND (
      announcement.target_scope = 'all'
      OR (announcement.target_scope = 'specific_schools' AND v_school_id = ANY(COALESCE(announcement.target_school_ids, ARRAY[]::BIGINT[])))
      OR (announcement.target_scope = 'active' AND COALESCE(school.active, FALSE) = TRUE)
      OR (announcement.target_scope = 'inactive' AND COALESCE(school.active, TRUE) = FALSE)
      OR (announcement.target_scope = 'trial' AND COALESCE(school.subscription_status, '') ILIKE '%trial%')
    )
  ORDER BY announcement.starts_at DESC, announcement.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject TEXT,
  p_description TEXT,
  p_category TEXT DEFAULT 'support',
  p_priority TEXT DEFAULT 'medium'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
  v_ticket_id BIGINT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only school admins can create support tickets';
  END IF;

  v_school_id := public.get_user_school_id();
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to determine school';
  END IF;

  INSERT INTO public.support_tickets (
    school_id,
    created_by,
    subject,
    category,
    priority,
    description,
    status,
    updated_at
  ) VALUES (
    v_school_id,
    auth.uid(),
    p_subject,
    p_category,
    p_priority,
    p_description,
    'open',
    NOW()
  ) RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_ticket_messages (
    ticket_id,
    sender_user_id,
    sender_role,
    message,
    is_internal
  ) VALUES (
    v_ticket_id,
    auth.uid(),
    'school_admin',
    p_description,
    FALSE
  );

  RETURN v_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_support_ticket_message(
  p_ticket_id BIGINT,
  p_message TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
  v_sender_role TEXT;
  v_message_id BIGINT;
  v_ticket_school_id BIGINT;
BEGIN
  SELECT school_id INTO v_ticket_school_id
  FROM public.support_tickets
  WHERE id = p_ticket_id;

  IF v_ticket_school_id IS NULL THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  IF public.can_view_platform_console(auth.uid()) THEN
    v_sender_role := 'platform_staff';
  ELSE
    v_school_id := public.get_user_school_id();
    IF v_school_id IS DISTINCT FROM v_ticket_school_id OR NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    IF p_is_internal THEN
      RAISE EXCEPTION 'School admins cannot create internal notes';
    END IF;
    v_sender_role := 'school_admin';
  END IF;

  INSERT INTO public.support_ticket_messages (
    ticket_id,
    sender_user_id,
    sender_role,
    message,
    is_internal
  ) VALUES (
    p_ticket_id,
    auth.uid(),
    v_sender_role,
    p_message,
    p_is_internal
  ) RETURNING id INTO v_message_id;

  UPDATE public.support_tickets
  SET updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN v_message_id;
END;
$$;

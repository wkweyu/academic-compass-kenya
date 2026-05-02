-- Support workflow hardening: ticket lifecycle, notifications, audit trail,
-- and controlled support impersonation sessions.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status = ANY (ARRAY['open', 'assigned', 'in_progress', 'waiting_on_school', 'resolved', 'closed']));

ALTER TABLE public.support_ticket_messages DROP CONSTRAINT IF EXISTS support_ticket_messages_sender_role_check;
ALTER TABLE public.support_ticket_messages
  ADD CONSTRAINT support_ticket_messages_sender_role_check
  CHECK (sender_role = ANY (ARRAY['school_user', 'school_admin', 'platform_staff', 'system']));

CREATE TABLE IF NOT EXISTS public.support_notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id BIGINT REFERENCES public.schools_school(id) ON DELETE CASCADE,
  ticket_id BIGINT REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_action_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  support_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id BIGINT REFERENCES public.schools_school(id) ON DELETE SET NULL,
  ticket_id BIGINT REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  affected_model TEXT NOT NULL,
  affected_record_id TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_impersonation_sessions (
  id BIGSERIAL PRIMARY KEY,
  support_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  ticket_id BIGINT REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_notifications_recipient ON public.support_notifications(recipient_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_action_audit_logs_school ON public.support_action_audit_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_action_audit_logs_user ON public.support_action_audit_logs(support_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_impersonation_sessions_active ON public.support_impersonation_sessions(support_user_id, ended_at, started_at DESC);

ALTER TABLE public.support_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_action_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_support_workspace(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.user_has_any_role(
    _user_id,
    ARRAY['platform_admin', 'support', 'account_manager']::public.app_role[]
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_support_workspace(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.user_has_any_role(
    _user_id,
    ARRAY['platform_admin', 'support']::public.app_role[]
  )
$$;

CREATE OR REPLACE FUNCTION public.log_support_action(
  p_school_id BIGINT,
  p_ticket_id BIGINT,
  p_action TEXT,
  p_affected_model TEXT,
  p_affected_record_id TEXT DEFAULT NULL,
  p_before_data JSONB DEFAULT NULL,
  p_after_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO public.support_action_audit_logs (
    support_user_id,
    school_id,
    ticket_id,
    action,
    affected_model,
    affected_record_id,
    before_data,
    after_data,
    metadata
  ) VALUES (
    auth.uid(),
    p_school_id,
    p_ticket_id,
    p_action,
    p_affected_model,
    p_affected_record_id,
    p_before_data,
    p_after_data,
    COALESCE(p_metadata, '{}'::JSONB)
  ) RETURNING id INTO v_log_id;

  INSERT INTO public.audit_logs (
    school_id,
    user_id,
    action,
    module,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    p_school_id,
    auth.uid(),
    p_action,
    'support',
    p_affected_model,
    COALESCE(p_affected_record_id, p_ticket_id::TEXT),
    p_before_data,
    COALESCE(p_after_data, '{}'::JSONB) || jsonb_build_object('metadata', COALESCE(p_metadata, '{}'::JSONB))
  );

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_notification(
  p_recipient_user_id UUID,
  p_school_id BIGINT,
  p_ticket_id BIGINT,
  p_notification_type TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notification_id BIGINT;
  v_recipient_profile_id BIGINT;
BEGIN
  INSERT INTO public.support_notifications (
    recipient_user_id,
    school_id,
    ticket_id,
    notification_type,
    message,
    metadata
  ) VALUES (
    p_recipient_user_id,
    p_school_id,
    p_ticket_id,
    p_notification_type,
    p_message,
    COALESCE(p_metadata, '{}'::JSONB)
  ) RETURNING id INTO v_notification_id;

  SELECT u.id INTO v_recipient_profile_id
  FROM public.users u
  WHERE u.auth_user_id = p_recipient_user_id
  LIMIT 1;

  IF v_recipient_profile_id IS NOT NULL AND p_school_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_recipient_profile_id
      AND u.school_id = p_school_id
  ) THEN
    INSERT INTO public.schools_notificationrecord (
      template_key,
      channel,
      subject,
      body,
      status,
      scheduled_for,
      sent_at,
      error_message,
      metadata,
      recipient_id,
      school_id,
      created_at,
      updated_at
    ) VALUES (
      'support_ticket_update',
      'in_app',
      'Support ticket update',
      p_message,
      'sent',
      NOW(),
      NOW(),
      '',
      COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object(
        'ticket_id', p_ticket_id,
        'notification_type', p_notification_type
      ),
      v_recipient_profile_id,
      p_school_id,
      NOW(),
      NOW()
    );
  END IF;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_staff_for_ticket(
  p_ticket_id BIGINT,
  p_school_id BIGINT,
  p_subject TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_support_user RECORD;
BEGIN
  FOR v_support_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('platform_admin', 'support')
  LOOP
    PERFORM public.create_support_notification(
      v_support_user.user_id,
      p_school_id,
      p_ticket_id,
      'ticket_created',
      format('New support ticket: %s', p_subject),
      jsonb_build_object('summary', p_message)
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Platform console can manage support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "School admins can view own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "School admins can create own support tickets" ON public.support_tickets;

CREATE POLICY "Support staff can view support tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.can_view_support_workspace(auth.uid()));

CREATE POLICY "Support staff can manage support tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.can_manage_support_workspace(auth.uid()))
  WITH CHECK (public.can_manage_support_workspace(auth.uid()));

CREATE POLICY "School users can view relevant support tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id()
    AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
  );

CREATE POLICY "School users can create support tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Platform console can manage support ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "School admins can view public ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "School admins can add public ticket replies" ON public.support_ticket_messages;

CREATE POLICY "Support staff can view support ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (public.can_view_support_workspace(auth.uid()));

CREATE POLICY "Support staff can add support ticket messages" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_support_workspace(auth.uid()));

CREATE POLICY "School users can view support ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    NOT is_internal
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.school_id = public.get_user_school_id()
        AND (t.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "School users can add public ticket replies" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_internal
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.school_id = public.get_user_school_id()
        AND (t.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view their own support notifications" ON public.support_notifications;
CREATE POLICY "Users can view their own support notifications" ON public.support_notifications
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() OR public.can_manage_support_workspace(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own support notifications" ON public.support_notifications;
CREATE POLICY "Users can update their own support notifications" ON public.support_notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Support workspace can manage support notifications" ON public.support_notifications;
CREATE POLICY "Support workspace can manage support notifications" ON public.support_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_support_workspace(auth.uid()));

DROP POLICY IF EXISTS "Support staff can view support action audit logs" ON public.support_action_audit_logs;
CREATE POLICY "Support staff can view support action audit logs" ON public.support_action_audit_logs
  FOR SELECT TO authenticated
  USING (public.can_manage_support_workspace(auth.uid()));

DROP POLICY IF EXISTS "Support staff can insert support action audit logs" ON public.support_action_audit_logs;
CREATE POLICY "Support staff can insert support action audit logs" ON public.support_action_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_support_workspace(auth.uid()));

DROP POLICY IF EXISTS "Support staff can view impersonation sessions" ON public.support_impersonation_sessions;
CREATE POLICY "Support staff can view impersonation sessions" ON public.support_impersonation_sessions
  FOR SELECT TO authenticated
  USING (support_user_id = auth.uid() OR public.can_manage_support_workspace(auth.uid()));

DROP POLICY IF EXISTS "Support staff can manage impersonation sessions" ON public.support_impersonation_sessions;
CREATE POLICY "Support staff can manage impersonation sessions" ON public.support_impersonation_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_support_workspace(auth.uid()) AND support_user_id = auth.uid());

DROP POLICY IF EXISTS "Support staff can update impersonation sessions" ON public.support_impersonation_sessions;
CREATE POLICY "Support staff can update impersonation sessions" ON public.support_impersonation_sessions
  FOR UPDATE TO authenticated
  USING (support_user_id = auth.uid())
  WITH CHECK (support_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.list_support_staff()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  full_name TEXT,
  primary_role TEXT,
  roles TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    COALESCE(au.email, pu.email, '')::TEXT,
    COALESCE(NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''), au.email, 'Unnamed user')::TEXT,
    CASE
      WHEN public.has_role(au.id, 'support') THEN 'support'
      WHEN public.has_role(au.id, 'platform_admin') THEN 'platform_admin'
      ELSE ''
    END::TEXT,
    COALESCE(
      (
        SELECT array_agg(ur.role::TEXT ORDER BY ur.role::TEXT)
        FROM public.user_roles ur
        WHERE ur.user_id = au.id
          AND ur.role IN ('platform_admin', 'support')
      ),
      ARRAY[]::TEXT[]
    )
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.auth_user_id = au.id
  WHERE EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = au.id
      AND ur.role IN ('platform_admin', 'support')
  )
  ORDER BY 3, 2;
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
  v_sender_role TEXT;
BEGIN
  v_school_id := public.get_user_school_id();
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to determine school';
  END IF;

  IF btrim(COALESCE(p_subject, '')) = '' THEN
    RAISE EXCEPTION 'Subject is required';
  END IF;

  IF btrim(COALESCE(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  v_sender_role := CASE WHEN public.is_admin(auth.uid()) THEN 'school_admin' ELSE 'school_user' END;

  INSERT INTO public.support_tickets (
    school_id,
    created_by,
    subject,
    category,
    priority,
    description,
    status,
    updated_at,
    last_message_at
  ) VALUES (
    v_school_id,
    auth.uid(),
    btrim(p_subject),
    p_category,
    p_priority,
    btrim(p_description),
    'open',
    NOW(),
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
    v_sender_role,
    btrim(p_description),
    FALSE
  );

  PERFORM public.notify_support_staff_for_ticket(v_ticket_id, v_school_id, btrim(p_subject), btrim(p_description));
  PERFORM public.log_support_action(
    v_school_id,
    v_ticket_id,
    'SUPPORT_TICKET_CREATED',
    'support_ticket',
    v_ticket_id::TEXT,
    NULL,
    jsonb_build_object('subject', btrim(p_subject), 'category', p_category, 'priority', p_priority),
    jsonb_build_object('created_by', auth.uid())
  );

  RETURN v_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_support_ticket(
  p_ticket_id BIGINT,
  p_assigned_to UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_before JSONB;
BEGIN
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_manage_support_workspace(p_assigned_to) THEN
    RAISE EXCEPTION 'Assignee must be support staff';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  v_before := to_jsonb(v_ticket);

  UPDATE public.support_tickets
  SET
    assigned_to = p_assigned_to,
    status = CASE WHEN v_ticket.status IN ('resolved', 'closed') THEN v_ticket.status ELSE 'assigned' END,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  IF COALESCE(btrim(p_note), '') <> '' THEN
    INSERT INTO public.support_ticket_messages (
      ticket_id,
      sender_user_id,
      sender_role,
      message,
      is_internal
    ) VALUES (
      p_ticket_id,
      auth.uid(),
      'platform_staff',
      btrim(p_note),
      TRUE
    );
  END IF;

  PERFORM public.create_support_notification(
    p_assigned_to,
    v_ticket.school_id,
    p_ticket_id,
    'ticket_assigned',
    format('Ticket #%s has been assigned to you: %s', p_ticket_id, v_ticket.subject),
    jsonb_build_object('assigned_by', auth.uid())
  );

  PERFORM public.create_support_notification(
    v_ticket.created_by,
    v_ticket.school_id,
    p_ticket_id,
    'ticket_assignment_update',
    format('Your support ticket "%s" has been assigned to the platform team.', v_ticket.subject),
    jsonb_build_object('assigned_to', p_assigned_to)
  );

  PERFORM public.log_support_action(
    v_ticket.school_id,
    p_ticket_id,
    'SUPPORT_TICKET_ASSIGNED',
    'support_ticket',
    p_ticket_id::TEXT,
    v_before,
    (SELECT to_jsonb(t) FROM public.support_tickets t WHERE t.id = p_ticket_id),
    jsonb_build_object('assigned_to', p_assigned_to)
  );

  RETURN p_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_support_ticket_status(
  p_ticket_id BIGINT,
  p_status TEXT,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_before JSONB;
BEGIN
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  v_before := to_jsonb(v_ticket);

  UPDATE public.support_tickets
  SET
    status = p_status,
    resolution_notes = CASE WHEN p_status IN ('resolved', 'closed') AND COALESCE(btrim(p_resolution_notes), '') <> '' THEN btrim(p_resolution_notes) ELSE resolution_notes END,
    resolved_by = CASE WHEN p_status IN ('resolved', 'closed') THEN auth.uid() ELSE resolved_by END,
    resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  IF COALESCE(btrim(p_resolution_notes), '') <> '' THEN
    INSERT INTO public.support_ticket_messages (
      ticket_id,
      sender_user_id,
      sender_role,
      message,
      is_internal
    ) VALUES (
      p_ticket_id,
      auth.uid(),
      'platform_staff',
      btrim(p_resolution_notes),
      FALSE
    );
  END IF;

  PERFORM public.create_support_notification(
    v_ticket.created_by,
    v_ticket.school_id,
    p_ticket_id,
    'ticket_status_updated',
    format('Your support ticket "%s" is now %s.', v_ticket.subject, replace(p_status, '_', ' ')),
    jsonb_build_object('status', p_status)
  );

  PERFORM public.log_support_action(
    v_ticket.school_id,
    p_ticket_id,
    'SUPPORT_TICKET_STATUS_UPDATED',
    'support_ticket',
    p_ticket_id::TEXT,
    v_before,
    (SELECT to_jsonb(t) FROM public.support_tickets t WHERE t.id = p_ticket_id),
    jsonb_build_object('status', p_status)
  );

  RETURN p_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_support_ticket(
  p_ticket_id BIGINT,
  p_resolution_notes TEXT,
  p_close_ticket BOOLEAN DEFAULT FALSE
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(btrim(p_resolution_notes), '') = '' THEN
    RAISE EXCEPTION 'Resolution notes are required';
  END IF;

  RETURN public.update_support_ticket_status(
    p_ticket_id,
    CASE WHEN p_close_ticket THEN 'closed' ELSE 'resolved' END,
    btrim(p_resolution_notes)
  );
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
  v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF COALESCE(btrim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  IF public.can_manage_support_workspace(auth.uid()) THEN
    v_sender_role := 'platform_staff';
  ELSE
    v_school_id := public.get_user_school_id();
    IF v_school_id IS DISTINCT FROM v_ticket.school_id OR (v_ticket.created_by <> auth.uid() AND NOT public.is_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    IF p_is_internal THEN
      RAISE EXCEPTION 'School users cannot create internal notes';
    END IF;
    v_sender_role := CASE WHEN public.is_admin(auth.uid()) THEN 'school_admin' ELSE 'school_user' END;
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
    btrim(p_message),
    p_is_internal
  ) RETURNING id INTO v_message_id;

  UPDATE public.support_tickets
  SET
    updated_at = NOW(),
    last_message_at = NOW(),
    status = CASE
      WHEN v_sender_role = 'platform_staff' AND NOT p_is_internal AND status IN ('open', 'assigned', 'in_progress') THEN 'waiting_on_school'
      WHEN v_sender_role IN ('school_admin', 'school_user') AND status IN ('waiting_on_school', 'resolved') THEN 'in_progress'
      ELSE status
    END
  WHERE id = p_ticket_id;

  IF v_sender_role = 'platform_staff' AND NOT p_is_internal THEN
    PERFORM public.create_support_notification(
      v_ticket.created_by,
      v_ticket.school_id,
      p_ticket_id,
      'ticket_reply',
      format('The platform team replied to your support ticket "%s".', v_ticket.subject),
      jsonb_build_object('message_id', v_message_id)
    );
  ELSIF v_sender_role IN ('school_admin', 'school_user') THEN
    IF v_ticket.assigned_to IS NOT NULL THEN
      PERFORM public.create_support_notification(
        v_ticket.assigned_to,
        v_ticket.school_id,
        p_ticket_id,
        'ticket_reply',
        format('A school user replied to ticket #%s: %s', p_ticket_id, v_ticket.subject),
        jsonb_build_object('message_id', v_message_id)
      );
    ELSE
      PERFORM public.notify_support_staff_for_ticket(
        p_ticket_id,
        v_ticket.school_id,
        v_ticket.subject,
        btrim(p_message)
      );
    END IF;
  END IF;

  PERFORM public.log_support_action(
    v_ticket.school_id,
    p_ticket_id,
    'SUPPORT_TICKET_MESSAGE_ADDED',
    'support_ticket_message',
    v_message_id::TEXT,
    NULL,
    jsonb_build_object('sender_role', v_sender_role, 'is_internal', p_is_internal),
    jsonb_build_object('ticket_id', p_ticket_id)
  );

  RETURN v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_support_impersonation(
  p_school_id BIGINT,
  p_ticket_id BIGINT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id BIGINT;
BEGIN
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.support_impersonation_sessions
  SET ended_at = NOW()
  WHERE support_user_id = auth.uid()
    AND ended_at IS NULL;

  IF p_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = p_ticket_id
      AND t.school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Ticket does not belong to school';
  END IF;

  INSERT INTO public.support_impersonation_sessions (
    support_user_id,
    school_id,
    ticket_id,
    reason
  ) VALUES (
    auth.uid(),
    p_school_id,
    p_ticket_id,
    p_reason
  ) RETURNING id INTO v_session_id;

  PERFORM public.log_support_action(
    p_school_id,
    p_ticket_id,
    'SUPPORT_IMPERSONATION_STARTED',
    'support_impersonation_session',
    v_session_id::TEXT,
    NULL,
    jsonb_build_object('reason', p_reason),
    jsonb_build_object('session_id', v_session_id)
  );

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_support_impersonation(
  p_session_id BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.support_impersonation_sessions%ROWTYPE;
BEGIN
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_session
  FROM public.support_impersonation_sessions s
  WHERE s.support_user_id = auth.uid()
    AND s.ended_at IS NULL
    AND (p_session_id IS NULL OR s.id = p_session_id)
  ORDER BY s.started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active impersonation session found';
  END IF;

  UPDATE public.support_impersonation_sessions
  SET ended_at = NOW()
  WHERE id = v_session.id;

  PERFORM public.log_support_action(
    v_session.school_id,
    v_session.ticket_id,
    'SUPPORT_IMPERSONATION_ENDED',
    'support_impersonation_session',
    v_session.id::TEXT,
    to_jsonb(v_session),
    to_jsonb(v_session) || jsonb_build_object('ended_at', NOW()),
    jsonb_build_object('session_id', v_session.id)
  );

  RETURN v_session.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_support_impersonation()
RETURNS TABLE(
  id BIGINT,
  support_user_id UUID,
  school_id BIGINT,
  ticket_id BIGINT,
  reason TEXT,
  started_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.support_user_id, s.school_id, s.ticket_id, s.reason, s.started_at
  FROM public.support_impersonation_sessions s
  WHERE s.support_user_id = auth.uid()
    AND s.ended_at IS NULL
  ORDER BY s.started_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.run_support_school_diagnostics(
  p_school_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
BEGIN
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_school_id := COALESCE(
    p_school_id,
    (SELECT school_id FROM public.support_impersonation_sessions WHERE support_user_id = auth.uid() AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1)
  );

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School context is required';
  END IF;

  RETURN jsonb_build_object(
    'school', (
      SELECT to_jsonb(s)
      FROM (
        SELECT id, name, code, active, subscription_plan, subscription_status
        FROM public.schools_school
        WHERE id = v_school_id
      ) s
    ),
    'active_students', public.get_school_active_student_count(v_school_id),
    'active_users', public.get_school_active_user_count(v_school_id),
    'open_support_tickets', (
      SELECT COUNT(*)::BIGINT
      FROM public.support_tickets
      WHERE school_id = v_school_id
        AND status NOT IN ('resolved', 'closed')
    ),
    'billing_snapshot', (
      SELECT to_jsonb(bas)
      FROM public.get_billing_account_snapshot(v_school_id) bas
      LIMIT 1
    )
  );
END;
$$;
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
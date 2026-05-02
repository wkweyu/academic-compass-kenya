import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: {
    slotId: string;
    date: string;
    absentTeacherId: number;
    substituteTeacherId: number;
    reason?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { slotId, date, absentTeacherId, substituteTeacherId, reason } = body;

  if (!slotId || !date || !absentTeacherId || !substituteTeacherId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: slotId, date, absentTeacherId, substituteTeacherId' }),
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: 'date must be in YYYY-MM-DD format' }), { status: 400 });
  }

  try {
    // 1. Fetch slot to get subject_id + timetable_id
    const { data: slot, error: slotError } = await supabase
      .from('timetable_slots')
      .select('id, timetable_id, subject_id, teacher_id, period_id, day_of_week')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), { status: 404 });
    }

    if (!slot.subject_id) {
      return new Response(JSON.stringify({ error: 'Slot has no subject assigned' }), { status: 422 });
    }

    // 2. Verify qualification via DB function
    const { data: qualified, error: qualError } = await supabase.rpc('is_teacher_qualified', {
      p_teacher_id: substituteTeacherId,
      p_subject_id: slot.subject_id,
    });

    if (qualError) throw qualError;

    if (!qualified) {
      return new Response(
        JSON.stringify({ error: 'Substitute teacher is not qualified to teach this subject' }),
        { status: 422 }
      );
    }

    // 3. Check substitute is free at that period+day (same term/year)
    const { data: timetable, error: ttError } = await supabase
      .from('timetables')
      .select('id, term, academic_year, school_id')
      .eq('id', slot.timetable_id)
      .single();

    if (ttError || !timetable) {
      return new Response(JSON.stringify({ error: 'Timetable not found' }), { status: 404 });
    }

    const { data: occupied, error: occError } = await supabase.rpc('get_teacher_occupied_slots', {
      teacher_ids: [substituteTeacherId],
      p_term: timetable.term,
      p_year: timetable.academic_year,
    });

    if (occError) throw occError;

    const alreadyBusy = (occupied || []).some(
      (o: any) => o.teacher_id === substituteTeacherId &&
        o.day_of_week === slot.day_of_week &&
        o.period_id === slot.period_id
    );

    if (alreadyBusy) {
      return new Response(
        JSON.stringify({ error: 'Substitute teacher is already teaching at this time' }),
        { status: 422 }
      );
    }

    // Also check existing substitutions for that date+period
    const { data: existingSub } = await supabase
      .from('timetable_substitutions')
      .select('id')
      .eq('substitute_teacher_id', substituteTeacherId)
      .eq('date', date)
      .eq('slot_id', slotId)
      .in('status', ['pending', 'active'])
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      return new Response(
        JSON.stringify({ error: 'A substitution for this slot and date already exists' }),
        { status: 409 }
      );
    }

    // 4. INSERT substitution
    const { data: newSub, error: subError } = await supabase
      .from('timetable_substitutions')
      .insert({
        timetable_id: slot.timetable_id,
        slot_id: slotId,
        date,
        original_teacher_id: absentTeacherId,
        substitute_teacher_id: substituteTeacherId,
        subject_id: slot.subject_id,
        reason: reason ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (subError) throw subError;

    // 5. INSERT audit log
    await supabase.from('timetable_audit_logs').insert({
      timetable_id: slot.timetable_id,
      action: 'substitution_created',
      user_id: '00000000-0000-0000-0000-000000000000', // system; real UID would come from auth header
      changes: {
        slot_id: { before: null, after: slotId },
        substitute_teacher_id: { before: absentTeacherId, after: substituteTeacherId },
        date: { before: null, after: date },
      },
    });

    // 6. Trigger SMS notification if school has SMS enabled
    await notifySubstitute(supabase, timetable.school_id, substituteTeacherId, absentTeacherId, date, slot);

    return new Response(
      JSON.stringify({ substitution: newSub }),
      { status: 201, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err: any) {
    console.error('assign-substitution error:', err);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});

async function notifySubstitute(
  supabase: any,
  schoolId: number,
  substituteTeacherId: number,
  absentTeacherId: number,
  date: string,
  slot: any
): Promise<void> {
  try {
    // Fetch school SMS config
    const { data: school } = await supabase
      .from('schools_school')
      .select('id, name')
      .eq('id', schoolId)
      .single();

    // Fetch teacher phone
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, first_name, last_name, phone_number')
      .eq('id', substituteTeacherId)
      .single();

    if (!teacher?.phone_number) return;

    // Log in-app notification via saas_communications (matches communicationHubService pattern)
    await supabase.from('saas_communications').insert({
      school_id: schoolId,
      subject: 'Substitution Assignment',
      content: `You have been assigned as a substitute teacher for ${date} (Period: ${slot.period_id}). Please check the timetable.`,
      category: 'notification',
      type: 'in_app',
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  } catch (notifyErr) {
    // Non-fatal: log but don't fail the substitution
    console.warn('Notification failed:', notifyErr);
  }
}

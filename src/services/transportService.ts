import { supabase } from "@/integrations/supabase/client";

export interface TransportRoute {
  id: number;
  name: string;
  one_way_charge: number;
  two_way_charge: number;
  description: string | null;
  school_id: number;
}

export interface TransportStudent {
  id: number;
  admission_number: string;
  full_name: string;
  current_class_name: string;
  current_stream_name: string;
  transport_route_id: number | null;
  transport_type: string | null;
  is_on_transport: boolean;
  route_name?: string;
  charge?: number;
}

// ─── Routes CRUD ───

export const getTransportRoutes = async (): Promise<TransportRoute[]> => {
  const { data, error } = await supabase
    .from('transport_transportroute')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []) as TransportRoute[];
};

export const createTransportRoute = async (
  route: Omit<TransportRoute, 'id'>
): Promise<TransportRoute> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  const { data, error } = await supabase
    .from('transport_transportroute')
    .insert({ ...route, school_id: schoolId })
    .select()
    .single();
  if (error) throw error;
  return data as TransportRoute;
};

export const updateTransportRoute = async (
  id: number,
  route: Partial<TransportRoute>
): Promise<TransportRoute> => {
  const { data, error } = await supabase
    .from('transport_transportroute')
    .update(route)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TransportRoute;
};

export const deleteTransportRoute = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('transport_transportroute')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ─── Students on Transport ───

export const getTransportStudents = async (): Promise<TransportStudent[]> => {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id, admission_number, full_name, is_on_transport,
      transport_route_id, transport_type,
      classes:current_class_id(name),
      streams:current_stream_id(name),
      transport_transportroute:transport_route_id(name, one_way_charge, two_way_charge)
    `)
    .eq('is_on_transport', true)
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;

  return (data || []).map((s: any) => ({
    id: s.id,
    admission_number: s.admission_number,
    full_name: s.full_name,
    current_class_name: s.classes?.name || '',
    current_stream_name: s.streams?.name || '',
    transport_route_id: s.transport_route_id,
    transport_type: s.transport_type,
    is_on_transport: s.is_on_transport,
    route_name: s.transport_transportroute?.name || '',
    charge: s.transport_type === 'two_way'
      ? s.transport_transportroute?.two_way_charge
      : s.transport_transportroute?.one_way_charge,
  }));
};

export const assignStudentToRoute = async (
  studentId: number,
  routeId: number,
  transportType: 'one_way' | 'two_way'
): Promise<void> => {
  const { error } = await supabase
    .from('students')
    .update({
      is_on_transport: true,
      transport_route_id: routeId,
      transport_type: transportType,
    })
    .eq('id', studentId);
  if (error) throw error;
};

export const unassignStudentFromRoute = async (
  studentId: number
): Promise<void> => {
  const { error } = await supabase
    .from('students')
    .update({
      is_on_transport: false,
      transport_route_id: null,
      transport_type: null,
    })
    .eq('id', studentId);
  if (error) throw error;
};

// ─── Transport Billing ───

export const postTransportDebit = async (
  studentId: number,
  amount: number,
  routeName: string,
  term: number,
  year: number
): Promise<void> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  if (!schoolId) throw new Error('No school found');

  // Find or skip transport votehead
  const { data: voteheads } = await supabase
    .from('fees_votehead')
    .select('id')
    .eq('school_id', schoolId)
    .ilike('name', '%transport%')
    .limit(1);

  if (!voteheads || voteheads.length === 0) {
    console.warn('No Transport votehead found – skipping debit');
    return;
  }

  const voteHeadId = voteheads[0].id;

  // Create debit transaction
  const invoiceNo = `TRN${year}${term}${studentId}`;
  const { error: debitErr } = await supabase
    .from('fees_debittransaction')
    .insert({
      student_id: studentId,
      vote_head_id: voteHeadId,
      amount,
      term,
      year,
      school_id: schoolId,
      date: new Date().toISOString().split('T')[0],
      invoice_number: invoiceNo,
      remarks: `Transport charge – ${routeName}`,
    });
  if (debitErr) throw debitErr;

  // Upsert fee balance
  const { data: existing } = await supabase
    .from('fees_feebalance')
    .select('*')
    .eq('student_id', studentId)
    .eq('vote_head_id', voteHeadId)
    .eq('term', term)
    .eq('year', year)
    .maybeSingle();

  if (existing) {
    const newInvoiced = existing.amount_invoiced + amount;
    const newClosing = existing.opening_balance + newInvoiced - existing.amount_paid;
    await supabase
      .from('fees_feebalance')
      .update({ amount_invoiced: newInvoiced, closing_balance: newClosing })
      .eq('id', existing.id);
  } else {
    await supabase.from('fees_feebalance').insert({
      student_id: studentId,
      vote_head_id: voteHeadId,
      term,
      year,
      school_id: schoolId,
      opening_balance: 0,
      amount_invoiced: amount,
      amount_paid: 0,
      closing_balance: amount,
    });
  }
};

// ─── Reports ───

export const getTransportBillingReport = async (
  term: number,
  year: number
): Promise<any[]> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  if (!schoolId) return [];

  const { data: voteheads } = await supabase
    .from('fees_votehead')
    .select('id')
    .eq('school_id', schoolId)
    .ilike('name', '%transport%')
    .limit(1);

  if (!voteheads || voteheads.length === 0) return [];
  const vhId = voteheads[0].id;

  const { data: balances } = await supabase
    .from('fees_feebalance')
    .select(`
      student_id, amount_invoiced, amount_paid, opening_balance, closing_balance,
      students!inner(full_name, admission_number, transport_route_id, transport_type,
        classes:current_class_id(name),
        streams:current_stream_id(name),
        transport_transportroute:transport_route_id(name)
      )
    `)
    .eq('vote_head_id', vhId)
    .eq('term', term)
    .eq('year', year)
    .eq('school_id', schoolId);

  return (balances || []).map((b: any) => ({
    student_id: b.student_id,
    full_name: b.students?.full_name,
    admission_number: b.students?.admission_number,
    class_name: b.students?.classes?.name || '',
    stream_name: b.students?.streams?.name || '',
    route_name: b.students?.transport_transportroute?.name || '',
    transport_type: b.students?.transport_type || '',
    invoiced: b.amount_invoiced,
    paid: b.amount_paid,
    balance: b.opening_balance + b.amount_invoiced - b.amount_paid,
  }));
};

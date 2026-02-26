import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

export interface SalaryStructure {
  id: number;
  staff_id: number;
  staff_name?: string;
  employee_no?: string;
  basic_salary: number;
  house_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  nhif_deduction: number;
  nssf_deduction: number;
  paye_deduction: number;
  loan_deduction: number;
  other_deductions: number;
  net_salary: number;
  effective_from: string;
  is_active: boolean;
  school_id: number;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  staff_count: number;
  approved_by?: number;
  approved_at?: string;
  school_id: number;
  created_at: string;
}

export interface PayrollEntry {
  id: number;
  payroll_run_id: number;
  staff_id: number;
  staff_name?: string;
  employee_no?: string;
  basic_salary: number;
  total_allowances: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  payment_status: string;
  paid_at?: string;
}

export const payrollService = {
  // Salary Structures
  async getSalaryStructures(): Promise<SalaryStructure[]> {
    const { data, error } = await supabase
      .from('payroll_salary_structures')
      .select('*, teachers(first_name, last_name, employee_no)')
      .order('staff_id');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      staff_name: d.teachers ? `${d.teachers.first_name} ${d.teachers.last_name}` : '',
      employee_no: d.teachers?.employee_no,
    }));
  },

  async createSalaryStructure(structure: Omit<SalaryStructure, 'id' | 'staff_name' | 'employee_no' | 'net_salary'>): Promise<SalaryStructure> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('payroll_salary_structures')
      .insert({ ...structure, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as SalaryStructure;
  },

  async updateSalaryStructure(id: number, updates: Partial<SalaryStructure>): Promise<void> {
    const { error } = await supabase.from('payroll_salary_structures').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteSalaryStructure(id: number): Promise<void> {
    const { error } = await supabase.from('payroll_salary_structures').delete().eq('id', id);
    if (error) throw error;
  },

  // Payroll Runs
  async getPayrollRuns(): Promise<PayrollRun[]> {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as PayrollRun[];
  },

  async createPayrollRun(month: number, year: number): Promise<PayrollRun> {
    const schoolId = await getSchoolId();
    
    // Get active salary structures
    const { data: structures } = await supabase
      .from('payroll_salary_structures')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true);
    
    const staffCount = (structures || []).length;
    const totalGross = (structures || []).reduce((s, st) => 
      s + Number(st.basic_salary) + Number(st.house_allowance) + Number(st.transport_allowance) + Number(st.medical_allowance) + Number(st.other_allowances), 0);
    const totalDeductions = (structures || []).reduce((s, st) => 
      s + Number(st.nhif_deduction) + Number(st.nssf_deduction) + Number(st.paye_deduction) + Number(st.loan_deduction) + Number(st.other_deductions), 0);
    
    const { data, error } = await supabase
      .from('payroll_runs')
      .insert({
        school_id: schoolId,
        month, year,
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalGross - totalDeductions,
        staff_count: staffCount,
      })
      .select().single();
    if (error) throw error;
    
    // Create entries for each staff
    if (structures && structures.length > 0) {
      const entries = structures.map(st => ({
        payroll_run_id: (data as any).id,
        staff_id: st.staff_id,
        basic_salary: Number(st.basic_salary),
        total_allowances: Number(st.house_allowance) + Number(st.transport_allowance) + Number(st.medical_allowance) + Number(st.other_allowances),
        gross_salary: Number(st.basic_salary) + Number(st.house_allowance) + Number(st.transport_allowance) + Number(st.medical_allowance) + Number(st.other_allowances),
        total_deductions: Number(st.nhif_deduction) + Number(st.nssf_deduction) + Number(st.paye_deduction) + Number(st.loan_deduction) + Number(st.other_deductions),
        net_salary: Number(st.net_salary),
      }));
      await supabase.from('payroll_entries').insert(entries);
    }
    
    return data as unknown as PayrollRun;
  },

  async updatePayrollRunStatus(id: number, status: string): Promise<void> {
    const { error } = await supabase.from('payroll_runs').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  // Payroll Entries
  async getPayrollEntries(runId: number): Promise<PayrollEntry[]> {
    const { data, error } = await supabase
      .from('payroll_entries')
      .select('*, teachers(first_name, last_name, employee_no)')
      .eq('payroll_run_id', runId)
      .order('staff_id');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      staff_name: d.teachers ? `${d.teachers.first_name} ${d.teachers.last_name}` : '',
      employee_no: d.teachers?.employee_no,
    }));
  },

  // Stats
  async getStats() {
    const [structures, runs] = await Promise.all([
      supabase.from('payroll_salary_structures').select('net_salary, is_active'),
      supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(1),
    ]);

    const activeStaff = (structures.data || []).filter(s => s.is_active);
    const monthlyPayroll = activeStaff.reduce((s, st) => s + Number(st.net_salary), 0);
    const lastRun = runs.data?.[0];

    return {
      active_staff: activeStaff.length,
      monthly_payroll: monthlyPayroll,
      last_run: lastRun,
    };
  },
};

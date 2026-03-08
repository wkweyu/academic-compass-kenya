import { supabase } from '@/integrations/supabase/client';
import { accountingService } from './accountingService';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

// ========== Kenyan Statutory Calculations (2024/2025 rates) ==========

// NHIF rates (monthly contributions based on gross salary)
const NHIF_BRACKETS = [
  { min: 0, max: 5999, amount: 150 },
  { min: 6000, max: 7999, amount: 300 },
  { min: 8000, max: 11999, amount: 400 },
  { min: 12000, max: 14999, amount: 500 },
  { min: 15000, max: 19999, amount: 600 },
  { min: 20000, max: 24999, amount: 750 },
  { min: 25000, max: 29999, amount: 850 },
  { min: 30000, max: 34999, amount: 900 },
  { min: 35000, max: 39999, amount: 950 },
  { min: 40000, max: 44999, amount: 1000 },
  { min: 45000, max: 49999, amount: 1100 },
  { min: 50000, max: 59999, amount: 1200 },
  { min: 60000, max: 69999, amount: 1300 },
  { min: 70000, max: 79999, amount: 1400 },
  { min: 80000, max: 89999, amount: 1500 },
  { min: 90000, max: 99999, amount: 1600 },
  { min: 100000, max: Infinity, amount: 1700 },
];

// NSSF Tier I & II (2024 rates)
const NSSF_TIER_I_LIMIT = 7000; // Lower earnings limit
const NSSF_TIER_II_LIMIT = 36000; // Upper earnings limit
const NSSF_RATE = 0.06; // 6% employee contribution

// PAYE Tax bands (monthly, 2024)
const PAYE_BANDS = [
  { min: 0, max: 24000, rate: 0.10 },
  { min: 24001, max: 32333, rate: 0.25 },
  { min: 32334, max: 500000, rate: 0.30 },
  { min: 500001, max: 800000, rate: 0.325 },
  { min: 800001, max: Infinity, rate: 0.35 },
];
const PERSONAL_RELIEF = 2400; // Monthly personal relief

export function calculateNHIF(grossSalary: number): number {
  const bracket = NHIF_BRACKETS.find(b => grossSalary >= b.min && grossSalary <= b.max);
  return bracket?.amount || 1700;
}

export function calculateNSSF(grossSalary: number): number {
  const tierI = Math.min(grossSalary, NSSF_TIER_I_LIMIT) * NSSF_RATE;
  const tierII = grossSalary > NSSF_TIER_I_LIMIT
    ? (Math.min(grossSalary, NSSF_TIER_II_LIMIT) - NSSF_TIER_I_LIMIT) * NSSF_RATE
    : 0;
  return Math.round(tierI + tierII);
}

export function calculatePAYE(grossSalary: number, nhif: number, nssf: number): number {
  const taxableIncome = grossSalary - nssf; // NSSF is tax-deductible
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let remaining = taxableIncome;

  for (const band of PAYE_BANDS) {
    const bandWidth = band.max - band.min + 1;
    const taxableInBand = Math.min(remaining, bandWidth);
    if (taxableInBand <= 0) break;
    tax += taxableInBand * band.rate;
    remaining -= taxableInBand;
  }

  // Apply personal relief and insurance relief (15% of NHIF, max 5000)
  const insuranceRelief = Math.min(nhif * 0.15, 5000);
  const netTax = Math.max(0, tax - PERSONAL_RELIEF - insuranceRelief);
  return Math.round(netTax);
}

export function calculateStatutoryDeductions(grossSalary: number) {
  const nhif = calculateNHIF(grossSalary);
  const nssf = calculateNSSF(grossSalary);
  const paye = calculatePAYE(grossSalary, nhif, nssf);
  return { nhif, nssf, paye, total: nhif + nssf + paye };
}

// ========== Interfaces ==========

export interface SalaryStructure {
  id: number;
  staff_id: number;
  staff_name?: string;
  employee_no?: string;
  department?: string;
  basic_salary: number;
  house_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  responsibility_allowance: number;
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
  bank_name?: string;
  bank_branch?: string;
  account_number?: string;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: string;
  description: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  staff_count: number;
  approved_by?: number;
  approved_at?: string;
  paid_at?: string;
  school_id: number;
  created_at: string;
}

export interface PayrollEntry {
  id: number;
  payroll_run_id: number;
  staff_id: number;
  staff_name: string;
  employee_no: string;
  department: string;
  basic_salary: number;
  house_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  total_allowances: number;
  gross_salary: number;
  nhif_deduction: number;
  nssf_deduction: number;
  paye_deduction: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  bank_name: string;
  bank_branch: string;
  account_number: string;
  payment_status: string;
  paid_at?: string;
  school_id: number;
}

export interface BankAdviceGroup {
  bank_name: string;
  bank_branch: string;
  entries: PayrollEntry[];
  total_amount: number;
  staff_count: number;
}

export const payrollService = {
  // ========== Salary Structures ==========
  async getSalaryStructures(): Promise<SalaryStructure[]> {
    const { data, error } = await supabase
      .from('payroll_salary_structures')
      .select('*, teachers(first_name, last_name, employee_no, department, bank_name, bank_branch, account_number)')
      .order('staff_id');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      staff_name: d.teachers ? `${d.teachers.first_name} ${d.teachers.last_name}` : '',
      employee_no: d.teachers?.employee_no,
      department: d.teachers?.department || '',
      bank_name: d.teachers?.bank_name || '',
      bank_branch: d.teachers?.bank_branch || '',
      account_number: d.teachers?.account_number || '',
    }));
  },

  async createSalaryStructure(structure: Partial<SalaryStructure>): Promise<SalaryStructure> {
    const schoolId = await getSchoolId();
    const basic = Number(structure.basic_salary) || 0;
    const house = Number(structure.house_allowance) || 0;
    const transport = Number(structure.transport_allowance) || 0;
    const medical = Number(structure.medical_allowance) || 0;
    const responsibility = Number(structure.responsibility_allowance) || 0;
    const otherAllow = Number(structure.other_allowances) || 0;
    const gross = basic + house + transport + medical + responsibility + otherAllow;

    // Auto-calculate statutory deductions if not manually set
    const autoCalc = calculateStatutoryDeductions(gross);
    const nhif = Number(structure.nhif_deduction) || autoCalc.nhif;
    const nssf = Number(structure.nssf_deduction) || autoCalc.nssf;
    const paye = Number(structure.paye_deduction) || autoCalc.paye;
    const loan = Number(structure.loan_deduction) || 0;
    const otherDed = Number(structure.other_deductions) || 0;
    const totalDed = nhif + nssf + paye + loan + otherDed;

    const { data, error } = await supabase
      .from('payroll_salary_structures')
      .insert({
        staff_id: structure.staff_id,
        basic_salary: basic,
        house_allowance: house,
        transport_allowance: transport,
        medical_allowance: medical,
        responsibility_allowance: responsibility,
        other_allowances: otherAllow,
        nhif_deduction: nhif,
        nssf_deduction: nssf,
        paye_deduction: paye,
        loan_deduction: loan,
        other_deductions: otherDed,
        net_salary: gross - totalDed,
        effective_from: structure.effective_from || new Date().toISOString().split('T')[0],
        is_active: true,
        school_id: schoolId,
      })
      .select().single();
    if (error) throw error;
    return data as unknown as SalaryStructure;
  },

  async updateSalaryStructure(id: number, updates: Partial<SalaryStructure>): Promise<void> {
    // Recalculate net if earnings/deductions changed
    const recalc: any = { ...updates, updated_at: new Date().toISOString() };
    if (updates.basic_salary !== undefined) {
      const basic = Number(updates.basic_salary) || 0;
      const house = Number(updates.house_allowance) || 0;
      const transport = Number(updates.transport_allowance) || 0;
      const medical = Number(updates.medical_allowance) || 0;
      const responsibility = Number(updates.responsibility_allowance) || 0;
      const otherAllow = Number(updates.other_allowances) || 0;
      const gross = basic + house + transport + medical + responsibility + otherAllow;
      const totalDed = Number(updates.nhif_deduction || 0) + Number(updates.nssf_deduction || 0) +
        Number(updates.paye_deduction || 0) + Number(updates.loan_deduction || 0) + Number(updates.other_deductions || 0);
      recalc.net_salary = gross - totalDed;
    }
    const { error } = await supabase.from('payroll_salary_structures').update(recalc).eq('id', id);
    if (error) throw error;
  },

  async deleteSalaryStructure(id: number): Promise<void> {
    const { error } = await supabase.from('payroll_salary_structures').delete().eq('id', id);
    if (error) throw error;
  },

  // ========== Payroll Runs ==========
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

    // Get active salary structures with teacher bank details
    const { data: structures } = await supabase
      .from('payroll_salary_structures')
      .select('*, teachers(first_name, last_name, employee_no, department, bank_name, bank_branch, account_number)')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (!structures || structures.length === 0) {
      throw new Error('No active salary structures found. Please set up salary structures first.');
    }

    let totalGross = 0, totalDeductions = 0;
    const entries = structures.map((st: any) => {
      const basic = Number(st.basic_salary);
      const house = Number(st.house_allowance);
      const transport = Number(st.transport_allowance);
      const medical = Number(st.medical_allowance);
      const responsibility = Number(st.responsibility_allowance) || 0;
      const otherAllow = Number(st.other_allowances);
      const totalAllow = house + transport + medical + responsibility + otherAllow;
      const gross = basic + totalAllow;
      const nhif = Number(st.nhif_deduction);
      const nssf = Number(st.nssf_deduction);
      const paye = Number(st.paye_deduction);
      const loan = Number(st.loan_deduction);
      const otherDed = Number(st.other_deductions);
      const totalDed = nhif + nssf + paye + loan + otherDed;
      const net = gross - totalDed;

      totalGross += gross;
      totalDeductions += totalDed;

      const staffName = st.teachers ? `${st.teachers.first_name} ${st.teachers.last_name}` : '';
      return {
        staff_id: st.staff_id,
        staff_name: staffName,
        employee_no: st.teachers?.employee_no || '',
        department: st.teachers?.department || '',
        basic_salary: basic,
        house_allowance: house,
        transport_allowance: transport,
        medical_allowance: medical,
        other_allowances: otherAllow,
        total_allowances: totalAllow,
        gross_salary: gross,
        nhif_deduction: nhif,
        nssf_deduction: nssf,
        paye_deduction: paye,
        loan_deduction: loan,
        other_deductions: otherDed,
        total_deductions: totalDed,
        net_salary: net,
        bank_name: st.teachers?.bank_name || '',
        bank_branch: st.teachers?.bank_branch || '',
        account_number: st.teachers?.account_number || '',
        school_id: schoolId,
      };
    });

    const { data: run, error } = await supabase
      .from('payroll_runs')
      .insert({
        school_id: schoolId,
        month, year,
        description: '',
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalGross - totalDeductions,
        staff_count: entries.length,
      })
      .select().single();
    if (error) throw error;

    // Insert entries
    const entriesWithRunId = entries.map(e => ({ ...e, payroll_run_id: (run as any).id }));
    const { error: entryError } = await supabase.from('payroll_entries').insert(entriesWithRunId);
    if (entryError) console.error('Error creating payroll entries:', entryError);

    return run as unknown as PayrollRun;
  },

  async updatePayrollRunStatus(id: number, status: string): Promise<void> {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'approved') {
      updates.approved_at = new Date().toISOString();
    }
    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
      // Update all entries to paid
      await supabase.from('payroll_entries')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('payroll_run_id', id);
    }
    const { error } = await supabase.from('payroll_runs').update(updates).eq('id', id);
    if (error) throw error;
  },

  // Post payroll to accounting ledger
  async postPayrollToAccounting(runId: number): Promise<void> {
    const entries = await this.getPayrollEntries(runId);
    const run = (await this.getPayrollRuns()).find(r => r.id === runId);
    if (!run || entries.length === 0) throw new Error('No payroll data found');

    const totalGross = entries.reduce((s, e) => s + Number(e.gross_salary), 0);
    const totalNHIF = entries.reduce((s, e) => s + Number(e.nhif_deduction), 0);
    const totalNSSF = entries.reduce((s, e) => s + Number(e.nssf_deduction), 0);
    const totalPAYE = entries.reduce((s, e) => s + Number(e.paye_deduction), 0);
    const totalNet = entries.reduce((s, e) => s + Number(e.net_salary), 0);
    const totalLoans = entries.reduce((s, e) => s + Number(e.loan_deduction) + Number(e.other_deductions), 0);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const ref = `PAY-${MONTHS[run.month - 1]}-${run.year}`;

    try {
      const accounts = await accountingService.getAccounts();
      const findAccount = (code: string) => accounts.find(a => a.account_code === code);
      
      const salaryExpenseAcc = findAccount('5100') || findAccount('5000');
      const cashAcc = findAccount('1000') || findAccount('1100');
      const nhifAcc = findAccount('2100');
      const nssfAcc = findAccount('2100');
      const payeAcc = findAccount('2100');

      if (!salaryExpenseAcc || !cashAcc) return; // Skip if accounts not set up

      const lines: any[] = [
        { account_id: salaryExpenseAcc.id, debit_amount: totalGross, credit_amount: 0, description: 'Gross salaries' },
        { account_id: cashAcc.id, debit_amount: 0, credit_amount: totalNet, description: 'Net salary payments' },
      ];

      const liabilityAcc = nhifAcc || nssfAcc || payeAcc;
      if (liabilityAcc && (totalNHIF + totalNSSF + totalPAYE + totalLoans) > 0) {
        lines.push({
          account_id: liabilityAcc.id, debit_amount: 0,
          credit_amount: totalNHIF + totalNSSF + totalPAYE + totalLoans,
          description: `Statutory deductions: NHIF ${totalNHIF}, NSSF ${totalNSSF}, PAYE ${totalPAYE}`
        });
      }

      await accountingService.createJournalEntry({
        entry_date: new Date().toISOString().split('T')[0],
        reference_number: ref,
        description: `Payroll for ${MONTHS[run.month - 1]} ${run.year}`,
        total_debit: totalGross,
        total_credit: totalGross,
        status: 'posted',
      }, lines);
    } catch (err) {
      console.error('Failed to post payroll to accounting:', err);
    }
  },

  // ========== Payroll Entries ==========
  async getPayrollEntries(runId: number): Promise<PayrollEntry[]> {
    const { data, error } = await supabase
      .from('payroll_entries')
      .select('*')
      .eq('payroll_run_id', runId)
      .order('staff_name');
    if (error) throw error;
    return (data || []) as unknown as PayrollEntry[];
  },

  // ========== Bank Advice ==========
  async getBankAdvice(runId: number): Promise<BankAdviceGroup[]> {
    const entries = await this.getPayrollEntries(runId);
    const groups: Record<string, BankAdviceGroup> = {};

    for (const entry of entries) {
      const bankKey = entry.bank_name || 'Unknown Bank';
      if (!groups[bankKey]) {
        groups[bankKey] = {
          bank_name: bankKey,
          bank_branch: entry.bank_branch || '',
          entries: [],
          total_amount: 0,
          staff_count: 0,
        };
      }
      groups[bankKey].entries.push(entry);
      groups[bankKey].total_amount += Number(entry.net_salary);
      groups[bankKey].staff_count += 1;
    }

    return Object.values(groups).sort((a, b) => a.bank_name.localeCompare(b.bank_name));
  },

  // ========== Stats ==========
  async getStats() {
    const [structures, runs] = await Promise.all([
      supabase.from('payroll_salary_structures').select('net_salary, is_active, basic_salary, house_allowance, transport_allowance, medical_allowance, other_allowances, nhif_deduction, nssf_deduction, paye_deduction, loan_deduction, other_deductions'),
      supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(1),
    ]);

    const activeStaff = (structures.data || []).filter(s => s.is_active);
    const totalGross = activeStaff.reduce((s, st) =>
      s + Number(st.basic_salary) + Number(st.house_allowance) + Number(st.transport_allowance) + Number(st.medical_allowance) + Number(st.other_allowances), 0);
    const totalDeductions = activeStaff.reduce((s, st) =>
      s + Number(st.nhif_deduction) + Number(st.nssf_deduction) + Number(st.paye_deduction) + Number(st.loan_deduction) + Number(st.other_deductions), 0);
    const monthlyNet = activeStaff.reduce((s, st) => s + Number(st.net_salary), 0);
    const lastRun = runs.data?.[0];

    return {
      active_staff: activeStaff.length,
      monthly_gross: totalGross,
      monthly_deductions: totalDeductions,
      monthly_net: monthlyNet,
      monthly_payroll: monthlyNet,
      last_run: lastRun,
    };
  },
};

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, DollarSign, Users, TrendingDown, Calculator, Printer, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { payrollService, calculateStatutoryDeductions, PayrollEntry } from '@/services/payrollService';
import { supabase } from '@/integrations/supabase/client';
import PayslipPrint from '@/components/payroll/PayslipPrint';
import BankAdviceTab from '@/components/payroll/BankAdviceTab';
import PayrollReportsTab from '@/components/payroll/PayrollReportsTab';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('runs');
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [isSalaryOpen, setIsSalaryOpen] = useState(false);
  const [editingStructureId, setEditingStructureId] = useState<number | null>(null);
  const [runForm, setRunForm] = useState({ month: (new Date().getMonth() + 1).toString(), year: new Date().getFullYear().toString() });
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollEntry | null>(null);
  const [autoCalc, setAutoCalc] = useState(true);
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);

  const emptySalaryForm = {
    staff_id: '', basic_salary: '', house_allowance: '0', transport_allowance: '0',
    medical_allowance: '0', responsibility_allowance: '0', other_allowances: '0',
    nhif_deduction: '0', nssf_deduction: '0', paye_deduction: '0',
    housing_levy: '0', nita_levy: '0',
    loan_deduction: '0', other_deductions: '0',
    effective_from: new Date().toISOString().split('T')[0],
  };
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);

  const { data: stats } = useQuery({ queryKey: ['payroll-stats'], queryFn: () => payrollService.getStats() });
  const { data: runs = [], refetch: refetchRuns } = useQuery({ queryKey: ['payroll-runs'], queryFn: () => payrollService.getPayrollRuns() });
  const { data: structures = [], refetch: refetchStructures } = useQuery({ queryKey: ['salary-structures'], queryFn: () => payrollService.getSalaryStructures() });
  const { data: entries = [] } = useQuery({
    queryKey: ['payroll-entries', selectedRunId],
    queryFn: () => payrollService.getPayrollEntries(selectedRunId!),
    enabled: !!selectedRunId,
  });
  const { data: uncoveredStaff = [] } = useQuery({
    queryKey: ['uncovered-staff'],
    queryFn: () => payrollService.getUncoveredStaff(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-payroll'],
    queryFn: async () => {
      const { data } = await supabase.from('teachers').select('id, first_name, last_name, employee_no, department, staff_category').eq('is_active', true).order('first_name');
      return data || [];
    },
  });

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile-payroll'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return data?.[0] || null;
    },
  });

  const grossPreview = (parseFloat(salaryForm.basic_salary) || 0) + (parseFloat(salaryForm.house_allowance) || 0) +
    (parseFloat(salaryForm.transport_allowance) || 0) + (parseFloat(salaryForm.medical_allowance) || 0) +
    (parseFloat(salaryForm.responsibility_allowance) || 0) + (parseFloat(salaryForm.other_allowances) || 0);

  const statutory = calculateStatutoryDeductions(grossPreview);
  const nhifPreview = autoCalc ? statutory.nhif : (parseFloat(salaryForm.nhif_deduction) || 0);
  const nssfPreview = autoCalc ? statutory.nssf : (parseFloat(salaryForm.nssf_deduction) || 0);
  const payePreview = autoCalc ? statutory.paye : (parseFloat(salaryForm.paye_deduction) || 0);
  const housingLevyPreview = autoCalc ? statutory.housingLevy : (parseFloat(salaryForm.housing_levy) || 0);
  const nitaPreview = autoCalc ? statutory.nitaLevy : (parseFloat(salaryForm.nita_levy) || 0);
  const loanPreview = parseFloat(salaryForm.loan_deduction) || 0;
  const otherDedPreview = parseFloat(salaryForm.other_deductions) || 0;
  const deductionsPreview = nhifPreview + nssfPreview + payePreview + housingLevyPreview + nitaPreview + loanPreview + otherDedPreview;

  const handleCreateRun = async () => {
    if (uncoveredStaff.length > 0) {
      setShowCoverageWarning(true);
      return;
    }
    await doCreateRun();
  };

  const doCreateRun = async () => {
    try {
      const run = await payrollService.createPayrollRun(parseInt(runForm.month), parseInt(runForm.year));
      toast({ title: 'Payroll run created successfully' });
      setIsRunOpen(false);
      setShowCoverageWarning(false);
      refetchRuns();
      queryClient.invalidateQueries({ queryKey: ['payroll-stats'] });
      // Auto-navigate to payslips
      setSelectedRunId(run.id);
      setActiveTab('payslips');
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleRefreshRun = async (id: number) => {
    try {
      await payrollService.refreshPayrollRun(id);
      toast({ title: 'Payroll run refreshed from current salary structures' });
      refetchRuns();
      queryClient.invalidateQueries({ queryKey: ['payroll-entries', id] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleApprove = async (id: number) => {
    try {
      await payrollService.updatePayrollRunStatus(id, 'approved');
      toast({ title: 'Payroll approved' });
      refetchRuns();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      await payrollService.updatePayrollRunStatus(id, 'paid');
      toast({ title: 'Payroll marked as paid' });
      refetchRuns();
      queryClient.invalidateQueries({ queryKey: ['payroll-entries'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handlePostToAccounting = async (id: number) => {
    try {
      await payrollService.postPayrollToAccounting(id);
      toast({ title: 'Payroll posted to accounting ledger' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleCreateSalary = async () => {
    if (!salaryForm.staff_id || !salaryForm.basic_salary) {
      toast({ title: 'Select staff and enter basic salary', variant: 'destructive' }); return;
    }
    try {
      await payrollService.createSalaryStructure({
        staff_id: parseInt(salaryForm.staff_id),
        basic_salary: parseFloat(salaryForm.basic_salary),
        house_allowance: parseFloat(salaryForm.house_allowance) || 0,
        transport_allowance: parseFloat(salaryForm.transport_allowance) || 0,
        medical_allowance: parseFloat(salaryForm.medical_allowance) || 0,
        responsibility_allowance: parseFloat(salaryForm.responsibility_allowance) || 0,
        other_allowances: parseFloat(salaryForm.other_allowances) || 0,
        nhif_deduction: autoCalc ? 0 : (parseFloat(salaryForm.nhif_deduction) || 0),
        nssf_deduction: autoCalc ? 0 : (parseFloat(salaryForm.nssf_deduction) || 0),
        paye_deduction: autoCalc ? 0 : (parseFloat(salaryForm.paye_deduction) || 0),
        housing_levy: autoCalc ? 0 : (parseFloat(salaryForm.housing_levy) || 0),
        nita_levy: autoCalc ? 0 : (parseFloat(salaryForm.nita_levy) || 0),
        loan_deduction: parseFloat(salaryForm.loan_deduction) || 0,
        other_deductions: parseFloat(salaryForm.other_deductions) || 0,
        effective_from: salaryForm.effective_from,
        is_active: true,
      });
      toast({ title: 'Salary structure created with statutory deductions auto-calculated' });
      setIsSalaryOpen(false);
      setSalaryForm({ staff_id: '', basic_salary: '', house_allowance: '0', transport_allowance: '0', medical_allowance: '0', responsibility_allowance: '0', other_allowances: '0', nhif_deduction: '0', nssf_deduction: '0', paye_deduction: '0', housing_levy: '0', nita_levy: '0', loan_deduction: '0', other_deductions: '0', effective_from: new Date().toISOString().split('T')[0] });
      refetchStructures();
      queryClient.invalidateQueries({ queryKey: ['payroll-stats'] });
      queryClient.invalidateQueries({ queryKey: ['uncovered-staff'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteStructure = async (id: number) => {
    try {
      await payrollService.deleteSalaryStructure(id);
      toast({ title: 'Salary structure deleted' });
      refetchStructures();
      queryClient.invalidateQueries({ queryKey: ['payroll-stats'] });
      queryClient.invalidateQueries({ queryKey: ['uncovered-staff'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const printPayslip = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = document.getElementById('payslip-print');
    if (!content) return;
    printWindow.document.write(`<html><head><title>Payslip</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px}table{width:100%;border-collapse:collapse}td{padding:4px 0}.grid{display:grid}.grid-cols-2{grid-template-columns:1fr 1fr}.gap-4{gap:16px}.gap-6{gap:24px}.text-right{text-align:right}.font-bold{font-weight:bold}.font-semibold{font-weight:600}.border-b{border-bottom:1px solid #000}.border-b-2{border-bottom:2px solid #000}.border-t-2{border-top:2px solid #000}.border-2{border:2px solid #000}.text-center{text-align:center}.text-xl{font-size:20px}.text-lg{font-size:18px}.text-sm{font-size:14px}.text-xs{font-size:12px}.uppercase{text-transform:uppercase}.mb-6{margin-bottom:24px}.mt-8{margin-top:32px}.p-3{padding:12px}.p-8{padding:32px}.pb-4{padding-bottom:16px}.pb-1{padding-bottom:4px}.mb-1{margin-bottom:4px}.mb-2{margin-bottom:8px}.mt-1{margin-top:4px}.mt-6{margin-top:24px}.py-1{padding:4px 0}.space-y-1>*+*{margin-top:4px}</style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const printAllPayslips = () => {
    if (!selectedRun || entries.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const payslips = entries.map(entry => {
      const gross = Number(entry.gross_salary);
      const totalDed = Number(entry.total_deductions);
      const net = Number(entry.net_salary);
      return `<div style="page-break-after:always;padding:30px">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:24px">
          <h1 style="font-size:20px;font-weight:bold;text-transform:uppercase">${schoolProfile?.name || 'School Name'}</h1>
          <h2 style="font-size:18px;margin-top:4px">PAYSLIP</h2>
          <p style="font-size:14px;margin-top:4px">For the month of ${MONTHS[selectedRun.month - 1]} ${selectedRun.year}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;font-size:14px">
          <div><p><b>Employee Name:</b> ${entry.staff_name}</p><p><b>Employee No:</b> ${entry.employee_no}</p><p><b>Department:</b> ${entry.department || 'N/A'}</p></div>
          <div style="text-align:right"><p><b>Bank:</b> ${entry.bank_name || 'N/A'}</p><p><b>Branch:</b> ${entry.bank_branch || 'N/A'}</p><p><b>Account:</b> ${entry.account_number || 'N/A'}</p></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
          <div><h3 style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:8px">EARNINGS</h3>
            <table style="width:100%;font-size:14px"><tbody>
              <tr style="border-bottom:1px solid #ccc"><td>Basic Salary</td><td style="text-align:right">${formatCurrency(Number(entry.basic_salary))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>House Allowance</td><td style="text-align:right">${formatCurrency(Number(entry.house_allowance))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>Transport Allowance</td><td style="text-align:right">${formatCurrency(Number(entry.transport_allowance))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>Medical Allowance</td><td style="text-align:right">${formatCurrency(Number(entry.medical_allowance))}</td></tr>
              ${Number(entry.other_allowances) > 0 ? `<tr style="border-bottom:1px solid #ccc"><td>Other Allowances</td><td style="text-align:right">${formatCurrency(Number(entry.other_allowances))}</td></tr>` : ''}
              <tr style="font-weight:bold;border-top:2px solid #000"><td>GROSS PAY</td><td style="text-align:right">${formatCurrency(gross)}</td></tr>
            </tbody></table>
          </div>
          <div><h3 style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:8px">DEDUCTIONS</h3>
            <table style="width:100%;font-size:14px"><tbody>
              <tr style="border-bottom:1px solid #ccc"><td>PAYE (Tax)</td><td style="text-align:right">${formatCurrency(Number(entry.paye_deduction))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>NHIF</td><td style="text-align:right">${formatCurrency(Number(entry.nhif_deduction))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>NSSF</td><td style="text-align:right">${formatCurrency(Number(entry.nssf_deduction))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>Housing Levy (1.5%)</td><td style="text-align:right">${formatCurrency(Number(entry.housing_levy || 0))}</td></tr>
              <tr style="border-bottom:1px solid #ccc"><td>NITA Levy</td><td style="text-align:right">${formatCurrency(Number(entry.nita_levy || 0))}</td></tr>
              ${Number(entry.loan_deduction) > 0 ? `<tr style="border-bottom:1px solid #ccc"><td>Loan Deduction</td><td style="text-align:right">${formatCurrency(Number(entry.loan_deduction))}</td></tr>` : ''}
              ${Number(entry.other_deductions) > 0 ? `<tr style="border-bottom:1px solid #ccc"><td>Other Deductions</td><td style="text-align:right">${formatCurrency(Number(entry.other_deductions))}</td></tr>` : ''}
              <tr style="font-weight:bold;border-top:2px solid #000"><td>TOTAL DEDUCTIONS</td><td style="text-align:right">${formatCurrency(totalDed)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div style="border:2px solid #000;padding:12px;text-align:center;margin-bottom:24px">
          <p style="font-size:18px;font-weight:bold">NET PAY: ${formatCurrency(net)}</p>
        </div>
        <p style="font-size:12px;text-align:center;color:#999;margin-top:24px">Computer-generated payslip. No signature required.</p>
      </div>`;
    }).join('');

    printWindow.document.write(`<html><head><title>All Payslips - ${MONTHS[selectedRun.month - 1]} ${selectedRun.year}</title><style>body{font-family:Arial,sans-serif;margin:0}table{border-collapse:collapse}td{padding:4px 0}@media print{.page-break{page-break-after:always}}</style></head><body>${payslips}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const selectedRun = runs.find(r => r.id === selectedRunId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
        <p className="text-muted-foreground">Kenyan-compliant payroll with PAYE, NHIF, NSSF, Housing Levy & NITA auto-calculation</p>
      </div>

      {/* Coverage Warning */}
      <AlertDialog open={showCoverageWarning} onOpenChange={setShowCoverageWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Staff Without Salary Structures</AlertDialogTitle>
            <AlertDialogDescription>
              {uncoveredStaff.length} active staff member(s) do not have salary structures and will be excluded from this payroll run:
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {uncoveredStaff.slice(0, 10).map(s => (
                  <li key={s.id}>{s.first_name} {s.last_name} ({s.employee_no})</li>
                ))}
                {uncoveredStaff.length > 10 && <li>...and {uncoveredStaff.length - 10} more</li>}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel & Setup Structures</AlertDialogCancel>
            <AlertDialogAction onClick={doCreateRun}>Proceed Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Active Staff</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.active_staff}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Monthly Gross</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.monthly_gross)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" />Total Deductions</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(stats.monthly_deductions)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" />Net Payroll</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.monthly_net)}</div>
              {stats.last_run && <p className="text-xs text-muted-foreground mt-1">Last: {MONTHS[(stats.last_run as any).month - 1]} {(stats.last_run as any).year}</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
          <TabsTrigger value="structures">Salary Setup</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="bank-advice">Bank Advice</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* =================== PAYROLL RUNS =================== */}
        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle>Payroll Runs</CardTitle>
                  <CardDescription>Monthly payroll processing and approval</CardDescription>
                </div>
                <Dialog open={isRunOpen} onOpenChange={setIsRunOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Payroll Run</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Payroll Run</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Month</Label>
                          <Select value={runForm.month} onValueChange={v => setRunForm(p => ({ ...p, month: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>Year</Label><Input type="number" value={runForm.year} onChange={e => setRunForm(p => ({ ...p, year: e.target.value }))} /></div>
                      </div>
                      <p className="text-sm text-muted-foreground">This will generate payroll entries for all {structures.filter(s => s.is_active).length} active salary structures.</p>
                      {uncoveredStaff.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Missing Salary Structures</AlertTitle>
                          <AlertDescription>{uncoveredStaff.length} active staff have no salary structure and will be excluded.</AlertDescription>
                        </Alert>
                      )}
                      <Button onClick={handleCreateRun} className="w-full">Generate Payroll</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead><TableHead>Staff</TableHead>
                    <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{MONTHS[r.month - 1]} {r.year}</TableCell>
                      <TableCell>{r.staff_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(r.total_gross))}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(Number(r.total_deductions))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(r.total_net))}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'approved' ? 'default' : r.status === 'paid' ? 'secondary' : 'outline'}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedRunId(r.id); setActiveTab('payslips'); }}>
                            View
                          </Button>
                          {r.status === 'draft' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleRefreshRun(r.id)} title="Re-sync with current salary structures">
                                <RefreshCw className="mr-1 h-3 w-3" />Refresh
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleApprove(r.id)}>Approve</Button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleMarkPaid(r.id)}>Mark Paid</Button>
                              <Button size="sm" variant="outline" onClick={() => handlePostToAccounting(r.id)}>
                                <BookOpen className="mr-1 h-3 w-3" />Post to GL
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {runs.length === 0 && <p className="text-center py-8 text-muted-foreground">No payroll runs yet. Set up salary structures first, then create a payroll run.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== SALARY STRUCTURES =================== */}
        <TabsContent value="structures">
          {/* Uncovered Staff Warning */}
          {uncoveredStaff.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{uncoveredStaff.length} Staff Without Salary Structures</AlertTitle>
              <AlertDescription>
                <p className="mb-2">The following active staff members are not in payroll:</p>
                <div className="flex flex-wrap gap-2">
                  {uncoveredStaff.map(s => (
                    <Badge key={s.id} variant="outline" className="cursor-pointer" onClick={() => {
                      setSalaryForm(f => ({ ...f, staff_id: s.id.toString() }));
                      setIsSalaryOpen(true);
                    }}>
                      {s.first_name} {s.last_name} ({s.employee_no}) — Click to add
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle>Salary Structures</CardTitle>
                  <CardDescription>Configure earnings and deductions for each staff member. PAYE, NHIF, NSSF, Housing Levy & NITA are auto-calculated per Kenyan rates.</CardDescription>
                </div>
                <Dialog open={isSalaryOpen} onOpenChange={setIsSalaryOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Salary Structure</Button></DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Create Salary Structure</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Staff Member *</Label>
                          <Select value={salaryForm.staff_id} onValueChange={v => setSalaryForm(p => ({ ...p, staff_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                            <SelectContent>{teachers.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.first_name} {t.last_name} ({t.employee_no})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>Effective From</Label><Input type="date" value={salaryForm.effective_from} onChange={e => setSalaryForm(p => ({ ...p, effective_from: e.target.value }))} /></div>
                      </div>

                      <div className="border rounded-md p-3 space-y-3">
                        <Label className="text-base font-semibold">Earnings</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Basic Salary *</Label><Input type="number" min="0" value={salaryForm.basic_salary} onChange={e => setSalaryForm(p => ({ ...p, basic_salary: e.target.value }))} /></div>
                          <div><Label>House Allowance</Label><Input type="number" min="0" value={salaryForm.house_allowance} onChange={e => setSalaryForm(p => ({ ...p, house_allowance: e.target.value }))} /></div>
                          <div><Label>Transport Allowance</Label><Input type="number" min="0" value={salaryForm.transport_allowance} onChange={e => setSalaryForm(p => ({ ...p, transport_allowance: e.target.value }))} /></div>
                          <div><Label>Medical Allowance</Label><Input type="number" min="0" value={salaryForm.medical_allowance} onChange={e => setSalaryForm(p => ({ ...p, medical_allowance: e.target.value }))} /></div>
                          <div><Label>Responsibility Allowance</Label><Input type="number" min="0" value={salaryForm.responsibility_allowance} onChange={e => setSalaryForm(p => ({ ...p, responsibility_allowance: e.target.value }))} /></div>
                          <div><Label>Other Allowances</Label><Input type="number" min="0" value={salaryForm.other_allowances} onChange={e => setSalaryForm(p => ({ ...p, other_allowances: e.target.value }))} /></div>
                        </div>
                      </div>

                      <div className="border rounded-md p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Deductions</Label>
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-primary" />
                            <label className="flex items-center gap-1 text-sm cursor-pointer">
                              <input type="checkbox" checked={autoCalc} onChange={e => setAutoCalc(e.target.checked)} className="rounded" />
                              Auto-calculate statutory (KRA rates)
                            </label>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>PAYE (Income Tax)</Label><Input type="number" min="0" value={autoCalc ? payePreview.toString() : salaryForm.paye_deduction} disabled={autoCalc} onChange={e => setSalaryForm(p => ({ ...p, paye_deduction: e.target.value }))} /></div>
                          <div><Label>NHIF</Label><Input type="number" min="0" value={autoCalc ? nhifPreview.toString() : salaryForm.nhif_deduction} disabled={autoCalc} onChange={e => setSalaryForm(p => ({ ...p, nhif_deduction: e.target.value }))} /></div>
                          <div><Label>NSSF</Label><Input type="number" min="0" value={autoCalc ? nssfPreview.toString() : salaryForm.nssf_deduction} disabled={autoCalc} onChange={e => setSalaryForm(p => ({ ...p, nssf_deduction: e.target.value }))} /></div>
                          <div><Label>Housing Levy (1.5%)</Label><Input type="number" min="0" value={autoCalc ? housingLevyPreview.toString() : salaryForm.housing_levy} disabled={autoCalc} onChange={e => setSalaryForm(p => ({ ...p, housing_levy: e.target.value }))} /></div>
                          <div><Label>NITA Levy</Label><Input type="number" min="0" value={autoCalc ? nitaPreview.toString() : salaryForm.nita_levy} disabled={autoCalc} onChange={e => setSalaryForm(p => ({ ...p, nita_levy: e.target.value }))} /></div>
                          <div><Label>Loan Deduction</Label><Input type="number" min="0" value={salaryForm.loan_deduction} onChange={e => setSalaryForm(p => ({ ...p, loan_deduction: e.target.value }))} /></div>
                          <div><Label>Other Deductions</Label><Input type="number" min="0" value={salaryForm.other_deductions} onChange={e => setSalaryForm(p => ({ ...p, other_deductions: e.target.value }))} /></div>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-md p-4 space-y-2">
                        <div className="flex justify-between text-sm"><span>Gross Salary:</span><span className="font-bold">{formatCurrency(grossPreview)}</span></div>
                        <div className="flex justify-between text-sm"><span>PAYE:</span><span>{formatCurrency(payePreview)}</span></div>
                        <div className="flex justify-between text-sm"><span>NHIF:</span><span>{formatCurrency(nhifPreview)}</span></div>
                        <div className="flex justify-between text-sm"><span>NSSF:</span><span>{formatCurrency(nssfPreview)}</span></div>
                        <div className="flex justify-between text-sm"><span>Housing Levy:</span><span>{formatCurrency(housingLevyPreview)}</span></div>
                        <div className="flex justify-between text-sm"><span>NITA:</span><span>{formatCurrency(nitaPreview)}</span></div>
                        {loanPreview > 0 && <div className="flex justify-between text-sm"><span>Loans:</span><span>{formatCurrency(loanPreview)}</span></div>}
                        <div className="flex justify-between text-sm border-t pt-2"><span>Total Deductions:</span><span className="font-bold text-destructive">{formatCurrency(deductionsPreview)}</span></div>
                        <div className="flex justify-between text-base border-t pt-2"><span className="font-bold">NET PAY:</span><span className="font-bold text-lg">{formatCurrency(grossPreview - deductionsPreview)}</span></div>
                      </div>

                      <Button onClick={handleCreateSalary} className="w-full">Create Salary Structure</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead><TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Allowances</TableHead><TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">PAYE</TableHead><TableHead className="text-right">NHIF</TableHead>
                    <TableHead className="text-right">NSSF</TableHead><TableHead className="text-right">H.Levy</TableHead>
                    <TableHead className="text-right">NITA</TableHead><TableHead className="text-right">Other</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structures.map(s => {
                    const allowances = Number(s.house_allowance) + Number(s.transport_allowance) + Number(s.medical_allowance) + Number(s.responsibility_allowance || 0) + Number(s.other_allowances);
                    const gross = Number(s.basic_salary) + allowances;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.staff_name}</div>
                          <div className="text-xs text-muted-foreground">{s.employee_no} • {s.department}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(s.basic_salary))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(allowances)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gross)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(s.paye_deduction))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(s.nhif_deduction))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(s.nssf_deduction))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(s.housing_levy || 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(s.nita_levy || 0))}</TableCell>
                        <TableCell className="text-right text-destructive">{formatCurrency(Number(s.loan_deduction) + Number(s.other_deductions))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(s.net_salary))}</TableCell>
                        <TableCell><Badge variant={s.is_active ? 'default' : 'outline'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteStructure(s.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {structures.length === 0 && <p className="text-center py-8 text-muted-foreground">No salary structures configured yet. Add staff salary structures to start processing payroll.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== PAYSLIPS =================== */}
        <TabsContent value="payslips">
          {selectedPayslip && selectedRun ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between">
                  <CardTitle>Payslip — {selectedPayslip.staff_name}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={printPayslip}><Printer className="mr-2 h-4 w-4" />Print</Button>
                    <Button variant="outline" onClick={() => setSelectedPayslip(null)}>Back to List</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PayslipPrint
                  entry={selectedPayslip}
                  month={selectedRun.month}
                  year={selectedRun.year}
                  schoolName={schoolProfile?.name}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Individual Payslips</CardTitle>
                    <CardDescription>View and print individual staff payslips</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedRunId?.toString() || ''} onValueChange={v => setSelectedRunId(parseInt(v))}>
                      <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select payroll run" /></SelectTrigger>
                      <SelectContent>
                        {runs.map(r => (
                          <SelectItem key={r.id} value={r.id.toString()}>{MONTHS[r.month - 1]} {r.year} ({r.status})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {entries.length > 0 && (
                      <Button variant="outline" onClick={printAllPayslips}>
                        <Printer className="mr-2 h-4 w-4" />Print All ({entries.length})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedRunId ? (
                  <p className="text-center py-8 text-muted-foreground">Select a payroll run to view payslips</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead><TableHead className="text-right">Basic</TableHead>
                        <TableHead className="text-right">Allowances</TableHead><TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net Pay</TableHead>
                        <TableHead>Status</TableHead><TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="font-medium">{e.staff_name}</div>
                            <div className="text-xs text-muted-foreground">{e.employee_no}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(e.basic_salary))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(e.total_allowances))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(e.gross_salary))}</TableCell>
                          <TableCell className="text-right text-destructive">{formatCurrency(Number(e.total_deductions))}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(Number(e.net_salary))}</TableCell>
                          <TableCell><Badge variant={e.payment_status === 'paid' ? 'default' : 'outline'}>{e.payment_status}</Badge></TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => setSelectedPayslip(e)}>
                              <Printer className="mr-1 h-3 w-3" />View Payslip
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {selectedRunId && entries.length === 0 && <p className="text-center py-8 text-muted-foreground">No payroll entries for this run</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =================== BANK ADVICE =================== */}
        <TabsContent value="bank-advice">
          <BankAdviceTab runs={runs} schoolName={schoolProfile?.name} />
        </TabsContent>

        {/* =================== REPORTS =================== */}
        <TabsContent value="reports">
          <PayrollReportsTab runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

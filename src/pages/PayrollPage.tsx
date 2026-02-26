import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, DollarSign, Plus, Calendar, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { payrollService } from '@/services/payrollService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('runs');
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [runForm, setRunForm] = useState({ month: (new Date().getMonth() + 1).toString(), year: new Date().getFullYear().toString() });
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const { data: stats } = useQuery({ queryKey: ['payroll-stats'], queryFn: () => payrollService.getStats() });
  const { data: runs = [], refetch: refetchRuns } = useQuery({ queryKey: ['payroll-runs'], queryFn: () => payrollService.getPayrollRuns() });
  const { data: structures = [] } = useQuery({ queryKey: ['salary-structures'], queryFn: () => payrollService.getSalaryStructures() });
  const { data: entries = [] } = useQuery({
    queryKey: ['payroll-entries', selectedRunId],
    queryFn: () => payrollService.getPayrollEntries(selectedRunId!),
    enabled: !!selectedRunId,
  });

  const handleCreateRun = async () => {
    try {
      await payrollService.createPayrollRun(parseInt(runForm.month), parseInt(runForm.year));
      toast({ title: 'Payroll run created' });
      setIsRunOpen(false);
      refetchRuns();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleApprove = async (id: number) => {
    try {
      await payrollService.updatePayrollRunStatus(id, 'approved');
      toast({ title: 'Payroll approved' });
      refetchRuns();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1><p className="text-muted-foreground">Staff salaries, deductions & payroll processing</p></div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active Staff</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.active_staff}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Payroll</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.monthly_payroll)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Last Run</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.last_run ? `${MONTHS[(stats.last_run as any).month - 1]} ${(stats.last_run as any).year}` : 'None'}</div></CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
          {selectedRunId && <TabsTrigger value="entries">Payslips</TabsTrigger>}
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Payroll Runs</CardTitle>
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
                      <Button onClick={handleCreateRun} className="w-full">Create Run</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Staff</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {runs.map(r => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => { setSelectedRunId(r.id); setActiveTab('entries'); }}>
                      <TableCell className="font-medium">{MONTHS[r.month - 1]} {r.year}</TableCell>
                      <TableCell>{r.staff_count}</TableCell>
                      <TableCell>{formatCurrency(Number(r.total_gross))}</TableCell>
                      <TableCell>{formatCurrency(Number(r.total_deductions))}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(r.total_net))}</TableCell>
                      <TableCell><Badge variant={r.status === 'approved' ? 'default' : r.status === 'paid' ? 'secondary' : 'outline'}>{r.status}</Badge></TableCell>
                      <TableCell>
                        {r.status === 'draft' && <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleApprove(r.id); }}>Approve</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {runs.length === 0 && <p className="text-center py-8 text-muted-foreground">No payroll runs yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures">
          <Card>
            <CardHeader><CardTitle>Salary Structures</CardTitle><CardDescription>Active salary configurations for staff</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Deductions</TableHead><TableHead>Net Salary</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {structures.map(s => {
                    const allowances = Number(s.house_allowance) + Number(s.transport_allowance) + Number(s.medical_allowance) + Number(s.other_allowances);
                    const deductions = Number(s.nhif_deduction) + Number(s.nssf_deduction) + Number(s.paye_deduction) + Number(s.loan_deduction) + Number(s.other_deductions);
                    return (
                      <TableRow key={s.id}>
                        <TableCell><div className="font-medium">{s.staff_name}</div><div className="text-xs text-muted-foreground">{s.employee_no}</div></TableCell>
                        <TableCell>{formatCurrency(Number(s.basic_salary))}</TableCell>
                        <TableCell>{formatCurrency(allowances)}</TableCell>
                        <TableCell className="text-destructive">{formatCurrency(deductions)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(Number(s.net_salary))}</TableCell>
                        <TableCell><Badge variant={s.is_active ? 'default' : 'outline'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {structures.length === 0 && <p className="text-center py-8 text-muted-foreground">No salary structures configured yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedRunId && (
          <TabsContent value="entries">
            <Card>
              <CardHeader><CardTitle>Payslips</CardTitle><CardDescription>Individual staff payroll details</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {entries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell><div className="font-medium">{e.staff_name}</div><div className="text-xs text-muted-foreground">{e.employee_no}</div></TableCell>
                        <TableCell>{formatCurrency(Number(e.basic_salary))}</TableCell>
                        <TableCell>{formatCurrency(Number(e.total_allowances))}</TableCell>
                        <TableCell>{formatCurrency(Number(e.gross_salary))}</TableCell>
                        <TableCell className="text-destructive">{formatCurrency(Number(e.total_deductions))}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(Number(e.net_salary))}</TableCell>
                        <TableCell><Badge variant={e.payment_status === 'paid' ? 'default' : 'outline'}>{e.payment_status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

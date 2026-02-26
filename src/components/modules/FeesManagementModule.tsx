import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, DollarSign, Receipt, AlertCircle, 
  TrendingUp, Download, FileText,
  Banknote, Clock, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { feesService, VoteHead, DebitTransaction, PaymentTransaction, FeeBalanceRecord } from '@/services/feesService';
import { FeeStructuresTab } from './FeeStructuresTab';
import { supabase } from '@/integrations/supabase/client';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-PESA' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export const FeesManagementModule = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDebitOpen, setIsDebitOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    student_id: '', amount: '', mode: 'cash', transaction_code: '', remarks: '',
  });
  const [debitForm, setDebitForm] = useState({
    student_id: '', vote_head_id: '', amount: '', term: '1', year: new Date().getFullYear().toString(), remarks: '',
  });

  const { data: stats } = useQuery({
    queryKey: ['fees-stats'],
    queryFn: () => feesService.getFeesStats(),
  });

  const { data: voteHeads = [] } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const { data: debits = [], refetch: refetchDebits } = useQuery({
    queryKey: ['debits'],
    queryFn: () => feesService.getDebits(),
    enabled: activeTab === 'invoices' || activeTab === 'overview',
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => feesService.getPayments(),
    enabled: activeTab === 'payments' || activeTab === 'overview',
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['balances'],
    queryFn: () => feesService.getFeeBalances(),
    enabled: activeTab === 'balances',
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-fees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id, classes(name)')
        .eq('is_active', true)
        .order('full_name');
      return (data || []).map((s: any) => ({
        id: s.id, name: s.full_name, admission_number: s.admission_number,
        class_name: s.classes?.name,
      }));
    },
  });

  const handleRecordPayment = async () => {
    if (!paymentForm.student_id || !paymentForm.amount || !paymentForm.transaction_code) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      const schoolId = (await supabase.rpc('get_user_school_id')).data as number;
      await feesService.createPayment({
        student_id: parseInt(paymentForm.student_id),
        amount: parseFloat(paymentForm.amount),
        mode: paymentForm.mode,
        transaction_code: paymentForm.transaction_code,
        date: new Date().toISOString(),
        remarks: paymentForm.remarks || '',
        apportion_log: {},
        school_id: schoolId,
      });
      toast({ title: 'Payment recorded successfully' });
      setIsPaymentOpen(false);
      setPaymentForm({ student_id: '', amount: '', mode: 'cash', transaction_code: '', remarks: '' });
      refetchPayments();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleCreateDebit = async () => {
    if (!debitForm.student_id || !debitForm.vote_head_id || !debitForm.amount) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      const schoolId = (await supabase.rpc('get_user_school_id')).data as number;
      const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;
      await feesService.createDebit({
        student_id: parseInt(debitForm.student_id),
        vote_head_id: parseInt(debitForm.vote_head_id),
        amount: parseFloat(debitForm.amount),
        term: parseInt(debitForm.term),
        year: parseInt(debitForm.year),
        date: new Date().toISOString(),
        invoice_number: invoiceNo,
        remarks: debitForm.remarks || '',
        school_id: schoolId,
      });
      toast({ title: 'Invoice created successfully' });
      setIsDebitOpen(false);
      setDebitForm({ student_id: '', vote_head_id: '', amount: '', term: '1', year: new Date().getFullYear().toString(), remarks: '' });
      refetchDebits();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // Aggregate balances by student
  const studentBalances = balances.reduce((acc, b) => {
    if (!acc[b.student_id]) {
      acc[b.student_id] = {
        student_id: b.student_id, student_name: b.student_name || '', admission_number: b.admission_number || '',
        class_name: b.class_name || '', total_invoiced: 0, total_paid: 0, closing_balance: 0,
      };
    }
    acc[b.student_id].total_invoiced += Number(b.amount_invoiced);
    acc[b.student_id].total_paid += Number(b.amount_paid);
    acc[b.student_id].closing_balance += Number(b.closing_balance);
    return acc;
  }, {} as Record<number, any>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees Management</h1>
          <p className="text-muted-foreground">Vote heads, invoicing, payments & balances</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDebitOpen} onOpenChange={setIsDebitOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><FileText className="mr-2 h-4 w-4" />Create Invoice</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Invoice (Debit)</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Student *</Label>
                  <Select value={debitForm.student_id} onValueChange={v => setDebitForm(p => ({ ...p, student_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>
                      {students.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.admission_number})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vote Head *</Label>
                  <Select value={debitForm.vote_head_id} onValueChange={v => setDebitForm(p => ({ ...p, vote_head_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vote head" /></SelectTrigger>
                    <SelectContent>
                      {voteHeads.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Amount (KES) *</Label><Input type="number" value={debitForm.amount} onChange={e => setDebitForm(p => ({ ...p, amount: e.target.value }))} /></div>
                  <div><Label>Term</Label>
                    <Select value={debitForm.term} onValueChange={v => setDebitForm(p => ({ ...p, term: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Year</Label><Input type="number" value={debitForm.year} onChange={e => setDebitForm(p => ({ ...p, year: e.target.value }))} /></div>
                </div>
                <div><Label>Remarks</Label><Textarea value={debitForm.remarks} onChange={e => setDebitForm(p => ({ ...p, remarks: e.target.value }))} /></div>
                <Button onClick={handleCreateDebit} className="w-full">Create Invoice</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Record Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Student *</Label>
                  <Select value={paymentForm.student_id} onValueChange={v => setPaymentForm(p => ({ ...p, student_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>
                      {students.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.admission_number})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount (KES) *</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} /></div>
                  <div><Label>Payment Mode *</Label>
                    <Select value={paymentForm.mode} onValueChange={v => setPaymentForm(p => ({ ...p, mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Transaction/Receipt Code *</Label><Input value={paymentForm.transaction_code} onChange={e => setPaymentForm(p => ({ ...p, transaction_code: e.target.value }))} /></div>
                <div><Label>Remarks</Label><Textarea value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))} /></div>
                <Button onClick={handleRecordPayment} className="w-full">Record Payment</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.total_invoiced)}</div>
              <p className="text-xs text-muted-foreground">{stats.debit_count} invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_collected)}</div>
              <Progress value={stats.collection_rate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{stats.collection_rate}% collection rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.total_outstanding)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.payment_count}</div>
              <p className="text-xs text-muted-foreground">Total transactions</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vote-heads">Vote Heads</TabsTrigger>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="balances">Student Balances</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
              <CardContent>
                {debits.slice(0, 5).map(d => (
                  <div key={d.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{d.student_name}</p>
                      <p className="text-xs text-muted-foreground">{d.vote_head_name} • {d.invoice_number}</p>
                    </div>
                    <span className="font-medium">{formatCurrency(Number(d.amount))}</span>
                  </div>
                ))}
                {debits.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No invoices yet</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
              <CardContent>
                {payments.slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{p.student_name}</p>
                      <p className="text-xs text-muted-foreground">{p.mode} • {p.transaction_code}</p>
                    </div>
                    <span className="font-medium text-green-600">{formatCurrency(Number(p.amount))}</span>
                  </div>
                ))}
                {payments.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No payments yet</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vote Heads */}
        <TabsContent value="vote-heads"><VoteHeadsTab /></TabsContent>

        {/* Fee Structures */}
        <TabsContent value="structures"><FeeStructuresTab /></TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle>Invoices (Debit Transactions)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Vote Head</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Term/Year</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debits.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium">{d.student_name}</div>
                        <div className="text-xs text-muted-foreground">{d.admission_number}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{d.vote_head_name}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{d.invoice_number}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(d.amount))}</TableCell>
                      <TableCell>T{d.term}/{d.year}</TableCell>
                      <TableCell>{new Date(d.date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {debits.length === 0 && <p className="text-center py-8 text-muted-foreground">No invoices found</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card>
            <CardHeader><CardTitle>Payment Records</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Transaction Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.student_name}</div>
                        <div className="text-xs text-muted-foreground">{p.admission_number}</div>
                      </TableCell>
                      <TableCell className="font-medium text-green-600">{formatCurrency(Number(p.amount))}</TableCell>
                      <TableCell><Badge variant="outline">{p.mode}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{p.transaction_code}</TableCell>
                      <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.remarks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {payments.length === 0 && <p className="text-center py-8 text-muted-foreground">No payments found</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances */}
        <TabsContent value="balances">
          <Card>
            <CardHeader><CardTitle>Student Fee Balances</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Total Invoiced</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(studentBalances).map((b: any) => (
                    <TableRow key={b.student_id}>
                      <TableCell>
                        <div className="font-medium">{b.student_name}</div>
                        <div className="text-xs text-muted-foreground">{b.admission_number}</div>
                      </TableCell>
                      <TableCell>{b.class_name}</TableCell>
                      <TableCell>{formatCurrency(b.total_invoiced)}</TableCell>
                      <TableCell>{formatCurrency(b.total_paid)}</TableCell>
                      <TableCell>
                        <span className={b.closing_balance > 0 ? 'text-destructive font-medium' : 'text-green-600'}>
                          {formatCurrency(b.closing_balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.closing_balance <= 0 ? 'default' : 'destructive'}>
                          {b.closing_balance <= 0 ? 'Clear' : 'Owing'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {Object.keys(studentBalances).length === 0 && <p className="text-center py-8 text-muted-foreground">No balance records found</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Vote Heads Sub-component
function VoteHeadsTab() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', priority: '1', student_group: 'all', fee_applicable: true });

  const { data: voteHeads = [], refetch } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const handleCreate = async () => {
    if (!form.name) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    try {
      await feesService.createVoteHead({
        name: form.name, description: form.description,
        priority: parseInt(form.priority), student_group: form.student_group,
        fee_applicable: form.fee_applicable, school_id: 0,
      });
      toast({ title: 'Vote head created' });
      setIsOpen(false);
      setForm({ name: '', description: '', priority: '1', student_group: 'all', fee_applicable: true });
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this vote head?')) return;
    try {
      await feesService.deleteVoteHead(id);
      toast({ title: 'Vote head deleted' });
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div><CardTitle>Vote Heads</CardTitle><CardDescription>Fee categories and their priorities</CardDescription></div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Vote Head</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Vote Head</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Tuition" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} /></div>
                  <div><Label>Student Group</Label>
                    <Select value={form.student_group} onValueChange={v => setForm(p => ({ ...p, student_group: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Students</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="day">Day</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full">Create Vote Head</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Student Group</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {voteHeads.map(vh => (
              <TableRow key={vh.id}>
                <TableCell><Badge variant="outline">{vh.priority}</Badge></TableCell>
                <TableCell className="font-medium">{vh.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{vh.description}</TableCell>
                <TableCell><Badge variant="secondary">{vh.student_group}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(vh.id)} className="text-destructive">Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {voteHeads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4" />
            <p>No vote heads configured. Add vote heads like Tuition, Lunch, Transport etc.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

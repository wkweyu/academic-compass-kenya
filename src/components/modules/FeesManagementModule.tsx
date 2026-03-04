import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, DollarSign, Receipt as ReceiptIcon, AlertCircle,
  TrendingUp, FileText, Banknote, Users, Search,
  BookOpen, BarChart3, ArrowUpDown, Printer
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
import { feesService, VoteHead, Receipt, StudentLedger, FeesReport } from '@/services/feesService';
import { FeeStructuresTab } from './FeeStructuresTab';
import { supabase } from '@/integrations/supabase/client';
import { printReceipt } from '@/components/fees/PaymentReceiptPrint';
import { FeeStructureAnnualView } from '@/components/fees/FeeStructureAnnualView';
import { FeesReportsModule } from '@/components/fees/FeesReportsModule';
import { AdditionalDebitsDialog } from '@/components/fees/AdditionalDebitsDialog';
import { TransferCreditDialog } from '@/components/fees/TransferCreditDialog';
import { BulkCsvImport } from '@/components/fees/BulkCsvImport';
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isBulkDebitOpen, setIsBulkDebitOpen] = useState(false);
  const [statementStudentId, setStatementStudentId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    student_id: '', amount: '', mode: 'cash', reference: '', term: '1',
    year: new Date().getFullYear().toString(), remarks: '',
  });
  const [bulkDebitForm, setBulkDebitForm] = useState({
    structure_group_id: '', term: '1', year: new Date().getFullYear().toString(),
    class_id: '',
  });

  const { data: stats } = useQuery({
    queryKey: ['fees-stats'],
    queryFn: () => feesService.getFeesStats(),
  });

  const { data: voteHeads = [] } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => feesService.getReceipts(),
    enabled: activeTab === 'receipts' || activeTab === 'overview',
  });

  const { data: ledgers = [] } = useQuery({
    queryKey: ['student-ledgers'],
    queryFn: () => feesService.getStudentLedgers(),
    enabled: activeTab === 'balances',
  });

  const { data: reports } = useQuery({
    queryKey: ['fees-reports'],
    queryFn: () => feesService.generateReports(),
    enabled: activeTab === 'reports',
  });

  const { data: statement } = useQuery({
    queryKey: ['student-statement', statementStudentId],
    queryFn: () => feesService.getStudentStatement(statementStudentId!),
    enabled: !!statementStudentId,
  });

  const { data: structureGroups = [] } = useQuery({
    queryKey: ['fee-structure-groups'],
    queryFn: () => feesService.getStructureGroups(),
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
        class_name: s.classes?.name, class_id: s.current_class_id,
      }));
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-for-fees'],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      return data || [];
    },
  });

  // ==================== COLLECT PAYMENT ====================
  const handleCollectPayment = async () => {
    if (!paymentForm.student_id || !paymentForm.amount || !paymentForm.reference) {
      toast({ title: 'Error', description: 'Fill student, amount & reference', variant: 'destructive' });
      return;
    }
    try {
      const receipt = await feesService.collectPayment({
        student_id: parseInt(paymentForm.student_id),
        amount: parseFloat(paymentForm.amount),
        payment_mode: paymentForm.mode,
        reference: paymentForm.reference,
        term: parseInt(paymentForm.term),
        year: parseInt(paymentForm.year),
        remarks: paymentForm.remarks,
      });
      toast({
        title: 'Payment collected',
        description: `Receipt ${receipt.receipt_no} — ${formatCurrency(receipt.amount)}. ${(receipt.allocations || []).length} allocations made.`,
      });
      setIsPaymentOpen(false);
      setPaymentForm({ student_id: '', amount: '', mode: 'cash', reference: '', term: '1', year: new Date().getFullYear().toString(), remarks: '' });
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // ==================== BULK DEBIT ====================
  const handleBulkDebit = async () => {
    if (!bulkDebitForm.structure_group_id) {
      toast({ title: 'Select a fee structure', variant: 'destructive' });
      return;
    }
    try {
      const filteredStudents = bulkDebitForm.class_id && bulkDebitForm.class_id !== 'all'
        ? students.filter(s => s.class_id === parseInt(bulkDebitForm.class_id))
        : students;
      if (filteredStudents.length === 0) {
        toast({ title: 'No students found for selection', variant: 'destructive' });
        return;
      }
      const { count } = await feesService.postTermFeesBulk(
        parseInt(bulkDebitForm.structure_group_id),
        filteredStudents.map(s => s.id),
        parseInt(bulkDebitForm.term),
        parseInt(bulkDebitForm.year),
      );
      toast({ title: 'Bulk debit posted', description: `${count} entries created for ${filteredStudents.length} students` });
      setIsBulkDebitOpen(false);
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees Management</h1>
          <p className="text-muted-foreground">Double-entry accounting • Vote heads • Receipts • Reports</p>
        </div>
        <div className="flex gap-2">
          {/* Bulk Debit Dialog */}
          <Dialog open={isBulkDebitOpen} onOpenChange={setIsBulkDebitOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><FileText className="mr-2 h-4 w-4" />Post Term Fees</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post Term Fees (Bulk Debit)</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Fee Structure *</Label>
                  <Select value={bulkDebitForm.structure_group_id} onValueChange={v => setBulkDebitForm(p => ({ ...p, structure_group_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select structure" /></SelectTrigger>
                    <SelectContent>
                      {structureGroups.map(g => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name} ({formatCurrency(g.total || 0)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class (optional — leave empty for all)</Label>
                  <Select value={bulkDebitForm.class_id} onValueChange={v => setBulkDebitForm(p => ({ ...p, class_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Term</Label>
                    <Select value={bulkDebitForm.term} onValueChange={v => setBulkDebitForm(p => ({ ...p, term: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Year</Label><Input type="number" value={bulkDebitForm.year} onChange={e => setBulkDebitForm(p => ({ ...p, year: e.target.value }))} /></div>
                </div>
                <Button onClick={handleBulkDebit} className="w-full">Post Fees to Students</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Collect Payment Dialog */}
          <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Collect Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
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
                <div><Label>Reference (M-PESA Code / Receipt No) *</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Term</Label>
                    <Select value={paymentForm.term} onValueChange={v => setPaymentForm(p => ({ ...p, term: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Year</Label><Input type="number" value={paymentForm.year} onChange={e => setPaymentForm(p => ({ ...p, year: e.target.value }))} /></div>
                </div>
                <div><Label>Remarks</Label><Textarea value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))} /></div>
                <Button onClick={handleCollectPayment} className="w-full">Collect Payment & Auto-Allocate</Button>
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
              <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
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
              <p className="text-xs text-muted-foreground">{stats.students_owing} students owing</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receipts</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.payment_count}</div>
              <p className="text-xs text-muted-foreground">{stats.students_clear} students clear</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vote-heads">Vote Heads</TabsTrigger>
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="balances">Ledgers</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Recent Receipts</CardTitle></CardHeader>
              <CardContent>
                {receipts.slice(0, 5).map(r => (
                  <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{r.student_name}</p>
                      <p className="text-xs text-muted-foreground">{r.receipt_no} • {r.payment_mode}</p>
                    </div>
                    <span className="font-medium text-green-600">{formatCurrency(Number(r.amount))}</span>
                  </div>
                ))}
                {receipts.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No receipts yet</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => setIsPaymentOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />Collect Payment
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setIsBulkDebitOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />Post Term Fees (Bulk)
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('statement')}>
                  <Search className="mr-2 h-4 w-4" />View Student Statement
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('reports')}>
                  <BarChart3 className="mr-2 h-4 w-4" />View Reports
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vote Heads */}
        <TabsContent value="vote-heads"><VoteHeadsTab /></TabsContent>

        {/* Fee Structures */}
        <TabsContent value="structures"><FeeStructuresTab /></TabsContent>

        {/* Receipts */}
        <TabsContent value="receipts">
          <Card>
            <CardHeader><CardTitle>Payment Receipts</CardTitle><CardDescription>All payments with auto-generated receipt numbers</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Term/Year</TableHead>
                     <TableHead>Date</TableHead>
                     <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">{r.receipt_no}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.student_name}</div>
                        <div className="text-xs text-muted-foreground">{r.admission_number}</div>
                      </TableCell>
                      <TableCell className="font-medium text-green-600">{formatCurrency(Number(r.amount))}</TableCell>
                      <TableCell><Badge variant="outline">{r.payment_mode}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{r.reference}</TableCell>
                      <TableCell>T{r.term}/{r.year}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => printReceipt({ receipt: r })}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {receipts.length === 0 && <p className="text-center py-8 text-muted-foreground">No receipts found</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Student Ledgers */}
        <TabsContent value="balances">
          <Card>
            <CardHeader><CardTitle>Student Ledgers</CardTitle><CardDescription>Running debit, credit & balance per student</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Total Debits</TableHead>
                    <TableHead>Total Credits</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgers.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.student_name}</div>
                        <div className="text-xs text-muted-foreground">{l.admission_number}</div>
                      </TableCell>
                      <TableCell>{l.class_name}</TableCell>
                      <TableCell>{formatCurrency(Number(l.debit_total))}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(Number(l.credit_total))}</TableCell>
                      <TableCell>
                        <span className={Number(l.balance) > 0 ? 'text-destructive font-bold' : 'text-green-600 font-bold'}>
                          {formatCurrency(Number(l.balance))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={Number(l.balance) <= 0 ? 'default' : 'destructive'}>
                          {Number(l.balance) <= 0 ? 'Clear' : 'Owing'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { setStatementStudentId(l.student_id); setActiveTab('statement'); }}>
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {ledgers.length === 0 && <p className="text-center py-8 text-muted-foreground">No ledger records. Post term fees to generate.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Student Statement */}
        <TabsContent value="statement">
          <Card>
            <CardHeader>
              <CardTitle>Student Statement</CardTitle>
              <CardDescription>Select a student to view their full fee statement</CardDescription>
              <div className="mt-2 max-w-sm">
                <Select value={statementStudentId?.toString() || ''} onValueChange={v => setStatementStudentId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.admission_number})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {statement ? (
                <div className="space-y-6">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg">{statement.student_name}</h3>
                    <p className="text-sm text-muted-foreground">Adm: {statement.admission_number} • Class: {statement.class_name}</p>
                    <div className="mt-3 flex gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Debits</p>
                        <p className="font-bold">{formatCurrency(Number(statement.ledger?.debit_total || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Credits</p>
                        <p className="font-bold text-green-600">{formatCurrency(Number(statement.ledger?.credit_total || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Running Balance</p>
                        <p className={`font-bold ${statement.running_balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCurrency(statement.running_balance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><ArrowUpDown className="h-4 w-4" />Debits (Charges)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Vote Head</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Term/Year</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statement.debits.map(d => (
                          <TableRow key={d.id}>
                            <TableCell>{new Date(d.date).toLocaleDateString()}</TableCell>
                            <TableCell className="font-mono text-sm">{d.invoice_number}</TableCell>
                            <TableCell><Badge variant="outline">{d.vote_head_name}</Badge></TableCell>
                            <TableCell className="font-medium">{formatCurrency(Number(d.amount))}</TableCell>
                            <TableCell>T{d.term}/{d.year}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {statement.debits.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No debits</p>}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Banknote className="h-4 w-4" />Credits (Payments)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Receipt #</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Allocations</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statement.credits.map(r => (
                          <TableRow key={r.id}>
                            <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="font-mono font-medium">{r.receipt_no}</TableCell>
                            <TableCell className="font-medium text-green-600">{formatCurrency(Number(r.amount))}</TableCell>
                            <TableCell><Badge variant="outline">{r.payment_mode}</Badge></TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {(r.allocations || []).map((a, i) => (
                                  <div key={i} className="text-xs">
                                    {a.vote_head_name}: {formatCurrency(Number(a.amount))}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {statement.credits.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No payments</p>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4" />
                  <p>Select a student above to view their fee statement</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports">
          <div className="space-y-4">
            {reports && (
              <>
                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Invoiced</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{formatCurrency(reports.total_invoiced)}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Collected</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(reports.total_collected)}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Collection Rate</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{reports.collection_rate}%</div>
                      <Progress value={reports.collection_rate} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>

                {/* Trial Balance */}
                <Card>
                  <CardHeader><CardTitle>Trial Balance</CardTitle><CardDescription>Double-entry accounting summary</CardDescription></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.trial_balance.map((t, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{t.account}</TableCell>
                            <TableCell className="text-right">{formatCurrency(t.debit)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(t.credit)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{formatCurrency(reports.trial_balance.reduce((s, t) => s + t.debit, 0))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(reports.trial_balance.reduce((s, t) => s + t.credit, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Votehead Collections & Payment Mode */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>Votehead Collections</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Vote Head</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {reports.votehead_collections.map((v, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{v.votehead}</TableCell>
                              <TableCell className="text-right">{formatCurrency(v.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {reports.votehead_collections.length === 0 && <p className="text-center py-4 text-muted-foreground">No collections yet</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Payment Mode Summary</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Mode</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {reports.payment_mode_summary.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium capitalize">{m.mode}</TableCell>
                              <TableCell className="text-right">{m.count}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {reports.payment_mode_summary.length === 0 && <p className="text-center py-4 text-muted-foreground">No payments yet</p>}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
            {!reports && <p className="text-center py-8 text-muted-foreground">Loading reports...</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ==================== VOTE HEADS SUB-COMPONENT ====================
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
        fee_applicable: form.fee_applicable,
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
          <div><CardTitle>Vote Heads</CardTitle><CardDescription>Fee categories with allocation priority</CardDescription></div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Vote Head</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Vote Head</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Tuition" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority (lower = paid first)</Label><Input type="number" min="1" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} /></div>
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
              <TableHead>Group</TableHead>
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

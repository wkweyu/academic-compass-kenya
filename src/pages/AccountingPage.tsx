import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, CheckCircle, XCircle, Send, Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { accountingService, ChartOfAccount, JournalEntry } from '@/services/accountingService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const typeColors: Record<string, string> = { asset: 'default', liability: 'destructive', equity: 'secondary', income: 'default', expense: 'outline' };

interface JournalLine {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description: string;
}

const emptyLine = (): JournalLine => ({ account_id: '', debit_amount: '', credit_amount: '', description: '' });

export default function AccountingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('accounts');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [accountForm, setAccountForm] = useState({ account_code: '', account_name: '', account_type: 'asset', description: '' });
  const [journalForm, setJournalForm] = useState({ reference_number: '', description: '', entry_date: new Date().toISOString().split('T')[0] });
  const [journalLines, setJournalLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  const { data: stats } = useQuery({ queryKey: ['accounting-stats'], queryFn: () => accountingService.getStats() });
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => accountingService.getAccounts() });
  const { data: entries = [], refetch: refetchEntries } = useQuery({ queryKey: ['journal-entries'], queryFn: () => accountingService.getJournalEntries() });
  const { data: trialBalance = [] } = useQuery({ queryKey: ['trial-balance'], queryFn: () => accountingService.getTrialBalance(), enabled: activeTab === 'trial-balance' });

  useEffect(() => { accountingService.seedDefaultAccounts().catch(() => {}); }, []);

  const handleCreateAccount = async () => {
    if (!accountForm.account_code || !accountForm.account_name) { toast({ title: 'Fill required fields', variant: 'destructive' }); return; }
    try {
      await accountingService.createAccount({ ...accountForm, account_type: accountForm.account_type as any, is_active: true, school_id: 0 });
      toast({ title: 'Account created' });
      setIsAccountOpen(false);
      setAccountForm({ account_code: '', account_name: '', account_type: 'asset', description: '' });
      refetchAccounts();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleCreateJournal = async () => {
    if (!journalForm.reference_number || !journalForm.description) {
      toast({ title: 'Fill reference and description', variant: 'destructive' }); return;
    }
    const validLines = journalLines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0));
    if (validLines.length < 2) { toast({ title: 'Need at least 2 lines', variant: 'destructive' }); return; }

    const totalDebit = validLines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
    const totalCredit = validLines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: 'Debits must equal credits', description: `Debit: ${formatCurrency(totalDebit)}, Credit: ${formatCurrency(totalCredit)}`, variant: 'destructive' });
      return;
    }

    try {
      await accountingService.createJournalEntry(
        { ...journalForm, status: 'draft', total_debit: totalDebit, total_credit: totalCredit, school_id: 0 },
        validLines.map(l => ({ account_id: parseInt(l.account_id), debit_amount: parseFloat(l.debit_amount) || 0, credit_amount: parseFloat(l.credit_amount) || 0, description: l.description }))
      );
      toast({ title: 'Journal entry created' });
      setIsJournalOpen(false);
      setJournalForm({ reference_number: '', description: '', entry_date: new Date().toISOString().split('T')[0] });
      setJournalLines([emptyLine(), emptyLine()]);
      refetchEntries();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handlePostEntry = async (id: number) => {
    try {
      await accountingService.postJournalEntry(id);
      toast({ title: 'Entry posted' });
      refetchEntries();
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleVoidEntry = async (id: number) => {
    if (!confirm('Void this entry? This cannot be undone.')) return;
    try {
      await accountingService.voidJournalEntry(id);
      toast({ title: 'Entry voided' });
      refetchEntries();
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleViewEntry = async (id: number) => {
    try {
      const entry = await accountingService.getJournalEntry(id);
      setSelectedEntry(entry);
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string) => {
    setJournalLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const addLine = () => setJournalLines(prev => [...prev, emptyLine()]);
  const removeLine = (index: number) => { if (journalLines.length > 2) setJournalLines(prev => prev.filter((_, i) => i !== index)); };

  const totalDebitLines = journalLines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
  const totalCreditLines = journalLines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Accounting</h1><p className="text-muted-foreground">Chart of accounts, journal entries & trial balance</p></div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active Accounts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.active_accounts}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Posted Entries</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.posted_entries}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Debits</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.total_debits)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Credits</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.total_credits)}</div></CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Chart of Accounts</CardTitle>
                <Dialog open={isAccountOpen} onOpenChange={setIsAccountOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Account</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Code *</Label><Input value={accountForm.account_code} onChange={e => setAccountForm(p => ({ ...p, account_code: e.target.value }))} placeholder="e.g., 1000" /></div>
                        <div><Label>Type *</Label>
                          <Select value={accountForm.account_type} onValueChange={v => setAccountForm(p => ({ ...p, account_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label>Name *</Label><Input value={accountForm.account_name} onChange={e => setAccountForm(p => ({ ...p, account_name: e.target.value }))} /></div>
                      <div><Label>Description</Label><Textarea value={accountForm.description} onChange={e => setAccountForm(p => ({ ...p, description: e.target.value }))} /></div>
                      <Button onClick={handleCreateAccount} className="w-full">Create Account</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {accounts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.account_code}</TableCell>
                      <TableCell className="font-medium">{a.account_name}</TableCell>
                      <TableCell><Badge variant={(typeColors[a.account_type] || 'outline') as any} className="capitalize">{a.account_type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.description || '-'}</TableCell>
                      <TableCell>{a.is_active ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {accounts.length === 0 && <p className="text-center py-8 text-muted-foreground">No accounts. Default accounts will be created automatically.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Journal Entries</CardTitle>
                <Dialog open={isJournalOpen} onOpenChange={setIsJournalOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Journal Entry</Button></DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Create Journal Entry</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label>Reference # *</Label><Input value={journalForm.reference_number} onChange={e => setJournalForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="JE-001" /></div>
                        <div><Label>Date *</Label><Input type="date" value={journalForm.entry_date} onChange={e => setJournalForm(p => ({ ...p, entry_date: e.target.value }))} /></div>
                        <div><Label>Description *</Label><Input value={journalForm.description} onChange={e => setJournalForm(p => ({ ...p, description: e.target.value }))} /></div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-base font-semibold">Lines</Label>
                          <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
                        </div>
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[35%]">Account</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="w-8"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {journalLines.map((line, i) => (
                                <TableRow key={i}>
                                  <TableCell>
                                    <Select value={line.account_id} onValueChange={v => updateLine(i, 'account_id', v)}>
                                      <SelectTrigger className="h-8"><SelectValue placeholder="Select account" /></SelectTrigger>
                                      <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.account_code} - {a.account_name}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell><Input className="h-8" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></TableCell>
                                  <TableCell><Input className="h-8 text-right" type="number" min="0" value={line.debit_amount} onChange={e => updateLine(i, 'debit_amount', e.target.value)} /></TableCell>
                                  <TableCell><Input className="h-8 text-right" type="number" min="0" value={line.credit_amount} onChange={e => updateLine(i, 'credit_amount', e.target.value)} /></TableCell>
                                  <TableCell>
                                    {journalLines.length > 2 && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeLine(i)}>×</Button>}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/50 font-medium">
                                <TableCell colSpan={2} className="text-right">Totals</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalDebitLines)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalCreditLines)}</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        {Math.abs(totalDebitLines - totalCreditLines) > 0.01 && totalDebitLines > 0 && (
                          <p className="text-sm text-destructive">Difference: {formatCurrency(Math.abs(totalDebitLines - totalCreditLines))}</p>
                        )}
                      </div>
                      <Button onClick={handleCreateJournal} className="w-full">Create Journal Entry (Draft)</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => handleViewEntry(e.id)}>
                      <TableCell>{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-sm">{e.reference_number}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(e.total_debit))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(e.total_credit))}</TableCell>
                      <TableCell><Badge variant={e.status === 'posted' ? 'default' : e.status === 'voided' ? 'destructive' : 'outline'}>{e.status}</Badge></TableCell>
                      <TableCell onClick={ev => ev.stopPropagation()}>
                        <div className="flex gap-1">
                          {e.status === 'draft' && <Button size="sm" variant="outline" onClick={() => handlePostEntry(e.id)}><Send className="h-3 w-3 mr-1" />Post</Button>}
                          {e.status === 'draft' && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleVoidEntry(e.id)}><Ban className="h-3 w-3" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {entries.length === 0 && <p className="text-center py-8 text-muted-foreground">No journal entries yet</p>}
            </CardContent>
          </Card>

          {/* Entry Detail Dialog */}
          <Dialog open={!!selectedEntry} onOpenChange={open => !open && setSelectedEntry(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Journal Entry: {selectedEntry?.reference_number}</DialogTitle></DialogHeader>
              {selectedEntry && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(selectedEntry.entry_date).toLocaleDateString()}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <Badge variant={selectedEntry.status === 'posted' ? 'default' : 'outline'}>{selectedEntry.status}</Badge></div>
                    <div><span className="text-muted-foreground">Description:</span> <span className="font-medium">{selectedEntry.description}</span></div>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(selectedEntry.lines || []).map(l => (
                        <TableRow key={l.id}>
                          <TableCell><span className="font-mono text-sm">{l.account_code}</span> - {l.account_name}</TableCell>
                          <TableCell className="text-sm">{l.description || '-'}</TableCell>
                          <TableCell className="text-right">{Number(l.debit_amount) > 0 ? formatCurrency(Number(l.debit_amount)) : '-'}</TableCell>
                          <TableCell className="text-right">{Number(l.credit_amount) > 0 ? formatCurrency(Number(l.credit_amount)) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={2}>Totals</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(selectedEntry.total_debit))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(selectedEntry.total_credit))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="trial-balance">
          <Card>
            <CardHeader><CardTitle>Trial Balance</CardTitle><CardDescription>Summary of all posted journal entries</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {trialBalance.map(t => (
                    <TableRow key={t.account_code}>
                      <TableCell className="font-mono">{t.account_code}</TableCell>
                      <TableCell className="font-medium">{t.account_name}</TableCell>
                      <TableCell className="capitalize">{t.account_type}</TableCell>
                      <TableCell className="text-right">{t.debit_total > 0 ? formatCurrency(t.debit_total) : '-'}</TableCell>
                      <TableCell className="text-right">{t.credit_total > 0 ? formatCurrency(t.credit_total) : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {trialBalance.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell className="text-right">{formatCurrency(trialBalance.reduce((s, t) => s + t.debit_total, 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(trialBalance.reduce((s, t) => s + t.credit_total, 0))}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {trialBalance.length === 0 && <p className="text-center py-8 text-muted-foreground">No posted entries for trial balance</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

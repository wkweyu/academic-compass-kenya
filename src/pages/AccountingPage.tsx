import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
import { accountingService, ChartOfAccount } from '@/services/accountingService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const typeColors: Record<string, string> = { asset: 'default', liability: 'destructive', equity: 'secondary', income: 'default', expense: 'outline' };

export default function AccountingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('accounts');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ account_code: '', account_name: '', account_type: 'asset', description: '' });

  const { data: stats } = useQuery({ queryKey: ['accounting-stats'], queryFn: () => accountingService.getStats() });
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => accountingService.getAccounts() });
  const { data: entries = [] } = useQuery({ queryKey: ['journal-entries'], queryFn: () => accountingService.getJournalEntries() });
  const { data: trialBalance = [] } = useQuery({ queryKey: ['trial-balance'], queryFn: () => accountingService.getTrialBalance(), enabled: activeTab === 'trial-balance' });

  // Seed defaults on first load
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
            <CardHeader><CardTitle>Journal Entries</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-sm">{e.reference_number}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{formatCurrency(Number(e.total_debit))}</TableCell>
                      <TableCell>{formatCurrency(Number(e.total_credit))}</TableCell>
                      <TableCell><Badge variant={e.status === 'posted' ? 'default' : e.status === 'voided' ? 'destructive' : 'outline'}>{e.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {entries.length === 0 && <p className="text-center py-8 text-muted-foreground">No journal entries yet</p>}
            </CardContent>
          </Card>
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

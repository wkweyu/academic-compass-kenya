import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { bankService, BankAccount } from '@/services/accounting/bankService';
import { accountingService } from '@/services/accountingService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function BankReconciliationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState('');
  const [form, setForm] = useState({ account_id: '', bank_name: '', account_number: '', branch: '' });

  const { data: bankAccounts = [] } = useQuery({ queryKey: ['bank-accounts'], queryFn: () => bankService.getBankAccounts() });
  const { data: accounts = [] } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => accountingService.getAccounts() });
  const { data: reconciliations = [] } = useQuery({
    queryKey: ['bank-reconciliations', selectedBank],
    queryFn: () => bankService.getReconciliations(parseInt(selectedBank)),
    enabled: !!selectedBank,
  });

  const bankAssetAccounts = accounts.filter(a => a.is_active && a.account_type === 'asset' && (a.account_code.startsWith('11') || a.account_code.startsWith('10')));

  const handleCreateBank = async () => {
    if (!form.account_id || !form.bank_name || !form.account_number) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await bankService.createBankAccount({
        account_id: parseInt(form.account_id),
        bank_name: form.bank_name,
        account_number: form.account_number,
        branch: form.branch,
        is_active: true,
      });
      toast({ title: 'Bank account added' });
      setIsOpen(false);
      setForm({ account_id: '', bank_name: '', account_number: '', branch: '' });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Bank Reconciliation</CardTitle>
            <CardDescription>Reconcile bank statements against ledger balances</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Bank Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div><Label>Linked Ledger Account *</Label>
                  <Select value={form.account_id} onValueChange={v => setForm(p => ({ ...p, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{bankAssetAccounts.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.account_code} - {a.account_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Bank Name *</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g., Kenya Commercial Bank" /></div>
                <div><Label>Account Number *</Label><Input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} /></div>
                <div><Label>Branch</Label><Input value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value }))} /></div>
                <Button onClick={handleCreateBank} className="w-full">Add Bank Account</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Select Bank Account</Label>
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Choose bank account" /></SelectTrigger>
            <SelectContent>
              {bankAccounts.map(b => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.bank_name} - {b.account_number} ({b.account_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {bankAccounts.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No bank accounts configured. Add a bank account to start reconciling.</p>
        )}

        {selectedBank && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Statement Balance</TableHead>
                  <TableHead className="text-right">Ledger Balance</TableHead>
                  <TableHead className="text-right">Adjusted Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.reconciliation_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.statement_balance))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.ledger_balance))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.adjusted_balance))}</TableCell>
                    <TableCell><Badge variant={r.status === 'completed' ? 'default' : 'outline'}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {reconciliations.length === 0 && <p className="text-center py-4 text-muted-foreground">No reconciliations yet for this bank account</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

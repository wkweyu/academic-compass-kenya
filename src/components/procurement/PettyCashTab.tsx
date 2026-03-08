import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { procurementService, PettyCashTransaction } from '@/services/procurementService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

interface Props {
  transactions: PettyCashTransaction[];
  voteHeads: { id: number; name: string }[];
  refetch: () => void;
}

export default function PettyCashTab({ transactions, voteHeads, refetch }: Props) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ transaction_type: 'Expense', amount: '', description: '', vote_head_id: '' });

  const balance = transactions.reduce((sum, t) =>
    t.transaction_type === 'Top-up' ? sum + Number(t.amount) : sum - Number(t.amount), 0
  );

  const handleCreate = async () => {
    if (!form.amount || !form.description) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await procurementService.createPettyCash({
        transaction_type: form.transaction_type,
        amount: parseFloat(form.amount),
        description: form.description,
        vote_head_id: form.vote_head_id ? parseInt(form.vote_head_id) : undefined,
        date: new Date().toISOString(),
        school_id: 0,
      });
      toast({ title: 'Transaction recorded' });
      setIsOpen(false);
      setForm({ transaction_type: 'Expense', amount: '', description: '', vote_head_id: '' });
      refetch();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Petty Cash Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(balance)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Petty Cash Transactions</CardTitle>
            <Button onClick={() => setIsOpen(true)}><Plus className="mr-2 h-4 w-4" />Record Transaction</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead>
                <TableHead>Description</TableHead><TableHead>Vote Head</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={t.transaction_type === 'Top-up' ? 'default' : 'destructive'} className="flex items-center gap-1 w-fit">
                      {t.transaction_type === 'Top-up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {t.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(t.amount))}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>{t.vote_head_name || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {transactions.length === 0 && <p className="text-center py-8 text-muted-foreground">No petty cash transactions yet</p>}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Petty Cash Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Type</Label>
              <Select value={form.transaction_type} onValueChange={v => setForm(p => ({ ...p, transaction_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Top-up">Top-up</SelectItem>
                  <SelectItem value="Expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (KES) *</Label><Input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div><Label>Description *</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Vote Head</Label>
              <Select value={form.vote_head_id || '__none__'} onValueChange={v => setForm(p => ({ ...p, vote_head_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {voteHeads.map(vh => <SelectItem key={vh.id} value={vh.id.toString()}>{vh.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="w-full">Record</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

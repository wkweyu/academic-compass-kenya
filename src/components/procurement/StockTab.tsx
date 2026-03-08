import { useState } from 'react';
import { AlertTriangle, Plus, ArrowDownToLine } from 'lucide-react';
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
import { procurementService, StockBalance, StockTransaction, ProcurementItem } from '@/services/procurementService';

interface Props {
  stockBalances: StockBalance[];
  transactions: StockTransaction[];
  items: ProcurementItem[];
  refetchStock: () => void;
  refetchTransactions: () => void;
}

export default function StockTab({ stockBalances, transactions, items, refetchStock, refetchTransactions }: Props) {
  const { toast } = useToast();
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ item_id: '', quantity: '', issued_to: '', description: '' });

  const lowStock = stockBalances.filter(s => s.is_low);

  const handleIssue = async () => {
    if (!form.item_id || !form.quantity || !form.issued_to) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await procurementService.createStockTransaction({
        item_id: parseInt(form.item_id),
        transaction_type: 'Issue',
        quantity: parseInt(form.quantity),
        transaction_date: new Date().toISOString(),
        issued_to: form.issued_to,
        description: form.description,
        school_id: 0,
      });
      toast({ title: 'Stock issued' });
      setIsIssueOpen(false);
      setForm({ item_id: '', quantity: '', issued_to: '', description: '' });
      refetchStock();
      refetchTransactions();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Low Stock Alerts ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(s => (
                <Badge key={s.item_id} variant="destructive">{s.item_name}: {s.balance} (min: {s.reorder_level})</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Stock & Inventory</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowHistory(true)}>Movement History</Button>
              <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
                <Button onClick={() => setIsIssueOpen(true)}><ArrowDownToLine className="mr-2 h-4 w-4" />Issue Stock</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle>Issue Stock</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Item *</Label>
                      <Select value={form.item_id} onValueChange={v => setForm(p => ({ ...p, item_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Quantity *</Label><Input type="number" min="1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></div>
                      <div><Label>Issued To *</Label><Input value={form.issued_to} onChange={e => setForm(p => ({ ...p, issued_to: e.target.value }))} placeholder="e.g., Kitchen, Class 4" /></div>
                    </div>
                    <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                    <Button onClick={handleIssue} className="w-full">Issue Stock</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Purchased</TableHead>
                <TableHead>Issued</TableHead><TableHead>Adjusted</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockBalances.map(s => (
                <TableRow key={s.item_id}>
                  <TableCell className="font-medium">{s.item_name}</TableCell>
                  <TableCell><Badge variant="outline">{s.category_name}</Badge></TableCell>
                  <TableCell className="text-green-600">+{s.purchased}</TableCell>
                  <TableCell className="text-red-600">-{s.issued}</TableCell>
                  <TableCell>{s.adjusted > 0 ? `+${s.adjusted}` : s.adjusted}</TableCell>
                  <TableCell className="font-bold">{s.balance}</TableCell>
                  <TableCell>
                    {s.is_low ? <Badge variant="destructive">Low</Badge> : <Badge variant="secondary">OK</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {stockBalances.length === 0 && <p className="text-center py-8 text-muted-foreground">No stock data yet</p>}
        </CardContent>
      </Card>

      {/* Movement History */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Stock Movement History</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Type</TableHead>
                <TableHead>Qty</TableHead><TableHead>Issued To</TableHead><TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                  <TableCell>{t.item_name}</TableCell>
                  <TableCell>
                    <Badge variant={t.transaction_type === 'Purchase' ? 'default' : t.transaction_type === 'Issue' ? 'destructive' : 'secondary'}>
                      {t.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.quantity}</TableCell>
                  <TableCell>{t.issued_to || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.description || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {transactions.length === 0 && <p className="text-center py-4 text-muted-foreground">No transactions yet</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

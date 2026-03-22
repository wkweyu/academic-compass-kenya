import { useState } from 'react';
import { Plus, Printer, CheckCircle, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { procurementService, PaymentVoucher, Supplier } from '@/services/procurementService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + convert(num % 100) : '');
    if (num < 1000000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    return convert(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
  };
  return convert(Math.floor(n)) + ' Shillings Only';
}

interface Props {
  vouchers: PaymentVoucher[];
  suppliers: Supplier[];
  voteHeads: { id: number; name: string }[];
  refetch: () => void;
  schoolName?: string;
}

export default function VouchersTab({ vouchers, suppliers, voteHeads, refetch, schoolName }: Props) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', amount: '', payment_mode: 'Cash', description: '', vote_head_id: '', date: new Date().toISOString().split('T')[0] });

  const handleCreate = async () => {
    if (!form.supplier_id || !form.amount) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      const pvNumber = await procurementService.generatePVNumber();
      await procurementService.createPaymentVoucher({
        voucher_number: pvNumber, supplier_id: parseInt(form.supplier_id),
        amount: parseFloat(form.amount), payment_mode: form.payment_mode,
        date: form.date, description: form.description, status: 'Draft',
        vote_head_id: form.vote_head_id ? parseInt(form.vote_head_id) : undefined,
        school_id: 0,
      });
      toast({ title: `Voucher ${pvNumber} created` });
      setIsOpen(false);
      setForm({ supplier_id: '', amount: '', payment_mode: 'Cash', description: '', vote_head_id: '', date: new Date().toISOString().split('T')[0] });
      refetch();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleApprove = async (id: number) => {
    try { await procurementService.approveVoucher(id); toast({ title: 'Voucher approved' }); refetch(); }
    catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handlePay = async (id: number) => {
    try {
      await procurementService.payVoucher(id);
      toast({ title: 'Voucher paid', description: 'Journal entry posted to accounting automatically.' });
      refetch();
    }
    catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handlePrint = (v: PaymentVoucher) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>PV ${v.voucher_number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
        .detail-grid div { padding: 8px; border: 1px solid #ddd; }
        .amount-words { background: #f9f9f9; padding: 12px; border: 1px solid #333; margin: 20px 0; font-style: italic; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
        .sig-block { border-top: 1px solid #333; padding-top: 5px; text-align: center; margin-top: 60px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <h1>${schoolName || 'School'}</h1>
        <h2>PAYMENT VOUCHER</h2>
      </div>
      <div class="detail-grid">
        <div><strong>PV No:</strong> ${v.voucher_number}</div>
        <div><strong>Date:</strong> ${new Date(v.date).toLocaleDateString()}</div>
        <div><strong>Payee:</strong> ${v.supplier_name}</div>
        <div><strong>Amount:</strong> KES ${Number(v.amount).toLocaleString()}</div>
        <div><strong>Payment Mode:</strong> ${v.payment_mode}</div>
        <div><strong>Vote Head:</strong> ${v.vote_head_name || 'N/A'}</div>
      </div>
      <div><strong>Description:</strong> ${v.description || 'N/A'}</div>
      <div class="amount-words"><strong>Amount in Words:</strong> ${numberToWords(Number(v.amount))}</div>
      <div class="signatures">
        <div><div class="sig-block">Prepared By</div></div>
        <div><div class="sig-block">Checked By</div></div>
        <div><div class="sig-block">Approved By</div></div>
        <div><div class="sig-block">Received By</div></div>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Draft': return 'outline' as const;
      case 'Approved': return 'default' as const;
      case 'Paid': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Payment Vouchers</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create Voucher</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Payment Voucher</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Supplier *</Label>
                    <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount (KES) *</Label><Input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                  <div><Label>Payment Mode</Label>
                    <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="MPESA">M-PESA</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Fees In-Kind">Fees In-Kind</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Vote Head</Label>
                  <Select value={form.vote_head_id || '__none__'} onValueChange={v => setForm(p => ({ ...p, vote_head_id: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {voteHeads.map(vh => <SelectItem key={vh.id} value={vh.id.toString()}>{vh.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <Button onClick={handleCreate} className="w-full">Create Voucher</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PV #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
              <TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Vote Head</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.voucher_number}</TableCell>
                <TableCell>{v.supplier_name}</TableCell>
                <TableCell>{new Date(v.date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{formatCurrency(Number(v.amount))}</TableCell>
                <TableCell><Badge variant="outline">{v.payment_mode}</Badge></TableCell>
                <TableCell>{v.vote_head_name || '-'}</TableCell>
                <TableCell><Badge variant={statusColor(v.status)}>{v.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => handlePrint(v)} title="Print"><Printer className="h-4 w-4" /></Button>
                  {v.status === 'Draft' && <Button size="icon" variant="ghost" onClick={() => handleApprove(v.id)} title="Approve"><CheckCircle className="h-4 w-4 text-green-600" /></Button>}
                  {v.status === 'Approved' && <Button size="icon" variant="ghost" onClick={() => handlePay(v.id)} title="Mark Paid"><CreditCard className="h-4 w-4 text-blue-600" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {vouchers.length === 0 && <p className="text-center py-8 text-muted-foreground">No payment vouchers yet</p>}
      </CardContent>
    </Card>
  );
}

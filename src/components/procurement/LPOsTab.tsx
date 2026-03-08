import { useState } from 'react';
import { Plus, Printer, Eye, CheckCircle, Truck, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { procurementService, LPO, LPOItem, Supplier, ProcurementItem } from '@/services/procurementService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

interface Props {
  lpos: LPO[];
  suppliers: Supplier[];
  inventoryItems: ProcurementItem[];
  refetch: () => void;
  refetchStock: () => void;
  schoolName?: string;
}

export default function LPOsTab({ lpos, suppliers, inventoryItems, refetch, refetchStock, schoolName }: Props) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewLPO, setViewLPO] = useState<LPO | null>(null);
  const [lpoItems, setLpoItems] = useState<LPOItem[]>([]);
  const [deliverLPO, setDeliverLPO] = useState<LPO | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');

  // Create LPO form
  const [form, setForm] = useState({ supplier_id: '', date: new Date().toISOString().split('T')[0] });
  const [newItems, setNewItems] = useState<{ item_id: string; description: string; quantity: string; unit_price: string }[]>([
    { item_id: '', description: '', quantity: '1', unit_price: '' },
  ]);

  const addLineItem = () => setNewItems(p => [...p, { item_id: '', description: '', quantity: '1', unit_price: '' }]);
  const removeLineItem = (idx: number) => setNewItems(p => p.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: string, value: string) => {
    setNewItems(p => p.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill from inventory
      if (field === 'item_id' && value) {
        const inv = inventoryItems.find(it => it.id === parseInt(value));
        if (inv) {
          updated.description = inv.name;
          updated.unit_price = String(inv.unit_price);
        }
      }
      return updated;
    }));
  };

  const getLineTotal = () => newItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  const handleCreate = async () => {
    if (!form.supplier_id || newItems.length === 0) {
      toast({ title: 'Select supplier and add items', variant: 'destructive' }); return;
    }
    try {
      const lpoNumber = await procurementService.generateLPONumber();
      const total = getLineTotal();
      const lpo = await procurementService.createLPO({
        lpo_number: lpoNumber, supplier_id: parseInt(form.supplier_id),
        total_amount: total, date: form.date, status: 'Pending', school_id: 0,
      });

      // Add line items
      for (const item of newItems) {
        if (!item.description) continue;
        const qty = parseInt(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        await procurementService.addLPOItem({
          lpo_id: lpo.id,
          item_id: item.item_id ? parseInt(item.item_id) : undefined,
          description: item.description,
          quantity: qty,
          unit_price: price,
          total_price: qty * price,
          school_id: 0,
        });
      }

      toast({ title: `LPO ${lpoNumber} created` });
      setIsCreateOpen(false);
      setForm({ supplier_id: '', date: new Date().toISOString().split('T')[0] });
      setNewItems([{ item_id: '', description: '', quantity: '1', unit_price: '' }]);
      refetch();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleViewLPO = async (lpo: LPO) => {
    setViewLPO(lpo);
    try {
      const items = await procurementService.getLPOItems(lpo.id);
      setLpoItems(items);
    } catch { setLpoItems([]); }
  };

  const handleApprove = async (id: number) => {
    try {
      await procurementService.approveLPO(id);
      toast({ title: 'LPO approved' });
      refetch();
      if (viewLPO?.id === id) setViewLPO(prev => prev ? { ...prev, status: 'Approved' } : null);
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDeliver = async () => {
    if (!deliverLPO) return;
    try {
      await procurementService.deliverLPO(deliverLPO.id, deliveryNote, deliveredBy);
      toast({ title: 'Goods received & stock updated' });
      setDeliverLPO(null);
      setDeliveryNote('');
      setDeliveredBy('');
      refetch();
      refetchStock();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handlePrint = (lpo: LPO) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>LPO ${lpo.lpo_number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; }
        h1 { text-align: center; margin-bottom: 5px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
        th { background: #f0f0f0; }
        .total { text-align: right; font-weight: bold; font-size: 1.1em; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
        .sig-block { border-top: 1px solid #333; padding-top: 5px; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <h1>${schoolName || 'School'}</h1>
        <h2>LOCAL PURCHASE ORDER</h2>
      </div>
      <div class="meta">
        <div><strong>LPO No:</strong> ${lpo.lpo_number}<br/><strong>Date:</strong> ${new Date(lpo.date).toLocaleDateString()}</div>
        <div><strong>Supplier:</strong> ${lpo.supplier_name}<br/><strong>Status:</strong> ${lpo.status}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>${lpoItems.map((item, i) => `<tr><td>${i + 1}</td><td>${item.description}</td><td>${item.quantity}</td><td>KES ${Number(item.unit_price).toLocaleString()}</td><td>KES ${Number(item.total_price).toLocaleString()}</td></tr>`).join('')}</tbody>
      </table>
      <p class="total">Grand Total: KES ${Number(lpo.total_amount).toLocaleString()}</p>
      <div class="signatures">
        <div><div class="sig-block">Prepared By</div></div>
        <div><div class="sig-block">Approved By</div></div>
        <div><div class="sig-block">Received By (Supplier)</div></div>
        <div><div class="sig-block">Delivery Confirmed By</div></div>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Pending': return 'outline' as const;
      case 'Approved': return 'default' as const;
      case 'Delivered': return 'secondary' as const;
      case 'Paid': return 'default' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Local Purchase Orders</CardTitle>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create LPO</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
                <DialogHeader><DialogTitle>Create LPO</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Supplier *</Label>
                      <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-base font-semibold">Line Items</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addLineItem}>+ Add Item</Button>
                    </div>
                    {newItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-3">
                          {idx === 0 && <Label className="text-xs">From Inventory</Label>}
                          <Select value={item.item_id || '__none__'} onValueChange={v => updateLineItem(idx, 'item_id', v === '__none__' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Ad-hoc</SelectItem>
                              {inventoryItems.map(i => <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4">
                          {idx === 0 && <Label className="text-xs">Description *</Label>}
                          <Input value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="Item description" />
                        </div>
                        <div className="col-span-2">
                          {idx === 0 && <Label className="text-xs">Qty</Label>}
                          <Input type="number" min="1" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          {idx === 0 && <Label className="text-xs">Unit Price</Label>}
                          <Input type="number" min="0" value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                          {newItems.length > 1 && (
                            <Button size="icon" variant="ghost" onClick={() => removeLineItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-right font-semibold mt-2">Total: {formatCurrency(getLineTotal())}</p>
                  </div>

                  <Button onClick={handleCreate} className="w-full">Create LPO</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LPO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lpos.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.lpo_number}</TableCell>
                  <TableCell>{l.supplier_name}</TableCell>
                  <TableCell>{new Date(l.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(l.total_amount))}</TableCell>
                  <TableCell><Badge variant={statusColor(l.status)}>{l.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => handleViewLPO(l)} title="View"><Eye className="h-4 w-4" /></Button>
                    {l.status === 'Pending' && (
                      <Button size="icon" variant="ghost" onClick={() => handleApprove(l.id)} title="Approve"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                    )}
                    {l.status === 'Approved' && (
                      <Button size="icon" variant="ghost" onClick={() => setDeliverLPO(l)} title="Receive Goods"><Truck className="h-4 w-4 text-blue-600" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {lpos.length === 0 && <p className="text-center py-8 text-muted-foreground">No LPOs yet</p>}
        </CardContent>
      </Card>

      {/* View LPO Detail */}
      <Dialog open={!!viewLPO} onOpenChange={(o) => { if (!o) setViewLPO(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>LPO {viewLPO?.lpo_number}</DialogTitle></DialogHeader>
          {viewLPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Supplier:</span> <strong>{viewLPO.supplier_name}</strong></div>
                <div><span className="text-muted-foreground">Date:</span> <strong>{new Date(viewLPO.date).toLocaleDateString()}</strong></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusColor(viewLPO.status)}>{viewLPO.status}</Badge></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>#</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Total</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {lpoItems.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(item.unit_price))}</TableCell>
                      <TableCell>{formatCurrency(Number(item.total_price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-right font-bold text-lg">Total: {formatCurrency(Number(viewLPO.total_amount))}</p>
              {viewLPO.delivery_note && (
                <div className="text-sm p-3 bg-muted rounded-md">
                  <p><strong>Delivery Note:</strong> {viewLPO.delivery_note}</p>
                  <p><strong>Delivered By:</strong> {viewLPO.delivered_by}</p>
                  <p><strong>Delivery Date:</strong> {viewLPO.delivery_date ? new Date(viewLPO.delivery_date).toLocaleDateString() : '-'}</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => handlePrint(viewLPO)}><Printer className="mr-2 h-4 w-4" />Print</Button>
                {viewLPO.status === 'Pending' && <Button onClick={() => handleApprove(viewLPO.id)}>Approve</Button>}
                {viewLPO.status === 'Approved' && <Button onClick={() => { setViewLPO(null); setDeliverLPO(viewLPO); }}>Receive Goods</Button>}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Goods Receipt Dialog */}
      <Dialog open={!!deliverLPO} onOpenChange={(o) => { if (!o) setDeliverLPO(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Goods Receipt — {deliverLPO?.lpo_number}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Confirm receipt of goods from <strong>{deliverLPO?.supplier_name}</strong>. Stock will be updated automatically.</p>
            <div><Label>Delivery Note / GRN #</Label><Input value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} placeholder="e.g., DN-2026-001" /></div>
            <div><Label>Delivered By</Label><Input value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} placeholder="Driver/person name" /></div>
            <Button onClick={handleDeliver} className="w-full">Confirm Receipt & Update Stock</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

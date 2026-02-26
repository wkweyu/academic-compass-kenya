import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Users, FileText, Plus, ShoppingCart, Loader2 } from 'lucide-react';
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
import { procurementService } from '@/services/procurementService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function ProcurementPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('suppliers');
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', kra_pin: '', category: '', opening_balance: '0' });

  const { data: stats } = useQuery({ queryKey: ['procurement-stats'], queryFn: () => procurementService.getStats() });
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => procurementService.getSuppliers() });
  const { data: items = [] } = useQuery({ queryKey: ['procurement-items'], queryFn: () => procurementService.getItems() });
  const { data: lpos = [] } = useQuery({ queryKey: ['lpos'], queryFn: () => procurementService.getLPOs() });
  const { data: vouchers = [] } = useQuery({ queryKey: ['payment-vouchers'], queryFn: () => procurementService.getPaymentVouchers() });

  const handleCreateSupplier = async () => {
    if (!supplierForm.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    try {
      await procurementService.createSupplier({
        name: supplierForm.name, phone: supplierForm.phone, address: supplierForm.address,
        kra_pin: supplierForm.kra_pin, category: supplierForm.category,
        opening_balance: parseFloat(supplierForm.opening_balance) || 0,
        has_student_account: false, school_id: 0,
      });
      toast({ title: 'Supplier created' });
      setIsSupplierOpen(false);
      setSupplierForm({ name: '', phone: '', address: '', kra_pin: '', category: '', opening_balance: '0' });
      refetchSuppliers();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
          <p className="text-muted-foreground">Suppliers, items, LPOs, stock & payment vouchers</p>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Suppliers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.supplier_count}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.item_count}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending LPOs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pending_lpos}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total LPO Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.total_lpo_value)}</div></CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="lpos">LPOs</TabsTrigger>
          <TabsTrigger value="vouchers">Payment Vouchers</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Suppliers</CardTitle>
                <Dialog open={isSupplierOpen} onOpenChange={setIsSupplierOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Supplier</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div><Label>Name *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Phone</Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))} /></div>
                        <div><Label>KRA PIN</Label><Input value={supplierForm.kra_pin} onChange={e => setSupplierForm(p => ({ ...p, kra_pin: e.target.value }))} /></div>
                      </div>
                      <div><Label>Address</Label><Input value={supplierForm.address} onChange={e => setSupplierForm(p => ({ ...p, address: e.target.value }))} /></div>
                      <div><Label>Category</Label><Input value={supplierForm.category} onChange={e => setSupplierForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g., Stationery, Food" /></div>
                      <Button onClick={handleCreateSupplier} className="w-full">Create Supplier</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Category</TableHead><TableHead>KRA PIN</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.phone}</TableCell>
                      <TableCell><Badge variant="outline">{s.category || 'N/A'}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{s.kra_pin || '-'}</TableCell>
                      <TableCell>{formatCurrency(Number(s.opening_balance))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {suppliers.length === 0 && <p className="text-center py-8 text-muted-foreground">No suppliers yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card><CardHeader><CardTitle>Items & Inventory</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Unit Price</TableHead><TableHead>Reorder Level</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell><Badge variant="outline">{i.category_name}</Badge></TableCell>
                      <TableCell>{formatCurrency(Number(i.unit_price))}</TableCell>
                      <TableCell>{i.reorder_level}</TableCell>
                      <TableCell><Badge variant="secondary">{i.is_consumable ? 'Consumable' : 'Non-consumable'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {items.length === 0 && <p className="text-center py-8 text-muted-foreground">No items yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lpos">
          <Card><CardHeader><CardTitle>Local Purchase Orders</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>LPO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {lpos.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono">{l.lpo_number}</TableCell>
                      <TableCell>{l.supplier_name}</TableCell>
                      <TableCell>{new Date(l.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(l.total_amount))}</TableCell>
                      <TableCell><Badge variant={l.status === 'approved' ? 'default' : 'outline'}>{l.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {lpos.length === 0 && <p className="text-center py-8 text-muted-foreground">No LPOs yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vouchers">
          <Card><CardHeader><CardTitle>Payment Vouchers</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Voucher #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {vouchers.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono">{v.voucher_number}</TableCell>
                      <TableCell>{v.supplier_name}</TableCell>
                      <TableCell>{new Date(v.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(v.amount))}</TableCell>
                      <TableCell><Badge variant="outline">{v.payment_mode}</Badge></TableCell>
                      <TableCell><Badge variant={v.status === 'paid' ? 'default' : 'outline'}>{v.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {vouchers.length === 0 && <p className="text-center py-8 text-muted-foreground">No payment vouchers yet</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

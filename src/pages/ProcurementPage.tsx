import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, ShoppingCart } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { procurementService } from '@/services/procurementService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function ProcurementPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('suppliers');
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isItemOpen, setIsItemOpen] = useState(false);
  const [isLPOOpen, setIsLPOOpen] = useState(false);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', kra_pin: '', category: '', opening_balance: '0' });
  const [itemForm, setItemForm] = useState({ name: '', category_id: '', unit_price: '', reorder_level: '10', is_consumable: true, preferred_supplier_id: '' });
  const [lpoForm, setLPOForm] = useState({ lpo_number: '', supplier_id: '', total_amount: '', date: new Date().toISOString().split('T')[0] });
  const [voucherForm, setVoucherForm] = useState({ voucher_number: '', supplier_id: '', amount: '', payment_mode: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
  const [categoryName, setCategoryName] = useState('');

  const { data: stats } = useQuery({ queryKey: ['procurement-stats'], queryFn: () => procurementService.getStats() });
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => procurementService.getSuppliers() });
  const { data: items = [], refetch: refetchItems } = useQuery({ queryKey: ['procurement-items'], queryFn: () => procurementService.getItems() });
  const { data: lpos = [], refetch: refetchLPOs } = useQuery({ queryKey: ['lpos'], queryFn: () => procurementService.getLPOs() });
  const { data: vouchers = [], refetch: refetchVouchers } = useQuery({ queryKey: ['payment-vouchers'], queryFn: () => procurementService.getPaymentVouchers() });
  const { data: categories = [], refetch: refetchCategories } = useQuery({ queryKey: ['item-categories'], queryFn: () => procurementService.getItemCategories() });

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

  const handleCreateCategory = async () => {
    if (!categoryName) return;
    try {
      await procurementService.createItemCategory(categoryName);
      toast({ title: 'Category created' });
      setCategoryName('');
      setIsCategoryOpen(false);
      refetchCategories();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleCreateItem = async () => {
    if (!itemForm.name || !itemForm.category_id || !itemForm.unit_price) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await procurementService.createItem({
        name: itemForm.name, category_id: parseInt(itemForm.category_id),
        unit_price: parseFloat(itemForm.unit_price), reorder_level: parseInt(itemForm.reorder_level) || 10,
        is_consumable: itemForm.is_consumable,
        preferred_supplier_id: itemForm.preferred_supplier_id ? parseInt(itemForm.preferred_supplier_id) : undefined,
        school_id: 0,
      });
      toast({ title: 'Item created' });
      setIsItemOpen(false);
      setItemForm({ name: '', category_id: '', unit_price: '', reorder_level: '10', is_consumable: true, preferred_supplier_id: '' });
      refetchItems();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleCreateLPO = async () => {
    if (!lpoForm.lpo_number || !lpoForm.supplier_id || !lpoForm.total_amount) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await procurementService.createLPO({
        lpo_number: lpoForm.lpo_number, supplier_id: parseInt(lpoForm.supplier_id),
        total_amount: parseFloat(lpoForm.total_amount), date: lpoForm.date, status: 'pending', school_id: 0,
      });
      toast({ title: 'LPO created' });
      setIsLPOOpen(false);
      setLPOForm({ lpo_number: '', supplier_id: '', total_amount: '', date: new Date().toISOString().split('T')[0] });
      refetchLPOs();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleCreateVoucher = async () => {
    if (!voucherForm.voucher_number || !voucherForm.supplier_id || !voucherForm.amount) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await procurementService.createPaymentVoucher({
        voucher_number: voucherForm.voucher_number, supplier_id: parseInt(voucherForm.supplier_id),
        amount: parseFloat(voucherForm.amount), payment_mode: voucherForm.payment_mode,
        date: voucherForm.date, description: voucherForm.description, status: 'pending', school_id: 0,
      });
      toast({ title: 'Voucher created' });
      setIsVoucherOpen(false);
      setVoucherForm({ voucher_number: '', supplier_id: '', amount: '', payment_mode: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
      refetchVouchers();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleApproveLPO = async (id: number) => {
    try {
      await procurementService.updateLPO(id, { status: 'approved' });
      toast({ title: 'LPO approved' }); refetchLPOs();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Procurement</h1><p className="text-muted-foreground">Suppliers, items, LPOs, stock & payment vouchers</p></div>

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

        {/* Suppliers */}
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

        {/* Items */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Items & Inventory</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="sm">+ Category</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div><Label>Name *</Label><Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g., Stationery" /></div>
                        <Button onClick={handleCreateCategory} className="w-full">Create</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={isItemOpen} onOpenChange={setIsItemOpen}>
                    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div><Label>Name *</Label><Input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Category *</Label>
                            <Select value={itemForm.category_id} onValueChange={v => setItemForm(p => ({ ...p, category_id: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div><Label>Unit Price *</Label><Input type="number" min="0" value={itemForm.unit_price} onChange={e => setItemForm(p => ({ ...p, unit_price: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Reorder Level</Label><Input type="number" min="0" value={itemForm.reorder_level} onChange={e => setItemForm(p => ({ ...p, reorder_level: e.target.value }))} /></div>
                          <div><Label>Preferred Supplier</Label>
                            <Select value={itemForm.preferred_supplier_id} onValueChange={v => setItemForm(p => ({ ...p, preferred_supplier_id: v }))}>
                              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={itemForm.is_consumable} onCheckedChange={v => setItemForm(p => ({ ...p, is_consumable: !!v }))} />
                          <Label>Consumable item</Label>
                        </div>
                        <Button onClick={handleCreateItem} className="w-full">Create Item</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
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
              {items.length === 0 && <p className="text-center py-8 text-muted-foreground">No items yet. Add categories first, then items.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LPOs */}
        <TabsContent value="lpos">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Local Purchase Orders</CardTitle>
                <Dialog open={isLPOOpen} onOpenChange={setIsLPOOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create LPO</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create LPO</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>LPO Number *</Label><Input value={lpoForm.lpo_number} onChange={e => setLPOForm(p => ({ ...p, lpo_number: e.target.value }))} placeholder="LPO-001" /></div>
                        <div><Label>Date</Label><Input type="date" value={lpoForm.date} onChange={e => setLPOForm(p => ({ ...p, date: e.target.value }))} /></div>
                      </div>
                      <div><Label>Supplier *</Label>
                        <Select value={lpoForm.supplier_id} onValueChange={v => setLPOForm(p => ({ ...p, supplier_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                          <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Total Amount (KES) *</Label><Input type="number" min="0" value={lpoForm.total_amount} onChange={e => setLPOForm(p => ({ ...p, total_amount: e.target.value }))} /></div>
                      <Button onClick={handleCreateLPO} className="w-full">Create LPO</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>LPO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {lpos.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono">{l.lpo_number}</TableCell>
                      <TableCell>{l.supplier_name}</TableCell>
                      <TableCell>{new Date(l.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(l.total_amount))}</TableCell>
                      <TableCell><Badge variant={l.status === 'approved' ? 'default' : 'outline'}>{l.status}</Badge></TableCell>
                      <TableCell>
                        {l.status === 'pending' && <Button size="sm" variant="outline" onClick={() => handleApproveLPO(l.id)}>Approve</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {lpos.length === 0 && <p className="text-center py-8 text-muted-foreground">No LPOs yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Vouchers */}
        <TabsContent value="vouchers">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Payment Vouchers</CardTitle>
                <Dialog open={isVoucherOpen} onOpenChange={setIsVoucherOpen}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create Voucher</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Payment Voucher</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Voucher # *</Label><Input value={voucherForm.voucher_number} onChange={e => setVoucherForm(p => ({ ...p, voucher_number: e.target.value }))} placeholder="PV-001" /></div>
                        <div><Label>Date</Label><Input type="date" value={voucherForm.date} onChange={e => setVoucherForm(p => ({ ...p, date: e.target.value }))} /></div>
                      </div>
                      <div><Label>Supplier *</Label>
                        <Select value={voucherForm.supplier_id} onValueChange={v => setVoucherForm(p => ({ ...p, supplier_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                          <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Amount (KES) *</Label><Input type="number" min="0" value={voucherForm.amount} onChange={e => setVoucherForm(p => ({ ...p, amount: e.target.value }))} /></div>
                        <div><Label>Payment Mode</Label>
                          <Select value={voucherForm.payment_mode} onValueChange={v => setVoucherForm(p => ({ ...p, payment_mode: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="mpesa">M-PESA</SelectItem>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label>Description</Label><Textarea value={voucherForm.description} onChange={e => setVoucherForm(p => ({ ...p, description: e.target.value }))} /></div>
                      <Button onClick={handleCreateVoucher} className="w-full">Create Voucher</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
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

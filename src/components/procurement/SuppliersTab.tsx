import { useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { procurementService, Supplier, SupplierLedgerEntry } from '@/services/procurementService';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

interface Props {
  suppliers: Supplier[];
  refetch: () => void;
}

export default function SuppliersTab({ suppliers, refetch }: Props) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerData, setLedgerData] = useState<{ entries: SupplierLedgerEntry[]; openingBalance: number } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', kra_pin: '', category: '', opening_balance: '0' });

  const resetForm = () => {
    setForm({ name: '', phone: '', address: '', kra_pin: '', category: '', opening_balance: '0' });
    setEditingId(null);
  };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name, phone: s.phone || '', address: s.address || '',
      kra_pin: s.kra_pin || '', category: s.category || '',
      opening_balance: String(s.opening_balance || 0),
    });
    setEditingId(s.id);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    try {
      const payload = {
        name: form.name, phone: form.phone, address: form.address,
        kra_pin: form.kra_pin, category: form.category,
        opening_balance: parseFloat(form.opening_balance) || 0,
        has_student_account: false, school_id: 0,
      };
      if (editingId) {
        await procurementService.updateSupplier(editingId, payload);
        toast({ title: 'Supplier updated' });
      } else {
        await procurementService.createSupplier(payload);
        toast({ title: 'Supplier created' });
      }
      setIsOpen(false);
      resetForm();
      refetch();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await procurementService.deleteSupplier(deleteId);
      toast({ title: 'Supplier deleted' });
      setDeleteId(null);
      refetch();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openLedger = async (s: Supplier) => {
    setLedgerSupplier(s);
    try {
      const data = await procurementService.getSupplierLedger(s.id);
      setLedgerData(data);
    } catch (e: any) { toast({ title: 'Error loading ledger', description: e.message, variant: 'destructive' }); }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Suppliers</CardTitle>
            <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Supplier</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Supplier</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><Label>KRA PIN</Label><Input value={form.kra_pin} onChange={e => setForm(p => ({ ...p, kra_pin: e.target.value }))} /></div>
                  </div>
                  <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g., Stationery" /></div>
                    <div><Label>Opening Balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: e.target.value }))} /></div>
                  </div>
                  <Button onClick={handleSave} className="w-full">{editingId ? 'Update' : 'Create'} Supplier</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Category</TableHead>
                <TableHead>KRA PIN</TableHead><TableHead>Opening Bal.</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.phone || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{s.category || 'N/A'}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{s.kra_pin || '-'}</TableCell>
                  <TableCell>{formatCurrency(Number(s.opening_balance))}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openLedger(s)} title="Ledger"><BookOpen className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {suppliers.length === 0 && <p className="text-center py-8 text-muted-foreground">No suppliers yet</p>}
        </CardContent>
      </Card>

      {/* Supplier Ledger Dialog */}
      <Dialog open={!!ledgerSupplier} onOpenChange={(o) => { if (!o) { setLedgerSupplier(null); setLedgerData(null); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Supplier Ledger: {ledgerSupplier?.name}</DialogTitle></DialogHeader>
          {ledgerData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Opening Balance: <span className="font-semibold text-foreground">{formatCurrency(ledgerData.openingBalance)}</span></p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerData.entries.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{e.reference}</TableCell>
                      <TableCell className="text-right">{e.debit ? formatCurrency(e.debit) : '-'}</TableCell>
                      <TableCell className="text-right">{e.credit ? formatCurrency(e.credit) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(e.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {ledgerData.entries.length === 0 && <p className="text-center py-4 text-muted-foreground">No transactions found</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Supplier"
        description="This will permanently delete this supplier and cannot be undone."
      />
    </>
  );
}

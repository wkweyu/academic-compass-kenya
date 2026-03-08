import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { procurementService, ProcurementItem, ItemCategory, Supplier, StockBalance } from '@/services/procurementService';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

interface Props {
  items: ProcurementItem[];
  categories: ItemCategory[];
  suppliers: Supplier[];
  stockBalances: StockBalance[];
  refetchItems: () => void;
  refetchCategories: () => void;
}

export default function ItemsTab({ items, categories, suppliers, stockBalances, refetchItems, refetchCategories }: Props) {
  const { toast } = useToast();
  const [isItemOpen, setIsItemOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [form, setForm] = useState({ name: '', category_id: '', unit_price: '', reorder_level: '10', is_consumable: true, preferred_supplier_id: '' });

  const resetForm = () => {
    setForm({ name: '', category_id: '', unit_price: '', reorder_level: '10', is_consumable: true, preferred_supplier_id: '' });
    setEditingId(null);
  };

  const openEdit = (item: ProcurementItem) => {
    setForm({
      name: item.name, category_id: String(item.category_id),
      unit_price: String(item.unit_price), reorder_level: String(item.reorder_level),
      is_consumable: item.is_consumable,
      preferred_supplier_id: item.preferred_supplier_id ? String(item.preferred_supplier_id) : '',
    });
    setEditingId(item.id);
    setIsItemOpen(true);
  };

  const handleSaveItem = async () => {
    if (!form.name || !form.category_id || !form.unit_price) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      const payload = {
        name: form.name, category_id: parseInt(form.category_id),
        unit_price: parseFloat(form.unit_price), reorder_level: parseInt(form.reorder_level) || 10,
        is_consumable: form.is_consumable,
        preferred_supplier_id: form.preferred_supplier_id ? parseInt(form.preferred_supplier_id) : undefined,
        school_id: 0,
      };
      if (editingId) {
        await procurementService.updateItem(editingId, payload);
        toast({ title: 'Item updated' });
      } else {
        await procurementService.createItem(payload);
        toast({ title: 'Item created' });
      }
      setIsItemOpen(false);
      resetForm();
      refetchItems();
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

  const getStockBalance = (itemId: number) => {
    const sb = stockBalances.find(s => s.item_id === itemId);
    return sb?.balance ?? 0;
  };

  const isLow = (itemId: number) => {
    const sb = stockBalances.find(s => s.item_id === itemId);
    return sb?.is_low ?? false;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Items & Categories</CardTitle>
            <div className="flex gap-2">
              <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                <DialogTrigger asChild><Button variant="outline" size="sm">+ Category</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Name *</Label><Input value={categoryName} onChange={e => setCategoryName(e.target.value)} /></div>
                    <Button onClick={handleCreateCategory} className="w-full">Create</Button>
                  </div>
                  {categories.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium mb-2">Existing Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                          <Badge key={c.id} variant="secondary" className="cursor-pointer" onClick={() => setDeleteCatId(c.id)}>
                            {c.name} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Dialog open={isItemOpen} onOpenChange={(o) => { setIsItemOpen(o); if (!o) resetForm(); }}>
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Item</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Category *</Label>
                        <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Unit Price *</Label><Input type="number" min="0" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Reorder Level</Label><Input type="number" min="0" value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))} /></div>
                      <div><Label>Preferred Supplier</Label>
                        <Select value={form.preferred_supplier_id || '__none__'} onValueChange={v => setForm(p => ({ ...p, preferred_supplier_id: v === '__none__' ? '' : v }))}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.is_consumable} onCheckedChange={v => setForm(p => ({ ...p, is_consumable: !!v }))} />
                      <Label>Consumable item</Label>
                    </div>
                    <Button onClick={handleSaveItem} className="w-full">{editingId ? 'Update' : 'Create'} Item</Button>
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
                <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Unit Price</TableHead>
                <TableHead>Stock</TableHead><TableHead>Reorder</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><Badge variant="outline">{i.category_name}</Badge></TableCell>
                  <TableCell>{formatCurrency(Number(i.unit_price))}</TableCell>
                  <TableCell>
                    <Badge variant={isLow(i.id) ? 'destructive' : 'secondary'}>{getStockBalance(i.id)}</Badge>
                  </TableCell>
                  <TableCell>{i.reorder_level}</TableCell>
                  <TableCell><Badge variant="outline">{i.is_consumable ? 'Consumable' : 'Non-consumable'}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length === 0 && <p className="text-center py-8 text-muted-foreground">No items yet. Add categories first.</p>}
        </CardContent>
      </Card>

      <DeleteConfirmationDialog isOpen={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={async () => { if (deleteId) { await procurementService.deleteItem(deleteId); toast({ title: 'Item deleted' }); setDeleteId(null); refetchItems(); } }}
        title="Delete Item" description="This will permanently delete this item." />

      <DeleteConfirmationDialog isOpen={!!deleteCatId} onOpenChange={(o) => { if (!o) setDeleteCatId(null); }}
        onConfirm={async () => { if (deleteCatId) { await procurementService.deleteItemCategory(deleteCatId); toast({ title: 'Category deleted' }); setDeleteCatId(null); refetchCategories(); } }}
        title="Delete Category" description="This will delete this category. Items using it must be reassigned first." />
    </>
  );
}

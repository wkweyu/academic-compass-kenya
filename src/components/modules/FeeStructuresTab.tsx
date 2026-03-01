import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { feesService, VoteHead, StructureGroup } from '@/services/feesService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export function FeeStructuresTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', term: '1', year: new Date().getFullYear().toString(), student_group: 'all',
  });
  const [items, setItems] = useState<{ vote_head_id: string; amount: string }[]>([]);

  const { data: groups = [], refetch } = useQuery({
    queryKey: ['fee-structure-groups'],
    queryFn: () => feesService.getStructureGroups(),
  });

  const { data: voteHeads = [] } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const addItem = () => setItems([...items, { vote_head_id: '', amount: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: string) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const handleCreate = async () => {
    if (!form.name || items.length === 0) {
      toast({ title: 'Name and at least one item required', variant: 'destructive' });
      return;
    }
    const validItems = items.filter(i => i.vote_head_id && i.amount);
    if (validItems.length === 0) {
      toast({ title: 'Fill all item fields', variant: 'destructive' });
      return;
    }
    try {
      await feesService.createStructureGroup(
        form.name, parseInt(form.year), parseInt(form.term), form.student_group,
        validItems.map(i => ({ vote_head_id: parseInt(i.vote_head_id), amount: parseFloat(i.amount) }))
      );
      toast({ title: 'Fee structure created' });
      setIsOpen(false);
      setForm({ name: '', term: '1', year: new Date().getFullYear().toString(), student_group: 'all' });
      setItems([]);
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this fee structure and all its items?')) return;
    try {
      await feesService.deleteStructureGroup(id);
      toast({ title: 'Deleted' });
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fee Structures</CardTitle>
            <CardDescription>Define fee structures with multiple vote head items per term</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Structure</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Fee Structure</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div><Label>Structure Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Day Scholar Fees 2026 T1" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Term</Label>
                    <Select value={form.term} onValueChange={v => setForm(p => ({ ...p, term: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} /></div>
                  <div><Label>Student Group</Label>
                    <Select value={form.student_group} onValueChange={v => setForm(p => ({ ...p, student_group: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="day">Day</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Fee Items</Label>
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Select value={item.vote_head_id} onValueChange={v => updateItem(i, 'vote_head_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Vote Head" /></SelectTrigger>
                        <SelectContent>
                          {voteHeads.map(vh => <SelectItem key={vh.id} value={vh.id.toString()}>{vh.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" className="w-32" placeholder="Amount" value={item.amount} onChange={e => updateItem(i, 'amount', e.target.value)} />
                      <Button variant="ghost" size="sm" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {items.length > 0 && (
                    <div className="text-right font-medium text-sm border-t pt-2">
                      Total: {formatCurrency(total)}
                    </div>
                  )}
                  {items.length === 0 && <p className="text-sm text-muted-foreground">Click "Add Item" to add vote head charges</p>}
                </div>

                <Button onClick={handleCreate} className="w-full">Create Structure</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {groups.map(g => (
          <div key={g.id} className="border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">{g.name}</h3>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">Term {g.term}</Badge>
                  <Badge variant="outline">{g.academic_year}</Badge>
                  <Badge variant="secondary">{g.student_group}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatCurrency(g.total || 0)}</span>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vote Head</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(g.items || []).map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.vote_head_name}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(item.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4" />
            <p>No fee structures defined. Create one with multiple vote head items.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

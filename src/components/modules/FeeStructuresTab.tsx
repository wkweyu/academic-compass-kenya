import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { feesService, FeeStructureItem, VoteHead } from '@/services/feesService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export function FeeStructuresTab() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    vote_head_id: '', amount: '', term: '1', year: new Date().getFullYear().toString(),
  });

  const { data: structures = [], refetch } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => feesService.getFeeStructures(),
  });

  const { data: voteHeads = [] } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const handleCreate = async () => {
    if (!form.vote_head_id || !form.amount) {
      toast({ title: 'Fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      await feesService.createFeeStructure({
        vote_head_id: parseInt(form.vote_head_id),
        amount: parseFloat(form.amount),
        term: parseInt(form.term),
        year: parseInt(form.year),
        school_id: 0,
      });
      toast({ title: 'Fee structure created' });
      setIsOpen(false);
      setForm({ vote_head_id: '', amount: '', term: '1', year: new Date().getFullYear().toString() });
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this fee structure?')) return;
    try {
      await feesService.deleteFeeStructure(id);
      toast({ title: 'Deleted' });
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fee Structures</CardTitle>
            <CardDescription>Define amounts per vote head, term & year</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Structure</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Fee Structure</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Vote Head *</Label>
                  <Select value={form.vote_head_id} onValueChange={v => setForm(p => ({ ...p, vote_head_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vote head" /></SelectTrigger>
                    <SelectContent>
                      {voteHeads.map(vh => <SelectItem key={vh.id} value={vh.id.toString()}>{vh.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount (KES) *</Label><Input type="number" min="0" step="100" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Term</Label>
                    <Select value={form.term} onValueChange={v => setForm(p => ({ ...p, term: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} /></div>
                </div>
                <Button onClick={handleCreate} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vote Head</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {structures.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.vote_head_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{formatCurrency(Number(s.amount))}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">Term {s.term}</Badge></TableCell>
                <TableCell>{s.year}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {structures.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4" />
            <p>No fee structures defined yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

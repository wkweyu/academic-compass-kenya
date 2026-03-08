import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Lock, Unlock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { fiscalYearService } from '@/services/accounting/fiscalYearService';

export default function FiscalYearManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });

  const { data: fiscalYears = [] } = useQuery({ queryKey: ['fiscal-years'], queryFn: () => fiscalYearService.getAll() });

  const handleCreate = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast({ title: 'Fill all fields', variant: 'destructive' }); return;
    }
    try {
      await fiscalYearService.create({ ...form, is_locked: false, is_current: false });
      toast({ title: 'Fiscal year created' });
      setIsCreateOpen(false);
      setForm({ name: '', start_date: '', end_date: '' });
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleLock = async (id: number) => {
    if (!confirm('Lock this fiscal year? No more entries can be posted to this period.')) return;
    try {
      await fiscalYearService.lock(id);
      toast({ title: 'Fiscal year locked' });
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleSetCurrent = async (id: number) => {
    try {
      await fiscalYearService.setCurrent(id);
      toast({ title: 'Current fiscal year updated' });
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const currentFY = fiscalYears.find(fy => fy.is_current);

  return (
    <div className="flex items-center gap-2">
      {currentFY && (
        <Badge variant="outline" className="text-sm">
          FY: {currentFY.name}
        </Badge>
      )}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Manage Fiscal Years</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Fiscal Years</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Button size="sm" onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Fiscal Year</Button>

            {isCreateOpen && (
              <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., FY 2025/2026" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                  <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate}>Create</Button>
                  <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {fiscalYears.map(fy => (
                  <TableRow key={fy.id}>
                    <TableCell className="font-medium">{fy.name}</TableCell>
                    <TableCell className="text-sm">{new Date(fy.start_date).toLocaleDateString()} - {new Date(fy.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {fy.is_current && <Badge className="text-xs">Current</Badge>}
                        {fy.is_locked && <Badge variant="destructive" className="text-xs">Locked</Badge>}
                        {!fy.is_locked && !fy.is_current && <Badge variant="outline" className="text-xs">Open</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!fy.is_current && !fy.is_locked && (
                          <Button variant="ghost" size="sm" onClick={() => handleSetCurrent(fy.id)} title="Set as current"><Star className="h-3 w-3" /></Button>
                        )}
                        {!fy.is_locked && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleLock(fy.id)} title="Lock"><Lock className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {fiscalYears.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No fiscal years configured</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

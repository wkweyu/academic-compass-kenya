import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CirclePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { feesService } from '@/services/feesService';

const DEBIT_TYPES = [
  { value: 'tour', label: 'Tour Fees' },
  { value: 'activity', label: 'Activity Fees' },
  { value: 'sports', label: 'Sports Fees' },
  { value: 'library_fine', label: 'Library Fine' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'damage', label: 'Damage / Breakage' },
  { value: 'custom', label: 'Custom / Other' },
];

export function AdditionalDebitsDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: '', amount: '', debit_type: 'custom', description: '',
    term: '1', year: new Date().getFullYear().toString(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-fees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
  });

  const { data: voteHeads = [] } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const handleSubmit = async () => {
    if (!form.student_id || !form.amount || !form.description) {
      toast({ title: 'Fill all required fields', variant: 'destructive' });
      return;
    }

    try {
      const schoolId = await supabase.rpc('get_user_school_id');
      if (!schoolId.data) throw new Error('No school');

      // Find or use first votehead
      const debitLabel = DEBIT_TYPES.find(d => d.value === form.debit_type)?.label || form.debit_type;
      let voteHeadId = voteHeads[0]?.id;
      
      // Try to match votehead by name
      const matchedVh = voteHeads.find(vh => 
        vh.name.toLowerCase().includes(form.debit_type) || 
        debitLabel.toLowerCase().includes(vh.name.toLowerCase())
      );
      if (matchedVh) voteHeadId = matchedVh.id;

      if (!voteHeadId) {
        toast({ title: 'No vote heads configured. Create one first.', variant: 'destructive' });
        return;
      }

      const studentId = parseInt(form.student_id);
      const amount = parseFloat(form.amount);
      const term = parseInt(form.term);
      const year = parseInt(form.year);
      const sid = schoolId.data as number;

      const invoiceNo = `MISC-${year}${term}-${studentId}-${Date.now()}`;

      // Create debit transaction
      await supabase.from('fees_debittransaction').insert({
        school_id: sid,
        student_id: studentId,
        vote_head_id: voteHeadId,
        amount,
        term, year,
        date: new Date().toISOString(),
        invoice_number: invoiceNo,
        remarks: `${debitLabel}: ${form.description}`,
      });

      // Update student ledger
      await feesService._updateStudentLedger(sid, studentId, amount, 0);

      // Double-entry ledger
      await supabase.from('fees_ledger_entry').insert({
        school_id: sid,
        account_debit: 'Accounts Receivable',
        account_credit: `Misc Income - ${debitLabel}`,
        amount,
        reference: invoiceNo,
        description: `${debitLabel}: ${form.description}`,
        student_id: studentId,
      });

      toast({ title: 'Additional debit posted', description: `${debitLabel} — ${amount} charged to student` });
      setIsOpen(false);
      setForm({ student_id: '', amount: '', debit_type: 'custom', description: '', term: '1', year: new Date().getFullYear().toString() });
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><CirclePlus className="mr-2 h-4 w-4" />Additional Debit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Post Additional Debit</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Student *</Label>
            <Select value={form.student_id} onValueChange={v => setForm(p => ({ ...p, student_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.full_name} ({s.admission_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Debit Type *</Label>
            <Select value={form.debit_type} onValueChange={v => setForm(p => ({ ...p, debit_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEBIT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount (KES) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
          <div><Label>Description *</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g., School trip to Nairobi National Park" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Term</Label>
              <Select value={form.term} onValueChange={v => setForm(p => ({ ...p, term: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} /></div>
          </div>
          <Button onClick={handleSubmit} className="w-full">Post Debit</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

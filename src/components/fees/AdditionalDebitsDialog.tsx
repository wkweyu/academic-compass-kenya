import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CirclePlus, Users } from 'lucide-react';
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
  const [isBulk, setIsBulk] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [form, setForm] = useState({
    student_id: '', class_id: '', amount: '', debit_type: 'custom', description: '',
    term: '1', year: new Date().getFullYear().toString(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-fees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id')
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-for-fees'],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: voteHeads = [] } = useQuery({
    queryKey: ['vote-heads'],
    queryFn: () => feesService.getVoteHeads(),
  });

  const handleSubmit = async () => {
    if (!form.amount || !form.description) {
      toast({ title: 'Fill amount and description', variant: 'destructive' });
      return;
    }
    if (!isBulk && !form.student_id) {
      toast({ title: 'Select a student', variant: 'destructive' });
      return;
    }
    if (isBulk && !form.class_id) {
      toast({ title: 'Select a class for bulk debit', variant: 'destructive' });
      return;
    }

    setIsPosting(true);
    try {
      const schoolId = await supabase.rpc('get_user_school_id');
      if (!schoolId.data) throw new Error('No school');

      const debitLabel = DEBIT_TYPES.find(d => d.value === form.debit_type)?.label || form.debit_type;
      let voteHeadId = voteHeads[0]?.id;
      const matchedVh = voteHeads.find(vh =>
        vh.name.toLowerCase().includes(form.debit_type) ||
        debitLabel.toLowerCase().includes(vh.name.toLowerCase())
      );
      if (matchedVh) voteHeadId = matchedVh.id;

      if (!voteHeadId) {
        toast({ title: 'No vote heads configured. Create one first.', variant: 'destructive' });
        setIsPosting(false);
        return;
      }

      const amount = parseFloat(form.amount);
      const term = parseInt(form.term);
      const year = parseInt(form.year);
      const sid = schoolId.data as number;

      // Determine target students
      const targetStudentIds: number[] = isBulk
        ? students.filter((s: any) => s.current_class_id === parseInt(form.class_id)).map((s: any) => s.id)
        : [parseInt(form.student_id)];

      if (targetStudentIds.length === 0) {
        toast({ title: 'No students found for this class', variant: 'destructive' });
        setIsPosting(false);
        return;
      }

      let count = 0;
      for (const studentId of targetStudentIds) {
        const invoiceNo = `MISC-${year}${term}-${studentId}-${Date.now()}`;

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

        // Update fee balance for this votehead
        const { data: existing } = await supabase
          .from('fees_feebalance')
          .select('id, amount_invoiced, closing_balance')
          .eq('school_id', sid)
          .eq('student_id', studentId)
          .eq('vote_head_id', voteHeadId)
          .eq('year', year)
          .eq('term', term)
          .maybeSingle();

        if (existing) {
          await supabase.from('fees_feebalance').update({
            amount_invoiced: Number((existing as any).amount_invoiced) + amount,
            closing_balance: Number((existing as any).closing_balance) + amount,
          }).eq('id', (existing as any).id);
        } else {
          await supabase.from('fees_feebalance').insert({
            school_id: sid, student_id: studentId, vote_head_id: voteHeadId,
            year, term, opening_balance: 0, amount_invoiced: amount, amount_paid: 0,
            closing_balance: amount,
          });
        }

        await feesService._updateStudentLedger(sid, studentId, amount, 0);

        await supabase.from('fees_ledger_entry').insert({
          school_id: sid,
          account_debit: 'Accounts Receivable',
          account_credit: `Misc Income - ${debitLabel}`,
          amount,
          reference: invoiceNo,
          description: `${debitLabel}: ${form.description}`,
          student_id: studentId,
        });

        count++;
      }

      toast({
        title: isBulk ? 'Bulk debit posted' : 'Additional debit posted',
        description: `${debitLabel} — ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount)} charged to ${count} student${count > 1 ? 's' : ''}`,
      });
      setIsOpen(false);
      setForm({ student_id: '', class_id: '', amount: '', debit_type: 'custom', description: '', term: '1', year: new Date().getFullYear().toString() });
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsPosting(false);
    }
  };

  const selectedClassName = classes.find((c: any) => c.id.toString() === form.class_id)?.name;
  const studentsInClass = isBulk && form.class_id
    ? students.filter((s: any) => s.current_class_id === parseInt(form.class_id)).length
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><CirclePlus className="mr-2 h-4 w-4" />Additional Debit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Post Additional Debit</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Toggle: Single vs Bulk */}
          <div className="flex items-center space-x-2 p-3 rounded-md border bg-muted/30">
            <Checkbox
              id="bulk-mode"
              checked={isBulk}
              onCheckedChange={(v) => setIsBulk(!!v)}
            />
            <label htmlFor="bulk-mode" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4" />
              Bulk charge entire class
            </label>
          </div>

          {isBulk ? (
            <div>
              <Label>Class *</Label>
              <Select value={form.class_id} onValueChange={v => setForm(p => ({ ...p, class_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {studentsInClass > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {studentsInClass} active student{studentsInClass > 1 ? 's' : ''} in {selectedClassName}
                </p>
              )}
            </div>
          ) : (
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
          )}

          <div>
            <Label>Debit Type *</Label>
            <Select value={form.debit_type} onValueChange={v => setForm(p => ({ ...p, debit_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEBIT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (KES) *{isBulk ? ' — per student' : ''}</Label>
            <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g., School trip to Nairobi National Park" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Term</Label>
              <Select value={form.term} onValueChange={v => setForm(p => ({ ...p, term: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} /></div>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={isPosting}>
            {isPosting ? 'Posting...' : isBulk ? `Post Debit to ${studentsInClass} Students` : 'Post Debit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

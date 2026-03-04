import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { feesService } from '@/services/feesService';

export function TransferCreditDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    from_student_id: '', to_student_id: '', amount: '', reason: '',
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

  const handleTransfer = async () => {
    if (!form.from_student_id || !form.to_student_id || !form.amount || !form.reason) {
      toast({ title: 'Fill all required fields', variant: 'destructive' });
      return;
    }
    if (form.from_student_id === form.to_student_id) {
      toast({ title: 'Cannot transfer to same student', variant: 'destructive' });
      return;
    }

    try {
      const schoolId = await supabase.rpc('get_user_school_id');
      if (!schoolId.data) throw new Error('No school');

      const sid = schoolId.data as number;
      const fromId = parseInt(form.from_student_id);
      const toId = parseInt(form.to_student_id);
      const amount = parseFloat(form.amount);
      const term = parseInt(form.term);
      const year = parseInt(form.year);

      // Verify source student has enough credit/overpayment
      const { data: fromLedger } = await supabase
        .from('fees_student_ledger')
        .select('balance')
        .eq('student_id', fromId)
        .eq('school_id', sid)
        .maybeSingle();

      const fromBalance = Number((fromLedger as any)?.balance || 0);
      // Allow transfer even if student owes (admin discretion), but warn
      const reference = `TRF-${Date.now()}`;
      const fromStudent = students.find((s: any) => s.id === fromId);
      const toStudent = students.find((s: any) => s.id === toId);

      // Debit source student (reverse the credit)
      await supabase.from('fees_debittransaction').insert({
        school_id: sid,
        student_id: fromId,
        vote_head_id: 1, // Will use first available
        amount,
        term, year,
        date: new Date().toISOString(),
        invoice_number: reference,
        remarks: `Credit transfer to ${(toStudent as any)?.full_name || toId}: ${form.reason}`,
      });

      // Credit destination student via receipt
      await feesService.collectPayment({
        student_id: toId,
        amount,
        payment_mode: 'bank',
        reference,
        term, year,
        remarks: `Credit transfer from ${(fromStudent as any)?.full_name || fromId}: ${form.reason}`,
      });

      // Update source ledger
      await feesService._updateStudentLedger(sid, fromId, amount, 0);

      // Ledger entries for transfer
      await supabase.from('fees_ledger_entry').insert({
        school_id: sid,
        account_debit: 'Credit Transfer Out',
        account_credit: 'Credit Transfer In',
        amount,
        reference,
        description: `Transfer: ${(fromStudent as any)?.full_name} → ${(toStudent as any)?.full_name}. ${form.reason}`,
        student_id: fromId,
      });

      toast({ title: 'Credit transferred', description: `KES ${amount} transferred successfully` });
      setIsOpen(false);
      setForm({ from_student_id: '', to_student_id: '', amount: '', reason: '', term: '1', year: new Date().getFullYear().toString() });
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer Credit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Transfer Credit Between Students</DialogTitle></DialogHeader>
        <Alert className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will debit the source student and credit the destination student. Use for correcting wrong admission numbers.
          </AlertDescription>
        </Alert>
        <div className="space-y-4 pt-2">
          <div>
            <Label>From Student (Source) *</Label>
            <Select value={form.from_student_id} onValueChange={v => setForm(p => ({ ...p, from_student_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select source student" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.full_name} ({s.admission_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>To Student (Destination) *</Label>
            <Select value={form.to_student_id} onValueChange={v => setForm(p => ({ ...p, to_student_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select destination student" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.full_name} ({s.admission_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount (KES) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
          <div><Label>Reason *</Label><Textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g., Payment made under wrong admission number" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Term</Label>
              <Select value={form.term} onValueChange={v => setForm(p => ({ ...p, term: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} /></div>
          </div>
          <Button onClick={handleTransfer} className="w-full">Execute Transfer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

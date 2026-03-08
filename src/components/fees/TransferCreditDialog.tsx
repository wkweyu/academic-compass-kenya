import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function TransferCreditDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [fromStudentId, setFromStudentId] = useState('');
  const [toStudentId, setToStudentId] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');

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

  // Fetch receipts for the selected source student
  const { data: studentReceipts = [] } = useQuery({
    queryKey: ['student-receipts-transfer', fromStudentId],
    queryFn: async () => {
      if (!fromStudentId) return [];
      const { data } = await supabase
        .from('fees_receipt')
        .select('id, receipt_no, amount, payment_mode, reference, term, year, created_at, is_reversed')
        .eq('student_id', parseInt(fromStudentId))
        .eq('is_reversed', false)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!fromStudentId,
  });

  const handleTransfer = async () => {
    if (!fromStudentId || !toStudentId || !selectedReceiptId) {
      toast({ title: 'Select source student, receipt, and destination student', variant: 'destructive' });
      return;
    }
    if (fromStudentId === toStudentId) {
      toast({ title: 'Cannot transfer to same student', variant: 'destructive' });
      return;
    }

    try {
      const schoolId = await supabase.rpc('get_user_school_id');
      if (!schoolId.data) throw new Error('No school');
      const sid = schoolId.data as number;
      const receiptId = parseInt(selectedReceiptId);
      const fromId = parseInt(fromStudentId);
      const toId = parseInt(toStudentId);

      const receipt = studentReceipts.find((r: any) => r.id === receiptId);
      if (!receipt) throw new Error('Receipt not found');

      // 1. Get allocations for this receipt
      const { data: allocations } = await supabase
        .from('fees_allocation')
        .select('*')
        .eq('receipt_id', receiptId);

      // 2. Reverse fee balance updates on source student (undo the payment)
      for (const alloc of (allocations || [])) {
        const { data: bal } = await supabase
          .from('fees_feebalance')
          .select('id, amount_paid, amount_invoiced, closing_balance')
          .eq('school_id', sid)
          .eq('student_id', fromId)
          .eq('vote_head_id', (alloc as any).vote_head_id)
          .order('year', { ascending: false })
          .order('term', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bal) {
          const newPaid = Math.max(0, Number((bal as any).amount_paid) - Number((alloc as any).amount));
          const newClosing = Math.max(0, Number((bal as any).amount_invoiced) - newPaid);
          await supabase.from('fees_feebalance').update({
            amount_paid: newPaid,
            closing_balance: newClosing,
          }).eq('id', (bal as any).id);
        }
      }

      // 3. Update the receipt to point to the new student
      await supabase.from('fees_receipt').update({
        student_id: toId,
      }).eq('id', receiptId);

      // 4. Apply fee balance updates on destination student
      for (const alloc of (allocations || [])) {
        const { data: bal } = await supabase
          .from('fees_feebalance')
          .select('id, amount_paid, amount_invoiced, closing_balance')
          .eq('school_id', sid)
          .eq('student_id', toId)
          .eq('vote_head_id', (alloc as any).vote_head_id)
          .order('year', { ascending: false })
          .order('term', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bal) {
          const newPaid = Number((bal as any).amount_paid) + Number((alloc as any).amount);
          const newClosing = Math.max(0, Number((bal as any).amount_invoiced) - newPaid);
          await supabase.from('fees_feebalance').update({
            amount_paid: newPaid,
            closing_balance: newClosing,
          }).eq('id', (bal as any).id);
        }
      }

      // 5. Update payment transaction record
      await supabase.from('fees_paymenttransaction').update({
        student_id: toId,
        remarks: `Transferred from student ${fromId}. Original ref: ${(receipt as any).reference}`,
      }).eq('transaction_code', (receipt as any).reference).eq('student_id', fromId);

      // 6. Update ledger entries
      await supabase.from('fees_ledger_entry').update({
        student_id: toId,
        description: `Payment transferred from student ${fromId}`,
      }).eq('receipt_id', receiptId);

      // 7. Recalculate both student ledgers
      const recalcLedger = async (studentId: number) => {
        const [debitsRes, receiptsRes] = await Promise.all([
          supabase.from('fees_debittransaction').select('amount').eq('school_id', sid).eq('student_id', studentId),
          supabase.from('fees_receipt').select('amount').eq('school_id', sid).eq('student_id', studentId).eq('is_reversed', false),
        ]);
        const debitTotal = (debitsRes.data || []).reduce((s, d) => s + Number((d as any).amount), 0);
        const creditTotal = (receiptsRes.data || []).reduce((s, r) => s + Number((r as any).amount), 0);
        const { data: existing } = await supabase.from('fees_student_ledger').select('id').eq('school_id', sid).eq('student_id', studentId).maybeSingle();
        if (existing) {
          await supabase.from('fees_student_ledger').update({ debit_total: debitTotal, credit_total: creditTotal, balance: debitTotal - creditTotal, last_updated: new Date().toISOString() }).eq('id', (existing as any).id);
        } else {
          await supabase.from('fees_student_ledger').insert({ school_id: sid, student_id: studentId, debit_total: debitTotal, credit_total: creditTotal, balance: debitTotal - creditTotal });
        }
      };
      await Promise.all([recalcLedger(fromId), recalcLedger(toId)]);

      // 8. Audit log
      await supabase.from('fees_ledger_entry').insert({
        school_id: sid,
        account_debit: 'Receipt Transfer',
        account_credit: 'Receipt Transfer',
        amount: Number((receipt as any).amount),
        reference: (receipt as any).receipt_no,
        description: `Receipt ${(receipt as any).receipt_no} transferred from student ${fromId} to ${toId}`,
        student_id: toId,
        receipt_id: receiptId,
      });

      const fromStudent = students.find((s: any) => s.id === fromId);
      const toStudent = students.find((s: any) => s.id === toId);
      toast({
        title: 'Receipt transferred',
        description: `${(receipt as any).receipt_no} (KES ${Number((receipt as any).amount).toLocaleString()}) moved from ${(fromStudent as any)?.full_name} to ${(toStudent as any)?.full_name}`,
      });
      setIsOpen(false);
      setFromStudentId('');
      setToStudentId('');
      setSelectedReceiptId('');
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const selectedReceipt = studentReceipts.find((r: any) => r.id === parseInt(selectedReceiptId));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer Receipt</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Transfer Receipt to Another Student</DialogTitle></DialogHeader>
        <Alert className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This transfers a whole receipt (with all its allocations) from one student to another. Use when a payment was posted to the wrong admission number.
          </AlertDescription>
        </Alert>
        <div className="space-y-4 pt-2">
          <div>
            <Label>From Student (Source) *</Label>
            <Select value={fromStudentId} onValueChange={v => { setFromStudentId(v); setSelectedReceiptId(''); }}>
              <SelectTrigger><SelectValue placeholder="Select source student" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.full_name} ({s.admission_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fromStudentId && (
            <div>
              <Label>Select Receipt to Transfer *</Label>
              <Select value={selectedReceiptId} onValueChange={setSelectedReceiptId}>
                <SelectTrigger><SelectValue placeholder="Select a receipt" /></SelectTrigger>
                <SelectContent>
                  {studentReceipts.map((r: any) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      {r.receipt_no} — KES {Number(r.amount).toLocaleString()} ({r.payment_mode}) — {new Date(r.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReceipt && (
                <div className="mt-2 p-3 rounded-md border bg-muted/30 text-sm space-y-1">
                  <p><strong>Receipt:</strong> {(selectedReceipt as any).receipt_no}</p>
                  <p><strong>Amount:</strong> KES {Number((selectedReceipt as any).amount).toLocaleString()}</p>
                  <p><strong>Mode:</strong> {(selectedReceipt as any).payment_mode} • <strong>Ref:</strong> {(selectedReceipt as any).reference}</p>
                  <p><strong>Term/Year:</strong> T{(selectedReceipt as any).term}/{(selectedReceipt as any).year}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>To Student (Destination) *</Label>
            <Select value={toStudentId} onValueChange={setToStudentId}>
              <SelectTrigger><SelectValue placeholder="Select destination student" /></SelectTrigger>
              <SelectContent>
                {students.filter((s: any) => s.id.toString() !== fromStudentId).map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.full_name} ({s.admission_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleTransfer} className="w-full" disabled={!fromStudentId || !toStudentId || !selectedReceiptId}>
            Transfer Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

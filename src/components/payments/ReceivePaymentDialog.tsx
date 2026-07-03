import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { paymentService } from '@/services/paymentService';

interface ReceivePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceivePaymentDialog({ open, onOpenChange }: ReceivePaymentDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    provider: 'manual',
    reference: '',
    transaction_code: '',
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      return paymentService.postManualPayment({
        admission_number: data.student_id,
        amount: parseFloat(data.amount),
        reference: data.reference || `Manual-${Date.now()}`,
        payment_mode: data.provider,
        term: new Date().getMonth() < 8 ? 2 : 1,
        year: new Date().getFullYear(),
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['payment-events'] });
      queryClient.invalidateQueries({ queryKey: ['payments-dashboard'] });
      onOpenChange(false);
      setFormData({
        student_id: '',
        amount: '',
        provider: 'manual',
        reference: '',
        transaction_code: '',
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to record payment: ${error.message || 'Unknown error'}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
          <DialogDescription>
            Record a manual payment from a student.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="student_id">Student ID / Admission Number *</Label>
            <Input
              id="student_id"
              placeholder="e.g., SCH-2024-001"
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="amount">Amount (KES) *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <Label htmlFor="provider">Payment Method</Label>
            <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual/Cash</SelectItem>
                <SelectItem value="mpesa">M-PESA</SelectItem>
                <SelectItem value="kcb_buni">KCB Buni</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="transaction_code">Transaction Code (optional)</Label>
            <Input
              id="transaction_code"
              placeholder="e.g., TXN123456"
              value={formData.transaction_code}
              onChange={(e) => setFormData({ ...formData, transaction_code: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="reference">Reference/Notes (optional)</Label>
            <Input
              id="reference"
              placeholder="e.g., Fees for Term 2 2026"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

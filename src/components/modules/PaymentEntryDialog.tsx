import { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Banknote, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Invoice, Payment, PAYMENT_METHODS } from '@/types/fees';
import { feesService } from '@/services/feesService';

interface PaymentEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedInvoice?: Invoice | null;
  onPaymentRecorded: () => void;
}

export function PaymentEntryDialog({ 
  isOpen, 
  onOpenChange, 
  selectedInvoice, 
  onPaymentRecorded 
}: PaymentEntryDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Mock students for dropdown (if no invoice selected)
  const [students] = useState([
    { id: 1, name: 'John Kamau', admission_number: 'ADM001' },
    { id: 2, name: 'Mary Wanjiku', admission_number: 'ADM002' },
    { id: 3, name: 'Peter Ochieng', admission_number: 'ADM003' }
  ]);

  const [paymentForm, setPaymentForm] = useState({
    student_id: 0,
    invoice_id: 0,
    amount: 0,
    payment_method: 'cash' as Payment['payment_method'],
    reference_no: '',
    mpesa_code: '',
    notes: '',
    received_on: new Date().toISOString().split('T')[0],
    posted_by: 'Finance Officer' // This would come from auth context in real app
  });

  useEffect(() => {
    if (selectedInvoice) {
      setPaymentForm(prev => ({
        ...prev,
        student_id: selectedInvoice.student_id,
        invoice_id: selectedInvoice.id,
        amount: selectedInvoice.balance // Default to full balance
      }));
    } else {
      // Reset for new payment entry
      setPaymentForm(prev => ({
        ...prev,
        student_id: 0,
        invoice_id: 0,
        amount: 0
      }));
    }
  }, [selectedInvoice]);

  const handleSubmit = async () => {
    // Validation
    if (!paymentForm.student_id) {
      toast({
        title: "Error",
        description: "Please select a student",
        variant: "destructive",
      });
      return;
    }

    if (paymentForm.amount <= 0) {
      toast({
        title: "Error",
        description: "Payment amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    if (!paymentForm.reference_no.trim()) {
      toast({
        title: "Error",
        description: "Reference number is required",
        variant: "destructive",
      });
      return;
    }

    if (paymentForm.payment_method === 'mpesa' && !paymentForm.mpesa_code.trim()) {
      toast({
        title: "Error",
        description: "M-PESA code is required for M-PESA payments",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const paymentData: Omit<Payment, 'id' | 'created_at'> = {
        student_id: paymentForm.student_id,
        student_name: selectedInvoice?.student_name || students.find(s => s.id === paymentForm.student_id)?.name,
        admission_number: selectedInvoice?.admission_number || students.find(s => s.id === paymentForm.student_id)?.admission_number,
        invoice_id: paymentForm.invoice_id || undefined,
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
        reference_no: paymentForm.reference_no.trim(),
        mpesa_code: paymentForm.mpesa_code.trim() || undefined,
        received_on: paymentForm.received_on,
        posted_by: paymentForm.posted_by,
        notes: paymentForm.notes.trim() || undefined,
        school: 1 // Mock school ID
      };

      await feesService.createPayment(paymentData);
      
      toast({
        title: "Success",
        description: "Payment recorded successfully",
        duration: 3000,
      });
      
      onPaymentRecorded();
      onOpenChange(false);
      resetForm();
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentForm({
      student_id: 0,
      invoice_id: 0,
      amount: 0,
      payment_method: 'cash',
      reference_no: '',
      mpesa_code: '',
      notes: '',
      received_on: new Date().toISOString().split('T')[0],
      posted_by: 'Finance Officer'
    });
  };

  const generateReferenceNo = () => {
    const prefix = paymentForm.payment_method.toUpperCase().substring(0, 3);
    const timestamp = Date.now().toString().slice(-6);
    const refNo = `${prefix}${timestamp}`;
    setPaymentForm(prev => ({ ...prev, reference_no: refNo }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'mpesa': return <Smartphone className="h-4 w-4" />;
      case 'bank_transfer': return <CreditCard className="h-4 w-4" />;
      case 'cash': return <Banknote className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const selectedStudent = selectedInvoice || students.find(s => s.id === paymentForm.student_id);

  const getStudentName = () => {
    if (selectedInvoice) return selectedInvoice.student_name;
    const student = students.find(s => s.id === paymentForm.student_id);
    return student?.name;
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Record Payment
        </DialogTitle>
        <DialogDescription>
          {selectedInvoice 
            ? `Record a payment for ${selectedInvoice.student_name}'s invoice`
            : 'Record a new payment from a student'
          }
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Invoice Details (if selected) */}
        {selectedInvoice && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoice Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Student:</span>
                <div className="font-medium">{selectedInvoice.student_name}</div>
                <div className="text-muted-foreground">{selectedInvoice.admission_number}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Class:</span>
                <div>{selectedInvoice.class_name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Amount:</span>
                <div className="font-medium">{formatCurrency(selectedInvoice.total_amount)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Balance:</span>
                <div className="font-medium text-red-600">{formatCurrency(selectedInvoice.balance)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Student Selection (if no invoice selected) */}
        {!selectedInvoice && (
          <div className="grid gap-2">
            <Label htmlFor="student">Student *</Label>
            <Select
              value={paymentForm.student_id.toString()}
              onValueChange={(value) => setPaymentForm(prev => ({ ...prev, student_id: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id.toString()}>
                    {student.name} ({student.admission_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator />

        {/* Payment Details */}
        <div className="space-y-4">
          <h4 className="font-medium">Payment Details</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={paymentForm.amount || ''}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="payment_method">Payment Method *</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(value: Payment['payment_method']) => setPaymentForm(prev => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(method.value)}
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="reference_no">Reference Number *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateReferenceNo}
              >
                Generate
              </Button>
            </div>
            <Input
              id="reference_no"
              value={paymentForm.reference_no}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, reference_no: e.target.value }))}
              placeholder="e.g., REC001, CHQ123"
            />
          </div>

          {paymentForm.payment_method === 'mpesa' && (
            <div className="grid gap-2">
              <Label htmlFor="mpesa_code">M-PESA Confirmation Code *</Label>
              <Input
                id="mpesa_code"
                value={paymentForm.mpesa_code}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, mpesa_code: e.target.value.toUpperCase() }))}
                placeholder="e.g., QA12BC34DE"
                maxLength={10}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="received_on">Date Received *</Label>
            <Input
              id="received_on"
              type="date"
              value={paymentForm.received_on}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, received_on: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about this payment..."
              rows={3}
            />
          </div>
        </div>

        <Separator />

        {/* Summary */}
        {(selectedInvoice || paymentForm.student_id) && paymentForm.amount > 0 && (
          <div className="p-4 bg-green-50 rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              Payment Summary
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-medium">{getStudentName()}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-bold text-green-600">{formatCurrency(paymentForm.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <Badge className={PAYMENT_METHODS.find(m => m.value === paymentForm.payment_method)?.color}>
                  {PAYMENT_METHODS.find(m => m.value === paymentForm.payment_method)?.label}
                </Badge>
              </div>
              {paymentForm.reference_no && (
                <div className="flex justify-between">
                  <span>Reference:</span>
                  <span className="font-mono text-xs">{paymentForm.reference_no}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !paymentForm.student_id || paymentForm.amount <= 0}
            className="flex-1"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
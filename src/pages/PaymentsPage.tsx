import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PaymentDashboard } from '@/components/payments/PaymentDashboard';
import { PaymentEventsTable } from '@/components/payments/PaymentEventsTable';
import { ReceivePaymentDialog } from '@/components/payments/ReceivePaymentDialog';

export default function PaymentsPage() {
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Monitor collections, reconciliation status, and transaction feed.
          </p>
        </div>
        <Button onClick={() => setReceiveDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Receive Payment
        </Button>
      </div>

      <PaymentDashboard />
      <PaymentEventsTable />

      <ReceivePaymentDialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen} />
    </div>
  );
}

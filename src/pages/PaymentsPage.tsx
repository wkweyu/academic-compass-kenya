import { PaymentDashboard } from '@/components/payments/PaymentDashboard';
import { PaymentEventsTable } from '@/components/payments/PaymentEventsTable';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Monitor collections, reconciliation status, and transaction feed.
        </p>
      </div>

      <PaymentDashboard />
      <PaymentEventsTable />
    </div>
  );
}

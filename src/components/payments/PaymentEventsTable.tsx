import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { paymentService } from '@/services/paymentService';

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

const statusVariant: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  RECONCILED: 'default',
  UNRESOLVED_STUDENT: 'secondary',
  INVALID_REFERENCE: 'destructive',
  DUPLICATE: 'outline',
  RECEIVED: 'outline',
};

export function PaymentEventsTable() {
  const [status, setStatus] = useState<string>('all');
  const [provider, setProvider] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      status: status === 'all' ? undefined : status,
      provider: provider === 'all' ? undefined : provider,
      search: search || undefined,
    }),
    [status, provider, search],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['payment-events', filters],
    queryFn: () => paymentService.getEvents(filters),
    refetchInterval: 60000,
  });

  const detailQuery = useQuery({
    queryKey: ['payment-event-detail', selectedEventId],
    queryFn: () => paymentService.getEventDetail(selectedEventId || ''),
    enabled: Boolean(selectedEventId),
    refetchInterval: 60000,
  });

  const selectedEvent = detailQuery.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          placeholder="Search transaction, reference, or student..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="RECONCILED">Reconciled</SelectItem>
            <SelectItem value="UNRESOLVED_STUDENT">Unresolved Student</SelectItem>
            <SelectItem value="INVALID_REFERENCE">Invalid Reference</SelectItem>
            <SelectItem value="DUPLICATE">Duplicate</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
          </SelectContent>
        </Select>

        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            <SelectItem value="mpesa">M-PESA</SelectItem>
            <SelectItem value="kcb_buni">KCB Buni</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Student/Reference</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">Loading payments...</TableCell>
              </TableRow>
            ) : (data?.results.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">No payment events found.</TableCell>
              </TableRow>
            ) : (
              data?.results.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                  <TableCell>{event.provider_display}</TableCell>
                  <TableCell className="font-medium">{event.transaction_code}</TableCell>
                  <TableCell>{event.student_name || event.reference}</TableCell>
                  <TableCell>{currency.format(Number(event.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[event.status] || 'outline'}>{event.status_display}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedEventId(event.id)}>
                      Drill-down
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selectedEventId)} onOpenChange={(open) => !open && setSelectedEventId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Timeline</DialogTitle>
            <DialogDescription>
              Audit trail for webhook ingest, routing, reconciliation, and SMS delivery.
            </DialogDescription>
          </DialogHeader>

          {!selectedEvent ? (
            <div className="p-2 text-sm text-muted-foreground">Loading transaction details...</div>
          ) : (
            <div className="space-y-4 px-1 pb-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="font-medium">{selectedEvent.transaction_code}</p>
                <p className="text-muted-foreground">
                  {selectedEvent.provider_display} | {selectedEvent.student_name || selectedEvent.reference} | {currency.format(Number(selectedEvent.amount))}
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Webhook Received</p>
                  <p className="text-muted-foreground">{selectedEvent.ingress_received_at ? new Date(selectedEvent.ingress_received_at).toLocaleString() : 'Not available'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Routed To School</p>
                  <p className="text-muted-foreground">{selectedEvent.routed_at ? new Date(selectedEvent.routed_at).toLocaleString() : 'Not available'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Reconciled</p>
                  <p className="text-muted-foreground">{selectedEvent.processed_at ? new Date(selectedEvent.processed_at).toLocaleString() : 'Pending reconciliation'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">SMS Delivery</p>
                  <p className="text-muted-foreground">
                    {selectedEvent.sms_status_display || selectedEvent.sms_status || 'Pending'}
                    {selectedEvent.sms_sent_at ? ` at ${new Date(selectedEvent.sms_sent_at).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

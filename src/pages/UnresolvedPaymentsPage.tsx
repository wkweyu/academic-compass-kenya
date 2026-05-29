import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { paymentService } from '@/services/paymentService';
import { useToast } from '@/hooks/use-toast';

export default function UnresolvedPaymentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['payment-events-unresolved'],
    queryFn: () => paymentService.getUnresolvedEvents(),
    refetchInterval: 60000,
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => paymentService.reprocessEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-events-unresolved'] });
      queryClient.invalidateQueries({ queryKey: ['payment-events'] });
      queryClient.invalidateQueries({ queryKey: ['payments-dashboard'] });
      toast({ title: 'Reprocess completed' });
    },
    onError: (error: any) => {
      toast({
        title: 'Reprocess failed',
        description: error?.message || 'Could not reprocess selected event.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unresolved Payments</h1>
        <p className="text-sm text-muted-foreground">
          Review failed reconciliations and retry after fixing student reference issues.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading unresolved events...
                </TableCell>
              </TableRow>
            ) : (data?.results.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No unresolved payments.
                </TableCell>
              </TableRow>
            ) : (
              data?.results.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                  <TableCell>{event.provider_display}</TableCell>
                  <TableCell>{event.transaction_code}</TableCell>
                  <TableCell>{event.reference}</TableCell>
                  <TableCell className="max-w-sm truncate" title={event.error_message}>
                    {event.error_message || event.status_display}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => reprocessMutation.mutate(event.id)}
                      disabled={reprocessMutation.isPending}
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

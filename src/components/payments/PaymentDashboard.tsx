import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { paymentService } from '@/services/paymentService';

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

export function PaymentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['payments-dashboard'],
    queryFn: () => paymentService.getDashboard(),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading payment metrics...</div>;
  }

  const cards = [
    { title: 'Total Collections', value: currency.format(data?.total_amount ?? 0) },
    { title: 'Today Collected', value: currency.format(data?.today_amount ?? 0) },
    { title: 'Reconciled Events', value: `${data?.reconciled_events ?? 0}` },
    { title: 'Unresolved Events', value: `${data?.unresolved_events ?? 0}` },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

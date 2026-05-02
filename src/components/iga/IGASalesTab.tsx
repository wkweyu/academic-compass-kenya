import type { IGASale } from '@/services/igaService';

import { IGATableCard } from './IGATableCard';
import { formatCurrency } from './igaHelpers';

export function IGASalesTab({ sales }: { sales: IGASale[] }) {
  return (
    <IGATableCard
      title="Sales log"
      description="Produce sales posted through the IGA workflow."
      headers={['Date', 'Activity', 'Product', 'Customer', 'Total']}
      rows={sales.map((item) => [
        item.sale_date,
        item.activity_name || '—',
        item.product_name || '—',
        item.customer_name || 'Walk-in',
        formatCurrency(item.total_amount),
      ])}
      emptyText="No sales have been recorded yet."
    />
  );
}

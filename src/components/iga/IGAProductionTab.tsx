import type { IGAProductionRecord } from '@/services/igaService';

import { IGATableCard } from './IGATableCard';
import { formatNumber } from './igaHelpers';

export function IGAProductionTab({ productionRecords }: { productionRecords: IGAProductionRecord[] }) {
  return (
    <IGATableCard
      title="Production log"
      description="Production records automatically update inventory."
      headers={['Date', 'Activity', 'Product', 'Quantity', 'Recorded by']}
      rows={productionRecords.map((item) => [
        item.production_date,
        item.activity_name || '—',
        item.product_name || '—',
        `${formatNumber(item.quantity)} ${item.unit}`,
        item.recorded_by_name || '—',
      ])}
      emptyText="No production has been recorded yet."
    />
  );
}

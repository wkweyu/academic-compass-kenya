import type { IGAOverviewReport } from '@/services/igaService';

import { IGATableCard } from './IGATableCard';
import { formatCurrency, formatNumber, humanizeLabel } from './igaHelpers';

export function IGAOverviewTab({ overview, loading }: { overview?: IGAOverviewReport; loading: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <IGATableCard
          title="Profitability"
          description="Sales, expenses, and net position by activity."
          headers={['Activity', 'Sales', 'Expenses', 'Net']}
          rows={(overview?.profitability || []).map((item) => [
            item.activity_name,
            formatCurrency(item.total_sales),
            formatCurrency(item.total_expenses),
            formatCurrency(item.net_profit_loss),
          ])}
          emptyText={loading ? 'Loading overview...' : 'No activity profitability data yet.'}
        />
        <IGATableCard
          title="Inventory summary"
          description="Current stock levels, usage, and spoilage."
          headers={['Product', 'Available', 'Sold', 'Internal use', 'Spoiled']}
          rows={(overview?.inventory || []).map((item) => [
            item.product_name,
            `${formatNumber(item.quantity_available)} ${item.unit}`,
            formatNumber(item.sold_quantity),
            formatNumber(item.internal_use_quantity),
            formatNumber(item.spoiled_quantity),
          ])}
          emptyText={loading ? 'Loading inventory...' : 'No inventory records yet.'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <IGATableCard
          title="Production summary"
          description="Grouped output totals by day, activity, and product."
          headers={['Date', 'Activity', 'Product', 'Quantity']}
          rows={(overview?.production || []).map((item) => [
            item.production_date,
            item.activity__name,
            item.product__name,
            `${formatNumber(item.total_quantity)} ${item.unit}`,
          ])}
          emptyText={loading ? 'Loading production report...' : 'No production report data yet.'}
        />
        <IGATableCard
          title="Income vs expenditure"
          description="Approved expenses compared with recorded produce sales."
          headers={['Metric', 'Amount']}
          rows={overview?.income_vs_expenditure
            ? [
                ['Total income', formatCurrency(overview.income_vs_expenditure.total_income)],
                ['Total expenses', formatCurrency(overview.income_vs_expenditure.total_expenses)],
                ['Net income', formatCurrency(overview.income_vs_expenditure.net_income)],
              ]
            : []}
          emptyText={loading ? 'Loading income report...' : 'No income and expenditure data yet.'}
        />
      </div>

      <IGATableCard
        title="Recent inventory movements"
        description="Latest production, sale, spoilage, and adjustment activity."
        headers={['Reference', 'Type', 'Product', 'Activity', 'Quantity', 'Date']}
        rows={(overview?.recent_movements || []).map((item) => [
          item.reference || `#${item.id}`,
          humanizeLabel(item.movement_type),
          item.product__name,
          item.activity__name || '—',
          `${formatNumber(item.quantity)} ${item.unit}`,
          new Date(item.date).toLocaleString(),
        ])}
        emptyText={loading ? 'Loading movement history...' : 'No movements recorded yet.'}
      />
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { IGAOverviewReport } from '@/services/igaService';

import { buildSummaryCards } from './igaHelpers';

export function IGASummaryCards({ overview }: { overview?: IGAOverviewReport }) {
  const cards = buildSummaryCards(overview);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((item) => (
        <Card key={item.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </div>
            <item.icon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

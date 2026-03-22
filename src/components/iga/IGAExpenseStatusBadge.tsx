import { Badge } from '@/components/ui/badge';
import type { IGAExpense } from '@/services/igaService';

import { humanizeLabel } from './igaHelpers';

export function IGAExpenseStatusBadge({ status }: { status: IGAExpense['status'] }) {
  const variant = status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{humanizeLabel(status) || 'unknown'}</Badge>;
}

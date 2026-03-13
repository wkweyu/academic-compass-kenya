import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BudgetPayload, IGAActivity, IGABudget } from '@/services/igaService';

import { IGAFormField } from './IGAFormField';
import { IGASelectInput } from './IGASelectInput';
import { today } from './igaHelpers';

const defaultBudgetForm: BudgetPayload = {
  activity: 0,
  category: '',
  budget_amount: '0.00',
  period_start: today,
  period_end: today,
  notes: '',
};

export function IGABudgetDialog({
  open,
  onOpenChange,
  activities,
  budget,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: IGAActivity[];
  budget?: IGABudget | null;
  submitting: boolean;
  onSubmit: (payload: BudgetPayload, budgetId?: number) => void | Promise<unknown>;
}) {
  const [form, setForm] = useState<BudgetPayload>(defaultBudgetForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (budget) {
      setForm({
        activity: budget.activity,
        category: budget.category,
        budget_amount: budget.budget_amount,
        period_start: budget.period_start,
        period_end: budget.period_end,
        notes: budget.notes || '',
      });
      return;
    }

    setForm(defaultBudgetForm);
  }, [budget, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit budget' : 'Create budget'}</DialogTitle>
          <DialogDescription>
            {budget ? 'Update the budget line and reporting period.' : 'Add a budget line for planned spending versus actual activity expenses.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <IGAFormField label="Activity">
            <IGASelectInput
              value={String(form.activity || '')}
              onChange={(event) => setForm((prev) => ({ ...prev, activity: Number(event.target.value) }))}
              options={activities.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </IGAFormField>
          <IGAFormField label="Category">
            <Input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
          </IGAFormField>
          <div className="grid gap-4 md:grid-cols-3">
            <IGAFormField label="Budget amount">
              <Input type="number" min="0" step="0.01" value={form.budget_amount} onChange={(event) => setForm((prev) => ({ ...prev, budget_amount: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Period start">
              <Input type="date" value={form.period_start} onChange={(event) => setForm((prev) => ({ ...prev, period_start: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Period end">
              <Input type="date" value={form.period_end} onChange={(event) => setForm((prev) => ({ ...prev, period_end: event.target.value }))} />
            </IGAFormField>
          </div>
          <IGAFormField label="Notes">
            <Textarea value={form.notes || ''} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </IGAFormField>
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit(form, budget?.id)} disabled={submitting}>
            {submitting ? 'Saving...' : budget ? 'Update budget' : 'Create budget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

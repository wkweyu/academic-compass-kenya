import { useMemo, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BudgetPayload, IGAActivity, IGABudget, IGABudgetActualRecord, IGAExpense } from '@/services/igaService';

import { IGABudgetDialog } from './IGABudgetDialog';
import { IGAExpenseStatusBadge } from './IGAExpenseStatusBadge';
import { IGAFormField } from './IGAFormField';
import { IGASelectInput } from './IGASelectInput';
import { IGATableCard } from './IGATableCard';
import { canApproveExpenses, formatCurrency, humanizeLabel } from './igaHelpers';

interface BudgetDisplayRow extends IGABudget {
  actual_amount: string;
  variance: string;
}

export function IGAExpensesTab({
  expenses,
  budgets,
  budgetComparison,
  activities,
  approvingExpense,
  rejectingExpense,
  savingBudget,
  updatingBudget,
  currentUserRole,
  onApproveExpense,
  onRejectExpense,
  onCreateBudget,
  onUpdateBudget,
}: {
  expenses: IGAExpense[];
  budgets: IGABudget[];
  budgetComparison: IGABudgetActualRecord[];
  activities: IGAActivity[];
  approvingExpense: boolean;
  rejectingExpense: boolean;
  savingBudget: boolean;
  updatingBudget: boolean;
  currentUserRole?: string | null;
  onApproveExpense: (expenseId: number) => void | Promise<unknown>;
  onRejectExpense: (expenseId: number, reason: string) => void | Promise<unknown>;
  onCreateBudget: (payload: BudgetPayload) => void | Promise<unknown>;
  onUpdateBudget: (budgetId: number, payload: BudgetPayload) => void | Promise<unknown>;
}) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<IGAExpense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [createBudgetOpen, setCreateBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<IGABudget | null>(null);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all');
  const [budgetSearch, setBudgetSearch] = useState('');

  const canModerateExpenses = canApproveExpenses(currentUserRole);

  const filteredExpenses = useMemo(() => {
    const query = expenseSearch.trim().toLowerCase();
    return expenses.filter((item) => {
      const matchesStatus = expenseStatusFilter === 'all' || item.status === expenseStatusFilter;
      const matchesSearch = !query || [
        item.activity_name,
        item.expense_category,
        item.description,
        item.procurement_reference,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [expenseSearch, expenseStatusFilter, expenses]);

  const budgetRows = useMemo<BudgetDisplayRow[]>(() => {
    const comparisonMap = new Map<number, IGABudgetActualRecord>(budgetComparison.map((item) => [item.budget_id, item]));
    return budgets
      .map((budget) => {
        const comparison = comparisonMap.get(budget.id);
        return {
          ...budget,
          actual_amount: comparison?.actual_amount || '0.00',
          variance: comparison?.variance || budget.budget_amount,
        };
      })
      .filter((budget) => {
        const query = budgetSearch.trim().toLowerCase();
        if (!query) {
          return true;
        }
        return [budget.activity_name, budget.category, budget.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [budgetComparison, budgetSearch, budgets]);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <IGATableCard
          title="Expense approvals"
          description="Pending and reviewed expenses for activities."
          headers={canModerateExpenses
            ? ['Date', 'Activity', 'Category', 'Amount', 'Status', 'Reference', 'Actions']
            : ['Date', 'Activity', 'Category', 'Amount', 'Status', 'Reference']}
          rows={filteredExpenses.map((item) => [
            item.expense_date,
            item.activity_name || '—',
            humanizeLabel(item.expense_category),
            formatCurrency(item.amount),
            <IGAExpenseStatusBadge status={item.status} />,
            item.procurement_reference || '—',
            ...(canModerateExpenses
              ? [item.status === 'pending' ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onApproveExpense(item.id)} disabled={approvingExpense}>
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedExpense(item);
                    setRejectionReason('');
                    setRejectDialogOpen(true);
                  }}
                  disabled={rejectingExpense}
                >
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">{item.approved_by_name || 'Completed'}</span>
            )] : []),
          ])}
          emptyText="No expenses have been recorded yet."
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input placeholder="Search expenses" value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} className="w-full sm:w-56" />
              <IGASelectInput
                value={expenseStatusFilter}
                onChange={(event) => setExpenseStatusFilter(event.target.value)}
                placeholder="Filter status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
            </div>
          }
        />

        <IGATableCard
          title="Budget vs actual"
          description="Budget lines compared against approved spending."
          headers={['Activity', 'Category', 'Period', 'Budget', 'Actual', 'Variance', 'Actions']}
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input placeholder="Search budgets" value={budgetSearch} onChange={(event) => setBudgetSearch(event.target.value)} className="w-full sm:w-56" />
              <Button onClick={() => setCreateBudgetOpen(true)}>Add budget</Button>
            </div>
          }
          rows={budgetRows.map((item) => [
            item.activity_name || '—',
            item.category,
            `${item.period_start} → ${item.period_end}`,
            formatCurrency(item.budget_amount),
            formatCurrency(item.actual_amount),
            formatCurrency(item.variance),
            <Button size="sm" variant="outline" onClick={() => setEditingBudget(item)}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>,
          ])}
          emptyText="No budgets have been configured yet."
        />
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject expense</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedExpense?.activity_name || 'this expense'}.
            </DialogDescription>
          </DialogHeader>
          <IGAFormField label="Reason">
            <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
          </IGAFormField>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!selectedExpense || rejectingExpense}
              onClick={async () => {
                if (!selectedExpense) {
                  return;
                }
                await onRejectExpense(selectedExpense.id, rejectionReason);
                setRejectDialogOpen(false);
                setSelectedExpense(null);
                setRejectionReason('');
              }}
            >
              {rejectingExpense ? 'Rejecting...' : 'Reject expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IGABudgetDialog
        open={createBudgetOpen}
        onOpenChange={setCreateBudgetOpen}
        activities={activities}
        submitting={savingBudget}
        onSubmit={async (payload) => {
          await onCreateBudget(payload);
          setCreateBudgetOpen(false);
        }}
      />

      <IGABudgetDialog
        open={Boolean(editingBudget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingBudget(null);
          }
        }}
        activities={activities}
        budget={editingBudget}
        submitting={updatingBudget}
        onSubmit={async (payload, budgetId) => {
          if (!budgetId) {
            return;
          }
          await onUpdateBudget(budgetId, payload);
          setEditingBudget(null);
        }}
      />
    </>
  );
}

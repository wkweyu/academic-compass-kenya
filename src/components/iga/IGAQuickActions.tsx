import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  CreateActivityPayload,
  CreateProductPayload,
  ExpensePayload,
  ProductionPayload,
  SalePayload,
  BudgetPayload,
  IGAActivity,
  IGAProduct,
} from '@/services/igaService';

import { IGAActionDialog } from './IGAActionDialog';
import { IGABudgetDialog } from './IGABudgetDialog';
import { IGAFormField } from './IGAFormField';
import { IGASelectInput } from './IGASelectInput';
import { expenseCategoryOptions, today } from './igaHelpers';

export function IGAQuickActions({
  activities,
  products,
  createActivityPending,
  createProductPending,
  productionPending,
  salePending,
  expensePending,
  budgetPending,
  onCreateActivity,
  onCreateProduct,
  onRecordProduction,
  onRecordSale,
  onRecordExpense,
  onCreateBudget,
}: {
  activities: IGAActivity[];
  products: IGAProduct[];
  createActivityPending: boolean;
  createProductPending: boolean;
  productionPending: boolean;
  salePending: boolean;
  expensePending: boolean;
  budgetPending: boolean;
  onCreateActivity: (payload: CreateActivityPayload) => Promise<unknown>;
  onCreateProduct: (payload: CreateProductPayload) => Promise<unknown>;
  onRecordProduction: (payload: ProductionPayload) => Promise<unknown>;
  onRecordSale: (payload: SalePayload) => Promise<unknown>;
  onRecordExpense: (payload: ExpensePayload) => Promise<unknown>;
  onCreateBudget: (payload: BudgetPayload) => Promise<unknown>;
}) {
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productionDialogOpen, setProductionDialogOpen] = useState(false);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  const [activityForm, setActivityForm] = useState<CreateActivityPayload>({ name: '', description: '', start_date: today, status: 'active' });
  const [productForm, setProductForm] = useState<CreateProductPayload>({ name: '', description: '', unit_of_measure: '', sale_price: '0.00' });
  const [productionForm, setProductionForm] = useState<ProductionPayload>({ activity: 0, product: 0, quantity: '0.00', unit: '', production_date: today, notes: '' });
  const [saleForm, setSaleForm] = useState<SalePayload>({ activity: 0, product: 0, quantity: '0.00', unit_price: '0.00', customer_name: '', sale_date: today, payment_method: 'cash', reference: '' });
  const [expenseForm, setExpenseForm] = useState<ExpensePayload>({ activity: 0, expense_category: 'feed', description: '', amount: '0.00', expense_date: today, procurement_reference: '' });

  const submitActivity = async () => {
    await onCreateActivity(activityForm);
    setActivityDialogOpen(false);
    setActivityForm({ name: '', description: '', start_date: today, status: 'active' });
  };

  const submitProduct = async () => {
    await onCreateProduct(productForm);
    setProductDialogOpen(false);
    setProductForm({ name: '', description: '', unit_of_measure: '', sale_price: '0.00' });
  };

  const submitProduction = async () => {
    await onRecordProduction(productionForm);
    setProductionDialogOpen(false);
    setProductionForm({ activity: 0, product: 0, quantity: '0.00', unit: '', production_date: today, notes: '' });
  };

  const submitSale = async () => {
    await onRecordSale(saleForm);
    setSaleDialogOpen(false);
    setSaleForm({ activity: 0, product: 0, quantity: '0.00', unit_price: '0.00', customer_name: '', sale_date: today, payment_method: 'cash', reference: '' });
  };

  const submitExpense = async () => {
    await onRecordExpense(expenseForm);
    setExpenseDialogOpen(false);
    setExpenseForm({ activity: 0, expense_category: 'feed', description: '', amount: '0.00', expense_date: today, procurement_reference: '' });
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <IGAActionDialog
          open={activityDialogOpen}
          onOpenChange={setActivityDialogOpen}
          title="New activity"
          description="Set up a new income-generating project."
          triggerLabel="Add activity"
          onSubmit={submitActivity}
          submitting={createActivityPending}
        >
          <IGAFormField label="Activity name">
            <Input value={activityForm.name} onChange={(event) => setActivityForm((prev) => ({ ...prev, name: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Description">
            <Textarea value={activityForm.description || ''} onChange={(event) => setActivityForm((prev) => ({ ...prev, description: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Start date">
            <Input type="date" value={activityForm.start_date || today} onChange={(event) => setActivityForm((prev) => ({ ...prev, start_date: event.target.value }))} />
          </IGAFormField>
        </IGAActionDialog>

        <IGAActionDialog
          open={productDialogOpen}
          onOpenChange={setProductDialogOpen}
          title="New product"
          description="Define a produce item for IGA tracking."
          triggerLabel="Add product"
          onSubmit={submitProduct}
          submitting={createProductPending}
        >
          <IGAFormField label="Product name">
            <Input value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Description">
            <Textarea value={productForm.description || ''} onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))} />
          </IGAFormField>
          <div className="grid gap-4 md:grid-cols-2">
            <IGAFormField label="Unit of measure">
              <Input value={productForm.unit_of_measure} onChange={(event) => setProductForm((prev) => ({ ...prev, unit_of_measure: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Sale price">
              <Input type="number" min="0" step="0.01" value={productForm.sale_price} onChange={(event) => setProductForm((prev) => ({ ...prev, sale_price: event.target.value }))} />
            </IGAFormField>
          </div>
        </IGAActionDialog>

        <IGAActionDialog
          open={productionDialogOpen}
          onOpenChange={setProductionDialogOpen}
          title="Record production"
          description="Capture freshly produced output and update stock automatically."
          triggerLabel="Record production"
          onSubmit={submitProduction}
          submitting={productionPending}
        >
          <IGAFormField label="Activity">
            <IGASelectInput
              value={String(productionForm.activity || '')}
              onChange={(event) => setProductionForm((prev) => ({ ...prev, activity: Number(event.target.value) }))}
              options={activities.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </IGAFormField>
          <IGAFormField label="Product">
            <IGASelectInput
              value={String(productionForm.product || '')}
              onChange={(event) => setProductionForm((prev) => ({
                ...prev,
                product: Number(event.target.value),
                unit: products.find((item) => item.id === Number(event.target.value))?.unit_of_measure || '',
              }))}
              options={products.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </IGAFormField>
          <div className="grid gap-4 md:grid-cols-2">
            <IGAFormField label="Quantity">
              <Input type="number" min="0" step="0.01" value={productionForm.quantity} onChange={(event) => setProductionForm((prev) => ({ ...prev, quantity: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Unit">
              <Input value={productionForm.unit || ''} onChange={(event) => setProductionForm((prev) => ({ ...prev, unit: event.target.value }))} />
            </IGAFormField>
          </div>
          <IGAFormField label="Production date">
            <Input type="date" value={productionForm.production_date || today} onChange={(event) => setProductionForm((prev) => ({ ...prev, production_date: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Notes">
            <Textarea value={productionForm.notes || ''} onChange={(event) => setProductionForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </IGAFormField>
        </IGAActionDialog>

        <IGAActionDialog
          open={saleDialogOpen}
          onOpenChange={setSaleDialogOpen}
          title="Record sale"
          description="Post a produce sale and reduce inventory."
          triggerLabel="Record sale"
          onSubmit={submitSale}
          submitting={salePending}
        >
          <IGAFormField label="Activity">
            <IGASelectInput
              value={String(saleForm.activity || '')}
              onChange={(event) => setSaleForm((prev) => ({ ...prev, activity: Number(event.target.value) }))}
              options={activities.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </IGAFormField>
          <IGAFormField label="Product">
            <IGASelectInput
              value={String(saleForm.product || '')}
              onChange={(event) => {
                const productId = Number(event.target.value);
                const product = products.find((item) => item.id === productId);
                setSaleForm((prev) => ({ ...prev, product: productId, unit_price: product?.sale_price || prev.unit_price || '0.00' }));
              }}
              options={products.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </IGAFormField>
          <div className="grid gap-4 md:grid-cols-2">
            <IGAFormField label="Quantity">
              <Input type="number" min="0" step="0.01" value={saleForm.quantity} onChange={(event) => setSaleForm((prev) => ({ ...prev, quantity: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Unit price">
              <Input type="number" min="0" step="0.01" value={saleForm.unit_price || '0.00'} onChange={(event) => setSaleForm((prev) => ({ ...prev, unit_price: event.target.value }))} />
            </IGAFormField>
          </div>
          <IGAFormField label="Customer">
            <Input value={saleForm.customer_name || ''} onChange={(event) => setSaleForm((prev) => ({ ...prev, customer_name: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Reference">
            <Input value={saleForm.reference || ''} onChange={(event) => setSaleForm((prev) => ({ ...prev, reference: event.target.value }))} />
          </IGAFormField>
        </IGAActionDialog>

        <IGAActionDialog
          open={expenseDialogOpen}
          onOpenChange={setExpenseDialogOpen}
          title="Record expense"
          description="Capture a pending expense for approval."
          triggerLabel="Record expense"
          onSubmit={submitExpense}
          submitting={expensePending}
        >
          <IGAFormField label="Activity">
            <IGASelectInput
              value={String(expenseForm.activity || '')}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, activity: Number(event.target.value) }))}
              options={activities.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </IGAFormField>
          <IGAFormField label="Category">
            <IGASelectInput value={expenseForm.expense_category} onChange={(event) => setExpenseForm((prev) => ({ ...prev, expense_category: event.target.value }))} options={[...expenseCategoryOptions]} />
          </IGAFormField>
          <IGAFormField label="Description">
            <Textarea value={expenseForm.description} onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))} />
          </IGAFormField>
          <div className="grid gap-4 md:grid-cols-2">
            <IGAFormField label="Amount">
              <Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Procurement reference">
              <Input value={expenseForm.procurement_reference || ''} onChange={(event) => setExpenseForm((prev) => ({ ...prev, procurement_reference: event.target.value }))} />
            </IGAFormField>
          </div>
        </IGAActionDialog>

        <Button onClick={() => setBudgetDialogOpen(true)}>Add budget</Button>
      </div>

      <IGABudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        activities={activities}
        submitting={budgetPending}
        onSubmit={async (payload) => {
          await onCreateBudget(payload);
          setBudgetDialogOpen(false);
        }}
      />
    </>
  );
}

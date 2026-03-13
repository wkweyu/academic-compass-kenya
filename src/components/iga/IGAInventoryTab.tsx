import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  IGAActivity,
  IGAInventoryRecord,
  IGAMovementSummary,
  IGAProduct,
  InventoryActionPayload,
  InventoryAdjustmentPayload,
} from '@/services/igaService';

import { IGAActionDialog } from './IGAActionDialog';
import { IGAFormField } from './IGAFormField';
import { IGASelectInput } from './IGASelectInput';
import { IGATableCard } from './IGATableCard';
import { formatCurrency, formatNumber, humanizeLabel } from './igaHelpers';

const initialActionForm: InventoryActionPayload = {
  product: 0,
  activity: undefined,
  quantity: '0.00',
  reference: '',
  notes: '',
};

const initialAdjustmentForm: InventoryAdjustmentPayload = {
  product: 0,
  activity: undefined,
  quantity_delta: '0.00',
  reference: '',
  notes: '',
};

export function IGAInventoryTab({
  inventory,
  movements,
  activities,
  products,
  spoilagePending,
  internalUsePending,
  adjustmentPending,
  onRecordSpoilage,
  onRecordInternalUse,
  onAdjustInventory,
}: {
  inventory: IGAInventoryRecord[];
  movements: IGAMovementSummary[];
  activities: IGAActivity[];
  products: IGAProduct[];
  spoilagePending: boolean;
  internalUsePending: boolean;
  adjustmentPending: boolean;
  onRecordSpoilage: (payload: InventoryActionPayload) => Promise<unknown>;
  onRecordInternalUse: (payload: InventoryActionPayload) => Promise<unknown>;
  onAdjustInventory: (payload: InventoryAdjustmentPayload) => Promise<unknown>;
}) {
  const [spoilageOpen, setSpoilageOpen] = useState(false);
  const [internalUseOpen, setInternalUseOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [spoilageForm, setSpoilageForm] = useState<InventoryActionPayload>(initialActionForm);
  const [internalUseForm, setInternalUseForm] = useState<InventoryActionPayload>(initialActionForm);
  const [adjustmentForm, setAdjustmentForm] = useState<InventoryAdjustmentPayload>(initialAdjustmentForm);

  const productOptions = products.map((item) => ({ value: String(item.id), label: item.name }));
  const activityOptions = activities.map((item) => ({ value: String(item.id), label: item.name }));

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <IGATableCard
          title="Inventory stock"
          description="Current stock balances and inventory valuation."
          headers={['Product', 'Available', 'Sold', 'Internal use', 'Spoiled', 'Stock value']}
          rows={inventory.map((item) => [
            item.product_name,
            `${formatNumber(item.quantity_available)} ${item.unit}`,
            formatNumber(item.sold_quantity),
            formatNumber(item.internal_use_quantity),
            formatNumber(item.spoiled_quantity),
            formatCurrency(item.stock_value),
          ])}
          emptyText="No inventory tracked yet."
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => setSpoilageOpen(true)}>Record spoilage</Button>
              <Button variant="outline" onClick={() => setInternalUseOpen(true)}>Internal use</Button>
              <Button onClick={() => setAdjustmentOpen(true)}>Adjust stock</Button>
            </div>
          }
        />

        <IGATableCard
          title="Inventory movements"
          description="Latest stock changes across production, sales, spoilage, and adjustments."
          headers={['Reference', 'Type', 'Product', 'Activity', 'Quantity', 'Date']}
          rows={movements.map((item) => [
            item.reference || `#${item.id}`,
            humanizeLabel(item.movement_type),
            item.product__name,
            item.activity__name || '—',
            `${formatNumber(item.quantity)} ${item.unit}`,
            new Date(item.date).toLocaleString(),
          ])}
          emptyText="No inventory movements recorded yet."
        />
      </div>

      <IGAActionDialog
        open={spoilageOpen}
        onOpenChange={setSpoilageOpen}
        title="Record spoilage"
        description="Reduce stock for spoiled or damaged produce and keep the loss trail complete."
        triggerLabel="Hidden"
        hideTrigger
        onSubmit={async () => {
          await onRecordSpoilage(spoilageForm);
          setSpoilageOpen(false);
          setSpoilageForm(initialActionForm);
        }}
        submitting={spoilagePending}
      >
        <IGAFormField label="Product">
          <IGASelectInput value={String(spoilageForm.product || '')} onChange={(event) => setSpoilageForm((prev) => ({ ...prev, product: Number(event.target.value) }))} options={productOptions} />
        </IGAFormField>
        <IGAFormField label="Activity">
          <IGASelectInput value={String(spoilageForm.activity || '')} onChange={(event) => setSpoilageForm((prev) => ({ ...prev, activity: event.target.value ? Number(event.target.value) : undefined }))} options={activityOptions} placeholder="Optional activity" />
        </IGAFormField>
        <IGAFormField label="Quantity">
          <Input type="number" min="0" step="0.01" value={spoilageForm.quantity} onChange={(event) => setSpoilageForm((prev) => ({ ...prev, quantity: event.target.value }))} />
        </IGAFormField>
        <IGAFormField label="Reference">
          <Input value={spoilageForm.reference || ''} onChange={(event) => setSpoilageForm((prev) => ({ ...prev, reference: event.target.value }))} />
        </IGAFormField>
        <IGAFormField label="Notes">
          <Textarea value={spoilageForm.notes || ''} onChange={(event) => setSpoilageForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </IGAFormField>
      </IGAActionDialog>

      <IGAActionDialog
        open={internalUseOpen}
        onOpenChange={setInternalUseOpen}
        title="Record internal consumption"
        description="Capture produce consumed internally, such as use by the school kitchen."
        triggerLabel="Hidden"
        hideTrigger
        onSubmit={async () => {
          await onRecordInternalUse(internalUseForm);
          setInternalUseOpen(false);
          setInternalUseForm(initialActionForm);
        }}
        submitting={internalUsePending}
      >
        <IGAFormField label="Product">
          <IGASelectInput value={String(internalUseForm.product || '')} onChange={(event) => setInternalUseForm((prev) => ({ ...prev, product: Number(event.target.value) }))} options={productOptions} />
        </IGAFormField>
        <IGAFormField label="Activity">
          <IGASelectInput value={String(internalUseForm.activity || '')} onChange={(event) => setInternalUseForm((prev) => ({ ...prev, activity: event.target.value ? Number(event.target.value) : undefined }))} options={activityOptions} placeholder="Optional activity" />
        </IGAFormField>
        <IGAFormField label="Quantity">
          <Input type="number" min="0" step="0.01" value={internalUseForm.quantity} onChange={(event) => setInternalUseForm((prev) => ({ ...prev, quantity: event.target.value }))} />
        </IGAFormField>
        <IGAFormField label="Reference">
          <Input value={internalUseForm.reference || ''} onChange={(event) => setInternalUseForm((prev) => ({ ...prev, reference: event.target.value }))} />
        </IGAFormField>
        <IGAFormField label="Notes">
          <Textarea value={internalUseForm.notes || ''} onChange={(event) => setInternalUseForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </IGAFormField>
      </IGAActionDialog>

      <IGAActionDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        title="Adjust inventory"
        description="Apply a positive or negative stock correction with a reference trail."
        triggerLabel="Hidden"
        hideTrigger
        onSubmit={async () => {
          await onAdjustInventory(adjustmentForm);
          setAdjustmentOpen(false);
          setAdjustmentForm(initialAdjustmentForm);
        }}
        submitting={adjustmentPending}
      >
        <IGAFormField label="Product">
          <IGASelectInput value={String(adjustmentForm.product || '')} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, product: Number(event.target.value) }))} options={productOptions} />
        </IGAFormField>
        <IGAFormField label="Activity">
          <IGASelectInput value={String(adjustmentForm.activity || '')} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, activity: event.target.value ? Number(event.target.value) : undefined }))} options={activityOptions} placeholder="Optional activity" />
        </IGAFormField>
        <IGAFormField label="Quantity delta">
          <Input type="number" step="0.01" value={adjustmentForm.quantity_delta} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, quantity_delta: event.target.value }))} />
        </IGAFormField>
        <IGAFormField label="Reference">
          <Input value={adjustmentForm.reference || ''} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, reference: event.target.value }))} />
        </IGAFormField>
        <IGAFormField label="Notes">
          <Textarea value={adjustmentForm.notes || ''} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </IGAFormField>
      </IGAActionDialog>
    </>
  );
}

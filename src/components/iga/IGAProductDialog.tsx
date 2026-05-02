import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CreateProductPayload, IGAProduct } from '@/services/igaService';

import { IGAFormField } from './IGAFormField';

const defaultProductForm: CreateProductPayload = {
  name: '',
  description: '',
  unit_of_measure: '',
  sale_price: '0.00',
};

export function IGAProductDialog({
  open,
  onOpenChange,
  product,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: IGAProduct | null;
  submitting: boolean;
  onSubmit: (payload: CreateProductPayload, productId?: number) => void | Promise<unknown>;
}) {
  const [form, setForm] = useState<CreateProductPayload>(defaultProductForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (product) {
      setForm({
        name: product.name,
        description: product.description || '',
        unit_of_measure: product.unit_of_measure,
        sale_price: product.sale_price,
      });
      return;
    }

    setForm(defaultProductForm);
  }, [open, product]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Create product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Update produce details for this item.' : 'Define a produce item for IGA tracking.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <IGAFormField label="Product name">
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Description">
            <Textarea value={form.description || ''} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </IGAFormField>
          <div className="grid gap-4 md:grid-cols-2">
            <IGAFormField label="Unit of measure">
              <Input value={form.unit_of_measure} onChange={(event) => setForm((prev) => ({ ...prev, unit_of_measure: event.target.value }))} />
            </IGAFormField>
            <IGAFormField label="Sale price">
              <Input type="number" min="0" step="0.01" value={form.sale_price} onChange={(event) => setForm((prev) => ({ ...prev, sale_price: event.target.value }))} />
            </IGAFormField>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit(form, product?.id)} disabled={submitting}>
            {submitting ? 'Saving...' : product ? 'Update product' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

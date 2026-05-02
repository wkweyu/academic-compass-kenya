import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CreateProductPayload, IGAProduct } from '@/services/igaService';

import { IGAProductDialog } from './IGAProductDialog';
import { IGATableCard } from './IGATableCard';
import { formatCurrency } from './igaHelpers';

export function IGAProductsTab({
  products,
  loading,
  submitting,
  onUpdateProduct,
}: {
  products: IGAProduct[];
  loading: boolean;
  submitting: boolean;
  onUpdateProduct: (productId: number, payload: CreateProductPayload) => void | Promise<unknown>;
}) {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<IGAProduct | null>(null);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((item) =>
      [item.name, item.description, item.unit_of_measure]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  return (
    <>
      <IGATableCard
        title="Products"
        description="Produce items tracked under IGA activities."
        headers={['Name', 'Unit', 'Sale price', 'Status', 'Actions']}
        rows={filteredProducts.map((item) => [
          item.name,
          item.unit_of_measure,
          formatCurrency(item.sale_price),
          item.is_active ? 'Active' : 'Inactive',
          <Button size="sm" variant="outline" onClick={() => setEditingProduct(item)}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>,
        ])}
        emptyText={loading ? 'Loading products...' : 'No products created yet.'}
        action={<Input placeholder="Search products" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-64" />}
      />

      <IGAProductDialog
        open={Boolean(editingProduct)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
          }
        }}
        product={editingProduct}
        submitting={submitting}
        onSubmit={async (payload, productId) => {
          if (!productId) {
            return;
          }
          await onUpdateProduct(productId, payload);
          setEditingProduct(null);
        }}
      />
    </>
  );
}

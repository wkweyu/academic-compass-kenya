import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { procurementService } from '@/services/procurementService';
import SuppliersTab from '@/components/procurement/SuppliersTab';
import ItemsTab from '@/components/procurement/ItemsTab';
import LPOsTab from '@/components/procurement/LPOsTab';
import VouchersTab from '@/components/procurement/VouchersTab';
import StockTab from '@/components/procurement/StockTab';
import PettyCashTab from '@/components/procurement/PettyCashTab';
import { supabase } from '@/integrations/supabase/client';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState('suppliers');

  const { data: stats } = useQuery({ queryKey: ['procurement-stats'], queryFn: () => procurementService.getStats() });
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => procurementService.getSuppliers() });
  const { data: items = [], refetch: refetchItems } = useQuery({ queryKey: ['procurement-items'], queryFn: () => procurementService.getItems() });
  const { data: lpos = [], refetch: refetchLPOs } = useQuery({ queryKey: ['lpos'], queryFn: () => procurementService.getLPOs() });
  const { data: vouchers = [], refetch: refetchVouchers } = useQuery({ queryKey: ['payment-vouchers'], queryFn: () => procurementService.getPaymentVouchers() });
  const { data: categories = [], refetch: refetchCategories } = useQuery({ queryKey: ['item-categories'], queryFn: () => procurementService.getItemCategories() });
  const { data: stockBalances = [], refetch: refetchStock } = useQuery({ queryKey: ['stock-balances'], queryFn: () => procurementService.getStockBalances() });
  const { data: transactions = [], refetch: refetchTransactions } = useQuery({ queryKey: ['stock-transactions'], queryFn: () => procurementService.getStockTransactions() });
  const { data: pettyCash = [], refetch: refetchPettyCash } = useQuery({ queryKey: ['petty-cash'], queryFn: () => procurementService.getPettyCash() });
  const { data: voteHeads = [] } = useQuery({ queryKey: ['vote-heads'], queryFn: () => procurementService.getVoteHeads() });
  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return (data as any)?.[0];
    },
  });

  const schoolName = schoolProfile?.name || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
        <p className="text-muted-foreground">Suppliers, purchases, stock, payments & petty cash</p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Suppliers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.supplier_count}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.item_count}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending LPOs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pending_lpos}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total LPO Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.total_lpo_value)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Vouchers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.total_voucher_value)}</div></CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="items">Items & Categories</TabsTrigger>
          <TabsTrigger value="lpos">Purchase Orders</TabsTrigger>
          <TabsTrigger value="vouchers">Payment Vouchers</TabsTrigger>
          <TabsTrigger value="stock">Stock & Inventory</TabsTrigger>
          <TabsTrigger value="petty-cash">Petty Cash</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <SuppliersTab suppliers={suppliers} refetch={refetchSuppliers} />
        </TabsContent>

        <TabsContent value="items">
          <ItemsTab items={items} categories={categories} suppliers={suppliers} stockBalances={stockBalances}
            refetchItems={refetchItems} refetchCategories={refetchCategories} />
        </TabsContent>

        <TabsContent value="lpos">
          <LPOsTab lpos={lpos} suppliers={suppliers} inventoryItems={items} refetch={refetchLPOs}
            refetchStock={() => { refetchStock(); refetchTransactions(); }} schoolName={schoolName} />
        </TabsContent>

        <TabsContent value="vouchers">
          <VouchersTab vouchers={vouchers} suppliers={suppliers} voteHeads={voteHeads}
            refetch={refetchVouchers} schoolName={schoolName} />
        </TabsContent>

        <TabsContent value="stock">
          <StockTab stockBalances={stockBalances} transactions={transactions} items={items}
            refetchStock={refetchStock} refetchTransactions={refetchTransactions} />
        </TabsContent>

        <TabsContent value="petty-cash">
          <PettyCashTab transactions={pettyCash} voteHeads={voteHeads} refetch={refetchPettyCash} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

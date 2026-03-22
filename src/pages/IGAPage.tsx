import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { IGAActivitiesTab } from '@/components/iga/IGAActivitiesTab';
import { IGAExpensesTab } from '@/components/iga/IGAExpensesTab';
import { IGAInventoryTab } from '@/components/iga/IGAInventoryTab';
import { IGAOverviewTab } from '@/components/iga/IGAOverviewTab';
import { IGAProductsTab } from '@/components/iga/IGAProductsTab';
import { IGAProductionTab } from '@/components/iga/IGAProductionTab';
import { IGAQuickActions } from '@/components/iga/IGAQuickActions';
import { IGASalesTab } from '@/components/iga/IGASalesTab';
import { IGASummaryCards } from '@/components/iga/IGASummaryCards';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/authService';
import {
  igaService,
  type BudgetPayload,
  type CreateActivityPayload,
  type CreateProductPayload,
  type ExpensePayload,
  type InventoryActionPayload,
  type InventoryAdjustmentPayload,
  type ProductionPayload,
  type SalePayload,
} from '@/services/igaService';
import { ApiError } from '@/api/client';

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.standardError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
}

export default function IGAPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: overview, isLoading: overviewLoading } = useQuery({ queryKey: ['iga-overview'], queryFn: () => igaService.getOverview() });
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({ queryKey: ['iga-activities'], queryFn: () => igaService.getActivities() });
  const { data: products = [], isLoading: productsLoading } = useQuery({ queryKey: ['iga-products'], queryFn: () => igaService.getProducts() });
  const { data: productionRecords = [] } = useQuery({ queryKey: ['iga-production'], queryFn: () => igaService.getProductionRecords() });
  const { data: inventoryMovements = [] } = useQuery({ queryKey: ['iga-inventory-movements'], queryFn: () => igaService.getInventoryMovements() });
  const { data: sales = [] } = useQuery({ queryKey: ['iga-sales'], queryFn: () => igaService.getSales() });
  const { data: expenses = [] } = useQuery({ queryKey: ['iga-expenses'], queryFn: () => igaService.getExpenses() });
  const { data: budgets = [] } = useQuery({ queryKey: ['iga-budgets'], queryFn: () => igaService.getBudgets() });
  const { data: currentUser } = useQuery({ queryKey: ['current-user'], queryFn: () => authService.getCurrentUser() });

  const refreshKeys = ['iga-overview', 'iga-activities', 'iga-products', 'iga-production', 'iga-inventory-movements', 'iga-sales', 'iga-expenses', 'iga-budgets'] as const;
  const invalidateIgaQueries = async () => {
    await Promise.all(refreshKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };

  const createActivityMutation = useMutation({
    mutationFn: (payload: CreateActivityPayload) => igaService.createActivity(payload),
    onSuccess: async () => {
      toast({ title: 'Activity created', description: 'The IGA activity was saved successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to create activity', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const createProductMutation = useMutation({
    mutationFn: (payload: CreateProductPayload) => igaService.createProduct(payload),
    onSuccess: async () => {
      toast({ title: 'Product created', description: 'The produce item was saved successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to create product', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ activityId, payload }: { activityId: number; payload: CreateActivityPayload }) => igaService.updateActivity(activityId, payload),
    onSuccess: async () => {
      toast({ title: 'Activity updated', description: 'The IGA activity was updated successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to update activity', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: CreateProductPayload }) => igaService.updateProduct(productId, payload),
    onSuccess: async () => {
      toast({ title: 'Product updated', description: 'The produce item was updated successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to update product', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const recordProductionMutation = useMutation({
    mutationFn: (payload: ProductionPayload) => igaService.recordProduction(payload),
    onSuccess: async () => {
      toast({ title: 'Production recorded', description: 'Inventory was updated from the production entry.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to record production', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const recordSaleMutation = useMutation({
    mutationFn: (payload: SalePayload) => igaService.recordSale(payload),
    onSuccess: async () => {
      toast({ title: 'Sale recorded', description: 'Inventory and accounting summaries were updated.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to record sale', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const recordExpenseMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => igaService.recordExpense(payload),
    onSuccess: async () => {
      toast({ title: 'Expense recorded', description: 'The expense is now awaiting approval.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to record expense', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const recordSpoilageMutation = useMutation({
    mutationFn: (payload: InventoryActionPayload) => igaService.recordSpoilage(payload),
    onSuccess: async () => {
      toast({ title: 'Spoilage recorded', description: 'Inventory and loss tracking were updated.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to record spoilage', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const recordInternalUseMutation = useMutation({
    mutationFn: (payload: InventoryActionPayload) => igaService.recordInternalUse(payload),
    onSuccess: async () => {
      toast({ title: 'Internal use recorded', description: 'Inventory was updated for internal consumption.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to record internal use', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: (payload: InventoryAdjustmentPayload) => igaService.adjustInventory(payload),
    onSuccess: async () => {
      toast({ title: 'Inventory adjusted', description: 'Stock balances were adjusted successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to adjust inventory', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const approveExpenseMutation = useMutation({
    mutationFn: (expenseId: number) => igaService.approveExpense(expenseId),
    onSuccess: async () => {
      toast({ title: 'Expense approved', description: 'The expense was approved and posted.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to approve expense', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const rejectExpenseMutation = useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: number; reason: string }) => igaService.rejectExpense(expenseId, { reason }),
    onSuccess: async () => {
      toast({ title: 'Expense rejected', description: 'The expense was rejected successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to reject expense', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const createBudgetMutation = useMutation({
    mutationFn: (payload: BudgetPayload) => igaService.createBudget(payload),
    onSuccess: async () => {
      toast({ title: 'Budget created', description: 'The budget line was saved successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to create budget', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ budgetId, payload }: { budgetId: number; payload: BudgetPayload }) => igaService.updateBudget(budgetId, payload),
    onSuccess: async () => {
      toast({ title: 'Budget updated', description: 'The budget line was updated successfully.' });
      await invalidateIgaQueries();
    },
    onError: (error) => toast({ title: 'Unable to update budget', description: getErrorMessage(error), variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="IGA Management" description="Production, inventory, sales, budgets, and approvals for income-generating activities." />

      <IGAQuickActions
        activities={activities}
        products={products}
        createActivityPending={createActivityMutation.isPending}
        createProductPending={createProductMutation.isPending}
        productionPending={recordProductionMutation.isPending}
        salePending={recordSaleMutation.isPending}
        expensePending={recordExpenseMutation.isPending}
        budgetPending={createBudgetMutation.isPending}
        onCreateActivity={createActivityMutation.mutateAsync}
        onCreateProduct={createProductMutation.mutateAsync}
        onRecordProduction={recordProductionMutation.mutateAsync}
        onRecordSale={recordSaleMutation.mutateAsync}
        onRecordExpense={recordExpenseMutation.mutateAsync}
        onCreateBudget={createBudgetMutation.mutateAsync}
      />

      <IGASummaryCards overview={overview} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <IGAOverviewTab overview={overview} loading={overviewLoading || activitiesLoading || productsLoading} />
        </TabsContent>

        <TabsContent value="activities">
          <IGAActivitiesTab
            activities={activities}
            loading={activitiesLoading}
            submitting={updateActivityMutation.isPending}
            onUpdateActivity={(activityId, payload) => updateActivityMutation.mutateAsync({ activityId, payload })}
          />
        </TabsContent>

        <TabsContent value="products">
          <IGAProductsTab
            products={products}
            loading={productsLoading}
            submitting={updateProductMutation.isPending}
            onUpdateProduct={(productId, payload) => updateProductMutation.mutateAsync({ productId, payload })}
          />
        </TabsContent>

        <TabsContent value="production">
          <IGAProductionTab productionRecords={productionRecords} />
        </TabsContent>

        <TabsContent value="inventory">
          <IGAInventoryTab
            inventory={overview?.inventory || []}
            movements={inventoryMovements}
            activities={activities}
            products={products}
            spoilagePending={recordSpoilageMutation.isPending}
            internalUsePending={recordInternalUseMutation.isPending}
            adjustmentPending={adjustInventoryMutation.isPending}
            onRecordSpoilage={recordSpoilageMutation.mutateAsync}
            onRecordInternalUse={recordInternalUseMutation.mutateAsync}
            onAdjustInventory={adjustInventoryMutation.mutateAsync}
          />
        </TabsContent>

        <TabsContent value="sales">
          <IGASalesTab sales={sales} />
        </TabsContent>

        <TabsContent value="expenses">
          <IGAExpensesTab
            expenses={expenses}
            budgets={budgets}
            budgetComparison={overview?.budget_vs_actual || []}
            activities={activities}
            approvingExpense={approveExpenseMutation.isPending}
            rejectingExpense={rejectExpenseMutation.isPending}
            savingBudget={createBudgetMutation.isPending}
            updatingBudget={updateBudgetMutation.isPending}
            currentUserRole={currentUser?.role}
            onApproveExpense={approveExpenseMutation.mutateAsync}
            onRejectExpense={(expenseId, reason) => rejectExpenseMutation.mutateAsync({ expenseId, reason })}
            onCreateBudget={createBudgetMutation.mutateAsync}
            onUpdateBudget={(budgetId, payload) => updateBudgetMutation.mutateAsync({ budgetId, payload })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

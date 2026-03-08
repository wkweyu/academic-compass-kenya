import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { accountingService } from '@/services/accountingService';
import ChartOfAccountsTab from '@/components/accounting/ChartOfAccountsTab';
import JournalEntriesTab from '@/components/accounting/JournalEntriesTab';
import GeneralLedgerTab from '@/components/accounting/GeneralLedgerTab';
import ReportsTab from '@/components/accounting/ReportsTab';
import BankReconciliationTab from '@/components/accounting/BankReconciliationTab';
import FundAccountingTab from '@/components/accounting/FundAccountingTab';
import AuditTrailTab from '@/components/accounting/AuditTrailTab';
import FiscalYearManager from '@/components/accounting/FiscalYearManager';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('accounts');

  const { data: stats } = useQuery({
    queryKey: ['accounting-stats'],
    queryFn: () => accountingService.getStats(),
  });

  useEffect(() => { accountingService.seedDefaultAccounts().catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
          <p className="text-muted-foreground">Double-entry bookkeeping, financial statements & audit controls</p>
        </div>
        <FiscalYearManager />
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active Accounts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.active_accounts}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Posted Entries</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.posted_entries}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Draft Entries</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.draft_entries}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Debits</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_debits)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Credits</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.total_credits)}</div></CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="ledger">General Ledger</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="bank">Bank Reconciliation</TabsTrigger>
          <TabsTrigger value="funds">Fund Accounting</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts"><ChartOfAccountsTab /></TabsContent>
        <TabsContent value="ledger"><GeneralLedgerTab /></TabsContent>
        <TabsContent value="journal"><JournalEntriesTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="bank"><BankReconciliationTab /></TabsContent>
        <TabsContent value="funds"><FundAccountingTab /></TabsContent>
        <TabsContent value="audit"><AuditTrailTab /></TabsContent>
      </Tabs>
    </div>
  );
}

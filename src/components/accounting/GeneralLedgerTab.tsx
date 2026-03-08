import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { accountingService } from '@/services/accountingService';
import { ledgerService } from '@/services/accounting/ledgerService';
import { fiscalYearService } from '@/services/accounting/fiscalYearService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function GeneralLedgerTab() {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fiscalYearId, setFiscalYearId] = useState('');

  const { data: accounts = [] } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => accountingService.getAccounts() });
  const { data: fiscalYears = [] } = useQuery({ queryKey: ['fiscal-years'], queryFn: () => fiscalYearService.getAll() });

  const { data: ledgerEntries = [], isLoading } = useQuery({
    queryKey: ['ledger-statement', selectedAccountId, startDate, endDate, fiscalYearId],
    queryFn: () => ledgerService.getLedgerStatement({
      accountId: parseInt(selectedAccountId),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      fiscalYearId: fiscalYearId ? parseInt(fiscalYearId) : undefined,
    }),
    enabled: !!selectedAccountId,
  });

  const selectedAccount = accounts.find(a => a.id === parseInt(selectedAccountId));

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Ledger</CardTitle>
        <CardDescription>Select an account to view its full transaction history with running balance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Account *</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.is_active && !a.is_header).map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.account_code} - {a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fiscal Year</Label>
            <Select value={fiscalYearId} onValueChange={setFiscalYearId}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {fiscalYears.map(fy => <SelectItem key={fy.id} value={fy.id.toString()}>{fy.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>

        {selectedAccountId ? (
          <>
            {selectedAccount && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="capitalize">{selectedAccount.account_type}</Badge>
                <span className="font-mono">{selectedAccount.account_code}</span>
                <span className="font-semibold">{selectedAccount.account_name}</span>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e, i) => (
                  <TableRow key={i} className={e.is_reversal ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                    <TableCell>{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-sm">{e.reference_number}</TableCell>
                    <TableCell>
                      {e.is_reversal && <Badge variant="outline" className="mr-1 text-xs text-orange-600">REV</Badge>}
                      {e.description}
                    </TableCell>
                    <TableCell className="text-right">{e.debit_amount > 0 ? formatCurrency(e.debit_amount) : '-'}</TableCell>
                    <TableCell className="text-right">{e.credit_amount > 0 ? formatCurrency(e.credit_amount) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(e.running_balance)}</TableCell>
                  </TableRow>
                ))}
                {ledgerEntries.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions for this account</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {ledgerEntries.length > 0 && (
              <div className="text-right text-sm font-semibold">
                Closing Balance: {formatCurrency(ledgerEntries[ledgerEntries.length - 1].running_balance)}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Select an account to view its ledger statement</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

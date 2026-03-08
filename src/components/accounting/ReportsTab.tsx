import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { reportService } from '@/services/accounting/reportService';
import { fiscalYearService } from '@/services/accounting/fiscalYearService';
import { fundService } from '@/services/accounting/fundService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export default function ReportsTab() {
  const [reportTab, setReportTab] = useState('trial-balance');
  const [fiscalYearId, setFiscalYearId] = useState('');
  const [fundId, setFundId] = useState('');

  const { data: fiscalYears = [] } = useQuery({ queryKey: ['fiscal-years'], queryFn: () => fiscalYearService.getAll() });
  const { data: funds = [] } = useQuery({ queryKey: ['accounting-funds'], queryFn: () => fundService.getAll() });

  const fyId = fiscalYearId && fiscalYearId !== '__all__' ? parseInt(fiscalYearId) : undefined;
  const fId = fundId && fundId !== '__all__' ? parseInt(fundId) : undefined;

  const { data: trialBalance = [] } = useQuery({
    queryKey: ['trial-balance', fyId, fId],
    queryFn: () => reportService.getTrialBalance(fyId, fId),
    enabled: reportTab === 'trial-balance',
  });

  const { data: incomeExp } = useQuery({
    queryKey: ['income-expenditure', fyId, fId],
    queryFn: () => reportService.getIncomeExpenditure(fyId, fId),
    enabled: reportTab === 'income-expenditure',
  });

  const { data: finPosition } = useQuery({
    queryKey: ['financial-position', fyId, fId],
    queryFn: () => reportService.getFinancialPosition(fyId, fId),
    enabled: reportTab === 'financial-position',
  });

  const { data: cashFlow } = useQuery({
    queryKey: ['cash-flow', fyId],
    queryFn: () => reportService.getCashFlowStatement(fyId),
    enabled: reportTab === 'cash-flow',
  });

  const handlePrint = () => window.print();

  const FilterBar = () => (
    <div className="flex gap-3 items-end flex-wrap mb-4">
      <div>
        <Label>Fiscal Year</Label>
        <Select value={fiscalYearId} onValueChange={setFiscalYearId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All periods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All periods</SelectItem>
            {fiscalYears.map(fy => <SelectItem key={fy.id} value={fy.id.toString()}>{fy.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Fund</Label>
        <Select value={fundId} onValueChange={setFundId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All funds" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All funds</SelectItem>
            {funds.filter(f => f.is_active).map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.fund_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print</Button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Reports</CardTitle>
        <CardDescription>Generate audit-ready financial statements</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={reportTab} onValueChange={setReportTab}>
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="income-expenditure">Income & Expenditure</TabsTrigger>
            <TabsTrigger value="financial-position">Financial Position</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          </TabsList>

          <FilterBar />

          <TabsContent value="trial-balance">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
              <TableBody>
                {trialBalance.map(t => (
                  <TableRow key={t.account_code}>
                    <TableCell className="font-mono">{t.account_code}</TableCell>
                    <TableCell className="font-medium">{t.account_name}</TableCell>
                    <TableCell className="capitalize">{t.account_type}</TableCell>
                    <TableCell className="text-right">{t.debit_total > 0 ? formatCurrency(t.debit_total) : '-'}</TableCell>
                    <TableCell className="text-right">{t.credit_total > 0 ? formatCurrency(t.credit_total) : '-'}</TableCell>
                  </TableRow>
                ))}
                {trialBalance.length > 0 && (
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Totals</TableCell>
                    <TableCell className="text-right">{formatCurrency(trialBalance.reduce((s, t) => s + t.debit_total, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(trialBalance.reduce((s, t) => s + t.credit_total, 0))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {trialBalance.length === 0 && <p className="text-center py-8 text-muted-foreground">No posted entries</p>}
          </TabsContent>

          <TabsContent value="income-expenditure">
            {incomeExp ? (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-green-700">Income</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount (KES)</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {incomeExp.income.map(l => (
                        <TableRow key={l.account_code}><TableCell className="font-mono">{l.account_code}</TableCell><TableCell>{l.account_name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2"><TableCell colSpan={2}>Total Income</TableCell><TableCell className="text-right text-green-700">{formatCurrency(incomeExp.total_income)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-red-700">Expenditure</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount (KES)</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {incomeExp.expenditure.map(l => (
                        <TableRow key={l.account_code}><TableCell className="font-mono">{l.account_code}</TableCell><TableCell>{l.account_name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2"><TableCell colSpan={2}>Total Expenditure</TableCell><TableCell className="text-right text-red-700">{formatCurrency(incomeExp.total_expenditure)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className={`p-4 rounded-lg text-center text-lg font-bold ${incomeExp.surplus_deficit >= 0 ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-400'}`}>
                  {incomeExp.surplus_deficit >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(incomeExp.surplus_deficit))}
                </div>
              </div>
            ) : <p className="text-center py-8 text-muted-foreground">Loading...</p>}
          </TabsContent>

          <TabsContent value="financial-position">
            {finPosition ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Assets</h3>
                  <Table>
                    <TableBody>
                      {finPosition.assets.map(l => (
                        <TableRow key={l.account_code}><TableCell>{l.account_code && <span className="font-mono mr-2">{l.account_code}</span>}{l.account_name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2"><TableCell>Total Assets</TableCell><TableCell className="text-right">{formatCurrency(finPosition.total_assets)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Liabilities</h3>
                    <Table>
                      <TableBody>
                        {finPosition.liabilities.map(l => (
                          <TableRow key={l.account_code}><TableCell>{l.account_code && <span className="font-mono mr-2">{l.account_code}</span>}{l.account_name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                        ))}
                        <TableRow className="font-bold border-t"><TableCell>Total Liabilities</TableCell><TableCell className="text-right">{formatCurrency(finPosition.total_liabilities)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Equity</h3>
                    <Table>
                      <TableBody>
                        {finPosition.equity.map((l, i) => (
                          <TableRow key={i}><TableCell>{l.account_code && <span className="font-mono mr-2">{l.account_code}</span>}{l.account_name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                        ))}
                        <TableRow className="font-bold border-t"><TableCell>Total Equity</TableCell><TableCell className="text-right">{formatCurrency(finPosition.total_equity)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="font-bold border-t-2 pt-2 text-right">
                    Total Liabilities + Equity: {formatCurrency(finPosition.total_liabilities + finPosition.total_equity)}
                  </div>
                </div>
              </div>
            ) : <p className="text-center py-8 text-muted-foreground">Loading...</p>}
          </TabsContent>

          <TabsContent value="cash-flow">
            {cashFlow ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Operating Activities</h3>
                <Table>
                  <TableBody>
                    {cashFlow.operating.map((l, i) => (
                      <TableRow key={i}><TableCell>{l.description}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-bold border-t"><TableCell>Net Operating Cash Flow</TableCell><TableCell className="text-right">{formatCurrency(cashFlow.total_operating)}</TableCell></TableRow>
                  </TableBody>
                </Table>
                <div className="p-4 rounded-lg bg-muted text-center font-bold">
                  Net Change in Cash: {formatCurrency(cashFlow.net_change)}
                </div>
              </div>
            ) : <p className="text-center py-8 text-muted-foreground">Loading...</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

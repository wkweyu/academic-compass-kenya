import { useState, useMemo } from 'react';
import { Printer, AlertTriangle, TrendingUp, BarChart3, Package, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LPO, PaymentVoucher, StockBalance, Supplier, ProcurementItem } from '@/services/procurementService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  lpos: LPO[];
  vouchers: PaymentVoucher[];
  stockBalances: StockBalance[];
  suppliers: Supplier[];
  items: ProcurementItem[];
  voteHeads: { id: number; name: string }[];
  schoolName: string;
}

export default function ProcurementReportsTab({ lpos, vouchers, stockBalances, suppliers, items, voteHeads, schoolName }: Props) {
  const [reportTab, setReportTab] = useState('purchase-summary');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const yearNum = parseInt(selectedYear);

  // ── Purchase Summary by Supplier ──
  const purchaseSummary = useMemo(() => {
    const map: Record<number, { supplier_name: string; lpo_count: number; lpo_total: number; paid_total: number; pending_total: number }> = {};
    for (const l of lpos) {
      const yr = new Date(l.date).getFullYear();
      if (yr !== yearNum) continue;
      if (!map[l.supplier_id]) map[l.supplier_id] = { supplier_name: l.supplier_name || '', lpo_count: 0, lpo_total: 0, paid_total: 0, pending_total: 0 };
      map[l.supplier_id].lpo_count++;
      map[l.supplier_id].lpo_total += Number(l.total_amount);
      if (l.status === 'Delivered' || l.status === 'Paid') map[l.supplier_id].paid_total += Number(l.total_amount);
      else map[l.supplier_id].pending_total += Number(l.total_amount);
    }
    return Object.values(map).sort((a, b) => b.lpo_total - a.lpo_total);
  }, [lpos, yearNum]);

  const purchaseTotals = useMemo(() => purchaseSummary.reduce(
    (acc, s) => ({ lpo_count: acc.lpo_count + s.lpo_count, lpo_total: acc.lpo_total + s.lpo_total, paid_total: acc.paid_total + s.paid_total, pending_total: acc.pending_total + s.pending_total }),
    { lpo_count: 0, lpo_total: 0, paid_total: 0, pending_total: 0 }
  ), [purchaseSummary]);

  // ── Stock Valuation ──
  const stockValuation = useMemo(() => {
    return stockBalances.map(sb => {
      const item = items.find(i => i.id === sb.item_id);
      const unitPrice = item ? Number(item.unit_price) : 0;
      return { ...sb, unit_price: unitPrice, valuation: sb.balance * unitPrice };
    }).sort((a, b) => b.valuation - a.valuation);
  }, [stockBalances, items]);

  const totalValuation = useMemo(() => stockValuation.reduce((s, v) => s + v.valuation, 0), [stockValuation]);

  // ── Monthly Expenditure by Vote Head ──
  const monthlyExpenditure = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    for (const v of vouchers) {
      const d = new Date(v.date);
      if (d.getFullYear() !== yearNum) continue;
      if (v.status !== 'Paid' && v.status !== 'Approved') continue;
      const vhName = v.vote_head_name || 'Unclassified';
      if (!grid[vhName]) grid[vhName] = {};
      const month = d.getMonth();
      grid[vhName][month] = (grid[vhName][month] || 0) + Number(v.amount);
    }
    return Object.entries(grid).map(([name, months]) => {
      const total = Object.values(months).reduce((s, v) => s + v, 0);
      return { name, months, total };
    }).sort((a, b) => b.total - a.total);
  }, [vouchers, yearNum]);

  const monthlyTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    let grandTotal = 0;
    for (const row of monthlyExpenditure) {
      for (let m = 0; m < 12; m++) {
        const val = row.months[m] || 0;
        totals[m] = (totals[m] || 0) + val;
      }
      grandTotal += row.total;
    }
    return { totals, grandTotal };
  }, [monthlyExpenditure]);

  // ── Low Stock Alerts ──
  const lowStockItems = useMemo(() =>
    stockBalances.filter(s => s.is_low).sort((a, b) => (a.balance / (a.reorder_level || 1)) - (b.balance / (b.reorder_level || 1))),
    [stockBalances]
  );

  const printReport = (title: string, contentId: string) => {
    const content = document.getElementById(contentId);
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; max-width: 1100px; margin: auto; font-size: 12px; }
        h1 { text-align: center; margin-bottom: 2px; }
        h2 { text-align: center; margin-bottom: 15px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        tfoot td { font-weight: bold; background: #f0f0f0; }
        .right { text-align: right; }
        .low { color: #dc2626; font-weight: bold; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>${schoolName || 'School'}</h1>
      <h2>${title} — ${selectedYear}</h2>
      ${content.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Year</Label>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="purchase-summary" className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />Purchase Summary</TabsTrigger>
          <TabsTrigger value="stock-valuation" className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />Stock Valuation</TabsTrigger>
          <TabsTrigger value="monthly-expenditure" className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Monthly Expenditure</TabsTrigger>
          <TabsTrigger value="low-stock" className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Low Stock Alerts</TabsTrigger>
        </TabsList>

        {/* ── Purchase Summary by Supplier ── */}
        <TabsContent value="purchase-summary">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Purchase Summary by Supplier</CardTitle>
                  <CardDescription>All LPOs aggregated per supplier for {selectedYear}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => printReport('Purchase Summary by Supplier', 'report-purchase-summary')}>
                  <Printer className="mr-2 h-4 w-4" />Print
                </Button>
              </div>
            </CardHeader>
            <CardContent id="report-purchase-summary">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">LPOs</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Delivered/Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseSummary.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.supplier_name}</TableCell>
                      <TableCell className="text-right">{s.lpo_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.lpo_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.paid_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.pending_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {purchaseSummary.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">TOTALS</TableCell>
                      <TableCell className="text-right font-bold">{purchaseTotals.lpo_count}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(purchaseTotals.lpo_total)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(purchaseTotals.paid_total)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(purchaseTotals.pending_total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              {purchaseSummary.length === 0 && <p className="text-center py-8 text-muted-foreground">No purchases found for {selectedYear}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Stock Valuation ── */}
        <TabsContent value="stock-valuation">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Stock Valuation Report</CardTitle>
                  <CardDescription>Current inventory valued at last unit price</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => printReport('Stock Valuation Report', 'report-stock-valuation')}>
                  <Printer className="mr-2 h-4 w-4" />Print
                </Button>
              </div>
            </CardHeader>
            <CardContent id="report-stock-valuation">
              <div className="mb-4 p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Total Stock Valuation</p>
                <p className="text-3xl font-bold">{formatCurrency(totalValuation)}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Valuation</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockValuation.map(s => (
                    <TableRow key={s.item_id}>
                      <TableCell className="font-medium">{s.item_name}</TableCell>
                      <TableCell><Badge variant="outline">{s.category_name}</Badge></TableCell>
                      <TableCell className="text-right">{s.balance}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(s.valuation)}</TableCell>
                      <TableCell>{s.is_low ? <Badge variant="destructive">Low</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {stockValuation.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">TOTAL VALUATION</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totalValuation)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              {stockValuation.length === 0 && <p className="text-center py-8 text-muted-foreground">No stock data available</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Monthly Expenditure by Vote Head ── */}
        <TabsContent value="monthly-expenditure">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Monthly Expenditure by Vote Head</CardTitle>
                  <CardDescription>Paid/approved vouchers broken down by month for {selectedYear}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => printReport('Monthly Expenditure by Vote Head', 'report-monthly-expenditure')}>
                  <Printer className="mr-2 h-4 w-4" />Print
                </Button>
              </div>
            </CardHeader>
            <CardContent id="report-monthly-expenditure">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">Vote Head</TableHead>
                      {MONTHS.map(m => <TableHead key={m} className="text-right min-w-[80px]">{m}</TableHead>)}
                      <TableHead className="text-right min-w-[100px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyExpenditure.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{row.name}</TableCell>
                        {Array.from({ length: 12 }, (_, m) => (
                          <TableCell key={m} className="text-right text-sm">
                            {row.months[m] ? formatCurrency(row.months[m]) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {monthlyExpenditure.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="sticky left-0 bg-muted/50 z-10 font-bold">TOTALS</TableCell>
                        {Array.from({ length: 12 }, (_, m) => (
                          <TableCell key={m} className="text-right font-bold">
                            {monthlyTotals.totals[m] ? formatCurrency(monthlyTotals.totals[m]) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold">{formatCurrency(monthlyTotals.grandTotal)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
              {monthlyExpenditure.length === 0 && <p className="text-center py-8 text-muted-foreground">No expenditure data for {selectedYear}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Low Stock Alerts ── */}
        <TabsContent value="low-stock">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Total Items</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stockBalances.length}</div></CardContent>
              </Card>
              <Card className={lowStockItems.length > 0 ? 'border-destructive/50' : ''}>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Low Stock Items
                </CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Healthy Stock</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stockBalances.length - lowStockItems.length}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Low Stock Items</CardTitle>
                    <CardDescription>Items at or below reorder level requiring restocking</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => printReport('Low Stock Alerts', 'report-low-stock')}>
                    <Printer className="mr-2 h-4 w-4" />Print
                  </Button>
                </div>
              </CardHeader>
              <CardContent id="report-low-stock">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Reorder Level</TableHead>
                      <TableHead className="text-right">Deficit</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockItems.map(s => {
                      const deficit = s.reorder_level - s.balance;
                      const severity = s.balance === 0 ? 'Out of Stock' : s.balance <= s.reorder_level / 2 ? 'Critical' : 'Low';
                      return (
                        <TableRow key={s.item_id}>
                          <TableCell className="font-medium">{s.item_name}</TableCell>
                          <TableCell><Badge variant="outline">{s.category_name}</Badge></TableCell>
                          <TableCell className="text-right font-bold">{s.balance}</TableCell>
                          <TableCell className="text-right">{s.reorder_level}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">{deficit > 0 ? deficit : 0}</TableCell>
                          <TableCell>
                            <Badge variant={severity === 'Out of Stock' ? 'destructive' : severity === 'Critical' ? 'destructive' : 'secondary'}>
                              {severity}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {lowStockItems.length === 0 && (
                  <div className="text-center py-8">
                    <TrendingUp className="h-10 w-10 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground">All items are above reorder levels. No alerts.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

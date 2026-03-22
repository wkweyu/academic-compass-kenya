import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, Package, Users, TrendingUp, Printer, FileText,
  BarChart3, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { TermManager } from '@/utils/termManager';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });

function printReport(title: string, ref: HTMLDivElement | null) {
  if (!ref) return;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #000; font-size: 12px; }
      h2 { text-align: center; margin-bottom: 4px; }
      .subtitle { text-align: center; color: #555; margin-bottom: 16px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
      th { background: #f0f0f0; font-weight: bold; }
      tfoot td { font-weight: bold; background: #f9f9f9; }
      .text-right { text-align: right; }
      .summary-cards { display: flex; gap: 16px; margin-bottom: 16px; }
      .summary-card { border: 1px solid #ccc; padding: 12px; border-radius: 6px; flex: 1; text-align: center; }
      .summary-card .value { font-size: 20px; font-weight: bold; }
      .summary-card .label { font-size: 11px; color: #666; }
      @media print { body { padding: 0; } }
    </style></head><body>
    ${ref.innerHTML}
    <script>window.print(); window.close();<\/script>
  </body></html>`);
  w.document.close();
}

export function UniformIssuanceReports() {
  const [reportTab, setReportTab] = useState('daily');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [termFilter, setTermFilter] = useState(TermManager.getCurrentTerm().toString());
  const [yearFilter, setYearFilter] = useState(TermManager.getCurrentYear().toString());

  const dailyRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const studentRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);

  // ===== DAILY ISSUANCE REPORT =====
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['uniform-report-daily', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uniform_issues')
        .select('id, created_at, total_amount, term, year, student_id, students(full_name, admission_number, classes(name))')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const issueIds = (data || []).map((d: any) => d.id);
      let items: any[] = [];
      if (issueIds.length > 0) {
        const { data: itemData } = await supabase
          .from('uniform_issue_items')
          .select('*')
          .in('issue_id', issueIds);
        items = itemData || [];
      }

      // Group by date
      const byDate: Record<string, { date: string; issues: any[]; total: number; itemCount: number }> = {};
      for (const row of (data || []) as any[]) {
        const dateKey = row.created_at.split('T')[0];
        if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey, issues: [], total: 0, itemCount: 0 };
        byDate[dateKey].issues.push({
          ...row,
          student_name: row.students?.full_name,
          admission_number: row.students?.admission_number,
          class_name: row.students?.classes?.name,
          items: items.filter(i => i.issue_id === row.id),
        });
        byDate[dateKey].total += Number(row.total_amount);
        byDate[dateKey].itemCount += items.filter(i => i.issue_id === row.id).reduce((s: number, i: any) => s + i.quantity, 0);
      }

      return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: reportTab === 'daily',
  });

  // ===== PER-ITEM SUMMARY =====
  const { data: itemSummary, isLoading: itemLoading } = useQuery({
    queryKey: ['uniform-report-item', termFilter, yearFilter],
    queryFn: async () => {
      const { data: issues } = await supabase
        .from('uniform_issues')
        .select('id')
        .eq('term', parseInt(termFilter))
        .eq('year', parseInt(yearFilter));

      if (!issues || issues.length === 0) return [];

      const issueIds = issues.map((i: any) => i.id);
      const { data: items, error } = await supabase
        .from('uniform_issue_items')
        .select('item_name, quantity, unit_price, total, class_group_name')
        .in('issue_id', issueIds);
      if (error) throw error;

      // Aggregate by item_name
      const byItem: Record<string, { item_name: string; total_qty: number; total_revenue: number; avg_price: number; price_count: number }> = {};
      for (const item of (items || []) as any[]) {
        const key = item.item_name;
        if (!byItem[key]) byItem[key] = { item_name: key, total_qty: 0, total_revenue: 0, avg_price: 0, price_count: 0 };
        byItem[key].total_qty += item.quantity;
        byItem[key].total_revenue += Number(item.total);
        byItem[key].avg_price += Number(item.unit_price);
        byItem[key].price_count += 1;
      }

      return Object.values(byItem)
        .map(i => ({ ...i, avg_price: i.avg_price / i.price_count }))
        .sort((a, b) => b.total_revenue - a.total_revenue);
    },
    enabled: reportTab === 'item',
  });

  // ===== PER-STUDENT SUMMARY =====
  const { data: studentSummary, isLoading: studentLoading } = useQuery({
    queryKey: ['uniform-report-student', termFilter, yearFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uniform_issues')
        .select('id, student_id, total_amount, created_at, students(full_name, admission_number, classes(name))')
        .eq('term', parseInt(termFilter))
        .eq('year', parseInt(yearFilter))
        .order('created_at', { ascending: false });
      if (error) throw error;

      const issueIds = (data || []).map((d: any) => d.id);
      let items: any[] = [];
      if (issueIds.length > 0) {
        const { data: itemData } = await supabase
          .from('uniform_issue_items')
          .select('issue_id, item_name, quantity, total')
          .in('issue_id', issueIds);
        items = itemData || [];
      }

      // Group by student
      const byStudent: Record<number, {
        student_id: number; student_name: string; admission_number: string;
        class_name: string; issue_count: number; total_items: number;
        total_amount: number; items: Record<string, { name: string; qty: number; total: number }>;
      }> = {};

      for (const row of (data || []) as any[]) {
        const sid = row.student_id;
        if (!byStudent[sid]) {
          byStudent[sid] = {
            student_id: sid,
            student_name: row.students?.full_name || '',
            admission_number: row.students?.admission_number || '',
            class_name: row.students?.classes?.name || '',
            issue_count: 0, total_items: 0, total_amount: 0,
            items: {},
          };
        }
        byStudent[sid].issue_count += 1;
        byStudent[sid].total_amount += Number(row.total_amount);

        const issueItems = items.filter(i => i.issue_id === row.id);
        for (const it of issueItems) {
          byStudent[sid].total_items += it.quantity;
          if (!byStudent[sid].items[it.item_name]) {
            byStudent[sid].items[it.item_name] = { name: it.item_name, qty: 0, total: 0 };
          }
          byStudent[sid].items[it.item_name].qty += it.quantity;
          byStudent[sid].items[it.item_name].total += Number(it.total);
        }
      }

      return Object.values(byStudent).sort((a, b) => b.total_amount - a.total_amount);
    },
    enabled: reportTab === 'student',
  });

  // ===== INVENTORY MOVEMENT =====
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['uniform-report-inventory', startDate, endDate],
    queryFn: async () => {
      // Get uniform category IDs
      const { data: categories } = await supabase
        .from('procurement_itemcategory')
        .select('id')
        .ilike('name', '%uniform%');

      if (!categories || categories.length === 0) return [];
      const catIds = categories.map((c: any) => c.id);

      const { data: uniformItems } = await supabase
        .from('procurement_item')
        .select('id, name, unit_price')
        .in('category_id', catIds);

      if (!uniformItems || uniformItems.length === 0) return [];

      const itemIds = uniformItems.map((i: any) => i.id);
      const { data: txns } = await supabase
        .from('procurement_stocktransaction')
        .select('item_id, transaction_type, quantity, transaction_date')
        .in('item_id', itemIds);

      // Summarize per item
      return uniformItems.map((item: any) => {
        const itemTxns = (txns || []).filter((t: any) => t.item_id === item.id);
        const purchases = itemTxns.filter((t: any) => t.transaction_type === 'Purchase').reduce((s: number, t: any) => s + t.quantity, 0);
        const issues = itemTxns.filter((t: any) => t.transaction_type === 'Issue').reduce((s: number, t: any) => s + t.quantity, 0);
        const adjustments = itemTxns.filter((t: any) => t.transaction_type === 'Adjustment').reduce((s: number, t: any) => s + t.quantity, 0);
        return {
          item_name: item.name,
          purchased: purchases,
          issued: issues,
          adjustments,
          balance: purchases + adjustments - issues,
        };
      }).sort((a: any, b: any) => a.item_name.localeCompare(b.item_name));
    },
    enabled: reportTab === 'inventory',
  });

  const grandTotalDaily = (dailyData || []).reduce((s, d) => s + d.total, 0);
  const grandTotalItems = (itemSummary || []).reduce((s, i) => s + i.total_revenue, 0);
  const grandTotalStudents = (studentSummary || []).reduce((s, st) => s + st.total_amount, 0);

  return (
    <div className="space-y-4">
      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="daily"><Calendar className="mr-1.5 h-4 w-4" />Daily Issuance</TabsTrigger>
          <TabsTrigger value="item"><Package className="mr-1.5 h-4 w-4" />Per-Item Summary</TabsTrigger>
          <TabsTrigger value="student"><Users className="mr-1.5 h-4 w-4" />Per-Student Summary</TabsTrigger>
          <TabsTrigger value="inventory"><BarChart3 className="mr-1.5 h-4 w-4" />Stock Movement</TabsTrigger>
        </TabsList>

        {/* ===== DAILY ISSUANCE ===== */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Daily Issuance Report</CardTitle>
                  <CardDescription>Uniform issues grouped by date with item-level detail</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">From</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 h-8 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">To</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 h-8 text-xs" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => printReport('Daily Uniform Issuance', dailyRef.current)}>
                    <Printer className="h-3 w-3 mr-1" /> Print
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={dailyRef}>
                <h2 style={{ display: 'none' }}>DAILY UNIFORM ISSUANCE REPORT</h2>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotalDaily)}</p>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{(dailyData || []).reduce((s, d) => s + d.issues.length, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Transactions</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{(dailyData || []).reduce((s, d) => s + d.itemCount, 0)}</p>
                    <p className="text-xs text-muted-foreground">Items Issued</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{(dailyData || []).length}</p>
                    <p className="text-xs text-muted-foreground">Active Days</p>
                  </div>
                </div>

                {dailyLoading ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
                ) : (dailyData || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No issuances found in this period</p>
                ) : (
                  (dailyData || []).map(day => (
                    <div key={day.date} className="mb-4">
                      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-t-lg border border-b-0">
                        <span className="font-semibold text-sm">{formatDate(day.date)}</span>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{day.issues.length} transaction{day.issues.length !== 1 ? 's' : ''}</span>
                          <span>{day.itemCount} items</span>
                          <span className="font-semibold text-foreground">{formatCurrency(day.total)}</span>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.issues.map((issue: any) => (
                            <TableRow key={issue.id}>
                              <TableCell>
                                <p className="font-medium text-sm">{issue.student_name}</p>
                                <p className="text-xs text-muted-foreground">{issue.admission_number}</p>
                              </TableCell>
                              <TableCell className="text-sm">{issue.class_name}</TableCell>
                              <TableCell className="text-sm">
                                {(issue.items || []).map((it: any) => `${it.item_name} ×${it.quantity}`).join(', ')}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(Number(issue.total_amount))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PER-ITEM SUMMARY ===== */}
        <TabsContent value="item">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Per-Item Issuance Summary</CardTitle>
                  <CardDescription>Total quantities and revenue per uniform item for the selected term</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={termFilter} onValueChange={setTermFilter}>
                    <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                    className="w-20 h-8 text-xs" placeholder="Year" />
                  <Button variant="outline" size="sm" onClick={() => printReport('Per-Item Uniform Issuance', itemRef.current)}>
                    <Printer className="h-3 w-3 mr-1" /> Print
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={itemRef}>
                <h2 style={{ display: 'none' }}>PER-ITEM UNIFORM ISSUANCE SUMMARY — Term {termFilter}/{yearFilter}</h2>

                {itemLoading ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
                ) : (itemSummary || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No data for the selected term</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Qty Issued</TableHead>
                        <TableHead className="text-right">Avg Unit Price</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(itemSummary || []).map((item, idx) => (
                        <TableRow key={item.item_name}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-right">{item.total_qty}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.avg_price)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.total_revenue)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {grandTotalItems > 0 ? ((item.total_revenue / grandTotalItems) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold">
                          {(itemSummary || []).reduce((s, i) => s + i.total_qty, 0)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-bold">{formatCurrency(grandTotalItems)}</TableCell>
                        <TableCell className="text-right font-bold">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PER-STUDENT SUMMARY ===== */}
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Per-Student Issuance Summary</CardTitle>
                  <CardDescription>All uniform charges per student for the selected term</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={termFilter} onValueChange={setTermFilter}>
                    <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                    className="w-20 h-8 text-xs" placeholder="Year" />
                  <Button variant="outline" size="sm" onClick={() => printReport('Per-Student Uniform Issuance', studentRef.current)}>
                    <Printer className="h-3 w-3 mr-1" /> Print
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={studentRef}>
                <h2 style={{ display: 'none' }}>PER-STUDENT UNIFORM ISSUANCE — Term {termFilter}/{yearFilter}</h2>

                {studentLoading ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
                ) : (studentSummary || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No data for the selected term</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Adm No</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Issues</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Total Charged</TableHead>
                        <TableHead>Item Breakdown</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(studentSummary || []).map((st, idx) => (
                        <TableRow key={st.student_id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{st.student_name}</TableCell>
                          <TableCell className="text-sm">{st.admission_number}</TableCell>
                          <TableCell className="text-sm">{st.class_name}</TableCell>
                          <TableCell className="text-right">{st.issue_count}</TableCell>
                          <TableCell className="text-right">{st.total_items}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(st.total_amount)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {Object.values(st.items).map(i => `${i.name} ×${i.qty}`).join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="font-bold">Total ({(studentSummary || []).length} students)</TableCell>
                        <TableCell className="text-right font-bold">
                          {(studentSummary || []).reduce((s, st) => s + st.issue_count, 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {(studentSummary || []).reduce((s, st) => s + st.total_items, 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(grandTotalStudents)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== STOCK MOVEMENT ===== */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Uniform Stock Movement</CardTitle>
                  <CardDescription>Current stock balance for all uniform items (purchases − issues ± adjustments)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => printReport('Uniform Stock Movement', inventoryRef.current)}>
                  <Printer className="h-3 w-3 mr-1" /> Print
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={inventoryRef}>
                <h2 style={{ display: 'none' }}>UNIFORM STOCK MOVEMENT REPORT</h2>

                {inventoryLoading ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
                ) : (inventoryData || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No uniform items in inventory</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Purchased</TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right">Adjustments</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(inventoryData || []).map((item: any, idx: number) => (
                        <TableRow key={item.item_name}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-right">{item.purchased}</TableCell>
                          <TableCell className="text-right">{item.issued}</TableCell>
                          <TableCell className="text-right">{item.adjustments}</TableCell>
                          <TableCell className="text-right font-bold">{item.balance}</TableCell>
                          <TableCell>
                            {item.balance <= 0 ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : item.balance <= 5 ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Low Stock</Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-200">In Stock</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold">{(inventoryData || []).reduce((s: number, i: any) => s + i.purchased, 0)}</TableCell>
                        <TableCell className="text-right font-bold">{(inventoryData || []).reduce((s: number, i: any) => s + i.issued, 0)}</TableCell>
                        <TableCell className="text-right font-bold">{(inventoryData || []).reduce((s: number, i: any) => s + i.adjustments, 0)}</TableCell>
                        <TableCell className="text-right font-bold">{(inventoryData || []).reduce((s: number, i: any) => s + i.balance, 0)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from 'react';
import { escapeHtml } from '@/utils/escapeHtml';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Printer, Download, Calendar, Users, AlertTriangle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { feesService } from '@/services/feesService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export function FeesReportsModule() {
  const [reportTab, setReportTab] = useState('daily');
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Daily Collection Report
  const { data: dailyData } = useQuery({
    queryKey: ['daily-collection', dailyDate],
    queryFn: async () => {
      const startOfDay = `${dailyDate}T00:00:00`;
      const endOfDay = `${dailyDate}T23:59:59`;
      const { data: receipts } = await supabase
        .from('fees_receipt')
        .select('*, students(full_name, admission_number)')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('is_reversed', false)
        .order('created_at', { ascending: false });

      const items = (receipts || []) as any[];
      const total = items.reduce((s, r) => s + Number(r.amount), 0);
      const byMode: Record<string, { count: number; total: number }> = {};
      items.forEach(r => {
        const mode = r.payment_mode || 'cash';
        if (!byMode[mode]) byMode[mode] = { count: 0, total: 0 };
        byMode[mode].count++;
        byMode[mode].total += Number(r.amount);
      });
      return { receipts: items, total, byMode, count: items.length };
    },
    enabled: reportTab === 'daily',
  });

  // Fee Defaulters
  const { data: defaulters = [] } = useQuery({
    queryKey: ['fee-defaulters', selectedTerm, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('fees_student_ledger')
        .select('*, students(full_name, admission_number, current_class_id, classes(name), guardian_phone)')
        .gt('balance', 0)
        .order('balance', { ascending: false });
      return (data || []).map((l: any) => ({
        ...l,
        student_name: l.students?.full_name,
        admission_number: l.students?.admission_number,
        class_name: l.students?.classes?.name,
        guardian_phone: l.students?.guardian_phone,
      }));
    },
    enabled: reportTab === 'defaulters',
  });

  // Class-wise Collection Summary
  const { data: classWise = [] } = useQuery({
    queryKey: ['class-wise-summary', selectedTerm, selectedYear],
    queryFn: async () => {
      const term = parseInt(selectedTerm);
      const year = parseInt(selectedYear);
      const { data: debits } = await supabase
        .from('fees_debittransaction')
        .select('amount, student_id, students(current_class_id, classes(name))')
        .eq('term', term).eq('year', year);
      const { data: receipts } = await supabase
        .from('fees_receipt')
        .select('amount, student_id, students(current_class_id, classes(name))')
        .eq('term', term).eq('year', year).eq('is_reversed', false);

      const classSummary: Record<string, { class_name: string; invoiced: number; collected: number; students: Set<number> }> = {};

      (debits || []).forEach((d: any) => {
        const cn = d.students?.classes?.name || 'Unknown';
        if (!classSummary[cn]) classSummary[cn] = { class_name: cn, invoiced: 0, collected: 0, students: new Set() };
        classSummary[cn].invoiced += Number(d.amount);
        classSummary[cn].students.add(d.student_id);
      });
      (receipts || []).forEach((r: any) => {
        const cn = r.students?.classes?.name || 'Unknown';
        if (!classSummary[cn]) classSummary[cn] = { class_name: cn, invoiced: 0, collected: 0, students: new Set() };
        classSummary[cn].collected += Number(r.amount);
        classSummary[cn].students.add(r.student_id);
      });

      return Object.values(classSummary).map(c => ({
        class_name: c.class_name,
        invoiced: c.invoiced,
        collected: c.collected,
        outstanding: c.invoiced - c.collected,
        rate: c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 100) : 0,
        student_count: c.students.size,
      })).sort((a, b) => a.class_name.localeCompare(b.class_name));
    },
    enabled: reportTab === 'class-wise',
  });

  // Term-wise Summary
  const { data: termWise } = useQuery({
    queryKey: ['term-wise-summary', selectedYear],
    queryFn: async () => {
      const year = parseInt(selectedYear);
      const results = [];
      for (let term = 1; term <= 3; term++) {
        const [debitsRes, receiptsRes] = await Promise.all([
          supabase.from('fees_debittransaction').select('amount').eq('term', term).eq('year', year),
          supabase.from('fees_receipt').select('amount').eq('term', term).eq('year', year).eq('is_reversed', false),
        ]);
        const invoiced = (debitsRes.data || []).reduce((s, d: any) => s + Number(d.amount), 0);
        const collected = (receiptsRes.data || []).reduce((s, r: any) => s + Number(r.amount), 0);
        results.push({
          term,
          invoiced,
          collected,
          outstanding: invoiced - collected,
          rate: invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0,
        });
      }
      return results;
    },
    enabled: reportTab === 'term-wise',
  });

  const printReport = (title: string) => {
    const content = document.getElementById('report-print-area');
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>${escapeHtml(title)}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f5f5f5}
      .text-right{text-align:right}.header{text-align:center;margin-bottom:20px}
      @media print{body{margin:0}}</style></head><body>
      <div class="header"><h2>${escapeHtml(title)}</h2><p>Generated: ${new Date().toLocaleString()}</p></div>
      ${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="daily"><Calendar className="h-3 w-3 mr-1" />Daily Collection</TabsTrigger>
          <TabsTrigger value="defaulters"><AlertTriangle className="h-3 w-3 mr-1" />Fee Defaulters</TabsTrigger>
          <TabsTrigger value="class-wise"><Users className="h-3 w-3 mr-1" />Class-wise</TabsTrigger>
          <TabsTrigger value="term-wise"><BarChart3 className="h-3 w-3 mr-1" />Term-wise</TabsTrigger>
        </TabsList>

        {/* Daily Collection */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Daily Collection Report</CardTitle>
                  <CardDescription>Payments received on a specific date</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="w-40" />
                  <Button variant="outline" size="sm" onClick={() => printReport('Daily Collection Report')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent id="report-print-area">
              {dailyData && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Card><CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Total Collected</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(dailyData.total)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{dailyData.count}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">By Mode</p>
                      <div className="space-y-1 mt-1">
                        {Object.entries(dailyData.byMode).map(([mode, v]) => (
                          <div key={mode} className="flex justify-between text-sm">
                            <span className="capitalize">{mode}</span>
                            <span className="font-medium">{formatCurrency((v as any).total)} ({(v as any).count})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyData.receipts.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.receipt_no}</TableCell>
                          <TableCell>
                            <div className="font-medium">{r.students?.full_name}</div>
                            <div className="text-xs text-muted-foreground">{r.students?.admission_number}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{r.payment_mode}</Badge></TableCell>
                          <TableCell className="font-mono text-sm">{r.reference}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(r.amount))}</TableCell>
                          <TableCell className="text-sm">{new Date(r.created_at).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {dailyData.receipts.length === 0 && <p className="text-center py-8 text-muted-foreground">No collections on this date</p>}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fee Defaulters */}
        <TabsContent value="defaulters">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Defaulters List</CardTitle>
                  <CardDescription>{defaulters.length} students with outstanding balances</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => printReport('Fee Defaulters Report')}>
                  <Printer className="h-4 w-4 mr-1" />Print
                </Button>
              </div>
            </CardHeader>
            <CardContent id="report-print-area">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian Phone</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaulters.map((d: any, i: number) => (
                    <TableRow key={d.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{d.student_name}</div>
                        <div className="text-xs text-muted-foreground">{d.admission_number}</div>
                      </TableCell>
                      <TableCell>{d.class_name}</TableCell>
                      <TableCell className="font-mono text-sm">{d.guardian_phone || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(d.debit_total))}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(Number(d.credit_total))}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{formatCurrency(Number(d.balance))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {defaulters.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg flex justify-between font-bold">
                  <span>Total Outstanding ({defaulters.length} students)</span>
                  <span className="text-destructive">
                    {formatCurrency(defaulters.reduce((s: number, d: any) => s + Number(d.balance), 0))}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Class-wise */}
        <TabsContent value="class-wise">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Class-wise Collection Summary</CardTitle>
                  <CardDescription>Fee collection performance by class</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-24" />
                  <Button variant="outline" size="sm" onClick={() => printReport('Class-wise Collection Summary')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent id="report-print-area">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classWise.map((c: any) => (
                    <TableRow key={c.class_name}>
                      <TableCell className="font-medium">{c.class_name}</TableCell>
                      <TableCell className="text-right">{c.student_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.invoiced)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(c.collected)}</TableCell>
                      <TableCell className="text-right text-destructive font-medium">{formatCurrency(c.outstanding)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Progress value={c.rate} className="w-16 h-2" />
                          <span className="text-sm font-medium">{c.rate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {classWise.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{classWise.reduce((s: number, c: any) => s + c.student_count, 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(classWise.reduce((s: number, c: any) => s + c.invoiced, 0))}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(classWise.reduce((s: number, c: any) => s + c.collected, 0))}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(classWise.reduce((s: number, c: any) => s + c.outstanding, 0))}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {classWise.length === 0 && <p className="text-center py-8 text-muted-foreground">No data for selected term/year</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Term-wise */}
        <TabsContent value="term-wise">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Term-wise Fee Summary</CardTitle>
                  <CardDescription>Comparison across all three terms</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-24" />
                  <Button variant="outline" size="sm" onClick={() => printReport('Term-wise Fee Summary')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent id="report-print-area">
              {termWise && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Collection Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {termWise.map(t => (
                      <TableRow key={t.term}>
                        <TableCell className="font-medium">Term {t.term}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.invoiced)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(t.collected)}</TableCell>
                        <TableCell className="text-right text-destructive">{formatCurrency(t.outstanding)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Progress value={t.rate} className="w-20 h-2" />
                            <span className="font-medium">{t.rate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>ANNUAL</TableCell>
                      <TableCell className="text-right">{formatCurrency(termWise.reduce((s, t) => s + t.invoiced, 0))}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(termWise.reduce((s, t) => s + t.collected, 0))}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(termWise.reduce((s, t) => s + t.outstanding, 0))}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

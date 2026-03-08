import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { payrollService, BankAdviceGroup, PayrollRun } from '@/services/payrollService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface BankAdviceTabProps {
  runs: PayrollRun[];
}

export default function BankAdviceTab({ runs }: BankAdviceTabProps) {
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const { data: bankGroups = [] } = useQuery({
    queryKey: ['bank-advice', selectedRunId],
    queryFn: () => payrollService.getBankAdvice(parseInt(selectedRunId)),
    enabled: !!selectedRunId,
  });

  const selectedRun = runs.find(r => r.id === parseInt(selectedRunId));

  const exportBankAdviceCSV = (group: BankAdviceGroup) => {
    const headers = ['No.', 'Employee No', 'Employee Name', 'Account Number', 'Bank Branch', 'Net Amount'];
    const rows = group.entries.map((e, i) => [
      i + 1,
      e.employee_no,
      e.staff_name,
      e.account_number,
      e.bank_branch || group.bank_branch,
      Number(e.net_salary).toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const period = selectedRun ? `${MONTHS[selectedRun.month - 1]}_${selectedRun.year}` : 'payroll';
    a.download = `bank_advice_${group.bank_name.replace(/\s+/g, '_')}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllBankAdviceCSV = () => {
    const headers = ['Bank Name', 'Employee No', 'Employee Name', 'Account Number', 'Bank Branch', 'Net Amount'];
    const rows = bankGroups.flatMap(g =>
      g.entries.map(e => [
        g.bank_name,
        e.employee_no,
        e.staff_name,
        e.account_number,
        e.bank_branch || g.bank_branch,
        Number(e.net_salary).toFixed(2),
      ])
    );
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const period = selectedRun ? `${MONTHS[selectedRun.month - 1]}_${selectedRun.year}` : 'payroll';
    a.href = url;
    a.download = `bank_advice_all_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printBankAdvice = (group: BankAdviceGroup) => {
    const period = selectedRun ? `${MONTHS[selectedRun.month - 1]} ${selectedRun.year}` : '';
    const rows = group.entries.map((e, i) =>
      `<tr><td>${i+1}</td><td>${e.employee_no}</td><td>${e.staff_name}</td><td>${e.account_number}</td><td>${e.bank_branch}</td><td style="text-align:right">${formatCurrency(Number(e.net_salary))}</td></tr>`
    ).join('');
    const html = `<html><head><title>Bank Advice - ${group.bank_name}</title><style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:6px 8px;font-size:12px}th{background:#f0f0f0}h1{font-size:16px}h2{font-size:14px}.total{font-weight:bold;font-size:14px;margin-top:10px}</style></head><body><h1>BANK ADVICE - SALARY TRANSFER</h1><h2>${group.bank_name} | ${period}</h2><table><thead><tr><th>No.</th><th>Emp No</th><th>Name</th><th>Account No</th><th>Branch</th><th>Amount (KES)</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: ${formatCurrency(group.total_amount)} | Staff: ${group.staff_count}</p></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Bank Advice</CardTitle>
            <CardDescription>Generate bank transfer advice grouped by bank for salary disbursement</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select payroll run" /></SelectTrigger>
              <SelectContent>
                {runs.filter(r => r.status === 'approved' || r.status === 'paid').map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    {MONTHS[r.month - 1]} {r.year} ({r.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bankGroups.length > 0 && (
              <Button variant="outline" onClick={exportAllBankAdviceCSV}>
                <Download className="mr-2 h-4 w-4" />Export All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedRunId && (
          <p className="text-center py-8 text-muted-foreground">Select an approved payroll run to generate bank advice</p>
        )}

        {bankGroups.map(group => (
          <Card key={group.bank_name} className="border">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base">{group.bank_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{group.staff_count} staff • Total: {formatCurrency(group.total_amount)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => printBankAdvice(group)}>
                    <Printer className="mr-1 h-3 w-3" />Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportBankAdviceCSV(group)}>
                    <Download className="mr-1 h-3 w-3" />Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Employee No</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Amount (KES)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.entries.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{e.employee_no}</TableCell>
                      <TableCell className="font-medium">{e.staff_name}</TableCell>
                      <TableCell>{e.account_number || '-'}</TableCell>
                      <TableCell>{e.bank_branch || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(e.net_salary))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5}>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(group.total_amount)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {selectedRunId && bankGroups.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No entries found for this payroll run. Ensure staff have bank details configured.</p>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { escapeHtml } from '@/utils/escapeHtml';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, Download, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { feesService } from '@/services/feesService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

interface StudentFeesTabProps {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  className: string;
}

interface ConsolidatedEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'debit' | 'credit';
  reference: string;
  details?: { votehead: string; amount: number }[];
}

export function StudentFeesTab({ studentId, studentName, admissionNumber, className }: StudentFeesTabProps) {
  const [showVoteheadDetails, setShowVoteheadDetails] = useState<number | null>(null);

  const { data: statement, isLoading } = useQuery({
    queryKey: ['student-statement', studentId],
    queryFn: () => feesService.getStudentStatement(studentId),
    enabled: !!studentId,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!statement) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No fee records found for this student</p>
      </div>
    );
  }

  // Build consolidated statement entries with running balance
  const entries: ConsolidatedEntry[] = [];

  // Group debits by term/year for consolidated display
  const debitsByTerm: Record<string, typeof statement.debits> = {};
  statement.debits.forEach(d => {
    const key = `T${d.term}/${d.year}`;
    if (!debitsByTerm[key]) debitsByTerm[key] = [];
    debitsByTerm[key].push(d);
  });

  // Add consolidated debit entries
  Object.entries(debitsByTerm).forEach(([termKey, debits]) => {
    const totalAmount = debits.reduce((s, d) => s + Number(d.amount), 0);
    const firstDebit = debits[0];
    entries.push({
      date: firstDebit.date,
      description: `${termKey} Fees`,
      debit: totalAmount,
      credit: 0,
      balance: 0,
      type: 'debit',
      reference: firstDebit.invoice_number,
      details: debits.map(d => ({ votehead: d.vote_head_name || 'Fee', amount: Number(d.amount) })),
    });
  });

  // Add credit entries
  statement.credits.forEach(r => {
    entries.push({
      date: r.created_at,
      description: `Payment - ${r.payment_mode.toUpperCase()}`,
      debit: 0,
      credit: Number(r.amount),
      balance: 0,
      type: 'credit',
      reference: r.receipt_no,
      details: (r.allocations || []).map(a => ({ votehead: a.vote_head_name || '', amount: Number(a.amount) })),
    });
  });

  // Sort by date and calculate running balance
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningBalance = 0;
  entries.forEach(e => {
    runningBalance += e.debit - e.credit;
    e.balance = runningBalance;
  });

  const totalDebits = Number(statement.ledger?.debit_total || 0);
  const totalCredits = Number(statement.ledger?.credit_total || 0);
  const balance = statement.running_balance;

  const handlePrint = () => {
    const printContent = document.getElementById('student-statement-print');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Fee Statement - ${studentName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .text-right { text-align: right; }
        .header { text-align: center; margin-bottom: 20px; }
        .summary { display: flex; gap: 40px; margin: 20px 0; }
        .summary-item { text-align: center; }
        .debit { color: #dc2626; }
        .credit { color: #16a34a; }
        .bold { font-weight: bold; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="header">
        <h2>STUDENT FEE STATEMENT</h2>
        <p><strong>${studentName}</strong> | Adm: ${admissionNumber} | Class: ${className}</p>
        <p>Statement Date: ${new Date().toLocaleDateString()}</p>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr></thead>
        <tbody>
          ${entries.map(e => `
            <tr>
              <td>${new Date(e.date).toLocaleDateString()}</td>
              <td>${e.description}</td>
              <td>${e.reference}</td>
              <td class="text-right debit">${e.debit > 0 ? formatCurrency(e.debit) : ''}</td>
              <td class="text-right credit">${e.credit > 0 ? formatCurrency(e.credit) : ''}</td>
              <td class="text-right bold">${formatCurrency(e.balance)}</td>
            </tr>
          `).join('')}
          <tr class="bold">
            <td colspan="3">TOTALS</td>
            <td class="text-right debit">${formatCurrency(totalDebits)}</td>
            <td class="text-right credit">${formatCurrency(totalCredits)}</td>
            <td class="text-right">${formatCurrency(balance)}</td>
          </tr>
        </tbody>
      </table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Charged</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDebits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(balance)}
            </div>
            <Badge variant={balance <= 0 ? 'default' : 'destructive'} className="mt-1">
              {balance <= 0 ? 'Clear' : 'Owing'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />Print Statement
        </Button>
      </div>

      {/* Consolidated Statement Table */}
      <Card id="student-statement-print">
        <CardHeader>
          <CardTitle>Transaction Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e, i) => (
                <>
                  <TableRow
                    key={i}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setShowVoteheadDetails(showVoteheadDetails === i ? null : i)}
                  >
                    <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="font-medium">{e.description}</span>
                      {e.details && e.details.length > 1 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({e.details.length} items — click to expand)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{e.reference}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {e.debit > 0 ? formatCurrency(e.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {e.credit > 0 ? formatCurrency(e.credit) : ''}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${e.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {formatCurrency(e.balance)}
                    </TableCell>
                  </TableRow>
                  {showVoteheadDetails === i && e.details && (
                    <TableRow key={`${i}-details`}>
                      <TableCell colSpan={6} className="bg-muted/30 py-2 px-8">
                        <div className="space-y-1">
                          {e.details.map((d, j) => (
                            <div key={j} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{d.votehead}</span>
                              <span className="font-medium">{formatCurrency(d.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {/* Totals row */}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={3}>TOTALS</TableCell>
                <TableCell className="text-right text-destructive">{formatCurrency(totalDebits)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(totalCredits)}</TableCell>
                <TableCell className={`text-right ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(balance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {entries.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No transactions found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

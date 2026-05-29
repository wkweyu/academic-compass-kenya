import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { paymentService } from '@/services/paymentService';

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

export default function StudentStatementPage() {
  const { id } = useParams();
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('');

  const filters = useMemo(
    () => ({
      year: year || undefined,
      term: term || undefined,
    }),
    [year, term],
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['student-statement', id, filters],
    queryFn: () => paymentService.getStudentStatement(id as string, filters),
    enabled: !!id,
  });

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex items-start justify-between gap-4 print:block">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Student Statement</h1>
          <p className="text-sm text-muted-foreground">
            {data?.student.full_name || 'Loading...'}
            {data?.student.admission_number ? ` (${data.student.admission_number})` : ''}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={() => window.print()}>Print Statement</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="year">Year</Label>
          <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="term">Term</Label>
          <Input id="term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="1, 2, or 3" />
        </div>
      </div>

      <div className="rounded-md border">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Loading statement...</TableCell>
              </TableRow>
            ) : (data?.entries.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No statement entries found.</TableCell>
              </TableRow>
            ) : (
              data?.entries.map((entry) => (
                <TableRow key={`${entry.source_model}-${entry.id}-${entry.transaction_date}`}>
                  <TableCell>{new Date(entry.transaction_date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.reference || '-'}</TableCell>
                  <TableCell className="text-right">{entry.debit ? currency.format(entry.debit) : '-'}</TableCell>
                  <TableCell className="text-right">{entry.credit ? currency.format(entry.credit) : '-'}</TableCell>
                  <TableCell className="text-right font-medium">{currency.format(entry.balance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Debit</p>
          <p className="text-xl font-semibold">{currency.format(data?.totals.debit ?? 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Credit</p>
          <p className="text-xl font-semibold">{currency.format(data?.totals.credit ?? 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Closing Balance</p>
          <p className="text-xl font-semibold">{currency.format(data?.totals.balance ?? 0)}</p>
        </div>
      </div>
    </div>
  );
}

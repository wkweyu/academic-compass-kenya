import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { feesService } from '@/services/feesService';
import Papa from 'papaparse';

interface CsvRow {
  admission_number: string;
  amount: string;
  payment_date: string;
  payment_mode: string;
  reference: string;
  remarks?: string;
  // Resolved
  student_id?: number;
  student_name?: string;
  valid?: boolean;
  error?: string;
}

export function BulkCsvImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);
  const [term, setTerm] = useState('1');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = 'admission_number,amount,payment_date,payment_mode,reference,remarks\n2026001,5000,2026-03-01,mpesa,ABC123,Term 1 payment\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fee_payment_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsed = (results.data as any[]).map(r => ({
          admission_number: (r.admission_number || '').trim(),
          amount: (r.amount || '').trim(),
          payment_date: (r.payment_date || '').trim(),
          payment_mode: (r.payment_mode || 'cash').trim().toLowerCase(),
          reference: (r.reference || '').trim(),
          remarks: (r.remarks || '').trim(),
        }));
        await validateRows(parsed);
      },
    });
  };

  const validateRows = async (parsed: CsvRow[]) => {
    setIsValidating(true);
    // Fetch all students for matching
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, admission_number')
      .eq('is_active', true);

    const studentMap = new Map<string, { id: number; name: string }>();
    (students || []).forEach((s: any) => {
      studentMap.set(s.admission_number, { id: s.id, name: s.full_name });
    });

    const validated = parsed.map(row => {
      const errors: string[] = [];
      if (!row.admission_number) errors.push('Missing admission number');
      if (!row.amount || isNaN(parseFloat(row.amount)) || parseFloat(row.amount) <= 0) errors.push('Invalid amount');
      if (!row.reference) errors.push('Missing reference');
      if (!['cash', 'mpesa', 'bank', 'cheque', 'fees_in_kind'].includes(row.payment_mode)) errors.push('Invalid payment mode');

      const student = studentMap.get(row.admission_number);
      if (!student && row.admission_number) errors.push('Student not found');

      return {
        ...row,
        student_id: student?.id,
        student_name: student?.name,
        valid: errors.length === 0,
        error: errors.join('; '),
      };
    });

    setRows(validated);
    setIsValidating(false);
  };

  const validRows = rows.filter(r => r.valid);
  const invalidRows = rows.filter(r => !r.valid);

  const handlePost = async () => {
    if (validRows.length === 0) {
      toast({ title: 'No valid rows to post', variant: 'destructive' });
      return;
    }

    setIsPosting(true);
    let posted = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      try {
        await feesService.collectPayment({
          student_id: row.student_id!,
          amount: parseFloat(row.amount),
          payment_mode: row.payment_mode,
          reference: row.reference,
          term: parseInt(term),
          year: parseInt(year),
          remarks: row.remarks || `CSV Import - ${row.reference}`,
        });
        posted++;
      } catch (e: any) {
        errors.push(`${row.admission_number}: ${e.message}`);
      }
      setPostProgress(Math.round((posted / validRows.length) * 100));
    }

    setIsPosting(false);
    toast({
      title: 'Bulk import complete',
      description: `${posted} payments posted${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
    });

    if (posted > 0) {
      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
    }

    setRows([]);
    setPostProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" />CSV Import</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Bulk Payment Import (CSV)</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4 mr-1" />Download Template
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>CSV File *</Label>
              <Input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <div><Label>Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">Term 1</SelectItem><SelectItem value="2">Term 2</SelectItem><SelectItem value="3">Term 3</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} /></div>
          </div>

          {isValidating && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Validating rows...
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex gap-3">
                <Badge variant="default" className="bg-green-600">{validRows.length} valid</Badge>
                {invalidRows.length > 0 && <Badge variant="destructive">{invalidRows.length} invalid</Badge>}
                <span className="text-sm text-muted-foreground">{rows.length} total rows</span>
              </div>

              {invalidRows.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {invalidRows.slice(0, 3).map((r, i) => (
                      <div key={i} className="text-sm">{r.admission_number}: {r.error}</div>
                    ))}
                    {invalidRows.length > 3 && <div className="text-sm">...and {invalidRows.length - 3} more errors</div>}
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-60 overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Adm No</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={i} className={r.valid ? '' : 'bg-destructive/5'}>
                        <TableCell>
                          {r.valid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        </TableCell>
                        <TableCell className="font-mono">{r.admission_number}</TableCell>
                        <TableCell>{r.student_name || <span className="text-destructive text-sm">{r.error}</span>}</TableCell>
                        <TableCell>{r.amount}</TableCell>
                        <TableCell className="capitalize">{r.payment_mode}</TableCell>
                        <TableCell className="font-mono text-sm">{r.reference}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {isPosting && <Progress value={postProgress} className="mt-2" />}

              <Button onClick={handlePost} disabled={isPosting || validRows.length === 0} className="w-full">
                {isPosting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Posting {postProgress}%</>
                ) : (
                  `Post ${validRows.length} Payments`
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

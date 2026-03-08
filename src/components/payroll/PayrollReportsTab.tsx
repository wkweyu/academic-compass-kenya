import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { payrollService, PayrollRun } from '@/services/payrollService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface PayrollReportsTabProps {
  runs: PayrollRun[];
}

export default function PayrollReportsTab({ runs }: PayrollReportsTabProps) {
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [reportType, setReportType] = useState<string>('summary');

  const { data: entries = [] } = useQuery({
    queryKey: ['payroll-report-entries', selectedRunId],
    queryFn: () => payrollService.getPayrollEntries(parseInt(selectedRunId)),
    enabled: !!selectedRunId,
  });

  const selectedRun = runs.find(r => r.id === parseInt(selectedRunId));

  const totalBasic = entries.reduce((s, e) => s + Number(e.basic_salary), 0);
  const totalAllowances = entries.reduce((s, e) => s + Number(e.total_allowances), 0);
  const totalGross = entries.reduce((s, e) => s + Number(e.gross_salary), 0);
  const totalNHIF = entries.reduce((s, e) => s + Number(e.nhif_deduction), 0);
  const totalNSSF = entries.reduce((s, e) => s + Number(e.nssf_deduction), 0);
  const totalPAYE = entries.reduce((s, e) => s + Number(e.paye_deduction), 0);
  const totalHousingLevy = entries.reduce((s, e) => s + Number(e.housing_levy || 0), 0);
  const totalNITA = entries.reduce((s, e) => s + Number(e.nita_levy || 0), 0);
  const totalLoans = entries.reduce((s, e) => s + Number(e.loan_deduction), 0);
  const totalOtherDed = entries.reduce((s, e) => s + Number(e.other_deductions), 0);
  const totalDeductions = entries.reduce((s, e) => s + Number(e.total_deductions), 0);
  const totalNet = entries.reduce((s, e) => s + Number(e.net_salary), 0);
  const totalStatutory = totalPAYE + totalNHIF + totalNSSF + totalHousingLevy + totalNITA;

  const exportCSV = () => {
    const period = selectedRun ? `${MONTHS[selectedRun.month - 1]}_${selectedRun.year}` : 'payroll';
    let headers: string[], rows: string[][];

    if (reportType === 'summary') {
      headers = ['Emp No', 'Name', 'Department', 'Basic', 'Allowances', 'Gross', 'PAYE', 'NHIF', 'NSSF', 'Housing Levy', 'NITA', 'Loans', 'Other Ded', 'Total Ded', 'Net Pay'];
      rows = entries.map(e => [
        e.employee_no, e.staff_name, e.department,
        Number(e.basic_salary).toFixed(2), Number(e.total_allowances).toFixed(2), Number(e.gross_salary).toFixed(2),
        Number(e.paye_deduction).toFixed(2), Number(e.nhif_deduction).toFixed(2), Number(e.nssf_deduction).toFixed(2),
        Number(e.housing_levy || 0).toFixed(2), Number(e.nita_levy || 0).toFixed(2),
        Number(e.loan_deduction).toFixed(2), Number(e.other_deductions).toFixed(2),
        Number(e.total_deductions).toFixed(2), Number(e.net_salary).toFixed(2),
      ]);
    } else if (reportType === 'statutory') {
      headers = ['Emp No', 'Name', 'Gross', 'PAYE', 'NHIF', 'NSSF', 'Housing Levy', 'NITA', 'Total Statutory'];
      rows = entries.map(e => {
        const hl = Number(e.housing_levy || 0);
        const nita = Number(e.nita_levy || 0);
        const stat = Number(e.paye_deduction) + Number(e.nhif_deduction) + Number(e.nssf_deduction) + hl + nita;
        return [
          e.employee_no, e.staff_name,
          Number(e.gross_salary).toFixed(2), Number(e.paye_deduction).toFixed(2),
          Number(e.nhif_deduction).toFixed(2), Number(e.nssf_deduction).toFixed(2),
          hl.toFixed(2), nita.toFixed(2), stat.toFixed(2),
        ];
      });
    } else if (reportType === 'p9') {
      headers = ['Emp No', 'Name', 'KRA PIN', 'Basic Pay', 'Benefits/Allowances', 'Gross Pay', 'Defined Contribution', 'Owner Occupied Interest', 'Retirement Contribution', 'Chargeable Pay', 'Tax Charged', 'Personal Relief', 'Insurance Relief', 'PAYE Tax'];
      rows = entries.map(e => {
        const gross = Number(e.gross_salary);
        const nssf = Number(e.nssf_deduction);
        const nhif = Number(e.nhif_deduction);
        const paye = Number(e.paye_deduction);
        const chargeable = gross - nssf;
        const insuranceRelief = Math.min(nhif * 0.15, 5000);
        return [
          e.employee_no, e.staff_name, '',
          Number(e.basic_salary).toFixed(2), Number(e.total_allowances).toFixed(2),
          gross.toFixed(2), nssf.toFixed(2), '0.00', '0.00',
          chargeable.toFixed(2), (paye + 2400 + insuranceRelief).toFixed(2),
          '2400.00', insuranceRelief.toFixed(2), paye.toFixed(2),
        ];
      });
    } else {
      headers = ['Emp No', 'Name', 'Department', 'Bank', 'Branch', 'Account', 'Net Pay'];
      rows = entries.map(e => [
        e.employee_no, e.staff_name, e.department,
        e.bank_name, e.bank_branch, e.account_number, Number(e.net_salary).toFixed(2),
      ]);
    }

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${reportType}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Payroll Reports</CardTitle>
            <CardDescription>Generate and export payroll reports</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select payroll run" /></SelectTrigger>
              <SelectContent>
                {runs.map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>{MONTHS[r.month - 1]} {r.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Payroll Summary</SelectItem>
                <SelectItem value="statutory">Statutory Returns</SelectItem>
                <SelectItem value="p9">P9 Tax Report</SelectItem>
                <SelectItem value="banking">Banking Details</SelectItem>
              </SelectContent>
            </Select>
            {entries.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedRunId ? (
          <p className="text-center py-8 text-muted-foreground">Select a payroll run to view reports</p>
        ) : reportType === 'summary' ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emp No</TableHead><TableHead>Name</TableHead><TableHead>Dept</TableHead>
                  <TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NHIF</TableHead><TableHead className="text-right">NSSF</TableHead>
                  <TableHead className="text-right">H. Levy</TableHead><TableHead className="text-right">NITA</TableHead>
                  <TableHead className="text-right">Total Ded</TableHead><TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{e.employee_no}</TableCell>
                    <TableCell className="font-medium text-sm">{e.staff_name}</TableCell>
                    <TableCell className="text-xs">{e.department}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.basic_salary))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.total_allowances))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.gross_salary))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.paye_deduction))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.nhif_deduction))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.nssf_deduction))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.housing_levy || 0))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(e.nita_levy || 0))}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{formatCurrency(Number(e.total_deductions))}</TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatCurrency(Number(e.net_salary))}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>TOTALS</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalBasic)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalAllowances)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalGross)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalPAYE)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalNHIF)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalNSSF)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalHousingLevy)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalNITA)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(totalDeductions)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalNet)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : reportType === 'statutory' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp No</TableHead><TableHead>Name</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
                <TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">NHIF</TableHead>
                <TableHead className="text-right">NSSF</TableHead>
                <TableHead className="text-right">Housing Levy</TableHead>
                <TableHead className="text-right">NITA</TableHead>
                <TableHead className="text-right">Total Statutory</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => {
                const hl = Number(e.housing_levy || 0);
                const nita = Number(e.nita_levy || 0);
                const statutory = Number(e.paye_deduction) + Number(e.nhif_deduction) + Number(e.nssf_deduction) + hl + nita;
                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.employee_no}</TableCell>
                    <TableCell className="font-medium">{e.staff_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(e.gross_salary))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(e.paye_deduction))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(e.nhif_deduction))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(e.nssf_deduction))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(hl)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(nita)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(statutory)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>TOTALS</TableCell>
                <TableCell className="text-right">{formatCurrency(totalGross)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalPAYE)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalNHIF)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalNSSF)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalHousingLevy)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalNITA)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalStatutory)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : reportType === 'p9' ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emp No</TableHead><TableHead>Name</TableHead>
                  <TableHead className="text-right">Basic Pay</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">NSSF</TableHead>
                  <TableHead className="text-right">Taxable Pay</TableHead>
                  <TableHead className="text-right">Tax Charged</TableHead>
                  <TableHead className="text-right">Relief</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => {
                  const gross = Number(e.gross_salary);
                  const nssf = Number(e.nssf_deduction);
                  const nhif = Number(e.nhif_deduction);
                  const paye = Number(e.paye_deduction);
                  const taxable = gross - nssf;
                  const insuranceRelief = Math.min(nhif * 0.15, 5000);
                  const totalRelief = 2400 + insuranceRelief;
                  const taxCharged = paye + totalRelief;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{e.employee_no}</TableCell>
                      <TableCell className="font-medium">{e.staff_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(e.basic_salary))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(e.total_allowances))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(gross)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(nssf)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(taxable)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(taxCharged)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalRelief)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(paye)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp No</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead>
                <TableHead>Bank</TableHead><TableHead>Branch</TableHead><TableHead>Account No</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.employee_no}</TableCell>
                  <TableCell className="font-medium">{e.staff_name}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.bank_name || '-'}</TableCell>
                  <TableCell>{e.bank_branch || '-'}</TableCell>
                  <TableCell>{e.account_number || '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(e.net_salary))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={6}>TOTAL</TableCell>
                <TableCell className="text-right">{formatCurrency(totalNet)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

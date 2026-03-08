import { PayrollEntry } from '@/services/payrollService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface PayslipPrintProps {
  entry: PayrollEntry;
  month: number;
  year: number;
  schoolName?: string;
}

export default function PayslipPrint({ entry, month, year, schoolName }: PayslipPrintProps) {
  const gross = Number(entry.gross_salary);
  const totalDed = Number(entry.total_deductions);
  const net = Number(entry.net_salary);

  return (
    <div className="p-8 bg-white text-black max-w-[800px] mx-auto print:p-4" id="payslip-print">
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-xl font-bold uppercase">{schoolName || 'School Name'}</h1>
        <h2 className="text-lg font-semibold mt-1">PAYSLIP</h2>
        <p className="text-sm mt-1">For the month of {MONTHS[month - 1]} {year}</p>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="space-y-1">
          <p><span className="font-semibold">Employee Name:</span> {entry.staff_name}</p>
          <p><span className="font-semibold">Employee No:</span> {entry.employee_no}</p>
          <p><span className="font-semibold">Department:</span> {entry.department || 'N/A'}</p>
        </div>
        <div className="space-y-1 text-right">
          <p><span className="font-semibold">Bank:</span> {entry.bank_name || 'N/A'}</p>
          <p><span className="font-semibold">Branch:</span> {entry.bank_branch || 'N/A'}</p>
          <p><span className="font-semibold">Account:</span> {entry.account_number || 'N/A'}</p>
        </div>
      </div>

      {/* Earnings & Deductions */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="font-bold border-b border-black pb-1 mb-2">EARNINGS</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1">Basic Salary</td><td className="text-right py-1">{formatCurrency(Number(entry.basic_salary))}</td></tr>
              <tr className="border-b"><td className="py-1">House Allowance</td><td className="text-right py-1">{formatCurrency(Number(entry.house_allowance))}</td></tr>
              <tr className="border-b"><td className="py-1">Transport Allowance</td><td className="text-right py-1">{formatCurrency(Number(entry.transport_allowance))}</td></tr>
              <tr className="border-b"><td className="py-1">Medical Allowance</td><td className="text-right py-1">{formatCurrency(Number(entry.medical_allowance))}</td></tr>
              {Number(entry.other_allowances) > 0 && (
                <tr className="border-b"><td className="py-1">Other Allowances</td><td className="text-right py-1">{formatCurrency(Number(entry.other_allowances))}</td></tr>
              )}
              <tr className="font-bold border-t-2 border-black"><td className="py-1">GROSS PAY</td><td className="text-right py-1">{formatCurrency(gross)}</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-bold border-b border-black pb-1 mb-2">DEDUCTIONS</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1">PAYE (Tax)</td><td className="text-right py-1">{formatCurrency(Number(entry.paye_deduction))}</td></tr>
              <tr className="border-b"><td className="py-1">NHIF</td><td className="text-right py-1">{formatCurrency(Number(entry.nhif_deduction))}</td></tr>
              <tr className="border-b"><td className="py-1">NSSF</td><td className="text-right py-1">{formatCurrency(Number(entry.nssf_deduction))}</td></tr>
              <tr className="border-b"><td className="py-1">Housing Levy (1.5%)</td><td className="text-right py-1">{formatCurrency(Number(entry.housing_levy || 0))}</td></tr>
              <tr className="border-b"><td className="py-1">NITA Levy</td><td className="text-right py-1">{formatCurrency(Number(entry.nita_levy || 0))}</td></tr>
              {Number(entry.loan_deduction) > 0 && (
                <tr className="border-b"><td className="py-1">Loan Deduction</td><td className="text-right py-1">{formatCurrency(Number(entry.loan_deduction))}</td></tr>
              )}
              {Number(entry.other_deductions) > 0 && (
                <tr className="border-b"><td className="py-1">Other Deductions</td><td className="text-right py-1">{formatCurrency(Number(entry.other_deductions))}</td></tr>
              )}
              <tr className="font-bold border-t-2 border-black"><td className="py-1">TOTAL DEDUCTIONS</td><td className="text-right py-1">{formatCurrency(totalDed)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay */}
      <div className="border-2 border-black p-3 text-center mb-6">
        <p className="text-lg font-bold">NET PAY: {formatCurrency(net)}</p>
      </div>

      {/* Footer */}
      <div className="grid grid-cols-2 gap-8 mt-8 text-sm">
        <div>
          <p className="border-b border-black pb-1 mb-1">Prepared by: ___________________</p>
          <p className="text-xs text-gray-500">Date: ___________________</p>
        </div>
        <div>
          <p className="border-b border-black pb-1 mb-1">Approved by: ___________________</p>
          <p className="text-xs text-gray-500">Date: ___________________</p>
        </div>
      </div>

      <p className="text-xs text-center mt-6 text-gray-400">This is a computer-generated document. No signature required.</p>
    </div>
  );
}

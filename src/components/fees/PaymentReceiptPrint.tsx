import { Receipt } from '@/services/feesService';
import { escapeHtml } from '@/utils/escapeHtml';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '');
  };
  
  return convert(Math.floor(num)) + ' Shillings Only';
}

interface PaymentReceiptPrintProps {
  receipt: Receipt;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  balance?: number;
}

export function printReceipt(props: PaymentReceiptPrintProps) {
  const { receipt, schoolName = 'School Name', schoolAddress = '', schoolPhone = '', schoolEmail = '', balance = 0 } = props;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const allocationsHtml = (receipt.allocations || []).map(a => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #eee;">${escapeHtml(a.vote_head_name || 'Fee')}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(Number(a.amount))}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html><head><title>Receipt ${escapeHtml(receipt.receipt_no)}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; }
      .receipt { border: 2px solid #333; padding: 30px; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
      .header h1 { font-size: 22px; margin-bottom: 4px; text-transform: uppercase; }
      .header p { font-size: 12px; color: #555; }
      .receipt-title { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0; text-decoration: underline; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 15px 0; }
      .info-item { font-size: 13px; }
      .info-item label { font-weight: bold; color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 13px; border-bottom: 2px solid #333; }
      .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #333; }
      .total-row td { padding: 10px 12px; }
      .amount-words { margin: 15px 0; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; font-size: 13px; }
      .amount-words strong { color: #333; }
      .balance-section { margin: 15px 0; padding: 10px; border: 1px solid #ddd; text-align: center; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; }
      .signature { text-align: center; width: 200px; }
      .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 12px; }
      @media print { 
        body { padding: 10px; }
        .no-print { display: none; }
      }
    </style></head><body>
    <div class="receipt">
      <div class="header">
        <h1>${escapeHtml(schoolName)}</h1>
        ${schoolAddress ? `<p>${escapeHtml(schoolAddress)}</p>` : ''}
        ${schoolPhone ? `<p>Tel: ${escapeHtml(schoolPhone)}</p>` : ''}
        ${schoolEmail ? `<p>Email: ${escapeHtml(schoolEmail)}</p>` : ''}
      </div>
      
      <div class="receipt-title">OFFICIAL RECEIPT</div>
      
      <div class="info-grid">
        <div class="info-item"><label>Receipt No:</label> ${escapeHtml(receipt.receipt_no)}</div>
        <div class="info-item"><label>Date:</label> ${new Date(receipt.created_at).toLocaleDateString()}</div>
        <div class="info-item"><label>Student:</label> ${escapeHtml(receipt.student_name || '')}</div>
        <div class="info-item"><label>Adm No:</label> ${escapeHtml(receipt.admission_number || '')}</div>
        <div class="info-item"><label>Payment Mode:</label> ${escapeHtml(receipt.payment_mode.toUpperCase())}</div>
        <div class="info-item"><label>Reference:</label> ${escapeHtml(receipt.reference || '-')}</div>
        <div class="info-item"><label>Term/Year:</label> Term ${escapeHtml(receipt.term)} / ${escapeHtml(receipt.year)}</div>
      </div>
      
      ${allocationsHtml ? `
        <table>
          <thead><tr><th>Vote Head</th><th style="text-align: right;">Amount (KES)</th></tr></thead>
          <tbody>
            ${allocationsHtml}
            <tr class="total-row">
              <td>TOTAL</td>
              <td style="text-align: right;">${formatCurrency(Number(receipt.amount))}</td>
            </tr>
          </tbody>
        </table>
      ` : `
        <div style="margin: 15px 0; font-size: 16px; font-weight: bold; text-align: center;">
          Amount: ${formatCurrency(Number(receipt.amount))}
        </div>
      `}
      
      <div class="amount-words">
        <strong>Amount in words:</strong> ${numberToWords(Number(receipt.amount))}
      </div>
      
      <div class="balance-section">
        <strong>Balance After Payment: ${formatCurrency(balance)}</strong>
      </div>
      
      ${receipt.remarks ? `<p style="font-size: 12px; color: #555; margin: 10px 0;"><strong>Remarks:</strong> ${escapeHtml(receipt.remarks)}</p>` : ''}
      
      <div class="footer">
        <div class="signature">
          <div class="signature-line">Received By</div>
        </div>
        <div class="signature">
          <div class="signature-line">Authorized Signature</div>
        </div>
      </div>
    </div>
    
    <div class="no-print" style="text-align: center; margin-top: 20px;">
      <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer; background: #333; color: #fff; border: none; border-radius: 4px;">
        Print Receipt
      </button>
    </div>
    </body></html>
  `);
  printWindow.document.close();
}

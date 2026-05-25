// All new print documents must use printService. Do not add new window.open() print logic elsewhere.
// Existing callers (27 files) are intentional legacy — they must not evolve independently.
import type { Student } from '@/types/student';
import type { SchoolProfile } from '@/types/settings';
import { escapeHtml } from '@/utils/escapeHtml';

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12pt;
    color: #000;
    margin: 0;
    padding: 0;
  }
  @page {
    size: A4;
    margin: 20mm 15mm 25mm 15mm;
  }
  @media print {
    body::after {
      content: "CONFIDENTIAL";
      position: fixed;
      bottom: 8mm;
      right: 10mm;
      font-size: 8pt;
      color: #aaa;
      letter-spacing: 2px;
    }
  }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  h2 { font-size: 14pt; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 11pt; margin: 12px 0 4px; }
  p, td, th { font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { text-align: left; padding: 4px 6px; border: 1px solid #ddd; }
  th { background: #f5f5f5; font-weight: 600; }
  .school-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; }
  .school-sub { font-size: 10pt; color: #444; margin: 2px 0; }
  .form-title { text-align: center; font-size: 15pt; font-weight: bold; margin: 12px 0 16px; text-transform: uppercase; letter-spacing: 1px; }
  .section { margin-bottom: 14px; }
  .field-row { display: flex; gap: 24px; margin-bottom: 6px; flex-wrap: wrap; }
  .field { flex: 1; min-width: 140px; }
  .field label { font-size: 8.5pt; color: #666; display: block; margin-bottom: 1px; }
  .field span { font-size: 10pt; font-weight: 500; border-bottom: 1px solid #bbb; display: block; min-height: 18px; }
  .signature-row { display: flex; gap: 40px; margin-top: 30px; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #000; margin-bottom: 4px; height: 28px; }
  .sig-label { font-size: 8.5pt; color: #666; }
  .footer-note { font-size: 8pt; color: #999; margin-top: 20px; text-align: center; }
`;

export function buildBaseDocumentShell(title: string, bodyHtml: string, styles?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${BASE_CSS}${styles ? '\n' + styles : ''}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function openPrintWindow(title: string, html: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function computeAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function printAdmissionForm(student: Student, schoolProfile: SchoolProfile | null): void {
  const schoolName = escapeHtml(schoolProfile?.name ?? 'School Name');
  const schoolAddress = escapeHtml(schoolProfile?.address ?? '');
  const schoolPhone = escapeHtml(schoolProfile?.phone ?? '');
  const age = computeAge(student.date_of_birth);
  const transportType = student.transport_type === 'one_way' ? 'One Way'
    : student.transport_type === 'two_way' ? 'Two Way' : '';
  const datePrinted = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

  const body = `
<div class="school-header">
  <h1>${schoolName}</h1>
  ${schoolAddress ? `<p class="school-sub">${schoolAddress}</p>` : ''}
  ${schoolPhone ? `<p class="school-sub">Tel: ${schoolPhone}</p>` : ''}
</div>

<div class="form-title">Student Admission Form</div>

<div class="section">
  <h2>Student Details</h2>
  <div class="field-row">
    <div class="field"><label>Full Name</label><span>${escapeHtml(student.full_name)}</span></div>
    <div class="field"><label>Admission Number</label><span>${escapeHtml(student.admission_number)}</span></div>
  </div>
  <div class="field-row">
    <div class="field"><label>Date of Birth</label><span>${escapeHtml(new Date(student.date_of_birth).toLocaleDateString())}</span></div>
    <div class="field"><label>Age</label><span>${age} years</span></div>
    <div class="field"><label>Gender</label><span>${student.gender === 'M' ? 'Male' : 'Female'}</span></div>
  </div>
  <div class="field-row">
    <div class="field"><label>Level</label><span>${escapeHtml(student.level)}</span></div>
    ${student.upi_number ? `<div class="field"><label>UPI Number</label><span>${escapeHtml(student.upi_number)}</span></div>` : ''}
  </div>
</div>

<div class="section">
  <h2>Academic Placement</h2>
  <div class="field-row">
    <div class="field"><label>Current Class</label><span>${escapeHtml(student.current_class_name)}</span></div>
    <div class="field"><label>Stream</label><span>${escapeHtml(student.current_stream_name)}</span></div>
    <div class="field"><label>Academic Year</label><span>${escapeHtml(String(student.academic_year))}</span></div>
  </div>
</div>

<div class="section">
  <h2>Guardian Information</h2>
  <div class="field-row">
    <div class="field"><label>Guardian Name</label><span>${escapeHtml(student.guardian_name)}</span></div>
    <div class="field"><label>Relationship</label><span>${escapeHtml(student.guardian_relationship)}</span></div>
  </div>
  <div class="field-row">
    <div class="field"><label>Phone</label><span>${escapeHtml(student.guardian_phone)}</span></div>
    ${student.guardian_email ? `<div class="field"><label>Email</label><span>${escapeHtml(student.guardian_email)}</span></div>` : ''}
  </div>
</div>

<div class="section">
  <h2>Transport</h2>
  <div class="field-row">
    <div class="field"><label>Enrolled in Transport</label><span>${student.is_on_transport ? 'Yes' : 'No'}</span></div>
    ${student.is_on_transport && student.transport_route_name ? `<div class="field"><label>Route</label><span>${escapeHtml(student.transport_route_name)}</span></div>` : ''}
    ${student.is_on_transport && transportType ? `<div class="field"><label>Type</label><span>${escapeHtml(transportType)}</span></div>` : ''}
  </div>
</div>

<div class="section">
  <h2>Declaration</h2>
  <p>I confirm that the information provided above is accurate to the best of my knowledge.</p>
  <div class="signature-row">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Parent / Guardian Signature</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Head Teacher / Principal Signature</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Date</div>
    </div>
  </div>
</div>

<p class="footer-note">Date printed: ${escapeHtml(datePrinted)}</p>
`;

  const html = buildBaseDocumentShell(`Admission Form — ${student.full_name}`, body);
  openPrintWindow(`Admission Form — ${student.full_name}`, html);
}

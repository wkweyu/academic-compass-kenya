// All CSV exports must use exportUtils.downloadCsv.
// Do not duplicate the Blob + <a> click pattern elsewhere.
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csvContent = [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

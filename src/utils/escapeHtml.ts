/**
 * Escapes HTML special characters to prevent XSS when injecting into HTML template strings.
 * Use this for any user/database-sourced value injected into document.write() or innerHTML.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

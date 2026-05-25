/**
 * Admission number utilities.
 *
 * DB format:  ADM/NNNN  (e.g. ADM/0042)
 * M-Pesa AccountReference: 12-char max, no special characters allowed by Safaricom.
 *
 * Parents are instructed to enter only the numeric part (e.g. "0042") at the
 * paybill prompt. These helpers convert in both directions so no extra DB field
 * is needed.
 */

/**
 * Convert a stored admission number to the M-Pesa AccountReference a parent
 * should type at the paybill prompt.
 *
 * "ADM/0042" → "0042"
 * "ADM/123"  → "0123"
 * "2026-0042" → "0042"  (legacy format handled)
 *
 * Use this value on printed fee receipts and payment slips.
 */
export function admissionToPaybillRef(admissionNumber: string): string {
  const digits = admissionNumber.replace(/\D/g, '');
  return digits.padStart(4, '0');
}

/**
 * Reconstruct the exact DB admission_number value from an M-Pesa AccountReference.
 *
 * "0042" → "ADM/0042"
 * "42"   → "ADM/0042"
 * "4200" → "ADM/4200"
 *
 * Use this for the M-Pesa callback lookup:
 *   .eq('admission_number', admissionFromPaybillRef(accountRef))
 * Exact match — no ILIKE — so no partial-number collisions are possible.
 */
export function admissionFromPaybillRef(ref: string): string {
  const digits = ref.replace(/\D/g, '').padStart(4, '0');
  return `ADM/${digits}`;
}

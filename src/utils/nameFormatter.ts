/**
 * Converts a name to sentence case (Title Case)
 * e.g., "JOHN DOE" → "John Doe", "jane doe" → "Jane Doe"
 */
export function toSentenceCase(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats a name for display (sentence case)
 */
export function formatStudentName(name: string): string {
  return toSentenceCase(name.trim());
}

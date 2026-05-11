/**
 * Normalises raw bank booking labels (e.g. "FOLGELASTSCHRIFT",
 * "BARGELDAUSZAHLUNG GA") into readable title-case ("Folgelastschrift",
 * "Bargeldauszahlung GA") for chip display and filter dropdown.
 *
 * Tokens of length ≤ 3 (GA, ATM, SEPA, …) keep their original casing —
 * banking acronyms read worse when title-cased.
 */
const ACRONYM_MAX_LEN = 3;

export function formatBookingText(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const originals = trimmed.split(/\s+/);
  return originals
    .map(original => {
      if (original.length <= ACRONYM_MAX_LEN && original === original.toUpperCase()) {
        return original;
      }
      const lower = original.toLocaleLowerCase('de-DE');
      return lower.charAt(0).toLocaleUpperCase('de-DE') + lower.slice(1);
    })
    .join(' ');
}

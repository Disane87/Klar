/**
 * Strips SEPA-prefixed reference lines (EREF+, MREF+, KREF+, CRED+, SVWZ+, ABWA+, ABWE+)
 * and collapses whitespace so the FinTS purpose blob renders as one readable line.
 *
 * Input is the stitched `purposeRaw` from the FinTS booking mapper or the CSV
 * Sparkasse parser — both join with newlines and use the same SEPA shorthand.
 */
const SEPA_PREFIX = /^(EREF|MREF|KREF|CRED|SVWZ|ABWA|ABWE)\+/i;

export function formatPurpose(raw: string | null | undefined): string {
  if (!raw) return '';
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !SEPA_PREFIX.test(l));
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

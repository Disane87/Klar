/**
 * Extracts a German bank booking-type label (e.g. "FOLGELASTSCHRIFT",
 * "GUTSCHRIFT", "DAUERAUFTRAG") from a free-form purpose blob when the
 * bank did not deliver it as a separate field.
 *
 * Used as a fallback by:
 *   - FinTS mapper: lib-fints sometimes leaves `tx.bookingText` empty and
 *     only the SVWZ purpose carries the keyword (e.g. Sparkasse Amazon
 *     direct-debit bookings ending in " FOLGELASTSCHRIFT").
 *   - Sparkasse CSV parser: when the "Buchungstext" column is empty but
 *     the keyword is appended to "Verwendungszweck".
 *
 * Whitelist-driven on purpose — a generic "any uppercase word" extractor
 * would mis-classify counterparty names (e.g. "AMAZON", "PAYPAL") and
 * SEPA refs. The list mirrors the Buchungstext keys German banks emit
 * (Sparkasse/Volksbank/Postbank conventions).
 *
 * Matching rules:
 *  - case-insensitive, returns the canonical UPPERCASE form
 *  - longest match wins (FOLGELASTSCHRIFT before LASTSCHRIFT)
 *  - whole-word boundary (not inside another word)
 *  - first match wins on ties
 */

const BOOKING_TYPE_KEYWORDS = [
  'FOLGELASTSCHRIFT',
  'ERSTLASTSCHRIFT',
  'EINMALLASTSCHRIFT',
  'EINZUGSERMAECHTIGUNG',
  'EINZUGSERMÄCHTIGUNG',
  'ABSCHLUSS',
  'BARGELDAUSZAHLUNG',
  'KARTENZAHLUNG',
  'ECHTZEIT-UEBERWEISUNG',
  'ECHTZEIT-ÜBERWEISUNG',
  'ECHTZEITUEBERWEISUNG',
  'ECHTZEITÜBERWEISUNG',
  'SEPA-UEBERWEISUNG',
  'SEPA-ÜBERWEISUNG',
  'SEPA-LASTSCHRIFT',
  'DAUERAUFTRAG',
  'GEHALT',
  'LOHN',
  'RENTE',
  'ENTGELT',
  'GEBUEHR',
  'GEBÜHR',
  'STEUERN',
  'ZINSEN',
  'LASTSCHRIFT',
  'ABBUCHUNG',
  'GUTSCHRIFT',
  'UEBERWEISUNG',
  'ÜBERWEISUNG',
  'AUSZAHLUNG',
  'EINZAHLUNG',
] as const;

const SORTED_KEYWORDS = [...BOOKING_TYPE_KEYWORDS].sort((a, b) => b.length - a.length);

const KEYWORD_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(${SORTED_KEYWORDS.map(escapeRegex).join('|')})(?=$|[^\\p{L}\\p{N}])`,
  'iu',
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the canonical uppercase booking-type keyword found in `text`,
 * or null when none of the whitelisted terms appears.
 */
export function extractBookingText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(KEYWORD_RE);
  if (!m || !m[1]) return null;
  return m[1].toUpperCase();
}

// Merchant key normalization and tokenization.
//
// Two related problems detection has to solve:
//   1. "Spotify AB" and "SPOTIFY P0123ABC" must collapse to the same key
//      (case folding, accent stripping, removing bank-specific suffixes).
//   2. "Vodafone Internet" and "Vodafone Handy" must NOT collapse — even
//      though both start with "vodafone", they're distinct contracts. So we
//      keep tokens around and use token-overlap matching during clustering.
//
// `normalizeMerchantKey` produces the collapsed key (lossy).
// `extractTokens` returns the discriminating tokens (length-filtered) so the
// detector can split a coarse cluster into finer ones when token sets diverge.

const MIN_TOKEN_LENGTH = 4;

/** Lowercase, NFKD-strip accents, drop non-alphanumerics, cap at 64 chars. */
export function normalizeMerchantKey(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 64);
}

/**
 * Extract whitespace-separated tokens of length ≥ MIN_TOKEN_LENGTH from a
 * label, after lowercasing and accent-stripping. Used to disambiguate two
 * merchants that share a normalized key but have different qualifiers (e.g.
 * "vodafone internet" vs "vodafone handy" both normalize to "vodafone" but
 * yield different token sets).
 */
export function extractTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= MIN_TOKEN_LENGTH);
}

/**
 * True when two token sets share a discriminating token (substring match in
 * either direction). Returns true for empty sets too — empty means "no
 * additional discriminator", so the merchant-key alone decides.
 */
export function tokensOverlap(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  for (const x of a) {
    for (const y of b) {
      if (x === y || x.includes(y) || y.includes(x)) return true;
    }
  }
  return false;
}

/**
 * Combine tokens from two strings (e.g. counterparty + purpose) and dedupe.
 * Returns sorted tokens for deterministic comparison.
 */
export function combineTokens(...sources: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const s of sources) {
    for (const t of extractTokens(s)) set.add(t);
  }
  return [...set].sort();
}

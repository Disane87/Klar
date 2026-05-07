import type { BankRecord } from './bank-record';

/**
 * Parser for hbci4j's blz.properties format.
 *
 * Each line: `<blz>=<name>|<city>|<bic>|<numericCode>|<host>|<url>|<pinTanVersion>|<hbciVersion>|`
 * Trailing pipe is allowed; trailing empty fields collapse to undefined.
 *
 * Parser is strict on the BLZ key (must be 8 digits) but lenient on
 * the value: malformed or partial lines are skipped with the row index
 * recorded under {@link BlzParseResult.skipped}. We don't crash on bad
 * input — the upstream file occasionally adds new columns we don't
 * recognise yet, and we'd rather keep the rest of the registry usable.
 */
export interface BlzParseResult {
  records: BankRecord[];
  skipped: { line: number; reason: string }[];
}

const BLZ_RE = /^[0-9]{8}$/;

export function parseBlzProperties(text: string): BlzParseResult {
  const records: BankRecord[] = [];
  const skipped: { line: number; reason: string }[] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) {
      skipped.push({ line: i + 1, reason: 'no = separator' });
      continue;
    }

    const blz = line.slice(0, eq).trim();
    if (!BLZ_RE.test(blz)) {
      skipped.push({ line: i + 1, reason: `invalid BLZ "${blz}"` });
      continue;
    }

    const parts = line.slice(eq + 1).split('|');
    const name = (parts[0] ?? '').trim();
    if (!name) {
      skipped.push({ line: i + 1, reason: 'empty bank name' });
      continue;
    }

    records.push({
      blz,
      name,
      city: trimOrUndef(parts[1]),
      bic: trimOrUndef(parts[2]),
      numericCode: trimOrUndef(parts[3]),
      host: trimOrUndef(parts[4]),
      pinTanUrl: trimOrUndef(parts[5]),
      pinTanVersion: trimOrUndef(parts[6]),
      hbciVersion: trimOrUndef(parts[7]),
    });
  }

  return { records, skipped };
}

function trimOrUndef(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  return t.length === 0 ? undefined : t;
}

import { Injectable } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import * as Papa from 'papaparse';
import { extractBookingText } from '@klar/shared';
import { counterpartyKey } from '../../import-pipeline/utils/counterparty-key';

export interface ParsedRow {
  rowIndex: number;
  date: string;
  amountCents: number;
  counterparty: string | null;
  counterpartyNorm: string;
  purpose: string | null;
  purposeNorm: string;
  externalRef: string | null;
  /** "Buchungstext" CSV column — bank-side label (e.g. "FOLGELASTSCHRIFT"). */
  bookingText: string | null;
}

const REQUIRED_HEADERS = [
  'Buchungstag',
  'Verwendungszweck',
  'Beguenstigter/Zahlungspflichtiger',
  'Betrag',
];

const REF_PATTERNS: RegExp[] = [
  /EREF\+([^\s+]+)/,
  /KREF\+([^\s+]+)/,
  /MREF\+([^\s+]+)/,
];

@Injectable()
export class SparkasseCamtV2Parser {
  parse(input: Buffer): ParsedRow[] {
    const text = iconv.decode(input, 'win1252');
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: h => h.trim().replace(/^"|"$/g, ''),
      transform: v => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v),
    });

    const fields = result.meta.fields ?? [];
    for (const required of REQUIRED_HEADERS) {
      if (!fields.some(f => f === required)) {
        throw new Error('Format wird nicht unterstützt — Sparkasse CAMT v2 erwartet');
      }
    }

    return result.data.map((raw, idx) => this.mapRow(raw, idx));
  }

  private mapRow(raw: Record<string, string>, rowIndex: number): ParsedRow {
    const date = this.parseDate(raw['Buchungstag'] ?? '');
    const amountCents = this.parseAmount(raw['Betrag'] ?? '');
    const counterparty = (raw['Beguenstigter/Zahlungspflichtiger'] ?? '').trim() || null;
    const purpose = (raw['Verwendungszweck'] ?? '').replace(/\s+/g, ' ').trim() || null;
    const externalRef = this.extractRef(
      purpose ?? '',
      raw['Mandatsreferenz'] ?? '',
      raw['Kundenreferenz (End-to-End)'] ?? '',
    );
    // Prefer the dedicated CSV column; fall back to keyword extraction
    // from the purpose for rows where the bank leaves it blank but
    // appends "FOLGELASTSCHRIFT" / "GUTSCHRIFT" / … to Verwendungszweck.
    const bookingText =
      ((raw['Buchungstext'] ?? '').trim() || null) ??
      extractBookingText(purpose);

    return {
      rowIndex,
      date,
      amountCents,
      counterparty,
      counterpartyNorm: counterpartyKey(counterparty),
      purpose,
      purposeNorm: counterpartyKey(purpose),
      externalRef,
      bookingText,
    };
  }

  private parseDate(raw: string): string {
    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
    if (!match) throw new Error(`Ungültiges Datum: ${raw}`);
    const [, dd, mm, yyRaw] = match;
    let year: number;
    if (yyRaw.length === 4) {
      year = Number(yyRaw);
    } else {
      const yy = Number(yyRaw);
      year = yy < 70 ? 2000 + yy : 1900 + yy;
    }
    return `${year.toString().padStart(4, '0')}-${mm}-${dd}`;
  }

  private parseAmount(raw: string): number {
    const cleaned = raw.replace(/\./g, '').replace(',', '.');
    const num = Number(cleaned);
    if (Number.isNaN(num)) throw new Error(`Ungültiger Betrag: ${raw}`);
    return Math.round(num * 100);
  }

  private extractRef(purpose: string, mref: string, kref: string): string | null {
    for (const pattern of REF_PATTERNS) {
      const m = purpose.match(pattern);
      if (m && m[1]) return m[1];
    }
    if (kref?.trim()) return kref.trim();
    if (mref?.trim()) return mref.trim();
    return null;
  }
}

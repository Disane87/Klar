import { describe, it, expect } from 'vitest';
import { SparkasseCamtV2Parser } from './sparkasse-camt-v2.parser';

const HEADER = [
  'Auftragskonto',
  'Buchungstag',
  'Valutadatum',
  'Buchungstext',
  'Verwendungszweck',
  'Glaeubiger ID',
  'Mandatsreferenz',
  'Kundenreferenz (End-to-End)',
  'Sammlerreferenz',
  'Lastschrift Ursprungsbetrag',
  'Auslagenersatz Ruecklastschrift',
  'Beguenstigter/Zahlungspflichtiger',
  'Kontonummer/IBAN',
  'BIC (SWIFT-Code)',
  'Betrag',
  'Waehrung',
  'Info',
].map(h => `"${h}"`).join(';');

function row(values: (string | number)[]): string {
  return values.map(v => `"${v}"`).join(';');
}

function buildCsv(rows: string[]): Buffer {
  return Buffer.from([HEADER, ...rows].join('\n'), 'latin1');
}

describe('SparkasseCamtV2Parser', () => {
  const parser = new SparkasseCamtV2Parser();

  it('parses a basic expense row', () => {
    const csv = buildCsv([
      row(['DE111', '15.04.26', '15.04.26', 'KARTENZAHLUNG', 'EREF+abc Kauf', '', '', 'abc', '', '', '', 'REWE SAGT DANKE', 'DE222', 'COBADEFFXXX', '-15,99', 'EUR', 'Umsatz gebucht']),
    ]);
    const rows = parser.parse(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-04-15',
      amountCents: -1599,
      counterparty: 'REWE SAGT DANKE',
      externalRef: 'abc',
    });
    expect(rows[0].purpose).toContain('Kauf');
  });

  it('parses positive amounts', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'GEHALT', 'Gehalt April', '', '', '', '', '', '', 'AG GmbH', 'DE222', 'X', '2.345,67', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].amountCents).toBe(234567);
  });

  it('handles umlauts via Win-1252 decoding', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'X', 'Müller', '', '', '', '', '', '', 'Müller GmbH', 'DE222', 'X', '-10,00', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].counterparty).toBe('Müller GmbH');
  });

  it('extracts MREF when no EREF', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'X', 'MREF+mandate-123 Strom', '', 'mandate-123', '', '', '', '', 'Stadtwerke', 'DE222', 'X', '-50,00', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].externalRef).toBe('mandate-123');
  });

  it('returns null externalRef when none present', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'X', 'Plain text', '', '', '', '', '', '', 'X', 'DE222', 'X', '-10,00', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].externalRef).toBeNull();
  });

  it('throws on missing required header', () => {
    const bogus = Buffer.from('"Foo";"Bar"\n"a";"b"', 'latin1');
    expect(() => parser.parse(bogus)).toThrow(/Format wird nicht unterstützt/);
  });

  it('parses YY < 70 as 20YY, >= 70 as 19YY', () => {
    const csv = buildCsv([
      row(['DE111', '15.04.69', '15.04.69', 'X', 'X', '', '', '', '', '', '', 'X', 'DE222', 'X', '-1,00', 'EUR', '']),
    ]);
    expect(parser.parse(csv)[0].date).toBe('2069-04-15');

    const csv2 = buildCsv([
      row(['DE111', '15.04.70', '15.04.70', 'X', 'X', '', '', '', '', '', '', 'X', 'DE222', 'X', '-1,00', 'EUR', '']),
    ]);
    expect(parser.parse(csv2)[0].date).toBe('1970-04-15');
  });
});

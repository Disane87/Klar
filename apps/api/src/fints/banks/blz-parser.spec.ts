import { describe, it, expect } from 'vitest';
import { parseBlzProperties } from './blz-parser';

describe('parseBlzProperties', () => {
  it('parses a happy-path entry with all fields', () => {
    const text = '37050198=Sparkasse KölnBonn|Köln|COLSDE33XXX|00|hbci.s-fints-pt-cfm.de|https://hbci-pintan.gad.de/cgi-bin/hbciservlet|300|300|';
    const { records, skipped } = parseBlzProperties(text);
    expect(skipped).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      blz: '37050198',
      name: 'Sparkasse KölnBonn',
      city: 'Köln',
      bic: 'COLSDE33XXX',
      pinTanUrl: 'https://hbci-pintan.gad.de/cgi-bin/hbciservlet',
      pinTanVersion: '300',
      hbciVersion: '300',
    });
  });

  it('parses an entry without FinTS URL', () => {
    const text = '37080089=Commerzbank vormals Dresdner Bank, PCC DCC-ITGK 7|Köln|DRESDEFFI98|09|||||';
    const { records } = parseBlzProperties(text);
    expect(records).toHaveLength(1);
    expect(records[0].pinTanUrl).toBeUndefined();
    expect(records[0].name).toBe('Commerzbank vormals Dresdner Bank, PCC DCC-ITGK 7');
  });

  it('skips comment and blank lines', () => {
    const text = '# comment\n\n! exclamation\n37050198=Sparkasse|Köln||00|||||';
    const { records, skipped } = parseBlzProperties(text);
    expect(records).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('records skip reason for invalid BLZ', () => {
    const text = '12=tooshort|City||||||';
    const { records, skipped } = parseBlzProperties(text);
    expect(records).toHaveLength(0);
    expect(skipped).toEqual([{ line: 1, reason: 'invalid BLZ "12"' }]);
  });

  it('records skip reason for missing equals', () => {
    const text = 'bogusline';
    const { skipped } = parseBlzProperties(text);
    expect(skipped[0].reason).toContain('no = separator');
  });

  it('records skip reason for empty name', () => {
    const text = '37050198=|Köln|||||||';
    const { records, skipped } = parseBlzProperties(text);
    expect(records).toHaveLength(0);
    expect(skipped[0].reason).toContain('empty bank name');
  });

  it('handles CRLF line endings', () => {
    const text = '37050198=Sparkasse|Köln||00|||||\r\n10070000=Deutsche Bank|Berlin||10|||||';
    const { records } = parseBlzProperties(text);
    expect(records).toHaveLength(2);
  });
});

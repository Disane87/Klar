import { describe, it, expect } from 'vitest';
import { deriveFrequency } from './derive-frequency';

describe('deriveFrequency', () => {
  it('returns UNKNOWN for fewer than 2 dates', () => {
    expect(deriveFrequency(['2026-05-01'])).toBe('UNKNOWN');
    expect(deriveFrequency([])).toBe('UNKNOWN');
  });

  it('returns MONTHLY for ~30-day gaps', () => {
    expect(
      deriveFrequency(['2026-03-01', '2026-04-01', '2026-05-01']),
    ).toBe('MONTHLY');
  });

  it('returns MONTHLY when month-end days drift (Jan 31 → Feb 28 → Mar 31)', () => {
    expect(
      deriveFrequency(['2026-01-31', '2026-02-28', '2026-03-31']),
    ).toBe('MONTHLY');
  });

  it('returns QUARTERLY for ~90-day gaps', () => {
    expect(deriveFrequency(['2026-02-01', '2026-05-01'])).toBe('QUARTERLY');
  });

  it('returns HALF_YEARLY for ~180-day gaps', () => {
    expect(deriveFrequency(['2026-01-01', '2026-07-01'])).toBe('HALF_YEARLY');
  });

  it('returns YEARLY for ~365-day gaps', () => {
    expect(deriveFrequency(['2025-05-01', '2026-05-01'])).toBe('YEARLY');
  });

  it('returns WEEKLY for 7-day gaps', () => {
    expect(deriveFrequency(['2026-05-01', '2026-05-08', '2026-05-15'])).toBe('WEEKLY');
  });

  it('returns CUSTOM when gaps mix incompatibly', () => {
    expect(
      deriveFrequency(['2026-01-01', '2026-01-15', '2026-03-01']),
    ).toBe('CUSTOM');
  });

  it('handles unsorted input by sorting internally', () => {
    expect(
      deriveFrequency(['2026-05-01', '2026-03-01', '2026-04-01']),
    ).toBe('MONTHLY');
  });

  it('returns WEEKLY at exact lower boundary (6 days)', () => {
    expect(deriveFrequency(['2026-05-01', '2026-05-07'])).toBe('WEEKLY');
  });

  it('returns WEEKLY at exact upper boundary (8 days)', () => {
    expect(deriveFrequency(['2026-05-01', '2026-05-09'])).toBe('WEEKLY');
  });

  it('returns CUSTOM just outside WEEKLY upper boundary (9 days)', () => {
    expect(deriveFrequency(['2026-05-01', '2026-05-10'])).toBe('CUSTOM');
  });

  it('returns MONTHLY at exact lower boundary (27 days)', () => {
    expect(deriveFrequency(['2026-05-01', '2026-05-28'])).toBe('MONTHLY');
  });
});

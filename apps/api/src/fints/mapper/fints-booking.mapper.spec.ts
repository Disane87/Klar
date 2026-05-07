import { describe, it, expect } from 'vitest';
import type { Statement, Transaction as FintsTx } from 'lib-fints';
import { FintsBookingMapper } from './fints-booking.mapper';

const ctx = { iban: 'DE39370501980000000001', syncRunId: 'run-1' } as const;

const makeTx = (overrides: Partial<FintsTx> = {}): FintsTx => ({
  valueDate: new Date('2026-04-15T00:00:00Z'),
  entryDate: new Date('2026-04-15T00:00:00Z'),
  fundsCode: 'DBIT',
  amount: -29.95,
  transactionType: '166',
  customerReference: 'cust-ref',
  bankReference: 'bank-ref',
  transactionCode: 'CCRD',
  bookingText: 'Lastschrift',
  purpose: 'Spotify Premium 04/2026',
  remoteBankId: 'COBADEFFXXX',
  remoteAccountNumber: 'DE00500700100123456789',
  remoteName: 'Spotify AB',
  e2eReference: 'SP-2026-04',
  mandateReference: 'M-ABC-001',
  ...overrides,
});

const makeStatement = (transactions: FintsTx[]): Statement => ({
  openingBalance: { date: new Date('2026-04-01'), currency: 'EUR', value: 1000 },
  closingBalance: { date: new Date('2026-04-30'), currency: 'EUR', value: 970 },
  transactions,
});

describe('FintsBookingMapper', () => {
  it('maps a single debit transaction to RawBooking', () => {
    const out = FintsBookingMapper.toRawBookings([makeStatement([makeTx()])], ctx);
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.amountCents).toBe(-2995);
    expect(r.currency).toBe('EUR');
    expect(r.iban).toBe(ctx.iban);
    expect(r.bookingDate).toBe('2026-04-15');
    expect(r.valueDate).toBe('2026-04-15');
    expect(r.bankTxId).toBe('SP-2026-04');
    expect(r.counterpartyName).toBe('Spotify AB');
    expect(r.counterpartyIban).toBe('DE00500700100123456789');
    expect(r.source).toBe('fints');
    expect(r.sourceRunId).toBe('run-1');
  });

  it('preserves credit transactions as positive amountCents', () => {
    const out = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx({ amount: 1500.5, fundsCode: 'CRDT' })])],
      ctx,
    );
    expect(out[0].amountCents).toBe(150050);
  });

  it('joins SEPA reference fields into purposeRaw', () => {
    const out = FintsBookingMapper.toRawBookings([makeStatement([makeTx()])], ctx);
    const purpose = out[0].purposeRaw;
    expect(purpose).toContain('Spotify Premium 04/2026');
    expect(purpose).toContain('EREF+SP-2026-04');
    expect(purpose).toContain('MREF+M-ABC-001');
  });

  it('omits KREF when customerReference equals e2eReference', () => {
    const out = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx({ customerReference: 'SP-2026-04' })])],
      ctx,
    );
    expect(out[0].purposeRaw).not.toContain('KREF+');
  });

  it('falls back to customerReference when e2eReference is missing', () => {
    const out = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx({ e2eReference: undefined, customerReference: 'CUST-9' })])],
      ctx,
    );
    expect(out[0].bankTxId).toBe('CUST-9');
  });

  it('emits undefined for bankTxId when neither reference is set', () => {
    const out = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx({ e2eReference: undefined, customerReference: '' })])],
      ctx,
    );
    expect(out[0].bankTxId).toBeUndefined();
  });

  it('uses statement.closingBalance.currency when present', () => {
    const stmt: Statement = {
      ...makeStatement([makeTx()]),
      closingBalance: { date: new Date(), currency: 'CHF', value: 0 },
    };
    const out = FintsBookingMapper.toRawBookings([stmt], ctx);
    expect(out[0].currency).toBe('CHF');
  });

  it('handles multiple statements in one mapping call', () => {
    const out = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx(), makeTx()]), makeStatement([makeTx()])],
      ctx,
    );
    expect(out).toHaveLength(3);
  });

  it('rounds sub-cent amounts to the nearest integer cent', () => {
    // 19.991 → 1999.1 cents → rounds to 1999
    const out1 = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx({ amount: -19.991 })])],
      ctx,
    );
    expect(out1[0].amountCents).toBe(-1999);

    // 19.996 → 1999.6 cents → rounds to 2000
    const out2 = FintsBookingMapper.toRawBookings(
      [makeStatement([makeTx({ amount: -19.996 })])],
      ctx,
    );
    expect(out2[0].amountCents).toBe(-2000);
  });
});

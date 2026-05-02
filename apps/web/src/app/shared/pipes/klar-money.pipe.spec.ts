import { describe, it, expect } from 'vitest';
import { KlarMoneyPipe } from './klar-money.pipe';

const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

describe('KlarMoneyPipe', () => {
  const pipe = new KlarMoneyPipe();

  it('formats positive cents as EUR with German locale', () => {
    expect(pipe.transform(150000)).toBe(fmt.format(1500));
  });

  it('formats negative cents as EUR', () => {
    expect(pipe.transform(-5099)).toBe(fmt.format(-50.99));
  });

  it('formats zero', () => {
    expect(pipe.transform(0)).toBe(fmt.format(0));
  });
});

import { describe, it, expect } from 'vitest';
import { KlarMoneyClassPipe } from './klar-money-class.pipe';

describe('KlarMoneyClassPipe', () => {
  const pipe = new KlarMoneyClassPipe();

  it('returns text-success for positive amount', () => {
    expect(pipe.transform(5000)).toBe('text-success');
  });

  it('returns text-danger for negative amount', () => {
    expect(pipe.transform(-5000)).toBe('text-danger');
  });

  it('returns text-muted-foreground for zero', () => {
    expect(pipe.transform(0)).toBe('text-muted-foreground');
  });
});

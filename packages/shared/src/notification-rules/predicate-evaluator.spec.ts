import { describe, it, expect, vi } from 'vitest';
import { evaluatePredicate, applyOperator } from './predicate-evaluator';
import type { Predicate } from './predicate-types';

describe('applyOperator', () => {
  it.each([
    ['=', 5, 5, true],
    ['=', 5, '5', true],
    ['!=', 5, 6, true],
    ['>', 10, 5, true],
    ['>=', 5, 5, true],
    ['<', 5, 10, true],
    ['<=', 5, 5, true],
  ])('numeric %s: %s vs %s → %s', (op, l, r, expected) => {
    expect(applyOperator(l, op as never, r)).toBe(expected);
  });

  it('in / notIn', () => {
    expect(applyOperator('a', 'in', ['a', 'b'])).toBe(true);
    expect(applyOperator('c', 'in', ['a', 'b'])).toBe(false);
    expect(applyOperator('c', 'notIn', ['a', 'b'])).toBe(true);
  });

  it('contains / startsWith are case-insensitive', () => {
    expect(applyOperator('Gehalt August', 'contains', 'gehalt')).toBe(true);
    expect(applyOperator('Gehalt August', 'startsWith', 'gehalt')).toBe(true);
    expect(applyOperator('Miete', 'contains', 'gehalt')).toBe(false);
  });

  it('matches uses regex, broken patterns fall through to false', () => {
    expect(applyOperator('abc123', 'matches', '^[a-z]+\\d+$')).toBe(true);
    expect(applyOperator('abc', 'matches', '[')).toBe(false);
  });

  it('comparisons with null return false (except equality)', () => {
    expect(applyOperator(null, '=', null)).toBe(true);
    expect(applyOperator(null, '>', 5)).toBe(false);
    expect(applyOperator('x', 'contains', null)).toBe(false);
  });
});

describe('evaluatePredicate', () => {
  const ctx = {
    amountCents: 250000,
    categoryId: 'cat_salary',
    counterpartyName: 'Arbeitgeber GmbH',
    kind: 'TRANSFER',
  };

  it('returns true for a trivial cmp match', async () => {
    const p: Predicate = { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 };
    await expect(evaluatePredicate(p, ctx)).resolves.toBe(true);
  });

  it('and: short-circuits on first false', async () => {
    const p: Predicate = {
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '<', value: 0 },
        { op: 'cmp', field: 'categoryId', operator: '=', value: 'cat_salary' },
      ],
    };
    await expect(evaluatePredicate(p, ctx)).resolves.toBe(false);
  });

  it('or: short-circuits on first true', async () => {
    const p: Predicate = {
      op: 'or',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '<', value: 0 },
        { op: 'cmp', field: 'counterpartyName', operator: 'contains', value: 'arbeit' },
      ],
    };
    await expect(evaluatePredicate(p, ctx)).resolves.toBe(true);
  });

  it('not: inverts', async () => {
    const p: Predicate = {
      op: 'not',
      clause: { op: 'cmp', field: 'kind', operator: '=', value: 'CARD' },
    };
    await expect(evaluatePredicate(p, ctx)).resolves.toBe(true);
  });

  it('nested and/or evaluates correctly', async () => {
    const p: Predicate = {
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 },
        {
          op: 'or',
          clauses: [
            { op: 'cmp', field: 'categoryId', operator: '=', value: 'cat_salary' },
            { op: 'cmp', field: 'counterpartyName', operator: 'contains', value: 'bonus' },
          ],
        },
      ],
    };
    await expect(evaluatePredicate(p, ctx)).resolves.toBe(true);
  });

  it('resolves aggregation values via the supplied resolver', async () => {
    const resolveAggregation = vi.fn().mockResolvedValue(50000);
    const p: Predicate = {
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: { aggregation: { type: 'accountBalance', accountId: 'acc_main' } },
    };
    await expect(
      evaluatePredicate(p, ctx, { resolveAggregation }),
    ).resolves.toBe(true);
    expect(resolveAggregation).toHaveBeenCalledOnce();
  });

  it('throws when an aggregation is referenced without a resolver', async () => {
    const p: Predicate = {
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: { aggregation: { type: 'accountBalance', accountId: 'x' } },
    };
    await expect(evaluatePredicate(p, ctx)).rejects.toThrow(/no resolver/i);
  });
});

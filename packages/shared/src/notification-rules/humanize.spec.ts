import { describe, it, expect } from 'vitest';
import { humanizePredicate } from './humanize';
import type { Predicate } from './predicate-types';

describe('humanizePredicate (TRANSACTION_CREATED)', () => {
  it('renders a simple money comparison with the field label and formatted euro value', () => {
    const p: Predicate = {
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: 100000,
    };
    const out = humanizePredicate(p, { trigger: 'TRANSACTION_CREATED' });
    expect(out).toBe('Betrag (Cent) größer als 1.000,00 €');
  });

  it('uses friendly labels for id values from the labels map', () => {
    const p: Predicate = {
      op: 'cmp',
      field: 'categoryId',
      operator: '=',
      value: 'cat_salary',
    };
    const out = humanizePredicate(p, {
      trigger: 'TRANSACTION_CREATED',
      labels: { cat_salary: 'Gehalt' },
    });
    expect(out).toBe('Kategorie ist Gehalt');
  });

  it('joins AND clauses without outer parens at the top level', () => {
    const p: Predicate = {
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 },
        { op: 'cmp', field: 'categoryId', operator: '=', value: 'cat_salary' },
      ],
    };
    const out = humanizePredicate(p, {
      trigger: 'TRANSACTION_CREATED',
      labels: { cat_salary: 'Gehalt' },
    });
    expect(out).toBe('Betrag (Cent) größer als 1.000,00 € UND Kategorie ist Gehalt');
  });

  it('wraps nested OR clauses in parens when inside an AND', () => {
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
    const out = humanizePredicate(p, {
      trigger: 'TRANSACTION_CREATED',
      labels: { cat_salary: 'Gehalt' },
    });
    expect(out).toContain(
      '(Kategorie ist Gehalt ODER Gegenkonto-Name enthält "bonus")',
    );
  });

  it('renders NOT with parens around the inner predicate', () => {
    const p: Predicate = {
      op: 'not',
      clause: { op: 'cmp', field: 'kind', operator: '=', value: 'CARD' },
    };
    expect(humanizePredicate(p, { trigger: 'TRANSACTION_CREATED' })).toBe(
      'NICHT (Transaktions-Art ist "CARD")',
    );
  });

  it('renders aggregation values with a friendly description', () => {
    const p: Predicate = {
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: {
        aggregation: { type: 'sumAmount', window: 'last30d', kind: 'expense' },
      },
    };
    expect(humanizePredicate(p, { trigger: 'TRANSACTION_CREATED' })).toContain(
      'Summe Ausgaben (letzte 30 Tage)',
    );
  });
});

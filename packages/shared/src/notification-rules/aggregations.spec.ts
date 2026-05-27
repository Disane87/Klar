import { describe, it, expect } from 'vitest';
import {
  TRIGGER_FIELDS,
  getTriggerFieldSpec,
  isOperatorAllowedForField,
  validatePredicateFields,
  collectCmpNodes,
} from './aggregations';
import type { Predicate } from './predicate-types';

describe('TRIGGER_FIELDS', () => {
  it('exposes a non-empty whitelist for every event-based trigger', () => {
    expect(TRIGGER_FIELDS.TRANSACTION_CREATED.length).toBeGreaterThan(0);
    expect(TRIGGER_FIELDS.STANDING_ORDER_DUE.length).toBeGreaterThan(0);
    expect(TRIGGER_FIELDS.BUDGET_THRESHOLD.length).toBeGreaterThan(0);
    expect(TRIGGER_FIELDS.FINTS_SYNC_EVENT.length).toBeGreaterThan(0);
  });

  it('SCHEDULED has no event-context fields — predicate must use aggregations', () => {
    expect(TRIGGER_FIELDS.SCHEDULED).toEqual([]);
  });

  it('every field name within a trigger is unique', () => {
    for (const [trigger, fields] of Object.entries(TRIGGER_FIELDS)) {
      const names = fields.map(f => f.field);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('getTriggerFieldSpec', () => {
  it('returns the spec for a known field', () => {
    const spec = getTriggerFieldSpec('TRANSACTION_CREATED', 'amountCents');
    expect(spec?.kind).toBe('money');
  });

  it('returns undefined for an unknown field', () => {
    expect(getTriggerFieldSpec('TRANSACTION_CREATED', 'bogus')).toBeUndefined();
  });
});

describe('isOperatorAllowedForField', () => {
  it('approves a whitelisted (field, operator) pair', () => {
    expect(isOperatorAllowedForField('TRANSACTION_CREATED', 'amountCents', '>')).toBe(true);
  });

  it('rejects an operator not on the field whitelist', () => {
    expect(isOperatorAllowedForField('TRANSACTION_CREATED', 'amountCents', 'contains')).toBe(false);
  });

  it('rejects any operator for an unknown field', () => {
    expect(isOperatorAllowedForField('TRANSACTION_CREATED', 'bogus', '=')).toBe(false);
  });
});

describe('validatePredicateFields', () => {
  it('returns no errors for a whitelisted predicate', () => {
    const p: Predicate = {
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 },
        { op: 'cmp', field: 'categoryId', operator: '=', value: 'cat_x' },
      ],
    };
    expect(validatePredicateFields('TRANSACTION_CREATED', p)).toEqual([]);
  });

  it('flags an unknown field', () => {
    const p: Predicate = { op: 'cmp', field: 'bogus', operator: '=', value: 'x' };
    const errors = validatePredicateFields('TRANSACTION_CREATED', p);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/bogus/);
  });

  it('flags an operator not allowed for the field', () => {
    const p: Predicate = {
      op: 'cmp',
      field: 'amountCents',
      operator: 'contains',
      value: 'x',
    };
    const errors = validatePredicateFields('TRANSACTION_CREATED', p);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/operator/i);
  });

  it('walks nested and/or/not nodes', () => {
    const p: Predicate = {
      op: 'or',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '>', value: 100 },
        {
          op: 'not',
          clause: { op: 'cmp', field: 'bogus', operator: '=', value: 'x' },
        },
      ],
    };
    expect(validatePredicateFields('TRANSACTION_CREATED', p)).toHaveLength(1);
  });

  it('rejects every field for the SCHEDULED trigger (no event context)', () => {
    const p: Predicate = {
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: 0,
    };
    expect(validatePredicateFields('SCHEDULED', p)).toHaveLength(1);
  });
});

describe('collectCmpNodes', () => {
  it('flattens a predicate tree into its cmp leaves', () => {
    const p: Predicate = {
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'a', operator: '=', value: 1 },
        {
          op: 'or',
          clauses: [
            { op: 'cmp', field: 'b', operator: '>', value: 2 },
            { op: 'not', clause: { op: 'cmp', field: 'c', operator: '!=', value: 3 } },
          ],
        },
      ],
    };
    const nodes = collectCmpNodes(p);
    expect(nodes.map(n => n.field)).toEqual(['a', 'b', 'c']);
  });
});

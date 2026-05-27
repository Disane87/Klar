/**
 * Pure predicate evaluator. The same function runs on the backend (live event
 * dispatch) and on the frontend (live-preview "would have fired" against the
 * last 90 days). No side effects, no I/O — aggregation results are passed in
 * via a callback so the host can resolve them lazily and memoise per
 * evaluation.
 */

import type { CmpPredicate, ComparisonOperator, Predicate } from './predicate-types';

export type EventContext = Record<string, unknown>;

export interface AggregationKey {
  /** Stable JSON-serialised representation of the AggregationSpec. */
  cacheKey: string;
  /** The original spec — host uses this to do the actual lookup. */
  spec: unknown;
}

export type AggregationResolver = (
  spec: unknown,
) => number | string | boolean | null | Promise<number | string | boolean | null>;

export interface EvaluateOptions {
  /**
   * Lazily resolves an aggregation. Implementations typically memoise per
   * evaluation to avoid duplicate DB queries when the same aggregation
   * appears multiple times in one predicate tree.
   */
  resolveAggregation?: AggregationResolver;
}

export async function evaluatePredicate(
  predicate: Predicate,
  ctx: EventContext,
  opts: EvaluateOptions = {},
): Promise<boolean> {
  switch (predicate.op) {
    case 'and': {
      for (const c of predicate.clauses) {
        if (!(await evaluatePredicate(c, ctx, opts))) return false;
      }
      return true;
    }
    case 'or': {
      for (const c of predicate.clauses) {
        if (await evaluatePredicate(c, ctx, opts)) return true;
      }
      return false;
    }
    case 'not':
      return !(await evaluatePredicate(predicate.clause, ctx, opts));
    case 'cmp':
      return evaluateCmp(predicate, ctx, opts);
  }
}

async function evaluateCmp(
  node: CmpPredicate,
  ctx: EventContext,
  opts: EvaluateOptions,
): Promise<boolean> {
  const left = ctx[node.field];
  const right = await resolveValue(node.value, opts);
  return applyOperator(left, node.operator, right);
}

async function resolveValue(
  value: CmpPredicate['value'],
  opts: EvaluateOptions,
): Promise<unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'aggregation' in value) {
    if (!opts.resolveAggregation) {
      throw new Error('Aggregation referenced but no resolver provided');
    }
    return opts.resolveAggregation(value.aggregation);
  }
  return value;
}

export function applyOperator(
  left: unknown,
  operator: ComparisonOperator,
  right: unknown,
): boolean {
  switch (operator) {
    case '=':
      return looseEquals(left, right);
    case '!=':
      return !looseEquals(left, right);
    case '>':
      return compareNumbers(left, right) > 0;
    case '>=':
      return compareNumbers(left, right) >= 0;
    case '<':
      return compareNumbers(left, right) < 0;
    case '<=':
      return compareNumbers(left, right) <= 0;
    case 'in': {
      if (!Array.isArray(right)) return false;
      return right.some(item => looseEquals(left, item));
    }
    case 'notIn': {
      if (!Array.isArray(right)) return true;
      return !right.some(item => looseEquals(left, item));
    }
    case 'contains': {
      if (left == null || right == null) return false;
      return String(left).toLowerCase().includes(String(right).toLowerCase());
    }
    case 'startsWith': {
      if (left == null || right == null) return false;
      return String(left).toLowerCase().startsWith(String(right).toLowerCase());
    }
    case 'matches': {
      if (left == null || right == null) return false;
      try {
        const re = new RegExp(String(right), 'i');
        return re.test(String(left));
      } catch {
        return false;
      }
    }
  }
}

function looseEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left === 'number' && typeof right === 'string') {
    return left === Number(right);
  }
  if (typeof right === 'number' && typeof left === 'string') {
    return right === Number(left);
  }
  return String(left) === String(right);
}

function compareNumbers(left: unknown, right: unknown): number {
  const l = toNumber(left);
  const r = toNumber(right);
  if (l === null || r === null) return Number.NaN;
  return l - r;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

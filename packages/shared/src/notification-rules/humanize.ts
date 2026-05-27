/**
 * Renders a Predicate into a human-readable German sentence for the rule
 * list ("Wenn Eingang > 1.000 € und Kategorie = Gehalt"). Frontend-only
 * concern but lives in shared so rule activity / fire history can render
 * the same string on the server side too.
 *
 * Label resolution accepts an optional lookup map: callers pass in
 * category/account/project names so an `id` value renders as the friendly
 * name instead of a cuid.
 */

import type {
  AggregationSpec,
  ComparisonOperator,
  Predicate,
  TriggerFieldSpec,
} from './predicate-types';
import { TRIGGER_FIELDS } from './aggregations';
import type { NotificationTrigger } from './predicate-types';

export interface HumanizeContext {
  trigger: NotificationTrigger;
  /** id → display name (categories, accounts, projects). */
  labels?: Record<string, string>;
}

const OPERATOR_DE: Record<ComparisonOperator, string> = {
  '=': 'ist',
  '!=': 'ist nicht',
  '>': 'größer als',
  '>=': 'mindestens',
  '<': 'kleiner als',
  '<=': 'höchstens',
  in: 'einer von',
  notIn: 'keiner von',
  contains: 'enthält',
  startsWith: 'beginnt mit',
  matches: 'entspricht (Regex)',
};

export function humanizePredicate(
  predicate: Predicate,
  ctx: HumanizeContext,
): string {
  return renderNode(predicate, ctx, /* top */ true);
}

function renderNode(node: Predicate, ctx: HumanizeContext, top: boolean): string {
  switch (node.op) {
    case 'and':
      return joinClauses(node.clauses, ' UND ', ctx, top);
    case 'or':
      return joinClauses(node.clauses, ' ODER ', ctx, top);
    case 'not':
      return `NICHT (${renderNode(node.clause, ctx, false)})`;
    case 'cmp': {
      const spec = lookupFieldSpec(ctx.trigger, node.field);
      const fieldLabel = spec?.label ?? node.field;
      const op = OPERATOR_DE[node.operator];
      const value = renderValue(node.value, spec, ctx);
      return `${fieldLabel} ${op} ${value}`;
    }
  }
}

function joinClauses(
  clauses: Predicate[],
  separator: string,
  ctx: HumanizeContext,
  top: boolean,
): string {
  const parts = clauses.map(c => renderNode(c, ctx, false));
  if (parts.length === 1) return parts[0];
  const joined = parts.join(separator);
  return top ? joined : `(${joined})`;
}

function lookupFieldSpec(
  trigger: NotificationTrigger,
  field: string,
): TriggerFieldSpec | undefined {
  return TRIGGER_FIELDS[trigger].find(spec => spec.field === field);
}

function renderValue(
  value: unknown,
  spec: TriggerFieldSpec | undefined,
  ctx: HumanizeContext,
): string {
  if (value === null || value === undefined) return '∅';

  if (typeof value === 'object' && 'aggregation' in (value as object)) {
    const agg = (value as { aggregation: AggregationSpec }).aggregation;
    return renderAggregation(agg, ctx);
  }

  if (Array.isArray(value)) {
    return `[${value.map(v => renderScalar(v, spec, ctx)).join(', ')}]`;
  }

  return renderScalar(value, spec, ctx);
}

function renderScalar(
  v: unknown,
  spec: TriggerFieldSpec | undefined,
  ctx: HumanizeContext,
): string {
  if (typeof v === 'string' && ctx.labels && ctx.labels[v]) {
    return ctx.labels[v];
  }
  if (spec?.kind === 'money' && typeof v === 'number') {
    return formatMoney(v);
  }
  if (spec?.kind === 'percentage' && typeof v === 'number') {
    return `${v}%`;
  }
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

function renderAggregation(spec: AggregationSpec, ctx: HumanizeContext): string {
  switch (spec.type) {
    case 'accountBalance': {
      const name = ctx.labels?.[spec.accountId] ?? spec.accountId;
      return `Kontostand "${name}"`;
    }
    case 'sumAmount':
    case 'countTransactions': {
      const verb = spec.type === 'sumAmount' ? 'Summe' : 'Anzahl';
      const window = renderWindow(spec.window, spec.days);
      const kind =
        spec.kind === 'income'
          ? 'Eingänge'
          : spec.kind === 'expense'
            ? 'Ausgaben'
            : 'Buchungen';
      return `${verb} ${kind} (${window})`;
    }
    case 'budgetUsedPct': {
      const name = ctx.labels?.[spec.categoryId] ?? spec.categoryId;
      return `Budget-Auslastung "${name}" (%)`;
    }
    case 'upcomingStandingOrdersSum':
      return `Summe fälliger Daueraufträge (nächste ${spec.days} Tage)`;
    case 'upcomingStandingOrdersCount':
      return `Anzahl fälliger Daueraufträge (nächste ${spec.days} Tage)`;
  }
}

function renderWindow(window: string, days?: number): string {
  switch (window) {
    case 'thisMonth':
      return 'aktueller Monat';
    case 'last7d':
      return 'letzte 7 Tage';
    case 'last30d':
      return 'letzte 30 Tage';
    case 'customDays':
      return `letzte ${days ?? '?'} Tage`;
    default:
      return window;
  }
}

function formatMoney(cents: number): string {
  const euro = cents / 100;
  return `${euro.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

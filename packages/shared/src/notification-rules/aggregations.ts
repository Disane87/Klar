/**
 * Per-trigger field whitelists for the predicate builder.
 *
 * The same metadata is used by:
 *  - the frontend rule builder, to offer only valid (field, operator, value)
 *    combinations,
 *  - the backend validator, to reject any predicate that references a field
 *    outside its trigger's whitelist (defence in depth — never trust the
 *    client to behave),
 *  - the predicate evaluator, to know which event-context fields exist and
 *    which must come from an aggregation.
 */

import type {
  ComparisonOperator,
  NotificationTrigger,
  Predicate,
  TriggerFieldSpec,
} from './predicate-types';

const NUMERIC: ReadonlyArray<ComparisonOperator> = [
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  'notIn',
];
const TEXT: ReadonlyArray<ComparisonOperator> = [
  '=',
  '!=',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'matches',
];
const ID: ReadonlyArray<ComparisonOperator> = ['=', '!=', 'in', 'notIn'];
const ENUM: ReadonlyArray<ComparisonOperator> = ['=', '!=', 'in', 'notIn'];
const DATE: ReadonlyArray<ComparisonOperator> = ['=', '!=', '>', '>=', '<', '<='];

const TX_KIND_ENUM = [
  'STANDING_ORDER',
  'DIRECT_DEBIT',
  'TRANSFER',
  'CARD',
  'FEE',
  'OTHER',
] as const;

const FINTS_EVENT_ENUM = [
  'SYNC_STARTED',
  'SYNC_FINISHED',
  'SYNC_FAILED',
  'REAUTH_REQUIRED',
  'REAUTH_WARNING',
  'BALANCE_DRIFT',
] as const;

const SCHEDULE_FIELDS: ReadonlyArray<TriggerFieldSpec> = [];

const TRANSACTION_CREATED_FIELDS: ReadonlyArray<TriggerFieldSpec> = [
  { field: 'amountCents', label: 'Betrag (Cent)', kind: 'money', operators: NUMERIC },
  {
    field: 'kind',
    label: 'Transaktions-Art',
    kind: 'enum',
    operators: ENUM,
    enumValues: TX_KIND_ENUM,
  },
  {
    field: 'categoryId',
    label: 'Kategorie',
    kind: 'id',
    operators: ID,
    pickerKind: 'category',
  },
  {
    field: 'projectId',
    label: 'Projekt',
    kind: 'id',
    operators: ID,
    pickerKind: 'project',
  },
  {
    field: 'accountId',
    label: 'Konto',
    kind: 'id',
    operators: ID,
    pickerKind: 'account',
  },
  { field: 'counterparty', label: 'Gegenkonto / Empfänger', kind: 'string', operators: TEXT },
  { field: 'description', label: 'Verwendungszweck', kind: 'string', operators: TEXT },
  { field: 'bookingText', label: 'Buchungstext (Bank)', kind: 'string', operators: TEXT },
  { field: 'date', label: 'Buchungsdatum', kind: 'date', operators: DATE },
  { field: 'isIncome', label: 'Ist Einnahme', kind: 'boolean', operators: ['=', '!='] },
];

const STANDING_ORDER_DUE_FIELDS: ReadonlyArray<TriggerFieldSpec> = [
  { field: 'amountCents', label: 'Betrag (Cent)', kind: 'money', operators: NUMERIC },
  { field: 'name', label: 'Dauerauftrag-Name', kind: 'string', operators: TEXT },
  {
    field: 'categoryId',
    label: 'Kategorie',
    kind: 'id',
    operators: ID,
    pickerKind: 'category',
  },
  {
    field: 'accountId',
    label: 'Konto',
    kind: 'id',
    operators: ID,
    pickerKind: 'account',
  },
  { field: 'dueDate', label: 'Fälligkeitsdatum', kind: 'date', operators: DATE },
  {
    field: 'daysUntilDue',
    label: 'Tage bis Fälligkeit',
    kind: 'integer',
    operators: NUMERIC,
  },
];

const BUDGET_THRESHOLD_FIELDS: ReadonlyArray<TriggerFieldSpec> = [
  {
    field: 'categoryId',
    label: 'Kategorie',
    kind: 'id',
    operators: ID,
    pickerKind: 'category',
  },
  { field: 'month', label: 'Monat', kind: 'string', operators: TEXT },
  { field: 'usedCents', label: 'Verbraucht (Cent)', kind: 'money', operators: NUMERIC },
  { field: 'limitCents', label: 'Limit (Cent)', kind: 'money', operators: NUMERIC },
  { field: 'usedPct', label: 'Verbraucht (%)', kind: 'percentage', operators: NUMERIC },
];

const FINTS_SYNC_EVENT_FIELDS: ReadonlyArray<TriggerFieldSpec> = [
  {
    field: 'eventType',
    label: 'Ereignistyp',
    kind: 'enum',
    operators: ENUM,
    enumValues: FINTS_EVENT_ENUM,
  },
  { field: 'connectionId', label: 'FinTS-Verbindung', kind: 'id', operators: ID },
  { field: 'bankName', label: 'Bank', kind: 'string', operators: TEXT },
  { field: 'errorMessage', label: 'Fehlertext', kind: 'string', operators: TEXT },
];

export const TRIGGER_FIELDS: Record<NotificationTrigger, ReadonlyArray<TriggerFieldSpec>> = {
  TRANSACTION_CREATED: TRANSACTION_CREATED_FIELDS,
  STANDING_ORDER_DUE: STANDING_ORDER_DUE_FIELDS,
  BUDGET_THRESHOLD: BUDGET_THRESHOLD_FIELDS,
  FINTS_SYNC_EVENT: FINTS_SYNC_EVENT_FIELDS,
  SCHEDULED: SCHEDULE_FIELDS,
};

export function getTriggerFieldSpec(
  trigger: NotificationTrigger,
  field: string,
): TriggerFieldSpec | undefined {
  return TRIGGER_FIELDS[trigger].find(spec => spec.field === field);
}

export function isOperatorAllowedForField(
  trigger: NotificationTrigger,
  field: string,
  operator: ComparisonOperator,
): boolean {
  const spec = getTriggerFieldSpec(trigger, field);
  if (!spec) return false;
  return spec.operators.includes(operator);
}

/**
 * Validate a predicate against a trigger's field whitelist. Returns the set of
 * violations (empty array = valid). Aggregations are allowed in cmp.value
 * even if the field isn't whitelisted as long as the field itself is valid
 * for the trigger.
 *
 * SCHEDULED rules have no event-context fields, so every cmp inside a
 * scheduled rule's predicate MUST use an aggregation on the value side.
 */
export function validatePredicateFields(
  trigger: NotificationTrigger,
  predicate: Predicate,
): string[] {
  const errors: string[] = [];
  walk(predicate, node => {
    if (node.op !== 'cmp') return;
    const spec = getTriggerFieldSpec(trigger, node.field);
    if (!spec) {
      errors.push(
        `Field "${node.field}" is not valid for trigger "${trigger}"`,
      );
      return;
    }
    if (!spec.operators.includes(node.operator)) {
      errors.push(
        `Operator "${node.operator}" is not allowed for field "${node.field}"`,
      );
    }
  });
  return errors;
}

function walk(node: Predicate, visit: (n: Predicate) => void): void {
  visit(node);
  if (node.op === 'and' || node.op === 'or') {
    for (const c of node.clauses) walk(c, visit);
  } else if (node.op === 'not') {
    walk(node.clause, visit);
  }
}

/** Collect every cmp node from a predicate (depth-first, left-to-right). */
export function collectCmpNodes(
  predicate: Predicate,
): Array<{ field: string; operator: ComparisonOperator }> {
  const out: Array<{ field: string; operator: ComparisonOperator }> = [];
  walk(predicate, n => {
    if (n.op === 'cmp') out.push({ field: n.field, operator: n.operator });
  });
  return out;
}

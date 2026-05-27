/**
 * Predicate AST for the notification rules engine.
 *
 * A `Predicate` is a tree of and/or/not nodes that bottom out in `cmp`
 * comparisons. Each `cmp` operates on a field that must be whitelisted for
 * the rule's trigger (see `aggregations.ts`). Values may be literals or
 * a deferred `AggregationSpec` whose result is resolved lazily by the
 * predicate evaluator.
 *
 * The same AST is validated on the backend (rule create/update via zod)
 * and built on the frontend (recursive predicate builder), guaranteeing
 * shape parity without a separate IDL.
 */

import { z } from 'zod';

export const COMPARISON_OPERATORS = [
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'matches',
] as const;

export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const NOTIFICATION_TRIGGERS = [
  'TRANSACTION_CREATED',
  'STANDING_ORDER_DUE',
  'BUDGET_THRESHOLD',
  'FINTS_SYNC_EVENT',
  'SCHEDULED',
] as const;

export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'WEB_PUSH', 'EMAIL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DIGEST_MODES = ['IMMEDIATE', 'HOURLY', 'DAILY'] as const;
export type DigestMode = (typeof DIGEST_MODES)[number];

// ─────────────────────────────────────────────
// Aggregations
// ─────────────────────────────────────────────

export const AGGREGATION_WINDOWS = [
  'thisMonth',
  'last7d',
  'last30d',
  'customDays',
] as const;
export type AggregationWindow = (typeof AGGREGATION_WINDOWS)[number];

export const AGGREGATION_KINDS = ['income', 'expense', 'all'] as const;
export type AggregationKind = (typeof AGGREGATION_KINDS)[number];

const accountBalanceAggregation = z.object({
  type: z.literal('accountBalance'),
  accountId: z.string().min(1),
});

const sumOrCountAggregation = z.object({
  type: z.union([z.literal('sumAmount'), z.literal('countTransactions')]),
  window: z.enum(AGGREGATION_WINDOWS),
  days: z.number().int().positive().max(3650).optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  projectIds: z.array(z.string().min(1)).optional(),
  counterpartyMatch: z.string().min(1).optional(),
  kind: z.enum(AGGREGATION_KINDS).optional(),
});

const budgetUsedPctAggregation = z.object({
  type: z.literal('budgetUsedPct'),
  categoryId: z.string().min(1),
  month: z.literal('current').optional(),
});

const upcomingStandingOrdersSumAggregation = z.object({
  type: z.literal('upcomingStandingOrdersSum'),
  days: z.number().int().positive().max(365),
});

const upcomingStandingOrdersCountAggregation = z.object({
  type: z.literal('upcomingStandingOrdersCount'),
  days: z.number().int().positive().max(365),
});

export const aggregationSpecSchema = z.union([
  accountBalanceAggregation,
  sumOrCountAggregation,
  budgetUsedPctAggregation,
  upcomingStandingOrdersSumAggregation,
  upcomingStandingOrdersCountAggregation,
]);

export type AggregationSpec = z.infer<typeof aggregationSpecSchema>;

// ─────────────────────────────────────────────
// Predicate
// ─────────────────────────────────────────────

const literalValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
  z.null(),
]);

const aggregationValue = z.object({ aggregation: aggregationSpecSchema });

const cmpValueSchema = z.union([literalValue, aggregationValue]);

export type CmpValue =
  | string
  | number
  | boolean
  | Array<string | number>
  | null
  | { aggregation: AggregationSpec };

export interface CmpPredicate {
  op: 'cmp';
  field: string;
  operator: ComparisonOperator;
  value: CmpValue;
}

export interface AndPredicate {
  op: 'and';
  clauses: Predicate[];
}

export interface OrPredicate {
  op: 'or';
  clauses: Predicate[];
}

export interface NotPredicate {
  op: 'not';
  clause: Predicate;
}

export type Predicate = CmpPredicate | AndPredicate | OrPredicate | NotPredicate;

export const predicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.object({
      op: z.literal('cmp'),
      field: z.string().min(1),
      operator: z.enum(COMPARISON_OPERATORS),
      value: cmpValueSchema,
    }),
    z.object({
      op: z.literal('and'),
      clauses: z.array(predicateSchema).min(1).max(50),
    }),
    z.object({
      op: z.literal('or'),
      clauses: z.array(predicateSchema).min(1).max(50),
    }),
    z.object({
      op: z.literal('not'),
      clause: predicateSchema,
    }),
  ]),
);

// ─────────────────────────────────────────────
// Schedule (only for SCHEDULED trigger)
// ─────────────────────────────────────────────

export const SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const scheduleSchema = z
  .object({
    type: z.enum(SCHEDULE_TYPES),
    time: z.string().regex(HHMM, 'Invalid HH:mm'),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'weekly' && value.dayOfWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfWeek is required for weekly schedule',
      });
    }
    if (value.type === 'monthly' && value.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfMonth is required for monthly schedule',
      });
    }
  });

export type Schedule = z.infer<typeof scheduleSchema>;

// ─────────────────────────────────────────────
// Trigger field metadata
// ─────────────────────────────────────────────

export type FieldKind =
  | 'money'
  | 'integer'
  | 'percentage'
  | 'string'
  | 'enum'
  | 'date'
  | 'id'
  | 'boolean';

export interface TriggerFieldSpec {
  field: string;
  label: string;
  kind: FieldKind;
  /** Subset of operators that are valid for this field. */
  operators: ReadonlyArray<ComparisonOperator>;
  /** Enum values when kind === 'enum'. */
  enumValues?: ReadonlyArray<string>;
  /** Whether the value control should resolve a category/account picker. */
  pickerKind?: 'category' | 'account' | 'project';
}

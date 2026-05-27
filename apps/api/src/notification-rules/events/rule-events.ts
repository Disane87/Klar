/**
 * Producer-side event payloads consumed by the RulesEngine.
 *
 * Each event carries enough context to evaluate every field on its
 * trigger's whitelist (see packages/shared/notification-rules/aggregations.ts).
 * Sensitive multi-tenant guard fields (householdId, ownerUserId, visibility)
 * are top-level so the engine can apply PRIVATE-skip without re-reading
 * the database.
 */
import type { Visibility } from '@prisma/client';

export const RULE_EVENT = {
  TRANSACTION_CREATED: 'rule.transaction.created',
  TRANSACTION_CREATED_BATCH: 'rule.transaction.created.batch',
  STANDING_ORDER_DUE: 'rule.standing-order.due',
  BUDGET_THRESHOLD: 'rule.budget.threshold',
  FINTS_SYNC_EVENT: 'rule.fints.sync',
} as const;

export interface TransactionCreatedEvent {
  /** Stable id used for idempotency (rule will not fire twice for the same tx). */
  transactionId: string;
  householdId: string;
  /** Owner of this transaction (null = pre-existing CSV rows without uploader). */
  ownerUserId: string | null;
  visibility: Visibility;
  /** Snapshot of the fields whitelisted for TRANSACTION_CREATED rules. */
  fields: TransactionEventFields;
}

export interface TransactionCreatedBatchEvent {
  householdId: string;
  source: 'csv-import' | 'fints-sync' | 'manual-bulk';
  events: TransactionCreatedEvent[];
}

export interface TransactionEventFields {
  amountCents: number;
  isIncome: boolean;
  /** From shared/standing-orders/detect-transaction-kind. */
  kind: string | null;
  categoryId: string | null;
  projectId: string | null;
  accountId: string;
  counterparty: string | null;
  description: string | null;
  bookingText: string | null;
  /** ISO YYYY-MM-DD. */
  date: string;
}

// ── STANDING_ORDER_DUE ─────────────────────────────────────────────────

export interface StandingOrderDueEvent {
  /** sourceId = `${standingOrderId}|${dueDate}` for idempotency across days. */
  sourceId: string;
  standingOrderId: string;
  householdId: string;
  /** Owner of the standing order (PRIVATE flag respects it). */
  ownerUserId: string | null;
  /** SHARED for now — standing orders are household-wide. */
  visibility: 'SHARED' | 'PRIVATE';
  fields: {
    amountCents: number;
    name: string;
    categoryId: string | null;
    accountId: string;
    /** ISO YYYY-MM-DD. */
    dueDate: string;
    /** Days from now until dueDate (0 = today, 1 = tomorrow). */
    daysUntilDue: number;
  };
}

// ── BUDGET_THRESHOLD ───────────────────────────────────────────────────

export interface BudgetThresholdEvent {
  /** sourceId = `${budgetId}|${month}|${threshold}` so each crossing fires once. */
  sourceId: string;
  budgetId: string;
  householdId: string;
  fields: {
    categoryId: string;
    /** YYYY-MM */
    month: string;
    usedCents: number;
    limitCents: number;
    /** 0–500 (over-budget can be > 100). */
    usedPct: number;
  };
}

// ── FINTS_SYNC_EVENT ───────────────────────────────────────────────────

export type FintsSyncEventType =
  | 'SYNC_STARTED'
  | 'SYNC_FINISHED'
  | 'SYNC_FAILED'
  | 'REAUTH_REQUIRED'
  | 'REAUTH_WARNING'
  | 'BALANCE_DRIFT';

export interface FintsSyncEvent {
  /** sourceId = `${syncRunId ?? connectionId}|${eventType}`. */
  sourceId: string;
  householdId: string;
  /** Owner of the connection. PRIVATE skip applies. */
  ownerUserId: string | null;
  fields: {
    eventType: FintsSyncEventType;
    connectionId: string;
    bankName: string | null;
    errorMessage: string | null;
  };
}

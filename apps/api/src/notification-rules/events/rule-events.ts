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

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { NotificationRule } from '@prisma/client';
import { Visibility } from '@prisma/client';
import {
  evaluatePredicate,
  type NotificationChannel,
  type Predicate,
} from '@klar/shared';
import { NotificationRulesRepository } from './notification-rules.repository';
import { InAppDispatcher } from './dispatchers/in-app.dispatcher';
import { WebPushDispatcher } from './dispatchers/web-push.dispatcher';
import { EmailDispatcher } from './dispatchers/email.dispatcher';
import { DigestQueueRepository, digestBucketKey } from './digest/digest-queue.repository';
import {
  RULE_EVENT,
  type BudgetThresholdEvent,
  type FintsSyncEvent,
  type StandingOrderDueEvent,
  type TransactionCreatedBatchEvent,
  type TransactionCreatedEvent,
} from './events/rule-events';

interface QuietHoursState {
  start: string;
  end: string;
  tz: string;
}

/**
 * The RulesEngine listens to producer events, evaluates every rule matching
 * the trigger, applies the throttle/quiet-hours/idempotency gates, and
 * dispatches to enabled channels.
 *
 * Phase 2 wires only `TRANSACTION_CREATED` and the in-app channel; later
 * phases (web push, email, digest, scheduled, additional triggers) bolt
 * onto the same evaluate() pipeline.
 */
@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    private readonly rules: NotificationRulesRepository,
    private readonly inApp: InAppDispatcher,
    private readonly webPush: WebPushDispatcher,
    private readonly email: EmailDispatcher,
    private readonly digestQueue: DigestQueueRepository,
  ) {}

  @OnEvent(RULE_EVENT.TRANSACTION_CREATED)
  async onTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    await this.evaluateTransactionEvent(event);
  }

  @OnEvent(RULE_EVENT.STANDING_ORDER_DUE)
  async onStandingOrderDue(event: StandingOrderDueEvent): Promise<void> {
    await this.evaluateGenericEvent({
      trigger: 'STANDING_ORDER_DUE',
      sourceKind: 'standing_order',
      sourceId: event.sourceId,
      householdId: event.householdId,
      ownerUserId: event.ownerUserId,
      visibility: event.visibility,
      fields: event.fields,
      formatBody: () => this.formatStandingOrderBody(event),
      deepLinkUrl: `/app/dauerauftraege?id=${event.standingOrderId}`,
    });
  }

  @OnEvent(RULE_EVENT.BUDGET_THRESHOLD)
  async onBudgetThreshold(event: BudgetThresholdEvent): Promise<void> {
    await this.evaluateGenericEvent({
      trigger: 'BUDGET_THRESHOLD',
      sourceKind: 'budget',
      sourceId: event.sourceId,
      householdId: event.householdId,
      ownerUserId: null,
      visibility: 'SHARED',
      fields: event.fields,
      formatBody: () => `${event.fields.usedPct}% von Budget erreicht`,
      deepLinkUrl: `/app/budgets?categoryId=${event.fields.categoryId}`,
    });
  }

  @OnEvent(RULE_EVENT.FINTS_SYNC_EVENT)
  async onFintsSyncEvent(event: FintsSyncEvent): Promise<void> {
    await this.evaluateGenericEvent({
      trigger: 'FINTS_SYNC_EVENT',
      sourceKind: 'fints_event',
      sourceId: event.sourceId,
      householdId: event.householdId,
      ownerUserId: event.ownerUserId,
      visibility: 'SHARED',
      fields: event.fields,
      formatBody: () => this.formatFintsBody(event),
      deepLinkUrl: `/app/banken/${event.fields.connectionId}`,
    });
  }

  @OnEvent(RULE_EVENT.TRANSACTION_CREATED_BATCH)
  async onTransactionCreatedBatch(batch: TransactionCreatedBatchEvent): Promise<void> {
    if (batch.events.length === 0) return;
    // Pre-fetch rules once per (trigger, household) and reuse for every event
    // in the batch — avoids N queries on a 500-row CSV import.
    const rules = await this.rules.findAll(batch.householdId, {
      trigger: 'TRANSACTION_CREATED',
      enabled: true,
    });
    for (const event of batch.events) {
      await this.evaluateTransactionEvent(event, rules);
    }
  }

  /** Dispatch a hand-crafted test notification through every enabled channel. */
  async dispatchTest(rule: NotificationRule): Promise<NotificationChannel[]> {
    const sent: NotificationChannel[] = [];
    let notificationId: string | null = null;
    if (rule.channels.includes('IN_APP')) {
      notificationId = await this.inApp.dispatch({
        rule,
        title: `Testbenachrichtigung: ${rule.name}`,
        body: 'Diese Test-Benachrichtigung wurde manuell ausgelöst.',
        payload: { test: true },
      });
      sent.push('IN_APP');
    }
    if (rule.channels.includes('WEB_PUSH') && this.webPush.isConfigured()) {
      await this.webPush.send(rule.userId, {
        title: `Testbenachrichtigung: ${rule.name}`,
        body: 'Diese Test-Benachrichtigung wurde manuell ausgelöst.',
        url: '/app/settings/notifications',
        tag: `rule:${rule.id}`,
        notificationId,
      });
      sent.push('WEB_PUSH');
    }
    if (rule.channels.includes('EMAIL')) {
      const ok = await this.email.sendImmediate(rule, {
        ruleName: rule.name,
        body: 'Diese Test-Benachrichtigung wurde manuell ausgelöst.',
        deepLinkUrl: '/app/settings/notifications',
      });
      if (ok) sent.push('EMAIL');
    }
    return sent;
  }

  private async evaluateTransactionEvent(
    event: TransactionCreatedEvent,
    prefetched?: NotificationRule[],
  ): Promise<void> {
    await this.evaluateGenericEvent({
      trigger: 'TRANSACTION_CREATED',
      sourceKind: 'transaction',
      sourceId: event.transactionId,
      householdId: event.householdId,
      ownerUserId: event.ownerUserId,
      visibility: event.visibility,
      fields: event.fields as unknown as Record<string, unknown>,
      formatBody: () => this.formatBody(event),
      deepLinkUrl: `/app/buchungen?tx=${event.transactionId}`,
      prefetched,
    });
  }

  /**
   * Generic evaluation pipeline shared by every trigger. Producers map
   * their event shape onto a `fields` record matching the trigger's
   * field whitelist + supply a sourceId for idempotency.
   */
  private async evaluateGenericEvent(input: {
    trigger: 'TRANSACTION_CREATED' | 'STANDING_ORDER_DUE' | 'BUDGET_THRESHOLD' | 'FINTS_SYNC_EVENT';
    sourceKind: string;
    sourceId: string;
    householdId: string;
    ownerUserId: string | null;
    visibility: 'SHARED' | 'PRIVATE';
    fields: Record<string, unknown>;
    formatBody: () => string;
    deepLinkUrl: string;
    prefetched?: NotificationRule[];
  }): Promise<void> {
    const rules =
      input.prefetched ??
      (await this.rules.findAll(input.householdId, {
        trigger: input.trigger,
        enabled: true,
      }));
    if (rules.length === 0) return;

    const ctx = input.fields;
    const now = new Date();
    const aggregationResolver = this.makeUnsupportedAggregationResolver();

    for (const rule of rules) {
      if (
        input.visibility === Visibility.PRIVATE &&
        input.ownerUserId !== null &&
        input.ownerUserId !== rule.userId
      ) {
        continue;
      }
      const fired = await this.rules.hasFired(rule.id, input.sourceKind, input.sourceId);
      if (fired) continue;

      // Throttle guard: cooldown, hourly cap, daily cap.
      if (this.isThrottled(rule, now)) continue;

      let matched: boolean;
      try {
        matched = await evaluatePredicate(
          rule.predicateJson as unknown as Predicate,
          ctx,
          { resolveAggregation: aggregationResolver },
        );
      } catch (err) {
        this.logger.warn(
          { err, ruleId: rule.id, sourceId: input.sourceId },
          'predicate evaluation failed; skipping',
        );
        continue;
      }
      if (!matched) continue;

      const channels = this.channelsAfterQuietHours(rule, now);
      if (channels.length === 0) continue;

      const channelsSent: NotificationChannel[] = [];
      let notificationId: string | null = null;
      const body = input.formatBody();
      try {
        if (channels.includes('IN_APP')) {
          notificationId = await this.inApp.dispatch({
            rule,
            title: rule.name,
            body,
            payload: {
              sourceKind: input.sourceKind,
              sourceId: input.sourceId,
              ...input.fields,
            },
          });
          channelsSent.push('IN_APP');
        }
        const immediate = rule.digestMode === 'IMMEDIATE';
        if (channels.includes('WEB_PUSH') && this.webPush.isConfigured()) {
          if (immediate) {
            const delivered = await this.webPush.send(rule.userId, {
              title: rule.name,
              body,
              url: input.deepLinkUrl,
              tag: `rule:${rule.id}`,
              notificationId,
            });
            if (delivered > 0) channelsSent.push('WEB_PUSH');
          } else {
            await this.digestQueue.enqueue({
              userId: rule.userId,
              channel: 'WEB_PUSH',
              ruleId: rule.id,
              bucketKey: digestBucketKey(rule.digestMode === 'HOURLY' ? 'HOURLY' : 'DAILY'),
              payload: { title: rule.name, body },
            });
          }
        }
        if (channels.includes('EMAIL')) {
          if (immediate) {
            const ok = await this.email.sendImmediate(rule, {
              ruleName: rule.name,
              body,
              deepLinkUrl: input.deepLinkUrl,
            });
            if (ok) channelsSent.push('EMAIL');
          } else {
            await this.digestQueue.enqueue({
              userId: rule.userId,
              channel: 'EMAIL',
              ruleId: rule.id,
              bucketKey: digestBucketKey(rule.digestMode === 'HOURLY' ? 'HOURLY' : 'DAILY'),
              payload: { title: rule.name, body },
            });
          }
        }

        await this.rules.recordFire({
          ruleId: rule.id,
          sourceKind: input.sourceKind,
          sourceId: input.sourceId,
          channelsSent,
          notificationId,
        });
        await this.rules.updateThrottleCounters(rule.id, now);
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          continue;
        }
        this.logger.error(
          { err, ruleId: rule.id, sourceId: input.sourceId },
          'rule dispatch failed',
        );
      }
    }
  }

  private formatStandingOrderBody(event: StandingOrderDueEvent): string {
    const abs = Math.abs(event.fields.amountCents) / 100;
    const eur = abs.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sign = event.fields.amountCents < 0 ? '−' : '+';
    const when =
      event.fields.daysUntilDue === 0
        ? 'heute'
        : event.fields.daysUntilDue === 1
          ? 'morgen'
          : `in ${event.fields.daysUntilDue} Tagen`;
    return `${sign}${eur} € · ${event.fields.name} — fällig ${when}`;
  }

  private formatFintsBody(event: FintsSyncEvent): string {
    const label =
      {
        SYNC_STARTED: 'Sync gestartet',
        SYNC_FINISHED: 'Sync erfolgreich',
        SYNC_FAILED: 'Sync fehlgeschlagen',
        REAUTH_REQUIRED: 'TAN-Bestätigung nötig',
        REAUTH_WARNING: 'TAN läuft bald ab',
        BALANCE_DRIFT: 'Saldo-Abweichung erkannt',
      }[event.fields.eventType] ?? event.fields.eventType;
    const bank = event.fields.bankName ?? event.fields.connectionId;
    return event.fields.errorMessage
      ? `${label}: ${bank} — ${event.fields.errorMessage}`
      : `${label}: ${bank}`;
  }

  private formatBody(event: TransactionCreatedEvent): string {
    const sign = event.fields.amountCents >= 0 ? '+' : '−';
    const abs = Math.abs(event.fields.amountCents) / 100;
    const eur = abs.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const cp = event.fields.counterparty ? ` · ${event.fields.counterparty}` : '';
    return `${sign}${eur} €${cp}`;
  }

  private isThrottled(rule: NotificationRule, now: Date): boolean {
    if (rule.cooldownMinutes && rule.lastFiredAt) {
      const next = rule.lastFiredAt.getTime() + rule.cooldownMinutes * 60_000;
      if (now.getTime() < next) return true;
    }
    if (rule.maxPerDay && rule.firedBucketDate && rule.firedCountToday >= rule.maxPerDay) {
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      if (
        rule.firedBucketDate.getUTCFullYear() === today.getUTCFullYear() &&
        rule.firedBucketDate.getUTCMonth() === today.getUTCMonth() &&
        rule.firedBucketDate.getUTCDate() === today.getUTCDate()
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Quiet-hours stub: future phase enriches with user-level
   * NotificationUserSettings. For Phase 2 we return all channels as-is.
   */
  private channelsAfterQuietHours(
    rule: NotificationRule,
    _now: Date,
  ): NotificationChannel[] {
    return rule.channels.filter(
      (c): c is NotificationChannel => c === 'IN_APP' || c === 'WEB_PUSH' || c === 'EMAIL',
    );
  }

  /**
   * Phase 2 has no aggregation providers yet — any predicate referencing
   * one is rejected at validation time, so this should be unreachable.
   * Throws explicitly to surface bugs if it ever runs.
   */
  private makeUnsupportedAggregationResolver(): (spec: unknown) => Promise<never> {
    return async () => {
      throw new Error('Aggregations not implemented in this phase');
    };
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }

  // QuietHoursState is reserved for the Phase 4 implementation but kept
  // imported via the type to avoid an unused-import dance during phase
  // hand-offs.
  private readonly _quietHoursStub: QuietHoursState | null = null;
}

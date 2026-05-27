import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RULE_EVENT,
  type StandingOrderDueEvent,
} from '../events/rule-events';

// Look-ahead window — covers every reasonable leadTimeDays predicate
// (a user setting `daysUntilDue <= 30` still gets emitted). Anything
// beyond 30 days is unlikely to be a useful reminder.
const LOOKAHEAD_DAYS = 30;

/**
 * Daily 06:00 cron — emits a STANDING_ORDER_DUE event for every standing
 * order with nextExpectedAt within the look-ahead window. Idempotency
 * (sourceId = `${standingOrderId}|${dueDate}`) ensures each (standing
 * order, due date) fires at most once across days, so rerunning the cron
 * on the same day is a no-op.
 */
@Injectable()
export class StandingOrderDueScheduler {
  private readonly logger = new Logger(StandingOrderDueScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron('0 6 * * *')
  async runDailyTick(): Promise<void> {
    await this.scan(new Date());
  }

  /** Exposed for unit testing — passes a deterministic reference date. */
  async scan(referenceDate: Date): Promise<number> {
    const startOfToday = new Date(Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ));
    const horizon = new Date(startOfToday);
    horizon.setUTCDate(horizon.getUTCDate() + LOOKAHEAD_DAYS);

    const due = await this.prisma.standingOrder.findMany({
      where: {
        isActive: true,
        nextExpectedAt: { gte: startOfToday, lte: horizon },
      },
    });
    if (due.length === 0) return 0;

    let emitted = 0;
    for (const so of due) {
      if (!so.nextExpectedAt) continue;
      const daysUntilDue = Math.max(
        0,
        Math.round((so.nextExpectedAt.getTime() - startOfToday.getTime()) / 86_400_000),
      );
      const isoDue = so.nextExpectedAt.toISOString().slice(0, 10);
      const event: StandingOrderDueEvent = {
        sourceId: `${so.id}|${isoDue}`,
        standingOrderId: so.id,
        householdId: so.householdId,
        ownerUserId: null,
        visibility: 'SHARED',
        fields: {
          amountCents: so.amountCents,
          name: so.counterpartyName ?? '(Dauerauftrag)',
          categoryId: so.categoryId ?? null,
          accountId: so.accountId,
          dueDate: isoDue,
          daysUntilDue,
        },
      };
      this.events.emit(RULE_EVENT.STANDING_ORDER_DUE, event);
      emitted += 1;
    }
    this.logger.log(`STANDING_ORDER_DUE: emitted ${emitted} events`);
    return emitted;
  }
}

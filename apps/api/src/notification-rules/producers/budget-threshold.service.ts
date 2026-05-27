import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RULE_EVENT,
  type BudgetThresholdEvent,
  type TransactionCreatedEvent,
} from '../events/rule-events';

/**
 * Watch budgets for threshold crossings. Called by TransactionsService
 * (and any other path that mutates Transaction rows). Emits at most one
 * event per `(budget, month, threshold)` thanks to the idempotency
 * sourceId — the next time the same threshold would fire, the engine
 * sees `hasFired === true` and skips.
 *
 * Thresholds fired: 50 / 80 / 100 / 120 % of the budget's amountCents.
 */
const THRESHOLDS = [50, 80, 100, 120] as const;

@Injectable()
export class BudgetThresholdService {
  private readonly logger = new Logger(BudgetThresholdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Hook on transaction creation — every Tx CUD is a potential threshold
   * crossing for the budget that covers its category + month.
   */
  @OnEvent(RULE_EVENT.TRANSACTION_CREATED)
  async onTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    if (!event.fields.categoryId || event.fields.amountCents >= 0) return;
    await this.checkForHouseholdMonth(event.householdId, event.fields.date);
  }

  /**
   * Recomputes usage for every budget on the household covering the
   * transaction's date. Emits an event per threshold currently crossed.
   * The engine's hasFired check guarantees no duplicate.
   */
  async checkForHouseholdMonth(householdId: string, isoDate: string): Promise<number> {
    const month = isoDate.slice(0, 7); // YYYY-MM
    const monthStart = new Date(`${month}-01T00:00:00Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const budgets = await this.prisma.budget.findMany({
      where: { householdId, month: monthStart },
    });
    if (budgets.length === 0) return 0;

    let emitted = 0;
    for (const budget of budgets) {
      if (!budget.amountCents || budget.amountCents <= 0) continue;
      const txs = await this.prisma.transaction.aggregate({
        where: {
          householdId,
          categoryId: budget.categoryId,
          isPlanned: false,
          date: { gte: monthStart, lt: nextMonth },
        },
        _sum: { amountCents: true },
      });
      // Expense budgets: spend is negative, take absolute.
      const usedCents = Math.abs(txs._sum.amountCents ?? 0);
      const usedPct = Math.round((usedCents / budget.amountCents) * 100);

      for (const t of THRESHOLDS) {
        if (usedPct >= t) {
          const event: BudgetThresholdEvent = {
            sourceId: `${budget.id}|${month}|${t}`,
            budgetId: budget.id,
            householdId,
            fields: {
              categoryId: budget.categoryId,
              month,
              usedCents,
              limitCents: budget.amountCents,
              usedPct,
            },
          };
          this.events.emit(RULE_EVENT.BUDGET_THRESHOLD, event);
          emitted += 1;
        }
      }
    }
    if (emitted > 0) {
      this.logger.log(`BUDGET_THRESHOLD: emitted ${emitted} threshold events for ${month}`);
    }
    return emitted;
  }
}

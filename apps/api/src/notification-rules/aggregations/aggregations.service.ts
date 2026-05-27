import { Injectable, Logger } from '@nestjs/common';
import type { AggregationSpec } from '@klar/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AggregationContext {
  householdId: string;
  /** Caller's userId — used to honour PRIVATE rows. */
  userId: string;
}

/**
 * Resolves AggregationSpec values for the predicate evaluator. Used by:
 *  - the live event path (engine evaluation),
 *  - the dry-run preview endpoint,
 *  - the scheduled cron evaluator.
 *
 * Aggregation results are scalars (number) — booleans and strings could
 * be added later if a new aggregation type needs them.
 */
@Injectable()
export class AggregationsService {
  private readonly logger = new Logger(AggregationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a memoised resolver suitable for one evaluation. Subsequent
   * calls with the same spec hit the cache, so a predicate using the
   * same `sumAmount` twice does not double-query.
   */
  makeResolver(ctx: AggregationContext): (spec: unknown) => Promise<number | null> {
    const cache = new Map<string, Promise<number | null>>();
    return spec => {
      const key = JSON.stringify(spec);
      const cached = cache.get(key);
      if (cached) return cached;
      const promise = this.resolveOne(ctx, spec as AggregationSpec).catch(err => {
        this.logger.warn({ err, spec }, 'aggregation resolve failed; returning null');
        return null;
      });
      cache.set(key, promise);
      return promise;
    };
  }

  async resolveOne(ctx: AggregationContext, spec: AggregationSpec): Promise<number | null> {
    switch (spec.type) {
      case 'accountBalance':
        return this.accountBalance(ctx, spec.accountId);
      case 'sumAmount':
        return this.sumAmount(ctx, spec);
      case 'countTransactions':
        return this.countTransactions(ctx, spec);
      case 'budgetUsedPct':
        return this.budgetUsedPct(ctx, spec.categoryId);
      case 'upcomingStandingOrdersSum':
        return this.upcomingStandingOrdersSum(ctx, spec.days);
      case 'upcomingStandingOrdersCount':
        return this.upcomingStandingOrdersCount(ctx, spec.days);
    }
  }

  // ── individual providers ────────────────────────────────────────────

  private async accountBalance(ctx: AggregationContext, accountId: string): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        householdId: ctx.householdId,
        accountId,
        isPlanned: false,
        OR: [{ visibility: 'SHARED' }, { createdByUserId: ctx.userId }],
      },
      _sum: { amountCents: true },
    });
    return result._sum.amountCents ?? 0;
  }

  private async sumAmount(
    ctx: AggregationContext,
    spec: Extract<AggregationSpec, { type: 'sumAmount' }>,
  ): Promise<number> {
    const { gte, lt } = this.windowRange(spec.window, spec.days);
    const where: Record<string, unknown> = {
      householdId: ctx.householdId,
      isPlanned: false,
      date: { gte, lt },
      OR: [{ visibility: 'SHARED' }, { createdByUserId: ctx.userId }],
    };
    if (spec.categoryIds?.length) where['categoryId'] = { in: spec.categoryIds };
    if (spec.projectIds?.length) where['projectId'] = { in: spec.projectIds };
    if (spec.counterpartyMatch) {
      where['counterparty'] = { contains: spec.counterpartyMatch, mode: 'insensitive' };
    }
    if (spec.kind === 'income') where['amountCents'] = { gt: 0 };
    if (spec.kind === 'expense') where['amountCents'] = { lt: 0 };
    const result = await this.prisma.transaction.aggregate({
      where: where as never,
      _sum: { amountCents: true },
    });
    return result._sum.amountCents ?? 0;
  }

  private async countTransactions(
    ctx: AggregationContext,
    spec: Extract<AggregationSpec, { type: 'countTransactions' }>,
  ): Promise<number> {
    const { gte, lt } = this.windowRange(spec.window, spec.days);
    const where: Record<string, unknown> = {
      householdId: ctx.householdId,
      isPlanned: false,
      date: { gte, lt },
      OR: [{ visibility: 'SHARED' }, { createdByUserId: ctx.userId }],
    };
    if (spec.categoryIds?.length) where['categoryId'] = { in: spec.categoryIds };
    if (spec.projectIds?.length) where['projectId'] = { in: spec.projectIds };
    return this.prisma.transaction.count({ where: where as never });
  }

  private async budgetUsedPct(ctx: AggregationContext, categoryId: string): Promise<number | null> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const budget = await this.prisma.budget.findFirst({
      where: { householdId: ctx.householdId, categoryId, month: monthStart },
    });
    if (!budget || !budget.amountCents) return null;
    const result = await this.prisma.transaction.aggregate({
      where: {
        householdId: ctx.householdId,
        categoryId,
        isPlanned: false,
        date: { gte: monthStart, lt: nextMonth },
      },
      _sum: { amountCents: true },
    });
    const used = Math.abs(result._sum.amountCents ?? 0);
    return Math.round((used / budget.amountCents) * 100);
  }

  private async upcomingStandingOrdersSum(
    ctx: AggregationContext,
    days: number,
  ): Promise<number> {
    const orders = await this.findUpcoming(ctx, days);
    return orders.reduce((s, so) => s + so.amountCents, 0);
  }

  private async upcomingStandingOrdersCount(
    ctx: AggregationContext,
    days: number,
  ): Promise<number> {
    const orders = await this.findUpcoming(ctx, days);
    return orders.length;
  }

  private findUpcoming(
    ctx: AggregationContext,
    days: number,
  ): Promise<Array<{ amountCents: number }>> {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + days);
    return this.prisma.standingOrder.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
        nextExpectedAt: { gte: today, lte: horizon },
      },
      select: { amountCents: true },
    });
  }

  private windowRange(window: string, days?: number): { gte: Date; lt: Date } {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (window === 'thisMonth') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { gte: start, lt: tomorrow };
    }
    const lookback =
      window === 'last7d'
        ? 7
        : window === 'last30d'
          ? 30
          : window === 'customDays'
            ? Math.max(1, Math.min(3650, days ?? 30))
            : 30;
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - lookback);
    return { gte: start, lt: tomorrow };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  NotificationRule,
  NotificationRuleFire,
  Visibility,
} from '@prisma/client';
import {
  evaluatePredicate,
  predicateSchema,
  scheduleSchema,
  validatePredicateFields,
  type NotificationChannel,
  type Predicate,
  type Schedule,
} from '@klar/shared';
import type { RequestContext } from '../common/types/request-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationRulesRepository } from './notification-rules.repository';
import { RulesEngineService } from './rules-engine.service';
import type { CreateNotificationRuleDto } from './dto/create-notification-rule.dto';
import type { UpdateNotificationRuleDto } from './dto/update-notification-rule.dto';
import type { PreviewNotificationRuleDto } from './dto/preview-notification-rule.dto';
import type { TransactionEventFields } from './events/rule-events';

const TRIGGER_FIELDS_FOR_TX = [
  'amountCents',
  'isIncome',
  'kind',
  'categoryId',
  'projectId',
  'accountId',
  'counterparty',
  'description',
  'bookingText',
  'date',
] as const;

@Injectable()
export class NotificationRulesService {
  constructor(
    private readonly repo: NotificationRulesRepository,
    private readonly engine: RulesEngineService,
    private readonly prisma: PrismaService,
  ) {}

  list(ctx: RequestContext): Promise<NotificationRule[]> {
    return this.repo.findAll(ctx.householdId, { userId: ctx.userId });
  }

  async findOne(ctx: RequestContext, id: string): Promise<NotificationRule> {
    const rule = await this.repo.findById(id, ctx.householdId);
    if (!rule || rule.userId !== ctx.userId) {
      throw new NotFoundException(`NotificationRule ${id} nicht gefunden`);
    }
    return rule;
  }

  async create(
    ctx: RequestContext,
    dto: CreateNotificationRuleDto,
  ): Promise<NotificationRule> {
    this.assertPredicate(dto.trigger, dto.predicate);
    this.assertChannels(dto.channels);
    const schedule = this.assertSchedule(dto.trigger, dto.schedule);

    return this.repo.create({
      householdId: ctx.householdId,
      userId: ctx.userId,
      name: dto.name,
      enabled: dto.enabled ?? true,
      trigger: dto.trigger,
      predicateJson: dto.predicate as unknown as object,
      scheduleJson: schedule ? (schedule as unknown as object) : null,
      leadTimeDays: dto.leadTimeDays ?? null,
      channels: dto.channels,
      digestMode: dto.digestMode ?? 'IMMEDIATE',
      cooldownMinutes: dto.cooldownMinutes ?? null,
      maxPerHour: dto.maxPerHour ?? null,
      maxPerDay: dto.maxPerDay ?? null,
    });
  }

  async update(
    ctx: RequestContext,
    id: string,
    dto: UpdateNotificationRuleDto,
  ): Promise<NotificationRule> {
    const existing = await this.findOne(ctx, id);

    const trigger = dto.trigger ?? existing.trigger;
    if (dto.predicate !== undefined) {
      this.assertPredicate(trigger, dto.predicate);
    }
    if (dto.channels !== undefined) {
      this.assertChannels(dto.channels);
    }
    const schedule =
      dto.schedule !== undefined || dto.trigger !== undefined
        ? this.assertSchedule(trigger, dto.schedule ?? (existing.scheduleJson as Schedule | null))
        : undefined;

    const updated = await this.repo.update(id, ctx.householdId, {
      name: dto.name,
      enabled: dto.enabled,
      trigger: dto.trigger,
      predicateJson:
        dto.predicate !== undefined ? (dto.predicate as unknown as object) : undefined,
      scheduleJson:
        schedule === undefined ? undefined : schedule ? (schedule as unknown as object) : null,
      leadTimeDays: dto.leadTimeDays,
      channels: dto.channels,
      digestMode: dto.digestMode,
      cooldownMinutes: dto.cooldownMinutes,
      maxPerHour: dto.maxPerHour,
      maxPerDay: dto.maxPerDay,
    });
    if (!updated) {
      throw new NotFoundException(`NotificationRule ${id} nicht gefunden`);
    }
    return updated;
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    await this.findOne(ctx, id);
    const ok = await this.repo.delete(id, ctx.householdId);
    if (!ok) throw new NotFoundException(`NotificationRule ${id} nicht gefunden`);
  }

  /**
   * Dry-run: evaluate the predicate against the last `days` (default 90) of
   * real transactions for this household, return match count + small sample.
   * Phase 2 supports only `TRANSACTION_CREATED`.
   */
  async preview(
    ctx: RequestContext,
    dto: PreviewNotificationRuleDto,
  ): Promise<{
    wouldHaveFiredCount: number;
    sample: Array<{ at: string; title: string; amountCents: number }>;
  }> {
    if (dto.trigger !== 'TRANSACTION_CREATED') {
      throw new BadRequestException(
        'Preview ist in dieser Phase nur für TRANSACTION_CREATED verfügbar',
      );
    }
    this.assertPredicate(dto.trigger, dto.predicate);
    const days = dto.days ?? 90;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const rows = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: { gte: since },
        OR: [
          { visibility: 'SHARED' as Visibility },
          { createdByUserId: ctx.userId },
        ],
      },
      orderBy: { date: 'desc' },
      take: 500, // hard cap — preview is not a report
    });

    const matches: Array<{ at: string; title: string; amountCents: number }> = [];
    for (const tx of rows) {
      const fields = this.txToFields(tx);
      const isMatch = await evaluatePredicate(
        dto.predicate,
        fields as unknown as Record<string, unknown>,
      ).catch(() => false);
      if (isMatch) {
        matches.push({
          at: tx.date.toISOString().slice(0, 10),
          title: tx.counterparty ?? tx.description ?? '(ohne Beschreibung)',
          amountCents: tx.amountCents,
        });
      }
    }

    return {
      wouldHaveFiredCount: matches.length,
      sample: matches.slice(0, 5),
    };
  }

  async test(ctx: RequestContext, id: string): Promise<NotificationChannel[]> {
    const rule = await this.findOne(ctx, id);
    return this.engine.dispatchTest(rule);
  }

  activity(ctx: RequestContext, limit = 50): Promise<NotificationRuleFire[]> {
    return this.repo.recentFires(ctx.householdId, ctx.userId, limit);
  }

  toResponse(rule: NotificationRule): {
    id: string;
    householdId: string;
    userId: string;
    name: string;
    enabled: boolean;
    trigger: NotificationRule['trigger'];
    predicate: unknown;
    schedule: unknown;
    leadTimeDays: number | null;
    channels: NotificationChannel[];
    digestMode: NotificationRule['digestMode'];
    cooldownMinutes: number | null;
    maxPerHour: number | null;
    maxPerDay: number | null;
    lastFiredAt: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: rule.id,
      householdId: rule.householdId,
      userId: rule.userId,
      name: rule.name,
      enabled: rule.enabled,
      trigger: rule.trigger,
      predicate: rule.predicateJson,
      schedule: rule.scheduleJson,
      leadTimeDays: rule.leadTimeDays,
      channels: rule.channels as NotificationChannel[],
      digestMode: rule.digestMode,
      cooldownMinutes: rule.cooldownMinutes,
      maxPerHour: rule.maxPerHour,
      maxPerDay: rule.maxPerDay,
      lastFiredAt: rule.lastFiredAt ? rule.lastFiredAt.toISOString() : null,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  toActivityResponse(fire: NotificationRuleFire) {
    return {
      id: fire.id,
      ruleId: fire.ruleId,
      sourceKind: fire.sourceKind,
      sourceId: fire.sourceId,
      firedAt: fire.firedAt.toISOString(),
      channelsSent: fire.channelsSent as NotificationChannel[],
      notificationId: fire.notificationId,
    };
  }

  // ─── validation helpers ─────────────────────────────────────────────

  private assertPredicate(trigger: NotificationRule['trigger'], predicate: Predicate): void {
    const parsed = predicateSchema.safeParse(predicate);
    if (!parsed.success) {
      throw new BadRequestException(
        `Predicate ist ungültig: ${parsed.error.issues.map(i => i.message).join('; ')}`,
      );
    }
    const fieldErrors = validatePredicateFields(trigger, parsed.data);
    if (fieldErrors.length > 0) {
      throw new BadRequestException(`Predicate-Felder ungültig: ${fieldErrors.join('; ')}`);
    }
  }

  private assertChannels(channels: NotificationChannel[]): void {
    if (channels.length === 0) {
      throw new BadRequestException('Mindestens ein Kanal erforderlich');
    }
  }

  private assertSchedule(
    trigger: NotificationRule['trigger'],
    schedule: Schedule | null | undefined,
  ): Schedule | null {
    if (trigger !== 'SCHEDULED') return null;
    if (!schedule) {
      throw new BadRequestException('schedule erforderlich für SCHEDULED-Trigger');
    }
    const parsed = scheduleSchema.safeParse(schedule);
    if (!parsed.success) {
      throw new BadRequestException(
        `Schedule ungültig: ${parsed.error.issues.map(i => i.message).join('; ')}`,
      );
    }
    return parsed.data;
  }

  /** Projects a Prisma Transaction onto the predicate field whitelist. */
  private txToFields(
    tx: {
      amountCents: number;
      categoryId: string;
      projectId: string | null;
      accountId: string;
      counterparty: string | null;
      description: string | null;
      bookingText: string | null;
      transactionKind: string | null;
      date: Date;
    },
  ): TransactionEventFields {
    void TRIGGER_FIELDS_FOR_TX;
    return {
      amountCents: tx.amountCents,
      isIncome: tx.amountCents > 0,
      kind: tx.transactionKind,
      categoryId: tx.categoryId,
      projectId: tx.projectId,
      accountId: tx.accountId,
      counterparty: tx.counterparty,
      description: tx.description,
      bookingText: tx.bookingText,
      date: tx.date.toISOString().slice(0, 10),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DigestMode,
  NotificationChannel,
  NotificationRule,
  NotificationRuleFire,
  NotificationTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRuleData {
  householdId: string;
  userId: string;
  name: string;
  enabled?: boolean;
  trigger: NotificationTrigger;
  predicateJson: Prisma.InputJsonValue;
  scheduleJson?: Prisma.InputJsonValue | null;
  leadTimeDays?: number | null;
  channels: NotificationChannel[];
  digestMode?: DigestMode;
  cooldownMinutes?: number | null;
  maxPerHour?: number | null;
  maxPerDay?: number | null;
}

export type UpdateRuleData = Partial<Omit<CreateRuleData, 'householdId' | 'userId'>>;

export interface RuleFilter {
  trigger?: NotificationTrigger;
  enabled?: boolean;
  userId?: string;
}

@Injectable()
export class NotificationRulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(householdId: string, filter: RuleFilter = {}): Promise<NotificationRule[]> {
    return this.prisma.notificationRule.findMany({
      where: {
        householdId,
        ...(filter.trigger ? { trigger: filter.trigger } : {}),
        ...(filter.enabled !== undefined ? { enabled: filter.enabled } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  findById(id: string, householdId: string): Promise<NotificationRule | null> {
    return this.prisma.notificationRule.findFirst({ where: { id, householdId } });
  }

  /**
   * Look up a rule by id without an explicit household scope. Used by the
   * digest scheduler when composing flush emails — the queued row already
   * carries the userId, and the rule itself is the only thing missing for
   * the email's `groups[].ruleName`. Do NOT call this from request-path
   * code; always scope by householdId there.
   */
  findByIdAny(id: string): Promise<NotificationRule | null> {
    return this.prisma.notificationRule.findUnique({ where: { id } });
  }

  create(data: CreateRuleData): Promise<NotificationRule> {
    return this.prisma.notificationRule.create({
      data: {
        householdId: data.householdId,
        userId: data.userId,
        name: data.name,
        enabled: data.enabled ?? true,
        trigger: data.trigger,
        predicateJson: data.predicateJson,
        scheduleJson: data.scheduleJson ?? Prisma.JsonNull,
        leadTimeDays: data.leadTimeDays ?? null,
        channels: data.channels,
        digestMode: data.digestMode ?? 'IMMEDIATE',
        cooldownMinutes: data.cooldownMinutes ?? null,
        maxPerHour: data.maxPerHour ?? null,
        maxPerDay: data.maxPerDay ?? null,
      },
    });
  }

  async update(
    id: string,
    householdId: string,
    data: UpdateRuleData,
  ): Promise<NotificationRule | null> {
    const result = await this.prisma.notificationRule.updateMany({
      where: { id, householdId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.trigger !== undefined ? { trigger: data.trigger } : {}),
        ...(data.predicateJson !== undefined ? { predicateJson: data.predicateJson } : {}),
        ...(data.scheduleJson !== undefined
          ? { scheduleJson: data.scheduleJson ?? Prisma.JsonNull }
          : {}),
        ...(data.leadTimeDays !== undefined ? { leadTimeDays: data.leadTimeDays } : {}),
        ...(data.channels !== undefined ? { channels: data.channels } : {}),
        ...(data.digestMode !== undefined ? { digestMode: data.digestMode } : {}),
        ...(data.cooldownMinutes !== undefined
          ? { cooldownMinutes: data.cooldownMinutes }
          : {}),
        ...(data.maxPerHour !== undefined ? { maxPerHour: data.maxPerHour } : {}),
        ...(data.maxPerDay !== undefined ? { maxPerDay: data.maxPerDay } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(id, householdId);
  }

  async delete(id: string, householdId: string): Promise<boolean> {
    const result = await this.prisma.notificationRule.deleteMany({
      where: { id, householdId },
    });
    return result.count > 0;
  }

  /**
   * Atomically records a rule firing. Throws on duplicate key (idempotency
   * guard). Caller catches P2002 to swallow expected duplicates.
   */
  recordFire(input: {
    ruleId: string;
    sourceKind: string;
    sourceId: string;
    channelsSent: NotificationChannel[];
    notificationId?: string | null;
  }): Promise<NotificationRuleFire> {
    return this.prisma.notificationRuleFire.create({
      data: {
        ruleId: input.ruleId,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
        channelsSent: input.channelsSent,
        notificationId: input.notificationId ?? null,
      },
    });
  }

  recentFires(
    householdId: string,
    userId: string,
    limit = 50,
  ): Promise<NotificationRuleFire[]> {
    return this.prisma.notificationRuleFire.findMany({
      where: { rule: { householdId, userId } },
      orderBy: { firedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Updates throttle counters: bumps firedCountToday for the bucket (today),
   * resets it when crossing midnight (UTC date), and stamps lastFiredAt.
   * Called inside the engine after dispatch.
   */
  async updateThrottleCounters(
    ruleId: string,
    now: Date,
  ): Promise<void> {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const existing = await this.prisma.notificationRule.findUnique({
      where: { id: ruleId },
      select: { firedBucketDate: true, firedCountToday: true },
    });
    if (!existing) return;
    const isSameDay =
      existing.firedBucketDate &&
      existing.firedBucketDate.getUTCFullYear() === today.getUTCFullYear() &&
      existing.firedBucketDate.getUTCMonth() === today.getUTCMonth() &&
      existing.firedBucketDate.getUTCDate() === today.getUTCDate();
    await this.prisma.notificationRule.update({
      where: { id: ruleId },
      data: {
        lastFiredAt: now,
        firedBucketDate: today,
        firedCountToday: isSameDay ? existing.firedCountToday + 1 : 1,
      },
    });
  }

  /**
   * Returns true when (ruleId, sourceKind, sourceId) has already fired
   * (the unique constraint enforces this, but we expose a query for nicer
   * error reporting and tests).
   */
  async hasFired(ruleId: string, sourceKind: string, sourceId: string): Promise<boolean> {
    const hit = await this.prisma.notificationRuleFire.findUnique({
      where: {
        ruleId_sourceKind_sourceId: { ruleId, sourceKind, sourceId },
      },
      select: { id: true },
    });
    return !!hit;
  }
}

export const JSON_NULL = Prisma.JsonNull;

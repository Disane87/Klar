import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronJob } from 'cron';
import type { NotificationRule } from '@prisma/client';
import type { Schedule } from '@klar/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SchedulerRegistry-backed cron jobs for `SCHEDULED` rules. Each rule
 * gets a dedicated cron job named `rule:{ruleId}`. The job emits a
 * synthetic event the engine consumes through its generic pipeline.
 *
 * Lifecycle:
 *  - On bootstrap, every enabled scheduled rule gets a job registered.
 *  - `register()`/`unregister()` are called by the NotificationRulesService
 *    on create / update / delete so the registry stays in sync.
 *  - On shutdown, all jobs stop (NestJS handles via SchedulerRegistry).
 */
@Injectable()
export class ScheduledRuleService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledRuleService.name);
  private readonly registered = new Set<string>();

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const rules = await this.prisma.notificationRule.findMany({
      where: { trigger: 'SCHEDULED', enabled: true },
    });
    for (const rule of rules) this.register(rule);
    this.logger.log(`SCHEDULED rules registered: ${this.registered.size}`);
  }

  onModuleDestroy(): void {
    for (const jobName of Array.from(this.registered)) {
      try {
        this.registry.deleteCronJob(jobName);
      } catch {
        // already gone — harmless
      }
    }
    this.registered.clear();
  }

  register(rule: NotificationRule): void {
    if (rule.trigger !== 'SCHEDULED' || !rule.enabled) {
      this.unregister(rule.id);
      return;
    }
    const schedule = rule.scheduleJson as unknown as Schedule | null;
    if (!schedule) return;
    const expr = this.scheduleToCron(schedule);
    if (!expr) return;

    const name = this.jobName(rule.id);
    this.unregister(rule.id); // idempotent re-register
    try {
      const job = new CronJob(
        expr,
        () => this.fire(rule.id),
        null,
        true,
        'Europe/Berlin',
      );
      this.registry.addCronJob(name, job as never);
      job.start();
      this.registered.add(name);
    } catch (err) {
      this.logger.warn({ err, ruleId: rule.id, expr }, 'failed to register scheduled rule');
    }
  }

  unregister(ruleId: string): void {
    const name = this.jobName(ruleId);
    if (!this.registered.has(name)) return;
    try {
      this.registry.deleteCronJob(name);
    } catch {
      // ignore
    }
    this.registered.delete(name);
  }

  private async fire(ruleId: string): Promise<void> {
    // We emit a SCHEDULED rule-tick event the engine consumes. The event
    // body has no whitelisted fields — predicates on SCHEDULED rules
    // MUST use aggregations on the value side.
    const isoNow = new Date().toISOString();
    const bucket = isoNow.slice(0, 13); // YYYY-MM-DDTHH
    this.events.emit('rule.scheduled.tick', {
      sourceId: `${ruleId}|${bucket}`,
      ruleId,
      householdId: await this.householdIdOfRule(ruleId),
    });
  }

  private async householdIdOfRule(ruleId: string): Promise<string> {
    const r = await this.prisma.notificationRule.findUnique({
      where: { id: ruleId },
      select: { householdId: true },
    });
    return r?.householdId ?? '';
  }

  private jobName(ruleId: string): string {
    return `rule:${ruleId}`;
  }

  /**
   * Translates the Schedule DTO into a 5-field cron expression
   * (minute hour day-of-month month day-of-week). Returns null when
   * the schedule shape is invalid.
   */
  scheduleToCron(schedule: Schedule): string | null {
    const [hh, mm] = schedule.time.split(':').map(Number);
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
    if (schedule.type === 'daily') {
      return `${mm} ${hh} * * *`;
    }
    if (schedule.type === 'weekly') {
      const dow = schedule.dayOfWeek ?? 1;
      return `${mm} ${hh} * * ${dow}`;
    }
    if (schedule.type === 'monthly') {
      const dom = schedule.dayOfMonth ?? 1;
      return `${mm} ${hh} ${dom} * *`;
    }
    return null;
  }
}

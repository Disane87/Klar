import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FintsConnectionRepository } from '../connection/fints-connection.repository';
import { NotificationsRepository } from '../../notifications/notifications.repository';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 90-day SCA Reauth-Watcher (Phase 14a.7).
 *
 * PSD2 forces banks to require a fresh TAN authentication every ~90 days
 * even for read-only access. We notify the connection's owner 7 days
 * before expiry and flip ACTIVE → REAUTH_REQUIRED once the window has
 * passed; the cron sync runner then refuses to operate on the connection
 * until the user completes a fresh TAN flow via the future re-auth UI.
 *
 * Runs once a day at 08:00 local time.
 */
@Injectable()
export class ReauthWatcherScheduler {
  private static readonly WARN_WINDOW_DAYS = 7;
  /** Avoid sending the same warning more than once per day per connection. */
  private static readonly WARN_COOLDOWN_HOURS = 24;

  private readonly logger = new Logger(ReauthWatcherScheduler.name);

  constructor(
    private readonly connections: FintsConnectionRepository,
    private readonly notifications: NotificationsRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 8 * * *')
  async runDaily(): Promise<void> {
    const now = new Date();

    // 1. Pre-warning: connections expiring within 7 days that haven't
    //    been warned in the last 24h.
    const expiring = await this.connections.findExpiringWithin(
      ReauthWatcherScheduler.WARN_WINDOW_DAYS,
      now,
    );
    let warned = 0;
    for (const c of expiring) {
      if (await this.recentlyWarned(c.id, now)) continue;
      await this.notifications.create({
        householdId: c.householdId,
        userId: c.ownerId,
        kind: 'FINTS_REAUTH_WARNING',
        title: `FinTS-Verbindung "${c.bankName}" läuft bald ab`,
        body: `Die starke Authentifizierung läuft am ${c.scaExpiresAt?.toISOString().slice(0, 10) ?? 'unbekannt'} ab. Bitte rechtzeitig per TAN erneuern.`,
        payloadJson: {
          connectionId: c.id,
          scaExpiresAt: c.scaExpiresAt?.toISOString() ?? null,
          kind: 'fints.reauth_warning',
        },
      });
      warned++;
    }

    // 2. Past-due: ACTIVE connections whose SCA window expired — flip
    //    status and notify.
    const expired = await this.connections.findExpired(now);
    let flipped = 0;
    for (const c of expired) {
      await this.connections.setStatus(c.id, 'REAUTH_REQUIRED');
      await this.notifications.create({
        householdId: c.householdId,
        userId: c.ownerId,
        kind: 'FINTS_REAUTH_REQUIRED',
        title: `FinTS-Verbindung "${c.bankName}" muss erneuert werden`,
        body: 'Die starke Authentifizierung ist abgelaufen. Synchronisierung pausiert, bis du dich per TAN neu anmeldest.',
        payloadJson: {
          connectionId: c.id,
          kind: 'fints.reauth_required',
        },
      });
      flipped++;
    }

    if (warned + flipped > 0) {
      this.logger.log(`Reauth watcher: ${warned} warned, ${flipped} flipped to REAUTH_REQUIRED`);
    }
  }

  /**
   * Internal: was a FINTS_REAUTH_WARNING for this connection already
   * created within the cooldown window? Avoids notification spam when
   * the cron runs daily but the user already saw the message.
   *
   * The check matches on payloadJson.connectionId rather than a dedicated
   * column — keeps the Notification schema generic.
   */
  private async recentlyWarned(connectionId: string, now: Date): Promise<boolean> {
    const cutoff = new Date(
      now.getTime() - ReauthWatcherScheduler.WARN_COOLDOWN_HOURS * 3_600_000,
    );
    const existing = await this.prisma.notification.findFirst({
      where: {
        kind: 'FINTS_REAUTH_WARNING',
        createdAt: { gte: cutoff },
        payloadJson: {
          path: ['connectionId'],
          equals: connectionId,
        },
      },
    });
    return existing !== null;
  }
}

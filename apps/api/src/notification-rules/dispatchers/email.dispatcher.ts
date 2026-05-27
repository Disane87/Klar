import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { NotificationRule } from '@prisma/client';
import { appConfig } from '../../config/app.config';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface EmailMatchPayload {
  ruleName: string;
  body: string;
  deepLinkUrl?: string;
}

export interface DigestGroup {
  ruleName: string;
  items: string[];
}

/**
 * Email channel for the notification rules engine. Two surface methods:
 *  - sendImmediate: one match → one email (digestMode = IMMEDIATE).
 *  - sendDigest:    flushed by the digest scheduler (HOURLY / DAILY).
 *
 * Soft-fails when MailService is misconfigured — the IN_APP dispatch
 * remains authoritative.
 */
@Injectable()
export class EmailDispatcher {
  private readonly logger = new Logger(EmailDispatcher.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async sendImmediate(rule: NotificationRule, payload: EmailMatchPayload): Promise<boolean> {
    const user = await this.findUserEmail(rule.userId);
    if (!user) return false;
    const result = await this.mail.sendTemplate({
      to: user.email,
      subject: `Klar — ${payload.ruleName}`,
      template: 'notification-immediate',
      context: {
        ruleName: payload.ruleName,
        body: payload.body,
        deepLinkUrl: payload.deepLinkUrl,
        settingsUrl: `${this.app.frontendUrl}/app/settings/notifications`,
      },
      userId: rule.userId,
      householdId: rule.householdId,
    });
    return result.ok;
  }

  async sendDigest(
    userId: string,
    period: 'HOURLY' | 'DAILY',
    groups: DigestGroup[],
  ): Promise<boolean> {
    const user = await this.findUserEmail(userId);
    if (!user) return false;
    const count = groups.reduce((s, g) => s + g.items.length, 0);
    if (count === 0) return true;
    const result = await this.mail.sendTemplate({
      to: user.email,
      subject: period === 'HOURLY'
        ? `Klar — ${count} neue Hinweise in der letzten Stunde`
        : `Klar — ${count} neue Hinweise am letzten Tag`,
      template: 'notification-digest',
      context: {
        count,
        periodLabel: period === 'HOURLY' ? 'Stunden-Zusammenfassung' : 'Tages-Zusammenfassung',
        groups,
        appUrl: this.app.frontendUrl,
        settingsUrl: `${this.app.frontendUrl}/app/settings/notifications`,
      },
      userId,
    });
    return result.ok;
  }

  private async findUserEmail(userId: string): Promise<{ email: string } | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!row || !row.email) {
      this.logger.warn({ userId }, 'no user email found for notification email dispatch');
      return null;
    }
    return row;
  }
}

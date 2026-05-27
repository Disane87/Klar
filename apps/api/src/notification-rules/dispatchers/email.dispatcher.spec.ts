import { describe, it, expect, vi } from 'vitest';
import type { NotificationRule } from '@prisma/client';
import { EmailDispatcher } from './email.dispatcher';
import type { MailService } from '../../mail/mail.service';
import type { PrismaService } from '../../prisma/prisma.service';

function buildDispatcher() {
  const mail = {
    sendTemplate: vi.fn(),
  } as unknown as MailService;
  const prisma = {
    user: { findUnique: vi.fn() },
  } as unknown as PrismaService;
  const appCfg = { frontendUrl: 'https://klar.test' };
  const dispatcher = new EmailDispatcher(
    mail,
    prisma,
    appCfg as unknown as Parameters<typeof EmailDispatcher>[2],
  );
  return { dispatcher, mail, prisma };
}

const rule: NotificationRule = {
  id: 'nrl_1',
  userId: 'usr_1',
  householdId: 'hh_1',
  name: 'Großer Eingang',
} as NotificationRule;

describe('EmailDispatcher', () => {
  it('sendImmediate returns false when the user has no email', async () => {
    const { dispatcher, prisma } = buildDispatcher();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const ok = await dispatcher.sendImmediate(rule, { ruleName: 'X', body: 'b' });
    expect(ok).toBe(false);
  });

  it('sendImmediate delegates to MailService.sendTemplate with the right template + context', async () => {
    const { dispatcher, prisma, mail } = buildDispatcher();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'u@x.de' } as never);
    vi.mocked(mail.sendTemplate).mockResolvedValue({ ok: true });
    const ok = await dispatcher.sendImmediate(rule, {
      ruleName: 'Großer Eingang',
      body: '+2.500 €',
      deepLinkUrl: '/app/buchungen?tx=tx_1',
    });
    expect(ok).toBe(true);
    expect(mail.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u@x.de',
        template: 'notification-immediate',
        context: expect.objectContaining({
          ruleName: 'Großer Eingang',
          body: '+2.500 €',
          deepLinkUrl: '/app/buchungen?tx=tx_1',
          settingsUrl: 'https://klar.test/app/settings/notifications',
        }),
      }),
    );
  });

  it('sendDigest groups go through the digest template', async () => {
    const { dispatcher, prisma, mail } = buildDispatcher();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'u@x.de' } as never);
    vi.mocked(mail.sendTemplate).mockResolvedValue({ ok: true });
    const ok = await dispatcher.sendDigest('usr_1', 'DAILY', [
      { ruleName: 'A', items: ['1', '2'] },
      { ruleName: 'B', items: ['3'] },
    ]);
    expect(ok).toBe(true);
    expect(mail.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'notification-digest',
        context: expect.objectContaining({ count: 3 }),
      }),
    );
  });

  it('sendDigest returns true and skips delivery on an empty group set', async () => {
    const { dispatcher, prisma, mail } = buildDispatcher();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'u@x.de' } as never);
    const ok = await dispatcher.sendDigest('usr_1', 'HOURLY', []);
    expect(ok).toBe(true);
    expect(mail.sendTemplate).not.toHaveBeenCalled();
  });
});

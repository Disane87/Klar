import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { WebPushSubscription } from '@prisma/client';
import { WebPushDispatcher } from './web-push.dispatcher';
import type { PushSubscriptionsRepository } from '../push-subscriptions/push-subscriptions.repository';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

import webPush from 'web-push';

function makeSub(over: Partial<WebPushSubscription> = {}): WebPushSubscription {
  return {
    id: 'sub_1',
    userId: 'usr_1',
    householdId: 'hh_1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'P',
    auth: 'A',
    userAgent: 'UA',
    createdAt: new Date(),
    lastSeenAt: new Date(),
    ...over,
  } as WebPushSubscription;
}

function buildDispatcher(opts: { configured: boolean }) {
  const config = {
    get: vi.fn((key: string) =>
      opts.configured
        ? { 'webPush.publicKey': 'PUB', 'webPush.privateKey': 'PRIV', 'webPush.subject': 'mailto:x@y' }[key]
        : '',
    ),
  } as unknown as ConfigService;
  const subs = {
    findByUserId: vi.fn(),
    deleteByEndpoint: vi.fn().mockResolvedValue(undefined),
    touchLastSeen: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushSubscriptionsRepository;
  const dispatcher = new WebPushDispatcher(config, subs);
  dispatcher.onModuleInit();
  return { dispatcher, config, subs };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WebPushDispatcher', () => {
  it('is configured=false when VAPID env is missing', () => {
    const { dispatcher } = buildDispatcher({ configured: false });
    expect(dispatcher.isConfigured()).toBe(false);
  });

  it('is configured=true after VAPID env is set', () => {
    const { dispatcher } = buildDispatcher({ configured: true });
    expect(dispatcher.isConfigured()).toBe(true);
    expect(vi.mocked(webPush.setVapidDetails)).toHaveBeenCalled();
  });

  it('send is a no-op when not configured', async () => {
    const { dispatcher, subs } = buildDispatcher({ configured: false });
    const count = await dispatcher.send('usr_1', {
      title: 'x', body: 'y', url: '/', tag: 't', notificationId: null,
    });
    expect(count).toBe(0);
    expect(subs.findByUserId).not.toHaveBeenCalled();
  });

  it('fans out to every user subscription', async () => {
    const { dispatcher, subs } = buildDispatcher({ configured: true });
    vi.mocked(subs.findByUserId).mockResolvedValue([
      makeSub({ id: 'sub_a', endpoint: 'https://fcm.googleapis.com/fcm/send/a' }),
      makeSub({ id: 'sub_b', endpoint: 'https://updates.push.services.mozilla.com/b' }),
    ]);
    vi.mocked(webPush.sendNotification).mockResolvedValue(undefined as never);

    const count = await dispatcher.send('usr_1', {
      title: 'x', body: 'y', url: '/', tag: 't', notificationId: null,
    });
    expect(count).toBe(2);
    expect(webPush.sendNotification).toHaveBeenCalledTimes(2);
    expect(subs.touchLastSeen).toHaveBeenCalledTimes(2);
  });

  it('reaps gone subscriptions (404 / 410)', async () => {
    const { dispatcher, subs } = buildDispatcher({ configured: true });
    vi.mocked(subs.findByUserId).mockResolvedValue([
      makeSub({ id: 'sub_a', endpoint: 'https://fcm.googleapis.com/fcm/send/a' }),
    ]);
    vi.mocked(webPush.sendNotification).mockRejectedValue(
      Object.assign(new Error('gone'), { statusCode: 410 }),
    );

    await dispatcher.send('usr_1', {
      title: 'x', body: 'y', url: '/', tag: 't', notificationId: null,
    });
    expect(subs.deleteByEndpoint).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/a');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { WebPushSubscription } from '@prisma/client';
import { PushSubscriptionsService } from './push-subscriptions.service';
import type { PushSubscriptionsRepository } from './push-subscriptions.repository';
import type { RequestContext } from '../../common/types/request-context.type';

function buildService() {
  const repo = {
    findByUserId: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  } as unknown as PushSubscriptionsRepository;
  const config = { get: vi.fn() } as unknown as ConfigService;
  const service = new PushSubscriptionsService(repo, config);
  return { service, repo, config };
}

const ctx: RequestContext = { householdId: 'hh_1', userId: 'usr_1', source: 'web' };

function makeSub(over: Partial<WebPushSubscription> = {}): WebPushSubscription {
  return {
    id: 'sub_1',
    userId: 'usr_1',
    householdId: 'hh_1',
    endpoint: 'https://push.example/abc',
    p256dh: 'key1',
    auth: 'key2',
    userAgent: 'UA',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    lastSeenAt: new Date('2026-05-01T00:00:00Z'),
    ...over,
  } as WebPushSubscription;
}

describe('PushSubscriptionsService', () => {
  it('exposes the configured VAPID public key', () => {
    const { service, config } = buildService();
    vi.mocked(config.get).mockReturnValue('PUB123');
    expect(service.vapidPublicKey()).toBe('PUB123');
  });

  it('returns empty string when VAPID is not configured', () => {
    const { service, config } = buildService();
    vi.mocked(config.get).mockReturnValue(undefined);
    expect(service.vapidPublicKey()).toBe('');
  });

  it('subscribe forwards keys to the repo upsert', async () => {
    const { service, repo } = buildService();
    vi.mocked(repo.upsert).mockResolvedValue(makeSub());
    const dto = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'P', auth: 'A' },
      userAgent: 'UA',
    };
    const sub = await service.subscribe(ctx, dto);
    expect(sub.id).toBe('sub_1');
    expect(repo.upsert).toHaveBeenCalledWith({
      userId: 'usr_1',
      householdId: 'hh_1',
      endpoint: 'https://push.example/abc',
      p256dh: 'P',
      auth: 'A',
      userAgent: 'UA',
    });
  });

  it('list returns the caller\'s subscriptions only', async () => {
    const { service, repo } = buildService();
    vi.mocked(repo.findByUserId).mockResolvedValue([makeSub()]);
    const subs = await service.list(ctx);
    expect(subs).toHaveLength(1);
    expect(repo.findByUserId).toHaveBeenCalledWith('usr_1');
  });

  it('remove 404s when the subscription is not owned', async () => {
    const { service, repo } = buildService();
    vi.mocked(repo.delete).mockResolvedValue(false);
    await expect(service.remove(ctx, 'sub_missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('toResponse drops the keys (only metadata is exposed)', () => {
    const { service } = buildService();
    const r = service.toResponse(makeSub());
    expect(r.id).toBe('sub_1');
    expect(r.endpoint).toBe('https://push.example/abc');
    expect((r as Record<string, unknown>)['p256dh']).toBeUndefined();
    expect((r as Record<string, unknown>)['auth']).toBeUndefined();
  });
});

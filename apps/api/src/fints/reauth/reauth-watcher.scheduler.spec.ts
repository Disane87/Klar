import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FintsConnection } from '@prisma/client';
import { ReauthWatcherScheduler } from './reauth-watcher.scheduler';
import type { FintsConnectionRepository } from '../connection/fints-connection.repository';
import type { NotificationsRepository } from '../../notifications/notifications.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const makeConn = (overrides: Partial<FintsConnection> = {}): FintsConnection => ({
  id: 'c1',
  ownerId: 'u1',
  householdId: 'hh1',
  bankName: 'Sparkasse Test',
  blz: '37050198',
  serverUrl: 'https://x',
  loginName: 'login',
  credentialsCipher: Buffer.from(''),
  credentialsIv: Buffer.from(''),
  credentialsTag: Buffer.from(''),
  status: 'ACTIVE',
  lastScaAt: new Date('2026-02-01'),
  scaExpiresAt: new Date('2026-05-12'),
  lastSyncAt: null,
  lastSyncStatus: null,
  createdAt: new Date('2026-02-01'),
  updatedAt: new Date('2026-02-01'),
  ...overrides,
});

function buildScheduler() {
  const connections = {
    findExpiringWithin: vi.fn().mockResolvedValue([]),
    findExpired: vi.fn().mockResolvedValue([]),
    setStatus: vi.fn(),
  } as unknown as FintsConnectionRepository;
  const notifications = {
    create: vi.fn().mockResolvedValue({}),
  } as unknown as NotificationsRepository;
  const prisma = {
    notification: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaService;
  const scheduler = new ReauthWatcherScheduler(connections, notifications, prisma);
  return { scheduler, connections, notifications, prisma };
}

describe('ReauthWatcherScheduler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('warns connections expiring within 7 days when no recent warning exists', async () => {
    const { scheduler, connections, notifications } = buildScheduler();
    vi.mocked(connections.findExpiringWithin).mockResolvedValue([
      makeConn({ id: 'c1', scaExpiresAt: new Date('2026-05-12') }),
    ]);

    await scheduler.runDaily();

    expect(notifications.create).toHaveBeenCalledOnce();
    const call = vi.mocked(notifications.create).mock.calls[0][0];
    expect(call.kind).toBe('FINTS_REAUTH_WARNING');
    expect(call.userId).toBe('u1');
  });

  it('skips warning when one exists in the cooldown window', async () => {
    const { scheduler, connections, notifications, prisma } = buildScheduler();
    vi.mocked(connections.findExpiringWithin).mockResolvedValue([makeConn()]);
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({ id: 'n1' } as never);

    await scheduler.runDaily();

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('flips ACTIVE → REAUTH_REQUIRED for expired connections and notifies', async () => {
    const { scheduler, connections, notifications } = buildScheduler();
    const conn = makeConn({ id: 'c2', scaExpiresAt: new Date('2025-12-01') });
    vi.mocked(connections.findExpired).mockResolvedValue([conn]);

    await scheduler.runDaily();

    expect(connections.setStatus).toHaveBeenCalledWith('c2', 'REAUTH_REQUIRED');
    expect(notifications.create).toHaveBeenCalledOnce();
    const call = vi.mocked(notifications.create).mock.calls[0][0];
    expect(call.kind).toBe('FINTS_REAUTH_REQUIRED');
  });

  it('handles both passes in one run when independent connections match each', async () => {
    const { scheduler, connections, notifications } = buildScheduler();
    vi.mocked(connections.findExpiringWithin).mockResolvedValue([makeConn({ id: 'warn' })]);
    vi.mocked(connections.findExpired).mockResolvedValue([makeConn({ id: 'expired' })]);

    await scheduler.runDaily();

    expect(connections.setStatus).toHaveBeenCalledWith('expired', 'REAUTH_REQUIRED');
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when no connections need action', async () => {
    const { scheduler, connections, notifications } = buildScheduler();

    await scheduler.runDaily();

    expect(notifications.create).not.toHaveBeenCalled();
    expect(connections.setStatus).not.toHaveBeenCalled();
  });
});

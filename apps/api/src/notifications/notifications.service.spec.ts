import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { NotificationsRepository } from './notifications.repository';
import type { Notification } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeNotif = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n-1',
  householdId: 'hh1',
  userId: null,
  kind: 'SYSTEM',
  title: 'Test',
  body: null,
  payloadJson: null,
  readAt: null,
  createdAt: new Date('2026-05-07T10:00:00Z'),
  ...overrides,
});

function build() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    countUnread: vi.fn(),
  } as unknown as NotificationsRepository;
  const service = new NotificationsService(repo);
  return { service, repo };
}

describe('NotificationsService', () => {
  describe('list', () => {
    it('returns items + null nextCursor when below page size', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findAll).mockResolvedValue([makeNotif()]);
      vi.mocked(repo.countUnread).mockResolvedValue(1);
      const res = await service.list(ctx, { limit: 20 });
      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBeNull();
      expect(res.unreadCount).toBe(1);
    });

    it('emits nextCursor when one extra row is fetched', async () => {
      const { service, repo } = build();
      const rows = Array.from({ length: 21 }, (_, i) =>
        makeNotif({ id: `n-${i}` }),
      );
      vi.mocked(repo.findAll).mockResolvedValue(rows);
      vi.mocked(repo.countUnread).mockResolvedValue(21);
      const res = await service.list(ctx, { limit: 20 });
      expect(res.items).toHaveLength(20);
      expect(res.nextCursor).toBe('n-19');
    });

    it('passes user filter to repo', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      vi.mocked(repo.countUnread).mockResolvedValue(0);
      await service.list(ctx, { unreadOnly: true });
      expect(repo.findAll).toHaveBeenCalledWith('hh1', expect.objectContaining({
        userId: 'u1',
        unreadOnly: true,
      }));
    });
  });

  describe('markRead', () => {
    it('throws NotFound when notification missing', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.markRead(ctx, 'n-x')).rejects.toThrow(NotFoundException);
    });

    it('marks notification read when found', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(makeNotif());
      vi.mocked(repo.markRead).mockResolvedValue({ count: 1 });
      await service.markRead(ctx, 'n-1');
      expect(repo.markRead).toHaveBeenCalledWith('n-1', 'hh1');
    });
  });

  describe('markAllRead', () => {
    it('returns count of updated rows', async () => {
      const { service, repo } = build();
      vi.mocked(repo.markAllRead).mockResolvedValue({ count: 5 });
      const res = await service.markAllRead(ctx);
      expect(res.updated).toBe(5);
      expect(repo.markAllRead).toHaveBeenCalledWith('hh1', 'u1');
    });
  });

  describe('remove', () => {
    it('throws NotFound when missing', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.remove(ctx, 'n-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes when found', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(makeNotif());
      vi.mocked(repo.delete).mockResolvedValue(undefined);
      await service.remove(ctx, 'n-1');
      expect(repo.delete).toHaveBeenCalledWith('n-1', 'hh1');
    });
  });

  describe('enqueue', () => {
    it('defaults userId to ctx.userId', async () => {
      const { service, repo } = build();
      vi.mocked(repo.create).mockResolvedValue(makeNotif());
      await service.enqueue(ctx, 'IMPORT_READY', 'CSV imported');
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        householdId: 'hh1',
        userId: 'u1',
        kind: 'IMPORT_READY',
        title: 'CSV imported',
      }));
    });

    it('honors explicit null userId for household-wide notifications', async () => {
      const { service, repo } = build();
      vi.mocked(repo.create).mockResolvedValue(makeNotif());
      await service.enqueue(ctx, 'SYSTEM', 'Maintenance window', { userId: null });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
    });

    it('passes payloadJson + body through', async () => {
      const { service, repo } = build();
      vi.mocked(repo.create).mockResolvedValue(makeNotif());
      await service.enqueue(ctx, 'BUDGET_THRESHOLD', 'Over budget', {
        body: 'Lebensmittel +10%',
        payloadJson: { categoryId: 'cat-1' },
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        body: 'Lebensmittel +10%',
        payloadJson: { categoryId: 'cat-1' },
      }));
    });
  });

  describe('toResponse', () => {
    it('serializes dates to ISO strings', () => {
      const { service } = build();
      const r = service.toResponse(makeNotif({ readAt: new Date('2026-05-07T11:00:00Z') }));
      expect(r.createdAt).toBe('2026-05-07T10:00:00.000Z');
      expect(r.readAt).toBe('2026-05-07T11:00:00.000Z');
    });

    it('keeps readAt null when unread', () => {
      const { service } = build();
      const r = service.toResponse(makeNotif());
      expect(r.readAt).toBeNull();
    });
  });
});

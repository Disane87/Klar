import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConnectedAppsService } from './connected-apps.service';
import type { ConnectedAppsRepository } from './connected-apps.repository';
import type { ConnectedApp } from '@prisma/client';

const userId = 'u1';

const make = (overrides: Partial<ConnectedApp> = {}): ConnectedApp => ({
  id: 'ca-1',
  userId: 'u1',
  provider: 'github',
  externalId: 'gh-12345',
  scopes: ['read'],
  linkedAt: new Date('2026-05-01'),
  lastUsedAt: null,
  ...overrides,
});

function build() {
  const repo = {
    findAllForUser: vi.fn(),
    findByIdForUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteForUser: vi.fn(),
  } as unknown as ConnectedAppsRepository;
  const service = new ConnectedAppsService(repo);
  return { service, repo };
}

describe('ConnectedAppsService', () => {
  describe('list', () => {
    it('passes userId to repo', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findAllForUser).mockResolvedValue([]);
      await service.list(userId);
      expect(repo.findAllForUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('create', () => {
    it('rejects unknown provider', async () => {
      const { service } = build();
      await expect(
        service.create(userId, { provider: 'unknown', externalId: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects missing externalId', async () => {
      const { service } = build();
      await expect(
        service.create(userId, { provider: 'github', externalId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates with empty scopes default', async () => {
      const { service, repo } = build();
      vi.mocked(repo.create).mockResolvedValue(make());
      await service.create(userId, { provider: 'github', externalId: 'gh-x' });
      expect(repo.create).toHaveBeenCalledWith({
        userId: 'u1',
        provider: 'github',
        externalId: 'gh-x',
        scopes: [],
      });
    });

    it('translates Prisma unique conflict to ConflictException', async () => {
      const { service, repo } = build();
      vi.mocked(repo.create).mockRejectedValue(new Error('Unique constraint failed'));
      await expect(
        service.create(userId, { provider: 'github', externalId: 'dup' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('throws NotFound when missing', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findByIdForUser).mockResolvedValue(null);
      await expect(service.update(userId, 'x', {})).rejects.toThrow(NotFoundException);
    });

    it('updates scopes', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findByIdForUser).mockResolvedValue(make());
      vi.mocked(repo.update).mockResolvedValue(make({ scopes: ['admin'] }));
      const r = await service.update(userId, 'ca-1', { scopes: ['admin'] });
      expect(r.scopes).toEqual(['admin']);
    });
  });

  describe('unlink', () => {
    it('throws NotFound when missing', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findByIdForUser).mockResolvedValue(null);
      await expect(service.unlink(userId, 'x')).rejects.toThrow(NotFoundException);
    });

    it('deletes when found', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findByIdForUser).mockResolvedValue(make());
      vi.mocked(repo.deleteForUser).mockResolvedValue(undefined);
      await service.unlink(userId, 'ca-1');
      expect(repo.deleteForUser).toHaveBeenCalledWith('ca-1', 'u1');
    });
  });

  describe('toResponse', () => {
    it('serializes dates', () => {
      const { service } = build();
      const r = service.toResponse(make({ lastUsedAt: new Date('2026-05-02') }));
      expect(r.linkedAt).toBe(new Date('2026-05-01').toISOString());
      expect(r.lastUsedAt).toBe(new Date('2026-05-02').toISOString());
    });

    it('keeps lastUsedAt null when never used', () => {
      const { service } = build();
      const r = service.toResponse(make());
      expect(r.lastUsedAt).toBeNull();
    });
  });
});

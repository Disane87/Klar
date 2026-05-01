import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ApiKeysService } from './api-keys.service';
import type { ApiKeysRepository, ApiKeySafeView } from './api-keys.repository';
import type { ApiKey } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { API_KEY_SCOPES } from './api-key-scopes';

vi.mock('argon2', () => ({
  argon2id: 1,
  hash: vi.fn().mockResolvedValue('hashed-secret'),
  verify: vi.fn().mockResolvedValue(true),
}));

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeApiKeySafeView = (overrides: Partial<ApiKeySafeView> = {}): ApiKeySafeView => ({
  id: 'key-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  name: 'Test Key',
  prefix: 'abcd1234',
  scopes: ['transactions:read'],
  expiresAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  rateLimitPerMin: 60,
  isRevoked: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const makeApiKey = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: 'key-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  name: 'Test Key',
  prefix: 'abcd1234',
  hashedSecret: 'hashed-secret',
  scopes: ['transactions:read'],
  expiresAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  rateLimitPerMin: 60,
  isRevoked: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

function buildService(): {
  service: ApiKeysService;
  repo: ApiKeysRepository;
} {
  const repo = {
    findAll: vi.fn().mockResolvedValue([]),
    findByPrefix: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeApiKey()),
    revoke: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    updateLastUsed: vi.fn(),
  } as unknown as ApiKeysRepository;

  const service = new ApiKeysService(repo);

  return { service, repo };
}

describe('ApiKeysService', () => {
  beforeEach(() => {
    vi.mocked(argon2.hash).mockResolvedValue('hashed-secret');
    vi.mocked(argon2.verify).mockResolvedValue(true);
  });

  describe('list', () => {
    it('returns safe view of all keys for the household', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([makeApiKeySafeView()]);

      const result = await service.list(ctx);

      expect(repo.findAll).toHaveBeenCalledWith('hh1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('key-1');
      expect(result[0].name).toBe('Test Key');
      // hashedSecret must not be present on the list item
      expect(result[0]).not.toHaveProperty('hashedSecret');
    });
  });

  describe('create', () => {
    it('throws BadRequestException when name is empty string', async () => {
      const { service } = buildService();

      await expect(
        service.create(ctx, { name: '', scopes: ['transactions:read'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when name is only whitespace', async () => {
      const { service } = buildService();

      await expect(
        service.create(ctx, { name: '   ', scopes: ['transactions:read'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when scopes array is empty', async () => {
      const { service } = buildService();

      await expect(
        service.create(ctx, { name: 'My Key', scopes: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid scope strings', async () => {
      const { service } = buildService();

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional invalid scope for test
        service.create(ctx, { name: 'My Key', scopes: ['invalid:scope' as any] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns result with fullKey matching /^bgb_live_/', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeApiKey());

      const result = await service.create(ctx, {
        name: 'My Key',
        scopes: ['transactions:read'],
      });

      expect(result.fullKey).toMatch(/^bgb_live_/);
    });

    it('calls repo.create with correct householdId and userId', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeApiKey());

      await service.create(ctx, {
        name: 'My Key',
        scopes: ['transactions:read'],
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          householdId: 'hh1',
          createdByUserId: 'u1',
          name: 'My Key',
          scopes: ['transactions:read'],
          hashedSecret: 'hashed-secret',
        }),
      );
    });

    it('accepts all valid scopes without throwing', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeApiKey({ scopes: [...API_KEY_SCOPES] }));

      const result = await service.create(ctx, {
        name: 'Full-Access Key',
        scopes: [...API_KEY_SCOPES],
      });

      expect(result.fullKey).toMatch(/^bgb_live_/);
    });

    it('throws BadRequestException for invalid expiresAt date', async () => {
      const { service } = buildService();

      await expect(
        service.create(ctx, {
          name: 'My Key',
          scopes: ['transactions:read'],
          expiresAt: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revoke', () => {
    it('throws NotFoundException when key does not exist in household', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);

      await expect(service.revoke(ctx, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('calls repo.revoke when key belongs to the household', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([makeApiKeySafeView({ id: 'key-1' })]);

      await service.revoke(ctx, 'key-1');

      expect(repo.revoke).toHaveBeenCalledWith('key-1', 'hh1');
    });

    it('throws NotFoundException when key belongs to a different household', async () => {
      const { service, repo } = buildService();
      // findAll scopes by household — a key from another household would simply not appear
      vi.mocked(repo.findAll).mockResolvedValue([makeApiKeySafeView({ id: 'other-key' })]);

      await expect(service.revoke(ctx, 'key-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyKey', () => {
    it('returns null when prefix not found in repository', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByPrefix).mockResolvedValue(null);

      const result = await service.verifyKey('bgb_live_abcd1234efghijklmnopqrstuvwxyz0123456789abcdef0123456789abcde');

      expect(result).toBeNull();
    });

    it('returns null when key is revoked', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByPrefix).mockResolvedValue(makeApiKey({ isRevoked: true }));

      const result = await service.verifyKey('bgb_live_abcd1234efghijklmnopqrstuvwxyz0123456789abcdef0123456789abcde');

      expect(result).toBeNull();
    });

    it('returns null when key is expired', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByPrefix).mockResolvedValue(
        makeApiKey({ expiresAt: new Date(Date.now() - 1000) }),
      );

      const result = await service.verifyKey('bgb_live_abcd1234efghijklmnopqrstuvwxyz0123456789abcdef0123456789abcde');

      expect(result).toBeNull();
    });

    it('returns null when argon2.verify returns false', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByPrefix).mockResolvedValue(makeApiKey());
      vi.mocked(argon2.verify).mockResolvedValue(false);

      const result = await service.verifyKey('bgb_live_abcd1234efghijklmnopqrstuvwxyz0123456789abcdef0123456789abcde');

      expect(result).toBeNull();
    });

    it('returns null for keys that do not start with bgb_live_', async () => {
      const { service } = buildService();

      const result = await service.verifyKey('some_other_prefix_abcd1234rest');

      expect(result).toBeNull();
    });

    it('returns VerifyKeyResult with householdId when key is valid', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByPrefix).mockResolvedValue(
        makeApiKey({
          id: 'key-1',
          householdId: 'hh1',
          scopes: ['transactions:read', 'overview:read'],
          isRevoked: false,
          expiresAt: null,
          hashedSecret: 'hashed-secret',
        }),
      );
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.verifyKey('bgb_live_abcd1234efghijklmnopqrstuvwxyz0123456789abcdef0123456789abcde');

      expect(result).not.toBeNull();
      expect(result!.householdId).toBe('hh1');
      expect(result!.apiKeyId).toBe('key-1');
      expect(result!.scopes).toEqual(['transactions:read', 'overview:read']);
    });

    it('calls updateLastUsed fire-and-forget on successful verification', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByPrefix).mockResolvedValue(makeApiKey({ id: 'key-1' }));
      vi.mocked(argon2.verify).mockResolvedValue(true);

      await service.verifyKey('bgb_live_abcd1234efghijklmnopqrstuvwxyz0123456789abcdef0123456789abcde');

      expect(repo.updateLastUsed).toHaveBeenCalledWith('key-1');
    });
  });
});

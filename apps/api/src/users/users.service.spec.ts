import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';
import type { User } from '@prisma/client';
import { AppRole } from '@prisma/client';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  emailVerified: true,
  displayName: 'Test User',
  passwordHash: 'hashed',
  appRole: AppRole.USER,
  isDeleted: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLoginAt: null,
  ...overrides,
});

const makeRepo = (): UsersRepository =>
  ({
    findByEmail: vi.fn(),
    findById: vi.fn(),
    existsByEmail: vi.fn(),
    countAll: vi.fn(),
    create: vi.fn(),
    updateLastLogin: vi.fn(),
    setEmailVerified: vi.fn(),
  }) as unknown as UsersRepository;

describe('UsersService', () => {
  let service: UsersService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new UsersService(repo);
  });

  describe('findByIdOrThrow', () => {
    it('throws NotFoundException when user not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.findByIdOrThrow('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns user when found', async () => {
      const user = makeUser();
      vi.mocked(repo.findById).mockResolvedValue(user);
      const result = await service.findByIdOrThrow('user-1');
      expect(result).toBe(user);
    });
  });

  describe('toAuthUser', () => {
    it('strips passwordHash and formats createdAt as ISO string', () => {
      const user = makeUser();
      const auth = service.toAuthUser(user);

      expect(auth).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        displayName: 'Test User',
        appRole: AppRole.USER,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect('passwordHash' in auth).toBe(false);
    });
  });
});

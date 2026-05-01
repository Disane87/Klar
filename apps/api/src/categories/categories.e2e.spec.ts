/**
 * E2E: Categories CRUD + Cross-Tenant Isolation
 *
 * Tests the categories endpoints under /api/v1/households/:hid/categories.
 * Uses a real test database (DATABASE_TEST_URL).
 *
 * Note: Registration auto-seeds default categories for the new household.
 * Tests that create custom categories add on top of those defaults.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

interface AuthTokens {
  accessToken: string;
}

interface HouseholdEntry {
  household: { id: string; name: string };
}

interface AuthSession {
  accessToken: string;
  householdId: string;
}

async function registerAndLogin(
  email: string,
  password = 'TestPass123!',
  displayName = 'Test User',
): Promise<AuthTokens> {
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName },
  });

  if (registerRes.statusCode !== 201) {
    throw new Error(`Register failed: ${registerRes.body}`);
  }

  // Bypass email verification for tests
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed: ${loginRes.body}`);
  }

  return JSON.parse(loginRes.body) as AuthTokens;
}

/**
 * Register + login + fetch the household that was auto-created on registration.
 */
async function createSession(
  email: string,
  password = 'TestPass123!',
): Promise<AuthSession> {
  const { accessToken } = await registerAndLogin(email, password);

  const householdsRes = await app.inject({
    method: 'GET',
    url: '/api/v1/households',
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (householdsRes.statusCode !== 200) {
    throw new Error(`Get households failed: ${householdsRes.body}`);
  }

  const households = JSON.parse(householdsRes.body) as HouseholdEntry[];
  const householdId = households[0].household.id;

  return { accessToken, householdId };
}

beforeAll(async () => {
  process.env['DATABASE_URL'] =
    process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  // Clean in FK-safe order: transactions before categories before households
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.project.deleteMany();
  await prisma.inviteCode.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

describe('GET /api/v1/households/:hid/categories', () => {
  it('returns the seeded default categories after registration', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const categories = JSON.parse(res.body) as { name: string; isDefault: boolean }[];
    expect(categories.length).toBeGreaterThan(0);
    // All seeded categories should be marked as default
    expect(categories.every(c => c.isDefault === true)).toBe(true);
  });

  it('includes a newly created custom category in the list', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Haustiere', type: 'EXPENSE', color: '#f59e0b' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const categories = JSON.parse(res.body) as { name: string }[];
    expect(categories.some(c => c.name === 'Haustiere')).toBe(true);
  });
});

describe('POST /api/v1/households/:hid/categories', () => {
  it('creates a category and returns trimmed name with correct defaults', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: '  Reisen  ', type: 'EXPENSE', color: '#06b6d4' },
    });

    expect(res.statusCode).toBe(201);
    const category = JSON.parse(res.body) as {
      name: string;
      type: string;
      color: string;
      isDefault: boolean;
      isArchived: boolean;
      householdId: string;
    };
    expect(category.name).toBe('Reisen'); // trimmed
    expect(category.type).toBe('EXPENSE');
    expect(category.color).toBe('#06b6d4');
    expect(category.isDefault).toBe(false);
    expect(category.isArchived).toBe(false);
    expect(category.householdId).toBe(householdId);
  });

  it('returns 400 when name is missing', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'EXPENSE', color: '#06b6d4' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when color is missing', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Test', type: 'EXPENSE' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for an invalid type', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Test', type: 'INVALID_TYPE', color: '#000000' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/v1/households/:hid/categories/:id', () => {
  it('updates the category name', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Altes Hobby', type: 'EXPENSE', color: '#8b5cf6' },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/households/${householdId}/categories/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Neues Hobby' },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body) as { name: string };
    expect(updated.name).toBe('Neues Hobby');
  });

  it('returns 404 for a non-existent category id', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/households/${householdId}/categories/nonexistent-id`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Ghost' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/households/:hid/categories/:id', () => {
  it('hard-deletes a category that has no transactions', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'ZuLöschen', type: 'EXPENSE', color: '#ef4444' },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/categories/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    // Verify it no longer appears in the list (not even archived — it was hard-deleted)
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/categories?includeArchived=true`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const categories = JSON.parse(listRes.body) as { id: string }[];
    expect(categories.some(c => c.id === created.id)).toBe(false);
  });

  it('soft-deletes (archives) a category that has transactions', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    // Create a custom category
    const createCatRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'MitBuchung', type: 'EXPENSE', color: '#f97316' },
    });
    const category = JSON.parse(createCatRes.body) as { id: string };

    // Attach a transaction to it
    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -1000,
        categoryId: category.id,
        date: '2026-05-01',
        description: 'Test-Buchung',
      },
    });

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/categories/${category.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    // Category should still exist but be archived
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/categories?includeArchived=true`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const categories = JSON.parse(listRes.body) as { id: string; isArchived: boolean }[];
    const found = categories.find(c => c.id === category.id);
    expect(found).toBeDefined();
    expect(found?.isArchived).toBe(true);
  });

  it('returns 404 when deleting a non-existent category', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/categories/nonexistent-id`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('Cross-tenant isolation', () => {
  it("returns 403 when User B tries to access User A's categories", async () => {
    const alice = await createSession('alice-ct@test.com');
    const bob = await createSession('bob-ct@test.com');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${alice.householdId}/categories`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when User B tries to create a category in User A's household", async () => {
    const alice = await createSession('alice-ct2@test.com');
    const bob = await createSession('bob-ct2@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${alice.householdId}/categories`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { name: 'Fremd', type: 'EXPENSE', color: '#000000' },
    });

    expect(res.statusCode).toBe(403);
  });
});

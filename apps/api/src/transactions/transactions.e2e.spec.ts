/**
 * E2E: Transactions CRUD + Filters + Cross-Tenant Isolation
 *
 * Tests the transactions endpoints under /api/v1/households/:hid/transactions.
 * Uses a real test database (DATABASE_TEST_URL).
 *
 * Setup: Registration auto-seeds default categories. Tests retrieve one of those
 * seeded category IDs so all transactions have a valid FK reference.
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

interface CategoryResponse {
  id: string;
  name: string;
  type: string;
}

interface AuthSession {
  accessToken: string;
  householdId: string;
  /** A valid category ID from the seeded defaults (type=EXPENSE) */
  expenseCategoryId: string;
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
 * Register + login + resolve household + pick a seeded EXPENSE category id.
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

  // Pick a seeded EXPENSE category
  const categoriesRes = await app.inject({
    method: 'GET',
    url: `/api/v1/households/${householdId}/categories`,
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const categories = JSON.parse(categoriesRes.body) as CategoryResponse[];
  const expenseCategory = categories.find(c => c.type === 'EXPENSE');
  if (!expenseCategory) {
    throw new Error('No seeded EXPENSE category found — check seedDefaults');
  }

  return { accessToken, householdId, expenseCategoryId: expenseCategory.id };
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
  // Clean in FK-safe order
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

describe('POST + GET /api/v1/households/:hid/transactions', () => {
  it('creates a transaction and retrieves it in the list', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -4200,
        categoryId: expenseCategoryId,
        date: '2026-05-01',
        description: 'Supermarkt',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as {
      id: string;
      amountCents: number;
      date: string;
      description: string;
      visibility: string;
      householdId: string;
    };
    expect(created.amountCents).toBe(-4200);
    expect(created.date).toBe('2026-05-01');
    expect(created.description).toBe('Supermarkt');
    expect(created.visibility).toBe('SHARED');
    expect(created.householdId).toBe(householdId);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const transactions = JSON.parse(listRes.body) as { id: string }[];
    expect(transactions.some(tx => tx.id === created.id)).toBe(true);
  });
});

describe('GET /api/v1/households/:hid/transactions?month=', () => {
  it('returns only transactions in the specified month', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    // Create one transaction in May 2026
    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -1000,
        categoryId: expenseCategoryId,
        date: '2026-05-15',
        description: 'Mai-Buchung',
      },
    });

    // Create one transaction in June 2026
    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -2000,
        categoryId: expenseCategoryId,
        date: '2026-06-01',
        description: 'Juni-Buchung',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/transactions?month=2026-05`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const transactions = JSON.parse(res.body) as { description: string }[];
    expect(transactions.every(tx => tx.description === 'Mai-Buchung')).toBe(true);
    expect(transactions.some(tx => tx.description === 'Juni-Buchung')).toBe(false);
  });

  it('returns an empty list when no transactions exist for the given month', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -500,
        categoryId: expenseCategoryId,
        date: '2026-05-01',
        description: 'Nur Mai',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/transactions?month=2026-04`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});

describe('PATCH /api/v1/households/:hid/transactions/:id', () => {
  it('updates the transaction description', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -3000,
        categoryId: expenseCategoryId,
        date: '2026-05-10',
        description: 'Ursprünglich',
      },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/households/${householdId}/transactions/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { description: 'Aktualisiert' },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body) as { description: string };
    expect(updated.description).toBe('Aktualisiert');
  });

  it('returns 404 when updating a non-existent transaction', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/households/${householdId}/transactions/nonexistent-id`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { description: 'Ghost' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/households/:hid/transactions/:id', () => {
  it('deletes a transaction and it no longer appears in the list', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -999,
        categoryId: expenseCategoryId,
        date: '2026-05-20',
        description: 'Zu löschen',
      },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/transactions/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const transactions = JSON.parse(listRes.body) as { id: string }[];
    expect(transactions.some(tx => tx.id === created.id)).toBe(false);
  });

  it('returns 404 when deleting a non-existent transaction', async () => {
    const { accessToken, householdId } = await createSession('alice@test.com');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/transactions/nonexistent-id`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('Validation: amountCents must be an integer', () => {
  it('rejects a float amountCents with 400', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: 9.99,
        categoryId: expenseCategoryId,
        date: '2026-05-01',
        description: 'Float-Fehler',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing amountCents with 400', async () => {
    const { accessToken, householdId, expenseCategoryId } =
      await createSession('alice@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        categoryId: expenseCategoryId,
        date: '2026-05-01',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('Cross-tenant isolation', () => {
  it("returns 403 when User B tries to list User A's transactions", async () => {
    const alice = await createSession('alice-ct@test.com');
    const bob = await createSession('bob-ct@test.com');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${alice.householdId}/transactions`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when User B tries to create a transaction in User A's household", async () => {
    const alice = await createSession('alice-ct2@test.com');
    const bob = await createSession('bob-ct2@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${alice.householdId}/transactions`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        amountCents: -500,
        categoryId: alice.expenseCategoryId,
        date: '2026-05-01',
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

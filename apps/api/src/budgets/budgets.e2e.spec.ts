/**
 * E2E: Budgets endpoints
 *
 * Tests PUT (upsert) and DELETE routes against a real test database
 * (DATABASE_TEST_URL).
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

interface AuthTokens { accessToken: string }

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

async function getHouseholdId(accessToken: string): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/households',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const households = JSON.parse(res.body) as { household: { id: string } }[];
  return households[0].household.id;
}

/** Create a category and return its id. */
async function createCategory(
  accessToken: string,
  householdId: string,
  name = 'Test-Kategorie',
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/households/${householdId}/categories`,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { name, type: 'EXPENSE', color: '#ff0000' },
  });

  if (res.statusCode !== 201) {
    throw new Error(`Create category failed: ${res.body}`);
  }

  return (JSON.parse(res.body) as { id: string }).id;
}

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];

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
  await prisma.auditLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.category.deleteMany();
  await prisma.project.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

describe('PUT /api/v1/households/:hid/budgets', () => {
  it('creates a budget and returns 200 with the budget object', async () => {
    const { accessToken } = await registerAndLogin('alice-bud@test.com');
    const householdId = await getHouseholdId(accessToken);
    const categoryId = await createCategory(accessToken, householdId);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: 50000 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      id: string;
      categoryId: string;
      month: string;
      amountCents: number;
    };
    expect(body.id).toBeDefined();
    expect(body.categoryId).toBe(categoryId);
    expect(body.amountCents).toBe(50000);
    expect(body.month).toBe('2026-05-01');
  });

  it('upserting the same month updates the existing budget', async () => {
    const { accessToken } = await registerAndLogin('alice-bud2@test.com');
    const householdId = await getHouseholdId(accessToken);
    const categoryId = await createCategory(accessToken, householdId);

    // First upsert
    await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: 50000 },
    });

    // Second upsert with different amount, same month
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: 75000 },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = JSON.parse(updateRes.body) as { amountCents: number };
    expect(body.amountCents).toBe(75000);

    // List should contain exactly one budget for this month
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/budgets?month=2026-05`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = JSON.parse(listRes.body) as unknown[];
    expect(list).toHaveLength(1);
  });

  it('rejects float amountCents with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-bud3@test.com');
    const householdId = await getHouseholdId(accessToken);
    const categoryId = await createCategory(accessToken, householdId);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: 9.99 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects non-positive amountCents (zero) with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-bud4@test.com');
    const householdId = await getHouseholdId(accessToken);
    const categoryId = await createCategory(accessToken, householdId);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: 0 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects negative amountCents with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-bud5@test.com');
    const householdId = await getHouseholdId(accessToken);
    const categoryId = await createCategory(accessToken, householdId);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: -1000 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing categoryId with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-bud6@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { month: '2026-05', amountCents: 50000 },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/v1/households/:hid/budgets/:id', () => {
  it('deletes an existing budget and returns 204', async () => {
    const { accessToken } = await registerAndLogin('alice-del-bud@test.com');
    const householdId = await getHouseholdId(accessToken);
    const categoryId = await createCategory(accessToken, householdId);

    // Create first
    const createRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/households/${householdId}/budgets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryId, month: '2026-05', amountCents: 50000 },
    });
    const { id } = JSON.parse(createRes.body) as { id: string };

    // Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/budgets/${id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    // Verify it is gone
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/budgets?month=2026-05`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = JSON.parse(listRes.body) as unknown[];
    expect(list).toHaveLength(0);
  });

  it('returns 404 when deleting a non-existent budget', async () => {
    const { accessToken } = await registerAndLogin('alice-del-bud2@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/budgets/non-existent-id`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

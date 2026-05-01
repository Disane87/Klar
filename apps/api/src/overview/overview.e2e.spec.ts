/**
 * E2E: Overview endpoints
 *
 * Tests fixed-costs, cashflow, and projects overview routes against a real
 * test database (DATABASE_TEST_URL).
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

describe('GET /api/v1/households/:hid/overview/fixed-costs', () => {
  it('returns 200 with month, totalCents, groups when no recurring transactions exist', async () => {
    const { accessToken } = await registerAndLogin('alice-fc@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/overview/fixed-costs?month=2026-05`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { month: string; totalCents: number; groups: unknown[] };
    expect(body.month).toBe('2026-05');
    expect(body.totalCents).toBe(0);
    expect(body.groups).toEqual([]);
  });

  it('defaults month to current year-month when query param is omitted', async () => {
    const { accessToken } = await registerAndLogin('alice-fc2@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/overview/fixed-costs`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { month: string; totalCents: number; groups: unknown[] };
    expect(body.month).toMatch(/^\d{4}-\d{2}$/);
    expect(typeof body.totalCents).toBe('number');
    expect(Array.isArray(body.groups)).toBe(true);
  });
});

describe('GET /api/v1/households/:hid/overview/cashflow', () => {
  it('returns 200 with all cashflow fields as zeros when no data exists', async () => {
    const { accessToken } = await registerAndLogin('alice-cf@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/overview/cashflow?month=2026-05`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      month: string;
      recurringIncomeCents: number;
      recurringExpensesCents: number;
      transactionIncomeCents: number;
      transactionExpensesCents: number;
      totalIncomeCents: number;
      totalExpensesCents: number;
      surplusCents: number;
    };
    expect(body.month).toBe('2026-05');
    expect(body.recurringIncomeCents).toBe(0);
    expect(body.recurringExpensesCents).toBe(0);
    expect(body.transactionIncomeCents).toBe(0);
    expect(body.transactionExpensesCents).toBe(0);
    expect(body.totalIncomeCents).toBe(0);
    expect(body.totalExpensesCents).toBe(0);
    expect(body.surplusCents).toBe(0);
  });

  it('defaults month to current year-month when query param is omitted', async () => {
    const { accessToken } = await registerAndLogin('alice-cf2@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/overview/cashflow`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { month: string };
    expect(body.month).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('GET /api/v1/households/:hid/overview/projects', () => {
  it('returns 200 with empty projects array when no projects exist', async () => {
    const { accessToken } = await registerAndLogin('alice-proj@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/overview/projects`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { projects: unknown[] };
    expect(body.projects).toEqual([]);
  });
});

describe('Overview: cross-tenant security', () => {
  it('returns 403 when user B tries to access user A overview/fixed-costs', async () => {
    const alice = await registerAndLogin('alice-ct-ov@test.com');
    await registerAndLogin('bob-ct-ov@test.com');

    const aliceHouseholdId = await getHouseholdId(alice.accessToken);

    const bobLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'bob-ct-ov@test.com', password: 'TestPass123!' },
    });
    const bob = JSON.parse(bobLoginRes.body) as AuthTokens;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${aliceHouseholdId}/overview/fixed-costs`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when user B tries to access user A overview/cashflow', async () => {
    const alice = await registerAndLogin('alice-ct-cf@test.com');
    await registerAndLogin('bob-ct-cf@test.com');

    const aliceHouseholdId = await getHouseholdId(alice.accessToken);

    const bobLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'bob-ct-cf@test.com', password: 'TestPass123!' },
    });
    const bob = JSON.parse(bobLoginRes.body) as AuthTokens;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${aliceHouseholdId}/overview/cashflow`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when user B tries to access user A overview/projects', async () => {
    const alice = await registerAndLogin('alice-ct-proj@test.com');
    await registerAndLogin('bob-ct-proj@test.com');

    const aliceHouseholdId = await getHouseholdId(alice.accessToken);

    const bobLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'bob-ct-proj@test.com', password: 'TestPass123!' },
    });
    const bob = JSON.parse(bobLoginRes.body) as AuthTokens;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${aliceHouseholdId}/overview/projects`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

/**
 * E2E: Admin telemetry endpoints (/admin/health/* + /admin/jobs)
 *
 * Verifies:
 *   - admin user (first registered) gets 200 + expected shape
 *   - non-admin user gets 403
 *   - unauthenticated request gets 401
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppModule } from '../../app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

async function register(email: string, password = 'TestPass123!', displayName = 'Test User') {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName },
  });
}

async function login(email: string, password = 'TestPass123!') {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
}

async function adminLogin(email: string): Promise<string> {
  await register(email);
  await prisma.user.update({ where: { email }, data: { emailVerified: true, appRole: 'ADMIN' } });
  const res = await login(email);
  if (res.statusCode !== 200) throw new Error(`admin login failed: ${res.body}`);
  return (JSON.parse(res.body) as { accessToken: string }).accessToken;
}

async function userLogin(email: string): Promise<string> {
  await register(email);
  await prisma.user.update({ where: { email }, data: { emailVerified: true, appRole: 'USER' } });
  const res = await login(email);
  if (res.statusCode !== 200) throw new Error(`user login failed: ${res.body}`);
  return (JSON.parse(res.body) as { accessToken: string }).accessToken;
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
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

const ENDPOINTS = [
  '/api/v1/admin/health/status',
  '/api/v1/admin/health/services',
  '/api/v1/admin/health/performance',
  '/api/v1/admin/health/db-queries',
  '/api/v1/admin/health/live-log',
  '/api/v1/admin/jobs',
] as const;

describe('Admin telemetry endpoints — auth', () => {
  for (const url of ENDPOINTS) {
    it(`${url} → 401 without token`, async () => {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(401);
    });

    it(`${url} → 403 for non-admin user`, async () => {
      const token = await userLogin(`u-${url.replace(/\W/g, '')}@test.com`);
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it(`${url} → 200 for admin user`, async () => {
      const token = await adminLogin(`a-${url.replace(/\W/g, '')}@test.com`);
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  }
});

describe('Admin telemetry endpoints — payload shape', () => {
  it('GET /admin/health/status returns expected fields', async () => {
    const token = await adminLogin('a-status@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(typeof body['uptimePct']).toBe('number');
    expect(body['uptimeWindow']).toBe('30d');
    expect(typeof body['dbSizeBytes']).toBe('number');
    expect(typeof body['warningCount']).toBe('number');
    expect(typeof body['activeSessions']).toBe('number');
  });

  it('GET /admin/health/services returns 5 services with 30 uptime bars', async () => {
    const token = await adminLogin('a-services@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/services',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body) as { services: Array<{ uptimeBars: number[] }> };
    expect(body.services).toHaveLength(5);
    expect(body.services[0]!.uptimeBars).toHaveLength(30);
  });

  it('GET /admin/health/performance returns 6 keyed rows', async () => {
    const token = await adminLogin('a-perf@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/performance',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body) as { rows: Array<{ key: string }> };
    expect(body.rows.map((r) => r.key)).toEqual([
      'cpu',
      'ram',
      'disk',
      'dbQueryAvg',
      'mailQueue',
      'mcpLatency',
    ]);
  });

  it('GET /admin/jobs returns at least one job', async () => {
    const token = await adminLogin('a-jobs@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/jobs',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body) as { jobs: Array<{ name: string; cron: string }> };
    expect(body.jobs.length).toBeGreaterThan(0);
    expect(body.jobs[0]!.name).toBeTruthy();
    expect(body.jobs[0]!.cron).toBeTruthy();
  });

  it('GET /admin/health/db-queries returns points + peak + avg', async () => {
    const token = await adminLogin('a-dbq@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/db-queries',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body) as { points: number[]; peak: number; avg: number };
    expect(Array.isArray(body.points)).toBe(true);
    expect(typeof body.peak).toBe('number');
    expect(typeof body.avg).toBe('number');
  });

  it('GET /admin/health/live-log returns an entries array', async () => {
    const token = await adminLogin('a-log@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/live-log?limit=10',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body) as { entries: unknown[] };
    expect(Array.isArray(body.entries)).toBe(true);
  });
});

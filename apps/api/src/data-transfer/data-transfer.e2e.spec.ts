/**
 * E2E: DataTransfer (Import / Export)
 *
 * Tests the import/export endpoints under /api/v1/households/:hid/
 *   GET  export
 *   POST import/analyze
 *   POST import/confirm
 *
 * Uses a real test database (DATABASE_TEST_URL → DATABASE_URL via e2e-setup.ts).
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

// ──────────────────────────────────────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────────────────────────────────────

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
  expenseCategoryName: string;
  expenseCategoryType: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

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
    throw new Error(`Register failed (${registerRes.statusCode}): ${registerRes.body}`);
  }

  // Bypass e-mail verification for tests
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
    throw new Error(`Login failed (${loginRes.statusCode}): ${loginRes.body}`);
  }

  return JSON.parse(loginRes.body) as AuthTokens;
}

/**
 * Register + login + resolve household + pick a seeded EXPENSE category.
 */
async function createSession(email: string, password = 'TestPass123!'): Promise<AuthSession> {
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

  const categoriesRes = await app.inject({
    method: 'GET',
    url: `/api/v1/households/${householdId}/categories`,
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const categories = JSON.parse(categoriesRes.body) as CategoryResponse[];
  // Seed liefert nur FIXED_EXPENSE / VARIABLE_EXPENSE (Legacy "EXPENSE" wurde
  // 2026-05-05 migriert). Wir nehmen die erste verfügbare Expense-Kategorie.
  const expenseCategory = categories.find(c =>
    c.type === 'FIXED_EXPENSE' || c.type === 'VARIABLE_EXPENSE' || c.type === 'EXPENSE',
  );
  if (!expenseCategory) {
    throw new Error('No seeded expense category found — check seedDefaults');
  }

  return {
    accessToken,
    householdId,
    expenseCategoryId: expenseCategory.id,
    expenseCategoryName: expenseCategory.name,
    expenseCategoryType: expenseCategory.type,
  };
}

/** Build a minimal valid export file JSON string for a single transaction. */
function buildExportFileContent(opts: {
  categoryName: string;
  categoryType?: string;
}): string {
  const payload = {
    version: '1',
    exportedAt: new Date().toISOString(),
    includes: ['transactions'],
    filters: { startDate: null, endDate: null },
    transactions: [
      {
        amountCents: -1000,
        date: '2026-01-15',
        description: 'Import-Test-Buchung',
        visibility: 'SHARED',
        category: {
          name: opts.categoryName,
          type: opts.categoryType ?? 'EXPENSE',
        },
        project: null,
      },
    ],
    recurringTransactions: [],
  };
  return JSON.stringify(payload);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test harness
// ──────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // e2e-setup.ts already remaps DATABASE_URL → DATABASE_TEST_URL; this is a
  // belt-and-suspenders guard for running the file directly.
  process.env['DATABASE_URL'] =
    process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';

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
  // Clean up in FK-safe order (same pattern as transactions.e2e.spec.ts)
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.project.deleteMany();
  await prisma.invitationLink.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /households/:hid/export
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/households/:hid/export', () => {
  it('returns 200 with Content-Disposition attachment header and version:"1" in the body', async () => {
    const { accessToken, householdId } = await createSession('alice-export@test.com');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/export`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);

    const disposition = res.headers['content-disposition'] as string;
    expect(disposition).toMatch(/^attachment;\s*filename=/);
    expect(disposition).toMatch(/klar-export-.*\.json/);

    const body = JSON.parse(res.body) as { version: string };
    expect(body.version).toBe('1');
  });

  it('returns 401 without an access token', async () => {
    // Create a household so the ID is valid, but send no auth header
    const { householdId } = await createSession('alice-export-401@test.com');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/export`,
      // No authorization header
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when a cross-tenant user tries to export another household', async () => {
    const alice = await createSession('alice-export-ct@test.com');
    const bob = await createSession('bob-export-ct@test.com');

    // Bob tries to access Alice's household
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${alice.householdId}/export`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('includes existing transactions in the export body', async () => {
    const { accessToken, householdId, expenseCategoryId } = await createSession('alice-export-data@test.com');

    // Create a transaction first
    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        amountCents: -2500,
        categoryId: expenseCategoryId,
        date: '2026-03-10',
        description: 'Export-Test',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/export`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { transactions: { description: string }[] };
    expect(body.transactions.some(tx => tx.description === 'Export-Test')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /households/:hid/import/analyze
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/households/:hid/import/analyze', () => {
  it('returns 201 with summary and categoryMappings for a valid exported file', async () => {
    const { accessToken, householdId, expenseCategoryName, expenseCategoryType } =
      await createSession('alice-analyze@test.com');

    const fileContent = buildExportFileContent({
      categoryName: expenseCategoryName,
      categoryType: expenseCategoryType,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { fileContent },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      summary: { transactions: number; recurringTransactions: number };
      categoryMappings: { source: { name: string; type: string }; resolvedId: string | null }[];
    };

    expect(body.summary.transactions).toBe(1);
    expect(body.summary.recurringTransactions).toBe(0);
    expect(body.categoryMappings).toHaveLength(1);
    // Category should auto-resolve because it exists in the household
    expect(body.categoryMappings[0].resolvedId).toBeTruthy();
  });

  it('returns 400 when fileContent is missing', async () => {
    const { accessToken, householdId } = await createSession('alice-analyze-400@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when fileContent is invalid JSON', async () => {
    const { accessToken, householdId } = await createSession('alice-analyze-badjson@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { fileContent: 'not-valid-json!!!' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when fileContent is valid JSON but fails schema validation', async () => {
    const { accessToken, householdId } = await createSession('alice-analyze-badschema@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { fileContent: JSON.stringify({ not: 'a klar export' }) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without an access token', async () => {
    const { householdId } = await createSession('alice-analyze-401@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      payload: { fileContent: buildExportFileContent({ categoryName: 'Lebensmittel' }) },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for cross-tenant access', async () => {
    const alice = await createSession('alice-analyze-ct@test.com');
    const bob = await createSession('bob-analyze-ct@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${alice.householdId}/import/analyze`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { fileContent: buildExportFileContent({ categoryName: 'Lebensmittel' }) },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /households/:hid/import/confirm — round-trip tests
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/households/:hid/import/confirm', () => {
  it('imports transactions into the destination household (same-household round-trip)', async () => {
    const { accessToken, householdId, expenseCategoryName, expenseCategoryType, expenseCategoryId } =
      await createSession('alice-confirm@test.com');

    const fileContent = buildExportFileContent({ categoryName: expenseCategoryName, categoryType: expenseCategoryType });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/confirm`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        fileContent,
        categoryMappings: [
          { sourceName: expenseCategoryName, sourceType: expenseCategoryType, targetId: expenseCategoryId },
        ],
        projectMappings: [],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      imported: { transactions: number; recurringTransactions: number };
      skipped: number;
    };
    expect(body.imported.transactions).toBe(1);
    expect(body.imported.recurringTransactions).toBe(0);
    expect(body.skipped).toBe(0);

    // Verify the transaction actually exists in the DB
    const txList = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/transactions`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const transactions = JSON.parse(txList.body) as { description: string }[];
    expect(transactions.some(tx => tx.description === 'Import-Test-Buchung')).toBe(true);
  });

  it('cross-household round-trip: export from A → import into B, transaction appears in B', async () => {
    const alice = await createSession('alice-rtrip@test.com');
    const bob = await createSession('bob-rtrip@test.com');

    // Step 1: Export from Alice's household (use Alice's expense category name)
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${alice.householdId}/export`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(exportRes.statusCode).toBe(200);

    // The exported file has 0 transactions (empty household), so we build a
    // synthetic one using Alice's category name so we can map it to Bob's
    // matching category by name.
    const fileContent = buildExportFileContent({
      categoryName: alice.expenseCategoryName,
      categoryType: alice.expenseCategoryType,
    });

    // Step 2: Analyze in Bob's household
    const analyzeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${bob.householdId}/import/analyze`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { fileContent },
    });
    expect(analyzeRes.statusCode).toBe(201);

    const analyzeBody = JSON.parse(analyzeRes.body) as {
      categoryMappings: { source: { name: string; type: string }; resolvedId: string | null }[];
    };

    // Step 3: Confirm — use the auto-resolved category from Bob's household
    const catMapping = analyzeBody.categoryMappings[0];
    // If auto-resolved, use that; otherwise use Bob's expense category
    const targetCategoryId = catMapping.resolvedId ?? bob.expenseCategoryId;

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${bob.householdId}/import/confirm`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        fileContent,
        categoryMappings: [
          {
            sourceName: catMapping.source.name,
            sourceType: catMapping.source.type,
            targetId: targetCategoryId,
          },
        ],
        projectMappings: [],
      },
    });

    expect(confirmRes.statusCode).toBe(201);
    const confirmBody = JSON.parse(confirmRes.body) as {
      imported: { transactions: number };
    };
    expect(confirmBody.imported.transactions).toBe(1);

    // Verify the transaction appears in Bob's household
    const bobTxRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${bob.householdId}/transactions`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    const bobTxs = JSON.parse(bobTxRes.body) as { description: string }[];
    expect(bobTxs.some(tx => tx.description === 'Import-Test-Buchung')).toBe(true);

    // Verify the transaction does NOT appear in Alice's household
    const aliceTxRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${alice.householdId}/transactions`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const aliceTxs = JSON.parse(aliceTxRes.body) as { description: string }[];
    expect(aliceTxs.some(tx => tx.description === 'Import-Test-Buchung')).toBe(false);
  });

  it('returns 422 when categoryMapping references a categoryId from a foreign household', async () => {
    const alice = await createSession('alice-422@test.com');
    const bob = await createSession('bob-422@test.com');

    const fileContent = buildExportFileContent({
      categoryName: alice.expenseCategoryName,
      categoryType: alice.expenseCategoryType,
    });

    // Bob tries to confirm with Alice's category ID (cross-tenant category)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${bob.householdId}/import/confirm`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        fileContent,
        categoryMappings: [
          {
            sourceName: alice.expenseCategoryName,
            sourceType: alice.expenseCategoryType,
            targetId: alice.expenseCategoryId, // ← belongs to Alice's household
          },
        ],
        projectMappings: [],
      },
    });

    expect(res.statusCode).toBe(422);
  });

  it('returns 400 when fileContent is missing', async () => {
    const { accessToken, householdId } = await createSession('alice-confirm-400@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/confirm`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { categoryMappings: [], projectMappings: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without an access token', async () => {
    const { householdId, expenseCategoryName } = await createSession('alice-confirm-401@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/confirm`,
      payload: {
        fileContent: buildExportFileContent({ categoryName: expenseCategoryName }),
        categoryMappings: [],
        projectMappings: [],
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for cross-tenant confirm attempt', async () => {
    const alice = await createSession('alice-confirm-ct@test.com');
    const bob = await createSession('bob-confirm-ct@test.com');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${alice.householdId}/import/confirm`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        fileContent: buildExportFileContent({ categoryName: 'Lebensmittel' }),
        categoryMappings: [],
        projectMappings: [],
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

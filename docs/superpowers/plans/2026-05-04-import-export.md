# Import / Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSON-based import/export for Transactions and RecurringTransactions so data can be transferred between Dev and Prod environments.

**Architecture:** New NestJS module `data-transfer` with three endpoints (export, analyze, confirm). Shared zod schema in `packages/shared`. Angular settings page gets a new "Import / Export" section with export form and file-upload import flow including a category/project mapping dialog.

**Tech Stack:** NestJS 11 + Fastify, Prisma, zod (shared schema), Angular 21 (Zoneless, Signals), Spartan UI → klar-* components, Vitest unit + E2E tests, Playwright.

---

## File Map

**Create:**
- `packages/shared/src/schemas.ts` — extend with `KlarExportFileSchema` and types (append only)
- `apps/api/src/data-transfer/data-transfer.repository.ts`
- `apps/api/src/data-transfer/data-transfer.service.ts`
- `apps/api/src/data-transfer/data-transfer.service.spec.ts`
- `apps/api/src/data-transfer/data-transfer.controller.ts`
- `apps/api/src/data-transfer/data-transfer.module.ts`
- `apps/api/src/data-transfer/data-transfer.e2e.spec.ts`
- `apps/web/src/app/core/data-transfer/data-transfer.service.ts`
- `apps/web/src/app/pages/settings/data-export.component.ts`
- `apps/web/src/app/pages/settings/data-export.component.html`
- `apps/web/src/app/pages/settings/data-import.component.ts`
- `apps/web/src/app/pages/settings/data-import.component.html`
- `apps/web/src/app/pages/settings/import-mapping-dialog.component.ts`
- `apps/web/src/app/pages/settings/import-mapping-dialog.component.html`
- `e2e/import-export.spec.ts`

**Modify:**
- `apps/api/src/app.module.ts` — add `DataTransferModule`
- `apps/web/src/app/pages/settings/settings.component.ts` — import new components
- `apps/web/src/app/pages/settings/settings.component.html` — add Import/Export section

---

## Task 1: Zod Schema in packages/shared

**Files:**
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1.1: Add schemas** — append to the end of `packages/shared/src/schemas.ts`:

```ts
// ─── Import / Export ──────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const KlarExportTransactionSchema = z.object({
  amountCents: z.number().int(),
  date: isoDate,
  description: z.string().nullable().optional(),
  visibility: z.enum(['SHARED', 'PRIVATE']),
  category: z.object({ name: z.string(), type: z.enum(['EXPENSE', 'INCOME', 'FIXED_INCOME']) }),
  project: z.object({ name: z.string() }).nullable().optional(),
});

export const KlarExportRecurringSchema = z.object({
  name: z.string(),
  amountCents: z.number().int(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM_DAYS']),
  customDays: z.number().int().nullable().optional(),
  dayOfMonth: z.number().int().nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  visibility: z.enum(['SHARED', 'PRIVATE']),
  isVariable: z.boolean(),
  isActive: z.boolean(),
  note: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  category: z.object({ name: z.string(), type: z.enum(['EXPENSE', 'INCOME', 'FIXED_INCOME']) }),
  project: z.object({ name: z.string() }).nullable().optional(),
});

export const KlarExportFileSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.string(),
  includes: z.array(z.enum(['transactions', 'recurringTransactions'])),
  filters: z.object({
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
  }),
  transactions: z.array(KlarExportTransactionSchema).optional().default([]),
  recurringTransactions: z.array(KlarExportRecurringSchema).optional().default([]),
});

export type KlarExportFile = z.infer<typeof KlarExportFileSchema>;
export type KlarExportTransaction = z.infer<typeof KlarExportTransactionSchema>;
export type KlarExportRecurring = z.infer<typeof KlarExportRecurringSchema>;
```

- [ ] **Step 1.2: Verify compile** — run:
  ```bash
  pnpm --filter @klar/shared build
  ```
  Expected: exits 0, no TS errors.

- [ ] **Step 1.3: Commit**
  ```bash
  git add packages/shared/src/schemas.ts
  git commit -m "feat(shared): add KlarExportFile zod schema for import/export"
  ```

---

## Task 2: Backend Repository

**Files:**
- Create: `apps/api/src/data-transfer/data-transfer.repository.ts`

- [ ] **Step 2.1: Create the repository file:**

```ts
// apps/api/src/data-transfer/data-transfer.repository.ts
import { Injectable } from '@nestjs/common';
import type { Category, Project, Transaction, RecurringTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ExportOpts {
  include: ('transactions' | 'recurringTransactions')[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class DataTransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTransactionsForExport(
    householdId: string,
    opts: ExportOpts,
  ): Promise<(Transaction & { category: Category; project: Project | null })[]> {
    const dateWhere: Record<string, Date> = {};
    if (opts.startDate) dateWhere['gte'] = toUtcDate(opts.startDate);
    if (opts.endDate) dateWhere['lte'] = toUtcDate(opts.endDate);

    return this.prisma.transaction.findMany({
      where: {
        householdId,
        ...(Object.keys(dateWhere).length ? { date: dateWhere } : {}),
      },
      include: { category: true, project: true },
      orderBy: { date: 'asc' },
    }) as Promise<(Transaction & { category: Category; project: Project | null })[]>;
  }

  findRecurringTransactionsForExport(
    householdId: string,
  ): Promise<(RecurringTransaction & { category: Category; project: Project | null })[]> {
    return this.prisma.recurringTransaction.findMany({
      where: { householdId },
      include: { category: true, project: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<(RecurringTransaction & { category: Category; project: Project | null })[]>;
  }

  findCategoriesByNames(
    householdId: string,
    entries: { name: string; type: string }[],
  ): Promise<Category[]> {
    if (!entries.length) return Promise.resolve([]);
    return this.prisma.category.findMany({
      where: {
        householdId,
        OR: entries.map(e => ({
          name: { equals: e.name, mode: 'insensitive' as const },
          type: e.type as Category['type'],
        })),
      },
    });
  }

  findProjectsByNames(householdId: string, names: string[]): Promise<Project[]> {
    if (!names.length) return Promise.resolve([]);
    return this.prisma.project.findMany({
      where: {
        householdId,
        name: { in: names, mode: 'insensitive' },
      },
    });
  }

  findAllCategories(householdId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  findAllProjects(householdId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
    });
  }

  findCategoryById(householdId: string, id: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, householdId } });
  }

  findProjectById(householdId: string, id: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, householdId } });
  }

  createTransaction(data: {
    householdId: string;
    createdByUserId: string;
    amountCents: number;
    categoryId: string;
    projectId: string | null;
    date: Date;
    description: string | null;
    visibility: 'SHARED' | 'PRIVATE';
  }): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  createRecurringTransaction(data: {
    householdId: string;
    createdByUserId: string;
    name: string;
    amountCents: number;
    categoryId: string;
    projectId: string | null;
    frequency: RecurringTransaction['frequency'];
    customDays: number | null;
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
    visibility: 'SHARED' | 'PRIVATE';
    isVariable: boolean;
    isActive: boolean;
    note: string | null;
    color: string | null;
    icon: string | null;
  }): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.create({ data });
  }
}
```

- [ ] **Step 2.2: Verify TypeScript** — run:
  ```bash
  pnpm --filter api lint
  ```
  Expected: no errors on the new file.

---

## Task 3: Backend Service — Unit Tests + Implementation

**Files:**
- Create: `apps/api/src/data-transfer/data-transfer.service.ts`
- Create: `apps/api/src/data-transfer/data-transfer.service.spec.ts`

- [ ] **Step 3.1: Write failing unit tests:**

```ts
// apps/api/src/data-transfer/data-transfer.service.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { DataTransferService } from './data-transfer.service';
import type { DataTransferRepository } from './data-transfer.repository';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const mockCat = (overrides = {}) => ({
  id: 'cat-1', householdId: 'hh1', name: 'Lebensmittel', type: 'EXPENSE',
  color: '#000', icon: null, isArchived: false, sortOrder: 0, isDefault: false,
  createdAt: new Date(), ...overrides,
});

function buildService() {
  const repo = {
    findTransactionsForExport: vi.fn().mockResolvedValue([]),
    findRecurringTransactionsForExport: vi.fn().mockResolvedValue([]),
    findCategoriesByNames: vi.fn().mockResolvedValue([]),
    findProjectsByNames: vi.fn().mockResolvedValue([]),
    findAllCategories: vi.fn().mockResolvedValue([]),
    findAllProjects: vi.fn().mockResolvedValue([]),
    findCategoryById: vi.fn().mockResolvedValue(null),
    findProjectById: vi.fn().mockResolvedValue(null),
    createTransaction: vi.fn(),
    createRecurringTransaction: vi.fn(),
  } as unknown as DataTransferRepository;
  return { service: new DataTransferService(repo), repo };
}

const validFile = JSON.stringify({
  version: '1',
  exportedAt: '2026-05-04T00:00:00Z',
  includes: ['transactions'],
  filters: { startDate: null, endDate: null },
  transactions: [
    {
      amountCents: -1500,
      date: '2025-04-15',
      description: 'Rewe',
      visibility: 'SHARED',
      category: { name: 'Lebensmittel', type: 'EXPENSE' },
      project: null,
    },
  ],
  recurringTransactions: [],
});

describe('DataTransferService', () => {
  describe('export', () => {
    it('calls repo with householdId and returns version 1 payload', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findTransactionsForExport).mockResolvedValue([]);
      vi.mocked(repo.findRecurringTransactionsForExport).mockResolvedValue([]);
      const result = await service.export(ctx, { include: ['transactions', 'recurringTransactions'] });
      expect(result.version).toBe('1');
      expect(result.includes).toContain('transactions');
      expect(repo.findTransactionsForExport).toHaveBeenCalledWith('hh1', expect.any(Object));
    });

    it('maps transaction to export format without ids', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findTransactionsForExport).mockResolvedValue([
        {
          id: 'tx-1', householdId: 'hh1', createdByUserId: 'u1',
          amountCents: -1500, date: new Date('2025-04-15'),
          description: 'Rewe', visibility: 'SHARED' as const,
          categoryId: 'cat-1', projectId: null, recurringTransactionId: null,
          createdAt: new Date(), updatedAt: new Date(),
          category: mockCat(), project: null,
        },
      ] as never);
      const result = await service.export(ctx, { include: ['transactions'] });
      const tx = result.transactions![0];
      expect('id' in tx).toBe(false);
      expect(tx.amountCents).toBe(-1500);
      expect(tx.category.name).toBe('Lebensmittel');
    });
  });

  describe('analyze', () => {
    it('throws BadRequestException for invalid JSON', async () => {
      const { service } = buildService();
      await expect(service.analyze(ctx, 'not-json')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for wrong version', async () => {
      const { service } = buildService();
      const bad = JSON.stringify({ version: '2', exportedAt: '', includes: [], filters: {} });
      await expect(service.analyze(ctx, bad)).rejects.toThrow(BadRequestException);
    });

    it('returns resolvedId for matched category', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([mockCat()]);
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCat()]);
      vi.mocked(repo.findAllProjects).mockResolvedValue([]);
      const result = await service.analyze(ctx, validFile);
      const catMap = result.categoryMappings.find(m => m.source.name === 'Lebensmittel');
      expect(catMap?.resolvedId).toBe('cat-1');
    });

    it('returns resolvedId null for unmatched category', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([]);
      vi.mocked(repo.findAllCategories).mockResolvedValue([]);
      vi.mocked(repo.findAllProjects).mockResolvedValue([]);
      const result = await service.analyze(ctx, validFile);
      const catMap = result.categoryMappings.find(m => m.source.name === 'Lebensmittel');
      expect(catMap?.resolvedId).toBeNull();
    });
  });

  describe('confirm', () => {
    it('throws BadRequestException when a categoryMapping is missing for unresolved category', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([]);
      await expect(
        service.confirm(ctx, validFile, { categoryMappings: [], projectMappings: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException when targetId not in household', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([]);
      vi.mocked(repo.findCategoryById).mockResolvedValue(null);
      await expect(
        service.confirm(ctx, validFile, {
          categoryMappings: [{ sourceName: 'Lebensmittel', sourceType: 'EXPENSE', targetId: 'bad-id' }],
          projectMappings: [],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('calls createTransaction for each transaction when all resolved', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([mockCat()]);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCat());
      vi.mocked(repo.createTransaction).mockResolvedValue({} as never);
      const result = await service.confirm(ctx, validFile, { categoryMappings: [], projectMappings: [] });
      expect(repo.createTransaction).toHaveBeenCalledTimes(1);
      expect(result.imported.transactions).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });
});
```

- [ ] **Step 3.2: Run tests — verify they fail:**
  ```bash
  pnpm --filter api test -- data-transfer.service.spec.ts
  ```
  Expected: FAIL — `DataTransferService` not found.

- [ ] **Step 3.3: Implement the service:**

```ts
// apps/api/src/data-transfer/data-transfer.service.ts
import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { KlarExportFileSchema } from '@klar/shared';
import type { KlarExportFile } from '@klar/shared';
import type { RequestContext } from '../common/types/request-context.type';
import type { DataTransferRepository, ExportOpts } from './data-transfer.repository';

export interface AnalyzeResult {
  summary: { transactions: number; recurringTransactions: number };
  categoryMappings: { source: { name: string; type: string }; resolvedId: string | null }[];
  projectMappings: { source: { name: string }; resolvedId: string | null }[];
  availableCategories: { id: string; name: string; type: string }[];
  availableProjects: { id: string; name: string }[];
}

export interface ConfirmMappings {
  categoryMappings: { sourceName: string; sourceType: string; targetId: string }[];
  projectMappings: { sourceName: string; targetId: string }[];
}

export interface ImportResult {
  imported: { transactions: number; recurringTransactions: number };
  skipped: number;
}

function parsePlainDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parseAndValidateFile(fileContent: string): KlarExportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(fileContent);
  } catch {
    throw new BadRequestException('Ungültige Export-Datei: kein gültiges JSON');
  }
  const result = KlarExportFileSchema.safeParse(raw);
  if (!result.success) {
    throw new BadRequestException('Ungültige Export-Datei: Schema-Validierung fehlgeschlagen');
  }
  return result.data;
}

@Injectable()
export class DataTransferService {
  constructor(private readonly repo: DataTransferRepository) {}

  async export(ctx: RequestContext, opts: ExportOpts): Promise<KlarExportFile> {
    const include = opts.include ?? ['transactions', 'recurringTransactions'];

    const [transactions, recurringTransactions] = await Promise.all([
      include.includes('transactions')
        ? this.repo.findTransactionsForExport(ctx.householdId, opts)
        : Promise.resolve([]),
      include.includes('recurringTransactions')
        ? this.repo.findRecurringTransactionsForExport(ctx.householdId)
        : Promise.resolve([]),
    ]);

    return {
      version: '1',
      exportedAt: new Date().toISOString(),
      includes: include,
      filters: {
        startDate: opts.startDate ?? null,
        endDate: opts.endDate ?? null,
      },
      transactions: transactions.map(tx => ({
        amountCents: tx.amountCents,
        date: tx.date.toISOString().slice(0, 10),
        description: tx.description ?? null,
        visibility: tx.visibility as 'SHARED' | 'PRIVATE',
        category: { name: tx.category.name, type: tx.category.type as 'EXPENSE' | 'INCOME' | 'FIXED_INCOME' },
        project: tx.project ? { name: tx.project.name } : null,
      })),
      recurringTransactions: recurringTransactions.map(rt => ({
        name: rt.name,
        amountCents: rt.amountCents,
        frequency: rt.frequency as 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM_DAYS',
        customDays: rt.customDays ?? null,
        dayOfMonth: rt.dayOfMonth ?? null,
        startDate: rt.startDate.toISOString().slice(0, 10),
        endDate: rt.endDate ? rt.endDate.toISOString().slice(0, 10) : null,
        visibility: rt.visibility as 'SHARED' | 'PRIVATE',
        isVariable: rt.isVariable,
        isActive: rt.isActive,
        note: rt.note ?? null,
        color: rt.color ?? null,
        icon: rt.icon ?? null,
        category: { name: rt.category.name, type: rt.category.type as 'EXPENSE' | 'INCOME' | 'FIXED_INCOME' },
        project: rt.project ? { name: rt.project.name } : null,
      })),
    };
  }

  async analyze(ctx: RequestContext, fileContent: string): Promise<AnalyzeResult> {
    const file = parseAndValidateFile(fileContent);

    // Collect unique category {name, type} combos from file
    const allEntries = [
      ...(file.transactions ?? []).map(t => t.category),
      ...(file.recurringTransactions ?? []).map(r => r.category),
    ];
    const uniqueCatKeys = new Map<string, { name: string; type: string }>();
    for (const c of allEntries) {
      uniqueCatKeys.set(`${c.name.toLowerCase()}::${c.type}`, c);
    }
    const catEntries = [...uniqueCatKeys.values()];

    // Collect unique project names
    const allProjNames = [
      ...(file.transactions ?? []).flatMap(t => t.project ? [t.project.name] : []),
      ...(file.recurringTransactions ?? []).flatMap(r => r.project ? [r.project.name] : []),
    ];
    const uniqueProjNames = [...new Set(allProjNames.map(n => n.toLowerCase()))];

    const [matchedCats, matchedProjects, availableCategories, availableProjects] =
      await Promise.all([
        this.repo.findCategoriesByNames(ctx.householdId, catEntries),
        this.repo.findProjectsByNames(ctx.householdId, uniqueProjNames),
        this.repo.findAllCategories(ctx.householdId),
        this.repo.findAllProjects(ctx.householdId),
      ]);

    const categoryMappings = catEntries.map(entry => {
      const match = matchedCats.find(
        c => c.name.toLowerCase() === entry.name.toLowerCase() && c.type === entry.type,
      );
      return { source: entry, resolvedId: match?.id ?? null };
    });

    const projectMappings = uniqueProjNames.map(nameLower => {
      const original = allProjNames.find(n => n.toLowerCase() === nameLower) ?? nameLower;
      const match = matchedProjects.find(p => p.name.toLowerCase() === nameLower);
      return { source: { name: original }, resolvedId: match?.id ?? null };
    });

    return {
      summary: {
        transactions: (file.transactions ?? []).length,
        recurringTransactions: (file.recurringTransactions ?? []).length,
      },
      categoryMappings,
      projectMappings,
      availableCategories: availableCategories.map(c => ({ id: c.id, name: c.name, type: c.type })),
      availableProjects: availableProjects.map(p => ({ id: p.id, name: p.name })),
    };
  }

  async confirm(
    ctx: RequestContext,
    fileContent: string,
    mappings: ConfirmMappings,
  ): Promise<ImportResult> {
    const file = parseAndValidateFile(fileContent);

    // Build lookup maps from provided mappings
    const catMap = new Map<string, string>(
      mappings.categoryMappings.map(m => [`${m.sourceName.toLowerCase()}::${m.sourceType}`, m.targetId]),
    );
    const projMap = new Map<string, string>(
      mappings.projectMappings.map(m => [m.sourceName.toLowerCase(), m.targetId]),
    );

    // Auto-resolve from DB (same logic as analyze, fill in what was already matched)
    const allCatEntries = [
      ...(file.transactions ?? []).map(t => t.category),
      ...(file.recurringTransactions ?? []).map(r => r.category),
    ];
    const uniqueCatKeys = [...new Map(allCatEntries.map(c => [`${c.name.toLowerCase()}::${c.type}`, c])).values()];
    const dbCats = await this.repo.findCategoriesByNames(ctx.householdId, uniqueCatKeys);
    for (const c of dbCats) {
      const key = `${c.name.toLowerCase()}::${c.type}`;
      if (!catMap.has(key)) catMap.set(key, c.id);
    }

    // Validate all mappings point to categories in this household
    for (const [key, targetId] of catMap) {
      const cat = await this.repo.findCategoryById(ctx.householdId, targetId);
      if (!cat) {
        throw new UnprocessableEntityException(
          `Kategorie ${targetId} (Mapping für ${key}) nicht im Haushalt gefunden`,
        );
      }
    }

    // Validate all categories have a mapping
    for (const entry of uniqueCatKeys) {
      const key = `${entry.name.toLowerCase()}::${entry.type}`;
      if (!catMap.has(key)) {
        throw new BadRequestException(
          `Mapping für Kategorie "${entry.name}" (${entry.type}) fehlt`,
        );
      }
    }

    let txImported = 0;
    let rtImported = 0;
    let skipped = 0;

    for (const tx of file.transactions ?? []) {
      const catKey = `${tx.category.name.toLowerCase()}::${tx.category.type}`;
      const categoryId = catMap.get(catKey);
      if (!categoryId) { skipped++; continue; }

      const projectId = tx.project
        ? (projMap.get(tx.project.name.toLowerCase()) ?? null)
        : null;

      try {
        await this.repo.createTransaction({
          householdId: ctx.householdId,
          createdByUserId: ctx.userId,
          amountCents: tx.amountCents,
          categoryId,
          projectId,
          date: parsePlainDate(tx.date),
          description: tx.description ?? null,
          visibility: tx.visibility,
        });
        txImported++;
      } catch {
        skipped++;
      }
    }

    for (const rt of file.recurringTransactions ?? []) {
      const catKey = `${rt.category.name.toLowerCase()}::${rt.category.type}`;
      const categoryId = catMap.get(catKey);
      if (!categoryId) { skipped++; continue; }

      const projectId = rt.project
        ? (projMap.get(rt.project.name.toLowerCase()) ?? null)
        : null;

      try {
        await this.repo.createRecurringTransaction({
          householdId: ctx.householdId,
          createdByUserId: ctx.userId,
          name: rt.name,
          amountCents: rt.amountCents,
          categoryId,
          projectId,
          frequency: rt.frequency,
          customDays: rt.customDays ?? null,
          dayOfMonth: rt.dayOfMonth ?? null,
          startDate: parsePlainDate(rt.startDate),
          endDate: rt.endDate ? parsePlainDate(rt.endDate) : null,
          visibility: rt.visibility,
          isVariable: rt.isVariable,
          isActive: rt.isActive,
          note: rt.note ?? null,
          color: rt.color ?? null,
          icon: rt.icon ?? null,
        });
        rtImported++;
      } catch {
        skipped++;
      }
    }

    return { imported: { transactions: txImported, recurringTransactions: rtImported }, skipped };
  }
}
```

- [ ] **Step 3.4: Run tests — verify they pass:**
  ```bash
  pnpm --filter api test -- data-transfer.service.spec.ts
  ```
  Expected: all tests PASS.

- [ ] **Step 3.5: Commit**
  ```bash
  git add apps/api/src/data-transfer/data-transfer.service.ts \
          apps/api/src/data-transfer/data-transfer.service.spec.ts
  git commit -m "feat(api): add DataTransferService with export/analyze/confirm logic"
  ```

---

## Task 4: Backend Controller + Module + App Registration

**Files:**
- Create: `apps/api/src/data-transfer/data-transfer.controller.ts`
- Create: `apps/api/src/data-transfer/data-transfer.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 4.1: Create the controller:**

```ts
// apps/api/src/data-transfer/data-transfer.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { DataTransferService } from './data-transfer.service';
import type { ConfirmMappings } from './data-transfer.service';

@Controller('households/:hid')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class DataTransferController {
  constructor(private readonly service: DataTransferService) {}

  @Get('export')
  async export(
    @ReqContext() ctx: RequestContext,
    @Query('include') includeRaw: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const include = includeRaw
      ? (includeRaw.split(',').map(s => s.trim()) as ('transactions' | 'recurringTransactions')[])
      : ['transactions', 'recurringTransactions'] as const;

    const data = await this.service.export(ctx, { include: [...include], startDate, endDate });
    const date = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="klar-export-${date}.json"`)
      .send(data);
  }

  @Post('import/analyze')
  async analyze(
    @ReqContext() ctx: RequestContext,
    @Body('fileContent') fileContent: string | undefined,
  ) {
    if (!fileContent) throw new BadRequestException('fileContent ist erforderlich');
    return this.service.analyze(ctx, fileContent);
  }

  @Post('import/confirm')
  async confirm(
    @ReqContext() ctx: RequestContext,
    @Body('fileContent') fileContent: string | undefined,
    @Body('categoryMappings') categoryMappings: ConfirmMappings['categoryMappings'] = [],
    @Body('projectMappings') projectMappings: ConfirmMappings['projectMappings'] = [],
  ) {
    if (!fileContent) throw new BadRequestException('fileContent ist erforderlich');
    return this.service.confirm(ctx, fileContent, { categoryMappings, projectMappings });
  }
}
```

- [ ] **Step 4.2: Create the module:**

```ts
// apps/api/src/data-transfer/data-transfer.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { DataTransferRepository } from './data-transfer.repository';
import { DataTransferService } from './data-transfer.service';
import { DataTransferController } from './data-transfer.controller';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [DataTransferRepository, DataTransferService],
  controllers: [DataTransferController],
})
export class DataTransferModule {}
```

- [ ] **Step 4.3: Register in `apps/api/src/app.module.ts`** — add import after `MailTemplatesModule`:

In `app.module.ts`, add to the imports array (after line `import { MailTemplatesModule } ...`):
```ts
import { DataTransferModule } from './data-transfer/data-transfer.module';
```
And add `DataTransferModule` to the `imports` array after `MailTemplatesModule`.

- [ ] **Step 4.4: Verify compile:**
  ```bash
  pnpm --filter api lint
  ```
  Expected: no TypeScript errors.

- [ ] **Step 4.5: Smoke-test the server starts:**
  ```bash
  pnpm --filter api dev &
  sleep 5 && curl http://localhost:3000/health
  ```
  Expected: `{"status":"ok"}` (or similar health response).

- [ ] **Step 4.6: Commit**
  ```bash
  git add apps/api/src/data-transfer/ apps/api/src/app.module.ts
  git commit -m "feat(api): add DataTransferController and DataTransferModule, register in AppModule"
  ```

---

## Task 5: Backend E2E Tests

**Files:**
- Create: `apps/api/src/data-transfer/data-transfer.e2e.spec.ts`

- [ ] **Step 5.1: Create E2E spec:**

```ts
// apps/api/src/data-transfer/data-transfer.e2e.spec.ts
/**
 * E2E: Import/Export — export, analyze, confirm, cross-tenant isolation
 * Uses real test DB (DATABASE_TEST_URL).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

interface AuthSession {
  accessToken: string;
  householdId: string;
  expenseCategoryId: string;
}

async function registerAndLogin(email: string): Promise<{ accessToken: string }> {
  const reg = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { email, password: 'TestPass123!', displayName: 'Test' },
  });
  if (reg.statusCode !== 201) throw new Error(`Register failed: ${reg.body}`);

  await prisma.user.update({ where: { email }, data: { emailVerified: true } });

  const login = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email, password: 'TestPass123!' },
  });
  return JSON.parse(login.body) as { accessToken: string };
}

async function createSession(email: string): Promise<AuthSession> {
  const { accessToken } = await registerAndLogin(email);
  const hh = await app.inject({
    method: 'GET', url: '/api/v1/households',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const householdId = (JSON.parse(hh.body) as { household: { id: string } }[])[0].household.id;
  const cats = await app.inject({
    method: 'GET', url: `/api/v1/households/${householdId}/categories`,
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const expenseCategory = (JSON.parse(cats.body) as { id: string; type: string }[]).find(c => c.type === 'EXPENSE');
  if (!expenseCategory) throw new Error('No EXPENSE category seeded');
  return { accessToken, householdId, expenseCategoryId: expenseCategory.id };
}

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ logger: false }));
  await app.register(fastifyCookie);
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'health', method: RequestMethod.GET }] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  prisma = moduleRef.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

describe('GET /households/:hid/export', () => {
  it('returns valid export JSON with Content-Disposition header', async () => {
    const { accessToken, householdId } = await createSession('export-test@klar.test');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/export`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const body = JSON.parse(res.body) as { version: string; includes: string[] };
    expect(body.version).toBe('1');
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/households/fake/export' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for cross-tenant household', async () => {
    const alice = await createSession('export-alice@klar.test');
    const bob = await createSession('export-bob@klar.test');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${bob.householdId}/export`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /households/:hid/import/analyze', () => {
  it('returns summary and category mappings', async () => {
    const { accessToken, householdId } = await createSession('analyze-test@klar.test');

    // First export to get a valid file
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/export`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const fileContent = exportRes.body;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      payload: { fileContent },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { summary: { transactions: number } };
    expect(body.summary).toBeDefined();
  });

  it('returns 400 for invalid JSON content', async () => {
    const { accessToken, householdId } = await createSession('analyze-bad@klar.test');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/import/analyze`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      payload: { fileContent: 'not-json' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /households/:hid/import/confirm', () => {
  it('round-trips: export from household A, import into household B, categories resolve by name', async () => {
    const src = await createSession('confirm-src@klar.test');
    const dst = await createSession('confirm-dst@klar.test');

    // Create a transaction in src household
    await prisma.transaction.create({
      data: {
        householdId: src.householdId,
        createdByUserId: (await prisma.user.findUnique({ where: { email: 'confirm-src@klar.test' } }))!.id,
        amountCents: -2000,
        categoryId: src.expenseCategoryId,
        date: new Date('2025-06-01'),
        description: 'Round-trip test',
        visibility: 'SHARED',
      },
    });

    // Export from src
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${src.householdId}/export`,
      headers: { authorization: `Bearer ${src.accessToken}` },
    });
    const fileContent = exportRes.body;

    // Analyze into dst
    const analyzeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${dst.householdId}/import/analyze`,
      headers: { authorization: `Bearer ${dst.accessToken}`, 'content-type': 'application/json' },
      payload: { fileContent },
    });
    const analyze = JSON.parse(analyzeRes.body) as {
      categoryMappings: { source: { name: string; type: string }; resolvedId: string | null }[];
    };

    // All categories should resolve by name (default categories are the same)
    const unresolvedCats = analyze.categoryMappings.filter(m => m.resolvedId === null);
    // Build manual mappings for any unresolved ones (using available categories from dst)
    const availRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${dst.householdId}/import/analyze`,
      headers: { authorization: `Bearer ${dst.accessToken}`, 'content-type': 'application/json' },
      payload: { fileContent },
    });
    const available = JSON.parse(availRes.body) as {
      availableCategories: { id: string; name: string; type: string }[];
    };
    const catMappings = unresolvedCats.map(m => ({
      sourceName: m.source.name,
      sourceType: m.source.type,
      targetId: available.availableCategories[0]?.id ?? '',
    }));

    // Confirm import
    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${dst.householdId}/import/confirm`,
      headers: { authorization: `Bearer ${dst.accessToken}`, 'content-type': 'application/json' },
      payload: { fileContent, categoryMappings: catMappings, projectMappings: [] },
    });
    expect(confirmRes.statusCode).toBe(201);
    const confirmBody = JSON.parse(confirmRes.body) as { imported: { transactions: number } };
    expect(confirmBody.imported.transactions).toBeGreaterThan(0);

    // Verify in DB
    const dbTxCount = await prisma.transaction.count({
      where: { householdId: dst.householdId, description: 'Round-trip test' },
    });
    expect(dbTxCount).toBe(1);
  });
});
```

- [ ] **Step 5.2: Run E2E tests:**
  ```bash
  pnpm --filter api test:e2e -- data-transfer.e2e.spec.ts
  ```
  Expected: all pass. If DATABASE_TEST_URL is not set, set it first:
  ```bash
  $env:DATABASE_TEST_URL = "postgresql://..."
  pnpm --filter api test:e2e -- data-transfer.e2e.spec.ts
  ```

- [ ] **Step 5.3: Commit**
  ```bash
  git add apps/api/src/data-transfer/data-transfer.e2e.spec.ts \
          apps/api/src/data-transfer/data-transfer.repository.ts
  git commit -m "test(api): add E2E tests for import/export endpoints"
  ```

---

## Task 6: Frontend Service

**Files:**
- Create: `apps/web/src/app/core/data-transfer/data-transfer.service.ts`

- [ ] **Step 6.1: Create Angular service:**

```ts
// apps/web/src/app/core/data-transfer/data-transfer.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CategoryMappingItem {
  source: { name: string; type: string };
  resolvedId: string | null;
}

export interface ProjectMappingItem {
  source: { name: string };
  resolvedId: string | null;
}

export interface AnalyzeResponse {
  summary: { transactions: number; recurringTransactions: number };
  categoryMappings: CategoryMappingItem[];
  projectMappings: ProjectMappingItem[];
  availableCategories: { id: string; name: string; type: string }[];
  availableProjects: { id: string; name: string }[];
}

export interface ConfirmBody {
  fileContent: string;
  categoryMappings: { sourceName: string; sourceType: string; targetId: string }[];
  projectMappings: { sourceName: string; targetId: string }[];
}

export interface ImportResult {
  imported: { transactions: number; recurringTransactions: number };
  skipped: number;
}

export interface ExportParams {
  include?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class DataTransferService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}`;
  }

  async export(householdId: string, params: ExportParams = {}): Promise<void> {
    const httpParams: Record<string, string> = {};
    if (params.include) httpParams['include'] = params.include;
    if (params.startDate) httpParams['startDate'] = params.startDate;
    if (params.endDate) httpParams['endDate'] = params.endDate;

    const response = await firstValueFrom(
      this.http.get(`${this.base(householdId)}/export`, {
        params: httpParams,
        responseType: 'blob',
        observe: 'response',
      }),
    );

    const blob = response.body!;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klar-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  analyze(householdId: string, fileContent: string): Promise<AnalyzeResponse> {
    return firstValueFrom(
      this.http.post<AnalyzeResponse>(
        `${this.base(householdId)}/import/analyze`,
        { fileContent },
      ),
    );
  }

  confirm(householdId: string, body: ConfirmBody): Promise<ImportResult> {
    return firstValueFrom(
      this.http.post<ImportResult>(
        `${this.base(householdId)}/import/confirm`,
        body,
      ),
    );
  }
}
```

- [ ] **Step 6.2: Verify TypeScript:**
  ```bash
  pnpm --filter web lint
  ```
  Expected: no errors.

- [ ] **Step 6.3: Commit**
  ```bash
  git add apps/web/src/app/core/data-transfer/
  git commit -m "feat(web): add DataTransferService for export/analyze/confirm"
  ```

---

## Task 7: Import Mapping Dialog

**Files:**
- Create: `apps/web/src/app/pages/settings/import-mapping-dialog.component.ts`
- Create: `apps/web/src/app/pages/settings/import-mapping-dialog.component.html`

- [ ] **Step 7.1: Create the dialog component:**

```ts
// apps/web/src/app/pages/settings/import-mapping-dialog.component.ts
import { Component, inject, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import { DataTransferService } from '../../core/data-transfer/data-transfer.service';
import type { AnalyzeResponse, ConfirmBody } from '../../core/data-transfer/data-transfer.service';

@Component({
  selector: 'app-import-mapping-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective, HlmSpinnerComponent],
  templateUrl: './import-mapping-dialog.component.html',
})
export class ImportMappingDialogComponent {
  readonly analyzeResult = input.required<AnalyzeResponse>();
  readonly fileContent = input.required<string>();

  readonly dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);
  private dtService = inject(DataTransferService);
  private hhStore = inject(HouseholdStore);

  readonly saving = signal(false);

  // Map: "sourceName::sourceType" → targetId
  readonly categorySelections = signal<Record<string, string>>({});
  readonly projectSelections = signal<Record<string, string>>({});

  readonly unresolvedCategories = computed(() =>
    this.analyzeResult().categoryMappings.filter(m => m.resolvedId === null),
  );

  readonly unresolvedProjects = computed(() =>
    this.analyzeResult().projectMappings.filter(m => m.resolvedId === null),
  );

  readonly canConfirm = computed(() => {
    const catOk = this.unresolvedCategories().every(
      m => !!this.categorySelections()[`${m.source.name}::${m.source.type}`],
    );
    const projOk = this.unresolvedProjects().every(
      m => !!this.projectSelections()[m.source.name],
    );
    return catOk && projOk;
  });

  setCategoryMapping(key: string, targetId: string): void {
    this.categorySelections.update(s => ({ ...s, [key]: targetId }));
  }

  setProjectMapping(name: string, targetId: string): void {
    this.projectSelections.update(s => ({ ...s, [name]: targetId }));
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm()) return;
    this.saving.set(true);
    const householdId = this.hhStore.activeHouseholdId()!;

    const body: ConfirmBody = {
      fileContent: this.fileContent(),
      categoryMappings: this.unresolvedCategories().map(m => ({
        sourceName: m.source.name,
        sourceType: m.source.type,
        targetId: this.categorySelections()[`${m.source.name}::${m.source.type}`],
      })),
      projectMappings: this.unresolvedProjects().map(m => ({
        sourceName: m.source.name,
        targetId: this.projectSelections()[m.source.name],
      })),
    };

    try {
      const result = await this.dtService.confirm(householdId, body);
      const msg = [
        result.imported.transactions > 0 ? `${result.imported.transactions} Buchungen` : '',
        result.imported.recurringTransactions > 0 ? `${result.imported.recurringTransactions} Fixkosten` : '',
      ].filter(Boolean).join(' und ');
      this.toast.success(`${msg} importiert${result.skipped > 0 ? ` (${result.skipped} übersprungen)` : ''}`);
      this.dialog.close();
    } catch {
      // ErrorInterceptor shows toast — keep dialog open so user can retry
    } finally {
      this.saving.set(false);
    }
  }
}
```

- [ ] **Step 7.2: Create the dialog template:**

```html
<!-- apps/web/src/app/pages/settings/import-mapping-dialog.component.html -->
<div class="flex flex-col gap-4 p-6 min-w-[320px] max-w-[480px]">
  <h2 class="text-base font-semibold">Import bestätigen</h2>

  <p class="text-sm text-(--text-muted)">
    {{ analyzeResult().summary.transactions }} Buchungen ·
    {{ analyzeResult().summary.recurringTransactions }} Fixkosten
  </p>

  @if (unresolvedCategories().length > 0) {
    <div class="flex flex-col gap-2">
      <p class="text-[10px] uppercase tracking-widest text-(--text-muted)">Kategorien zuordnen</p>
      @for (m of unresolvedCategories(); track m.source.name) {
        <div class="flex items-center gap-3">
          <span class="text-sm flex-1 truncate">{{ m.source.name }} <span class="text-(--text-muted)">({{ m.source.type }})</span></span>
          <select class="text-sm rounded border border-(--border) bg-(--surface-1) px-2 py-1.5 min-h-[44px] min-w-[160px]"
                  [ngModel]="categorySelections()[m.source.name + '::' + m.source.type]"
                  (ngModelChange)="setCategoryMapping(m.source.name + '::' + m.source.type, $event)">
            <option value="">— wählen —</option>
            @for (cat of analyzeResult().availableCategories; track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>
      }
    </div>
  }

  @if (unresolvedProjects().length > 0) {
    <div class="flex flex-col gap-2">
      <p class="text-[10px] uppercase tracking-widest text-(--text-muted)">Projekte zuordnen</p>
      @for (m of unresolvedProjects(); track m.source.name) {
        <div class="flex items-center gap-3">
          <span class="text-sm flex-1 truncate">{{ m.source.name }}</span>
          <select class="text-sm rounded border border-(--border) bg-(--surface-1) px-2 py-1.5 min-h-[44px] min-w-[160px]"
                  [ngModel]="projectSelections()[m.source.name]"
                  (ngModelChange)="setProjectMapping(m.source.name, $event)">
            <option value="">— wählen —</option>
            @for (proj of analyzeResult().availableProjects; track proj.id) {
              <option [value]="proj.id">{{ proj.name }}</option>
            }
          </select>
        </div>
      }
    </div>
  }

  <div class="flex gap-2 justify-end pt-2">
    <button type="button" hlmBtn variant="ghost" (click)="dialog.close()">Abbruch</button>
    <button type="button" hlmBtn [disabled]="!canConfirm() || saving()" (click)="confirm()">
      @if (saving()) { <hlm-spinner [size]="14" class="mr-1" /> }
      Importieren
    </button>
  </div>
</div>
```

- [ ] **Step 7.3: Commit**
  ```bash
  git add apps/web/src/app/pages/settings/import-mapping-dialog.component.*
  git commit -m "feat(web): add ImportMappingDialogComponent for category/project resolution"
  ```

---

## Task 8: Export Component

**Files:**
- Create: `apps/web/src/app/pages/settings/data-export.component.ts`
- Create: `apps/web/src/app/pages/settings/data-export.component.html`

- [ ] **Step 8.1: Create the export component:**

```ts
// apps/web/src/app/pages/settings/data-export.component.ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmCheckboxComponent } from '../../shared/ui/hlm/hlm-checkbox.component';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import { DataTransferService } from '../../core/data-transfer/data-transfer.service';

@Component({
  selector: 'app-data-export',
  standalone: true,
  imports: [
    FormsModule,
    HlmButtonDirective,
    HlmInputDirective,
    HlmLabelDirective,
    HlmCheckboxComponent,
    HlmSpinnerComponent,
  ],
  templateUrl: './data-export.component.html',
})
export class DataExportComponent {
  private dtService = inject(DataTransferService);
  private hhStore = inject(HouseholdStore);
  private toast = inject(KlarToastService);

  readonly includeTransactions = signal(true);
  readonly includeRecurring = signal(true);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly exporting = signal(false);

  async export(): Promise<void> {
    const parts: string[] = [];
    if (this.includeTransactions()) parts.push('transactions');
    if (this.includeRecurring()) parts.push('recurringTransactions');
    if (!parts.length) {
      this.toast.error('Wähle mindestens eine Datenquelle aus');
      return;
    }

    this.exporting.set(true);
    try {
      await this.dtService.export(this.hhStore.activeHouseholdId()!, {
        include: parts.join(','),
        startDate: this.startDate() || undefined,
        endDate: this.endDate() || undefined,
      });
      this.toast.success('Export gestartet');
    } catch {
      // ErrorInterceptor handles toast
    } finally {
      this.exporting.set(false);
    }
  }
}
```

- [ ] **Step 8.2: Create the export template:**

```html
<!-- apps/web/src/app/pages/settings/data-export.component.html -->
<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-2">
    <p class="text-[10px] uppercase tracking-widest text-(--text-muted)">Daten exportieren</p>

    <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
      <hlm-checkbox
        [checked]="includeTransactions()"
        (checkedChange)="includeTransactions.set($event === true)" />
      <span class="text-sm">Buchungen</span>
    </label>

    <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
      <hlm-checkbox
        [checked]="includeRecurring()"
        (checkedChange)="includeRecurring.set($event === true)" />
      <span class="text-sm">Fixkosten</span>
    </label>
  </div>

  <div class="flex flex-col gap-2">
    <p class="text-[10px] uppercase tracking-widest text-(--text-muted)">Zeitraum (optional)</p>
    <div class="flex gap-3 flex-wrap">
      <div class="flex flex-col gap-1">
        <label hlmLabel for="export-start">Von</label>
        <input hlmInput id="export-start" type="date" class="text-base min-h-[44px]"
               [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" />
      </div>
      <div class="flex flex-col gap-1">
        <label hlmLabel for="export-end">Bis</label>
        <input hlmInput id="export-end" type="date" class="text-base min-h-[44px]"
               [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" />
      </div>
    </div>
  </div>

  <button type="button" hlmBtn [disabled]="exporting()" (click)="export()" class="self-start">
    @if (exporting()) { <hlm-spinner [size]="14" class="mr-1" /> }
    Exportieren
  </button>
</div>
```

- [ ] **Step 8.3: Commit**
  ```bash
  git add apps/web/src/app/pages/settings/data-export.component.*
  git commit -m "feat(web): add DataExportComponent for JSON export with date filter"
  ```

---

## Task 9: Import Component

**Files:**
- Create: `apps/web/src/app/pages/settings/data-import.component.ts`
- Create: `apps/web/src/app/pages/settings/data-import.component.html`

- [ ] **Step 9.1: Create the import component:**

```ts
// apps/web/src/app/pages/settings/data-import.component.ts
import { Component, inject, signal } from '@angular/core';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import { DataTransferService } from '../../core/data-transfer/data-transfer.service';
import type { AnalyzeResponse, ConfirmBody } from '../../core/data-transfer/data-transfer.service';
import { ImportMappingDialogComponent } from './import-mapping-dialog.component';

@Component({
  selector: 'app-data-import',
  standalone: true,
  imports: [HlmButtonDirective, HlmSpinnerComponent, KlarErrorBarComponent],
  templateUrl: './data-import.component.html',
})
export class DataImportComponent {
  private dtService = inject(DataTransferService);
  private hhStore = inject(HouseholdStore);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly analyzing = signal(false);
  readonly fileError = signal('');
  readonly analyzeResult = signal<AnalyzeResponse | null>(null);
  readonly fileContent = signal('');

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      this.fileError.set('Nur .json Dateien werden akzeptiert');
      return;
    }

    this.fileError.set('');
    this.analyzing.set(true);

    try {
      const text = await file.text();
      this.fileContent.set(text);
      const householdId = this.hhStore.activeHouseholdId()!;
      const result = await this.dtService.analyze(householdId, text);
      this.analyzeResult.set(result);

      const hasUnresolved =
        result.categoryMappings.some(m => m.resolvedId === null) ||
        result.projectMappings.some(m => m.resolvedId === null);

      if (hasUnresolved) {
        this.dialog.open(ImportMappingDialogComponent, {
          inputs: { analyzeResult: result, fileContent: text },
        });
      } else {
        await this.confirmDirectly(result, text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Schema')) {
        this.fileError.set('Ungültige Export-Datei');
      }
      // HTTP errors handled by ErrorInterceptor
    } finally {
      this.analyzing.set(false);
      input.value = '';
    }
  }

  private async confirmDirectly(result: AnalyzeResponse, text: string): Promise<void> {
    const householdId = this.hhStore.activeHouseholdId()!;
    const body: ConfirmBody = { fileContent: text, categoryMappings: [], projectMappings: [] };
    const importResult = await this.dtService.confirm(householdId, body);
    const total = importResult.imported.transactions + importResult.imported.recurringTransactions;
    const skipped = importResult.skipped > 0 ? ` (${importResult.skipped} übersprungen)` : '';
    this.toast.success(`${total} Einträge importiert${skipped}`);
  }
}
```

- [ ] **Step 9.2: Create the import template:**

```html
<!-- apps/web/src/app/pages/settings/data-import.component.html -->
<div class="flex flex-col gap-4">
  <p class="text-[10px] uppercase tracking-widest text-(--text-muted)">Daten importieren</p>

  @if (fileError()) {
    <klar-error-bar [message]="fileError()" />
  }

  <label class="flex items-center gap-3 min-h-[44px] cursor-pointer self-start">
    <input type="file" accept=".json" class="sr-only" (change)="onFileSelected($event)" />
    <button type="button" hlmBtn variant="outline" [disabled]="analyzing()"
            (click)="$event.preventDefault(); $event.target?.closest('label')?.querySelector('input')?.click()">
      @if (analyzing()) { <hlm-spinner [size]="14" class="mr-1" /> }
      JSON-Datei wählen
    </button>
  </label>

  <p class="text-xs text-(--text-muted)">
    Klar-Export-Datei (.json). Kategorien und Projekte werden automatisch zugeordnet.
  </p>
</div>
```

- [ ] **Step 9.3: Fix the button click — the label approach is tricky. Use a simpler pattern with ViewChild reference:**

Replace `data-import.component.html` with:

```html
<!-- apps/web/src/app/pages/settings/data-import.component.html -->
<div class="flex flex-col gap-4">
  <p class="text-[10px] uppercase tracking-widest text-(--text-muted)">Daten importieren</p>

  @if (fileError()) {
    <klar-error-bar [message]="fileError()" />
  }

  <input #fileInput type="file" accept=".json" class="sr-only" (change)="onFileSelected($event)" />

  <button type="button" hlmBtn variant="outline" class="self-start min-h-[44px]"
          [disabled]="analyzing()" (click)="fileInput.click()">
    @if (analyzing()) { <hlm-spinner [size]="14" class="mr-1" /> }
    JSON-Datei wählen
  </button>

  <p class="text-xs text-(--text-muted)">
    Klar-Export-Datei (.json). Kategorien und Projekte werden automatisch zugeordnet.
  </p>
</div>
```

- [ ] **Step 9.4: Commit**
  ```bash
  git add apps/web/src/app/pages/settings/data-import.component.*
  git commit -m "feat(web): add DataImportComponent with file-pick, analyze and auto-confirm flow"
  ```

---

## Task 10: Settings Page Integration

**Files:**
- Modify: `apps/web/src/app/pages/settings/settings.component.ts`
- Modify: `apps/web/src/app/pages/settings/settings.component.html`

- [ ] **Step 10.1: Add imports to settings.component.ts** — add to the `imports` array and add import statements:

At the top of `settings.component.ts`, add:
```ts
import { DataExportComponent } from './data-export.component';
import { DataImportComponent } from './data-import.component';
```

In `@Component({ imports: [...] })`, add `DataExportComponent, DataImportComponent`.

- [ ] **Step 10.2: Add section to settings.component.html** — append before the closing `</klar-list>` tag:

```html
    <!-- ── IMPORT / EXPORT ────────────────────────────────── -->
    <klar-list-group label="Import / Export">
      <div class="px-6 py-4 flex flex-col gap-6">
        <app-data-export />
        <div class="border-t border-(--border)" />
        <app-data-import />
      </div>
    </klar-list-group>
```

- [ ] **Step 10.3: Verify compile:**
  ```bash
  pnpm --filter web lint
  ```
  Expected: no errors.

- [ ] **Step 10.4: Commit**
  ```bash
  git add apps/web/src/app/pages/settings/settings.component.*
  git commit -m "feat(web): integrate Import/Export section into Settings page"
  ```

---

## Task 11: Playwright E2E Tests

**Files:**
- Create: `e2e/import-export.spec.ts`

- [ ] **Step 11.1: Find the existing Playwright config and base URL:**
  ```bash
  Get-ChildItem c:\Workspace\Klar -Filter "playwright.config.*" -Recurse | Select-Object FullName
  ```

- [ ] **Step 11.2: Create the Playwright spec** (adjust base URL from config):

```ts
// e2e/import-export.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Import / Export', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings — assumes user is already logged in via storageState or login fixture
    await page.goto('/settings');
    await page.waitForSelector('text=Import / Export');
  });

  test('export button triggers file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportieren' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/klar-export-\d{4}-\d{2}-\d{2}\.json/);

    const filePath = await download.path();
    const content = JSON.parse(fs.readFileSync(filePath!, 'utf-8')) as { version: string };
    expect(content.version).toBe('1');
  });

  test('export with date filter — start and end date fields visible', async ({ page }) => {
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await page.locator('input[type="date"]').first().fill('2025-01-01');
    await expect(page.locator('input[type="date"]').first()).toHaveValue('2025-01-01');
  });

  test('import valid file — shows success toast', async ({ page }) => {
    // First export to get a valid file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportieren' }).click(),
    ]);
    const tmpPath = path.join(os.tmpdir(), 'klar-test-import.json');
    await download.saveAs(tmpPath);

    // Import the file
    await page.locator('input[type="file"]').setInputFiles(tmpPath);

    // Wait for toast
    await expect(page.getByText(/importiert/i)).toBeVisible({ timeout: 10000 });

    fs.unlinkSync(tmpPath);
  });

  test('import invalid file — shows error bar', async ({ page }) => {
    const tmpPath = path.join(os.tmpdir(), 'klar-bad.json');
    fs.writeFileSync(tmpPath, '{"not":"a klar file"}');

    await page.locator('input[type="file"]').setInputFiles(tmpPath);
    await expect(page.getByText(/ungültige export-datei/i)).toBeVisible({ timeout: 5000 });

    fs.unlinkSync(tmpPath);
  });

  test('mobile layout — Import / Export section visible at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/settings');
    await expect(page.getByText('Import / Export')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportieren' })).toBeVisible();
  });
});
```

- [ ] **Step 11.3: Run Playwright tests:**
  ```bash
  pnpm --filter web e2e -- --grep "Import / Export"
  ```
  Expected: all pass. If the dev server is not running, start it first:
  ```bash
  pnpm dev
  ```

- [ ] **Step 11.4: Commit**
  ```bash
  git add e2e/import-export.spec.ts
  git commit -m "test(e2e): add Playwright tests for import/export flow"
  ```

---

## Task 12: Final Check + PR

- [ ] **Step 12.1: Run full test suite:**
  ```bash
  pnpm test
  pnpm --filter api test:e2e -- data-transfer.e2e.spec.ts
  ```
  Expected: all green.

- [ ] **Step 12.2: Run pnpm audit:**
  ```bash
  pnpm audit
  ```
  Expected: no high/critical CVEs.

- [ ] **Step 12.3: Run TypeScript check on both apps:**
  ```bash
  pnpm --filter api lint && pnpm --filter web lint
  ```

- [ ] **Step 12.4: Open browser, manual smoke test:**
  - Navigate to Settings → Import / Export
  - Check both checkboxes are ticked by default
  - Click "Exportieren" → file downloads, is valid JSON with `version: "1"`
  - Upload the downloaded file → success toast appears
  - Test at 375px viewport → layout intact

- [ ] **Step 12.5: Create PR:**
  ```bash
  git push origin feat/import-export
  gh pr create --title "feat: JSON import/export for transactions and recurring transactions" \
    --body "Adds export (GET) and two-step import (analyze + confirm) for Transactions and RecurringTransactions. Settings page gets a new Import / Export section. Category/project name-based matching with manual mapping dialog for unresolved entries."
  ```

---

## Self-Review

**Spec coverage check:**
- ✅ JSON format v1 with all fields → Task 1
- ✅ Export with optional include + date filter → Task 4 controller + Task 2 repo
- ✅ Analyze endpoint with category/project resolution → Task 3 service + Task 5 E2E
- ✅ Confirm endpoint with mapping payload → Task 3 service + Task 5 E2E
- ✅ Cross-tenant 403 → Task 5 E2E
- ✅ RFC 7807 errors (400/422) → Task 3 service throws correct exceptions, GlobalExceptionFilter handles
- ✅ Frontend export form with checkboxes + date filter → Task 8
- ✅ Frontend import with file pick + auto-analyze → Task 9
- ✅ Mapping dialog for unresolved categories/projects → Task 7
- ✅ Settings page integration → Task 10
- ✅ Playwright tests → Task 11
- ✅ Unit tests → Task 3 spec
- ✅ E2E tests → Task 5 spec

**Type consistency:**
- `DataTransferService.export()` returns `KlarExportFile` → used in controller as `data`
- `AnalyzeResponse` defined in web service → same shape as backend `AnalyzeResult`
- `ConfirmBody.categoryMappings[].sourceType` matches `KlarExportTransactionSchema.category.type`
- `DataTransferRepository` method names consistent throughout service calls

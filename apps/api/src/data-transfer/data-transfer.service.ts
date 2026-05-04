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

    const allEntries = [
      ...(file.transactions ?? []).map(t => t.category),
      ...(file.recurringTransactions ?? []).map(r => r.category),
    ];
    const uniqueCatKeys = new Map<string, { name: string; type: string }>();
    for (const c of allEntries) {
      uniqueCatKeys.set(`${c.name.toLowerCase()}::${c.type}`, c);
    }
    const catEntries = [...uniqueCatKeys.values()];

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

    const catMap = new Map<string, string>(
      mappings.categoryMappings.map(m => [`${m.sourceName.toLowerCase()}::${m.sourceType}`, m.targetId]),
    );
    const projMap = new Map<string, string>(
      mappings.projectMappings.map(m => [m.sourceName.toLowerCase(), m.targetId]),
    );

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

    // Validate all targetIds exist in the household
    for (const [key, targetId] of catMap) {
      const cat = await this.repo.findCategoryById(ctx.householdId, targetId);
      if (!cat) {
        throw new UnprocessableEntityException(
          `Kategorie ${targetId} (Mapping für ${key}) nicht im Haushalt gefunden`,
        );
      }
    }

    // Ensure every required category has a mapping
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

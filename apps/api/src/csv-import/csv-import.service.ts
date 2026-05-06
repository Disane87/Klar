import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Visibility, RecurringFrequency } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import {
  SparkasseCamtV2Parser,
  type ParsedRow,
} from './parsers/sparkasse-camt-v2.parser';
import { CsvImportRepository } from './csv-import.repository';
import { DuplicateDetector } from './detection/duplicate-detector';
import {
  FixedCostMatcher,
  type RecurringForMatch,
} from './detection/fixed-cost-matcher';
import { RecurringSuggester } from './detection/recurring-suggester';
import { CategorySuggester } from './detection/category-suggester';
import { counterpartyKey } from './utils/counterparty-key';

export type RowStatus = 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';

export interface AnalyzeRow {
  rowIndex: number;
  date: string;
  amountCents: number;
  counterparty: string | null;
  purpose: string | null;
  externalRef: string | null;
  status: RowStatus;
  matchedRecurringId?: string;
  matchedRecurring?: {
    id: string;
    name: string;
    amountCents: number;
    dayOfMonth: number | null;
    frequency: string;
    note: string | null;
  };
  suggestedCategoryId?: string;
  suggestedCategoryConfidence: 'EXACT' | 'LEARNED' | 'NONE';
  suggestedRecurring?: {
    estimatedFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    pastOccurrences: number;
  };
}

export interface AnalyzeResponse {
  summary: {
    total: number;
    new: number;
    duplicates: number;
    fixedCostMatches: number;
    recurringSuggestions: number;
  };
  rows: AnalyzeRow[];
}

export interface ConfirmRowSelection {
  rowIndex: number;
  skip: boolean;
  skipReason?: 'duplicate' | 'fixed' | 'user';
  categoryId?: string;
  projectId?: string | null;
  visibility?: Visibility;
  createNewRecurring?: boolean;
}

export interface ConfirmPayload {
  filename: string;
  rows: ConfirmRowSelection[];
}

export interface ConfirmResponse {
  imported: number;
  skippedDuplicates: number;
  skippedFixed: number;
  skippedByUser: number;
  createdRecurrings: number;
  csvImportId: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class CsvImportService {
  constructor(
    private readonly parser: SparkasseCamtV2Parser,
    private readonly repo: CsvImportRepository,
  ) {}

  async analyze(ctx: RequestContext, fileBase64: string): Promise<AnalyzeResponse> {
    const buffer = this.decodeBase64(fileBase64);
    const parsed = this.parseOrThrow(buffer);

    const refs = parsed.map(r => r.externalRef).filter((x): x is string => !!x);
    const hashesToCheck = parsed
      .filter(r => !r.externalRef)
      .map(r => DuplicateDetector.computeHash(r));

    const [existingRefs, existingHashes, recurringsRaw, learningsRaw, recentTx] =
      await Promise.all([
        this.repo.loadExistingRefs(ctx.householdId, refs),
        this.repo.loadExistingHashes(ctx.householdId, hashesToCheck),
        this.repo.loadActiveRecurrings(ctx.householdId),
        this.repo.loadLearnings(ctx.householdId),
        this.repo.loadRecentTransactions(ctx.householdId, this.sixMonthsAgoISO()),
      ]);

    const dup = new DuplicateDetector(new Set(existingRefs), new Set(existingHashes));

    const recurringsForMatch: RecurringForMatch[] = recurringsRaw.map(r => ({
      id: r.id,
      name: r.name,
      nameNorm: counterpartyKey(r.name),
      noteNorm: counterpartyKey(r.note ?? ''),
      amountCents: r.amountCents,
      isVariable: r.isVariable,
      isActive: r.isActive,
      dayOfMonth: r.dayOfMonth,
    }));
    const recurringsRawById = new Map(recurringsRaw.map(r => [r.id, r]));
    const fixed = new FixedCostMatcher(recurringsForMatch);

    const suggester = new RecurringSuggester([
      ...recentTx.map(t => ({
        counterpartyNorm: counterpartyKey(t.counterparty),
        date: t.date.toISOString().slice(0, 10),
        amountCents: t.amountCents,
      })),
      ...parsed.map(p => ({
        counterpartyNorm: p.counterpartyNorm,
        date: p.date,
        amountCents: p.amountCents,
      })),
    ]);

    const learnings = new Map(learningsRaw.map(l => [l.counterpartyKey, l.categoryId]));
    const recurringCategoryMap = new Map(recurringsRaw.map(r => [r.id, r.categoryId]));
    const catSuggester = new CategorySuggester(
      recurringsForMatch
        .filter(r => r.isActive)
        .map(r => ({
          nameNorm: r.nameNorm,
          categoryId: recurringCategoryMap.get(r.id)!,
        })),
      learnings,
    );

    const rows: AnalyzeRow[] = parsed.map(p => {
      const baseSuggestion = catSuggester.suggest(p);
      if (dup.isDuplicate(p)) {
        return this.toAnalyzeRow(p, 'DUPLICATE', baseSuggestion);
      }
      const match = fixed.match(p);
      if (match) {
        const raw = recurringsRawById.get(match.id);
        return {
          ...this.toAnalyzeRow(p, 'FIXED_COST_MATCH', baseSuggestion),
          matchedRecurringId: match.id,
          matchedRecurring: raw
            ? {
                id: raw.id,
                name: raw.name,
                amountCents: raw.amountCents,
                dayOfMonth: raw.dayOfMonth,
                frequency: raw.frequency,
                note: raw.note,
              }
            : undefined,
        };
      }
      const sug = suggester.suggest(p);
      if (sug) {
        return {
          ...this.toAnalyzeRow(p, 'RECURRING_SUGGESTION', baseSuggestion),
          suggestedRecurring: sug,
        };
      }
      return this.toAnalyzeRow(p, 'NEW', baseSuggestion);
    });

    return {
      summary: {
        total: rows.length,
        new: rows.filter(r => r.status === 'NEW').length,
        duplicates: rows.filter(r => r.status === 'DUPLICATE').length,
        fixedCostMatches: rows.filter(r => r.status === 'FIXED_COST_MATCH').length,
        recurringSuggestions: rows.filter(r => r.status === 'RECURRING_SUGGESTION').length,
      },
      rows,
    };
  }

  async confirm(
    ctx: RequestContext,
    fileBase64: string,
    payload: ConfirmPayload,
  ): Promise<ConfirmResponse> {
    const buffer = this.decodeBase64(fileBase64);
    const parsed = this.parseOrThrow(buffer);

    const csvImport = await this.repo.createCsvImport({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      filename: payload.filename,
      rowCount: parsed.length,
    });

    let imported = 0;
    let skippedDup = 0;
    let skippedFixed = 0;
    let skippedUser = 0;
    let newRecs = 0;

    for (const sel of payload.rows) {
      const row = parsed[sel.rowIndex];
      if (!row) throw new BadRequestException(`Ungültige Zeile ${sel.rowIndex}`);

      if (sel.skip) {
        if (sel.skipReason === 'duplicate') skippedDup++;
        else if (sel.skipReason === 'fixed') skippedFixed++;
        else skippedUser++;
        continue;
      }

      if (!sel.categoryId) {
        throw new BadRequestException(`Kategorie fehlt für Zeile ${sel.rowIndex}`);
      }

      const cat = await this.repo.assertCategoryInHousehold(ctx.householdId, sel.categoryId);
      if (!cat) {
        throw new UnprocessableEntityException(
          `Kategorie ${sel.categoryId} nicht gefunden`,
        );
      }

      if (sel.projectId) {
        const p = await this.repo.assertProjectInHousehold(ctx.householdId, sel.projectId);
        if (!p) {
          throw new UnprocessableEntityException(
            `Projekt ${sel.projectId} nicht gefunden`,
          );
        }
      }

      if (sel.createNewRecurring) {
        await this.repo.createRecurring({
          householdId: ctx.householdId,
          createdByUserId: ctx.userId,
          name: row.counterparty ?? 'Unbenannt',
          amountCents: row.amountCents,
          categoryId: sel.categoryId,
          frequency: RecurringFrequency.MONTHLY,
          dayOfMonth: Number(row.date.slice(8, 10)),
          startDate: new Date(`${row.date}T00:00:00Z`),
          visibility: sel.visibility ?? Visibility.SHARED,
        });
        newRecs++;
      }

      await this.repo.createTransaction({
        householdId: ctx.householdId,
        createdByUserId: ctx.userId,
        amountCents: row.amountCents,
        categoryId: sel.categoryId,
        projectId: sel.projectId ?? null,
        date: new Date(`${row.date}T00:00:00Z`),
        description: row.purpose,
        visibility: sel.visibility ?? Visibility.SHARED,
        externalRef: row.externalRef,
        externalHash: DuplicateDetector.computeHash(row),
        counterparty: row.counterparty,
        sourceImportId: csvImport.id,
      });

      await this.repo.upsertLearning(ctx.householdId, row.counterpartyNorm, sel.categoryId);
      imported++;
    }

    await this.repo.finalizeCsvImport(csvImport.id, {
      importedCount: imported,
      skippedDuplicates: skippedDup,
      skippedFixed,
      createdRecurrings: newRecs,
    });

    return {
      imported,
      skippedDuplicates: skippedDup,
      skippedFixed,
      skippedByUser: skippedUser,
      createdRecurrings: newRecs,
      csvImportId: csvImport.id,
    };
  }

  private toAnalyzeRow(
    p: ParsedRow,
    status: RowStatus,
    sug: { categoryId: string | null; confidence: 'EXACT' | 'LEARNED' | 'NONE' },
  ): AnalyzeRow {
    const row: AnalyzeRow = {
      rowIndex: p.rowIndex,
      date: p.date,
      amountCents: p.amountCents,
      counterparty: p.counterparty,
      purpose: p.purpose,
      externalRef: p.externalRef,
      status,
      suggestedCategoryConfidence: sug.confidence,
    };
    if (sug.categoryId) row.suggestedCategoryId = sug.categoryId;
    return row;
  }

  private decodeBase64(b64: string): Buffer {
    if (!b64) throw new BadRequestException('Datei fehlt');
    const buf = Buffer.from(b64, 'base64');
    if (buf.byteLength === 0) throw new BadRequestException('Datei ist leer');
    if (buf.byteLength > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('Datei zu groß (max 5 MB)');
    }
    return buf;
  }

  private parseOrThrow(buffer: Buffer): ParsedRow[] {
    try {
      return this.parser.parse(buffer);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  private sixMonthsAgoISO(): string {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 6);
    return d.toISOString().slice(0, 10);
  }
}

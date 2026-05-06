# CSV-Import (Sparkasse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sparkasse CAMT-V2-CSV importieren, Duplikate / Fixkosten / neue Daueraufträge erkennen, Kategorien lernend zuordnen.

**Architecture:** Neues NestJS-Modul `csv-import` mit dedizierten Parser- und Detection-Klassen. Datei wird als Base64-String im JSON-Body übertragen (gleiches Pattern wie `data-transfer`-Modul, kein Multipart). Frontend ist eine 3-Step-Wizard-Seite (`upload → preview → done`). Lernende Kategorie-Zuordnung über neue Tabelle `ImportLearning`. Fixkosten-Matches werden nicht importiert (würde Cashflow doppelt zählen — Recurring liefert sie bereits).

**Tech Stack:** NestJS 11 (Fastify), Prisma 6, Postgres 16, Angular 21 (Zoneless + Signal Forms), Tailwind 4, Spartan UI (`hlm*`), Vitest, Playwright. CSV-Parser: `papaparse`. Encoding: `iconv-lite`.

**Spec:** `docs/superpowers/specs/2026-05-05-csv-import-sparkasse-design.md`

---

## File Structure

**Backend (`apps/api/src/csv-import/`):**
- `csv-import.module.ts` — NestJS Modul
- `csv-import.controller.ts` — POST /analyze, /confirm
- `csv-import.service.ts` — Orchestrierung
- `csv-import.repository.ts` — Prisma-Zugriff
- `parsers/sparkasse-camt-v2.parser.ts` — CSV → ParsedRow[]
- `parsers/sparkasse-camt-v2.parser.spec.ts`
- `detection/duplicate-detector.ts`
- `detection/duplicate-detector.spec.ts`
- `detection/fixed-cost-matcher.ts`
- `detection/fixed-cost-matcher.spec.ts`
- `detection/recurring-suggester.ts`
- `detection/recurring-suggester.spec.ts`
- `detection/category-suggester.ts`
- `detection/category-suggester.spec.ts`
- `utils/counterparty-key.ts` — Normalisierung
- `utils/counterparty-key.spec.ts`
- `utils/row-hash.ts` — SHA-256
- `csv-import.service.spec.ts`
- `csv-import.e2e.spec.ts`

**Schema (`prisma/schema.prisma`):** 3 Migrations (CsvImport, ImportLearning, Transaction-Erweiterung).

**Shared (`packages/shared/src/schemas.ts`):** zod-Schemas für analyze/confirm DTOs.

**Frontend (`apps/web/src/app/`):**
- `core/csv-import/csv-import.service.ts`
- `core/csv-import/csv-import.types.ts`
- `pages/csv-import/csv-import.page.ts`
- `pages/csv-import/csv-import.page.html`
- `pages/csv-import/components/csv-upload-step.component.ts`
- `pages/csv-import/components/csv-preview-table.component.ts`
- `pages/csv-import/components/csv-preview-row.component.ts`
- `pages/csv-import/components/csv-import-summary.component.ts`
- Routing: Eintrag in `app.routes.ts`, Sidebar/Mobile-Sheet erweitern

---

## Implementierungs-Reihenfolge

Backend zuerst (Schema → Parser → Detection → Service/Controller → e2e), dann Frontend (Service → Wizard → Tests). Pro Task: Test zuerst (red), Implementierung (green), Commit.

---

### Task 1: Prisma-Schema + Migrationen

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260506100000_csv_import_tables/migration.sql`
- Create: `prisma/migrations/20260506100100_transaction_external_fields/migration.sql`

- [ ] **Step 1: Schema-Änderungen in `prisma/schema.prisma`**

Direkt nach dem `Transaction`-Model (vor `Budget`) einfügen:

```prisma
// ─────────────────────────────────────────────
// CSV IMPORT
// ─────────────────────────────────────────────

model CsvImport {
  id                String   @id @default(cuid())
  householdId       String
  createdByUserId   String
  filename          String
  rowCount          Int
  importedCount     Int      @default(0)
  skippedDuplicates Int      @default(0)
  skippedFixed      Int      @default(0)
  createdRecurrings Int      @default(0)
  createdAt         DateTime @default(now())

  household    Household     @relation(fields: [householdId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([householdId, createdAt])
}

model ImportLearning {
  id              String   @id @default(cuid())
  householdId     String
  counterpartyKey String   // normalisiert: lowercase, ohne Sonderzeichen, max 64 chars
  categoryId      String
  hitCount        Int      @default(1)
  lastUsedAt      DateTime @default(now())

  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  category  Category  @relation(fields: [categoryId], references: [id])

  @@unique([householdId, counterpartyKey])
  @@index([householdId, lastUsedAt])
}
```

Felder am `Transaction`-Model ergänzen (vor `createdAt`):

```prisma
  externalRef     String?
  externalHash    String?
  counterparty    String?
  sourceImportId  String?
```

Im Transaction-Model unten Relation + Indizes ergänzen:

```prisma
  csvImport            CsvImport?            @relation(fields: [sourceImportId], references: [id])

  @@unique([householdId, externalRef])
  @@index([householdId, externalHash])
  @@index([sourceImportId])
```

Im `Household`-Model die neuen Relations hinzufügen:

```prisma
  csvImports       CsvImport[]
  importLearnings  ImportLearning[]
```

Im `Category`-Model:

```prisma
  importLearnings  ImportLearning[]
```

- [ ] **Step 2: Migration für neue Tabellen erzeugen**

Run: `pnpm --filter api prisma migrate dev --name csv_import_tables --create-only`

Inhalt der `20260506100000_csv_import_tables/migration.sql` (Prisma erzeugt diese):

```sql
CREATE TABLE "CsvImport" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedDuplicates" INTEGER NOT NULL DEFAULT 0,
  "skippedFixed" INTEGER NOT NULL DEFAULT 0,
  "createdRecurrings" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CsvImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CsvImport_householdId_createdAt_idx" ON "CsvImport"("householdId", "createdAt");

ALTER TABLE "CsvImport" ADD CONSTRAINT "CsvImport_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ImportLearning" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "counterpartyKey" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "hitCount" INTEGER NOT NULL DEFAULT 1,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportLearning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportLearning_householdId_counterpartyKey_key"
  ON "ImportLearning"("householdId", "counterpartyKey");
CREATE INDEX "ImportLearning_householdId_lastUsedAt_idx"
  ON "ImportLearning"("householdId", "lastUsedAt");

ALTER TABLE "ImportLearning" ADD CONSTRAINT "ImportLearning_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportLearning" ADD CONSTRAINT "ImportLearning_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Migration für Transaction-Erweiterung**

Run: `pnpm --filter api prisma migrate dev --name transaction_external_fields --create-only`

Inhalt der `20260506100100_transaction_external_fields/migration.sql`:

```sql
ALTER TABLE "Transaction"
  ADD COLUMN "externalRef" TEXT,
  ADD COLUMN "externalHash" TEXT,
  ADD COLUMN "counterparty" TEXT,
  ADD COLUMN "sourceImportId" TEXT;

CREATE UNIQUE INDEX "Transaction_householdId_externalRef_key"
  ON "Transaction"("householdId", "externalRef");
CREATE INDEX "Transaction_householdId_externalHash_idx"
  ON "Transaction"("householdId", "externalHash");
CREATE INDEX "Transaction_sourceImportId_idx"
  ON "Transaction"("sourceImportId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceImportId_fkey"
  FOREIGN KEY ("sourceImportId") REFERENCES "CsvImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Migrationen anwenden + Prisma Client regenerieren**

Run: `pnpm --filter api prisma migrate dev` (ohne `--create-only`, wendet alle pending an)
Run: `pnpm --filter api prisma:generate`
Expected: PrismaClient hat jetzt `csvImport`, `importLearning`, `Transaction.externalRef` etc.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260506100000_csv_import_tables prisma/migrations/20260506100100_transaction_external_fields
git commit -m "feat(db): add CsvImport, ImportLearning tables and Transaction external fields"
```

---

### Task 2: Util — counterpartyKey-Normalisierung

**Files:**
- Create: `apps/api/src/csv-import/utils/counterparty-key.ts`
- Test: `apps/api/src/csv-import/utils/counterparty-key.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// apps/api/src/csv-import/utils/counterparty-key.spec.ts
import { describe, it, expect } from 'vitest';
import { counterpartyKey } from './counterparty-key';

describe('counterpartyKey', () => {
  it('returns lowercase', () => {
    expect(counterpartyKey('REWE Markt GmbH')).toBe('rewe markt gmbh');
  });

  it('strips special characters except spaces', () => {
    expect(counterpartyKey('REWE  SAGT*DANKE.')).toBe('rewe sagt danke');
  });

  it('collapses whitespace', () => {
    expect(counterpartyKey('  Spotify   AB   ')).toBe('spotify ab');
  });

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(100);
    expect(counterpartyKey(long).length).toBe(64);
  });

  it('returns empty string for null/undefined', () => {
    expect(counterpartyKey(null)).toBe('');
    expect(counterpartyKey(undefined)).toBe('');
  });

  it('preserves umlauts as ascii equivalents', () => {
    expect(counterpartyKey('Müller & Söhne GmbH')).toBe('mueller soehne gmbh');
  });
});
```

- [ ] **Step 2: Test laufen lassen — schlägt fehl**

Run: `pnpm --filter api vitest run src/csv-import/utils/counterparty-key.spec.ts`
Expected: FAIL (counterparty-key.ts existiert nicht)

- [ ] **Step 3: Implementierung**

```ts
// apps/api/src/csv-import/utils/counterparty-key.ts

const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
  'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue',
};

export function counterpartyKey(input: string | null | undefined): string {
  if (!input) return '';
  let s = input;
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    s = s.split(from).join(to);
  }
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9 ]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}
```

- [ ] **Step 4: Test grün**

Run: `pnpm --filter api vitest run src/csv-import/utils/counterparty-key.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/utils/counterparty-key.ts apps/api/src/csv-import/utils/counterparty-key.spec.ts
git commit -m "feat(csv-import): add counterpartyKey normalization util"
```

---

### Task 3: Util — Row-Hash

**Files:**
- Create: `apps/api/src/csv-import/utils/row-hash.ts`

- [ ] **Step 1: Implementierung (kein Test — trivialer Wrapper um node:crypto)**

```ts
// apps/api/src/csv-import/utils/row-hash.ts
import { createHash } from 'node:crypto';

export interface RowHashInput {
  date: string;          // ISO YYYY-MM-DD
  amountCents: number;
  counterpartyNorm: string;
  purposeNorm: string;
}

export function rowHash(input: RowHashInput): string {
  const payload = `${input.date}|${input.amountCents}|${input.counterpartyNorm}|${input.purposeNorm}`;
  return createHash('sha256').update(payload).digest('hex');
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/csv-import/utils/row-hash.ts
git commit -m "feat(csv-import): add row-hash util"
```

---

### Task 4: Sparkasse CAMT-V2 Parser

**Files:**
- Create: `apps/api/src/csv-import/parsers/sparkasse-camt-v2.parser.ts`
- Test: `apps/api/src/csv-import/parsers/sparkasse-camt-v2.parser.spec.ts`

Dependencies hinzufügen — Run im Repo-Root:
```bash
pnpm add -F @klar/api papaparse iconv-lite
pnpm add -F @klar/api -D @types/papaparse
```

- [ ] **Step 1: Test schreiben**

```ts
// apps/api/src/csv-import/parsers/sparkasse-camt-v2.parser.spec.ts
import { describe, it, expect } from 'vitest';
import { SparkasseCamtV2Parser } from './sparkasse-camt-v2.parser';

const HEADER = [
  '"Auftragskonto"',
  '"Buchungstag"',
  '"Valutadatum"',
  '"Buchungstext"',
  '"Verwendungszweck"',
  '"Glaeubiger ID"',
  '"Mandatsreferenz"',
  '"Kundenreferenz (End-to-End)"',
  '"Sammlerreferenz"',
  '"Lastschrift Ursprungsbetrag"',
  '"Auslagenersatz Ruecklastschrift"',
  '"Beguenstigter/Zahlungspflichtiger"',
  '"Kontonummer/IBAN"',
  '"BIC (SWIFT-Code)"',
  '"Betrag"',
  '"Waehrung"',
  '"Info"',
].join(';');

function row(values: (string | number)[]): string {
  return values.map(v => `"${v}"`).join(';');
}

function buildCsv(rows: string[]): Buffer {
  // Win-1252 encoded CSV
  return Buffer.from([HEADER, ...rows].join('\n'), 'latin1');
}

describe('SparkasseCamtV2Parser', () => {
  const parser = new SparkasseCamtV2Parser();

  it('parses a basic expense row', () => {
    const csv = buildCsv([
      row(['DE111', '15.04.26', '15.04.26', 'KARTENZAHLUNG', 'EREF+abc Kauf', '', '', 'abc', '', '', '', 'REWE SAGT DANKE', 'DE222', 'COBADEFFXXX', '-15,99', 'EUR', 'Umsatz gebucht']),
    ]);
    const rows = parser.parse(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-04-15',
      amountCents: -1599,
      counterparty: 'REWE SAGT DANKE',
      externalRef: 'abc',
    });
    expect(rows[0].purpose).toContain('Kauf');
  });

  it('parses positive amounts', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'GEHALT', 'Gehalt April', '', '', '', '', '', '', 'AG GmbH', 'DE222', 'X', '2.345,67', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].amountCents).toBe(234567);
  });

  it('handles umlauts via Win-1252 decoding', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'X', 'Müller', '', '', '', '', '', '', 'Müller GmbH', 'DE222', 'X', '-10,00', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].counterparty).toBe('Müller GmbH');
  });

  it('extracts MREF when no EREF', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'X', 'MREF+mandate-123 Strom', '', 'mandate-123', '', '', '', '', 'Stadtwerke', 'DE222', 'X', '-50,00', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].externalRef).toBe('mandate-123');
  });

  it('returns null externalRef when none present', () => {
    const csv = buildCsv([
      row(['DE111', '01.04.26', '01.04.26', 'X', 'Plain text', '', '', '', '', '', '', 'X', 'DE222', 'X', '-10,00', 'EUR', '']),
    ]);
    const rows = parser.parse(csv);
    expect(rows[0].externalRef).toBeNull();
  });

  it('throws on missing required header', () => {
    const bogus = Buffer.from('"Foo";"Bar"\n"a";"b"', 'latin1');
    expect(() => parser.parse(bogus)).toThrow(/Format wird nicht unterstützt/);
  });

  it('parses YY < 70 as 20YY, >= 70 as 19YY', () => {
    const csv = buildCsv([
      row(['DE111', '15.04.69', '15.04.69', 'X', 'X', '', '', '', '', '', '', 'X', 'DE222', 'X', '-1,00', 'EUR', '']),
    ]);
    expect(parser.parse(csv)[0].date).toBe('2069-04-15');

    const csv2 = buildCsv([
      row(['DE111', '15.04.70', '15.04.70', 'X', 'X', '', '', '', '', '', '', 'X', 'DE222', 'X', '-1,00', 'EUR', '']),
    ]);
    expect(parser.parse(csv2)[0].date).toBe('1970-04-15');
  });
});
```

- [ ] **Step 2: Test laufen lassen — fehlt**

Run: `pnpm --filter api vitest run src/csv-import/parsers/sparkasse-camt-v2.parser.spec.ts`
Expected: FAIL (Parser-Datei fehlt)

- [ ] **Step 3: Parser implementieren**

```ts
// apps/api/src/csv-import/parsers/sparkasse-camt-v2.parser.ts
import { Injectable } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import Papa from 'papaparse';
import { counterpartyKey } from '../utils/counterparty-key';

export interface ParsedRow {
  rowIndex: number;
  date: string;             // ISO YYYY-MM-DD
  amountCents: number;
  counterparty: string | null;
  counterpartyNorm: string;
  purpose: string | null;
  purposeNorm: string;
  externalRef: string | null;
}

const REQUIRED_HEADERS = [
  'Buchungstag',
  'Verwendungszweck',
  'Beguenstigter/Zahlungspflichtiger',
  'Betrag',
];

const REF_PATTERNS: Array<[RegExp, number]> = [
  [/EREF\+([^\s+]+)/, 1],
  [/KREF\+([^\s+]+)/, 1],
  [/MREF\+([^\s+]+)/, 1],
];

@Injectable()
export class SparkasseCamtV2Parser {
  parse(input: Buffer): ParsedRow[] {
    const text = iconv.decode(input, 'win1252');
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: h => h.trim().replace(/^"|"$/g, ''),
      transform: v => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v),
    });

    if (result.errors.length) {
      const fatal = result.errors.find(e => e.type === 'Delimiter' || e.type === 'FieldMismatch');
      if (fatal) throw new Error('Format wird nicht unterstützt — Sparkasse CAMT v2 erwartet');
    }

    const fields = result.meta.fields ?? [];
    for (const required of REQUIRED_HEADERS) {
      if (!fields.some(f => f === required)) {
        throw new Error('Format wird nicht unterstützt — Sparkasse CAMT v2 erwartet');
      }
    }

    return result.data.map((raw, idx) => this.mapRow(raw, idx));
  }

  private mapRow(raw: Record<string, string>, rowIndex: number): ParsedRow {
    const date = this.parseDate(raw['Buchungstag'] ?? '');
    const amountCents = this.parseAmount(raw['Betrag'] ?? '');
    const counterparty = (raw['Beguenstigter/Zahlungspflichtiger'] ?? '').trim() || null;
    const purpose = (raw['Verwendungszweck'] ?? '').replace(/\s+/g, ' ').trim() || null;
    const externalRef = this.extractRef(purpose ?? '', raw['Mandatsreferenz'] ?? '', raw['Kundenreferenz (End-to-End)'] ?? '');

    return {
      rowIndex,
      date,
      amountCents,
      counterparty,
      counterpartyNorm: counterpartyKey(counterparty),
      purpose,
      purposeNorm: counterpartyKey(purpose),
      externalRef,
    };
  }

  private parseDate(raw: string): string {
    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
    if (!match) throw new Error(`Ungültiges Datum: ${raw}`);
    const [, dd, mm, yyRaw] = match;
    let year: number;
    if (yyRaw.length === 4) year = Number(yyRaw);
    else {
      const yy = Number(yyRaw);
      year = yy < 70 ? 2000 + yy : 1900 + yy;
    }
    return `${year.toString().padStart(4, '0')}-${mm}-${dd}`;
  }

  private parseAmount(raw: string): number {
    const cleaned = raw.replace(/\./g, '').replace(',', '.');
    const num = Number(cleaned);
    if (Number.isNaN(num)) throw new Error(`Ungültiger Betrag: ${raw}`);
    return Math.round(num * 100);
  }

  private extractRef(purpose: string, mref: string, kref: string): string | null {
    for (const [pattern] of REF_PATTERNS) {
      const m = purpose.match(pattern);
      if (m && m[1]) return m[1];
    }
    if (kref?.trim()) return kref.trim();
    if (mref?.trim()) return mref.trim();
    return null;
  }
}
```

- [ ] **Step 4: Test grün**

Run: `pnpm --filter api vitest run src/csv-import/parsers/sparkasse-camt-v2.parser.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/parsers apps/api/package.json pnpm-lock.yaml
git commit -m "feat(csv-import): add Sparkasse CAMT v2 parser with Win-1252 decoding"
```

---

### Task 5: DuplicateDetector

**Files:**
- Create: `apps/api/src/csv-import/detection/duplicate-detector.ts`
- Test: `apps/api/src/csv-import/detection/duplicate-detector.spec.ts`

- [ ] **Step 1: Test**

```ts
// apps/api/src/csv-import/detection/duplicate-detector.spec.ts
import { describe, it, expect } from 'vitest';
import { DuplicateDetector } from './duplicate-detector';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-15',
  amountCents: -1599,
  counterparty: 'REWE',
  counterpartyNorm: 'rewe',
  purpose: 'Kauf',
  purposeNorm: 'kauf',
  externalRef: 'ref-abc',
  ...overrides,
});

describe('DuplicateDetector', () => {
  it('flags row whose externalRef already exists', () => {
    const det = new DuplicateDetector(new Set(['ref-abc']), new Set());
    expect(det.isDuplicate(row())).toBe(true);
  });

  it('flags row whose hash matches when no externalRef', () => {
    const r = row({ externalRef: null });
    const det = new DuplicateDetector(new Set(), new Set([DuplicateDetector.computeHash(r)]));
    expect(det.isDuplicate(r)).toBe(true);
  });

  it('returns false when neither matches', () => {
    const det = new DuplicateDetector(new Set(['other']), new Set(['other-hash']));
    expect(det.isDuplicate(row({ externalRef: null }))).toBe(false);
  });

  it('different hashes for different counterparty', () => {
    const a = row({ externalRef: null, counterpartyNorm: 'rewe' });
    const b = row({ externalRef: null, counterpartyNorm: 'edeka' });
    expect(DuplicateDetector.computeHash(a)).not.toBe(DuplicateDetector.computeHash(b));
  });
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter api vitest run src/csv-import/detection/duplicate-detector.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implementation**

```ts
// apps/api/src/csv-import/detection/duplicate-detector.ts
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';
import { rowHash } from '../utils/row-hash';

export class DuplicateDetector {
  constructor(
    private readonly existingRefs: Set<string>,
    private readonly existingHashes: Set<string>,
  ) {}

  static computeHash(row: ParsedRow): string {
    return rowHash({
      date: row.date,
      amountCents: row.amountCents,
      counterpartyNorm: row.counterpartyNorm,
      purposeNorm: row.purposeNorm,
    });
  }

  isDuplicate(row: ParsedRow): boolean {
    if (row.externalRef && this.existingRefs.has(row.externalRef)) return true;
    return this.existingHashes.has(DuplicateDetector.computeHash(row));
  }
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm --filter api vitest run src/csv-import/detection/duplicate-detector.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/detection/duplicate-detector.ts apps/api/src/csv-import/detection/duplicate-detector.spec.ts
git commit -m "feat(csv-import): add DuplicateDetector with externalRef + hash fallback"
```

---

### Task 6: FixedCostMatcher

**Files:**
- Create: `apps/api/src/csv-import/detection/fixed-cost-matcher.ts`
- Test: `apps/api/src/csv-import/detection/fixed-cost-matcher.spec.ts`

- [ ] **Step 1: Test**

```ts
// apps/api/src/csv-import/detection/fixed-cost-matcher.spec.ts
import { describe, it, expect } from 'vitest';
import { FixedCostMatcher, type RecurringForMatch } from './fixed-cost-matcher';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-01',
  amountCents: -999,
  counterparty: 'Spotify',
  counterpartyNorm: 'spotify',
  purpose: 'Spotify Premium',
  purposeNorm: 'spotify premium',
  externalRef: null,
  ...overrides,
});

const recurring = (overrides: Partial<RecurringForMatch> = {}): RecurringForMatch => ({
  id: 'rec1',
  name: 'Spotify',
  nameNorm: 'spotify',
  noteNorm: '',
  amountCents: -999,
  isVariable: false,
  isActive: true,
  dayOfMonth: 1,
  ...overrides,
});

describe('FixedCostMatcher', () => {
  it('matches when name and amount and date align', () => {
    const m = new FixedCostMatcher([recurring()]);
    expect(m.match(row())?.id).toBe('rec1');
  });

  it('honors 2% tolerance', () => {
    const m = new FixedCostMatcher([recurring({ amountCents: -1000 })]);
    expect(m.match(row({ amountCents: -999 }))).not.toBeNull();
  });

  it('honors 50 cent absolute tolerance for small amounts', () => {
    const m = new FixedCostMatcher([recurring({ amountCents: -100 })]);
    expect(m.match(row({ amountCents: -140 }))).not.toBeNull(); // 40 cent diff < 50
  });

  it('rejects amount outside tolerance', () => {
    const m = new FixedCostMatcher([recurring({ amountCents: -1000 })]);
    expect(m.match(row({ amountCents: -1500 }))).toBeNull();
  });

  it('skips inactive recurrings', () => {
    const m = new FixedCostMatcher([recurring({ isActive: false })]);
    expect(m.match(row())).toBeNull();
  });

  it('honors ±5 day window', () => {
    const m = new FixedCostMatcher([recurring({ dayOfMonth: 1 })]);
    expect(m.match(row({ date: '2026-04-06' }))).not.toBeNull();
    expect(m.match(row({ date: '2026-04-07' }))).toBeNull();
  });

  it('clamps dayOfMonth via safeDayOfMonth (Feb 31 → 28/29)', () => {
    const m = new FixedCostMatcher([recurring({ dayOfMonth: 31 })]);
    expect(m.match(row({ date: '2026-02-28' }))).not.toBeNull();
  });

  it('skips amount tolerance for variable recurrings but still requires name match', () => {
    const m = new FixedCostMatcher([recurring({ isVariable: true, amountCents: -100 })]);
    expect(m.match(row({ amountCents: -50000 }))?.id).toBe('rec1');
  });

  it('matches by note substring', () => {
    const m = new FixedCostMatcher([recurring({ name: 'Streaming', nameNorm: 'streaming', noteNorm: 'spotify abo' })]);
    expect(m.match(row())?.id).toBe('rec1');
  });
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter api vitest run src/csv-import/detection/fixed-cost-matcher.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implementation**

```ts
// apps/api/src/csv-import/detection/fixed-cost-matcher.ts
import { safeDayOfMonth } from '@klar/shared';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

export interface RecurringForMatch {
  id: string;
  name: string;
  nameNorm: string;
  noteNorm: string;
  amountCents: number;
  isVariable: boolean;
  isActive: boolean;
  dayOfMonth: number | null;
}

const DATE_WINDOW_DAYS = 5;

export class FixedCostMatcher {
  constructor(private readonly recurrings: RecurringForMatch[]) {}

  match(row: ParsedRow): RecurringForMatch | null {
    for (const rec of this.recurrings) {
      if (!rec.isActive) continue;
      if (!this.nameMatches(row, rec)) continue;
      if (!rec.isVariable && !this.amountMatches(row.amountCents, rec.amountCents)) continue;
      if (!this.dateMatches(row.date, rec.dayOfMonth)) continue;
      return rec;
    }
    return null;
  }

  private nameMatches(row: ParsedRow, rec: RecurringForMatch): boolean {
    const cp = row.counterpartyNorm;
    if (!cp) return false;
    if (rec.nameNorm && (cp.includes(rec.nameNorm) || rec.nameNorm.includes(cp))) return true;
    if (rec.noteNorm && rec.noteNorm.includes(cp)) return true;
    return false;
  }

  private amountMatches(rowAmount: number, recAmount: number): boolean {
    const diff = Math.abs(rowAmount - recAmount);
    const tolerance = Math.max(50, Math.abs(recAmount) * 0.02);
    return diff <= tolerance;
  }

  private dateMatches(rowDate: string, dayOfMonth: number | null): boolean {
    if (dayOfMonth === null) return true;
    const [y, m] = rowDate.split('-').map(Number);
    const expectedDay = safeDayOfMonth(y, m, dayOfMonth);
    const expected = new Date(Date.UTC(y, m - 1, expectedDay));
    const actual = new Date(`${rowDate}T00:00:00Z`);
    const diffDays = Math.abs((actual.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= DATE_WINDOW_DAYS;
  }
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm --filter api vitest run src/csv-import/detection/fixed-cost-matcher.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/detection/fixed-cost-matcher.ts apps/api/src/csv-import/detection/fixed-cost-matcher.spec.ts
git commit -m "feat(csv-import): add FixedCostMatcher with tolerance bands and date window"
```

---

### Task 7: RecurringSuggester

**Files:**
- Create: `apps/api/src/csv-import/detection/recurring-suggester.ts`
- Test: `apps/api/src/csv-import/detection/recurring-suggester.spec.ts`

- [ ] **Step 1: Test**

```ts
// apps/api/src/csv-import/detection/recurring-suggester.spec.ts
import { describe, it, expect } from 'vitest';
import { RecurringSuggester, type HistoryEntry } from './recurring-suggester';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-15',
  amountCents: -1299,
  counterparty: 'Netflix',
  counterpartyNorm: 'netflix',
  purpose: 'Abo',
  purposeNorm: 'abo',
  externalRef: null,
  ...overrides,
});

const hist = (date: string, amount = -1299): HistoryEntry => ({
  counterpartyNorm: 'netflix',
  date,
  amountCents: amount,
});

describe('RecurringSuggester', () => {
  it('suggests MONTHLY when 4 monthly entries within tolerance', () => {
    const s = new RecurringSuggester([
      hist('2025-12-15'),
      hist('2026-01-15'),
      hist('2026-02-15'),
      hist('2026-03-15'),
    ]);
    expect(s.suggest(row())?.estimatedFrequency).toBe('MONTHLY');
  });

  it('returns null when fewer than 3 occurrences', () => {
    const s = new RecurringSuggester([hist('2026-01-15'), hist('2026-02-15')]);
    expect(s.suggest(row())).toBeNull();
  });

  it('suggests QUARTERLY for 3-month spacing', () => {
    const s = new RecurringSuggester([
      hist('2025-04-15'),
      hist('2025-07-15'),
      hist('2025-10-15'),
    ]);
    expect(s.suggest(row())?.estimatedFrequency).toBe('QUARTERLY');
  });

  it('suggests YEARLY for 12-month spacing', () => {
    const s = new RecurringSuggester([
      hist('2023-04-15'),
      hist('2024-04-15'),
      hist('2025-04-15'),
    ]);
    expect(s.suggest(row())?.estimatedFrequency).toBe('YEARLY');
  });

  it('returns null for irregular spacing', () => {
    const s = new RecurringSuggester([
      hist('2026-01-01'),
      hist('2026-01-20'),
      hist('2026-03-15'),
    ]);
    expect(s.suggest(row())).toBeNull();
  });

  it('rejects entries outside 5% amount tolerance', () => {
    const s = new RecurringSuggester([
      hist('2026-01-15', -2000),
      hist('2026-02-15', -2000),
      hist('2026-03-15', -2000),
    ]);
    // row.amountCents -1299, history all -2000 → no match
    expect(s.suggest(row())).toBeNull();
  });
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter api vitest run src/csv-import/detection/recurring-suggester.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implementation**

```ts
// apps/api/src/csv-import/detection/recurring-suggester.ts
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

export interface HistoryEntry {
  counterpartyNorm: string;
  date: string;
  amountCents: number;
}

export type EstimatedFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface SuggestionResult {
  estimatedFrequency: EstimatedFrequency;
  pastOccurrences: number;
}

const AMOUNT_TOLERANCE_PCT = 0.05;

export class RecurringSuggester {
  private readonly byCp: Map<string, HistoryEntry[]>;

  constructor(history: HistoryEntry[]) {
    this.byCp = new Map();
    for (const e of history) {
      if (!this.byCp.has(e.counterpartyNorm)) this.byCp.set(e.counterpartyNorm, []);
      this.byCp.get(e.counterpartyNorm)!.push(e);
    }
  }

  suggest(row: ParsedRow): SuggestionResult | null {
    if (!row.counterpartyNorm) return null;
    const all = this.byCp.get(row.counterpartyNorm) ?? [];
    const matches = all.filter(e => this.amountMatches(e.amountCents, row.amountCents));
    if (matches.length < 3) return null;

    const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(this.daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const freq = this.classifyFrequency(avg);
    if (!freq) return null;
    return { estimatedFrequency: freq, pastOccurrences: matches.length };
  }

  private amountMatches(a: number, b: number): boolean {
    const tolerance = Math.abs(b) * AMOUNT_TOLERANCE_PCT;
    return Math.abs(a - b) <= tolerance;
  }

  private daysBetween(a: string, b: string): number {
    const ta = new Date(`${a}T00:00:00Z`).getTime();
    const tb = new Date(`${b}T00:00:00Z`).getTime();
    return Math.abs(tb - ta) / (1000 * 60 * 60 * 24);
  }

  private classifyFrequency(avgDays: number): EstimatedFrequency | null {
    if (avgDays >= 28 && avgDays <= 32) return 'MONTHLY';
    if (avgDays >= 85 && avgDays <= 95) return 'QUARTERLY';
    if (avgDays >= 360 && avgDays <= 370) return 'YEARLY';
    return null;
  }
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm --filter api vitest run src/csv-import/detection/recurring-suggester.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/detection/recurring-suggester.ts apps/api/src/csv-import/detection/recurring-suggester.spec.ts
git commit -m "feat(csv-import): add RecurringSuggester heuristic"
```

---

### Task 8: CategorySuggester

**Files:**
- Create: `apps/api/src/csv-import/detection/category-suggester.ts`
- Test: `apps/api/src/csv-import/detection/category-suggester.spec.ts`

- [ ] **Step 1: Test**

```ts
// apps/api/src/csv-import/detection/category-suggester.spec.ts
import { describe, it, expect } from 'vitest';
import { CategorySuggester } from './category-suggester';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (cp = 'spotify'): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-01',
  amountCents: -999,
  counterparty: cp,
  counterpartyNorm: cp,
  purpose: '',
  purposeNorm: '',
  externalRef: null,
});

describe('CategorySuggester', () => {
  it('returns EXACT when matching active recurring name', () => {
    const s = new CategorySuggester(
      [{ nameNorm: 'spotify', categoryId: 'cat-abo' }],
      new Map(),
    );
    expect(s.suggest(row())).toEqual({ categoryId: 'cat-abo', confidence: 'EXACT' });
  });

  it('returns LEARNED when ImportLearning has entry', () => {
    const s = new CategorySuggester(
      [],
      new Map([['rewe', 'cat-food']]),
    );
    expect(s.suggest(row('rewe'))).toEqual({ categoryId: 'cat-food', confidence: 'LEARNED' });
  });

  it('prefers EXACT over LEARNED', () => {
    const s = new CategorySuggester(
      [{ nameNorm: 'spotify', categoryId: 'cat-abo' }],
      new Map([['spotify', 'cat-other']]),
    );
    expect(s.suggest(row())).toEqual({ categoryId: 'cat-abo', confidence: 'EXACT' });
  });

  it('returns NONE when no match', () => {
    const s = new CategorySuggester([], new Map());
    expect(s.suggest(row())).toEqual({ categoryId: null, confidence: 'NONE' });
  });
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter api vitest run src/csv-import/detection/category-suggester.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implementation**

```ts
// apps/api/src/csv-import/detection/category-suggester.ts
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

export type Confidence = 'EXACT' | 'LEARNED' | 'NONE';

export interface CategorySuggestion {
  categoryId: string | null;
  confidence: Confidence;
}

export interface RecurringForCategory {
  nameNorm: string;
  categoryId: string;
}

export class CategorySuggester {
  constructor(
    private readonly recurrings: RecurringForCategory[],
    private readonly learnings: Map<string, string>,
  ) {}

  suggest(row: ParsedRow): CategorySuggestion {
    if (!row.counterpartyNorm) return { categoryId: null, confidence: 'NONE' };

    for (const rec of this.recurrings) {
      if (!rec.nameNorm) continue;
      if (row.counterpartyNorm.includes(rec.nameNorm) || rec.nameNorm.includes(row.counterpartyNorm)) {
        return { categoryId: rec.categoryId, confidence: 'EXACT' };
      }
    }

    const learned = this.learnings.get(row.counterpartyNorm);
    if (learned) return { categoryId: learned, confidence: 'LEARNED' };

    return { categoryId: null, confidence: 'NONE' };
  }
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm --filter api vitest run src/csv-import/detection/category-suggester.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/detection/category-suggester.ts apps/api/src/csv-import/detection/category-suggester.spec.ts
git commit -m "feat(csv-import): add CategorySuggester"
```

---

### Task 9: Repository

**Files:**
- Create: `apps/api/src/csv-import/csv-import.repository.ts`

- [ ] **Step 1: Implementierung (Repository wird in Service-Tests gemockt; dedizierter Integrationstest in Task 12)**

```ts
// apps/api/src/csv-import/csv-import.repository.ts
import { Injectable } from '@nestjs/common';
import type { CsvImport, RecurringTransaction, RecurringFrequency, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionFromImport {
  householdId: string;
  createdByUserId: string;
  amountCents: number;
  categoryId: string;
  projectId: string | null;
  date: Date;
  description: string | null;
  visibility: Visibility;
  externalRef: string | null;
  externalHash: string;
  counterparty: string | null;
  sourceImportId: string;
}

export interface CreateRecurringFromImport {
  householdId: string;
  createdByUserId: string;
  name: string;
  amountCents: number;
  categoryId: string;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  startDate: Date;
  visibility: Visibility;
}

@Injectable()
export class CsvImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  createCsvImport(data: { householdId: string; createdByUserId: string; filename: string; rowCount: number }): Promise<CsvImport> {
    return this.prisma.csvImport.create({
      data: {
        householdId: data.householdId,
        createdByUserId: data.createdByUserId,
        filename: data.filename,
        rowCount: data.rowCount,
      },
    });
  }

  finalizeCsvImport(id: string, counters: { importedCount: number; skippedDuplicates: number; skippedFixed: number; createdRecurrings: number }): Promise<CsvImport> {
    return this.prisma.csvImport.update({ where: { id }, data: counters });
  }

  loadExistingRefs(householdId: string, refs: string[]): Promise<string[]> {
    if (refs.length === 0) return Promise.resolve([]);
    return this.prisma.transaction
      .findMany({ where: { householdId, externalRef: { in: refs } }, select: { externalRef: true } })
      .then(rows => rows.map(r => r.externalRef!).filter(Boolean));
  }

  loadExistingHashes(householdId: string, hashes: string[]): Promise<string[]> {
    if (hashes.length === 0) return Promise.resolve([]);
    return this.prisma.transaction
      .findMany({ where: { householdId, externalHash: { in: hashes } }, select: { externalHash: true } })
      .then(rows => rows.map(r => r.externalHash!).filter(Boolean));
  }

  loadActiveRecurrings(householdId: string): Promise<RecurringTransaction[]> {
    return this.prisma.recurringTransaction.findMany({ where: { householdId, isActive: true } });
  }

  loadRecentTransactions(householdId: string, sinceISO: string): Promise<{ counterparty: string | null; date: Date; amountCents: number }[]> {
    return this.prisma.transaction.findMany({
      where: { householdId, date: { gte: new Date(`${sinceISO}T00:00:00Z`) }, counterparty: { not: null } },
      select: { counterparty: true, date: true, amountCents: true },
    });
  }

  loadLearnings(householdId: string): Promise<{ counterpartyKey: string; categoryId: string }[]> {
    return this.prisma.importLearning.findMany({ where: { householdId }, select: { counterpartyKey: true, categoryId: true } });
  }

  upsertLearning(householdId: string, counterpartyKey: string, categoryId: string): Promise<void> {
    return this.prisma.importLearning
      .upsert({
        where: { householdId_counterpartyKey: { householdId, counterpartyKey } },
        create: { householdId, counterpartyKey, categoryId },
        update: { categoryId, hitCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      .then(() => undefined);
  }

  createTransaction(data: CreateTransactionFromImport) {
    return this.prisma.transaction.create({ data });
  }

  createRecurring(data: CreateRecurringFromImport) {
    return this.prisma.recurringTransaction.create({ data });
  }

  assertCategoryInHousehold(householdId: string, categoryId: string) {
    return this.prisma.category.findFirst({ where: { id: categoryId, householdId }, select: { id: true } });
  }

  assertProjectInHousehold(householdId: string, projectId: string) {
    return this.prisma.project.findFirst({ where: { id: projectId, householdId }, select: { id: true } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/csv-import/csv-import.repository.ts
git commit -m "feat(csv-import): add repository"
```

---

### Task 10: Service

**Files:**
- Create: `apps/api/src/csv-import/csv-import.service.ts`
- Test: `apps/api/src/csv-import/csv-import.service.spec.ts`

- [ ] **Step 1: Service-Test (mit gemocktem Repository)**

```ts
// apps/api/src/csv-import/csv-import.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CsvImportService } from './csv-import.service';
import { SparkasseCamtV2Parser } from './parsers/sparkasse-camt-v2.parser';
import type { CsvImportRepository } from './csv-import.repository';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'user1', householdId: 'hh1', source: 'web' };

const csvWithOneRow = () => {
  const header = ['Auftragskonto', 'Buchungstag', 'Valutadatum', 'Buchungstext', 'Verwendungszweck',
    'Glaeubiger ID', 'Mandatsreferenz', 'Kundenreferenz (End-to-End)', 'Sammlerreferenz',
    'Lastschrift Ursprungsbetrag', 'Auslagenersatz Ruecklastschrift',
    'Beguenstigter/Zahlungspflichtiger', 'Kontonummer/IBAN', 'BIC (SWIFT-Code)',
    'Betrag', 'Waehrung', 'Info'].map(h => `"${h}"`).join(';');
  const r = ['DE111', '15.04.26', '15.04.26', 'X', 'EREF+ref-1 Kauf', '', '', 'ref-1', '', '', '',
    'REWE', 'DE222', 'X', '-15,99', 'EUR', ''].map(v => `"${v}"`).join(';');
  return Buffer.from([header, r].join('\n'), 'latin1').toString('base64');
};

function makeRepo(): CsvImportRepository {
  return {
    createCsvImport: vi.fn().mockResolvedValue({ id: 'imp1' }),
    finalizeCsvImport: vi.fn().mockResolvedValue({}),
    loadExistingRefs: vi.fn().mockResolvedValue([]),
    loadExistingHashes: vi.fn().mockResolvedValue([]),
    loadActiveRecurrings: vi.fn().mockResolvedValue([]),
    loadRecentTransactions: vi.fn().mockResolvedValue([]),
    loadLearnings: vi.fn().mockResolvedValue([]),
    upsertLearning: vi.fn().mockResolvedValue(undefined),
    createTransaction: vi.fn().mockResolvedValue({}),
    createRecurring: vi.fn().mockResolvedValue({}),
    assertCategoryInHousehold: vi.fn().mockResolvedValue({ id: 'cat1' }),
    assertProjectInHousehold: vi.fn().mockResolvedValue({ id: 'p1' }),
  } as unknown as CsvImportRepository;
}

describe('CsvImportService', () => {
  let repo: CsvImportRepository;
  let service: CsvImportService;

  beforeEach(() => {
    repo = makeRepo();
    service = new CsvImportService(new SparkasseCamtV2Parser(), repo);
  });

  it('analyze returns NEW status for unseen row', async () => {
    const result = await service.analyze(ctx, csvWithOneRow());
    expect(result.summary.total).toBe(1);
    expect(result.rows[0].status).toBe('NEW');
  });

  it('analyze marks duplicate when externalRef known', async () => {
    (repo.loadExistingRefs as any).mockResolvedValue(['ref-1']);
    const result = await service.analyze(ctx, csvWithOneRow());
    expect(result.rows[0].status).toBe('DUPLICATE');
  });

  it('confirm imports row and upserts learning', async () => {
    const result = await service.confirm(ctx, csvWithOneRow(), {
      filename: 'a.csv',
      rows: [{ rowIndex: 0, skip: false, categoryId: 'cat1', projectId: null, visibility: 'SHARED', createNewRecurring: false }],
    });
    expect(result.imported).toBe(1);
    expect(repo.createTransaction).toHaveBeenCalledTimes(1);
    expect(repo.upsertLearning).toHaveBeenCalledWith('hh1', 'rewe', 'cat1');
  });

  it('confirm with skip increments correct counter', async () => {
    const result = await service.confirm(ctx, csvWithOneRow(), {
      filename: 'a.csv',
      rows: [{ rowIndex: 0, skip: true, skipReason: 'fixed' }],
    });
    expect(result.skippedFixed).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('confirm rejects categoryId not in household', async () => {
    (repo.assertCategoryInHousehold as any).mockResolvedValue(null);
    await expect(
      service.confirm(ctx, csvWithOneRow(), {
        filename: 'a.csv',
        rows: [{ rowIndex: 0, skip: false, categoryId: 'evil-cat', projectId: null, visibility: 'SHARED', createNewRecurring: false }],
      })
    ).rejects.toThrow();
  });

  it('confirm with createNewRecurring creates recurring + transaction', async () => {
    const result = await service.confirm(ctx, csvWithOneRow(), {
      filename: 'a.csv',
      rows: [{ rowIndex: 0, skip: false, categoryId: 'cat1', projectId: null, visibility: 'SHARED', createNewRecurring: true }],
    });
    expect(result.createdRecurrings).toBe(1);
    expect(repo.createRecurring).toHaveBeenCalledOnce();
    expect(repo.createTransaction).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter api vitest run src/csv-import/csv-import.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Service-Implementation**

```ts
// apps/api/src/csv-import/csv-import.service.ts
import { Injectable, BadRequestException, UnprocessableEntityException, PayloadTooLargeException } from '@nestjs/common';
import { Visibility, RecurringFrequency } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { SparkasseCamtV2Parser, type ParsedRow } from './parsers/sparkasse-camt-v2.parser';
import { CsvImportRepository } from './csv-import.repository';
import { DuplicateDetector } from './detection/duplicate-detector';
import { FixedCostMatcher, type RecurringForMatch } from './detection/fixed-cost-matcher';
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
  suggestedCategoryId?: string;
  suggestedCategoryConfidence: 'EXACT' | 'LEARNED' | 'NONE';
  suggestedRecurring?: { estimatedFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; pastOccurrences: number };
}

export interface AnalyzeResponse {
  summary: { total: number; new: number; duplicates: number; fixedCostMatches: number; recurringSuggestions: number };
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
    const hashesToCheck = parsed.filter(r => !r.externalRef).map(r => DuplicateDetector.computeHash(r));

    const [existingRefs, existingHashes, recurringsRaw, learningsRaw, recentTx] = await Promise.all([
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
    const fixed = new FixedCostMatcher(recurringsForMatch);
    const suggester = new RecurringSuggester(
      recentTx.map(t => ({ counterpartyNorm: counterpartyKey(t.counterparty), date: t.date.toISOString().slice(0, 10), amountCents: t.amountCents })),
    );
    const learnings = new Map(learningsRaw.map(l => [l.counterpartyKey, l.categoryId]));
    const catSuggester = new CategorySuggester(
      recurringsForMatch.filter(r => r.isActive).map(r => ({ nameNorm: r.nameNorm, categoryId: recurringsRaw.find(x => x.id === r.id)!.categoryId })),
      learnings,
    );

    const rows: AnalyzeRow[] = parsed.map(p => {
      const baseSuggestion = catSuggester.suggest(p);
      if (dup.isDuplicate(p)) {
        return this.toAnalyzeRow(p, 'DUPLICATE', baseSuggestion);
      }
      const match = fixed.match(p);
      if (match) {
        return { ...this.toAnalyzeRow(p, 'FIXED_COST_MATCH', baseSuggestion), matchedRecurringId: match.id };
      }
      const sug = suggester.suggest(p);
      if (sug) {
        return { ...this.toAnalyzeRow(p, 'RECURRING_SUGGESTION', baseSuggestion), suggestedRecurring: sug };
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

  async confirm(ctx: RequestContext, fileBase64: string, payload: ConfirmPayload): Promise<ConfirmResponse> {
    const buffer = this.decodeBase64(fileBase64);
    const parsed = this.parseOrThrow(buffer);

    const csvImport = await this.repo.createCsvImport({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      filename: payload.filename,
      rowCount: parsed.length,
    });

    let imported = 0, skippedDup = 0, skippedFixed = 0, skippedUser = 0, newRecs = 0;

    for (const sel of payload.rows) {
      const row = parsed[sel.rowIndex];
      if (!row) throw new BadRequestException(`Ungültige Zeile ${sel.rowIndex}`);

      if (sel.skip) {
        if (sel.skipReason === 'duplicate') skippedDup++;
        else if (sel.skipReason === 'fixed') skippedFixed++;
        else skippedUser++;
        continue;
      }

      if (!sel.categoryId) throw new BadRequestException(`Kategorie fehlt für Zeile ${sel.rowIndex}`);

      const cat = await this.repo.assertCategoryInHousehold(ctx.householdId, sel.categoryId);
      if (!cat) throw new UnprocessableEntityException(`Kategorie ${sel.categoryId} nicht gefunden`);

      if (sel.projectId) {
        const p = await this.repo.assertProjectInHousehold(ctx.householdId, sel.projectId);
        if (!p) throw new UnprocessableEntityException(`Projekt ${sel.projectId} nicht gefunden`);
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

  private toAnalyzeRow(p: ParsedRow, status: RowStatus, sug: { categoryId: string | null; confidence: 'EXACT' | 'LEARNED' | 'NONE' }): AnalyzeRow {
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
    if (buf.byteLength > MAX_FILE_BYTES) throw new PayloadTooLargeException('Datei zu groß (max 5 MB)');
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
```

- [ ] **Step 4: Verify green**

Run: `pnpm --filter api vitest run src/csv-import/csv-import.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/csv-import.service.ts apps/api/src/csv-import/csv-import.service.spec.ts
git commit -m "feat(csv-import): add service with analyze and confirm flows"
```

---

### Task 11: Controller + Module + AppModule-Wiring

**Files:**
- Create: `apps/api/src/csv-import/csv-import.controller.ts`
- Create: `apps/api/src/csv-import/csv-import.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Controller**

```ts
// apps/api/src/csv-import/csv-import.controller.ts
import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { CsvImportService, type ConfirmPayload } from './csv-import.service';

@Controller('households/:hid/csv-import')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class CsvImportController {
  constructor(private readonly service: CsvImportService) {}

  @Post('analyze')
  analyze(@ReqContext() ctx: RequestContext, @Body('fileBase64') fileBase64: string) {
    if (!fileBase64) throw new BadRequestException('fileBase64 ist erforderlich');
    return this.service.analyze(ctx, fileBase64);
  }

  @Post('confirm')
  confirm(@ReqContext() ctx: RequestContext, @Body() body: { fileBase64: string } & ConfirmPayload) {
    if (!body.fileBase64) throw new BadRequestException('fileBase64 ist erforderlich');
    if (!body.filename) throw new BadRequestException('filename ist erforderlich');
    if (!Array.isArray(body.rows)) throw new BadRequestException('rows ist erforderlich');
    return this.service.confirm(ctx, body.fileBase64, { filename: body.filename, rows: body.rows });
  }
}
```

- [ ] **Step 2: Module**

```ts
// apps/api/src/csv-import/csv-import.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { CsvImportController } from './csv-import.controller';
import { CsvImportService } from './csv-import.service';
import { CsvImportRepository } from './csv-import.repository';
import { SparkasseCamtV2Parser } from './parsers/sparkasse-camt-v2.parser';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [CsvImportService, CsvImportRepository, SparkasseCamtV2Parser],
  controllers: [CsvImportController],
})
export class CsvImportModule {}
```

- [ ] **Step 3: AppModule wire-up**

In `apps/api/src/app.module.ts`:
- Import-Zeile ergänzen: `import { CsvImportModule } from './csv-import/csv-import.module';`
- In `imports`-Array nach `DataTransferModule` einfügen: `CsvImportModule,`

- [ ] **Step 4: Build prüfen**

Run: `pnpm --filter api lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/csv-import/csv-import.controller.ts apps/api/src/csv-import/csv-import.module.ts apps/api/src/app.module.ts
git commit -m "feat(csv-import): wire controller and module into AppModule"
```

---

### Task 12: E2E Test (Supertest)

**Files:**
- Create: `apps/api/src/csv-import/csv-import.e2e.spec.ts`

- [ ] **Step 1: Test schreiben — orientiert sich an `data-transfer.e2e.spec.ts`**

```ts
// apps/api/src/csv-import/csv-import.e2e.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import request from 'supertest';

// Helpers (mirror existing pattern):
async function registerAndLogin(app: NestFastifyApplication, email: string) {
  const httpServer = app.getHttpServer();
  await request(httpServer).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'T' });
  const r = await request(httpServer).post('/api/v1/auth/login').send({ email, password: 'TestPass123!' });
  return { token: r.body.accessToken, userId: r.body.user.id, householdId: r.body.user.activeHouseholdId };
}

const HEADER = ['Auftragskonto','Buchungstag','Valutadatum','Buchungstext','Verwendungszweck','Glaeubiger ID','Mandatsreferenz','Kundenreferenz (End-to-End)','Sammlerreferenz','Lastschrift Ursprungsbetrag','Auslagenersatz Ruecklastschrift','Beguenstigter/Zahlungspflichtiger','Kontonummer/IBAN','BIC (SWIFT-Code)','Betrag','Waehrung','Info'].map(h=>`"${h}"`).join(';');
const buildCsv = (rows: string[][]) => Buffer.from([HEADER, ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n'), 'latin1').toString('base64');

describe('CsvImport (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.importLearning.deleteMany();
    await prisma.csvImport.deleteMany();
    await prisma.recurringTransaction.deleteMany();
    await prisma.category.deleteMany();
    await prisma.householdMember.deleteMany();
    await prisma.household.deleteMany();
    await prisma.user.deleteMany();
  });

  it('analyze + confirm imports a NEW row', async () => {
    const { token, householdId } = await registerAndLogin(app, 'a@x.com');
    const cat = await prisma.category.create({ data: { householdId, name: 'Lebensmittel', type: 'VARIABLE_EXPENSE', color: '#000' } });
    const csv = buildCsv([['DE111','15.04.26','15.04.26','X','EREF+r1 Kauf','','','r1','','','','REWE','DE2','X','-15,99','EUR','']]);

    const analyze = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/csv-import/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileBase64: csv });
    expect(analyze.status).toBe(201);
    expect(analyze.body.rows[0].status).toBe('NEW');

    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/csv-import/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileBase64: csv, filename: 'a.csv', rows: [{ rowIndex: 0, skip: false, categoryId: cat.id, projectId: null, visibility: 'SHARED', createNewRecurring: false }] });
    expect(confirm.status).toBe(201);
    expect(confirm.body.imported).toBe(1);

    const txs = await prisma.transaction.findMany({ where: { householdId } });
    expect(txs).toHaveLength(1);
    expect(txs[0].externalRef).toBe('r1');
  });

  it('re-import shows DUPLICATE on second run', async () => {
    const { token, householdId } = await registerAndLogin(app, 'b@x.com');
    const cat = await prisma.category.create({ data: { householdId, name: 'X', type: 'VARIABLE_EXPENSE', color: '#000' } });
    const csv = buildCsv([['DE111','15.04.26','15.04.26','X','EREF+r1 X','','','r1','','','','REWE','DE2','X','-1,00','EUR','']]);

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/csv-import/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileBase64: csv, filename: 'a.csv', rows: [{ rowIndex: 0, skip: false, categoryId: cat.id, projectId: null, visibility: 'SHARED', createNewRecurring: false }] });

    const analyze2 = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/csv-import/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileBase64: csv });
    expect(analyze2.body.rows[0].status).toBe('DUPLICATE');
  });

  it('rejects categoryId from another household', async () => {
    const a = await registerAndLogin(app, 'c@x.com');
    const b = await registerAndLogin(app, 'd@x.com');
    const otherCat = await prisma.category.create({ data: { householdId: b.householdId, name: 'X', type: 'VARIABLE_EXPENSE', color: '#000' } });
    const csv = buildCsv([['DE111','15.04.26','15.04.26','X','X','','','','','','','REWE','DE2','X','-1,00','EUR','']]);

    const r = await request(app.getHttpServer())
      .post(`/api/v1/households/${a.householdId}/csv-import/confirm`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ fileBase64: csv, filename: 'a.csv', rows: [{ rowIndex: 0, skip: false, categoryId: otherCat.id, projectId: null, visibility: 'SHARED', createNewRecurring: false }] });
    expect(r.status).toBe(422);
  });

  it('returns 401 without auth', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/households/x/csv-import/analyze')
      .send({ fileBase64: 'x' });
    expect(r.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run e2e**

Run: `pnpm --filter api test:e2e -- src/csv-import/csv-import.e2e.spec.ts`
Expected: PASS (4 tests). Wenn das Helper-Pattern abweicht: an `data-transfer.e2e.spec.ts` orientieren und Helpers wiederverwenden.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/csv-import/csv-import.e2e.spec.ts
git commit -m "test(csv-import): add e2e tests for analyze/confirm flow"
```

---

### Task 13: Frontend Service + Types

**Files:**
- Create: `apps/web/src/app/core/csv-import/csv-import.service.ts`
- Create: `apps/web/src/app/core/csv-import/csv-import.types.ts`

- [ ] **Step 1: Types**

```ts
// apps/web/src/app/core/csv-import/csv-import.types.ts
export type RowStatus = 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';
export type Confidence = 'EXACT' | 'LEARNED' | 'NONE';

export interface AnalyzeRow {
  rowIndex: number;
  date: string;
  amountCents: number;
  counterparty: string | null;
  purpose: string | null;
  externalRef: string | null;
  status: RowStatus;
  matchedRecurringId?: string;
  suggestedCategoryId?: string;
  suggestedCategoryConfidence: Confidence;
  suggestedRecurring?: { estimatedFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; pastOccurrences: number };
}

export interface AnalyzeResponse {
  summary: { total: number; new: number; duplicates: number; fixedCostMatches: number; recurringSuggestions: number };
  rows: AnalyzeRow[];
}

export interface ConfirmRowSelection {
  rowIndex: number;
  skip: boolean;
  skipReason?: 'duplicate' | 'fixed' | 'user';
  categoryId?: string;
  projectId?: string | null;
  visibility?: 'PRIVATE' | 'SHARED';
  createNewRecurring?: boolean;
}

export interface ConfirmResponse {
  imported: number;
  skippedDuplicates: number;
  skippedFixed: number;
  skippedByUser: number;
  createdRecurrings: number;
  csvImportId: string;
}
```

- [ ] **Step 2: Service**

```ts
// apps/web/src/app/core/csv-import/csv-import.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../households/household.store';
import type { AnalyzeResponse, ConfirmResponse, ConfirmRowSelection } from './csv-import.types';

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  private http = inject(HttpClient);
  private household = inject(HouseholdStore);

  private base() {
    const id = this.household.activeId();
    return `/api/v1/households/${id}/csv-import`;
  }

  async fileToBase64(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  analyze(fileBase64: string): Promise<AnalyzeResponse> {
    return firstValueFrom(this.http.post<AnalyzeResponse>(`${this.base()}/analyze`, { fileBase64 }));
  }

  confirm(fileBase64: string, filename: string, rows: ConfirmRowSelection[]): Promise<ConfirmResponse> {
    return firstValueFrom(this.http.post<ConfirmResponse>(`${this.base()}/confirm`, { fileBase64, filename, rows }));
  }
}
```

- [ ] **Step 3: Service-Test**

```ts
// apps/web/src/app/core/csv-import/csv-import.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CsvImportService } from './csv-import.service';
import { HouseholdStore } from '../households/household.store';
import { signal } from '@angular/core';

describe('CsvImportService', () => {
  let service: CsvImportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HouseholdStore, useValue: { activeId: signal('hh1') } },
      ],
    });
    service = TestBed.inject(CsvImportService);
    http = TestBed.inject(HttpTestingController);
  });

  it('posts analyze with fileBase64', async () => {
    const p = service.analyze('AAA');
    const req = http.expectOne('/api/v1/households/hh1/csv-import/analyze');
    expect(req.request.body).toEqual({ fileBase64: 'AAA' });
    req.flush({ summary: { total: 0, new: 0, duplicates: 0, fixedCostMatches: 0, recurringSuggestions: 0 }, rows: [] });
    await p;
  });

  it('posts confirm with payload', async () => {
    const p = service.confirm('AAA', 'a.csv', [{ rowIndex: 0, skip: true }]);
    const req = http.expectOne('/api/v1/households/hh1/csv-import/confirm');
    expect(req.request.body.filename).toBe('a.csv');
    req.flush({ imported: 0, skippedDuplicates: 0, skippedFixed: 0, skippedByUser: 1, createdRecurrings: 0, csvImportId: 'i1' });
    await p;
  });
});
```

- [ ] **Step 4: Test green**

Run: `pnpm --filter web vitest run src/app/core/csv-import/csv-import.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/core/csv-import
git commit -m "feat(web): add CsvImportService and types"
```

---

### Task 14: Upload-Step Component

**Files:**
- Create: `apps/web/src/app/pages/csv-import/components/csv-upload-step.component.ts`

- [ ] **Step 1: Implementation**

```ts
// apps/web/src/app/pages/csv-import/components/csv-upload-step.component.ts
import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';

@Component({
  selector: 'app-csv-upload-step',
  standalone: true,
  imports: [HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <header class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">CSV-Import — Sparkasse</h2>
        <p class="text-sm text-muted-foreground">
          Online-Banking → Umsätze → Export → CSV-CAMT v2
        </p>
      </header>

      <label
        class="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-background py-10 text-center min-h-[44px] cursor-pointer hover:bg-accent/30 active:bg-accent/40 transition-colors"
      >
        <span class="text-base text-foreground">Datei auswählen…</span>
        <span class="text-xs text-muted-foreground">{{ fileName() ?? 'CSV, max. 5 MB' }}</span>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          class="hidden"
          (change)="onFileChange($event)"
        />
      </label>

      @if (errorMessage()) {
        <p class="text-sm text-danger">{{ errorMessage() }}</p>
      }

      <div class="flex justify-end">
        <button hlmBtn variant="default" [disabled]="!file() || analyzing()" (click)="emit()">
          @if (analyzing()) { Analysiere… } @else { Analysieren }
        </button>
      </div>
    </div>
  `,
})
export class CsvUploadStepComponent {
  readonly analyzing = signal(false);
  readonly file = signal<File | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly fileSelected = output<File>();

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      this.errorMessage.set('Datei zu groß (max 5 MB)');
      return;
    }
    this.errorMessage.set(null);
    this.file.set(f);
    this.fileName.set(f.name);
  }

  emit() {
    const f = this.file();
    if (!f) return;
    this.analyzing.set(true);
    this.fileSelected.emit(f);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/pages/csv-import/components/csv-upload-step.component.ts
git commit -m "feat(web): add csv upload step component"
```

---

### Task 15: Preview-Row + Preview-Table Components

**Files:**
- Create: `apps/web/src/app/pages/csv-import/components/csv-preview-row.component.ts`
- Create: `apps/web/src/app/pages/csv-import/components/csv-preview-table.component.ts`

- [ ] **Step 1: Preview-Row**

```ts
// apps/web/src/app/pages/csv-import/components/csv-preview-row.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmBadgeDirective } from '../../../shared/ui/hlm/hlm-badge.directive';
import { HlmCheckboxComponent } from '../../../shared/ui/hlm/hlm-checkbox.component';
import { HlmSelectNativeDirective } from '../../../shared/ui/hlm/hlm-select-native.directive';
import { KlarAvatarComponent } from '../../../shared/ui/klar-avatar/klar-avatar.component';
import type { AnalyzeRow, ConfirmRowSelection } from '../../../core/csv-import/csv-import.types';

interface CategoryOption { id: string; name: string; }

@Component({
  selector: 'app-csv-preview-row',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmBadgeDirective, HlmCheckboxComponent, HlmSelectNativeDirective, KlarAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 border-l-2 py-2.5 px-4 md:flex-row md:items-center"
         [class.border-success]="row().status === 'NEW'"
         [class.border-warning]="row().status === 'RECURRING_SUGGESTION'"
         [class.border-muted]="row().status === 'DUPLICATE' || row().status === 'FIXED_COST_MATCH'"
         [class.opacity-60]="!selection().skip ? false : true">

      <div class="flex items-center gap-3 md:flex-1">
        <hlm-checkbox [ngModel]="!selection().skip" (ngModelChange)="onIncludeChange($event)" [disabled]="row().status === 'FIXED_COST_MATCH' || row().status === 'DUPLICATE'" />
        <klar-avatar [seed]="row().counterparty ?? '—'" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ row().counterparty ?? '—' }}</div>
          <div class="text-xs text-muted-foreground truncate">{{ row().purpose }}</div>
        </div>
      </div>

      <div class="flex items-center gap-3 md:w-auto">
        <span class="text-xs text-muted-foreground font-mono tabular-nums w-20">{{ row().date }}</span>
        <span class="font-mono tabular-nums text-sm w-24 text-right" [class.text-success]="row().amountCents > 0" [class.text-danger]="row().amountCents < 0">
          {{ formatAmount(row().amountCents) }}
        </span>
        <span hlmBadge [variant]="badgeVariant()">{{ statusLabel() }}</span>
      </div>

      @if (!selection().skip && row().status !== 'DUPLICATE' && row().status !== 'FIXED_COST_MATCH') {
        <div class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2 md:w-72">
          <select hlmSelect class="w-full scheme-dark text-base"
                  [ngModel]="selection().categoryId ?? ''"
                  (ngModelChange)="onCategoryChange($event)">
            <option value="">— Kategorie —</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
          @if (row().suggestedCategoryConfidence === 'LEARNED') {
            <span hlmBadge variant="muted" class="text-[10px]">Gelernt</span>
          } @else if (row().suggestedCategoryConfidence === 'EXACT') {
            <span hlmBadge variant="muted" class="text-[10px]">Aus Fixkosten</span>
          }
        </div>
      }

      @if (row().status === 'RECURRING_SUGGESTION' && !selection().skip) {
        <label class="flex items-center gap-2 text-xs text-muted-foreground md:ml-2">
          <hlm-checkbox [ngModel]="selection().createNewRecurring ?? false" (ngModelChange)="onRecurringToggle($event)" />
          <span>Als Fixkosten ({{ row().suggestedRecurring?.estimatedFrequency }})</span>
        </label>
      }
    </div>
  `,
})
export class CsvPreviewRowComponent {
  readonly row = input.required<AnalyzeRow>();
  readonly selection = input.required<ConfirmRowSelection>();
  readonly categories = input.required<CategoryOption[]>();
  readonly selectionChange = output<ConfirmRowSelection>();

  readonly badgeVariant = computed<'default' | 'muted' | 'success' | 'warning'>(() => {
    switch (this.row().status) {
      case 'NEW': return 'success';
      case 'RECURRING_SUGGESTION': return 'warning';
      default: return 'muted';
    }
  });

  readonly statusLabel = computed(() => {
    switch (this.row().status) {
      case 'NEW': return 'Neu';
      case 'DUPLICATE': return 'Duplikat';
      case 'FIXED_COST_MATCH': return 'Fixkosten';
      case 'RECURRING_SUGGESTION': return 'Vorschlag';
    }
  });

  formatAmount(cents: number): string {
    return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  onIncludeChange(include: boolean) {
    this.selectionChange.emit({ ...this.selection(), skip: !include });
  }

  onCategoryChange(categoryId: string) {
    this.selectionChange.emit({ ...this.selection(), categoryId: categoryId || undefined });
  }

  onRecurringToggle(v: boolean) {
    this.selectionChange.emit({ ...this.selection(), createNewRecurring: v });
  }
}
```

- [ ] **Step 2: Preview-Table**

```ts
// apps/web/src/app/pages/csv-import/components/csv-preview-table.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsvPreviewRowComponent } from './csv-preview-row.component';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import type { AnalyzeResponse, ConfirmRowSelection } from '../../../core/csv-import/csv-import.types';

interface CategoryOption { id: string; name: string; }
type FilterKey = 'all' | 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';

@Component({
  selector: 'app-csv-preview-table',
  standalone: true,
  imports: [CommonModule, CsvPreviewRowComponent, HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex gap-2 overflow-x-auto pb-1 sticky top-0 bg-background z-10">
        @for (chip of chips(); track chip.key) {
          <button type="button"
                  class="rounded-full border px-3 py-1.5 text-xs whitespace-nowrap min-h-[44px] transition-colors"
                  [class.border-primary]="filter() === chip.key"
                  [class.text-primary]="filter() === chip.key"
                  [class.border-border]="filter() !== chip.key"
                  (click)="filter.set(chip.key)">
            {{ chip.label }} ({{ chip.count }})
          </button>
        }
      </div>

      <div class="flex flex-col gap-1 rounded-lg border border-border bg-card divide-y divide-border">
        @for (row of filteredRows(); track row.rowIndex) {
          <app-csv-preview-row
            [row]="row"
            [selection]="getSelection(row.rowIndex)"
            [categories]="categories()"
            (selectionChange)="onSelectionChange($event)" />
        }
      </div>

      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between sticky bottom-0 bg-background py-3 border-t border-border">
        <span class="text-sm text-muted-foreground">
          {{ importableCount() }} importieren · {{ skippedCount() }} übersprungen
        </span>
        <button hlmBtn variant="default"
                [disabled]="!canSubmit() || submitting()"
                (click)="submit.emit()">
          @if (submitting()) { Importiere… } @else { {{ importableCount() }} Buchungen importieren }
        </button>
      </div>
    </div>
  `,
})
export class CsvPreviewTableComponent {
  readonly analyzeResult = input.required<AnalyzeResponse>();
  readonly selections = input.required<Map<number, ConfirmRowSelection>>();
  readonly categories = input.required<CategoryOption[]>();
  readonly submitting = input<boolean>(false);

  readonly selectionsChange = output<Map<number, ConfirmRowSelection>>();
  readonly submit = output<void>();

  readonly filter = signal<FilterKey>('all');

  readonly chips = computed(() => {
    const s = this.analyzeResult().summary;
    return [
      { key: 'all' as FilterKey, label: 'Alle', count: s.total },
      { key: 'NEW' as FilterKey, label: 'Neu', count: s.new },
      { key: 'RECURRING_SUGGESTION' as FilterKey, label: 'Vorschläge', count: s.recurringSuggestions },
      { key: 'FIXED_COST_MATCH' as FilterKey, label: 'Fixkosten', count: s.fixedCostMatches },
      { key: 'DUPLICATE' as FilterKey, label: 'Duplikate', count: s.duplicates },
    ];
  });

  readonly filteredRows = computed(() => {
    const f = this.filter();
    const rows = this.analyzeResult().rows;
    return f === 'all' ? rows : rows.filter(r => r.status === f);
  });

  readonly importableCount = computed(() =>
    Array.from(this.selections().values()).filter(s => !s.skip && !!s.categoryId).length,
  );

  readonly skippedCount = computed(() =>
    Array.from(this.selections().values()).filter(s => s.skip).length,
  );

  readonly canSubmit = computed(() => {
    if (this.importableCount() === 0) return false;
    return Array.from(this.selections().values()).every(s => s.skip || !!s.categoryId);
  });

  getSelection(rowIndex: number): ConfirmRowSelection {
    return this.selections().get(rowIndex) ?? { rowIndex, skip: true };
  }

  onSelectionChange(sel: ConfirmRowSelection) {
    const next = new Map(this.selections());
    next.set(sel.rowIndex, sel);
    this.selectionsChange.emit(next);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/pages/csv-import/components/csv-preview-row.component.ts apps/web/src/app/pages/csv-import/components/csv-preview-table.component.ts
git commit -m "feat(web): add CSV preview row and table components"
```

---

### Task 16: Summary-Component + Page-Container

**Files:**
- Create: `apps/web/src/app/pages/csv-import/components/csv-import-summary.component.ts`
- Create: `apps/web/src/app/pages/csv-import/csv-import.page.ts`

- [ ] **Step 1: Summary-Component**

```ts
// apps/web/src/app/pages/csv-import/components/csv-import-summary.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import type { ConfirmResponse } from '../../../core/csv-import/csv-import.types';

@Component({
  selector: 'app-csv-import-summary',
  standalone: true,
  imports: [HlmButtonDirective, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h2 class="text-lg font-semibold">Import abgeschlossen</h2>
      <dl class="grid grid-cols-2 gap-y-2 text-sm">
        <dt class="text-muted-foreground">Importiert</dt>
        <dd class="font-mono tabular-nums text-success text-right">{{ result().imported }}</dd>
        <dt class="text-muted-foreground">Duplikate übersprungen</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().skippedDuplicates }}</dd>
        <dt class="text-muted-foreground">Fixkosten übersprungen</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().skippedFixed }}</dd>
        <dt class="text-muted-foreground">Vom User übersprungen</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().skippedByUser }}</dd>
        <dt class="text-muted-foreground">Neue Fixkosten angelegt</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().createdRecurrings }}</dd>
      </dl>
      <div class="flex flex-col gap-2 md:flex-row md:justify-end">
        <a hlmBtn variant="ghost" routerLink="/cashflow">Zum Cashflow</a>
        <button hlmBtn variant="default" (click)="restart.emit()">Weitere CSV importieren</button>
      </div>
    </div>
  `,
})
export class CsvImportSummaryComponent {
  readonly result = input.required<ConfirmResponse>();
  readonly restart = output<void>();
}
```

- [ ] **Step 2: Page-Container**

```ts
// apps/web/src/app/pages/csv-import/csv-import.page.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsvImportService } from '../../core/csv-import/csv-import.service';
import { CategoryStore } from '../../core/categories/category.store';
import { TransactionStore } from '../../core/transactions/transaction.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { ToastService } from '../../core/toast/toast.service';
import { CsvUploadStepComponent } from './components/csv-upload-step.component';
import { CsvPreviewTableComponent } from './components/csv-preview-table.component';
import { CsvImportSummaryComponent } from './components/csv-import-summary.component';
import type { AnalyzeResponse, ConfirmResponse, ConfirmRowSelection } from '../../core/csv-import/csv-import.types';

type Step = 'upload' | 'preview' | 'done';

@Component({
  selector: 'app-csv-import-page',
  standalone: true,
  imports: [CommonModule, CsvUploadStepComponent, CsvPreviewTableComponent, CsvImportSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-[100dvh] flex flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto">
      <h1 class="text-xl font-semibold">CSV-Import</h1>

      @switch (step()) {
        @case ('upload') {
          <app-csv-upload-step (fileSelected)="onFileSelected($event)" />
        }
        @case ('preview') {
          @if (analyzeResult(); as result) {
            <app-csv-preview-table
              [analyzeResult]="result"
              [selections]="selections()"
              [categories]="categoryOptions()"
              [submitting]="submitting()"
              (selectionsChange)="selections.set($event)"
              (submit)="onSubmit()" />
          }
        }
        @case ('done') {
          @if (confirmResult(); as r) {
            <app-csv-import-summary [result]="r" (restart)="reset()" />
          }
        }
      }
    </main>
  `,
})
export class CsvImportPageComponent {
  private readonly csv = inject(CsvImportService);
  private readonly categories = inject(CategoryStore);
  private readonly transactions = inject(TransactionStore);
  private readonly recurrings = inject(RecurringTransactionsService);
  private readonly toast = inject(ToastService);

  readonly step = signal<Step>('upload');
  readonly fileBase64 = signal<string | null>(null);
  readonly filename = signal<string | null>(null);
  readonly analyzeResult = signal<AnalyzeResponse | null>(null);
  readonly selections = signal<Map<number, ConfirmRowSelection>>(new Map());
  readonly submitting = signal(false);
  readonly confirmResult = signal<ConfirmResponse | null>(null);

  readonly categoryOptions = computed(() => (this.categories.items() ?? []).map(c => ({ id: c.id, name: c.name })));

  async onFileSelected(file: File) {
    try {
      const b64 = await this.csv.fileToBase64(file);
      this.fileBase64.set(b64);
      this.filename.set(file.name);
      const result = await this.csv.analyze(b64);
      this.analyzeResult.set(result);
      this.selections.set(this.buildInitialSelections(result));
      this.step.set('preview');
    } catch (err) {
      this.toast.error((err as Error).message ?? 'CSV konnte nicht analysiert werden');
    }
  }

  private buildInitialSelections(result: AnalyzeResponse): Map<number, ConfirmRowSelection> {
    const map = new Map<number, ConfirmRowSelection>();
    for (const r of result.rows) {
      const skip = r.status === 'DUPLICATE' || r.status === 'FIXED_COST_MATCH';
      const skipReason = r.status === 'DUPLICATE' ? 'duplicate' : r.status === 'FIXED_COST_MATCH' ? 'fixed' : undefined;
      map.set(r.rowIndex, {
        rowIndex: r.rowIndex,
        skip,
        skipReason: skipReason as 'duplicate' | 'fixed' | undefined,
        categoryId: r.suggestedCategoryId,
        projectId: null,
        visibility: 'SHARED',
        createNewRecurring: false,
      });
    }
    return map;
  }

  async onSubmit() {
    const b64 = this.fileBase64();
    const fn = this.filename();
    if (!b64 || !fn) return;
    this.submitting.set(true);
    try {
      const rows = Array.from(this.selections().values());
      const result = await this.csv.confirm(b64, fn, rows);
      this.confirmResult.set(result);
      this.transactions.reload?.();
      await this.recurrings.loadAll?.();
      this.step.set('done');
      this.toast.success(`${result.imported} Buchungen importiert`);
    } catch (err) {
      this.toast.error((err as Error).message ?? 'Import fehlgeschlagen');
    } finally {
      this.submitting.set(false);
    }
  }

  reset() {
    this.step.set('upload');
    this.fileBase64.set(null);
    this.filename.set(null);
    this.analyzeResult.set(null);
    this.selections.set(new Map());
    this.confirmResult.set(null);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/pages/csv-import
git commit -m "feat(web): add CSV import page with wizard flow"
```

---

### Task 17: Routing + Navigation-Eintrag

**Files:**
- Modify: `apps/web/src/app/app.routes.ts`
- Modify: Sidebar/Mobile-Sheet-Navigation (Settings-Bereich)

- [ ] **Step 1: Route eintragen**

In `apps/web/src/app/app.routes.ts` hinzufügen (innerhalb der authenticated Routes):

```ts
{
  path: 'import',
  loadComponent: () =>
    import('./pages/csv-import/csv-import.page').then(m => m.CsvImportPageComponent),
},
```

- [ ] **Step 2: Navigation suchen + Eintrag hinzufügen**

Run: `pnpm exec rg -l "Einstellungen|Settings|Mehr" apps/web/src/app/layout`
Suche nach dem Settings/More-Sheet bzw. Sidebar-Items-Array. Eintrag ergänzen:

```ts
{ label: 'CSV-Import', icon: 'lucide:upload', route: '/import' },
```

(Exakter Pfad und Icon-Key abhängig von vorhandener Nav-Struktur — in der bestehenden Liste analog zu anderen Settings-Einträgen platzieren.)

- [ ] **Step 3: Build prüfen**

Run: `pnpm --filter web build`
Expected: Build success, neue Route ist im chunked output

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app
git commit -m "feat(web): add /import route and navigation entry"
```

---

### Task 18: Playwright E2E (Happy Path)

**Files:**
- Create: `apps/web/e2e/csv-import.spec.ts`
- Create: `apps/web/e2e/fixtures/sparkasse-camt-v2.csv` (Win-1252 encoded)

- [ ] **Step 1: Fixture erzeugen**

Run als Node-Script (einmalig, dann checken-in):
```ts
// apps/web/e2e/fixtures/build-fixture.ts
import { writeFileSync } from 'node:fs';
const HEADER = ['Auftragskonto','Buchungstag','Valutadatum','Buchungstext','Verwendungszweck','Glaeubiger ID','Mandatsreferenz','Kundenreferenz (End-to-End)','Sammlerreferenz','Lastschrift Ursprungsbetrag','Auslagenersatz Ruecklastschrift','Beguenstigter/Zahlungspflichtiger','Kontonummer/IBAN','BIC (SWIFT-Code)','Betrag','Waehrung','Info'].map(h=>`"${h}"`).join(';');
const rows = [
  ['DE111','15.04.26','15.04.26','X','EREF+abc Kauf','','','abc','','','','REWE SAGT DANKE','DE2','X','-15,99','EUR',''],
  ['DE111','03.04.26','03.04.26','X','Netflix Abo','','','','','','','Netflix','DE2','X','-12,99','EUR',''],
];
const csv = [HEADER, ...rows.map(r=>r.map(c=>`"${c}"`).join(';'))].join('\n');
writeFileSync('apps/web/e2e/fixtures/sparkasse-camt-v2.csv', Buffer.from(csv, 'latin1'));
```

Run: `npx tsx apps/web/e2e/fixtures/build-fixture.ts`

- [ ] **Step 2: Test schreiben**

```ts
// apps/web/e2e/csv-import.spec.ts
import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login flow — vorhandenes login-fixture-pattern verwenden (siehe andere e2e-Tests)
  });

  test('happy path: import two rows', async ({ page }) => {
    await page.goto('/import');
    await expect(page.getByRole('heading', { name: 'CSV-Import' })).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/sparkasse-camt-v2.csv'));
    await page.getByRole('button', { name: 'Analysieren' }).click();

    await expect(page.getByText('Neu (2)')).toBeVisible();

    // Beide Zeilen Kategorie zuordnen — erste verfügbare Kategorie
    const selects = page.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });

    await page.getByRole('button', { name: /Buchungen importieren/ }).click();
    await expect(page.getByText('Import abgeschlossen')).toBeVisible();
  });
});
```

- [ ] **Step 3: Test ausführen**

Run: `pnpm --filter web e2e -- csv-import.spec.ts`
Expected: PASS (1 test). Bei Login-Fixture-Anpassung an bestehendes Pattern halten.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/csv-import.spec.ts apps/web/e2e/fixtures
git commit -m "test(web): add e2e for CSV import happy path"
```

---

### Task 19: Final Check + Coverage

- [ ] **Step 1: Lint + Tests komplett**

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter web lint
pnpm --filter web test
```

Expected: alle grün, Coverage Backend ≥ 80%, Frontend ≥ 70%

- [ ] **Step 2: Manuelle Smoke (gemäß CLAUDE.md "Feature-Completeness")**

- Login → /import navigieren → CSV hochladen → Preview sehen → 2 Kategorien zuordnen → Importieren
- Cashflow öffnen → neue Buchungen sichtbar
- Erneut /import mit gleicher Datei → alle als DUPLICATE
- Recurring "Spotify" anlegen → CSV mit Spotify-Buchung → FIXED_COST_MATCH

- [ ] **Step 3: Build prüfen**

```bash
pnpm build
```

Expected: success

- [ ] **Step 4: Memory-Update**

```bash
memory_store(key="klar-csv-import-sparkasse", value="CSV-Import implementiert: Sparkasse CAMT v2 Parser mit Win-1252, Detection-Pipeline (Duplicate/FixedCost/Suggestion/Category), 3 Migrations, /import Wizard. Fixkosten-Matches werden NICHT importiert.", namespace="klar-app")
memory_store(key="pattern-csv-import-base64-body", value="CSV/Datei-Uploads gehen als base64 im JSON-Body (gleiches Pattern wie data-transfer-Modul, kein Multipart). Server dekodiert + parst.", namespace="patterns")
```

---

## Self-Review

**Spec coverage:**
- ✅ CAMT-V2-Parser → Task 4
- ✅ DuplicateDetector → Task 5
- ✅ FixedCostMatcher → Task 6
- ✅ RecurringSuggester → Task 7
- ✅ CategorySuggester (EXACT/LEARNED/NONE) → Task 8
- ✅ Service mit analyze + confirm → Task 10
- ✅ Migrations (CsvImport, ImportLearning, Transaction-Erweiterung) → Task 1
- ✅ Wizard-UI (upload → preview → done) → Tasks 14-16
- ✅ Filter-Chips, Bulk-Aktionen werden in Preview-Table abgebildet → Task 15 (Bulk-Aktionen-Sheet wurde aus YAGNI-Gründen weggelassen — kann Phase 2 sein)
- ✅ Cross-Tenant-Schutz (assertCategoryInHousehold) → Task 10
- ✅ Stores reloaden nach Confirm → Task 16
- ✅ E2E Backend → Task 12
- ✅ E2E Frontend → Task 18

**Bewusste Auslassungen ggü. Spec (YAGNI):** Bulk-Kategorie-Setzen-Sheet, Drag&Drop. Beides leicht nachzuziehen wenn Bedarf real wird.

**Type consistency:** `RowStatus`, `Confidence`, `ConfirmRowSelection`, `AnalyzeRow` sind in Backend (Service) und Frontend (Types) deckungsgleich.

**Placeholder scan:** Keine TBDs / TODOs außer dem expliziten "exakter Nav-Item-Pfad muss aus bestehender Nav-Liste übernommen werden" in Task 17 — das ist nicht trivial im Plan vorzeichenbar ohne den existierenden Code zu sehen.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-06-csv-import-sparkasse.md`.

# CSV-Import (Sparkasse) mit Fixkosten-Erkennung — Design Spec

**Datum:** 2026-05-05
**Status:** Approved
**Scope:** Sparkasse-CAMT-V2-CSV importieren, Duplikate erkennen, Fixkosten gegen `RecurringTransaction` matchen (nicht doppelt importieren), neue Daueraufträge vorschlagen, Kategorien lernend zuordnen.

Dieses Feature ist NICHT zu verwechseln mit `2026-05-04-import-export-design.md` (JSON-basierter Dev→Prod-Transfer).

---

## Ziel

Marco lädt die monatliche Sparkasse-CSV hoch und bekommt einen Preview, in dem er pro Buchung sieht:
- ob sie neu, ein Duplikat, ein Fixkosten-Match oder ein Recurring-Vorschlag ist,
- welche Kategorie automatisch vorgeschlagen wird (gelernt aus History oder aus bestehenden Recurrings),
- ob er sie importieren will oder nicht.

Fixkosten werden **nicht** als zusätzliche Transaction importiert — sie laufen über `RecurringTransaction`.

---

## Phase-1-Scope

- Format: **Sparkasse CAMT-V2-CSV** (Semikolon, Windows-1252, deutsche Header)
- Single-Account-Import pro Datei
- UI: dedizierte Seite `/import` (Settings-Bereich auf Desktop, "Mehr"-Sheet auf Mobile)
- Kein Drag&Drop in Phase 1 (nur File-Picker)

Out of scope (spätere Phasen): andere Banken, generisches Spalten-Mapping, manuelle Regel-Engine, Multi-Account.

---

## Datenmodell

### Erweiterungen an `Transaction`

```prisma
model Transaction {
  // ... bestehende Felder ...
  externalRef     String?   // Sparkasse Endto-End-Ref / Mandatsref / Kundenreferenz
  externalHash    String?   // SHA-256 über (date|amountCents|counterpartyNorm|purposeNorm) — Fallback-Dedupe
  counterparty    String?   // Empfänger/Absender aus CSV
  sourceImportId  String?   // FK auf CsvImport, Audit-Trail

  csvImport       CsvImport? @relation(fields: [sourceImportId], references: [id])

  @@unique([householdId, externalRef])
  @@index([householdId, externalHash])
  @@index([sourceImportId])
}
```

`externalRef` und `externalHash` sind beide nullable, weil manuelle Buchungen keine haben. Der `@@unique`-Index wirkt nur, wenn `externalRef` gesetzt ist (Postgres unique ignoriert NULLs).

### Neue Tabelle `CsvImport`

```prisma
model CsvImport {
  id                String   @id @default(cuid())
  householdId       String
  createdByUserId   String
  filename          String
  rowCount          Int
  importedCount     Int
  skippedDuplicates Int
  skippedFixed      Int
  createdRecurrings Int      @default(0)
  createdAt         DateTime @default(now())

  household    Household     @relation(fields: [householdId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([householdId, createdAt])
}
```

### Neue Tabelle `ImportLearning`

Lernt `(counterparty → category)` aus User-Entscheidungen. Bewusst getrennt von `RecurringTransaction` — Recurring bleibt ein User-Konzept, Learning ist Import-Maschinerie.

```prisma
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

### Migrations

1. `add_csv_import_table` — Tabelle `CsvImport`
2. `add_import_learning_table` — Tabelle `ImportLearning`
3. `add_transaction_external_fields` — `externalRef`, `externalHash`, `counterparty`, `sourceImportId` auf `Transaction` (nullable + Indizes)

Nach jeder Migration: `prisma:generate` ausführen, kein `as any` auf den neuen Feldern stehen lassen.

---

## API Design

Alle Endpoints unter `POST /api/v1/households/:hid/csv-import/...`
Guard: `HouseholdMemberGuard` (jedes Mitglied darf importieren).
`householdId` kommt **immer** aus `:hid`, nie aus Body.

### `POST /csv-import/analyze`

Multipart-Upload, parst die Datei und gibt pro Zeile Status + Vorschläge zurück. **Kein DB-Write.**

**Request:** `multipart/form-data` mit Feld `file` (5 MB Limit, Mime `text/csv` oder `text/plain`).

**Response 200:**
```json
{
  "summary": {
    "total": 58,
    "new": 47,
    "duplicates": 3,
    "fixedCostMatches": 6,
    "recurringSuggestions": 2
  },
  "rows": [
    {
      "rowIndex": 0,
      "date": "2026-04-15",
      "amountCents": -1599,
      "counterparty": "REWE SAGT DANKE",
      "purpose": "Kartenzahlung 14.04.",
      "externalRef": "NOTPROVIDED+xyz",
      "status": "NEW",
      "suggestedCategoryId": "cat_lebensmittel",
      "suggestedCategoryConfidence": "LEARNED"
    },
    {
      "rowIndex": 4,
      "date": "2026-04-01",
      "amountCents": -999,
      "counterparty": "Spotify AB",
      "purpose": "Spotify Premium",
      "externalRef": "MD-2026-04-01-spotify",
      "status": "FIXED_COST_MATCH",
      "matchedRecurringId": "rec_spotify"
    },
    {
      "rowIndex": 12,
      "date": "2026-04-03",
      "amountCents": -1299,
      "counterparty": "Netflix",
      "purpose": "Netflix Abo",
      "externalRef": null,
      "status": "RECURRING_SUGGESTION",
      "suggestedCategoryId": "cat_abos",
      "suggestedCategoryConfidence": "LEARNED",
      "suggestedRecurring": {
        "estimatedFrequency": "MONTHLY",
        "pastOccurrences": 4
      }
    }
  ]
}
```

**Status-Werte:**
- `NEW` — neu, soll importiert werden
- `DUPLICATE` — bereits in DB (default off im UI)
- `FIXED_COST_MATCH` — gematcht gegen aktive `RecurringTransaction` (default off, wird nicht importiert)
- `RECURRING_SUGGESTION` — sieht aus wie ein neuer Dauerauftrag (default on, mit Toggle "Als Fixkosten speichern")

**Confidence-Werte:**
- `EXACT` — Counterparty matcht aktiven Recurring → dessen Kategorie
- `LEARNED` — Match in `ImportLearning`
- `NONE` — keine Vorschlagsmöglichkeit, User muss zuordnen

### `POST /csv-import/confirm`

**Request:**
```json
{
  "filename": "umsaetze_2026_04.csv",
  "rows": [
    {
      "rowIndex": 0,
      "skip": false,
      "categoryId": "cat_lebensmittel",
      "projectId": null,
      "visibility": "SHARED",
      "createNewRecurring": false
    },
    {
      "rowIndex": 4,
      "skip": true
    },
    {
      "rowIndex": 12,
      "skip": false,
      "categoryId": "cat_abos",
      "visibility": "SHARED",
      "createNewRecurring": true
    }
  ]
}
```

Der Server hat den geparsten CSV-Inhalt nicht mehr im State — der Client schickt entweder die Datei nochmal mit (multipart) oder die Confirm-Payload enthält die kompletten Row-Daten. Wir wählen **die Datei nochmal mit:** Server parst erneut, validiert über `rowIndex`, dass die Zeile existiert. Macht den Server stateless und vermeidet Manipulation im Client.

Damit wird `confirm` ebenfalls multipart:
- `file`: dieselbe CSV
- `payload`: JSON-String mit `rows[]`

**Response 200:**
```json
{
  "imported": 47,
  "skippedDuplicates": 3,
  "skippedFixed": 6,
  "skippedByUser": 0,
  "createdRecurrings": 1,
  "csvImportId": "imp_abc123"
}
```

**Fehler (RFC 7807):**
| Fehler | Status | Detail |
|---|---|---|
| Datei nicht parsebar | 400 | "CSV konnte nicht gelesen werden" |
| Falsches Format / Header | 400 | "Format wird nicht unterstützt — Sparkasse CAMT v2 erwartet" |
| Datei > 5 MB | 413 | "Datei zu groß" |
| Falsches Mime | 415 | "Nur CSV-Dateien" |
| `rowIndex` außerhalb | 400 | "Ungültige Zeile {n}" |
| `categoryId` nicht im Haushalt | 422 | "Kategorie {id} nicht gefunden" |

---

## Backend-Architektur

```
apps/api/src/csv-import/
  csv-import.module.ts
  csv-import.controller.ts
  csv-import.service.ts
  csv-import.repository.ts
  parsers/
    sparkasse-camt-v2.parser.ts
  detection/
    duplicate-detector.ts
    fixed-cost-matcher.ts
    recurring-suggester.ts
    category-suggester.ts
  utils/
    counterparty-key.ts             — normalisiert (lowercase, Sonderzeichen weg, max 64)
    row-hash.ts                     — SHA-256
  dto/
    analyze-result.dto.ts
    confirm-import.dto.ts
```

### Parser

`SparkasseCamtV2Parser`:
1. Buffer von `Win-1252` zu UTF-8 konvertieren (`iconv-lite`)
2. CSV mit `;` als Delimiter parsen (`papaparse` oder `csv-parse`)
3. Header validieren — erwartete Spalten u.a.: `Auftragskonto`, `Buchungstag`, `Valutadatum`, `Buchungstext`, `Verwendungszweck`, `Beguenstigter/Zahlungspflichtiger`, `Kontonummer/IBAN`, `Betrag`, `Waehrung`, `Info`
4. Pro Zeile mappen:
   - `date`: `Buchungstag` (`DD.MM.YY` → `YYYY-MM-DD`)
   - `amountCents`: `Betrag` (`-1.234,56` → `-123456`, Vorzeichen behalten)
   - `counterparty`: `Beguenstigter/Zahlungspflichtiger`
   - `purpose`: `Verwendungszweck` (mehrzeilig zu einer Zeile zusammenfügen)
   - `externalRef`: aus `Verwendungszweck` extrahiert (`EREF+...`, `MREF+...`, `KREF+...`) — nimm den ersten Treffer; fällt auf `null` wenn keiner da
5. Rückgabe: `ParsedRow[]`

### Detection-Algorithmen

**`DuplicateDetector.detect(ctx, parsedRows)`** — pro Row:
1. Wenn `externalRef` gesetzt: `prisma.transaction.findFirst({ where: { householdId, externalRef } })` → bei Treffer: `DUPLICATE`
2. Sonst: `externalHash = sha256(${date}|${amountCents}|${counterpartyNorm}|${purposeNorm})` berechnen, `findFirst({ where: { householdId, externalHash } })` → bei Treffer: `DUPLICATE`

Performance: alle externalRefs/Hashes der CSV in zwei `IN`-Queries laden, in Sets halten, nicht pro Zeile einzeln querien.

**`FixedCostMatcher.match(ctx, parsedRows)`** — pro Row (nur wenn nicht DUPLICATE):
- Lade alle aktiven `RecurringTransaction` des Haushalts
- Für fixe Recurrings: Betrag-Toleranz `abs(row.amountCents - rec.amountCents) <= max(50, abs(rec.amountCents) * 0.02)`
- Für variable Recurrings: keine Betrags-Prüfung
- Counterparty-Match: `counterpartyKey(row.counterparty)` enthält oder ist enthalten in `counterpartyKey(rec.name)`, oder counterpartyKey aus `rec.note`
- Date-Window: `row.date` innerhalb ±5 Tagen von `safeDayOfMonth(year(row.date), month(row.date), rec.dayOfMonth)`
- Erster Match gewinnt → `FIXED_COST_MATCH` mit `matchedRecurringId`

**`RecurringSuggester.suggest(ctx, parsedRows)`** — pro NEW-Row:
- Query: `prisma.transaction.findMany({ where: { householdId, counterparty: { equals: row.counterparty, mode: 'insensitive' }, date: { gte: row.date - 6 Monate } } })`
- Performance: alle eindeutigen counterparties einmal querien, pro Counterparty Liste der Treffer
- Wenn `≥ 3` Treffer mit Betrag-Toleranz `±5%`: `RECURRING_SUGGESTION`
- Frequenz aus mittlerem Tagesabstand: `28-32` Tage → `MONTHLY`, `85-95` → `QUARTERLY`, `360-370` → `YEARLY`, sonst keine Suggestion (zu unregelmäßig)

**`CategorySuggester.suggest(ctx, row)`** — Reihenfolge:
1. **EXACT**: counterpartyKey matcht aktiven `RecurringTransaction.name` → dessen `categoryId`
2. **LEARNED**: `prisma.importLearning.findUnique({ where: { householdId_counterpartyKey } })` → `categoryId`
3. **NONE**

### Confirm-Flow

```ts
async confirm(ctx, file, payload) {
  const parsed = await this.parser.parse(file);     // erneut parsen
  const csvImport = await this.repo.createCsvImport(ctx, file.originalname, parsed.length);

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

    if (sel.createNewRecurring) {
      await this.repo.createRecurringFromRow(ctx, row, sel);
      newRecs++;
    }

    await this.repo.createTransaction(ctx, row, sel, csvImport.id);
    await this.repo.upsertLearning(ctx, row.counterpartyKey, sel.categoryId);
    imported++;
  }

  await this.repo.finalizeCsvImport(csvImport.id, { imported, skippedDup, skippedFixed, newRecs });
  return { imported, skippedDuplicates: skippedDup, skippedFixed, skippedByUser: skippedUser, createdRecurrings: newRecs, csvImportId: csvImport.id };
}
```

`skipReason` schickt der Client mit, damit die Counter im `CsvImport`-Record stimmen. Cross-Tenant-Schutz: `categoryId`/`projectId` werden mit `householdId`-Constraint geprüft (über `BaseRepository.findOneOrThrow`).

---

## Frontend-Architektur

### Routing

- Neue Route `/import` (lazy-loaded)
- Sidebar-Eintrag im Settings-Bereich (Desktop) / Eintrag im "Mehr"-Sheet (Mobile)

### Komponenten

```
apps/web/src/app/pages/csv-import/
  csv-import.page.ts                  — Container, Wizard-State
  csv-import.page.html
  components/
    csv-upload-step.component.ts      — File-Picker, Format-Hilfe
    csv-preview-table.component.ts    — Zeilenliste + Filter-Chips + Bulk-Aktionen
    csv-preview-row.component.ts      — Einzelne Zeile (Card auf Mobile, Row auf Desktop)
    csv-import-summary.component.ts   — Erfolgs-Card mit Counters

apps/web/src/app/core/csv-import/
  csv-import.service.ts               — analyze() / confirm() via ApiClient
  csv-import.types.ts                 — TS-Types aus shared zod-Schemas
```

### Wizard-State

```ts
type WizardStep = 'upload' | 'preview' | 'done';

@Component({...})
export class CsvImportPage {
  step = signal<WizardStep>('upload');
  selectedFile = signal<File | null>(null);
  analyzeResult = signal<AnalyzeResponse | null>(null);
  rowSelections = signal<Map<number, RowSelection>>(new Map());
  isAnalyzing = signal(false);
  isConfirming = signal(false);

  filter = signal<'all' | 'new' | 'fixed' | 'duplicate' | 'suggestion'>('all');
  filteredRows = computed(() => {
    const rows = this.analyzeResult()?.rows ?? [];
    const f = this.filter();
    if (f === 'all') return rows;
    return rows.filter(r => /* map filter to status */);
  });

  importableCount = computed(() =>
    Array.from(this.rowSelections().values()).filter(s => !s.skip && s.categoryId).length
  );
  canSubmit = computed(() => this.importableCount() > 0 && !this.hasMissingCategories());
}
```

`RowSelection` hat per-Row `skip`, `skipReason`, `categoryId`, `projectId`, `visibility`, `createNewRecurring`.

### Preview-UI

- Filter-Chips oben mit Counts: `Alle (n) | Neu (n) | Fixkosten (n) | Duplikate (n) | Vorschläge (n)`
- Bulk-Aktionen: "Kategorie für alle ausgewählten setzen…" (öffnet Sheet mit Kategorie-Liste)
- Pro Zeile:
  - Status-Badge (`hlmBadge`): `success` (NEW), `warning` (RECURRING_SUGGESTION), `muted` (DUPLICATE/FIXED_COST_MATCH)
  - `<klar-avatar [seed]="row.counterparty">` + Counterparty als Title, Purpose als Subtitle (truncate)
  - Datum (`text-muted-foreground text-sm`), Betrag (`font-mono tabular-nums`, success/danger je nach Vorzeichen)
  - Kategorie-Select (`hlmSelect`) — vorbelegt mit `suggestedCategoryId`, kleiner Hint-Badge "Gelernt" (LEARNED) oder "Aus Fixkosten" (EXACT)
  - Toggle "Importieren" (`hlm-checkbox`); FIXED_COST_MATCH und DUPLICATE default off + ausgegraut + Tooltip
  - Bei RECURRING_SUGGESTION zusätzlich Toggle "Als Fixkosten speichern" mit Untertitel "≈ {frequency}, {pastOccurrences} ähnliche Buchungen"
- Mobile: Card-Layout (gleiches Pattern wie Fixkosten-Cards), Filter-Chips horizontal scrollbar mit `overflow-x-auto`, sticky top mit Safe-Area

### Submit & Done

- "X Buchungen importieren" Button, disabled wenn `!canSubmit()`
- Nach Erfolg: Summary-Card mit allen Countern, Buttons "Zurück zu Cashflow" / "Weitere CSV importieren"
- Stores reloaden: `TransactionStore.reload()`, `RecurringTransactionStore.reload()` (wegen evtl. neuer Recurrings)

### Empty/Error-States

- Ohne File: CTA-Card mit Format-Hinweis ("Sparkasse → Online-Banking → Umsätze → Export → CSV-CAMT v2")
- Parse-Fehler: `<klar-error-bar>` + Retry-Button
- Alle Zeilen DUPLICATE: Info-State "Diese Datei wurde bereits importiert"

---

## Shared Schemas (`packages/shared`)

```
packages/shared/src/schemas/
  csv-import-analyze.schema.ts       — AnalyzeResponse, RowAnalysis
  csv-import-confirm.schema.ts       — ConfirmPayload, ConfirmResponse
```

DTOs leiten sich via `CreateDto<T>`-Pattern ab (siehe CLAUDE.md).

---

## Tests

### Backend Unit (Vitest)
- `SparkasseCamtV2Parser`:
  - Win-1252-Encoding korrekt
  - Datums-Parsing (`DD.MM.YY` → ISO mit Jahrhundert-Logik 20YY für YY < 70)
  - Betrags-Parsing (`-1.234,56` → -123456 Cent), inkl. positive Beträge
  - leere optionale Spalten
  - Header-Validierung: fehlende Pflichtspalte → Fehler
  - mehrzeiliger `Verwendungszweck`
- `DuplicateDetector`:
  - externalRef-match
  - Hash-Fallback bei fehlendem Ref
  - gemischter Fall (manche Rows mit Ref, manche ohne)
- `FixedCostMatcher`:
  - Toleranz-Bänder fix vs. variabel
  - Date-Window mit `safeDayOfMonth` (Februar/Monatsende)
  - Substring-Match Counterparty/Note
  - kein Match wenn Recurring inactive
- `RecurringSuggester`:
  - ≥3 Treffer in 6 Monaten → Suggestion
  - 2 Treffer → keine Suggestion
  - Frequenz-Schätzung MONTHLY/QUARTERLY/YEARLY
  - unregelmäßige Abstände → keine Suggestion
- `CategorySuggester`:
  - EXACT vor LEARNED vor NONE
  - normalisierter counterpartyKey

### Backend Integration (Vitest + echte DB, Transaction-Rollback pro Test)
- Analyze: realistische Sparkasse-CSV-Fixture, Status-Verteilung korrekt
- Confirm:
  - Insert mit `sourceImportId`, `externalRef`, `externalHash`, `counterparty` gesetzt
  - `ImportLearning` upsert: hitCount erhöht sich beim zweiten Mal
  - `createNewRecurring=true` legt `RecurringTransaction` an
  - `CsvImport`-Counter stimmen
- Cross-Tenant: Confirm mit categoryId aus fremdem Haushalt → 422
- Re-Import derselben Datei → alle Zeilen DUPLICATE

### Backend Security (Supertest)
- analyze/confirm ohne Auth → 401
- analyze/confirm mit fremdem `:hid` → 403
- File > 5 MB → 413
- Falsches Mime → 415

### Frontend Unit (Vitest)
- `CsvImportService` mit mock-HttpClient: analyze/confirm Request-Mapping
- Filter-Logic: Filter-Chips zeigen richtige Counts, Filter-Switch korrekt
- Submit-Validation: Button disabled wenn Kategorie für ausgewählte Zeile fehlt
- Wizard-Transitions: upload → preview → done, Reset bei "Weitere CSV"

### E2E (Playwright)
- Happy Path: CSV hochladen → Preview → Kategorien zuordnen → Importieren → Cashflow zeigt neue Buchungen
- Re-Import: dieselbe Datei zweimal → zweites Mal alle DUPLICATE
- Fixkosten-Match: Recurring "Spotify" existiert → CSV-Spotify-Buchung → Status FIXED_COST_MATCH, default off, wird nicht importiert
- Recurring-Vorschlag akzeptieren: 3x Netflix in CSV, kein Recurring → Toggle aktiv → nach Confirm existiert RecurringTransaction "Netflix" + Transaction
- Mobile-Layout: Card-Liste statt Tabelle, Filter-Chips scrollbar, Safe-Area respektiert

**Coverage-Threshold:** Backend 80% Lines, Frontend 70% Lines (Standard).

---

## Hard Rules (zusätzlich zu CLAUDE.md)

- ❌ `householdId` aus Body — IMMER aus `:hid`
- ❌ FIXED_COST_MATCH-Zeilen als Transaction importieren (würde Cashflow doppelt zählen)
- ❌ `as any` auf den neuen Prisma-Feldern (`externalRef` etc.) — nach Migration sofort `prisma:generate`
- ❌ Klartext-CSV-Inhalt loggen (kann sensible Empfänger/Verwendungszwecke enthalten)
- ❌ Recurring/Transaction Stores nach Confirm nicht reloaden — UI würde stale State zeigen

---

## Offene Fragen

Keine — Phase 1 ist scharf umrissen. Erweiterungen (andere Banken, Drag&Drop, Regel-Engine) bekommen eigene Specs wenn sie kommen.

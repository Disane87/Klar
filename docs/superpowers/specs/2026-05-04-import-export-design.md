# Import / Export — Design Spec

**Datum:** 2026-05-04  
**Status:** Approved  
**Scope:** Transaktionen und Fixkosten (RecurringTransactions) zwischen Umgebungen übertragen (Dev → Prod), Format: JSON

---

## Ziel

Buchungen (manuelle Transaktionen und/oder Fixkosten) aus einem Haushalt exportieren und in einen anderen Haushalt (gleiche oder andere Umgebung) importieren. Primärer Use-Case: Dev → Prod-Transfer. Sekundär: allgemeines Backup / Restore.

---

## JSON-Format (Version 1)

```json
{
  "version": "1",
  "exportedAt": "2026-05-04T10:00:00Z",
  "includes": ["transactions", "recurringTransactions"],
  "filters": {
    "startDate": "2025-01-01",
    "endDate": null
  },
  "transactions": [
    {
      "amountCents": -1500,
      "date": "2025-04-15",
      "description": "Rewe",
      "visibility": "SHARED",
      "category": { "name": "Lebensmittel", "type": "EXPENSE" },
      "project": { "name": "Urlaub 2025" }
    }
  ],
  "recurringTransactions": [
    {
      "name": "Spotify",
      "amountCents": -999,
      "frequency": "MONTHLY",
      "customDays": null,
      "dayOfMonth": 1,
      "startDate": "2024-01-01",
      "endDate": null,
      "visibility": "SHARED",
      "isVariable": false,
      "isActive": true,
      "note": null,
      "color": "#1DB954",
      "icon": "simple-icons:spotify",
      "category": { "name": "Abos", "type": "EXPENSE" },
      "project": null
    }
  ]
}
```

### Bewusst nicht exportiert
- `id`, `householdId`, `createdByUserId` — gehören zur Quellumgebung
- `recurringTransactionId` auf Transactions — Link existiert im Ziel nicht
- `createdAt`, `updatedAt` — werden im Ziel neu gesetzt

### Kategorie/Projekt-Auflösung
- Kategorien werden per `name + type` gematchd (case-insensitive)
- Projekte werden per `name` gematchd (case-insensitive)
- IDs werden nie exportiert — nur semantische Identifier

---

## API Design

Alle Endpoints unter `GET/POST /api/v1/households/:hid/...`  
Guard: `HouseholdMemberGuard` (jedes Mitglied darf importieren/exportieren)

### Export

```
GET /api/v1/households/:hid/export

Query-Parameter:
  include       string   Komma-separiert: "transactions", "recurringTransactions"
                         Default: "transactions,recurringTransactions"
  startDate     string   ISO YYYY-MM-DD, optional
  endDate       string   ISO YYYY-MM-DD, optional

Response:
  Content-Type: application/json
  Content-Disposition: attachment; filename="klar-export-{YYYY-MM-DD}.json"
  Body: KlarExportFile (siehe JSON-Format oben)
```

### Import — Schritt 1: Analyse

```
POST /api/v1/households/:hid/import/analyze

Body: multipart/form-data
  file: <.json Datei>

Response 200:
{
  "summary": {
    "transactions": 47,
    "recurringTransactions": 12
  },
  "categoryMappings": [
    {
      "source": { "name": "Lebensmittel", "type": "EXPENSE" },
      "resolvedId": "cld123abc"
    },
    {
      "source": { "name": "Oldname", "type": "EXPENSE" },
      "resolvedId": null
    }
  ],
  "projectMappings": [
    {
      "source": { "name": "Urlaub 2025" },
      "resolvedId": null
    }
  ],
  "availableCategories": [
    { "id": "cld456", "name": "Lebensmittel", "type": "EXPENSE" }
  ],
  "availableProjects": [
    { "id": "cld789", "name": "Neue Reise" }
  ]
}
```

### Import — Schritt 2: Confirm

```
POST /api/v1/households/:hid/import/confirm

Body: application/json
{
  "file": "<base64-encoded JSON string>",
  "categoryMappings": [
    { "sourceName": "Oldname", "sourceType": "EXPENSE", "targetId": "cld456" }
  ],
  "projectMappings": [
    { "sourceName": "Urlaub 2025", "targetId": "cld789" }
  ]
}

Response 200:
{
  "imported": {
    "transactions": 47,
    "recurringTransactions": 12
  },
  "skipped": 0
}
```

---

## Backend-Architektur

### Neues Modul: `data-transfer`

```
apps/api/src/data-transfer/
  data-transfer.module.ts
  data-transfer.controller.ts
  data-transfer.service.ts
  data-transfer.repository.ts       — Prisma queries (Categories, Projects, Transactions, RecurringTransactions)
  dto/
    export-query.dto.ts              — Query-Params für Export
    import-analyze.dto.ts            — Response-Shape für analyze
    import-confirm.dto.ts            — Request-Body für confirm
  schemas/
    klar-export-file.schema.ts       — zod-Schema in packages/shared (importiert hier)
```

### Zod-Schema (packages/shared)

```
packages/shared/src/schemas/
  klar-export-file.schema.ts         — KlarExportFile, KlarExportTransaction, KlarExportRecurring
```

Schema validiert: version, includes, arrays, amountCents als integer, dates als ISO-String.

### Service-Logik

**Export:**
1. Transactions laden mit `where: { householdId, date: { gte, lte } }` + category/project includes
2. RecurringTransactions laden analog
3. Zu Export-Format mappen (IDs weglassen, category/project als Name-Objekte)
4. Als JSON-Response mit Content-Disposition zurückgeben

**Analyze:**
1. Datei parsen + zod validieren (→ 400 bei Fehler)
2. Alle unique category `{name, type}` aus der Datei sammeln
3. Gegen DB matchen: `findMany where { householdId, name: { in: [...] }, type: { in: [...] } }`
4. Gematchte → resolvedId setzen, ungematchte → resolvedId: null
5. Analog für Projekte
6. Alle verfügbaren Categories/Projects des Zielhaushalts zurückgeben

**Confirm:**
1. Datei erneut parsen + validieren
2. Mapping vollständigkeit prüfen: alle `resolvedId: null` müssen im Mapping-Payload stehen (→ 400 sonst)
3. Pro Transaction/RecurringTransaction: category/project ID aus Mapping auflösen
4. In DB schreiben: `createMany` für Transactions, einzelne `create` für RecurringTransactions (kein createMany wegen Relations)
5. Skipped-Counter für ungültige Einträge

---

## Frontend-Architektur

### Neue Komponenten in Settings-Feature

```
apps/web/src/app/features/settings/
  components/
    data-export/
      klar-data-export.component.ts    — Export-Formular
    data-import/
      klar-data-import.component.ts    — Dropzone + analyze-Trigger
  dialogs/
    import-mapping/
      klar-import-mapping-dialog.component.ts   — Mapping + Confirm
```

### Export-Formular
- Section Header "Import / Export"
- Zwei `hlm-checkbox` (über klar-wrapper): "Transaktionen" / "Fixkosten" (beide default: true)
- Zwei optionale `[hlmInput]` Date-Felder: Start / Ende
- Button `[hlmBtn]` "Exportieren" mit `[klarLoadingBtn]` → GET-Request → Browser-Download via `Blob` + `URL.createObjectURL`

### Import-Flow
1. Dropzone (`.json` only) — File-Select via `<input type="file">` oder Drag-and-Drop
2. Bei File-Auswahl: `analyze`-Call automatisch
3. **Alle gematcht:** Vorschau-Modal mit Summary → "Importieren" → `confirm`-Call
4. **Ungematchte vorhanden:** Mapping-Schritt im Modal:
   - Pro ungematchtem Eintrag: Label + `hlmSelect` mit Ziel-Kategorien/-Projekten
   - "Importieren" disabled bis alle aufgelöst
5. Nach Import: Toast + Modal schließt

### State (Signals)
```ts
// in klar-data-import.component.ts
analyzeResult = signal<AnalyzeResponse | null>(null);
selectedFile = signal<File | null>(null);
isAnalyzing = signal(false);
```

---

## Fehlerbehandlung

### Backend (RFC 7807)
| Fehler | Status | Detail |
|---|---|---|
| Kein JSON / kein Klar-Format | 400 | "Ungültige Export-Datei" |
| Inkompatible Version | 400 | "Version {x} wird nicht unterstützt" |
| Unvollständiges Mapping in confirm | 400 | "Mapping für {n} Kategorien fehlt" |
| Target-ID nicht im Haushalt | 422 | "Kategorie {id} nicht gefunden" |

### Frontend
- Falsches Dateiformat → `<klar-error-bar>` unter Dropzone
- `analyze`-Fehler → Toast via `ErrorInterceptor`
- `confirm`-Fehler → Toast + Modal bleibt offen
- `skipped > 0` → Toast "X Einträge übersprungen"

---

## Tests

### Unit (Vitest)
- `DataTransferService.buildExportPayload()` — korrekte Felder, keine IDs
- `DataTransferService.resolveCategories()` — match + no-match Fälle
- `DataTransferService.applyMappings()` — vollständiges + unvollständiges Mapping
- zod-Schema-Validierung: gültige + ungültige Export-Files

### Integration (Vitest + echte DB)
- Export: gibt nur Einträge des eigenen Haushalts zurück (Cross-Tenant-Check)
- Analyze: korrekte Auflösung + korrekte "not found" Liste
- Confirm: Einträge landen in DB, householdId = Ziel-Haushalt

### Security (Supertest)
- Cross-Tenant: `confirm` mit categoryId eines anderen Haushalts → 422
- Unauthenticated → 401

### E2E (Playwright)
- Export-Flow: Checkboxes setzen, Date-Filter, Download-Button → Datei landet im Browser
- Import-Flow ohne Mapping-Step: Upload → Summary → Importieren → Toast
- Import-Flow mit Mapping-Step: Upload → Mapping-UI → alle auflösen → Importieren → Toast

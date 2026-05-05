# Plan: Neue Features für Klar — Mehrwert & Alltagserleichterung

## Kontext

Klar ist bereits feature-complete gemäß SPEC (Phasen 1–11+ implementiert): Auth, Households, Kategorien, Fixkosten-Übersicht, Buchungen, Budgets, Projekte, Planspiel, API-Keys, JSON-Import/Export, PDF-Reports. Die App ist solide gebaut; die folgenden Features bauen auf der bestehenden Infrastruktur auf und füllen echte Alltagslücken.

---

## Feature 1: Kommende Zahlungen (Upcoming Payments)

**Problem:** Man sieht nie auf einen Blick, welche Fixkosten in den nächsten 30/60/90 Tagen fällig werden.

**Lösung:** Neue Seite `/:hid/upcoming` — Timeline der nächsten N Tage auf Basis der `RecurringTransaction`-Daten.

### Backend
- Neuer Endpoint: `GET /api/v1/households/:hid/overview/upcoming?days=30`
- Berechnung in `overview.service.ts` mit der bestehenden `toMonthlyEquivalent`-Logik aus `packages/shared`
- Gibt Array von `{ date: string, title: string, amountCents: number, categoryId: string, isVariable: boolean }[]` zurück
- Kein neues DB-Schema nötig

### Frontend
- Neue Seite `apps/web/src/app/pages/upcoming/`
- Groupby-Ansicht nach Woche (diese Woche / nächste Woche / später)
- Signal-Store mit `days`-Filter (30/60/90 als Segmented Control)
- Navigation: Side-Nav + Mobile Bottom-Nav ergänzen

---

## Feature 2: Jahresübersicht (Annual Overview)

**Problem:** Man kann nur monatsweise schauen — keine Vogelperspektive über das Jahr.

**Lösung:** Neue Seite `/:hid/year/:yyyy` mit 12-Monats-Tabelle und Jahreszusammenfassung.

### Backend
- Neuer Endpoint: `GET /api/v1/households/:hid/overview/year?year=2026`
- Ruft intern 12x die bestehende `overview.service.getMonthOverview(ctx, month)` auf (parallel via `Promise.all`)
- Response: `{ month: string, incomeCents: number, expenseCents: number, surplusCents: number }[]`
- In `overview.module.ts` erweiterbar, kein neues Modul nötig

### Frontend
- Neue Seite `apps/web/src/app/pages/jahresuebersicht/`
- Jahres-Selector (aktuelles Jahr ± N)
- Tabelle: 12 Zeilen (Jan–Dez), 3 Spalten (Einnahmen / Ausgaben / Überschuss) + Jahreszusammenfassung
- Sparkline oder Balkendiagramm mit Tailwind/SVG (kein Chart-Library-Import)
- Monat klickbar → Navigation zu `/:hid/month/:yyyymm`

---

## Feature 3: Buchungs-Vorlagen (Transaction Templates)

**Problem:** Häufig wiederkehrende manuelle Buchungen (Tanken, Wocheneinkauf, etc.) müssen jedes Mal neu erfasst werden — Felder wie Betrag, Kategorie, Beschreibung immer wieder.

**Lösung:** Gespeicherte Vorlagen für den Transaction-Dialog.

### Backend
- Neue Prisma-Migration: Tabelle `TransactionTemplate` (id, householdId, createdByUserId, title, amountCents, categoryId, projectId?, description?, visibility)
- Neues Modul `apps/api/src/transaction-templates/` analog zu `transactions/` (Controller + Service + Repository)
- CRUD-Endpoints: `GET/POST/PATCH/DELETE /api/v1/households/:hid/transaction-templates/:id?`

### Frontend
- Neuer Store `apps/web/src/app/core/transaction-templates/`
- Im Transaction-Dialog (`transaction-dialog.component.ts`): neuer Button "Aus Vorlage" → Popover/Sheet mit Template-Liste → bei Auswahl Formular vorausfüllen
- Settings-Seite zum Verwalten von Templates (in bestehende Settings einbauen oder eigene Seite)

---

## Feature 4: Budget-Rollover

**Problem:** Unverbrauchtes Budget verfällt stillschweigend. Wer im März 50€ unter Budget geblieben ist, hat im April kein "Polster".

**Lösung:** Optionaler Rollover pro Budget-Eintrag.

### Backend
- Prisma-Migration: `Budget`-Tabelle bekommt Feld `rollover: Boolean @default(false)`
- `budgets.service.ts`: bei `getOrCreateForMonth()` → wenn `rollover=true`, vorherigen Monat laden, Differenz (Soll – Ist) aufaddieren
- Existing `calculateMonthlyOverview` in `packages/shared` um Rollover-Parameter erweitern

### Frontend
- Im Budget-Edit-Dialog: Toggle "Nicht verbrauchtes Budget auf nächsten Monat übertragen"
- In der Monatsansicht: bei Rollover-Budget die kumulierte Anzeige visualisieren (z.B. "200€ + 47€ Übertrag = 247€")

---

## Feature 5: CSV-Import (Bankkontoauszüge)

**Problem:** Manuelle Erfassung vergangener Transaktionen ist aufwändig. Banken exportieren CSV, das könnte als Bulk-Import dienen.

**Lösung:** Erweiterung des bestehenden `data-transfer`-Moduls um CSV-Upload mit Column-Mapping.

### Backend
- In `apps/api/src/data-transfer/`: neue Methode `importFromBankCsv(ctx, csvContent, mapping)`
- CSV-Parsing via `papaparse` (leichtgewichtig, kein großes Dependency-Overhead)
- Mapping-Config: Spalte → Feld (Datum, Betrag, Beschreibung, ggf. Gegenkonto)
- Duplikat-Erkennung: Hash aus Datum + Betrag + Beschreibung → Skip wenn bereits existiert
- Response: `{ imported: number, skipped: number, errors: string[] }`

### Frontend
- In bestehender Import/Export-Seite (Tresor): neuer Tab "CSV-Import"
- Step 1: CSV-Upload + Vorschau (erste 5 Zeilen)
- Step 2: Column-Mapping (Dropdowns: "Diese Spalte ist das Datum / der Betrag / …")
- Step 3: Kategorie-Zuweisung (Standardkategorie + optionale Keyword-Rules: "Rewe → Lebensmittel")
- Step 4: Bestätigungs-Preview + Import

---

## Feature 6: Monats-Notizen

**Problem:** Warum war März teuer? Warum hat das Budget nicht gereicht? Diese Kontextinformation geht verloren.

**Lösung:** Einfaches Freitext-Notizenfeld pro Budget-Monat.

### Backend
- Prisma-Migration: neue Tabelle `MonthNote` (id, householdId, month `@db.Date`, content String, updatedAt)
- Endpoints: `GET/PUT /api/v1/households/:hid/month-notes?month=YYYY-MM` (Upsert-Logik)
- Einfaches neues Modul `apps/api/src/month-notes/`

### Frontend
- In der Monatsansicht (`monat.component.ts`): Notiz-Card am Ende der Seite
- Inline-Edit mit Autosave (debounced, 1s nach Tipp-Ende)
- Anzeige in der Jahresübersicht als Tooltip/Icon auf Monaten mit Notiz

---

## Implementierungs-Reihenfolge (nach Aufwand/Nutzen)

| Prio | Feature | Aufwand | Nutzen |
|------|---------|---------|--------|
| 1 | Jahresübersicht | S (kein neues DB-Schema) | Hoch |
| 2 | Kommende Zahlungen | S (kein neues DB-Schema) | Hoch |
| 3 | Monats-Notizen | S (triviale Migration) | Mittel |
| 4 | Buchungs-Vorlagen | M (neues Modul) | Hoch |
| 5 | Budget-Rollover | M (Migration + Logik) | Mittel |
| 6 | CSV-Import | L (Mapping-UI komplex) | Mittel |

---

## Kritische Dateien je Feature

| Feature | Backend | Frontend |
|---------|---------|---------|
| Jahresübersicht | `overview.service.ts`, `overview.controller.ts` | neue Seite `jahresuebersicht/` |
| Upcoming | `overview.service.ts`, `overview.controller.ts` | neue Seite `upcoming/` |
| Notizen | neue Migration + `month-notes/` Modul | `monat.component.ts` erweitern |
| Vorlagen | neue Migration + `transaction-templates/` Modul | `transaction-dialog.component.ts` |
| Rollover | Migration `Budget` + `budgets.service.ts` + `packages/shared` | `monat.component.ts` Budget-Dialog |
| CSV-Import | `data-transfer.service.ts` erweitern | Tresor-Seite oder eigene Import-Seite |

---

## Wiederverwendbare Patterns (nicht neu bauen)

- `BaseRepository<T>` — alle neuen Repositories erben davon
- `ResourceStore<T>` Muster aus `packages/shared-frontend` — alle neuen Frontend-Stores
- `RequestContext` — alle Service-Methoden-Signaturen
- `CreateDto<T>` / `UpdateDto<T>` aus `packages/shared` — keine manuellen DTOs

---

## Verifikation je Feature

- **Jahresübersicht:** Playwright-Smoke, Jahressumme vs. Summe der 12 Monats-Endpoints
- **Upcoming:** Unit-Test in `overview.service.spec.ts`, korrekte Datumsberechnung über Monatsgrenzen
- **Notizen:** E2E-Test Upsert (leere Note → Text → Update)
- **Vorlagen:** E2E-Test CRUD + Vorlage → Transaction-Dialog vorausgefüllt
- **Rollover:** Unit-Test: Budget 200€, Ist 150€ → nächster Monat 250€ effektiv
- **CSV-Import:** Unit-Test Duplikat-Erkennung + fehlerhafte Zeilen werden geskippt

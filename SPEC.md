# Klar — Spec

> **Status:** Draft v0.4 — FINAL für v1
> **Owner:** Marco
> **Letztes Update:** 2026-04-30
> **Changelog v0.4:** Gehalts-Modell finalisiert, Planspiel-Konzept, alle offenen Fragen geschlossen.

---

## 1. Ziel

Ein selbst-gehostetes, privacy-first Klar für Einzelpersonen und Paare/WGs. Kein Cloud-Vendor, alle Daten bleiben auf eigener Infrastruktur. Drei Kern-Werkzeuge:

1. **Fixkosten-Übersicht mit Überschuss-Berechnung** (Hauptbild der Vorlage)
2. **Monats-Cashflow mit Budgets**
3. **Projekt-Tracking** für vorhabenbezogene Kosten (Renovierung, Hochzeit, Reise)

Plus: **öffentliche REST-API** für eigene Tools (Home Assistant, n8n, Skripte).

---

## 2. Entscheidungslog (alle offenen Fragen geschlossen)

| Thema | Entscheidung |
|---|---|
| UI-Library | Zard UI (shadcn/ui für Angular, Signals-nativ, Tailwind 4) — Version pinnen wegen Beta-Status |
| State Management | @ngneat/elf — Stores pro Feature |
| Date-Library | Temporal API nativ (kein Package, 2026 in modernen Browsern verfügbar) |
| Dark Mode | Ja, von Anfang an verdrahtet |
| i18n | DE hardcoded, v1.1 kommt DE/EN |
| CI/CD | GitHub Actions |
| TDD | Red → Green → Refactor als Pflicht pro Phase |
| OpenAPI | Self-hosted via `@nestjs/swagger` + zod-openapi, JSON unter `/api-docs.json`, UI unter `/api/docs` |
| Admin-Bootstrap | Erster registrierter User wird automatisch Admin |
| Account-Delete | Buchungen/Daten bleiben, `createdByUserId` → null (anonym) |
| Self-Register | Ja, per Env `REGISTRATION_ENABLED=true\|false` togglebar |
| Gehalt-Ø | Einfacher Durchschnitt, kein Ausreißer-Handling |
| Sichtbarkeit in Aggregaten | Jeder sieht nur was er sehen darf: eigene PRIVATE + alle SHARED des Haushalts |
| Recurring materialisieren | Nein — on-the-fly berechnen |
| Tag-im-Monat ungültig | Clampen auf letzten Monatstag (Feb 28/29, Apr 30, etc.) |
| Planspiel | Rein visuell im Frontend, kein Speichern, kein API-Call |
| Gehalts-Modell | Festgehalt = RecurringTransaction (FIXED_INCOME), Variable Eingänge = manuelle INCOME-Transaktionen |
| Betrags-Vorzeichen | Signed Integer: positiv = Einnahme, negativ = Ausgabe. Immer Cent-Integer. |
| Fehlerformat | RFC 7807 Problem Details |
| Audit-Log | DB-Tabelle `AuditLog` |
| API-Key-Prefix | `bgb_live_` |
| DB Pooling | Prisma default (PgBouncer erst bei Bedarf) |
| Secret Management | `.env` + Docker `env_file` |

---

## 3. Use Cases (Primary)

1. Einzelnutzer trägt Festgehalt + variable Eingänge (Provision ad-hoc) ein, sieht Überschuss.
2. Paar/WG teilt Haushalt: geteilte Posten für beide sichtbar, persönliche Posten privat.
3. Monats-Drill-down: variable Ausgaben gegen Budget pro Kategorie.
4. Renovierungs-Projekt: Budget anlegen, Buchungen zuordnen, Soll/Ist/Verbleibend verfolgen.
5. Planspiel: "Was bleibt mir wenn Provision diesen Monat X€ ist?" — live berechnet, kein Speichern.
6. Externe Automation: API-Key für n8n/Home Assistant.
7. PocketID-Login für Homelab-User, daneben normales E-Mail/Passwort.

## 4. Non-Goals (v1)

- Bank-Sync (FinTS/PSD2), OCR, Multi-Währung, Investment-Tracking, Steuer-Export, i18n, Native Apps

---

## 5. Gehalts-Modell (Detail)

### 5.1 Festgehalt

- Angelegt als `RecurringTransaction` mit Kategorie-Typ `FIXED_INCOME`, `isVariable=false`
- Frequenz: `MONTHLY`, konstanter Betrag
- Taucht in der Fixkosten-Übersicht als "Festgehalt Netto" auf
- Änderung des Festgehalts = neuen Recurring anlegen mit `startDate` ab Änderungsmonat, alten auf `endDate` setzen (Historisierung)

### 5.2 Variable Eingänge

- Provision, Boni, Steuerrückerstattung etc. = manuelle `Transaction` mit Kategorie-Typ `INCOME`
- Kein fixer Rhythmus — werden eingetragen wenn sie kommen
- Können optional einem Projekt zugeordnet werden (z. B. "Projekt: Badezimmer-Rücklage")
- Fixkosten-Übersicht zeigt:
  - "Ø Variable Eingänge" = Durchschnitt der INCOME-Transaktionen über die letzten 12 Monate (oder alle verfügbaren, wenn < 12)
  - Aufschlüsselung auf Monatsebene im Drill-down

### 5.3 Planspiel (Frontend-only)

- Auf der Übersichtsseite gibt es einen "Planspiel"-Bereich (ausklappbar oder Modal)
- User kann hypothetische Werte eingeben: "Wenn Provision X€ und Sonderzahlung Y€"
- Überschuss wird live neu berechnet (Signal-basiert, rein lokal)
- Kein API-Call, kein Speichern, keine DB-Operationen
- Die Berechungsformel ist identisch zur Backend-Logik (im Shared-Package als reine Funktion exportiert, sodass Frontend und Backend denselben Code nutzen)

---

## 6. Feature-Details

### 6.1 Fixkosten-Übersicht (Referenzbild)

Struktur der Anzeige:

```
EINNAHMEN
  Festgehalt Netto                      3.458,70 €
    davon Festgehalt Brutto             4.900,00 €   (optional, wenn eingetragen)
    davon Ø Provision Brutto            1.081,11 €   (Ø letzte 12 Monate)
  Fixe Eingänge (andere FIXED_INCOME)    110,11 €
  Gesamt Einnahmen                      3.568,81 €

AUSGABEN (gruppiert nach Kategorie)
  Wohnen & Darlehen                    -1.391,16 €
    [Einzelposten mit Betrag, Tag, Anmerkung]
    Zwischensumme Wohnen               -1.391,16 €
  Versicherungen                         -194,34 €
    [...]
  Abos & Subscriptions                   -218,21 €
    [...]
  Gesamt Ausgaben                      -1.803,71 €

──────────────────────────────────────────────────
MONATLICHER ÜBERSCHUSS                  1.765,10 €

[PLANSPIEL-BEREICH — ausklappbar]
  Hypothetische Provision:  [   0,00 €  ]
  Hypothetische Sonderzahlung: [ 0,00 € ]
  → Überschuss bei Planzahlen: 1.765,10 €
```

Farbcodierung identisch zum Referenzbild:
- Einnahmen: grüner Hintergrund
- Ausgaben: rötlicher/oranger Hintergrund, je nach Kategorie eigene Farbe
- Überschuss: blauer Hintergrund
- Planspiel: neutraler Hintergrund, kursiv/gedimmt um "hypothetisch" zu signalisieren

### 6.2 Monatsansicht

- Kalendermonat auswählen (aktuell + Vergangenheit)
- Pro Kategorie: Budget (Soll), Ist-Ausgaben, Differenz, Progress Bar
- Liste aller Buchungen, filterbar nach Kategorie / Projekt / User
- INCOME-Transaktionen des Monats separat aufgelistet
- Kennzeichnung: welche Buchungen sind aus Recurring (on-the-fly), welche manuell

### 6.3 Haushalt & User-Management

- Erster User = Admin (app-weit)
- User erstellt Haushalt → Owner
- Invite-Code: zeitlich begrenzt, konfigurierbares Use-Limit
- Beitritt via Code → Rolle MEMBER
- User in mehreren Haushalten, Kontext-Switch im Header-Dropdown
- Beim Account-Löschen: User → soft-deleted (`isDeleted=true`), `createdByUserId` in allen Tabellen → null, PRIVATE-Daten des Users werden gelöscht, SHARED-Daten bleiben anonym erhalten

### 6.4 OIDC-Provider (PocketID + weitere)

Siehe Spec v0.3 §4.4 — Modell unverändert. Provider per Env konfiguriert. Gruppen-Mapping (Required/Admin/Auto-Join) bei jedem Login synchronisiert.

### 6.5 Kategorien

- Defaults beim Haushalt-Setup: Wohnen & Darlehen, Versicherungen, Abos & Subscriptions, Lebensmittel, Mobilität, Freizeit, Sonstiges (alle EXPENSE); Festgehalt (FIXED_INCOME)
- User-eigene Kategorien mit Farbe + Icon, sortierbar
- Typ: `EXPENSE` | `INCOME` | `FIXED_INCOME`
- Archivierbar (nicht löschbar solange Buchungen existieren)

### 6.6 Projekte

- Zweite Achse neben Kategorie (Buchung hat Kategorie Pflicht + Projekt optional)
- Status: `PLANNING` | `ACTIVE` | `COMPLETED` | `ARCHIVED`
- Sichtbarkeit: `PRIVATE` oder `SHARED`
- Sichtbarkeitsregel: PRIVATE-Buchung → nur PRIVATE-Projekt desselben Users
- Übersicht pro Projekt: Soll-Budget, Ist-Ausgaben, Verbleibend, Timeline, Breakdown nach Kategorie

### 6.7 Recurring Transactions

- On-the-fly berechnet, niemals persistiert
- Frequenzen: `MONTHLY`, `QUARTERLY`, `YEARLY`, `CUSTOM_DAYS`
- `dayOfMonth`: 1–31, wird geclampt via `safeDayOfMonth(year, month, day)` → letzter Monatstag
- Deaktivierbar ohne Löschen
- `isVariable=true` → Betrag ist Schätzwert (wird in Übersicht mit "~" markiert)

### 6.8 Budgets

- Pro Kategorie ein Monatsbudget, vorwärts vererbt, pro Monat überschreibbar
- Berechnung Ist: EXPENSE-Buchungen + auf Monat umgelegte EXPENSE-Recurring

### 6.9 API-Keys & Public API

- Format: `bgb_live_<32-char-base62>`
- Klartext einmalig anzeigen, danach nur Prefix + Argon2-Hash
- Scopes: `transactions:read/write`, `recurring:read/write`, `categories:read`, `projects:read/write`, `overview:read`, `budgets:read`
- `householdId` aus Key, NICHT aus URL
- Public-API-Pfad: `/api/public/v1/*`

---

## 7. Architektur

### 7.1 Stack

| Schicht | Technologie |
|---|---|
| Frontend | Angular 20, Signals, Zard UI, @ngneat/elf, Tailwind 4 |
| Backend | NestJS 11, Fastify, Prisma, Postgres 16 |
| Auth | Passport-Local + Passport-OIDC + API-Key, Argon2id, eigenes JWT (RS256) |
| Date | Temporal API nativ (kein Package) |
| Docs | @nestjs/swagger + zod-openapi, self-hosted |
| CI/CD | GitHub Actions |
| Deploy | Docker Compose, Traefik |
| Tests | Vitest (Unit/Integration), Supertest (E2E), Playwright (Smoke) |

### 7.2 Monorepo-Struktur

```
/apps
  /api          — NestJS
  /web          — Angular
/packages
  /shared       — zod-Schemas, TS-Types, Berechnungs-Funktionen (inkl. Planspiel-Formel)
/docker
  docker-compose.dev.yml
  docker-compose.prod.yml
/prisma
  schema.prisma
  migrations/
  seed.ts
/.github
  workflows/
    ci.yml      — lint, test, build
    deploy.yml  — deploy auf Homelab (SSH + docker compose pull + up)
SPEC.md
CLAUDE.md
README.md
/docs
  pocketid-setup.md
  api-reference.md  — generiert aus OpenAPI-JSON
```

### 7.3 Shared Package — Berechnungs-Funktionen

Das `packages/shared`-Package exportiert:

```ts
// Planspiel + Overview — identische Logik in Frontend und Backend
export function calculateMonthlyOverview(input: OverviewInput): OverviewResult
export function safeDayOfMonth(year: number, month: number, day: number): number
export function toMonthlyEquivalent(amountCents: number, frequency: RecurringFrequency): number
export function averageIncome(entries: IncomeEntry[]): number
```

Frontend und Backend importieren diese Funktionen — keine Logik-Duplizierung.

### 7.4 Multi-Tenant-Strategie (Defense-in-Depth)

1. **App-Schicht:** `HouseholdMemberGuard` → `req.householdId`. Alle Repository-Calls filtern immer mit `householdId`.
2. **DB-Schicht:** Postgres RLS. Prisma-Middleware setzt `SET LOCAL app.household_id` vor jedem Query.
3. **DTO-Schicht:** Response-DTOs ohne Cross-Household-Felder.

### 7.5 Service-Layer (einheitlich für alle Auth-Wege)

```ts
type RequestContext = {
  userId: string;        // null bei anonymisierten Operationen nicht möglich
  householdId: string;
  source: 'web' | 'api-key';
  apiKeyId?: string;
};
```

Alle Service-Methoden bekommen `RequestContext` als ersten Parameter. Kein `req`-Zugriff im Service.

### 7.6 TDD-Workflow

- **Unit Tests (Vitest):** Service-Layer mit gemockten Repositories. Testbar wegen RequestContext-Pattern.
- **Integration Tests (Vitest + echter Test-DB):** Repository-Layer gegen echte Postgres-Instanz, Transaction-Rollback nach jedem Test. Eigene Test-DB (`DATABASE_TEST_URL`).
- **E2E Tests (Supertest):** Controller → Service → Repository → DB. Decken Auth-Flows, Cross-Tenant-Isolation und API-Key-Scopes ab.
- **Smoke Tests (Playwright):** Login, Quick-Add, Übersicht laden, Planspiel.
- **Coverage:** ≥80% Lines Backend, ≥70% Frontend.
- **GitHub Actions:** lint → unit → integration → e2e → build. Schlägt fehl bei Coverage-Unterschreitung.

### 7.7 OpenAPI

- Alle Public-API-Endpoints (`/api/public/v1/*`) vollständig dokumentiert
- Swagger-UI unter `/api/docs` (nur in nicht-prod oder per Env-Flag aktivierbar)
- OpenAPI-JSON unter `/api/docs-json` (immer verfügbar, für externe Tools)
- Schemas aus zod-Schemas im Shared-Package generiert (Single Source of Truth)
- Authentifizierung: `apiKey` Security Scheme dokumentiert

---

## 8. Datenmodell-Übersicht

→ Vollständiges Prisma-Schema: `prisma/schema.prisma`

Wichtige Design-Entscheidungen:
- `amountCents: Int` — signed, positiv = Einnahme, negativ = Ausgabe
- `createdByUserId: String?` — nullable für Account-Delete-Anonymisierung
- `date: DateTime @db.Date` — nur Datum, keine Uhrzeit (kein Timezone-Problem)
- `month: DateTime @db.Date` — Budget-Monat immer als YYYY-MM-01 normalisiert
- User `isDeleted: Boolean` — soft-delete, Account-Daten bleiben für Audit-Log

---

## 9. API-Übersicht

### Auth (`/auth`)

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/providers                      — konfigurierte OIDC-Provider
GET    /auth/oidc/:provider/start
GET    /auth/oidc/:provider/callback
POST   /auth/handover
GET    /auth/oidc/:provider/link
DELETE /auth/oidc/identities/:id
GET    /me
PATCH  /me
POST   /me/password
DELETE /me/password
```

### Internal API (`/api/v1`, JWT)

```
GET/POST         /api/v1/households
GET/PATCH        /api/v1/households/:hid
POST             /api/v1/households/:hid/invites
POST             /api/v1/households/join
DELETE           /api/v1/households/:hid/members/:uid

GET/POST/PATCH/DELETE  /api/v1/households/:hid/categories/:id?
GET/POST/PATCH/DELETE  /api/v1/households/:hid/projects/:id?
GET/POST/PATCH/DELETE  /api/v1/households/:hid/recurring/:id?
GET/POST/PATCH/DELETE  /api/v1/households/:hid/transactions/:id?
GET/PUT          /api/v1/households/:hid/budgets        ?month=YYYY-MM
GET/POST/DELETE  /api/v1/households/:hid/api-keys/:id?

GET  /api/v1/households/:hid/overview/fixed
GET  /api/v1/households/:hid/overview/month              ?month=YYYY-MM
GET  /api/v1/households/:hid/projects/:pid/overview

GET  /api/v1/admin/users                                 (ADMIN only)
PATCH /api/v1/admin/users/:id
GET  /api/v1/admin/audit-log
```

### Public API (`/api/public/v1`, API-Key)

```
GET/POST/PATCH/DELETE  /api/public/v1/transactions/:id?
GET/POST               /api/public/v1/recurring/:id?
GET                    /api/public/v1/categories
GET/POST               /api/public/v1/projects/:id?
GET                    /api/public/v1/overview/fixed
GET                    /api/public/v1/overview/month     ?month=YYYY-MM
GET                    /api/public/v1/budgets            ?month=YYYY-MM
```

---

## 10. Frontend-Routen

```
/auth/login
/auth/register
/auth/post-login
/onboarding
/:hid/overview                    — Fixkosten + Überschuss + Planspiel
/:hid/month/:yyyymm               — Monatsansicht
/:hid/projects
/:hid/projects/:pid
/:hid/recurring
/:hid/categories
/:hid/budgets
/:hid/settings/members
/:hid/settings/api-keys
/profile
/profile/security
/admin/users
```

---

## 11. Privacy & Security

- Argon2id für Passwörter + API-Keys (memCost ≥ 64MB)
- JWT RS256 (Key-Pair beim ersten Setup generiert)
- Refresh-Token: httpOnly + Secure + SameSite=Strict Cookie, rotiert bei jedem Refresh
- Access-Token: 15 min, nur im Memory des SPA
- OIDC: State + PKCE Pflicht, One-Time-Handover-Code ≤60s
- Rate-Limit: Login 10/min/IP, Register 3/min/IP, Public-API 60/min/Key
- HTTPS via Traefik + Let's Encrypt
- CSP strict, keine externen Ressourcen
- DB-Backup: tägliches `pg_dump`, ≥30 Tage Retention
- Pino-Redaction: `password`, `currentPassword`, `apiKey`, `secret`, `authorization`, `token`, `code`, `codeVerifier`, `state`, `clientSecret`, `hashedSecret`
- Account-Takeover-Schutz: OIDC-Linking nur bei `email_verified=true`
- Admin-Bootstrap: erster User automatisch Admin (idempotent: zweiter User wird NICHT Admin)

---

## 12. Akzeptanzkriterien (Definition of Done v1)

### Auth
- [ ] Local-Register, -Login, -Refresh, -Logout
- [ ] Erster User wird Admin, zweiter User nicht
- [ ] Registration togglebar per Env
- [ ] Login-Page zeigt OIDC-Buttons aus konfigurierten Providern
- [ ] PocketID-Login klappt end-to-end, JIT-Provisioning
- [ ] Auto-Linking bei `email_verified=true`, kein Linking bei unverified
- [ ] Required-Group greift, Non-Member wird abgelehnt
- [ ] Admin-Group-Mapping synchronisiert sich bei jedem Login
- [ ] User kann OIDC-Identity verknüpfen + trennen
- [ ] User kann lokales Passwort setzen auch wenn via OIDC registriert
- [ ] Refresh-Token nicht im JS-Zugriff (httpOnly)

### Haushalt & Daten
- [ ] Haushalt erstellen, Invite-Code generieren, beitreten
- [ ] Zwei User teilen Haushalt: SHARED sichtbar, PRIVATE des anderen nicht
- [ ] User in zwei Haushalten wechselt, sieht jeweils korrekte Daten
- [ ] Cross-Tenant-Zugriff per API abgewehrt durch RLS (E2E-Test)
- [ ] Account-Delete: User anonymisiert, SHARED-Daten bleiben, PRIVATE-Daten weg

### Übersicht & Gehalts-Tracking
- [ ] Festgehalt als FIXED_INCOME Recurring, Ø korrekt berechnet
- [ ] Variable INCOME-Transaktionen (Provision ad-hoc) fließen in Ø ein
- [ ] Fixkosten-Übersicht entspricht Referenzbild (Gruppen, Farben, Zwischensummen, Überschuss)
- [ ] Planspiel: hypothetische Eingabe verändert Überschuss-Anzeige live, kein Save
- [ ] PRIVATE-Posten fehlen im Aggregat des anderen Users
- [ ] Quartals-/Jahres-Recurring korrekt monatlich umgelegt

### Monatsansicht & Budget
- [ ] Monatsauswahl, Budget vs. Ist, Progress Bar
- [ ] Quick-Add in <5 Sekunden
- [ ] Filter nach Kategorie, Projekt, User

### Projekte
- [ ] Projekt anlegen, Buchungen zuordnen, Soll/Ist/Verbleibend
- [ ] PRIVATE-Projekt nur für Ersteller sichtbar
- [ ] PRIVATE-Buchung kann nur PRIVATE-Projekt desselben Users zugeordnet werden

### Public API
- [ ] API-Key erstellen, Klartext einmalig, danach nur Prefix
- [ ] Scope-Enforcement: read-only Key kann nicht schreiben (403)
- [ ] Revoked Key antwortet 401
- [ ] `householdId`-Manipulation im Body greift nicht

### Infrastruktur
- [ ] `docker compose up -d` startet die App vollständig
- [ ] GitHub Actions: lint + test + build grün bei jedem Push
- [ ] Coverage ≥80% Backend, ≥70% Frontend
- [ ] OpenAPI-Doku erreichbar, alle Public-Endpoints dokumentiert
- [ ] README: Setup in <15 Min, `docs/pocketid-setup.md` vorhanden

---

## 13. Roadmap nach v1

- v1.1: DE/EN i18n
- v1.2: PWA + Offline-Cache
- v1.3: CSV-Import (Sparkasse/DKB)
- v1.4: Beleg-Upload + OCR
- v1.5: Webhook-Outbound
- v1.6: Desktop-Wrapper (Tauri)
- v2.0: FinTS/PSD2 Auto-Sync

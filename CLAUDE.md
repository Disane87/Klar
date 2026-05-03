# CLAUDE.md

Repo-Kontext für Claude Code. Vollständige Referenz — IMMER zuerst lesen.
Vollständige Produktanforderungen: `SPEC.md`

---

## ⚡ PFLICHT-TOOLS — IMMER AKTIV

### Session-Start

```bash
git status && git branch --show-current
memory_search(query="klar app completed phases decisions")
memory_search(query="klar app patterns that worked")
memory_search(query="klar app current phase status")
```

Ergebnisse mit Score > 0.7 sind verbindlich — nicht neu entscheiden was bereits entschieden wurde.

### Skills — Wann welcher

| Skill | Wann verwenden |
|---|---|
| `writing-plans` | Vor jeder Phase — Tasks à 5–15 Min aufbrechen |
| `gstack` | Scaffolding + große Features (mehrere neue Module) — *nicht* für einzelne Fixes |
| `subagent-driven-development` | **Jede** Implementierungs-Task — nie direkt im Hauptcontext coden |
| `dispatching-parallel-agents` | Frontend + Backend immer parallel wenn möglich |
| `interface-design` | Vor jeder neuen UI-Komponente/Seite — Design zuerst, dann Code |
| `test-driven-development` | RED → GREEN → REFACTOR — kein Code vor Tests |
| `systematic-debugging` | Bei jedem Bug-Fix — Skill zuerst aufrufen, nie ad-hoc debuggen |
| `requesting-code-review` | Nach jedem Modul — vor Merge/Freigabe |

### Ruflo Swarm — Token-effiziente Koordination

- `swarm_init` + `swarm_status` — Swarm starten/überwachen (Konfiguration aus `AGENTS.md`)
- `memory_store` / `memory_search` — Kontext zwischen Agents teilen, nie doppelt laden
- `agent_spawn` — parallele Agents für unabhängige Tasks
- `hooks_route` — Task-Routing nach Typ (Frontend/Backend/Test/Review)

**Swarm-Größe:** Einfache Phasen: 4 · Standard: 6 · Komplex: 8

**Token-Sparregeln:**
- Hauptcontext nur für Koordination — kein Code direkt im Hauptcontext schreiben
- Subagents bekommen minimalen Kontext (nur was sie brauchen)
- Zwischenergebnisse via `memory_store` teilen, nicht in den Hauptcontext zurückgeben
- Parallele Agents für unabhängige Module — nie sequenziell wenn parallel möglich

### Workflow — immer in dieser Reihenfolge

1. **Session-Start** — `git status`, memory_search, aktuellen Stand erfassen
2. **Plan** (`writing-plans`) — Tasks aufbrechen, Swarm-Größe festlegen
3. **UI-Design** (`interface-design`) — vor UI-Arbeit: Design zuerst
4. **Swarm** (`swarm_init`) — Agents initialisieren
5. **Parallel-Implementierung** (`dispatching-parallel-agents` + `gstack`) — Frontend + Backend gleichzeitig
6. **Tests** (`test-driven-development`) — alle 8 Test-Ebenen grün
7. **Review** (`requesting-code-review`) — Code-Review vor Merge
8. **Commit** — nach jedem abgeschlossenen Modul (nicht nach jedem File)
9. **Memory** — Entscheidungen + Patterns speichern

### Nach jedem erfolgreichen Task

```
memory_store(key="klar-[phase]-[modul]", value="[was gebaut, Entscheidungen, Gotchas]", namespace="klar-app")
memory_store(key="pattern-[beschreibung]", value="[konkreter Ansatz]", namespace="patterns")
```

---

## Git/Commit-Strategie

- **Branch-Naming:** `feat/[modul]`, `fix/[beschreibung]`, `phase/[n]-[beschreibung]`
- **Commit-Zeitpunkt:** nach jedem abgeschlossenen Modul mit grünen Tests — nie mitten in halbfertigem Feature
- **Commit-Größe:** ein Modul = ein Commit; niemals WIP-Commits
- **PR vor Merge** in main — kein direkter Push auf main
- Niemals `--force-push` auf shared Branches
- Niemals `--no-verify` — Hook-Problem beheben statt umgehen

---

## Security

- **Vor jeder Session:** Dependabot-Alerts prüfen → `github.com/Disane87/Klar/security/dependabot`
- **High/Critical:** sofort fixen — niemals mit offenen High/Critical CVEs shippen
- **Moderate:** innerhalb derselben Phase fixen
- **`pnpm audit`** vor jedem Commit auf main
- **Dependencies aktuell halten** — `pnpm update --interactive` regelmäßig ausführen
- **Ausnahme:** Spartan UI — pinned, nie auto-updaten (Beta, Breaking Changes möglich)

---

## Stack

| Schicht | Technologie |
|---|---|
| Runtime | Node.js 22 LTS, pnpm 10, Turborepo |
| Frontend | Angular 21 (Zoneless, Signal Forms, Vitest) |
| UI | Spartan UI (spartan.ng) — pinned, **nie auto-updaten** |
| Styling | Tailwind CSS 4 |
| State | Angular Signals + `resource()` — kein NgRx, kein Elf |
| Backend | NestJS 11 + Fastify |
| ORM | Prisma + PostgreSQL 16 |
| Auth | Passport-Local + Passport-OIDC + API-Key, Argon2id, JWT RS256 |
| Date | Temporal API — kein date-fns, kein Luxon |
| Validation | zod (shared) + class-validator (NestJS DTOs) |
| Tests | Vitest + Supertest + Playwright |
| Deploy | GitHub Actions, Docker Compose + Traefik |

---

## Repo-Struktur

```
/apps/api               — NestJS Backend
/apps/web               — Angular Frontend
/packages/shared        — zod-Schemas, TS-Types, Berechnungs-Funktionen
/packages/shared-frontend — ResourceStore<T>, ApiClient, Interceptors
/prisma                 — schema.prisma, migrations/, seed.ts
/docker                 — docker-compose.dev.yml / prod.yml
SPEC.md, CLAUDE.md, AGENTS.md
```

---

## Commands

```bash
pnpm install
pnpm --filter api keys:generate          # JWT RS256 Key-Pair (einmalig)
docker compose -f docker/docker-compose.dev.yml up -d
pnpm --filter api prisma:migrate && pnpm --filter api prisma:seed
pnpm dev                                 # alle Apps parallel
pnpm test                                # Unit-Tests
pnpm --filter api test:integration       # gegen Test-DB (DATABASE_TEST_URL)
pnpm --filter api test:e2e               # Supertest
pnpm --filter web e2e                    # Playwright
pnpm audit                               # Security-Check vor Commit
pnpm build
```

---

## TypeScript-Konventionen

- `strict: true`, kein `any`, kein `as` ohne Begründungskommentar
- Geldbeträge: `amountCents: number` (Integer, signed: positiv=Einnahme, negativ=Ausgabe)
- Datum intern: `Temporal.PlainDate`, API-Transfer: ISO `YYYY-MM-DD`
- Budget-Monat: IMMER `YYYY-MM-01` normalisiert
- E-Mail: IMMER lowercase gespeichert und verglichen
- Kein `console.log` — pino (Backend) / Angular Logger (Frontend)

### Utility-Types (packages/shared) — Single Source of Truth

`CreateDto<T>`, `UpdateDto<T>`, `PaginatedResponse<T>` — nie manuell schreiben, immer ableiten

### Berechnungs-Funktionen (packages/shared) — nie duplizieren

`calculateMonthlyOverview`, `toMonthlyEquivalent`, `safeDayOfMonth`, `sumByCents`, `averageIncome`, `currentYearMonth`, `toHttpParams`

---

## Frontend-Patterns (Angular 21)

### Kernregeln

- **Zoneless**: kein `Zone.js`, `NgZone.run()`, `ChangeDetectorRef.markForCheck()`
- **Signal Forms** statt Reactive Forms (`FormGroup`, `FormBuilder` verboten)
- **ResourceStore\<T\>** (`packages/shared-frontend`) — Basis für alle Domain-Stores
- **ApiClient** (`packages/shared-frontend`) — alle HTTP-Calls über diesen Service

### HTTP-Interceptors (automatisch aktiv)

- `AuthInterceptor` — fügt Bearer-Token hinzu
- `RefreshInterceptor` — fängt 401, versucht Token-Refresh
- `ErrorInterceptor` — mappt HTTP-Fehler auf Toast-Notifications (RFC 7807)

### Design-System

- Zahlen: IMMER `font-mono` + `tabular-nums`
- Farben: `text-success`/`text-danger`/`text-muted-foreground` — kein hardcoded Hex
- Kategorie-Gruppen: linke Border 2px in Kategorie-Farbe, kein filled Background
- Section-Headers: `text-[10px] uppercase tracking-widest text-muted-foreground`
- Finance-Tabellen: kompakt `py-1.5 px-4`
- Dark Mode: `dark:` von Anfang an — nie nachrüsten

### Spartan UI → klar-\* — PFLICHT-Pipeline

**Reihenfolge für jedes UI-Control:**
1. spartan.ng prüfen — gibt es ein Brain-Package?
2. Wenn ja: in `apps/web/src/app/shared/ui/hlm/` als `hlm-*` Wrapper kapseln
3. Daraus eine `klar-*` Komponente in `apps/web/src/app/shared/ui/` erstellen
4. In Feature-Komponenten **nur** `klar-*` verwenden — niemals `hlm-*` direkt importieren

**Verfügbare klar-\* Komponenten (`shared/ui/`):**
`<klar-error-bar>`, `<klar-empty-state>`, `<klar-month-picker>`, `<klar-form-field>`, `<klar-section-header>`, `<klar-icon-button>`, `<klar-stat-card>`, `<klar-skeleton-rows>`, `<klar-skeleton-cards>`, `<klar-month-chip>`

**Verfügbare hlm-\* Direktiven (direkt nutzbar in klar-\* Templates, nicht in Features):**
`[hlmBtn]`, `[hlmInput]`, `[hlmLabel]`, `[hlmError]`, `[hlmSelect]`, `[hlmBadge]`, `<hlm-checkbox>`, `<hlm-spinner>`, `<hlm-calendar>`, `KlarDialogService`, `[klarLoadingBtn]`

**Klar Shared Pipes (`shared/pipes/`):**
`klarMoney` (Cent → de-DE EUR), `klarMoneyClass` (positiv/negativ/null → CSS-Klasse)

---

## Mobile-First & PWA

### Grundregel: Mobile-first (Base = Mobile, Breakpoints fügen Desktop hinzu)

### iOS/Safari — Hard Rules (nicht optional)

- `font-size ≥ 16px` auf allen Form-Elementen (sonst Safari-Zoom)
- `100dvh` statt `100vh`
- `position: fixed` immer mit `env(safe-area-inset-*)` Padding
- Touch-Targets: `min-h-[44px] min-w-[44px]`
- Immer `:active` neben `:hover` definieren

### Responsive Navigation

- Mobile `< 768px`: Bottom Navigation Bar (4 Icons)
- Tablet `768–1023px`: Sidebar 160px collapsible
- Desktop `≥ 1024px`: Sidebar 200px permanent

**Nav-Items (Mobile):** Fixkosten · Cashflow · Projekte · Mehr

---

## Backend-Patterns (NestJS 11)

### Modul-Struktur

`auth, oidc, users, households, categories, projects, recurring-transactions, transactions, budgets, overview, api-keys, admin`
Pro Modul: `Controller → Service → Repository` (Prisma **nur** im Repository)

### RequestContext — Pflicht als erstes Argument aller Service-Methoden

```ts
{ userId: string; householdId: string; source: 'web' | 'api-key'; apiKeyId?: string }
```

### Guards-Hierarchie

- `JwtAuthGuard` — global `/api/v1/*`
- `ApiKeyAuthGuard` — `/api/public/v1/*`
- `HouseholdMemberGuard` — prüft Membership, baut RequestContext
- `ApiKeyContextGuard` — baut RequestContext aus Key
- `AppAdminGuard` — `appRole = ADMIN`
- `@RequireScope('x:y')` — Scope-Check auf public Endpoints

### Fehlerformat: RFC 7807 Problem Details (GlobalExceptionFilter)

### Prisma

- Middleware: `SET LOCAL app.household_id` vor jedem Query (RLS)
- `migrate deploy` im Container-Entrypoint vor API-Start
- Niemals `findMany()` ohne `where: { householdId }`
- `@db.Date` für alle Datumsfelder ohne Uhrzeit

### Auth

- Erster registrierter User → `appRole = ADMIN`
- `REGISTRATION_ENABLED` Env togglebar (default: `true`)
- OIDC Group-Mapping bei **jedem** Login
- Refresh-Token: httpOnly + Secure + SameSite=Strict Cookie (Path=/auth)
- Access-Token: 15 min, nur im SPA-Memory

### API-Keys

- Prefix-Lookup (erste 8 Chars nach `bgb_live_`) → Argon2-Verify
- Klartext **einmalig** ausgeben, danach nie — niemals loggen
- `householdId` kommt aus dem Key, nie aus Body/URL
- Last-Used: async, throttled 1x/Minute

### Pino Redaction

`password, currentPassword, newPassword, passwordHash, apiKey, secret, hashedSecret, authorization, token, accessToken, refreshToken, tokenHash, code, codeVerifier, state, clientSecret`

---

## VS Code

Config-Dateien in `.vscode/` (checked in). Wichtigste Scripts:
- `pnpm --filter api dev:debug` — NestJS mit `--debug 0.0.0.0:9229`
- Prisma Studio: Task "db: studio" → `http://localhost:5555`

**Problems Panel nach jeder Datei prüfen** — TypeScript-Fehler, ESLint-Warnings, Tailwind-Warnungen auf 0 bringen. Niemals `@ts-ignore`/`eslint-disable` ohne Kommentar.

---

## Test-Pyramide (Pflicht nach jeder Phase)

| Ebene | Tool | Ziel |
|---|---|---|
| Unit | Vitest | Services mit gemockten Repos, Berechnungs-Funktionen, Guards |
| Integration | Vitest + echte DB | Repository-Layer, RLS-Policies (Transaction-Rollback je Test) |
| Security | Supertest | Cross-Tenant (403), revoked Keys (401), Rate-Limit (429) |
| Contract | zod.parse() | API-Response gegen shared Schema validieren |
| Snapshot | Vitest | `calculateMonthlyOverview` gegen bekannte Fixtures |
| Performance | Vitest bench | p95 < 200ms für Overview-Endpoint |
| E2E | Playwright | Login-Flow, 375px + 1280px, Dark Mode, PWA |
| Accessibility | axe-playwright | 0 Violations |

**Coverage:** Backend ≥ 80%, Frontend ≥ 70%
**Phase gilt erst als abgeschlossen wenn alle 8 Ebenen grün sind.**

---

## UI-Vollständigkeit — Pflicht

**Jedes UI-Element muss vollständig funktional sein. Keine Platzhalter, keine halbfertigen Flows.**

- ❌ Buttons ohne `(click)`-Handler oder mit leerem Handler
- ❌ Links die nirgends hinführen (`href="#"`, leere `routerLink`)
- ❌ Formulare ohne Submit-Logik
- ❌ Menü-Einträge ohne Route oder Action
- ❌ Modals/Dialoge die sich nicht schließen lassen
- ❌ Aktionen ohne Feedback (kein Loading-State, kein Toast, kein Error-State)
- ❌ CRUD-Seite ohne alle 4 Operationen vollständig verdrahtet

**Playwright-Test nach jeder UI-Komponente** — jeden Button, jedes Formular, jeden Flow durchklicken. Wenn etwas nicht funktioniert → sofort fixen, nicht weiter machen.

**Checkliste pro Komponente:**
- [ ] Alle Buttons haben Handler und führen etwas aus
- [ ] Alle Formulare validieren + submitten + zeigen Fehler
- [ ] Loading-States bei async Operationen
- [ ] Error-States bei fehlgeschlagenen Requests
- [ ] Empty-States wenn keine Daten vorhanden
- [ ] Playwright-Test hat die Komponente tatsächlich benutzt

---

## Harte Regeln — nie verletzen

- ❌ `householdId` aus Request-Body (internal) — IMMER aus `:hid` URL-Param
- ❌ `householdId` aus Body/Query/URL (public API) — IMMER aus API-Key
- ❌ `prisma.X.findMany()` ohne `where: { householdId }`
- ❌ Float für Geldbeträge — nur `amountCents: Int`
- ❌ API-Key-Klartext loggen oder zweimal ausgeben
- ❌ `dayOfMonth` ohne `safeDayOfMonth()`
- ❌ Service-Methode ohne `RequestContext` als erstes Argument
- ❌ OIDC-Linking ohne `email_verified === true`
- ❌ Passwort entfernen wenn keine OIDC-Identity übrig
- ❌ Refresh-Token in localStorage — nur httpOnly Cookie
- ❌ Access-Token in URL-Parametern
- ❌ Berechnungs-Logik in Frontend/Backend — immer aus `packages/shared`
- ❌ Recurring-Transaktionen persistieren — on-the-fly berechnen
- ❌ PRIVATE-Beträge anderer User in Aggregate einrechnen
- ❌ Zone.js-Patterns oder Reactive Forms
- ❌ Hardcoded Color-Hex — Tailwind-Klassen oder CSS-Variablen
- ❌ Zahlen ohne `font-mono` + `tabular-nums`
- ❌ `font-size < 16px` auf Form-Elementen
- ❌ `100vh` — immer `100dvh`
- ❌ Fixed/Sticky ohne Safe-Area-Insets
- ❌ Touch-Targets unter 44×44px
- ❌ `:hover`-only ohne `:active`
- ❌ `hlm-*` direkt in Feature-Komponenten — immer über `klar-*` abstrahieren
- ❌ Commit auf main mit offenen High/Critical CVEs

---

## Implementierungs-Phasen

| Phase | Inhalt |
|---|---|
| 1 | Skeleton: Monorepo, Compose, `/health`, Angular-Stub + PWA-Setup, JWT-Key-Gen, GitHub-Actions |
| 2 | Local-Auth: Register (erster=Admin), Login, Refresh, Logout, Rate-Limit |
| 3 | Households + Invites + RLS: Multi-Tenant-Fundament, Cross-Tenant-E2E-Test |
| 4 | OIDC: PocketID-Anbindung, Account-Linking, Group-Mapping, Security-Settings |
| 5 | Categories + Projects: CRUD, Sichtbarkeits-Validierung |
| 6 | Recurring Transactions: CRUD, Frequenz-Logik, `safeDayOfMonth` |
| 7 | Transactions + Budgets: CRUD, Quick-Add, Projekt-Zuordnung |
| 8 | Shared Berechnungs-Funktionen: `calculateMonthlyOverview`, Tests gegen Fixtures |
| 9 | Overview-Endpoints: Fixkosten-Übersicht, Monats-Cashflow, Projekt-Übersicht |
| 10 | API-Keys + Public API: Key-CRUD, Scopes, Rate-Limit, OpenAPI-Doku |
| 11 | Planspiel: OverviewStore + lokaler Signal-State, kein API-Call |
| 12 | Admin-Panel: User-Liste, Role-Management, Audit-Log |
| 13 | UI-Politur: Referenzbild-Layout exakt, Dark Mode, Empty States, Mobile |
| 14 | Hardening: CSP, Backups, Production-Compose, Traefik-Labels, README, Doku |

---

## Bei Unsicherheit

Nicht raten. `// TODO(spec): <Frage>` im Code + Frage in Antwort an Marco.

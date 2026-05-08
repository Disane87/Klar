# CLAUDE.md

Repo-Kontext für Claude Code. Regeln & Policies — **kein** Code-Wiki.
Konkrete Implementierungen ergeben sich aus dem Repo (Read/Grep). Produktanforderungen: `SPEC.md`.

---

## Session-Start (Pflicht)

```bash
git status && git branch --show-current
memory_search(query="klar app completed phases decisions")
memory_search(query="klar app patterns that worked")
```

Memory-Treffer mit Score > 0.7 sind verbindlich — nicht neu entscheiden.

---

## Skills — Wann welcher

| Skill | Wann |
|---|---|
| `writing-plans` | Vor jeder Phase, Tasks à 5–15 Min |
| `test-driven-development` | RED → GREEN → REFACTOR, kein Code vor Tests |
| `systematic-debugging` | Bei jedem Bug-Fix zuerst |
| `requesting-code-review` | Vor Merge/Freigabe |
| `interface-design` | Vor neuer UI — Design zuerst |

Koordination/Scaffolding läuft über **Ruflo Swarm** (`swarm_init`, `agent_spawn`, `memory_store/search`, `hooks_route`). Modell-Routing automatisch via ruvLLM (Haiku/Sonnet/Opus). Swarm-Größe: einfach 4 · Standard 6 · komplex 8. Hauptcontext nur für Koordination — kein Code direkt schreiben, Ergebnisse via `memory_store`.

### Workflow

Session-Start → Plan → UI-Design → Swarm-Init → Parallel-Implementierung → Tests → Review → Commit → Memory.

Nach jedem Task: `memory_store(key="klar-[phase]-[modul]", namespace="klar-app")` für Entscheidungen, `namespace="patterns"` für wiederverwendbare Ansätze.

---

## Git/Commit

- Direkt auf `main` — kein Feature-Branch-Overhead
- Ein Modul = ein Commit, niemals WIP, niemals halbfertig
- Commits sammeln vor Push; pushen erst wenn Feature E2E grün ist oder Marco OK gibt
- Commit-Sprache: **Englisch** (auch bei deutscher Konversation)
- Kein `Co-Authored-By: Claude`
- Niemals `--no-verify`
- **Vor JEDEM Commit:** `pnpm lint` + `pnpm test` lokal laufen lassen — kein Commit bei rotem Linter/Test, auch nicht bei "kleinen" Änderungen

---

## Security

- Vor jeder Session: Dependabot-Alerts → `github.com/Disane87/Klar/security/dependabot`
- High/Critical: sofort fixen · Moderate: in derselben Phase
- `pnpm audit` vor Commit · `pnpm update --interactive` regelmäßig
- Ausnahme: Spartan UI gepinnt, nie auto-updaten

---

## Docs / Public-Facing Inhalte

- **Sprache:** README.md, docs/**, CHANGELOG, PR-Beschreibungen, Code-Kommentare in `apps/` & `packages/` IMMER auf **Englisch** — auch wenn die Konversation deutsch läuft. Konversation deutsch → Output englisch.
- **Sensible Daten = Platzhalter:** Konkrete Hostnames, Subdomains, Server-Adressen, Stack-IDs, Tokens, Secrets, Pfade aus Marcos privater Infra **niemals** in eingecheckte Dateien. Immer Platzhalter: `your-klar-instance.com`, `<your-host>`, `<stack-id>`, `your-secret-here`. Echte Werte gehören in `.env` (gitignored), persönliche Memory oder externe Secrets.
- Vor jedem Commit auf neue Doku/Beispiele prüfen: keine internen Referenzen leaken.

---

## Stack

| Schicht | Tech |
|---|---|
| Runtime / PM / Build | Node 22 LTS · pnpm 10 · Turborepo |
| Frontend | Angular 21 (Zoneless, Signal Forms, Vitest) |
| UI | Spartan UI / Zard UI (gepinnt) + Tailwind 4 |
| State | Angular Signals + `resource()` — kein NgRx/Elf |
| Date | Temporal API — kein date-fns/Luxon |
| Backend | NestJS 11.1 + Fastify · Prisma · PostgreSQL 16 |
| Auth | Passport Local + OIDC + API-Key, Argon2id, JWT RS256 |
| Validation | zod (shared) + class-validator (DTOs) |
| Tests | Vitest · Supertest · Playwright |
| Deploy | Docker Compose + Traefik · GitHub Actions |

---

## Repo-Struktur

```
/apps/{api,web}
/packages/{shared,shared-frontend}
/prisma/{schema.prisma, migrations, seed.ts}
/docker/{docker-compose.dev.yml, docker-compose.prod.yml}
/.github/workflows/{ci.yml, deploy.yml}
/docs
SPEC.md · CLAUDE.md · README.md
```

VS Code Workspace (`.vscode/`) ist eingecheckt — Extensions, Tasks, Launch-Configs vorhanden. Prisma Studio via Task `db: studio`.

---

## Konventionen

**TypeScript:** `strict: true`, kein `any`, kein `as` ohne Begründung.

**Domänen-Invarianten (verbindlich):**
- Beträge IMMER `amountCents: number` (signed: + Einnahme, − Ausgabe). Niemals Float.
- Datum intern `Temporal.PlainDate`, API ISO `YYYY-MM-DD`. Budget-Monat `YYYY-MM-01`.
- E-Mail lowercase gespeichert + verglichen.
- `dayOfMonth` IMMER durch `safeDayOfMonth()` (clampt auf Monatsletzten).
- Berechnungs-Logik nur in `packages/shared` — niemals in Frontend/Backend duplizieren.
- Recurring-Transaktionen on-the-fly berechnen, nicht persistieren.
- PRIVATE-Beträge anderer User nie in Aggregate einrechnen.

**Logging:** kein `console.log` — pino (Backend) / Angular Logger (Frontend). Pino-Redaction für `password*`, `apiKey`, `secret*`, `authorization`, `*Token*`, `code*`, `state`, `clientSecret`.

---

## Frontend-Regeln (Angular 21)

- **Zoneless** — kein `Zone.js`, kein `NgZone.run()`, kein `markForCheck()`
- **Signal Forms** — keine Reactive Forms (`FormGroup`/`FormBuilder`)
- Domain-Stores erben von `ResourceStore<T>` aus `packages/shared-frontend` (Implementierung dort)
- Mutations IMMER reaktiv: nach POST/PATCH/DELETE Store-Signal sofort updaten oder `reload()`. Nie auf Page-Reload vertrauen. Optimistic-Updates bei Fehler via `reload()` revertieren
- HTTP über `ApiClient` aus `packages/shared-frontend`; Interceptors: Auth, Refresh, Error (RFC 7807 → Toast)

### Spartan UI — Pflicht

Workflow für jedes Control: (1) `spartan.ng` prüfen, (2) `hlm*`-Direktive aus `apps/web/src/app/shared/ui/hlm/` nutzen, (3) bei Wiederholung in `app-*` oder `klar-*`-Komponente kapseln.

Niemals nackte `<input>`, `<button>` ohne `hlm*`-Direktive. Avatar/Initials immer `<klar-avatar>`. Bei ≥ 2 ähnlichen UI-Strukturen: in `klar-*`-Komponente kapseln, nicht duplizieren — vor neuem Element prüfen ob existierende `klar-*`-Komponente passt.

**Selects: niemals nativ.** `<select>` ist app-weit verboten — IMMER `<klar-select [options]="opts" [(value)]="x">` (gewrapptes Spartan brn-select). Native `<select>` rendert in Safari/iOS unverändert ohne Dark-Mode und ohne unsere Tastatur-/Fokus-Konventionen. CI-Hygiene-Gate (`scripts/ui-hygiene-check.sh`) blockt jeden neuen `<select>`-Tag.

### Design-System

- Zahlen IMMER `font-family: var(--font-mono)` + `font-variant-numeric: tabular-nums`
- Farben semantisch: `text-success`/`text-danger`/`text-muted-foreground`/`text-primary` — kein Hex in Komponenten
- Kategorie-Gruppen: linke Border 2px in Kategorie-Farbe, kein filled Background
- Section-Headers: `text-[10px] uppercase tracking-widest text-muted-foreground`
- Finance-Tabellen: kompakt `py-1.5 px-4`
- Dark Mode von Anfang an mit `dark:` — niemals nachrüsten
- Jede Page unter `/app/*` braucht Page-Header (Titel + Actions) — nie nacktes `<h1>` im Content

### Hero-Pattern — `<klar-hero>` Pflicht (app-weit, ohne Ausnahme)

Jeder Hero im App-Bereich `/app/*` ist `<klar-hero>` aus `apps/web/src/app/shared/ui/klar-hero.component.ts`. Eine kanonische Optik (admin-style: Eyebrow in Accent-Farbe, 26px-Fraunces-Title, Sub-Text, Gradient-Decor, Action-Cluster rechts), keine page-spezifischen Hero-Styles, keine Inline-Nachbauten.

Slots:
- `[heroEyebrowIcon]` — kleines Icon links neben der Eyebrow-Zeile
- `[heroBody]` — zusätzlicher Body unter dem Subtitle
- `[heroActions]` — rechts platziertes Cluster: Buttons, Metric-Tile-Grids, Status-Chips, Money-Stats. Auf Mobile bricht es unter den Title.

Wenn eine Page eine andere Visual-Sprache wirklich braucht (z. B. Money-Headline, Project-Color-Theme), wird das als Feature in `klar-hero` ergänzt (zusätzliche Inputs, CSS-Var-Override) — niemals als Page-lokales Hero-Layout. Das Design-System hat **eine** Hero-Definition, alles andere driftet auseinander.

Verboten:
- Inline `<section class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-5 …">` mit eigener Eyebrow-+-Title-Struktur
- Page-spezifische `.hero { … }` CSS-Klassen für Layout/Decor des Hero-Elements
- Title-Override per `style="font-family: var(--font-display); font-size: …px"` auf Page-Level

---

## Mobile-First & PWA

**Mobile-First:** Base = Mobile, Breakpoints fügen Desktop hinzu — nie umgekehrt. Jede neue/geänderte Komponente MUSS bei der Implementierung im Mobile-Viewport (≤ 375px) geprüft werden — kein horizontaler Overflow, kein abgeschnittener Inhalt, keine Touch-Targets < 44px. Header/Summary-Strips, Toolbars, Tabellen-Header etc. sind besonders anfällig: Icons auf Mobile ggf. ausblenden (`max-md:hidden`), Schriftgrößen reduzieren, `truncate`/`min-w-0` nicht vergessen. Desktop-only-Entwicklung ist eine Regression.

**iOS/Safari Hard Rules (nicht verhandelbar):**
- Form-Elemente min. `text-base` (16px) — sonst zoomt Safari rein
- IMMER `100dvh`, nie `100vh`
- Fixed/Sticky an Bildschirmrändern: Safe-Area-Insets via `env(safe-area-inset-*)` (CSS-Vars `--safe-top/bottom/left/right` global gesetzt)
- Touch-Targets min. 44×44px (Apple HIG)
- Kein `:hover`-only — immer `:active`/Tap-State

**Navigation:**
- < 768px: Bottom Nav (Fixkosten · Cashflow · Projekte · Mehr)
- 768–1023px: Sidebar 160px collapsible
- ≥ 1024px: Sidebar 200px permanent

**Datentabellen:** Desktop = Tabelle, Mobile = Card-List (Disclosure-Pattern). Lange Listen (> 50 Items potenziell): IMMER Virtual-Scrolling (Angular CDK oder `klar-list` mit Pagination/Lazy) — Standard für CSV-Import, Buchungen, Audit-Log.

**PWA:** `@angular/pwa` (Manifest, ngsw-config, iOS Meta-Tags + Apple-Touch-Icons + Splash). Caching-Strategie `freshness` für API-Calls. Install-Prompt: nativ auf Android/Chrome, manueller Hint auf iOS (einmalig nach erstem Login, in `localStorage` als gesehen markiert).

**`localStorage` Whitelist (alles andere verboten):**
- PWA-Install-Hint (`klar.installPromptSeen` o. ä.)
- Theme-Persistenz (`theme.service.ts`)
- Changelog-seen-Marker (`version.service.ts`)
- `sessionStorage` ist unrestricted (verschwindet beim Tab-Close); aktuelle Nutzung: `pendingInviteToken`, `postLoginReturnUrl`.

Alles andere user-state-mäßige gehört in den Backend-User-Settings-Endpoint. Niemals Tokens, niemals Beträge, niemals haushaltsspezifische Daten in `localStorage`.

---

## Backend-Regeln (NestJS 11)

- Modul-Layout pro Domäne: `Controller → Service → Repository`. Prisma **nur** im Repository.
- Service-Methoden bekommen `RequestContext` als erstes Argument — **kein** `req`-Zugriff im Service.
- Guards: `JwtAuthGuard` (global), `ApiKeyAuthGuard` (`/api/public/v1`), `HouseholdMemberGuard` (baut Context aus `:hid`), `ApiKeyContextGuard`, `AppAdminGuard`, `@RequireScope('x:y')`.
- `householdId` **niemals** aus Body/Query (internal: aus `:hid` URL-Param; public: aus API-Key).
- `prisma.X.findMany()` IMMER mit `where: { householdId }` — auch wenn RLS greift.
- Prisma-Middleware setzt `SET LOCAL app.household_id` pro Query (RLS). `migrate deploy` im Container-Entrypoint.
- `@db.Date` für Datumsfelder ohne Uhrzeit.
- Fehler: RFC 7807 Problem Details via `GlobalExceptionFilter`.

**Auth:**
- Erster registrierter User → `appRole = ADMIN` (idempotent über `count == 0`)
- `REGISTRATION_ENABLED` env-togglebar (default `true`)
- OIDC Group-Mapping bei **jedem** Login, nicht nur erstem
- OIDC-Linking nur mit `email_verified === true`
- Passwort entfernen nur wenn mind. eine OIDC-Identity bleibt
- Refresh-Token: httpOnly + Secure + SameSite=Strict, Path=/auth · Access-Token: 15 min, nur im SPA-Memory · niemals in URL

**API-Keys:**
- Prefix-Lookup (`bgb_live_` + 8 Chars) → Argon2-Verify
- Klartext **einmalig** ausgeben, nie loggen, nie wiederholen
- Last-Used async + throttled 1×/min — nie Request-Pfad blocken

---

## TDD

Red → Green → Refactor pro Feature. Reihenfolge: Service-Unit (mock Repo) → Repo-Integration (Test-DB, Rollback pro Test) → E2E für kritische Flows (Auth, Cross-Tenant, API-Key-Scopes) → Playwright Smoke pro neuer Route.

**Coverage (CI bricht ab):** Backend 80% Lines · Frontend 70% Lines.

**Playwright-Test nach Implementation ist Pflicht** (Marco-Vorgabe).

**Bestehende Tests bei Refactorings:** Wenn ein Refactoring (z. B. Wrapper-Migration, API-Änderung an Shared-Komponente) bestehende Tests betrifft, MÜSSEN diese im selben Commit angepasst werden — niemals `it.skip()`, niemals löschen, niemals auskommentieren. Ein roter Test nach Refactoring ist immer ein Anpassungs-Auftrag, nie ein Lösch-Auftrag. Ausnahme: Test prüft entferntes Feature → Test im selben Commit löschen, im Commit-Message begründen.

---

## Definition of Done — vor jedem Commit

1. Backend vollständig: Controller → Service → Repository
2. Prisma-Schema aktuell, `prisma:generate` gelaufen, kein `as any` auf Prisma-Aufrufen
3. Frontend: jeder sichtbare Button/Link tut etwas, kommuniziert mit API, zeigt Ergebnis oder Toast
4. Happy Path manuell durchgeklickt
5. `pnpm test`, `pnpm lint`, `pnpm build` grün
6. **Neue/erweiterte User-facing Features sofort in `README.md` dokumentiert** — Features-Tabelle ergänzen + Detail-Abschnitt unter "Features im Detail" (Zweck, Datenmodell-Highlights, UX-Flow, Privacy/Security-Aspekte). Kein Feature ohne README-Update mergen.

**Sofort blocken:** `TODO`/`FIXME`/`// stub`/`// placeholder` im Commit · `as any` auf Prisma · Click-Handler die nichts tun · Migration ohne Schema-Model.

---

## Harte Regeln — nie verletzen

- ❌ Halbfertige Features committen — jede Schicht muss verifiziert sein
- ❌ Float für Geld — nur `amountCents: Int`
- ❌ `householdId` aus Body (internal) bzw. Body/Query/URL (public)
- ❌ `findMany` ohne `where: { householdId }`
- ❌ Service ohne `RequestContext`
- ❌ Berechnungs-Logik außerhalb `packages/shared`
- ❌ Recurring persistieren · PRIVATE in Aggregate · Refresh-Token in localStorage · Access-Token in URL
- ❌ API-Key-Klartext loggen oder zweimal ausgeben
- ❌ Reactive Forms · Zone.js-Patterns
- ❌ Mutation ohne Store-State-Update
- ❌ Native Form-Controls ohne `hlm*` · Avatar/Initials inline statt `<klar-avatar>`
- ❌ UI duplizieren bei ≥ 2 Verwendungen
- ❌ Hex-Farben in Komponenten · Zahlen ohne `font-mono`+`tabular-nums`
- ❌ `font-size < 16px` auf Form-Elementen · `100vh` · Fixed ohne Safe-Area · Touch < 44px · `:hover`-only
- ❌ Code ohne Tests · Linter-Fehler · Coverage unterschritten
- ❌ `as any` als Dauer-Workaround · Schema/Migrationen auseinander
- ❌ Lange Listen ohne Virtual-Scroll (> 50 Items)
- ❌ Page ohne Page-Header
- ❌ Modal-Pflicht: Editieren immer via Dialog/Modal, nie inline

---

## Editier-UX

Editieren von Listen-Items IMMER via Modal/Dialog — niemals inline (App-weite Marco-Vorgabe).

---

## Implementierungs-Phasen

1 Skeleton (Monorepo, Compose, /health, PWA-Setup, JWT-Keys, CI) ·
2 Local-Auth ·
3 Households + Invites + RLS ·
4 OIDC (PocketID, Linking, Group-Mapping) ·
5 Categories + Projects ·
6 Recurring Transactions ·
7 Transactions + Budgets ·
8 Shared Berechnungs-Funktionen ·
9 Overview-Endpoints ·
10 API-Keys + Public API ·
11 Planspiel (lokaler Signal-State) ·
12 Admin-Panel ·
13 UI-Politur ·
14 Hardening (CSP, Backups, Prod-Compose, Doku).

Jede Phase: committed + lauffähig + Tests grün + Coverage erfüllt.

---

## Prod als Integrations-Umgebung

Marcos private Prod-Instanz (interne Subdomain, Portainer Stack — Details in Memory) ist primäre Integrationsumgebung. Nach main-Merge Stack manuell neu deployen. Keine Zwischenstände pushen die feature-incomplete sind.

> Konkrete Hostnames, Stack-IDs, interne Subdomains, Server-Adressen, Tokens etc. **niemals** in eingecheckte Dateien (README, docs/, CLAUDE.md, Code, Beispiele). Immer Platzhalter wie `your-klar-instance.com`, `<your-host>`, `<stack-id>` verwenden. Echte Werte gehören in lokale `.env`, persönliche Memory oder externe Secrets — nicht ins Repo.

---

## Bei Unsicherheit

Nicht raten. `// TODO(spec): <Frage>` im Code + Frage an Marco.

---

## Design-Pearl-Bundle — Ausnahmen (NICHT übernehmen)

Das Design-Pearl-Bundle (`C:\tmp\design-pearl\klar\project\`) enthält Test-Hilfen, die **nicht** Teil des Designs sind und nie nach Klar wandern dürfen:

- **`ModeToolbar`** in `app.jsx` (Z. 112–125, gerendert in Z. 175): Pill mit `Mode (Live/Mockup)` + `Theme (Hell/Dunkel)`-Buttons rechts oben. Reines Vorschau-Tooling im Bundle. Theme-Switch in Klar gehört unter Settings → Darstellung (segmented Hell/Dunkel/System), nicht in Header/Topbar.

Generelle Regel: Alles im Bundle, das nur dem Side-by-Side-Vergleich oder Mockup-Toggling dient (Demo-Switches, Variant-Picker, Theme-Pill), gehört nicht in die App.

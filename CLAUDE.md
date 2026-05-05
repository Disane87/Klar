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

### Skills — Wann welcher (KONSOLIDIERT & OPTIMIERT)

| Skill | Wann verwenden | Zweck |
|---|---|---|
| `writing-plans` | Vor jeder Phase — Tasks à 5–15 Min aufbrechen | Planung |
| `test-driven-development` | RED → GREEN → REFACTOR — kein Code vor Tests | Qualität |
| `systematic-debugging` | Bei jedem Bug-Fix — Skill zuerst aufrufen, nie ad-hoc debuggen | Debugging |
| `requesting-code-review` | Nach jedem Modul — vor Merge/Freigabe | Review |
| `interface-design` | Vor jeder neuen UI-Komponente/Seite — Design zuerst, dann Code | UI/UX |

**WICHTIG:** Alle Koordinations- und Scaffolding-Aufgaben laufen jetzt über **Ruflo Swarm** (effizienter, weniger Tokens).

**Entfernte Skills** (durch Ruflo ersetzt):
- ~~`gstack`~~ → Ruflo Swarm übernimmt Scaffolding/Koordination
- ~~`subagent-driven-development`~~ → Ruflo `agent_spawn` ist effizienter  
- ~~`dispatching-parallel-agents`~~ → Ruflo Swarm macht das automatisch

### Ruflo Swarm — Primäre Koordination & Model Selection

**Installation (einmalig):**
```bash
/plugin install ruflo-core@ruflo
/plugin install ruflo-swarm@ruflo
/plugin install ruflo-ruvllm@ruflo
/plugin install ruflo-agentdb@ruflo
```

**Core Tools:**
- `swarm_init` + `swarm_status` — Swarm starten/überwachen (Konfiguration aus `AGENTS.md`)
- `memory_store` / `memory_search` — Kontext zwischen Agents teilen, nie doppelt laden
- `agent_spawn` — parallele Agents für unabhängige Tasks
- `hooks_route` — Task-Routing nach Typ (Frontend/Backend/Test/Review)

**Model Selection (ruvLLM — automatisch aktiv):**
- **Haiku** (claude-haiku-4-5): Formatierung, einfache Fixes, < 50 LOC
- **Sonnet** (claude-sonnet-4-6): Standard CRUD/Features, Swarm Queen (Koordination)
- **Opus** (claude-opus-4-6): Architektur, Planning, komplexes Debugging, Multi-Modul-Refactoring

**Swarm-Größe:** Einfache Phasen: 4 · Standard: 6 · Komplex: 8

**Token-Sparregeln:**
- Hauptcontext nur für Koordination — kein Code direkt im Hauptcontext schreiben
- Subagents bekommen minimalen Kontext (nur was sie brauchen)
- Zwischenergebnisse via `memory_store` teilen, nicht in den Hauptcontext zurückgeben
- Parallele Agents für unabhängige Module — nie sequenziell wenn parallel möglich
- **Model-Routing läuft automatisch** — ruvLLM wählt basierend auf Task-Komplexität
- Swarm Queen nutzt immer Sonnet (Koordination braucht keine Opus-Power)

### Workflow — immer in dieser Reihenfolge

1. **Session-Start** — `git status`, memory_search, aktuellen Stand erfassen
2. **Plan** (`writing-plans`) — Tasks aufbrechen, Swarm-Größe festlegen
3. **UI-Design** (`interface-design`) — vor UI-Arbeit: Design zuerst
4. **Swarm** (`swarm_init`) — Agents initialisieren (Model Routing automatisch)
5. **Parallel-Implementierung** (Ruflo `agent_spawn`) — Frontend + Backend gleichzeitig, Haiku/Sonnet/Opus wird automatisch gewählt
6. **Tests** (`test-driven-development`) — alle 8 Test-Ebenen grün
7. **Review** (`requesting-code-review`) — Code-Review vor Merge
8. **Commit** — nach jedem abgeschlossenen Modul (nicht nach jedem File)
9. **Memory** — Entscheidungen + Patterns speichern

### Nach jedem erfolgreichen Task

```bash
memory_store(key="klar-[phase]-[modul]", value="[was gebaut, Entscheidungen, Gotchas]", namespace="klar-app")
memory_store(key="pattern-[beschreibung]", value="[konkreter Ansatz]", namespace="patterns")
```

---

## Git/Commit-Strategie

- **Direkt auf `main`** committen — kein Feature-Branch-Overhead als Solo-Entwickler
- **Commit-Zeitpunkt:** nach jedem abgeschlossenen Modul mit grünen Tests — nie mitten in halbfertigem Feature
- **Commit-Größe:** ein Modul = ein Commit; niemals WIP-Commits
- Feature-Branches nur für größere Experimente die eventuell weggeworfen werden
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

| Schicht | Technologie | Version |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Package Manager | pnpm | 10 |
| Build | Turborepo | latest |
| Frontend | Angular | 21 (Zoneless, Signal Forms, Vitest default) |
| UI Components | Zard UI (shadcn/ui für Angular) | pinned — Beta, nie auto-updaten |
| Styling | Tailwind CSS | 4 |
| PWA | @angular/pwa (Angular Service Worker) | — |
| State | Angular Signals + `resource()` nativ | kein NgRx, kein Elf |
| Backend | NestJS + Fastify | 11.1.x |
| ORM | Prisma | latest |
| Datenbank | PostgreSQL | 16 |
| Auth | Passport-Local + Passport-OIDC + API-Key | — |
| Kryptographie | Argon2id | — |
| JWT | RS256, eigenes Key-Pair | — |
| Date | Temporal API nativ | kein date-fns, kein Luxon |
| Validation | zod (shared) + class-validator (NestJS DTOs) | — |
| Tests | Vitest + Supertest + Playwright | — |
| Docs | @nestjs/swagger + zod-openapi | — |
| CI/CD | GitHub Actions | — |
| Deploy | Docker Compose + Traefik | — |

---

## Repo-Struktur

```
/apps
  /api                    — NestJS Backend
  /web                    — Angular Frontend
/packages
  /shared                 — zod-Schemas, TS-Types, Berechnungs-Funktionen
  /shared-frontend        — ResourceStore<T>, ApiClient, Interceptors, Helpers
/prisma
  schema.prisma
  migrations/
  seed.ts
/docker
  docker-compose.dev.yml  — nur Postgres
  docker-compose.prod.yml — Postgres + API + Web + Traefik
/.github
  workflows/
    ci.yml                — lint → test → build (schlägt fehl bei Coverage-Unterschreitung)
    deploy.yml            — SSH → docker compose pull → up
/docs
  pocketid-setup.md
  api-reference.md        — generiert aus OpenAPI JSON
SPEC.md
CLAUDE.md
README.md
```

---

## Commands

```bash
# Setup
pnpm install
pnpm --filter api keys:generate          # JWT RS256 Key-Pair einmalig
docker compose -f docker/docker-compose.dev.yml up -d
pnpm --filter api prisma:migrate
pnpm --filter api prisma:seed

# Entwicklung
pnpm dev                                 # alle Apps parallel via turbo
pnpm --filter api dev
pnpm --filter web dev

# Tests
pnpm test                                # alle Unit-Tests
pnpm --filter api test:integration       # gegen Test-DB (DATABASE_TEST_URL)
pnpm --filter api test:e2e               # Supertest
pnpm --filter web e2e                    # Playwright

# Build & Deploy
pnpm build
docker compose -f docker/docker-compose.prod.yml build
```

---

## TypeScript-Konventionen (gilt überall)

- `strict: true`, kein `any`, kein `as` ohne Begründungs-Kommentar
- Beträge IMMER `amountCents: number` (Integer, signed: positiv = Einnahme, negativ = Ausgabe)
- Datum intern `Temporal.PlainDate`, über die API ISO-String `YYYY-MM-DD`
- Budget-Monat IMMER als `YYYY-MM-01` normalisiert
- E-Mail IMMER lowercase gespeichert und verglichen
- Kein `console.log` — pino (Backend) / Angular Logger (Frontend)

### Utility-Types (packages/shared)

Single Source of Truth für alle DTOs und abgeleitete Typen.

```ts
// Prisma-Model-Felder die nie im Create/Update vorkommen
type ServerManaged = 'id' | 'createdAt' | 'updatedAt';

export type CreateDto<T extends Record<ServerManaged, unknown>> =
  Omit<T, ServerManaged>;

export type UpdateDto<T extends Record<ServerManaged, unknown>> =
  Partial<Omit<T, ServerManaged>>;

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

// Abgeleitet — nie manuell schreiben
export type CreateTransactionDto = CreateDto<Transaction>;
export type UpdateTransactionDto = UpdateDto<Transaction>;
export type CreateProjectDto    = CreateDto<Project>;
// etc.
```

### Berechnungs-Funktionen (packages/shared)

Werden in Frontend UND Backend importiert. Niemals duplizieren.

```ts
export function calculateMonthlyOverview(input: OverviewInput): OverviewResult
export function toMonthlyEquivalent(amountCents: number, freq: RecurringFrequency): number
export function safeDayOfMonth(year: number, month: number, day: number): number
export function sumByCents(items: { amountCents: number }[]): number
export function averageIncome(entries: IncomeEntry[]): number
export function currentYearMonth(): string  // 'YYYY-MM'
export function toHttpParams(obj: Record<string, unknown>): HttpParams
```

---

## Frontend-Patterns (Angular 21)

### Zoneless + Signal Forms

Angular 21 ist **zoneless by default** — kein `Zone.js`, kein `NgZone.run()`, kein `ChangeDetectorRef.markForCheck()`.

Formulare mit **Signal Forms** (nicht Reactive Forms):

```ts
import { signalForm, signalFormField, Validators } from '@angular/forms/signal';

readonly form = signalForm({
  name:       signalFormField('', [Validators.required]),
  amountCents: signalFormField(0,  [Validators.min(1)]),
  categoryId: signalFormField('', [Validators.required]),
});

// Template
<input [sfField]="form.name" />
@if (form.name.invalid() && form.name.touched()) {
  <span>Pflichtfeld</span>
}
<button [disabled]="form.invalid()" (click)="submit()">Speichern</button>
```

### ResourceStore<T> — Basis für alle Domain-Stores

```ts
// packages/shared-frontend/resource-store.ts

export abstract class ResourceStore<T, TFilter extends object = Record<string, never>> {
  protected abstract http: HttpClient;
  protected abstract endpointUrl: Signal<string>;
  protected abstract filter: Signal<TFilter>;

  private _mutating = signal(false);

  protected _resource = resource<T[], { url: string; filter: TFilter }>({
    request: () => ({ url: this.endpointUrl(), filter: this.filter() }),
    loader: ({ request }) =>
      firstValueFrom(
        this.http.get<T[]>(request.url, {
          params: toHttpParams(request.filter)
        })
      ).then(data => z.array(this.schema()).parse(data)) // runtime-Validierung
  });

  // Abstrakt — jeder Store definiert sein zod-Schema
  protected abstract schema(): z.ZodType<T>;

  // Öffentliche Signals
  readonly items     = this._resource.value;
  readonly loading   = computed(() => this._resource.isLoading() || this._mutating());
  readonly error     = this._resource.error;
  readonly isEmpty   = computed(() => (this.items()?.length ?? 0) === 0);

  // Geschützte Mutation-Helper
  protected async mutate<R>(
    fn: () => Promise<R>,
    options?: {
      optimistic?: (current: T[]) => T[];
    }
  ): Promise<R> {
    if (options?.optimistic) {
      this._resource.update(curr => options.optimistic!(curr ?? []));
    }
    this._mutating.set(true);
    try {
      const result = await fn();
      this._resource.reload();
      return result;
    } catch (err) {
      if (options?.optimistic) this._resource.reload(); // revert
      throw err;
    } finally {
      this._mutating.set(false);
    }
  }
}
```

### Domain-Store — erbt ResourceStore<T>

```ts
@Injectable({ providedIn: 'root' })
export class TransactionStore extends ResourceStore<Transaction, TransactionFilter> {
  protected override http        = inject(HttpClient);
  private            household   = inject(HouseholdStore);

  protected override endpointUrl = computed(() =>
    `/api/v1/households/${this.household.activeId()}/transactions`
  );
  protected override filter      = signal<TransactionFilter>({ month: currentYearMonth() });
  protected override schema      = () => TransactionSchema; // aus packages/shared

  // Domain-Computed
  readonly totalExpenses = computed(() => sumByCents((this.items() ?? []).filter(t => t.amountCents < 0)));
  readonly totalIncome   = computed(() => sumByCents((this.items() ?? []).filter(t => t.amountCents > 0)));

  // Domain-Mutations
  readonly create = (dto: CreateTransactionDto) =>
    this.mutate(
      () => this.api.post<Transaction, CreateTransactionDto>(this.endpointUrl(), dto),
      { optimistic: curr => [...curr, { ...dto, id: tempId(), _pending: true } as T] }
    );

  readonly update = (id: string, dto: UpdateTransactionDto) =>
    this.mutate(() => this.api.patch(`${this.endpointUrl()}/${id}`, dto));

  readonly remove = (id: string) =>
    this.mutate(
      () => this.api.delete(`${this.endpointUrl()}/${id}`),
      { optimistic: curr => curr.filter(t => (t as Transaction).id !== id) }
    );

  // Filter-Mutation
  readonly setMonth = (month: string) => this.filter.update(f => ({ ...f, month }));
}
```

### Template-Pattern

```html
@if (store.loading()) {
  <app-skeleton-rows />
} @else if (store.error()) {
  <app-error-state [error]="store.error()" (retry)="store.reload()" />
} @else if (store.isEmpty()) {
  <app-empty-state message="Noch keine Buchungen" />
} @else {
  @for (tx of store.items()!; track tx.id) {
    <app-transaction-row [tx]="tx" />
  }
}

<button [disabled]="store.loading()" (click)="create()">
  @if (store.loading()) { … } @else { + Buchung }
</button>
```

### ApiClient (packages/shared-frontend)

```ts
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private http = inject(HttpClient);

  get<TRes>(url: string, params?: object): Promise<TRes> {
    return firstValueFrom(this.http.get<TRes>(url, { params: toHttpParams(params ?? {}) }));
  }

  post<TRes, TBody>(url: string, body: TBody): Promise<TRes> {
    return firstValueFrom(this.http.post<TRes>(url, body));
  }

  patch<TRes, TBody>(url: string, body: TBody): Promise<TRes> {
    return firstValueFrom(this.http.patch<TRes>(url, body));
  }

  delete(url: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(url));
  }
}
```

### HTTP-Interceptors

```
AuthInterceptor        — fügt Authorization: Bearer <token> hinzu
RefreshInterceptor     — fängt 401, versucht Token-Refresh, wiederholt Request
ErrorInterceptor       — mappt HTTP-Fehler auf Toast-Notifications (RFC 7807)
```

```ts
// ErrorInterceptor — zentrales Fehler-Handling
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const toast = inject(ToastService);
      const msg = (err.error as ProblemDetail)?.detail ?? 'Ein Fehler ist aufgetreten.';
      if (err.status === 401) {
        // RefreshInterceptor hat schon versucht — jetzt logout
        inject(AuthStore).logout();
      } else if (err.status !== 422) {
        // 422 zeigen Forms selbst (Validation-Errors)
        toast.error(msg);
      }
      return throwError(() => err);
    })
  );
```

### Design-System-Regeln (Frontend)

**Zahlen:** IMMER `font-family: var(--font-mono)` + `font-variant-numeric: tabular-nums`

**Farben über Tailwind-Semantik:**
```
Income / Positiv  → text-success, border-success, bg-success/10
Expense / Negativ → text-danger,  border-danger,  bg-danger/10
Überschuss        → text-success prominent, bg-success/15
Neutral           → text-muted-foreground
Accent (UI)       → text-primary, border-primary
```

**Kategorie-Gruppen:** linke Border 2px in Kategorie-Farbe (aus DB), kein filled Background

**Section-Headers:** `text-[10px] uppercase tracking-widest text-muted-foreground`

**Spacing Finance-Tabellen:** kompakt (`py-1.5 px-4`) — kein Standard-Tailwind-Padding

**Dark Mode:** Tailwind `dark:` von Anfang an auf jeder Komponente — niemals nachrüsten

**Kein hardcoded Color-Hex in Komponenten** — nur Tailwind-Klassen oder CSS-Variablen

---

## Mobile-First & PWA

### Grundregel: Mobile-First

Base-Styles gelten für Mobile (`< 768px`). Breakpoints fügen Desktop-Komplexität hinzu — niemals umgekehrt.

```html
<!-- Falsch: Desktop-first -->
<div class="flex-row md:flex-col">

<!-- Richtig: Mobile-first -->
<div class="flex-col md:flex-row">
```

### iOS/Safari Hard Rules

Diese Regeln sind nicht optional — sie verhindern konkrete Safari-Bugs:

- ❌ `font-size < 16px` auf `<input>`, `<select>`, `<textarea>` → Safari zoomt automatisch rein. IMMER `text-base` (16px) minimum auf Form-Elementen.
- ❌ `100vh` → falsch auf iOS (ignoriert Browser-Chrome). IMMER `100dvh` (dynamic viewport height, iOS 15.4+, unser Mindest-Target).
- ❌ `position: fixed` ohne Safe-Area-Insets → überdeckt Notch/Home-Indicator.
- ❌ Touch-Targets unter 44×44px — Apple HIG Minimum. Buttons/Icons immer `min-h-[44px] min-w-[44px]`.
- ❌ `:hover`-only Interaktionen — Touch kennt kein Hover. Immer auch `:active` / Tap-State definieren.

### Safe Area Insets

Für alle fixed/sticky Elemente die an Bildschirmränder stoßen:

```html
<!-- Tailwind 4 arbitrary values -->
<nav class="fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)]">
<header class="sticky top-0 pt-[env(safe-area-inset-top)]">

<!-- Für den Body-Container -->
<main class="min-h-[100dvh] px-[env(safe-area-inset-left)] 
             pb-[calc(env(safe-area-inset-bottom)+4rem)]">
```

In `styles.css` global:

```css
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}
```

### Responsive Navigation

```
Mobile  (< 768px)  → Bottom Navigation Bar (4 Icons + Label)
Tablet  (768–1023px) → Sidebar 160px collapsible
Desktop (≥ 1024px) → Sidebar 200px permanent (wie im Mockup)
```

**Bottom Nav Struktur (Mobile):**

```html
<!-- Nur auf Mobile sichtbar -->
<nav class="fixed bottom-0 left-0 right-0 md:hidden
            border-t border-border bg-background
            pb-[env(safe-area-inset-bottom)]
            grid grid-cols-4">
  @for (item of navItems(); track item.route) {
    <a [routerLink]="item.route" routerLinkActive="text-primary"
       class="flex flex-col items-center gap-1 py-2 min-h-[56px]
              text-muted-foreground transition-colors">
      <app-icon [name]="item.icon" class="size-5" />
      <span class="text-[10px] tracking-wide uppercase">{{ item.label }}</span>
    </a>
  }
</nav>

<!-- Bottom-Nav Spacer — verhindert Content-Überlagerung -->
<div class="h-[calc(56px+env(safe-area-inset-bottom))] md:hidden"></div>
```

**Nav-Items (Mobile):** Fixkosten · Cashflow · Projekte · Mehr (→ Sheet mit restlichen Punkten)

### Responsive Datentabellen

Die Fixkosten-Tabelle ist zu breit für Mobile. Pattern:

```html
<!-- Desktop: Tabellen-Ansicht -->
<div class="hidden md:block">
  <app-fixkosten-table [overview]="store.overview()" />
</div>

<!-- Mobile: Card-List-Ansicht -->
<div class="md:hidden space-y-2">
  @for (group of store.overview()?.groups; track group.categoryId) {
    <app-fixkosten-card-group [group]="group" />
  }
</div>
```

Mobile Card-Group: Kategorie-Header mit Zwischensumme, ausklappbare Einzelposten (Disclosure-Pattern via Zard UI Collapsible).

### PWA Setup

`@angular/pwa` via `ng add @angular/pwa` generiert Service Worker + Manifest. Danach anpassen:

**`manifest.webmanifest`:**

```json
{
  "name": "Klar",
  "short_name": "Klar",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "orientation": "portrait-primary",
  "start_url": "/",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512-maskable.png", "sizes": "512x512",
      "type": "image/png", "purpose": "maskable" }
  ]
}
```

**`index.html` — iOS-spezifische Meta-Tags (zwingend):**

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Klar">
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover">

<!-- App Icons für iOS (add-to-homescreen) -->
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="152x152" href="icons/apple-touch-icon-152.png">
<link rel="apple-touch-icon" sizes="120x120" href="icons/apple-touch-icon-120.png">

<!-- Splash Screens (mind. iPhone 14/15 Pro abdecken) -->
<link rel="apple-touch-startup-image"
      href="icons/splash-1179x2556.png"
      media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)">
```

**`ngsw-config.json` — Caching-Strategie:**

```json
{
  "assetGroups": [
    {
      "name": "app-shell",
      "installMode": "prefetch",
      "resources": { "files": ["/favicon.ico", "/index.html", "/*.css", "/*.js"] }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": { "files": ["/icons/**"] }
    }
  ],
  "dataGroups": [
    {
      "name": "api-overview",
      "urls": ["/api/v1/households/*/overview/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 10,
        "maxAge": "5m",
        "timeout": "3s"
      }
    },
    {
      "name": "api-data",
      "urls": ["/api/v1/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 50,
        "maxAge": "1m",
        "timeout": "5s"
      }
    }
  ]
}
```

Strategie: `freshness` (network-first, fällt auf Cache zurück bei Timeout) für alle API-Calls. Offline-Indikator im Header wenn Service Worker meldet dass keine Verbindung besteht.

### PWA Install-Prompt (iOS hat kein `beforeinstallprompt`)

```ts
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  // Android/Chrome: nativer Prompt
  private deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly canInstallNatively = computed(() => !!this.deferredPrompt());

  // iOS: manuell erklären
  readonly isIos = computed(() => /iphone|ipad|ipod/i.test(navigator.userAgent));
  readonly isInStandaloneMode = computed(() =>
    ('standalone' in navigator && (navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
  readonly shouldShowIosHint = computed(
    () => this.isIos() && !this.isInStandaloneMode()
  );
}
```

iOS-Hint: einmalig nach erstem Login zeigen (via Zard UI Sheet), mit Screenshot "Share → Zum Home-Bildschirm". Danach in `localStorage` als gesehen markieren (einzige Ausnahme der localStorage-Regel — kein Security-Concern hier).

---

## Backend-Patterns (NestJS 11)

### Modul-Struktur

```
auth, oidc, users, households, categories, projects,
recurring-transactions, transactions, budgets, overview,
api-keys, admin
```

Pro Modul: `Controller` → `Service` → `Repository` (Prisma nur im Repository)

### RequestContext — Pflicht für alle Service-Methoden

```ts
export type RequestContext = {
  userId:      string;
  householdId: string;
  source:      'web' | 'api-key';
  apiKeyId?:   string;
};
```

Kein `req`-Zugriff im Service. Macht Services testbar und API-Source-agnostisch.

### Guards-Hierarchie

```
JwtAuthGuard          — global für /api/v1/* und /auth/* (außer public Endpoints)
ApiKeyAuthGuard       — /api/public/v1/*
HouseholdMemberGuard  — prüft Membership zu :hid, baut RequestContext
ApiKeyContextGuard    — baut RequestContext aus Key
AppAdminGuard         — appRole = ADMIN
@RequireScope('x:y')  — Scope-Check auf public API Endpoints
```

### Generic Repository-Pattern

```ts
abstract class BaseRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  protected abstract model: string; // keyof PrismaClient

  protected async findMany(
    ctx: RequestContext,
    where: object = {},
    options: { include?: object; orderBy?: object } = {}
  ): Promise<T[]> {
    return (this.prisma as any)[this.model].findMany({
      where: { householdId: ctx.householdId, ...where },
      ...options,
    });
  }

  protected async findOneOrThrow(ctx: RequestContext, id: string): Promise<T> {
    const item = await (this.prisma as any)[this.model].findUnique({
      where: { id, householdId: ctx.householdId },
    });
    if (!item) throw new NotFoundException(`${this.model} ${id} nicht gefunden`);
    return item;
  }

  protected async create(ctx: RequestContext, data: object): Promise<T> {
    return (this.prisma as any)[this.model].create({
      data: { ...data, householdId: ctx.householdId, createdByUserId: ctx.userId },
    });
  }

  protected async update(ctx: RequestContext, id: string, data: object): Promise<T> {
    await this.findOneOrThrow(ctx, id); // prüft Ownership via householdId
    return (this.prisma as any)[this.model].update({ where: { id }, data });
  }

  protected async remove(ctx: RequestContext, id: string): Promise<void> {
    await this.findOneOrThrow(ctx, id);
    await (this.prisma as any)[this.model].delete({ where: { id } });
  }
}
```

### Fehlerformat: RFC 7807 Problem Details

```ts
// Jede Exception wird zu diesem Format gemappt (GlobalExceptionFilter)
{
  type: 'https://klar.app/errors/not-found',
  title: 'Ressource nicht gefunden',
  status: 404,
  detail: 'Transaction abc123 nicht gefunden',
  instance: '/api/v1/households/xyz/transactions/abc123'
}
```

### Prisma

- Middleware: `SET LOCAL app.household_id` vor jedem Query (RLS)
- `migrate deploy` läuft im Container-Entrypoint vor API-Start
- Niemals `findMany()` ohne `where: { householdId }` — auch wenn RLS greift
- `@db.Date` für alle Datumsfelder ohne Uhrzeit

### Auth-Details

- Erster User der sich registriert → `appRole = ADMIN` (idempotent: check `count == 0`)
- `Registration` per `REGISTRATION_ENABLED` Env togglebar (default: `true`)
- OIDC Group-Mapping läuft bei **jedem** Login — nicht nur erstem
- Refresh-Token: httpOnly + Secure + SameSite=Strict Cookie (Path=/auth)
- Access-Token: 15 min, nur im Memory des SPA

### API-Keys

- Prefix-Lookup (erste 8 Chars nach `bgb_live_`) → Argon2-Verify
- Klartext **einmalig** ausgeben, danach nie wieder — niemals loggen
- `householdId` kommt aus dem Key, **niemals** aus Body/URL (public API)
- Last-Used: async, throttled 1x/Minute — niemals den Request-Pfad blockieren

### Pino Redaction

Folgende Felder werden aus Logs entfernt:
`password`, `currentPassword`, `newPassword`, `passwordHash`,
`apiKey`, `secret`, `hashedSecret`, `authorization`,
`token`, `accessToken`, `refreshToken`, `tokenHash`,
`code`, `codeVerifier`, `state`, `clientSecret`

---

## VS Code Workspace

Phase 1 erstellt eine vollständige VS Code Entwicklungsumgebung. Alle Dateien gehören ins Repo (checked in).

### `.vscode/extensions.json`

```json
{
  "recommendations": [
    "angular.ng-template",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "vitest.explorer",
    "ms-playwright.playwright",
    "PKief.material-icon-theme",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense",
    "mikestead.dotenv",
    "humao.rest-client",
    "rangav.vscode-thunder-client"
  ]
}
```

### `.vscode/settings.json`

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.configFile": "apps/web/tailwind.config.ts",
  "tailwindCSS.includeLanguages": { "typescript": "javascript" },
  "vitest.enable": true,
  "vitest.commandLine": "pnpm test",
  "files.exclude": { "**/node_modules": true, "**/.turbo": true },
  "search.exclude": { "**/node_modules": true, "**/dist": true },
  "prisma.showPrismaDataPlatformNotification": false
}
```

### `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev: all",
      "type": "shell",
      "command": "pnpm dev",
      "group": "build",
      "presentation": { "panel": "new" },
      "problemMatcher": []
    },
    {
      "label": "dev: api",
      "type": "shell",
      "command": "pnpm --filter api dev:debug",
      "group": "build",
      "presentation": { "panel": "new" },
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "dev: web",
      "type": "shell",
      "command": "pnpm --filter web dev",
      "group": "build",
      "presentation": { "panel": "new" },
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "test: unit",
      "type": "shell",
      "command": "pnpm test",
      "group": "test",
      "presentation": { "panel": "shared" },
      "problemMatcher": []
    },
    {
      "label": "test: e2e api",
      "type": "shell",
      "command": "pnpm --filter api test:e2e",
      "group": "test",
      "presentation": { "panel": "shared" },
      "problemMatcher": []
    },
    {
      "label": "test: playwright",
      "type": "shell",
      "command": "pnpm --filter web e2e",
      "group": "test",
      "presentation": { "panel": "new" },
      "problemMatcher": []
    },
    {
      "label": "db: migrate",
      "type": "shell",
      "command": "pnpm --filter api prisma:migrate",
      "group": "build",
      "presentation": { "panel": "shared" },
      "problemMatcher": []
    },
    {
      "label": "db: studio",
      "type": "shell",
      "command": "pnpm --filter api prisma:studio",
      "group": "build",
      "presentation": { "panel": "new" },
      "problemMatcher": []
    },
    {
      "label": "docker: dev up",
      "type": "shell",
      "command": "docker compose -f docker/docker-compose.dev.yml up -d",
      "group": "build",
      "presentation": { "panel": "shared" },
      "problemMatcher": []
    },
    {
      "label": "docker: dev down",
      "type": "shell",
      "command": "docker compose -f docker/docker-compose.dev.yml down",
      "group": "build",
      "presentation": { "panel": "shared" },
      "problemMatcher": []
    }
  ]
}
```

### `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: NestJS API",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/apps/api/dist/**/*.js"],
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ]
    },
    {
      "name": "Debug: Angular (Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}/apps/web/src",
      "sourceMapPathOverrides": {
        "webpack:/*": "${webRoot}/*",
        "/./*": "${webRoot}/*"
      }
    },
    {
      "name": "Debug: Angular (Safari)",
      "type": "safari",
      "request": "launch",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}/apps/web/src"
    },
    {
      "name": "Debug: Vitest (current file)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true,
      "smartStep": true
    },
    {
      "name": "Debug: Vitest (all)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true
    },
    {
      "name": "Debug: E2E API (Supertest)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--config", "apps/api/vitest.e2e.config.ts"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true,
      "env": {
        "NODE_ENV": "test"
      }
    },
    {
      "name": "Debug: Playwright",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/@playwright/test/cli.js",
      "args": ["test", "--headed"],
      "cwd": "${workspaceFolder}/apps/web",
      "sourceMaps": true
    }
  ],
  "compounds": [
    {
      "name": "Full Stack Debug",
      "configurations": ["Debug: NestJS API", "Debug: Angular (Chrome)"],
      "presentation": { "order": 1 }
    }
  ]
}
```

**`apps/api/package.json` muss enthalten:**
```json
{
  "scripts": {
    "dev:debug": "nest start --watch --debug 0.0.0.0:9229"
  }
}
```

**Prisma Studio** läuft via Task "db: studio" auf `http://localhost:5555` — Browser-UI für die DB, kein extra Tool nötig.

---

## TDD-Workflow

**Red → Green → Refactor — Pflicht pro Feature.**

```
1. Unit-Test für Service schreiben (mockte Repository) → schlägt fehl
2. Service implementieren → grün
3. Integration-Test für Repository (echte Test-DB, Transaction-Rollback pro Test)
4. E2E-Test für kritische Flows (Auth, Cross-Tenant, API-Key-Scopes)
5. Playwright Smoke-Test für die neue UI-Route
```

### Test-Factories

```ts
// tests/factories/transaction.factory.ts
export const createTransaction = (
  overrides: Partial<Transaction> = {}
): Transaction => ({
  id:              randomId(),
  householdId:     'test-household',
  createdByUserId: 'test-user',
  amountCents:     -5000,
  categoryId:      'test-category',
  date:            new Temporal.PlainDate(2026, 4, 1).toString(),
  description:     'Test-Buchung',
  visibility:      'SHARED',
  createdAt:       new Date(),
  updatedAt:       new Date(),
  ...overrides,
});
```

### Coverage-Thresholds (CI schlägt fehl wenn unterschritten)

- Backend: 80 % Lines
- Frontend: 70 % Lines

---

## Harte Regeln — nie verletzen

- ❌ `householdId` aus Request-Body (internal API) — IMMER aus `:hid` URL-Param
- ❌ `householdId` aus Body/Query/URL (public API) — IMMER aus API-Key
- ❌ `prisma.X.findMany()` ohne `where: { householdId }` — auch wenn RLS greift
- ❌ Float für Geldbeträge — nur `amountCents: Int`
- ❌ API-Key-Klartext loggen oder zweimal ausgeben
- ❌ `dayOfMonth` ohne `safeDayOfMonth()` — clampt auf Monatsletzten
- ❌ Service-Methode ohne `RequestContext` als erstes Argument
- ❌ OIDC-Linking ohne `email_verified === true`
- ❌ Passwort entfernen wenn keine OIDC-Identity übrig
- ❌ Refresh-Token in localStorage — nur httpOnly Cookie
- ❌ Access-Token in URL-Parametern
- ❌ Berechnungs-Logik in Frontend/Backend reimplementieren — immer aus `packages/shared`
- ❌ Recurring-Transaktionen persistieren — on-the-fly berechnen
- ❌ PRIVATE-Beträge anderer User in Aggregate einrechnen
- ❌ `Zone.js`-Patterns (`NgZone.run()`, `ChangeDetectorRef.markForCheck()`)
- ❌ Reactive Forms (`FormGroup`, `FormBuilder`) — Signal Forms verwenden
- ❌ Hardcoded Color-Hex in Komponenten — Tailwind-Klassen oder CSS-Variablen
- ❌ Zahlen ohne `font-mono` und `tabular-nums` rendern
- ❌ `font-size < 16px` auf Form-Elementen — iOS Safari zoomt rein
- ❌ `100vh` — immer `100dvh` verwenden
- ❌ Fixed/Sticky Elemente ohne Safe-Area-Insets
- ❌ Touch-Targets unter 44×44px
- ❌ `:hover`-only States ohne `:active` Fallback

---

## Implementierungs-Phasen

Jede Phase: commiten + lauffähig + Tests grün + Coverage-Threshold erfüllt.

| Phase | Inhalt |
|---|---|
| 1 | Skeleton: Monorepo, Compose, `/health`, Angular-Stub + PWA-Setup (`@angular/pwa`, iOS Meta-Tags, Manifest), JWT-Key-Gen, GitHub-Actions Basis |
| 2 | Local-Auth: Register (erster=Admin), Login, Refresh, Logout, Rate-Limit |
| 3 | Households + Invites + RLS: Multi-Tenant-Fundament, Cross-Tenant-E2E-Test |
| 4 | OIDC: PocketID-Anbindung, Account-Linking (alle Edge-Cases), Group-Mapping, Security-Settings |
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

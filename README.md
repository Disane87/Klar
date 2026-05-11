# 💶 Klar — Self-Hosted Budget Tracker

[![CI](https://github.com/Disane87/klar/actions/workflows/ci.yml/badge.svg)](https://github.com/Disane87/klar/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Disane87/klar)](https://github.com/Disane87/klar/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/node-22_LTS-brightgreen)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-21-red)](https://angular.io)
[![NestJS](https://img.shields.io/badge/NestJS-11-red)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org)
[![PWA](https://img.shields.io/badge/PWA-ready-purple)](https://web.dev/explore/progressive-web-apps)

> 🔰 **Privacy-first, self-hosted household budget tracker** — no cloud, no subscriptions, your data stays on your infrastructure.

---

## ✨ Features

| Feature | Description |
|---|---|
| **🏠 Multi-Household** | Share with partner/flatmates, per-entry visibility (shared vs. private) |
| **📊 Fixed Costs Dashboard** | Grouped by category, color-coded, net surplus calculation |
| **🔁 Recurring Transactions** | Monthly, quarterly, yearly, or custom intervals — computed on-the-fly (no data bloat!) |
| **📥 CSV Import (CAMT v2)** | Sparkasse CSV with fixed-cost matching, duplicate detection, learning categorization |
| **🏦 FinTS Bank Sync** | Read-only PIN/TAN sync of bookings + balances, AES-256-GCM-encrypted credentials, 4-step setup wizard, 90-day SCA reauth watcher, daily cron + manual trigger |
| **📌 Standing Orders (Daueraufträge)** | Auto-detected from FinTS bookings (MT940 GVC `158/159/164/166`, CAMT `STDO`, German free-text fallback) plus manually-created entries; bank-locked fields, frequency inference, dedicated `/app/daueraufträge` page |
| **📒 Transactions** | Unified transactions table shared by `/app/buchungen` (cashflow lens, monthly scope) and `/app/banken/:c/:a` (per-account historical lens). Search · account · source · amount filters; quick-chip shortcuts (Recurring / Income / FinTS / Manual); per-month sticky group headers with signed monthly sum |
| **📅 Monthly Budgets** | Set category budgets, track actuals vs. plan, see the delta |
| **📈 Plan vs. Actual (Month)** | Cashflow page shows per-category budget vs. actuals with a category-tinted progress meter, mono Plan / Actual amounts, signed delta and threshold-based tone (ok / warn / over) |
| **🎯 Projects** | Tile grid with circular klar-progress-ring per project tinted in project color, 3-up Budget / Spent / Balance metric-tiles on detail page, scoped transactions list, archive / edit sticky footer |
| **🧮 Scenario Calculator** | "What if my bonus is X this month?" — live calculation, nothing saved |
| **🔑 Public REST API** | API keys with scopes, rate limiting, OpenAPI docs at `/api/docs` |
| **🤖 MCP Server (OAuth 2.1)** | Claude Desktop / Cursor / Codex read, create, update & delete with per-scope user consent |
| **🔐 Authentication** | Local (email/password), OIDC (PocketID + any OIDC provider), API Keys |
| **🔐 Authentication UX** | Two-pane bundle layout: brand pane left (Fraunces 'klar genug' hero + ARGON2ID / 100% LOCAL / RS256 chips) hidden on mobile, form pane right; applied to login / register / verify-email / oauth-consent / onboarding / join / auth-callback |
| **📱 PWA — Mobile-First** | Installable on iOS/Android, dark mode, safe area support |
| **🤖 Home Assistant / n8n** | Hook up homelab automations via API keys |
| **🛡️ Row-Level Security** | PostgreSQL RLS ensures household data is always isolated |
| **🛠️ Admin Panel** | Hero status chip + 4-up metric tiles (Uptime / DB Size / Warnings / Sessions); cards for Services (per-service uptime histogram), Performance (CPU / RAM / Disk / DB-Avg / Mail-Lag / MCP-Latency progress bars), Jobs (cron schedule + last/next); existing Audit / MCP / Emails / Households tabs preserved below |
| **🔔 Notifications** | In-app bell with unread badge, polling-based feed (CONTRACT_RENEWAL, RECURRING_DUE, IMPORT_READY, BUDGET_THRESHOLD, MEMBER_INVITE, SYSTEM); per-item mark-read + bulk "mark all read" |
| **📜 Fixed Costs &amp; Contracts — Unified Detection** | One detection pipeline for CSV imports, FinTS sync, and on-demand recompute groups recurring bookings by merchant + signed amount + token signature into `FixedCost` candidates with a calibrated confidence score (`MONTHLY` / `QUARTERLY` / `HALF_YEARLY` / `YEARLY` / `CUSTOM`). Promote any FixedCost into a `Contract` extension to track cancellation deadline, holder, contract number, and provider. Page tabs: Aktiv / Verträge / Vorschläge / Beendet. Manual create + batch confirm/cancel + drawer detail. |
| **📅 Calendar** | Month grid with each day's bookings as category-colored dots and signed total in mono; click a day → drawer with the full per-day list |
| **📈 Statistics** | KPI strip (income / expense / surplus / savings rate via Fraunces metric tiles), category mix with inline progress bars in category tones, top-5 bookings of the month |
| **🪪 Session Management** | Settings/Security shows active refresh-token sessions with user-agent, hashed-IP, last-active timestamp; revoke per session or all-but-current |
| **⚙️ Settings** | Hero profile card with avatar / display name / email (verified chip) / member-since / role; SettingGroups for Security (2FA, Passkeys, OIDC), Sessions, Appearance (theme via segmented), Connected Accounts, Data (Export/Import), Danger Zone; bottom .app-info strip (Version / Build / Server / Language) |
| **🏠 Household** | Hero info card with name (Fraunces) + ID chip + role + Dissolve/Leave action; SettingGroups for Members (role-chip OWNER/MEMBER tone-mapped to success/default), Mail Templates (klar-list rows), Categories (manage tile-grid), API Keys (one-time-reveal + revoke), Danger Zone (delete) |
| **🧷 Splits** | A booking can be internally split into multiple parts (e.g. salary = base + bonus) without changing how it appears as a single row in lists |
| **✏️ Bulk action** | Multi-select transactions to bulk-move (re-categorize), bulk-delete, or bulk-pause recurring templates from one floating action bar |
| **🎨 Editorial-Technical Design** | Warm OKLCH palette (hue 35), amber accent, Fraunces (display) + Inter (body) + JetBrains Mono (data), 8 earthy category tones (sage / slate / ochre / clay / moss / mineral / plum / mocha) with 2 px left-border rails on grouped lists, italic + HYPOTHETICAL chip for scenario projections |
| **🔧 Component Spec** | Admin-only `/app/spec` page rendering every primitive (buttons × tones × solid/soft × sizes, chips, inputs, cards, setting rows, metric tiles, progress rings, confidence bars, hypo-chips, animations, type scale) |
| **📑 CRUD Demo** | Admin-only `/app/crud` page with 8 dialog patterns (Create / Detail / Edit / Delete / Move / Bulk Action / Pause / Discard Protection) |

> [!NOTE]
> 🔢 **Everything in cents.** All amounts stored as signed integers (`amountCents`). Positive = income, negative = expense. No floating point, no rounding surprises.

> [!IMPORTANT]
> 🔒 **Privacy-first by design.** Private transactions are never included in another user's aggregates — not even summaries. What's private stays private.

---

## 📚 Features in Detail

### 🔁 Fixed Costs / Recurring Transactions

Fixed costs are modeled in Klar as **`RecurringTransaction`** and are **never persisted as individual bookings** — they're computed on-the-fly for the requested month at runtime. This keeps the DB lean, avoids drift between "planned" and "actual", and makes retroactive changes trivial.

**Fields:**

| Field | Description |
|---|---|
| `name` | Plain text, e.g. "Rent", "Spotify" |
| `amountCents` | Signed int — positive = income, negative = expense |
| `frequency` | `MONTHLY`, `QUARTERLY`, `YEARLY` or `CUSTOM_INTERVAL` |
| `dayOfMonth` | Booking day — clamped to last day of month via `safeDayOfMonth()` (no Feb 31st) |
| `startDate` / `endDate` | Active range, `endDate` optional |
| `categoryId` | Category for aggregates, budgets and color coding |
| `visibility` | `SHARED` or `PRIVATE` — PRIVATE never flows into other users' aggregates |
| `isActive` | Soft-pause without deleting the record |

**Dashboard:** Grouped by category, left border in the category color, monthly equivalents via `toMonthlyEquivalent()` from `packages/shared` (quarterly/yearly → /3 or /12). Net surplus = sum of incomes + sum of expenses (mind the sign convention).

**Editing:** App-wide always via modal dialog — never inline.

---

### 📥 CSV Import (Sparkasse CAMT v2)

Marco uploads his monthly Sparkasse CSV (CAMT v2, semicolon-separated, Windows-1252, German headers) to `/app/import` and gets a **per-booking preview** showing:

- 🆕 **New** — will be created
- 🔁 **Duplicate** — `externalRef` or `externalHash` already exists, will be skipped
- 🏠 **Fixed-cost match** — belongs to a `RecurringTransaction`, **not** imported as an additional transaction
- 💡 **Recurring suggestion** — recurring payment detected, Klar suggests creating a standing order
- 🏷️ **Category suggestion** — learned from counterparty history or from existing recurrings

**Dedupe strategy (two-stage):**

1. `externalRef` from the Sparkasse CSV (end-to-end ref / mandate ref / customer ref) — unique constraint per household
2. Fallback: SHA-256 over `(date | amountCents | counterpartyNorm | purposeNorm)` — catches bookings without a reference

**Audit trail:** Every import creates a `CsvImport` record; every resulting transaction carries a `sourceImportId` — fully traceable and reversible if needed.

**Privacy:** The importer runs in the `RequestContext` of the logged-in user, RLS applies as everywhere else. PRIVATE bookings stay PRIVATE.

> [!NOTE]
> Phase 1 supports **Sparkasse CAMT v2** only. Generic column mapping, additional banks, and multi-account support are planned for later phases.

---

### 🏦 FinTS Bank Sync (read-only)

For banks that ship a FinTS PIN/TAN endpoint, Klar can pull bookings + balances **server-side**, daily, without manual CSV exports.

**Setup wizard at `/app/banken`:**

1. **Bank** — type the 8-digit BLZ; Klar resolves bank name + FinTS server URL from the bundled BLZ registry (auto-refreshed daily from `hbci4j/hbci4java`).
2. **Login** — VR-Kennung / Anmeldename + PIN. The PIN is AES-256-GCM-encrypted with a server-side master key (`FINTS_MASTER_KEY`) and never logged.
3. **TAN** — covers pushTAN, decoupled approval, mobile-TAN, photoTAN, chipTAN-QR. Empty input is the decoupled / pushTAN path; the bank's own banking app issues the prompt.
4. **Accounts** — pick which sub-accounts (checking, savings, credit card) to attach as Klar `Account` rows. Subsequent syncs walk only the picked ones.

**Sync model:**

- **Initial sync** with the user-configurable date window, defaulting to 90 days back.
- **Daily cron** at 03:00 with a 2-day overlap window to catch backdated postings — the dedup hash makes overlap safe.
- **Manual trigger** ("Sync now") — rate-limited to 1× / 5 min per connection.
- **Reauth watcher** at 08:00: 7-day pre-warning notification, plus an `ACTIVE → REAUTH_REQUIRED` flip the moment the 89-day SCA window expires.

**Lockout policy:**

Bookings imported via FinTS carry `bankFieldsLockedAt` and `source='fints'`. The transaction edit dialog renders bank-side fields (amount, date, description) read-only and hides the Delete button. The backend rejects mutations of those fields with a `BadRequestException` as a defense-in-depth safety net. Classification fields (category, project, visibility, color, icon, recurring link) stay fully editable so the user's labelling work doesn't get overwritten on the next sync.

**Encryption:**

- AES-256-GCM with `connectionId` as AAD — a cipher cannot be swapped between connections.
- Master key (`FINTS_MASTER_KEY`, 32-byte hex via `openssl rand -hex 32`) lives only in `FintsCryptoService`; Pino redaction blocks it from logs.
- Plaintext PIN exists only inside the encrypt/decrypt boundary and is zeroed in the request handler immediately after sealing.
- Connection deletion overwrites the cipher columns with random bytes before the row delete so a backup-restore cannot resurrect the PIN.
- Connection deletion **cascades** to the linked FinTS accounts and their imported transactions and standing orders. The confirmation dialog renders the concrete impact (e.g. "3 accounts, 412 transactions, 18 standing orders") fetched from `GET /fints/connections/:id/delete-impact`. CSV-only and manual accounts that share the household are left untouched.

**Privacy & ownership:**

- A FinTS connection belongs to the user who set it up. Other household members can see status (active / reauth-required / etc.) but cannot edit credentials, submit TANs, or delete the connection.
- The resulting `Account` is household-shared by default; the wizard's per-account `Private` toggle scopes it to the owner.
- Per-account **rename** and **sync toggle** are exposed via the pencil button on each row in `/app/banken`. Renaming or pausing sync is restricted to the FinTS owner (API rejects others with `403`). Sync-disabled accounts keep their imported history but are silently skipped on every subsequent sync run; they appear muted with a small pause icon next to the name.

**Backup note (operations):**

The `FINTS_MASTER_KEY` is required to decrypt persisted credentials. Back it up **separately** from the database — without it, all stored connections become unrecoverable and users will need to re-enter PINs.

---

### 📌 Standing Orders

The Standing Orders page (`/app/daueraufträge`) lists recurring bank
payment instructions for a household. Two record sources live in the
same `StandingOrder` table:

- **`FINTS_DERIVED`** — detected automatically at the end of every FinTS
  sync. The import pipeline classifies each booking with a
  `transactionKind` based on MT940 GVC (`158/159/164/166`), CAMT
  `BkTxCd` SubFamily (`STDO`), or a `Dauerauftr-` prefix in the free-text
  fallback. The detection service then groups all `STANDING_ORDER`-kind
  transactions by `(lowercased counterparty, signed amountCents)`, infers
  the cadence from gaps between consecutive booking dates (WEEKLY /
  MONTHLY / QUARTERLY / HALF_YEARLY / YEARLY / CUSTOM tolerance windows),
  and idempotently upserts a record per group via
  `@@unique(householdId, accountId, groupKey)`.
- **`MANUAL`** — user-created entries via the page's "+ Manual Entry"
  dialog, for standing orders the bank does not surface (private-party
  payments, cash standing orders). Manual records prefix their groupKey
  with `manual:` plus a timestamp suffix to never collide with bank-derived
  upserts.

**Bank is the source of truth:** for `FINTS_DERIVED` records, the bank fields
(`counterpartyName`, `counterpartyIban`, `amountCents`, `frequency`,
`nextExpectedAt`) are locked — only `categoryId`, `note`, and `isActive`
remain user-editable. The API rejects bank-field updates with
`BadRequestException`, and the dialog renders those inputs disabled with a
lock affordance. Deletion of FinTS-derived records is rejected too — use
`isActive: false` instead, otherwise the record returns on the next sync.

**Privacy / security:** the table is household-scoped; cross-household
access is rejected by `HouseholdMemberGuard` with a `NotFoundException`
(no information leak). No bank credentials are stored on the
standing-order rows — those live encrypted on `FintsConnection` only.

---

### 📒 Transactions — Unified table

The transactions table (`<klar-transactions-table>`) is shared by `/app/buchungen`
(month-scoped cashflow lens) and `/app/banken/:c/:a` (historical per-account lens).
Both routes use the same filter bar (search · account · source · amount), quick-chip
shortcuts, and per-month sticky-header grouping.

- **Cashflow lens** (`/app/buchungen`) — defaults to the current month from the
  page header scope segment. Add button creates an unscoped transaction.
- **Account lens** (`/app/banken/:connectionId/:accountId`) — loads all
  transactions for the account, regardless of month. The account filter is
  locked (no reset). Add button prefills `accountId`. FinTS-imported rows keep
  their bank-field lockout (14a.8); manual fields like category and notes are
  editable everywhere.

Implementation lives at `apps/web/src/app/shared/transactions/`. Pure helpers
(`transaction-filters.ts`, `transaction-month-grouping.ts`) are unit-tested in
isolation; the row, quick-chips, filter-bar, and table-container components are
assembled on top. `TransactionsStore.accountIdFilter` switches the store loader
from month-scoped to account-historical mode without duplicating HTTP code.

---

### 🤖 MCP Server (OAuth 2.1)

Klar exposes its data via the [Model Context Protocol](https://modelcontextprotocol.io) — LLM clients (Claude Desktop, Cursor, Continue, Codex) can **read, create, update, and delete** transactions, categories, projects, budgets, and fixed costs after explicit user consent.

**Architecture:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Klar API (NestJS + Fastify)                                     │
│                                                                  │
│  Authorization Server                Resource Server             │
│  ├─ /.well-known/oauth-…             ├─ /mcp (Streamable HTTP)   │
│  ├─ /oauth2/register (RFC 7591)      └─ Tools (read + write +    │
│  ├─ /oauth2/authorize                  update + delete)          │
│  ├─ /oauth2/token                                                │
│  └─ /oauth2/revoke (RFC 7009)        Bearer guard verifies       │
│                                      JWT (aud=klar-mcp)          │
└──────────────────────────────────────────────────────────────────┘
```

- **Auth:** OAuth 2.1 Authorization Code + PKCE (S256) + Dynamic Client Registration (RFC 7591)
- **Token:** JWT RS256, dedicated key pair separate from the Klar session JWT, audience `klar-mcp`
- **Transport:** Streamable HTTP (`@modelcontextprotocol/sdk`)
- **Per-user security:** Each token binds user + household. Tools use the existing Klar services — same `Visibility` model as the web app: members see all `SHARED` items in the household plus their own `PRIVATE` items. The OWNER role does **not** grant additional read access (it's only for admin actions).

**Scopes (granular, revocable any time):**

| Scope | Description |
|---|---|
| `klar:transactions:read` / `:write` | Read / create / update / delete transactions |
| `klar:recurring:read` / `:write` | Read / create / update / delete fixed costs |
| `klar:categories:read` / `:write` | Read / create / update / delete (or archive) categories |
| `klar:projects:read` / `:write` | Read / create / update / delete projects |
| `klar:budgets:read` / `:write` | Read / set / delete budgets |
| `klar:overview:read` | Aggregated monthly overview |
| `klar:household:read` | Basic household info |

Tools whose scope is not contained in the issued token are **invisible** to the LLM.

**Tools at a glance** — 17 total: `list_transactions`, `list_recurring`, `list_categories`, `list_projects`, `list_budgets`, `get_overview`, `get_household_info`, `create_transaction` / `update_transaction` / `delete_transaction`, `create_recurring` / `update_recurring` / `delete_recurring`, `create_category` / `update_category` / `delete_category`, `create_project` / `update_project` / `delete_project`, `set_budget` / `delete_budget`.

**Setup with Claude Desktop / Cursor / Codex** — they speak stdio natively, so we use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) as a stdio↔HTTP bridge that handles the OAuth dance:

```json
{
  "mcpServers": {
    "klar": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-klar-instance.com/mcp"
      ]
    }
  }
}
```

On first tool call: `mcp-remote` discovers the OAuth metadata, registers a client via DCR, opens the browser to the Klar consent page — the user clicks **Authorize**, the bridge exchanges the code for an access token. Revoke any time under **Settings → Connected Apps**.

**Connected Apps management:** All authorized OAuth clients are listed under **Settings → Connected Apps** with their effective name, granted scopes (write scopes highlighted), connection date, and last-used timestamp. Each app can be:
- **Renamed** — `mcp-remote` registers itself everywhere as "MCP CLI Proxy", so Klar auto-detects the actual LLM client from the MCP `clientInfo.name` (e.g. `"claude-ai (via mcp-remote 0.1.37)"`) and uses that as the display name. Users can override the name manually (pencil icon) and reset to the original any time.
- **Revoked** — terminates the grant; the next MCP call gets `401 invalid_token` immediately (the bearer guard checks grant status on every request, not just at token expiry).

**Security highlights:**

- PKCE-S256 mandatory, `plain` rejected
- Authorization codes are single-use — replay triggers cascade revocation of all grants for that client
- Rotating refresh tokens (every refresh issues a new one, the old one is revoked)
- Bearer guard checks grant status in the DB → revocation takes effect immediately, not only after token expiry
- Token fields included in Pino redaction (no plaintext in logs)
- Rate limits: `/oauth2/register` 5/h/IP, `/oauth2/token` 30/min, `/mcp` 600/min/user
- Cleanup job (every 15 min) deletes expired auth codes and grants revoked > 90 days ago

Full documentation including curl smoke test and configuration: **[docs/mcp.md](docs/mcp.md)**.

### 🛠️ Admin Panel

Available to users with `appRole = ADMIN` (the first registered user, or anyone elevated via the role-change flow). Routed at `/app/admin`. The page opens with a self-host hero (instance hostname + overall status chip), a 4-up metric grid (Uptime · 30 d, DB Size, Warnings · 24 h, Active Sessions), and three telemetry cards — Services, Performance, Jobs — that poll `/admin/health/*` and `/admin/jobs` every 30 s. Below those, all four tabs use a virtualized `klar-virtual-list` so they remain responsive even with millions of rows; every list is **searchable + filterable**, paginated with a stable `(createdAt DESC, id DESC)` cursor, and resolves user / household IDs to names + avatars + emails before display.

**Telemetry endpoints** (admin-only, throttled 30/min):

| Endpoint | Returns |
|---|---|
| `GET /admin/health/status` | uptime %, Postgres DB size, warning count (last 24 h), active refresh-token sessions |
| `GET /admin/health/services` | per-service state (Web-App, API, Postgres 16, MCP Bridge, Mail-Queue) + 30-bar uptime histogram |
| `GET /admin/health/performance` | CPU, RAM, Disk, DB-Query-Ø, Mail-Lag, MCP-Latency rows with progress bar percentage and `ok`/`warn` state |
| `GET /admin/jobs` | scheduled background jobs (cron expression, last/next run, state) |

Each endpoint sits behind `JwtAuthGuard + AppAdminGuard`; non-admin requests return 403, anonymous requests 401. Postgres health is probed via `SELECT 1`, MCP via the most recent `mcp.*` audit-log row in the last hour, mail-queue via the last five `EmailLog` entries.

| Tab | Purpose | Filters |
|---|---|---|
| **Audit Log** | Every system event (`user.login`, `oidc.link`, `apikey.used`, `mcp.tool.*`, `mcp.session.start`, …) | free-text on action · action prefix · user-ID · household-ID |
| **MCP** | Per-tool-call audit for the MCP server — one row per tool invocation | free-text · tool name · client-ID · OK/Fail · user · household |
| **Emails** | All sent emails (success + failed) | free-text on `to`/`subject` · status (SENT/FAILED) · template |
| **Households** | Households + members with avatars and roles | free-text on name / member email |

**MCP audit details** — for every MCP tool invocation Klar records:

- `action`: `mcp.tool.<toolName>` (e.g. `mcp.tool.transactions.list`)
- `userId`, `householdId`, `ip`, `userAgent`
- `metadata.toolName`, `metadata.clientId`, `metadata.durationMs`, `metadata.ok`
- `metadata.errorCode` (only on failure)
- `metadata.argsHash` — **SHA-256 hash** of the JSON-serialized args, never the raw values

> [!IMPORTANT]
> 🔒 **Args are never stored in plaintext.** Amounts, category names, search queries, and date ranges can be sensitive — only a deterministic hash is persisted so admins can correlate calls with identical inputs without exposing the inputs themselves.

In addition, each MCP `initialize` request emits a single `mcp.session.start` row with `clientName`, `clientVersion`, and `protocolVersion` so admins can spot new clients connecting to the instance.

The `OAuthClient.displayName` is resolved at read time, so renaming a connected app under **Settings → Connected Apps** is reflected retroactively in the MCP tab.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22 LTS |
| **Package Manager** | pnpm 10 + Turborepo |
| **Backend** | NestJS 11 + Fastify 5 |
| **Frontend** | Angular 21 (Zoneless, Signal Forms) |
| **Styling** | Tailwind CSS 4 + Dark Mode |
| **UI Primitives** | Spartan UI (helm wrappers in `apps/web/src/app/shared/ui/hlm/`) — input, select, button, label, calendar, checkbox, dialog, toggle-group, switch, tabs, tooltip, sheet, alert-dialog, separator |
| **UI Composites** | Klar (`apps/web/src/app/shared/ui/`) — async-state, money-input, date-input, dialog-footer, action-tile, switch, confirm-dialog/service, list, virtual-list, combobox, color-picker, etc. |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma |
| **Auth** | Local + OIDC (Passport) + API Keys |
| **Crypto** | Argon2id (passwords + API keys) |
| **JWT** | RS256 key pair |
| **Dates** | Temporal API (native, no library) |
| **Validation** | Zod (shared) + class-validator (NestJS) |
| **Tests** | Vitest + Supertest + Playwright |
| **CI/CD** | GitHub Actions |
| **Deploy** | Docker Compose + Traefik |
| **PWA** | @angular/pwa + iOS meta-tags |
| **Design System** | Klar Design Pearl: Fraunces (display) + Inter (body) + JetBrains Mono (data), warm OKLCH palette, amber accent, 8 earthy category tones, 2 px left-border rails on grouped lists |

---

## 🆕 Design Pearl additions

The following user-facing modules ship with the editorial-technical refresh and live alongside the existing pages.

### 🔔 Notifications

In-app notification feed (`Notification` model + `NotificationKind` enum: `CONTRACT_RENEWAL`, `CONTRACT_PRICE_CHANGE`, `RECURRING_DUE`, `IMPORT_READY`, `BUDGET_THRESHOLD`, `MEMBER_INVITE`, `SYSTEM`). The bell in the page header lights up with an amber glow when there are unread items; the popover (animated via `klar-pop`) groups by date, marks read on click, and supports bulk "Mark all read" plus per-item delete. The store polls every 60 seconds; mutations always reload to reconcile against the authoritative server state.

**Privacy:** notifications are scoped to the household and optionally to a single user (`userId IS NULL` = household-wide). Only the household's members can read them.

### 📜 Fixed Costs &amp; Contracts — Unified Detection

**Concept.** Every recurring booking is a `FixedCost` (cycle: `MONTHLY` / `QUARTERLY` / `HALF_YEARLY` / `YEARLY` / `CUSTOM`, status: `CANDIDATE` / `DETECTED` / `CONFIRMED` / `CANCELLED`, source: `AUTO_DETECTED` / `USER_DEFINED`). A `Contract` is a 1:1 extension on top of a FixedCost that adds vertragsspezifische Felder (cancellation deadline, contract holder, contract number, provider, document URL, notes). Every Contract IS a FixedCost; not every FixedCost is a Contract.

**Detection pipeline.** A single pure algorithm in `packages/shared/src/detection/detect-fixed-costs.ts` is the only source of truth for fixed-cost detection. It runs:

1. After every CSV import confirm step (in `csv-import.service.ts`)
2. After every successful FinTS sync (in `fints-sync.service.ts`, once per touched household)
3. On the manual `POST /h/:hid/fixed-costs/recompute` endpoint

The algorithm normalizes each transaction to `(merchantKey, sign, tokens)`, coarse-clusters by `(merchantKey, sign)`, then sub-clusters by **token signature** so distinct services sharing one merchant (Vodafone Internet vs. Vodafone Handy) end up in different buckets while a single variable-amount bill (Strom-Abschlag) stays together. Frequency windows live in `frequency-windows.ts` and are also consumed by standing-order detection (one source of truth across the whole app).

**Confidence formula.**

```
repetition_score = clamp((n - 1) / 3, 0, 1)
amount_stability = clamp(1 - relative_amount_stdev, 0, 1)
confidence       = 0.6 × repetition_score + 0.4 × amount_stability
```

Three identical bookings at a stable cadence yield ≈ 0.80; four ≈ 0.95. (The previous formula `(n-2)/4` capped 3-occurrence contracts at 0.55, which felt unfairly pessimistic.)

**UX.** The page `/app/vertraege` is now "Erkannte Fixkosten" with four tabs: **Aktiv** (all active FixedCosts), **Verträge** (subset with Contract extension), **Vorschläge** (CANDIDATE rows the user hasn't reviewed), **Beendet**. Per-row checkboxes drive a bulk-action bar (batch confirm / batch cancel). The detail drawer offers Confirm / Cancel / Delete plus **"Als Vertrag markieren"** (promote) and **"Vertrags-Markierung entfernen"** (demote). A `+ Hinzufügen` button opens the manual-create dialog; `Erneut scannen` triggers the same pipeline that runs after imports.

**Privacy &amp; idempotency.** `recomputeForHousehold` only replaces `CANDIDATE` rows with `source = AUTO_DETECTED`. User-curated rows (CONFIRMED / DETECTED / CANCELLED) and all `USER_DEFINED` rows are preserved. Re-running the detection always converges on the same candidate set for the same transaction history.

### 📅 Calendar

`/app/kalender` renders a Monday-based 7-column month grid bound to the existing `TransactionsStore`. Each cell shows up to 3 distinct category-colored dots, the day's signed total in mono, and (for the current day) an `--accent` outline. Clicking a day opens a drawer with the day's bookings rendered with `cat-bar` rails in the per-transaction category color. Recurring entries continue to be expanded on the fly — nothing is persisted just for the calendar view.

### 📈 Plan vs. Actual (Cashflow Month)

The Cashflow page (`/app/monat`) renders a per-category **Plan vs. Actual** card directly under the surplus hero, computed by a new aggregation endpoint `GET /api/v1/households/:hid/overview/budgets-vs-actuals?month=YYYY-MM`. Plan is taken from the stored `Budget` rows (positive cents) and signed at read-time according to the category type (expense → negative, income → positive). Actual is the sum of every realized transaction in the requested month plus every active recurring transaction expanded to its monthly equivalent (via the shared `toMonthlyEquivalent` helper) — PRIVATE entries owned by other users are filtered out before aggregation, so privacy guarantees match the rest of the overview surface.

The pure shaping function lives in `@klar/shared` (`budgetsVsActuals` in `packages/shared/src/budgets/budgets-vs-actuals.ts`) and emits one row per budgeted category with a clamped meter ratio (`pct = min(1.2, |actual| / |plan|)`) and a tone state (`ok` ≤ 90 %, `warn` 90-100 %, `over` > 100 %). The web UI uses that ratio to fill a thin meter tinted in the category color, prints both Plan and Actual mono with `tabular-nums`, and shows the signed delta in `text-(--success)` / `text-(--warn)` / `text-(--danger)` depending on the state.

### 📈 Statistics

`/app/statistik` derives a KPI strip (Income / Expenses / Surplus / Savings Rate) from `OverviewStore` plus a category-mix card (top-down list with inline 80 px progress bar tinted in the category color) and a top-movers card (top 5 bookings of the current month by absolute amount). A multi-month trend, weekday heatmap, and recurring-spend breakdown will land once the dedicated Statistics-API ships — the page is intentionally kept lean so it always reflects what the existing aggregations can answer.

### 🪪 Session Management

`RefreshToken` extended with `userAgent`, `ipHash` (sha256 of the IP + secret — plain IP never leaves the server) and `lastActiveAt` (bumped on every refresh-token rotation). New endpoints `GET /me/sessions` and `DELETE /me/sessions/:id` power the Settings/Security page so users can audit and revoke their own sessions individually. The user only ever sees the IP hash, never the plain address.

### 🧷 Transaction Splits

A single `Transaction` can carry one or more `TransactionSplit` rows (still cascade-deleted with the parent), enabling the salary-as-(base + bonus) pattern surfaced by the CSV import without changing how the booking appears as one row in lists. Splits are visible in the booking detail dialog only.

### ✏️ Bulk Actions

`POST /h/:hid/transactions/bulk-move`, `DELETE /h/:hid/transactions/bulk`, and `POST /h/:hid/recurring-transactions/bulk-pause` bring multi-select to lists. The web UI surfaces a floating action bar that appears while items are selected; the server filters every id through the same PRIVATE-only-by-creator authorization used for single-row writes so a member can never accidentally bulk-mutate someone else's PRIVATE entries.

### 🔌 Connected Apps

`ConnectedApp` model (`provider`, `externalId`, `scopes[]`, `lastUsedAt`) lets the Settings page show a per-user list of OIDC linkages (PocketID / GitHub / Google / claude.ai / …) with edit + unlink. Endpoints scoped to the user (`/me/connected-apps`, behind `JwtAuthGuard`).

### 🏠 Household

`/app/haushalt` opens with a tight bundle `.profile-card` hero — household name in Fraunces (24 px, -0.02 em tracking), short ID rendered as a `.chip.outline.mono` next to it, member count + role line, and a quick-action row (Rename for owners; Dissolve if you're the sole owner, Leave otherwise). The page-header gains a static `HH` rhsChip plus, for owners, a `+ Invite` action that opens the invite dialog. Below the hero, every section uses the bundle `.setting-group` pattern (eyebrow head + `.setting-card`): My Households switcher (when you belong to more than one), Members with role chips tone-mapped to `.chip.success` (OWNER) / default `.chip` (MEMBER) and trash trailing-action for invite cleanup, Invitations, Mail Templates, Category Manager (tile grid with category-color rail; `klar-select` searchable+addable upgrade is deferred to Household-2), API Keys with one-time reveal banner + scope checkboxes + warn chip on revoked keys, and finally a `.danger-zone` modifier wrapping the formal delete/leave block.

### 🛠️ Mode Toolbar (mockup helper)

A sticky top-center pill flips the shell live between Desktop and Mobile preview widths (`html.mode-mobile-preview` clamps to ≤ 390 px) and toggles the warm OKLCH palette between dark and light. Built in for designers to review the editorial-technical theme without leaving the running app — no special build mode needed.

---

## 📦 Prerequisites

- **Docker** + **Docker Compose** — for the database (and production deployment)
- **Node.js 22 LTS** — for local development
- **pnpm 10** — `npm install -g pnpm@10`

---

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone https://github.com/Disane87/klar.git
cd klar
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values (DATABASE_URL etc. are pre-filled for local dev)
```

### 3. Generate JWT keys (one-time setup)

```bash
pnpm --filter @klar/api keys:generate
pnpm --filter @klar/api exec tsx scripts/generate-mcp-keys.ts   # only if you want MCP/OAuth
```

The first command creates the 4096-bit RS256 key pair for the **session JWT** in `apps/api/keys/`. The second creates a separate key pair for **MCP access tokens** (LLM clients) — skip it if you don't plan to use the MCP integration. Keep all `*private*.pem` files safe! 🔐

### 4. Start the database

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

### 5. Run database migrations

```bash
pnpm --filter @klar/api prisma:migrate
pnpm --filter @klar/api prisma:seed   # optional demo data
```

### 6. Start everything

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000/api/v1 |
| API Docs (Swagger) | http://localhost:3000/api/docs |
| Health Check | http://localhost:3000/health |
| Prisma Studio | `pnpm --filter @klar/api prisma:studio` → http://localhost:5555 |

> [!NOTE]
> 🧑‍💼 **First registered user becomes admin** — registration is open by default. Set `REGISTRATION_ENABLED=false` in your `.env` to close it after your first user.

---

## 🐳 Production Deployment

```bash
# Build all images
docker compose -f docker/docker-compose.prod.yml build

# Start the stack (Postgres + API + Web + Traefik)
docker compose -f docker/docker-compose.prod.yml up -d
```

> [!IMPORTANT]
> Make sure to set strong values for `POSTGRES_PASSWORD`, and keep your `JWT_PRIVATE_KEY_PATH` outside the container (use a Docker secret or a mounted volume).

---

## ⚙️ Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in your values.

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://klar:klar@localhost:5432/klar` | Primary database |
| `DATABASE_TEST_URL` | `postgresql://klar:klar@localhost:5432/klar_test` | Test database |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `JWT_PRIVATE_KEY_PATH` | `keys/private.pem` | RS256 private key (generate with `keys:generate`) |
| `JWT_PUBLIC_KEY_PATH` | `keys/public.pem` | RS256 public key |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token TTL |
### Application

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | `development` or `production` |
| `REGISTRATION_ENABLED` | `true` | Allow new user registration |
| `APP_URL` | `http://localhost:3000` | Used in e-mails and OIDC callbacks |
| `FRONTEND_URL` | `http://localhost:4200` | CORS origin |

### FinTS

| Variable | Default | Description |
|---|---|---|
| `FINTS_MASTER_KEY` | _empty_ | 32-byte hex (`openssl rand -hex 32`) for AES-256-GCM credential sealing. Boot warns when missing; FinTS encrypt/decrypt then throws on first use. **Back up separately from the DB** — without it, all stored bank connections are unrecoverable. |
| `FINTS_SCA_WINDOW_DAYS` | `89` | PSD2 reauth window. The watcher pre-warns 7 days before this expires. |
| `FINTS_BLZ_SOURCES` | `https://raw.githubusercontent.com/hbci4j/hbci4java/master/src/main/resources/blz.properties` | Comma-separated list of upstream URLs for the BLZ → FinTS-server-URL registry. The first source that returns a payload with ≥1000 records wins. |
| `FINTS_PRODUCT_ID` | `klar-dev` | ZKA product registration ID. Sparkasse, VR-Banken and several others reject unregistered IDs with bank-code **9078** — register your own ID at [hbci-zka.de/register/prod_register.htm](https://www.hbci-zka.de/register/prod_register.htm) and set it here. The container reads this from the environment (see `docker/docker-compose.prod.yml` — `FINTS_*` are wired through). |
| `FINTS_PRODUCT_VERSION` | `0.1` | ZKA product version that pairs with `FINTS_PRODUCT_ID`. |

### Mail

| Variable | Default | Description |
|---|---|---|
| `MAIL_HOST` | `localhost` | SMTP server hostname |
| `MAIL_PORT` | `1025` | SMTP port — `465` (SMTPS), `587` (STARTTLS), `1025` (MailDev) |
| `MAIL_SECURE` | `false` | `true` = TLS on connect (port 465); `false` = plain / STARTTLS |
| `MAIL_USER` | _(empty)_ | SMTP username — leave empty for MailDev (no auth required) |
| `MAIL_PASS` | _(empty)_ | SMTP password — leave empty for MailDev |
| `MAIL_FROM` | `noreply@klar.app` | Sender address |
| `MAIL_FROM_NAME` | `Klar` | Sender display name |

> [!TIP]
> **Local dev:** MailDev runs via `docker-compose.dev.yml` on port 1025 (no auth needed). Open the inbox at **http://localhost:1080**.
> **Production:** Use any SMTP provider — [Resend](https://resend.com), [Postmark](https://postmarkapp.com), or your own server. Set `MAIL_SECURE=true` + `MAIL_PORT=465` for SMTPS, or `MAIL_SECURE=false` + `MAIL_PORT=587` for STARTTLS.

### OIDC / SSO

| Variable | Default | Description |
|---|---|---|
| `OIDC_ENABLED` | `false` | Set to `true` to enable OIDC login |
| `OIDC_PROVIDER_NAME` | `sso` | Display name on the login button |
| `OIDC_ISSUER_URL` | — | Your OIDC provider URL (e.g. `https://pocketid.example.com`) |
| `OIDC_CLIENT_ID` | — | Client ID from your OIDC provider |
| `OIDC_CLIENT_SECRET` | — | Client secret from your OIDC provider |
| `OIDC_REDIRECT_URI` | `…/auth/oidc/callback` | Must be registered as redirect URI in your provider |
| `OIDC_SCOPES` | `openid email profile` | Space-separated scopes |
| `OIDC_REQUIRED_GROUP` | _(empty)_ | Only members of this group may log in |
| `OIDC_ADMIN_GROUP` | _(empty)_ | Members of this group automatically get the app-admin role |
| `OIDC_AUTO_JOIN_HOUSEHOLD_ID` | _(empty)_ | New OIDC users are auto-joined to this household |

### MCP / OAuth 2.1

| Variable | Default | Description |
|---|---|---|
| `APP_BASE_URL` | `http://localhost:3000` | Public URL of the API — used as `iss` claim and in OAuth metadata |
| `JWT_MCP_PRIVATE_KEY_PATH` | `keys/mcp.private.pem` | RS256 private key for MCP access tokens (separate from session JWT) |
| `JWT_MCP_PUBLIC_KEY_PATH` | `keys/mcp.public.pem` | RS256 public key (used by the bearer guard) |
| `JWT_MCP_AUDIENCE` | `klar-mcp` | Expected `aud` claim — must match between issuer and resource server |
| `OAUTH_AUTH_CODE_TTL_SECONDS` | `60` | Single-use authorization-code lifetime |
| `OAUTH_ACCESS_TOKEN_TTL_SECONDS` | `3600` | Access-token lifetime (1h) |
| `OAUTH_REFRESH_TOKEN_TTL_SECONDS` | `2592000` | Refresh-token lifetime (30d, rotating) |
| `OAUTH_REGISTRATION_OPEN` | `true` | Kill-switch for Dynamic Client Registration |
| `OAUTH_REGISTRATION_RATE_LIMIT_PER_HOUR` | `5` | Rate limit on `/oauth2/register` per IP |

> [!TIP]
> Generate the MCP key pair once with `pnpm --filter @klar/api exec tsx scripts/generate-mcp-keys.ts`. Like the session JWT keys, these go to `apps/api/keys/` (gitignored).

---

## 🔑 Public REST API

Klar exposes a public REST API under `/api/public/v1/` for external tools.

```bash
curl -H "Authorization: Bearer bgb_live_your_api_key_here" \
  https://your-klar-instance.com/api/public/v1/households/overview
```

### API Key Scopes

| Scope | What it allows |
|---|---|
| `overview:read` | Read monthly overview + fixed costs |
| `transactions:read` | Read transactions |
| `transactions:write` | Create/update/delete transactions |
| `budgets:read` | Read budget status |

> [!NOTE]
> 🏠 **Home Assistant idea:** Use `overview:read` to pull your monthly surplus into a sensor, trigger automations when you exceed your budget. 📊

Full API reference: **`/api/docs`** (Swagger UI, auto-generated from OpenAPI spec)

---

## 🔐 OIDC / SSO Login

Klar supports OIDC for single sign-on — perfect if you run PocketID or any other OIDC provider in your homelab.

1. Register a client in your OIDC provider
2. Set `OIDC_*` variables in your `.env`
3. Users can link their existing Klar account to their OIDC identity — or log in directly with SSO

**Account linking rules:**
- OIDC only links when `email_verified === true` from the provider
- You can't remove a password if you have no OIDC identity (and vice versa) — no lockout possible

---

## 🧪 Development

```bash
# Run all unit tests
pnpm test

# Run integration tests (requires test DB)
pnpm test:integration

# Run e2e tests (Playwright)
pnpm --filter @klar/web e2e

# Build all packages
pnpm build

# Lint
pnpm lint

# Open Prisma Studio
pnpm --filter @klar/api prisma:studio

# Tear down dev DB
docker compose -f docker/docker-compose.dev.yml down
```

### Coverage Thresholds

| Package | Threshold |
|---|---|
| `@klar/api` | 80% lines |
| `@klar/web` | 70% lines |

> [!IMPORTANT]
> **TDD is enforced:** Red → Green → Refactor. Every feature ships with tests.

---

## 📁 Project Structure

```
/apps
  /api          — NestJS 11 backend (Fastify, Pino, Prisma, Passport)
  /web          — Angular 21 frontend (Zoneless, Signal Forms, Tailwind 4, PWA)
/packages
  /shared       — Zod schemas, TypeScript types, shared calculation functions
  /shared-frontend — ResourceStore<T>, ApiClient, HTTP interceptors
/prisma
  schema.prisma — Single source of truth for the data model
  migrations/
/docker
  docker-compose.dev.yml  — Postgres only (apps run locally)
  docker-compose.prod.yml — Full stack (Postgres + API + Web + Traefik)
/.github
  workflows/ci.yml        — Lint + test + build on push/PR
```

> [!NOTE]
> 💡 **Shared calculation functions** (`safeDayOfMonth`, `toMonthlyEquivalent`, `sumByCents`, `calculateMonthlyOverview`) live in `packages/shared` — imported by both API and frontend, no duplication, no drift.

---

## 🤝 Contributing

Want to help make Klar better? Awesome! 🎉

- 🌿 Work on feature branches, PRs go to `main`
- 💬 Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:` etc.)
- 🧪 TDD is required — write the failing test first
- 📋 Check `SPEC.md` before implementing — it's the source of truth
- 🏗️ Check `CLAUDE.md` for architecture rules and hard constraints

### Hard Rules (non-negotiable)

| Rule | Description |
|---|---|
| `amountCents: Int` | Never a float, always signed |
| `householdId` | Never from request body — always from URL param or API key |
| Recurring transactions | Never persisted — computed on-the-fly |
| CSS | `100dvh` not `100vh` (iOS Safari bug) |
| Font size | ≥ 16px on all form inputs (iOS auto-zoom prevention) |
| Form controls | Native `<input>`/`<select>`/`<textarea>` must use the `hlm*` directive — enforced by `scripts/ui-hygiene-check.sh` (CI gate) |
| Browser dialogs | No `window.alert` / `window.prompt` / `window.confirm` — use `klar-toast` and `klar-confirm.service` |
| `localStorage` | Whitelisted to theme, version-seen, install-prompt only — see CLAUDE.md |

---

## 📄 License

MIT — see [LICENSE](https://github.com/Disane87/klar/blob/main/LICENSE) for details.

---

## 🙏 Thanks

If Klar is useful for you, give it a ⭐ on GitHub — it really helps! 🙌
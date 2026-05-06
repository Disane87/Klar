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
| **📅 Monthly Budgets** | Set category budgets, track actuals vs. plan, see the delta |
| **🎯 Project Tracking** | Assign transactions to projects, track budget vs. actual vs. remaining |
| **🧮 Scenario Calculator** | "What if my bonus is X this month?" — live calculation, nothing saved |
| **🔑 Public REST API** | API keys with scopes, rate limiting, OpenAPI docs at `/api/docs` |
| **🤖 MCP Server (OAuth 2.1)** | Claude Desktop / Cursor / Codex read, create, update & delete with per-scope user consent |
| **🔐 Authentication** | Local (email/password), OIDC (PocketID + any OIDC provider), API Keys |
| **📱 PWA — Mobile-First** | Installable on iOS/Android, dark mode, safe area support |
| **🤖 Home Assistant / n8n** | Hook up homelab automations via API keys |
| **🛡️ Row-Level Security** | PostgreSQL RLS ensures household data is always isolated |
| **🛠️ Admin Panel** | Audit log, MCP tool-call audit, sent emails, household overview — all virtualized + searchable + filterable |

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

Available to users with `appRole = ADMIN` (the first registered user, or anyone elevated via the role-change flow). Routed at `/app/admin`. All four tabs use a virtualized `klar-virtual-list` so they remain responsive even with millions of rows; every list is **searchable + filterable**, paginated with a stable `(createdAt DESC, id DESC)` cursor, and resolves user / household IDs to names + avatars + emails before display.

| Tab | Purpose | Filters |
|---|---|---|
| **Audit Log** | Every system event (`user.login`, `oidc.link`, `apikey.used`, `mcp.tool.*`, `mcp.session.start`, …) | free-text on action · action prefix · user-ID · household-ID |
| **MCP** | Per-tool-call audit for the MCP server — one row per tool invocation | free-text · tool name · client-ID · OK/Fail · user · household |
| **E-Mails** | All sent emails (success + failed) | free-text on `to`/`subject` · status (SENT/FAILED) · template |
| **Haushalte** | Households + members with avatars and roles | free-text on name / member email |

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

---

## 📄 License

MIT — see [LICENSE](https://github.com/Disane87/klar/blob/main/LICENSE) for details.

---

## 🙏 Thanks

If Klar is useful for you, give it a ⭐ on GitHub — it really helps! 🙌
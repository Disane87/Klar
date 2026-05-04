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
| **📅 Monthly Budgets** | Set category budgets, track actuals vs. plan, see the delta |
| **🎯 Project Tracking** | Assign transactions to projects, track budget vs. actual vs. remaining |
| **🧮 Scenario Calculator** | "What if my bonus is X this month?" — live calculation, nothing saved |
| **🔑 Public REST API** | API keys with scopes, rate limiting, OpenAPI docs at `/api/docs` |
| **🔐 Authentication** | Local (email/password), OIDC (PocketID + any OIDC provider), API Keys |
| **📱 PWA — Mobile-First** | Installable on iOS/Android, dark mode, safe area support |
| **🤖 Home Assistant / n8n** | Hook up homelab automations via API keys |
| **🛡️ Row-Level Security** | PostgreSQL RLS ensures household data is always isolated |

> [!NOTE]
> 🔢 **Everything in cents.** All amounts stored as signed integers (`amountCents`). Positive = income, negative = expense. No floating point, no rounding surprises.

> [!IMPORTANT]
> 🔒 **Privacy-first by design.** Private transactions are never included in another user's aggregates — not even summaries. What's private stays private.

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
```

This creates a 4096-bit RS256 key pair in `apps/api/keys/`. Keep `private.pem` safe! 🔐

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
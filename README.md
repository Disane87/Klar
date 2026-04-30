[![CI](https://github.com/Disane87/denaro/actions/workflows/ci.yml/badge.svg)](https://github.com/Disane87/denaro/actions/workflows/ci.yml)
![License](https://img.shields.io/github/license/Disane87/denaro)
![Node](https://img.shields.io/badge/node-22_LTS-brightgreen)
![Angular](https://img.shields.io/badge/Angular-21-red)
![NestJS](https://img.shields.io/badge/NestJS-11-red)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![PWA](https://img.shields.io/badge/PWA-ready-purple)

# 💶 Klar — Self-Hosted Budget Tracker

Hey there! 👋 **Klar** is a privacy-first, self-hosted household budget tracker for individuals and couples/flatmates. No cloud vendor, no subscriptions — your data stays on your own infrastructure. 🏠

Three core tools in one app:

1. **📊 Fixed Costs Overview** — see your monthly surplus at a glance
2. **📅 Monthly Cashflow** — track variable spending against category budgets
3. **🎯 Project Tracking** — manage goal-based costs (renovation, wedding, vacation)

Plus a **public REST API** for your own tools — Home Assistant, n8n, scripts, whatever you build. 🤖

---

# ✨ What Can Klar Do?

Glad you asked! Here's the good stuff:

- 🏠 **Multi-Household Support** — share a household with your partner or flatmates, with per-entry visibility (shared vs. private)
- 📊 **Fixed Costs Dashboard** — grouped by category, color-coded, with net surplus calculation
- 🔁 **Recurring Transactions** — monthly, quarterly, yearly, or custom intervals — computed on-the-fly (no data bloat!)
- 📅 **Monthly Budgets** — set category budgets, track actuals vs. plan, see the delta
- 🎯 **Project Tracking** — assign transactions to a project, track budget vs. actual vs. remaining
- 🧮 **Scenario Calculator** — "what if my bonus is X this month?" — live calculation, nothing saved
- 🔑 **Public REST API** — API keys with scopes, rate limiting, OpenAPI docs at `/api/docs`
- 🔐 **OIDC Login** — PocketID (and any OIDC provider) + classic email/password
- 📱 **PWA — Mobile-First** — installable on iOS and Android, dark mode, safe area support
- 🤖 **Home Assistant / n8n Ready** — hook up your homelab automations via API keys
- 🛡️ **Row-Level Security** — PostgreSQL RLS ensures household data is always isolated

> [!NOTE]
> 🔢 **Everything in cents.** All amounts are stored as signed integers (`amountCents`). Positive = income, negative = expense. No floating point, no rounding surprises.

> [!IMPORTANT]
> 🔒 **Privacy-first by design.** Private transactions are never included in another user's aggregates — not even summaries. What's private stays private.

---

# 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Package Manager | pnpm 10 + Turborepo |
| Backend | NestJS 11 + Fastify 5 |
| Frontend | Angular 21 (Zoneless, Signal Forms) |
| Styling | Tailwind CSS 4 + Dark Mode |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Local + OIDC (Passport) + API Keys |
| Crypto | Argon2id (passwords + API keys) |
| JWT | RS256 key pair |
| Dates | Temporal API (native, no library) |
| Validation | Zod (shared) + class-validator (NestJS) |
| Tests | Vitest + Supertest + Playwright |
| CI/CD | GitHub Actions |
| Deploy | Docker Compose + Traefik |
| PWA | @angular/pwa + iOS meta-tags |

---

# 📦 Prerequisites

You'll need:
- **Docker** + **Docker Compose** — for the Postgres database (and production deployment)
- **Node.js 22 LTS** — for local development
- **pnpm 10** — `npm install -g pnpm@10`

---

# 🚀 Getting Started

## Development Setup

**1. Clone and install**

```bash
git clone https://github.com/Disane87/denaro.git
cd denaro
pnpm install
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env with your values (DATABASE_URL etc. are pre-filled for local dev)
```

**3. Generate JWT keys** (one-time setup)

```bash
pnpm --filter @klar/api keys:generate
```

This creates a 4096-bit RS256 key pair in `apps/api/keys/`. Keep `private.pem` safe! 🔐

**4. Start the database**

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

**5. Run database migrations**

```bash
pnpm --filter @klar/api prisma:migrate
pnpm --filter @klar/api prisma:seed   # optional demo data
```

**6. Start everything**

```bash
pnpm dev
```

That's it! 🎉

| Service | URL |
|---|---|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000/api/v1 |
| API Docs (Swagger) | http://localhost:3000/api/docs |
| Health Check | http://localhost:3000/health |
| Prisma Studio | Run `pnpm --filter @klar/api prisma:studio` → http://localhost:5555 |

> [!NOTE]
> 🧑‍💼 **First registered user becomes admin** — registration is open by default. Set `REGISTRATION_ENABLED=false` in your `.env` to close it after your first user.

## Production Deployment

```bash
# Build all images
docker compose -f docker/docker-compose.prod.yml build

# Start the stack (Postgres + API + Web + Traefik)
docker compose -f docker/docker-compose.prod.yml up -d
```

> [!IMPORTANT]
> Make sure to set strong values for `POSTGRES_PASSWORD`, and keep your `JWT_PRIVATE_KEY_PATH` key outside the container (use a Docker secret or a mounted volume).

---

# ⚙️ Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in your values.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://klar:klar@localhost:5432/klar` | Primary database |
| `DATABASE_TEST_URL` | `postgresql://klar:klar@localhost:5432/klar_test` | Test database |
| `JWT_PRIVATE_KEY_PATH` | `keys/private.pem` | RS256 private key (generate with `keys:generate`) |
| `JWT_PUBLIC_KEY_PATH` | `keys/public.pem` | RS256 public key |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token TTL |
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | `development` or `production` |
| `REGISTRATION_ENABLED` | `true` | Allow new user registration |
| `APP_URL` | `http://localhost:4200` | Used in emails / OIDC callbacks |
| `FRONTEND_URL` | `http://localhost:4200` | CORS origin |

---

# 🔑 Public API

Klar exposes a public REST API under `/api/public/v1/` for external tools. Authenticate with an API key:

```bash
curl -H "Authorization: Bearer bgb_live_your_api_key_here" \
  https://your-klar-instance.com/api/public/v1/households/overview
```

**API key scopes:**

| Scope | What it allows |
|---|---|
| `overview:read` | Read monthly overview + fixed costs |
| `transactions:read` | Read transactions |
| `transactions:write` | Create/update/delete transactions |
| `budgets:read` | Read budget status |

> [!NOTE]
> 🏠 **Home Assistant integration idea:** Use a `overview:read` key to pull your monthly surplus into a Home Assistant sensor, then trigger automations when you exceed your budget. 📊

Full API reference: **`/api/docs`** (Swagger UI, auto-generated from OpenAPI spec)

---

# 🔐 OIDC / SSO Login

Klar supports OIDC for single sign-on — perfect if you run PocketID or any other OIDC provider in your homelab.

1. Register a client in your OIDC provider
2. Set `OIDC_*` variables in your `.env`
3. Users can link their existing Klar account to their OIDC identity — or log in directly with SSO

Account linking rules:
- OIDC only links when `email_verified === true` from the provider
- You can't remove a password if you have no OIDC identity (and vice versa) — no lockout possible

---

# 🧪 Development

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

**Coverage thresholds** (enforced in CI):

| Package | Threshold |
|---|---|
| `@klar/api` | 80% lines |
| `@klar/web` | 70% lines |

**Test-Driven Development** is enforced: Red → Green → Refactor. Every feature ships with tests.

---

# 📁 Project Structure

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
> 💡 **Shared calculation functions** (`safeDayOfMonth`, `toMonthlyEquivalent`, `sumByCents`, `calculateMonthlyOverview`) live in `packages/shared` and are imported by both the API and the frontend — no duplication, no drift.

---

# 🤝 Contributing

Want to help make Klar better? Awesome! 🎉

- 🌿 Work on feature branches, PRs go to `main`
- 💬 Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:` etc.)
- 🧪 TDD is required — write the failing test first
- 📋 Check `SPEC.md` before implementing — it's the source of truth
- 🏗️ Check `CLAUDE.md` for architecture rules and hard constraints

**Hard rules (non-negotiable):**
- `amountCents: Int` — never a float, always signed
- `householdId` never comes from the request body — always from the URL param or API key
- Recurring transactions are never persisted — computed on-the-fly
- `100dvh` not `100vh` — iOS Safari bug
- Font size ≥ 16px on all form inputs — iOS auto-zoom prevention

Found a bug? Have an idea? [Open an issue](https://github.com/Disane87/denaro/issues) — let's make this better together! 🚀

---

# 🎉 Cheers!

If Klar is useful for you, give it a ⭐ on GitHub — it really helps! 🙌

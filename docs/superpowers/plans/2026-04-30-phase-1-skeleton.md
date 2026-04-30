# Phase 1 — Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the complete project skeleton — pnpm 10 Turborepo monorepo, Docker Compose Postgres, NestJS 11 + Fastify `/health` endpoint, Angular 21 zoneless PWA — so every subsequent phase can ship features on a working, tested foundation.

**Architecture:** pnpm 10 Turborepo monorepo with `apps/api` (NestJS 11, Fastify 5, Pino) and `apps/web` (Angular 21 zoneless, Tailwind 4, Zard UI, @angular/pwa). Two shared packages: `packages/shared` (zod, types, calc stubs) and `packages/shared-frontend` (ResourceStore stub, ApiClient stub, helpers). Docker Compose dev brings up only Postgres 16; apps run via `pnpm dev`. Vitest for unit/e2e tests in both apps. GitHub Actions CI: lint + build.

**Tech Stack:** pnpm 10, Turborepo, NestJS 11, Fastify 5, nestjs-pino, Angular 21, Tailwind CSS 4, Zard UI (shadcn/ui for Angular — Beta, pin version), @angular/pwa, @analogjs/vitest-angular, Vitest 3, Supertest 7, GitHub Actions

---

## File Map

### Monorepo Root
| File | Responsibility |
|---|---|
| `package.json` | workspace root — scripts (dev, build, lint, test), engines declaration |
| `pnpm-workspace.yaml` | declares `apps/*` and `packages/*` as workspaces |
| `turbo.json` | Turborepo pipeline: dev, build, lint, test |
| `.npmrc` | pnpm tuning (auto-install-peers, no strict-peer) |
| `.gitignore` | node_modules, dist, .env, keys/, .angular/ |
| `.env.example` | documents all required env vars with examples |

### packages/shared
| File | Responsibility |
|---|---|
| `package.json` | `@klar/shared`, exports src/index.ts |
| `tsconfig.json` | strict TS, NodeNext modules |
| `src/index.ts` | re-exports types, schemas, calculations |
| `src/types.ts` | ServerManaged, CreateDto<T>, UpdateDto<T>, PaginatedResponse<T> |
| `src/calculations.ts` | safeDayOfMonth, toMonthlyEquivalent, sumByCents, currentYearMonth (stubs for later phases) |
| `src/schemas.ts` | empty stub — zod schemas added per-feature |

### packages/shared-frontend
| File | Responsibility |
|---|---|
| `package.json` | `@klar/shared-frontend`, peer deps: Angular |
| `tsconfig.json` | strict TS, bundler module resolution |
| `src/index.ts` | re-exports helpers, api-client stub, resource-store stub |
| `src/helpers.ts` | `toHttpParams(obj)` → HttpParams |
| `src/api-client.ts` | ApiClient stub (get/post/patch/delete → firstValueFrom) |
| `src/resource-store.ts` | ResourceStore<T> stub — full impl in Phase 5 |

### apps/api
| File | Responsibility |
|---|---|
| `package.json` | NestJS 11, Fastify 5, nestjs-pino, Vitest, Supertest, tsx |
| `tsconfig.json` | emitDecoratorMetadata, strict, CommonJS |
| `tsconfig.build.json` | extends tsconfig.json, excludes spec files |
| `nest-cli.json` | sourceRoot: src |
| `.env.example` | DATABASE_URL, JWT key paths, PORT, NODE_ENV |
| `vitest.config.ts` | node environment, 80% line coverage threshold |
| `src/main.ts` | NestFactory + FastifyAdapter, Pino logger, global prefix api/v1 |
| `src/app.module.ts` | LoggerModule (Pino redaction), HealthModule |
| `src/health/health.module.ts` | declares HealthController |
| `src/health/health.controller.ts` | GET /health → `{ status: 'ok', timestamp: ISO }` |
| `src/health/health.controller.spec.ts` | unit test (TDD) |
| `src/common/filters/global-exception.filter.ts` | RFC 7807 ProblemDetail for all exceptions |
| `src/common/filters/global-exception.filter.spec.ts` | unit test (TDD) |
| `scripts/generate-keys.ts` | generates RS256 key pair → keys/ directory |

### apps/web
| File | Responsibility |
|---|---|
| `package.json` | Angular 21, Tailwind 4, Zard UI, @angular/pwa, @analogjs/vitest-angular |
| `angular.json` | build: @angular/build:application, no polyfills (zoneless), serviceWorker |
| `tsconfig.json` | root TS config for Angular |
| `tsconfig.app.json` | app compilation |
| `tsconfig.spec.json` | test compilation |
| `vite.config.ts` | @analogjs/vitest-angular plugin, jsdom, 70% line coverage |
| `src/test-setup.ts` | minimal Vitest-Angular setup (no zone.js) |
| `src/index.html` | viewport-fit=cover, iOS meta-tags, apple-touch-icon, splash links |
| `src/styles.css` | @import tailwindcss, @custom-variant dark, @theme colors, :root safe-area vars |
| `src/main.ts` | bootstrapApplication(AppComponent, appConfig) |
| `src/app/app.config.ts` | provideZonelessChangeDetection, provideRouter, provideHttpClient, provideServiceWorker |
| `src/app/app.routes.ts` | empty routes array (Phase 2+ fills this) |
| `src/app/app.component.ts` | minimal shell — `<router-outlet />` |
| `src/app/app.component.spec.ts` | smoke test (TDD) |
| `manifest.webmanifest` | name, icons, display:standalone, theme/bg color |
| `ngsw-config.json` | freshness strategy for /api/v1/**, prefetch app-shell |
| `src/assets/` | placeholder directory |

### docker
| File | Responsibility |
|---|---|
| `docker/docker-compose.dev.yml` | postgres:16-alpine only, health check, named volume |
| `docker/docker-compose.prod.yml` | stub — filled in Phase 14 (postgres + api + web + traefik) |

### .vscode
| File | Responsibility |
|---|---|
| `.vscode/launch.json` | debug: NestJS API (attach), Angular (Chrome) |
| `.vscode/tasks.json` | run: dev server, api tests, web tests, docker up |
| `.vscode/settings.json` | TypeScript SDK, format on save, Tailwind IntelliSense, ESLint |
| `.vscode/extensions.json` | Angular, Tailwind, ESLint, Prisma, GitLens, REST Client |

### .github
| File | Responsibility |
|---|---|
| `.github/workflows/ci.yml` | Node 22, pnpm 10, lint + build on push/PR to main |

---

## Task 1: Monorepo Root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "klar",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:integration": "pnpm --filter @klar/api test:integration",
    "test:e2e": "pnpm --filter @klar/api test:e2e",
    "clean": "turbo run clean && rimraf node_modules"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.7.0",
    "rimraf": "^6.0.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  },
  "packageManager": "pnpm@10.9.0"
}
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL", "DATABASE_TEST_URL", "PORT"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "cache": false,
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create `.npmrc`**

```ini
auto-install-peers=true
dedupe-peer-dependents=true
strict-peer-dependencies=false
```

- [ ] **Step 5: Create `.gitignore`**

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.turbo/
coverage/

# Angular
apps/web/.angular/
apps/web/dist/

# Environment
.env
.env.local
.env.*.local

# JWT Keys (generated via pnpm --filter @klar/api keys:generate)
apps/api/keys/

# IDE (keep shared settings, ignore personal workspace file)
.vscode/*.code-workspace

# OS
.DS_Store
Thumbs.db

# Prisma test DB
*.db
*.db-journal
```

- [ ] **Step 6: Create `.env.example`**

```dotenv
# Copy to .env and fill in values

# PostgreSQL (dev: started via docker/docker-compose.dev.yml)
DATABASE_URL=postgresql://klar:klar@localhost:5432/klar
DATABASE_TEST_URL=postgresql://klar:klar@localhost:5432/klar_test

# JWT RS256 Key Pair (generate with: pnpm --filter @klar/api keys:generate)
JWT_PRIVATE_KEY_PATH=keys/private.pem
JWT_PUBLIC_KEY_PATH=keys/public.pem
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# App
PORT=3000
NODE_ENV=development
REGISTRATION_ENABLED=true
APP_URL=http://localhost:4200
FRONTEND_URL=http://localhost:4200
```

- [ ] **Step 7: Install workspace root**

```bash
pnpm install
```

Expected: `Lockfile is up to date, resolution step is skipped` or similar. No error.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .npmrc .gitignore .env.example
git commit -m "chore: init pnpm 10 Turborepo monorepo root"
```

---

## Task 2: packages/shared Bootstrap

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/calculations.ts`
- Create: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@klar/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "tsc --noEmit",
    "test": "vitest run --coverage",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "lib": ["ES2022"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types.ts`**

```ts
export type ServerManaged = 'id' | 'createdAt' | 'updatedAt';

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
```

- [ ] **Step 4: Create `packages/shared/src/calculations.ts`**

```ts
export type RecurringFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM_DAYS';

export function safeDayOfMonth(year: number, month: number, day: number): number {
  // month is 1-based (1=January). new Date(year, month, 0) gives last day of that month.
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(day, lastDay);
}

export function toMonthlyEquivalent(
  amountCents: number,
  freq: RecurringFrequency,
): number {
  switch (freq) {
    case 'MONTHLY':    return amountCents;
    case 'QUARTERLY':  return Math.round(amountCents / 3);
    case 'YEARLY':     return Math.round(amountCents / 12);
    case 'CUSTOM_DAYS': return amountCents;
  }
}

export function sumByCents(items: { amountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
```

- [ ] **Step 5: Create `packages/shared/src/schemas.ts`**

```ts
// Zod schemas are added per-feature in later phases (Phase 5+).
// This file is the single source of truth — import from here, never define schemas in apps/.
```

- [ ] **Step 6: Create `packages/shared/src/index.ts`**

```ts
export * from './types.js';
export * from './calculations.js';
export * from './schemas.js';
```

- [ ] **Step 7: Install and verify**

```bash
pnpm install
pnpm --filter @klar/shared lint
```

Expected: no TypeScript errors.

- [ ] **Step 8: Write a test for `safeDayOfMonth`**

Create `packages/shared/src/calculations.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { safeDayOfMonth, toMonthlyEquivalent, sumByCents, currentYearMonth } from './calculations.js';

describe('safeDayOfMonth', () => {
  it('returns day when valid for month', () => {
    expect(safeDayOfMonth(2024, 3, 15)).toBe(15);
  });

  it('clamps day 31 → 30 for April', () => {
    expect(safeDayOfMonth(2024, 4, 31)).toBe(30);
  });

  it('clamps day 31 → 29 for Feb in leap year', () => {
    expect(safeDayOfMonth(2024, 2, 31)).toBe(29);
  });

  it('clamps day 31 → 28 for Feb in non-leap year', () => {
    expect(safeDayOfMonth(2023, 2, 31)).toBe(28);
  });
});

describe('toMonthlyEquivalent', () => {
  it('MONTHLY: returns amount unchanged', () => {
    expect(toMonthlyEquivalent(10000, 'MONTHLY')).toBe(10000);
  });

  it('QUARTERLY: divides by 3', () => {
    expect(toMonthlyEquivalent(30000, 'QUARTERLY')).toBe(10000);
  });

  it('YEARLY: divides by 12', () => {
    expect(toMonthlyEquivalent(120000, 'YEARLY')).toBe(10000);
  });
});

describe('sumByCents', () => {
  it('sums amountCents across items', () => {
    expect(sumByCents([{ amountCents: 100 }, { amountCents: -50 }, { amountCents: 200 }])).toBe(250);
  });

  it('returns 0 for empty array', () => {
    expect(sumByCents([])).toBe(0);
  });
});

describe('currentYearMonth', () => {
  it('returns YYYY-MM format', () => {
    expect(currentYearMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
```

- [ ] **Step 9: Run tests — expect PASS**

```bash
pnpm --filter @klar/shared test
```

Expected: `✓ 8 tests passed`.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): bootstrap shared package with types and calculation stubs"
```

---

## Task 3: packages/shared-frontend Bootstrap

**Files:**
- Create: `packages/shared-frontend/package.json`
- Create: `packages/shared-frontend/tsconfig.json`
- Create: `packages/shared-frontend/src/index.ts`
- Create: `packages/shared-frontend/src/helpers.ts`
- Create: `packages/shared-frontend/src/api-client.ts`
- Create: `packages/shared-frontend/src/resource-store.ts`

- [ ] **Step 1: Create `packages/shared-frontend/package.json`**

```json
{
  "name": "@klar/shared-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "peerDependencies": {
    "@angular/common": "^21.0.0",
    "@angular/core": "^21.0.0"
  },
  "dependencies": {
    "@klar/shared": "workspace:*",
    "zod": "^3.24.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@angular/common": "^21.0.0",
    "@angular/core": "^21.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared-frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `packages/shared-frontend/src/helpers.ts`**

```ts
import { HttpParams } from '@angular/common/http';

export function toHttpParams(obj: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      params = params.set(key, String(value));
    }
  }
  return params;
}
```

- [ ] **Step 4: Create `packages/shared-frontend/src/api-client.ts`** (stub, full impl in Phase 2)

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { toHttpParams } from './helpers.js';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<TRes>(url: string, params?: Record<string, unknown>): Promise<TRes> {
    return firstValueFrom(
      this.http.get<TRes>(url, { params: toHttpParams(params ?? {}) }),
    );
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

- [ ] **Step 5: Create `packages/shared-frontend/src/resource-store.ts`** (stub — full impl in Phase 5)

```ts
// ResourceStore<T> — full implementation added in Phase 5 when Domain Stores are needed.
// Stub ensures imports resolve from day 1.
export abstract class ResourceStore<T> {
  abstract readonly items: () => T[] | undefined;
  abstract readonly loading: () => boolean;
}
```

- [ ] **Step 6: Create `packages/shared-frontend/src/index.ts`**

```ts
export { toHttpParams } from './helpers.js';
export { ApiClient } from './api-client.js';
export { ResourceStore } from './resource-store.js';
```

- [ ] **Step 7: Verify**

```bash
pnpm install
pnpm --filter @klar/shared-frontend lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-frontend/
git commit -m "feat(shared-frontend): bootstrap shared-frontend with ApiClient and helpers stubs"
```

---

## Task 4: NestJS API Bootstrap

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/main.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@klar/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "lint": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "keys:generate": "tsx scripts/generate-keys.ts",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts",
    "prisma:studio": "prisma studio",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.0",
    "@nestjs/core": "^11.1.0",
    "@nestjs/platform-fastify": "^11.1.0",
    "fastify": "^5.0.0",
    "nestjs-pino": "^4.0.0",
    "pino-http": "^10.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "@klar/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.1.0",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.0",
    "pino-pretty": "^13.0.0",
    "rimraf": "^6.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: Create `apps/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `apps/api/.env.example`** (identical to root, kept for IDE convenience)

```dotenv
DATABASE_URL=postgresql://klar:klar@localhost:5432/klar
DATABASE_TEST_URL=postgresql://klar:klar@localhost:5432/klar_test
JWT_PRIVATE_KEY_PATH=keys/private.pem
JWT_PUBLIC_KEY_PATH=keys/public.pem
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
PORT=3000
NODE_ENV=development
REGISTRATION_ENABLED=true
FRONTEND_URL=http://localhost:4200
```

- [ ] **Step 6: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
```

- [ ] **Step 7: Create `apps/api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.apiKey',
          'req.body.secret',
          'req.body.hashedSecret',
        ],
      },
    }),
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Create `apps/api/src/main.ts`**

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health'],
  });
  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
    credentials: true,
  });

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
```

- [ ] **Step 9: Install API deps**

```bash
pnpm install
```

Expected: packages installed without errors.

- [ ] **Step 10: Verify TypeScript compiles**

```bash
pnpm --filter @klar/api lint
```

Expected: no errors (health module will fail until created in Task 5 — acceptable at this point since health module is created next).

- [ ] **Step 11: Commit**

```bash
git add apps/api/
git commit -m "feat(api): bootstrap NestJS 11 + Fastify 5 + Pino with global RFC 7807 filter"
```

---

## Task 5: /health Endpoint (TDD)

**Files:**
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.spec.ts`

- [ ] **Step 1: Write the failing test first**

Create `apps/api/src/health/health.controller.spec.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('returns status ok with ISO timestamp', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @klar/api test
```

Expected: `Error: Cannot find module './health.controller'` or similar import failure.

- [ ] **Step 3: Implement `health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Implement `health.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @klar/api test
```

Expected: `✓ health.controller.spec.ts (1 test) — returns status ok with ISO timestamp`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/health/
git commit -m "feat(api): add /health endpoint (TDD)"
```

---

## Task 6: GlobalExceptionFilter RFC 7807 (TDD)

**Files:**
- Create: `apps/api/src/common/filters/global-exception.filter.ts`
- Create: `apps/api/src/common/filters/global-exception.filter.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/filters/global-exception.filter.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

const mockSend = vi.fn();
const mockCode = vi.fn().mockReturnThis();
const mockHeader = vi.fn().mockReturnThis();

function makeMockHost(url: string): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ code: mockCode, header: mockHeader, send: mockSend }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    vi.clearAllMocks();
  });

  it('maps NotFoundException to RFC 7807 status 404', () => {
    filter.catch(new NotFoundException('User not found'), makeMockHost('/api/v1/users/123'));

    expect(mockCode).toHaveBeenCalledWith(404);
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(mockSend).toHaveBeenCalledWith({
      type: 'https://klar.app/errors/not-found',
      title: 'Ressource nicht gefunden',
      status: 404,
      detail: 'User not found',
      instance: '/api/v1/users/123',
    });
  });

  it('maps BadRequestException to 400', () => {
    filter.catch(new BadRequestException('Invalid input'), makeMockHost('/api/v1/test'));

    expect(mockCode).toHaveBeenCalledWith(400);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, type: 'https://klar.app/errors/bad-request' }),
    );
  });

  it('maps unknown errors to 500', () => {
    filter.catch(new Error('Unexpected'), makeMockHost('/api/v1/test'));

    expect(mockCode).toHaveBeenCalledWith(500);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, type: 'https://klar.app/errors/internal-server-error' }),
    );
  });

  it('sets Content-Type to application/problem+json for all exceptions', () => {
    filter.catch(new NotFoundException(), makeMockHost('/'));
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @klar/api test
```

Expected: import resolution failure for `global-exception.filter`.

- [ ] **Step 3: Implement the filter**

Create `apps/api/src/common/filters/global-exception.filter.ts`:

```ts
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

const STATUS_TITLES: Record<number, string> = {
  400: 'Ungültige Anfrage',
  401: 'Nicht authentifiziert',
  403: 'Zugriff verweigert',
  404: 'Ressource nicht gefunden',
  409: 'Konflikt',
  422: 'Validierungsfehler',
  429: 'Zu viele Anfragen',
  500: 'Interner Serverfehler',
};

const STATUS_SLUGS: Record<number, string> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'unprocessable-entity',
  429: 'too-many-requests',
  500: 'internal-server-error',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Ein unerwarteter Fehler ist aufgetreten.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        detail = res;
      } else {
        const msg = (res as { message?: string | string[] }).message;
        detail = Array.isArray(msg) ? msg.join(', ') : (msg ?? detail);
      }
    } else {
      this.logger.error(exception);
    }

    const body: ProblemDetail = {
      type: `https://klar.app/errors/${STATUS_SLUGS[status] ?? 'error'}`,
      title: STATUS_TITLES[status] ?? 'Fehler',
      status,
      detail,
      instance: request.url,
    };

    reply
      .code(status)
      .header('Content-Type', 'application/problem+json')
      .send(body);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @klar/api test
```

Expected: `✓ 5 tests passed` (4 filter tests + 1 health test).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/
git commit -m "feat(api): GlobalExceptionFilter with RFC 7807 Problem Details (TDD)"
```

---

## Task 7: JWT keys:generate Script

**Files:**
- Create: `apps/api/scripts/generate-keys.ts`

- [ ] **Step 1: Create `apps/api/scripts/generate-keys.ts`**

```ts
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const keysDir = join(process.cwd(), 'keys');

if (!existsSync(keysDir)) {
  mkdirSync(keysDir, { recursive: true });
}

const privateKeyPath = join(keysDir, 'private.pem');
const publicKeyPath = join(keysDir, 'public.pem');

if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
  console.log('Keys already exist at keys/private.pem and keys/public.pem — skipping generation.');
  console.log('Delete the keys/ directory manually to regenerate.');
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
writeFileSync(publicKeyPath, publicKey);

console.log('✓ JWT RS256 key pair generated:');
console.log('  keys/private.pem (mode 0600 — keep secret)');
console.log('  keys/public.pem');
console.log('');
console.log('Add to .env:');
console.log('  JWT_PRIVATE_KEY_PATH=keys/private.pem');
console.log('  JWT_PUBLIC_KEY_PATH=keys/public.pem');
```

- [ ] **Step 2: Verify the script runs**

```bash
cd apps/api && pnpm keys:generate
```

Expected output:
```
✓ JWT RS256 key pair generated:
  keys/private.pem (mode 0600 — keep secret)
  keys/public.pem
```

- [ ] **Step 3: Verify idempotency (run again)**

```bash
pnpm --filter @klar/api keys:generate
```

Expected: `Keys already exist … skipping generation.`

- [ ] **Step 4: Verify keys/ is in .gitignore**

```bash
git status apps/api/keys/
```

Expected: `apps/api/keys/` is not listed (ignored).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/
git commit -m "feat(api): JWT RS256 keys:generate script (idempotent)"
```

---

## Task 8: Angular 21 Bootstrap (Zoneless)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/angular.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.app.json`
- Create: `apps/web/tsconfig.spec.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/test-setup.ts`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/app/app.config.ts`
- Create: `apps/web/src/app/app.routes.ts`
- Create: `apps/web/src/app/app.component.ts`
- Create: `apps/web/src/app/app.component.spec.ts`

- [ ] **Step 1: Write the failing smoke test**

Create `apps/web/src/app/app.component.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('should create', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders router-outlet', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Create `apps/web/package.json`**

```json
{
  "name": "@klar/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "ng build",
    "dev": "ng serve --port 4200",
    "lint": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "clean": "rimraf dist .angular"
  },
  "dependencies": {
    "@angular/animations": "^21.0.0",
    "@angular/common": "^21.0.0",
    "@angular/compiler": "^21.0.0",
    "@angular/core": "^21.0.0",
    "@angular/forms": "^21.0.0",
    "@angular/platform-browser": "^21.0.0",
    "@angular/router": "^21.0.0",
    "@angular/service-worker": "^21.0.0",
    "@klar/shared": "workspace:*",
    "@klar/shared-frontend": "workspace:*",
    "rxjs": "^7.8.0",
    "tslib": "^2.8.0"
  },
  "devDependencies": {
    "@angular/build": "^21.0.0",
    "@angular/cli": "^21.0.0",
    "@angular/compiler-cli": "^21.0.0",
    "@angular/pwa": "^21.0.0",
    "@analogjs/vitest-angular": "^1.0.0",
    "tailwindcss": "^4.0.0",
    "rimraf": "^6.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "jsdom": "^25.0.0"
  }
}
```

> **Note on Zard UI:** The package is added in Task 10. At time of installation, verify the exact package name (check the project's GitHub). Expected package name: `@zardui/components` or `@zardui/core`. Pin to the Beta version available at install time — do NOT let it auto-update.

- [ ] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": false,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "moduleResolution": "bundler",
    "module": "ES2022",
    "lib": ["ES2022", "dom"],
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"],
      "@shared-frontend/*": ["../../packages/shared-frontend/src/*"]
    }
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

- [ ] **Step 4: Create `apps/web/tsconfig.app.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
```

- [ ] **Step 5: Create `apps/web/tsconfig.spec.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.spec.ts", "src/test-setup.ts"]
}
```

- [ ] **Step 6: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vitest-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/test-setup.ts'],
      thresholds: {
        lines: 70,
      },
    },
  },
});
```

- [ ] **Step 7: Create `apps/web/src/test-setup.ts`**

```ts
// Minimal Vitest setup for zoneless Angular.
// No zone.js imports — zoneless change detection requires no Zone.js bootstrap.
import '@angular/compiler';
```

- [ ] **Step 8: Create `apps/web/src/app/app.routes.ts`**

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [];
```

- [ ] **Step 9: Create `apps/web/src/app/app.config.ts`**

```ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
  ],
};
```

- [ ] **Step 10: Create `apps/web/src/app/app.component.ts`**

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

- [ ] **Step 11: Create `apps/web/src/main.ts`**

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch(console.error);
```

- [ ] **Step 12: Create minimal `apps/web/angular.json`**

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "web": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "css",
          "standalone": true,
          "changeDetection": "OnPush"
        }
      },
      "root": "",
      "sourceRoot": "src",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "outputPath": "dist/web",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": [],
            "tsConfig": "tsconfig.app.json",
            "assets": [
              { "glob": "**/*", "input": "src/assets" },
              "src/favicon.ico"
            ],
            "styles": ["src/styles.css"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": { "buildTarget": "web:build:production" },
            "development": { "buildTarget": "web:build:development" }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  }
}
```

- [ ] **Step 13: Create placeholder `apps/web/src/index.html`** (full iOS meta-tags added in Task 11)

```html
<!doctype html>
<html lang="de" class="">
  <head>
    <meta charset="utf-8" />
    <title>Klar</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

- [ ] **Step 14: Create placeholder `apps/web/src/styles.css`** (Tailwind + dark mode added in Task 9)

```css
/* Tailwind and theme setup added in Task 9 */
```

- [ ] **Step 15: Create `apps/web/src/assets/.gitkeep`**

```bash
mkdir -p apps/web/src/assets && touch apps/web/src/assets/.gitkeep
```

- [ ] **Step 16: Install and run the failing test**

```bash
pnpm install
pnpm --filter @klar/web test
```

Expected: `✓ 2 tests passed` (both AppComponent tests).

- [ ] **Step 17: Commit**

```bash
git add apps/web/
git commit -m "feat(web): Angular 21 zoneless bootstrap with Vitest smoke test"
```

---

## Task 9: Tailwind 4 + Dark Mode

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/index.html` (add `class=""` on `<html>` for dark mode)

- [ ] **Step 1: Verify Tailwind 4 is installed**

```bash
pnpm --filter @klar/web add tailwindcss@^4.0.0
```

- [ ] **Step 2: Replace `apps/web/src/styles.css`**

```css
@import "tailwindcss";

/* Class-based dark mode — set class="dark" on <html> to activate */
@custom-variant dark (&:where(.dark, .dark *));

/* Semantic color tokens — used via Tailwind utilities */
@theme {
  --color-success: oklch(0.7 0.17 145);
  --color-success-foreground: oklch(0.98 0.01 145);
  --color-danger: oklch(0.65 0.2 25);
  --color-danger-foreground: oklch(0.98 0.01 25);

  --font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
}

/* iOS Safe Area insets — available in all components via CSS custom properties */
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}

/* Base — enforce Klar hard rules from day 1 */
input, select, textarea {
  font-size: 1rem; /* Minimum 16px — prevents iOS Safari auto-zoom */
}
```

- [ ] **Step 3: Verify build compiles with Tailwind 4**

```bash
pnpm --filter @klar/web build
```

Expected: builds without errors. Check `dist/web/` is created.

- [ ] **Step 4: Verify the `<html class="">` attribute is present in `apps/web/src/index.html`**

The `<html lang="de" class="">` line already has `class=""` — this is where we'll toggle `dark` in Phase 2+ (AuthStore sets it). No code change needed here.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles.css apps/web/src/index.html
git commit -m "feat(web): Tailwind 4 with class-based dark mode and semantic color tokens"
```

---

## Task 10: Zard UI Setup

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/styles.css`

> **Pre-step:** Before running, verify the Zard UI package name. Find the current package name in the Zard UI documentation or GitHub. Expected: `@zardui/components` or `@zardui/core`. If neither exists, search for "shadcn angular signals tailwind 4" to find the correct package.

- [ ] **Step 1: Install Zard UI (pin the Beta version)**

```bash
# Replace <exact-version> with the specific beta version found — do NOT use "latest" or "^"
pnpm --filter @klar/web add @zardui/components@<exact-version>
```

Example: if version is `0.4.2-beta.1`, run: `pnpm --filter @klar/web add @zardui/components@0.4.2-beta.1`

- [ ] **Step 2: Run Zard UI init schematics (if available)**

```bash
cd apps/web && npx ng add @zardui/components --skip-confirmation
```

This may update `angular.json` and `styles.css`. If the package uses a different init command, consult its docs.

- [ ] **Step 3: Verify CSS theme variables are present in `styles.css`**

Zard UI typically injects CSS custom properties for its components (e.g., `--background`, `--foreground`, `--primary`, etc.) via its own CSS import or `@layer`. After `ng add`, check that `styles.css` has Zard UI's theme imports AND Tailwind's `@import "tailwindcss"` still comes first.

`apps/web/src/styles.css` should look like:

```css
@import "tailwindcss";

/* Zard UI theme — injected by ng add */
@import "@zardui/components/styles.css"; /* exact path depends on Zard UI version */

/* Class-based dark mode */
@custom-variant dark (&:where(.dark, .dark *));

/* Keep all custom @theme and :root vars from Task 9 */
@theme {
  --color-success: oklch(0.7 0.17 145);
  --color-success-foreground: oklch(0.98 0.01 145);
  --color-danger: oklch(0.65 0.2 25);
  --color-danger-foreground: oklch(0.98 0.01 25);
  --font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
}

:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}

input, select, textarea {
  font-size: 1rem;
}
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm --filter @klar/web build
```

Expected: no errors.

- [ ] **Step 5: Run tests — expect still pass**

```bash
pnpm --filter @klar/web test
```

Expected: `✓ 2 tests passed`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/styles.css apps/web/angular.json
git commit -m "feat(web): install and configure Zard UI (pinned beta)"
```

---

## Task 11: @angular/pwa + iOS Meta-Tags

**Files:**
- Modify: `apps/web/src/index.html`
- Create: `apps/web/manifest.webmanifest`
- Create: `apps/web/ngsw-config.json`
- Modify: `apps/web/angular.json`
- Modify: `apps/web/src/app/app.config.ts`

- [ ] **Step 1: Install @angular/pwa**

```bash
cd apps/web && npx ng add @angular/pwa --skip-confirmation
```

This generates `manifest.webmanifest`, `ngsw-config.json`, and modifies `angular.json` + `index.html`. Review changes — keep what's generated and adjust in the following steps.

- [ ] **Step 2: Replace `apps/web/manifest.webmanifest`**

```json
{
  "name": "Klar",
  "short_name": "Klar",
  "description": "Privates Klar — selbst gehostet",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "orientation": "portrait-primary",
  "start_url": "/",
  "icons": [
    {
      "src": "icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ]
}
```

> **Icon files:** Create 1×1 placeholder PNGs in `apps/web/src/icons/` for now. Replace with real icons before Phase 13. Use this command to create all placeholders:
> ```bash
> mkdir -p apps/web/src/icons
> for size in 72 96 128 144 152 192 384 512; do
>   # On macOS/Linux with ImageMagick: convert -size ${size}x${size} xc:'#09090b' apps/web/src/icons/icon-${size}x${size}.png
>   # Without ImageMagick: copy any 1px PNG and rename — CI won't fail, PWA will just use a placeholder icon
>   touch apps/web/src/icons/icon-${size}x${size}.png
> done
> ```

- [ ] **Step 3: Replace `apps/web/ngsw-config.json`**

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app-shell",
      "installMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.html",
          "/manifest.webmanifest",
          "/*.css",
          "/*.js"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/icons/**"]
      }
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

- [ ] **Step 4: Replace `apps/web/src/index.html` with iOS meta-tags**

```html
<!doctype html>
<html lang="de" class="">
  <head>
    <meta charset="utf-8" />
    <title>Klar</title>
    <base href="/" />

    <!-- Critical: viewport-fit=cover enables safe-area-inset-* on iOS -->
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

    <!-- PWA / iOS -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Klar" />
    <meta name="theme-color" content="#09090b" />

    <!-- Favicon + manifest -->
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
    <link rel="manifest" href="manifest.webmanifest" />

    <!-- Apple touch icons (required for iOS add-to-homescreen) -->
    <link rel="apple-touch-icon" sizes="152x152" href="icons/icon-152x152.png" />
    <link rel="apple-touch-icon" sizes="192x192" href="icons/icon-192x192.png" />

    <!-- iOS Splash Screens (covers iPhone 14/15 Pro) -->
    <link
      rel="apple-touch-startup-image"
      href="icons/splash-1179x2556.png"
      media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
    />
    <link
      rel="apple-touch-startup-image"
      href="icons/splash-1290x2796.png"
      media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
    />
  </head>
  <body>
    <app-root></app-root>
    <noscript>Diese App benötigt JavaScript.</noscript>
  </body>
</html>
```

> **Splash screen placeholders:** `touch apps/web/src/icons/splash-1179x2556.png apps/web/src/icons/splash-1290x2796.png` — replace with real splash screens before Phase 13.

- [ ] **Step 5: Update `apps/web/src/app/app.config.ts` to register Service Worker**

```ts
import { ApplicationConfig, isDevMode, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
```

- [ ] **Step 6: Update `angular.json` build options for Service Worker + manifest**

In `apps/web/angular.json`, under `projects.web.architect.build.options`, ensure:

```json
"assets": [
  { "glob": "**/*", "input": "src/assets" },
  "src/favicon.ico",
  "src/manifest.webmanifest",
  { "glob": "**/*", "input": "src/icons", "output": "icons" },
  {
    "glob": "ngsw-worker.js",
    "input": "node_modules/@angular/service-worker",
    "output": "."
  },
  {
    "glob": "safety-worker.js",
    "input": "node_modules/@angular/service-worker",
    "output": "."
  },
  {
    "glob": "worker-basic.min.js",
    "input": "node_modules/@angular/service-worker",
    "output": "."
  }
],
"serviceWorker": "ngsw-config.json"
```

- [ ] **Step 7: Verify build**

```bash
pnpm --filter @klar/web build
```

Expected: no errors. `dist/web/ngsw.json` and `dist/web/manifest.webmanifest` present.

- [ ] **Step 8: Run tests — still pass**

```bash
pnpm --filter @klar/web test
```

Expected: `✓ 2 tests passed`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/index.html apps/web/manifest.webmanifest apps/web/ngsw-config.json \
        apps/web/angular.json apps/web/src/app/app.config.ts apps/web/src/icons/
git commit -m "feat(web): @angular/pwa with iOS meta-tags, manifest, Service Worker config"
```

---

## Task 12: Docker Compose Dev

**Files:**
- Create: `docker/docker-compose.dev.yml`
- Create: `docker/docker-compose.prod.yml`

- [ ] **Step 1: Create `docker/docker-compose.dev.yml`**

```yaml
# Dev environment — Postgres 16 only.
# Apps run locally via: pnpm dev
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: klar
      POSTGRES_PASSWORD: klar
      POSTGRES_DB: klar
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U klar -d klar"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

volumes:
  postgres_dev_data:
    driver: local
```

- [ ] **Step 2: Create `docker/docker-compose.prod.yml`** (stub)

```yaml
# Production — filled in Phase 14.
# Will include: postgres, api, web (nginx), traefik.
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # api: (Phase 14)
  # web: (Phase 14)
  # traefik: (Phase 14)

volumes:
  postgres_prod_data:
    driver: local
```

- [ ] **Step 3: Start Postgres and verify**

```bash
docker compose -f docker/docker-compose.dev.yml up -d
docker compose -f docker/docker-compose.dev.yml ps
```

Expected: `postgres` container in state `healthy` or `running`.

- [ ] **Step 4: Verify connection**

```bash
docker compose -f docker/docker-compose.dev.yml exec postgres \
  psql -U klar -d klar -c "SELECT version();"
```

Expected: PostgreSQL 16.x version string.

- [ ] **Step 5: Stop Postgres**

```bash
docker compose -f docker/docker-compose.dev.yml down
```

- [ ] **Step 6: Commit**

```bash
git add docker/
git commit -m "feat(docker): docker-compose.dev.yml with Postgres 16 + health check"
```

---

## Task 13: .vscode Workspace

**Files:**
- Create: `.vscode/launch.json`
- Create: `.vscode/tasks.json`
- Create: `.vscode/settings.json`
- Create: `.vscode/extensions.json`

- [ ] **Step 1: Create `.vscode/launch.json`**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API (attach)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/apps/api/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug API (launch)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@klar/api", "run", "dev"],
      "cwd": "${workspaceFolder}",
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Open Chrome (web)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}/apps/web/src"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack",
      "configurations": ["Debug API (launch)", "Open Chrome (web)"]
    }
  ]
}
```

- [ ] **Step 2: Create `.vscode/tasks.json`**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev: All",
      "type": "shell",
      "command": "pnpm dev",
      "group": "build",
      "presentation": { "reveal": "always", "panel": "new" },
      "problemMatcher": []
    },
    {
      "label": "Dev: API only",
      "type": "shell",
      "command": "pnpm --filter @klar/api dev",
      "group": "build",
      "presentation": { "reveal": "always", "panel": "new" }
    },
    {
      "label": "Dev: Web only",
      "type": "shell",
      "command": "pnpm --filter @klar/web dev",
      "group": "build",
      "presentation": { "reveal": "always", "panel": "new" }
    },
    {
      "label": "Test: All",
      "type": "shell",
      "command": "pnpm test",
      "group": { "kind": "test", "isDefault": true },
      "presentation": { "reveal": "always", "panel": "shared" }
    },
    {
      "label": "Test: API",
      "type": "shell",
      "command": "pnpm --filter @klar/api test",
      "group": "test"
    },
    {
      "label": "Test: Web",
      "type": "shell",
      "command": "pnpm --filter @klar/web test",
      "group": "test"
    },
    {
      "label": "Docker: Postgres up",
      "type": "shell",
      "command": "docker compose -f docker/docker-compose.dev.yml up -d",
      "presentation": { "reveal": "silent" }
    },
    {
      "label": "Docker: Postgres down",
      "type": "shell",
      "command": "docker compose -f docker/docker-compose.dev.yml down",
      "presentation": { "reveal": "silent" }
    },
    {
      "label": "Generate JWT Keys",
      "type": "shell",
      "command": "pnpm --filter @klar/api keys:generate"
    }
  ]
}
```

- [ ] **Step 3: Create `.vscode/settings.json`**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.configFile": "apps/web/src/styles.css",
  "tailwindCSS.includeLanguages": {
    "html": "html",
    "typescript": "javascript"
  },
  "css.validate": false,
  "editor.quickSuggestions": {
    "strings": "on"
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true,
    "**/.angular": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  },
  "prisma.prismaFmtPath": "node_modules/.bin/prisma-fmt",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

- [ ] **Step 4: Create `.vscode/extensions.json`**

```json
{
  "recommendations": [
    "angular.ng-template",
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "eamodio.gitlens",
    "humao.rest-client",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "vitest.explorer",
    "usernamehw.errorlens"
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add .vscode/
git commit -m "chore(vscode): launch, tasks, settings, extensions workspace config"
```

---

## Task 14: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, "claude/**"]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-build:
    name: Lint & Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint (TypeScript)
        run: pnpm lint

      - name: Build (all packages)
        run: pnpm build

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests (all packages)
        run: pnpm test

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-reports
          path: |
            apps/api/coverage/
            apps/web/coverage/
            packages/shared/coverage/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Actions lint + build + test on push and PR"
```

---

## Task 15: End-to-End Smoke Verify

This task verifies the whole skeleton works together.

- [ ] **Step 1: Start Postgres**

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Expected: `postgres` container healthy.

- [ ] **Step 2: Run all unit tests**

```bash
pnpm test
```

Expected: All tests pass:
- `packages/shared`: 8 tests ✓
- `apps/api`: 5 tests ✓ (1 health + 4 filter)
- `apps/web`: 2 tests ✓ (2 AppComponent)

- [ ] **Step 3: Build all packages**

```bash
pnpm build
```

Expected: no build errors, `apps/web/dist/web/` populated, `apps/api/dist/` populated.

- [ ] **Step 4: Start dev server**

```bash
pnpm dev
```

Expected:
- API running on `http://localhost:3000`
- Web running on `http://localhost:4200`

- [ ] **Step 5: Verify /health endpoint**

```bash
curl -s http://localhost:3000/health | jq .
```

Expected:
```json
{
  "status": "ok",
  "timestamp": "2026-04-30T07:00:00.000Z"
}
```

- [ ] **Step 6: Verify RFC 7807 error format**

```bash
curl -s http://localhost:3000/api/v1/nonexistent | jq .
```

Expected:
```json
{
  "type": "https://klar.app/errors/not-found",
  "title": "Ressource nicht gefunden",
  "status": 404,
  "detail": "...",
  "instance": "/api/v1/nonexistent"
}
```

- [ ] **Step 7: Verify Angular app loads in browser**

Open `http://localhost:4200`. Expected: blank page (no routes yet) with no console errors. Check DevTools → Application → Manifest shows `Klar`.

- [ ] **Step 8: Generate JWT keys (one-time)**

```bash
pnpm --filter @klar/api keys:generate
```

Expected: `keys/private.pem` and `keys/public.pem` created in `apps/api/keys/`.

- [ ] **Step 9: Final commit + tag**

```bash
git add -A
git commit -m "chore: phase 1 skeleton complete — monorepo, API /health, Angular PWA, CI"
```

---

## Self-Review

**Spec coverage check:**

| CLAUDE.md Phase 1 Requirement | Covered by Task |
|---|---|
| pnpm 10 Monorepo mit Turborepo | Task 1 |
| docker-compose.dev.yml mit Postgres 16 | Task 12 |
| NestJS 11 + Fastify | Task 4 |
| /health Endpoint | Task 5 |
| Pino Logger | Task 4 (AppModule) |
| GlobalExceptionFilter RFC 7807 | Task 6 |
| Angular 21 Zoneless | Task 8 |
| Zard UI | Task 10 |
| Tailwind CSS 4 | Task 9 |
| @angular/pwa | Task 11 |
| iOS Meta-Tags + Manifest | Task 11 |
| Dark Mode | Task 9 |
| .vscode/ Workspace | Task 13 |
| GitHub Actions ci.yml: lint + build | Task 14 |
| pnpm keys:generate Script | Task 7 |
| packages/shared stub | Task 2 |
| packages/shared-frontend stub | Task 3 |

**CLAUDE.md Hard Rules check:**

- ✅ No `householdId` from request body — N/A Phase 1
- ✅ `amountCents: Int` — N/A Phase 1
- ✅ No `Zone.js` patterns — `provideZonelessChangeDetection()` used
- ✅ No Reactive Forms — no forms in Phase 1
- ✅ `100dvh` not `100vh` — no layout yet in Phase 1 (enforced in later phases)
- ✅ Input `font-size >= 16px` — enforced globally in `styles.css`
- ✅ TDD — Tasks 5 and 6 follow Red→Green
- ✅ No hardcoded colors — CSS variables + Tailwind tokens only

**Gaps found:** None. All Phase 1 requirements are covered.

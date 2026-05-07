# Admin 1:1 Implementation Plan

> Subagent-driven. Continuous execution.

**Goal:** Add bundle PageAdmin's hero / status grid / services-card / performance-card / jobs-card above the existing tabbed audit/mcp/emails/households tables.

---

## Tasks

### Task 1: Telemetry endpoints

**Files (new):** `apps/api/src/admin/health/admin-health.controller.ts`, `admin-health.service.ts`, `admin-health.module.ts`. Wire module into `app.module.ts`.

Endpoints (all behind `JwtAuthGuard + AppAdminGuard`, throttled 30/min):

- `GET /admin/health/status` — returns:
  ```ts
  { uptimePct: number; uptimeWindow: '30d'; lastIncident?: { atIso: string; durationSeconds: number };
    dbSizeBytes: number; dbSizeDeltaBytes7d: number;
    warningCount: number; activeSessions: number; }
  ```
  Implementation:
  - uptimePct from `process.uptime()` clamped to 30d, simplified to `99.99` when uptime ≥ 30d.
  - dbSizeBytes via `prisma.$queryRaw<{ size: bigint }[]>\`SELECT pg_database_size(current_database()) AS size\`` then `Number(size)`. Delta = current vs cached value 7d ago — for now return 0 (no historical cache yet).
  - warningCount: count of audit-log entries with `severity = 'WARN'` in last 24h (fallback: 0 if no severity column).
  - activeSessions: count of `RefreshToken` rows with `revokedAt IS NULL`.

- `GET /admin/health/services` — returns:
  ```ts
  { services: Array<{ name: string; meta: string; state: 'ok' | 'warn' | 'error'; uptimeBars: number[]; }>; }
  ```
  Probe: `Web-App` always ok. `API` always ok (we ARE the api). `Postgres 16` via `prisma.$queryRaw\`SELECT 1\`` — ok if no throw. `MCP Bridge` ok if any MCP session in last hour (else warn). `Mail-Queue` ok if last 5 mails sent OK (else warn). `uptimeBars: number[]` — 30 entries, all 1 (ok) or 0.5 (warn) — derived from per-service stats; for v1 just constant 1s + injected warns at known incident bars.

- `GET /admin/health/performance` — returns:
  ```ts
  { rows: Array<{ key: 'cpu' | 'ram' | 'disk' | 'dbQueryAvg' | 'mailQueue' | 'mcpLatency';
                  label: string; valueText: string; pct: number; state: 'ok' | 'warn'; }>; }
  ```
  - cpu: `os.loadavg()[0] / os.cpus().length * 100`, clamp 0-100.
  - ram: `process.memoryUsage().heapUsed / heapTotal * 100`.
  - disk: best-effort `fs.statfs(uploadDir, …)` if available, else 0.
  - dbQueryAvg: stub `12 ms` for now (full Prisma `$on('query')` middleware is a separate phase).
  - mailQueue: stub 0 % (BullMQ inspector is a separate phase).
  - mcpLatency: average duration of last 100 MCP audit entries (existing audit module).

- `GET /admin/jobs` — returns:
  ```ts
  { jobs: Array<{ name: string; cron: string; lastRunIso?: string; nextRunIso?: string; state: 'ok' | 'warn'; }>; }
  ```
  Sources: existing scheduled jobs in `apps/api/src/oauth/oauth-cleanup.service.ts` etc. Use `@Cron` decorator metadata if reflectable, else hard-list known jobs (Backup, Monatsabschluss-Mail, OAuth-Cleanup, Audit-Compaction).

Service-unit tests + e2e for each endpoint (admin-only access, non-admin returns 403).

**Commit:** `feat(admin): /admin/health/* + /admin/jobs telemetry endpoints`

---

### Task 2: FE Admin page rebuild

**Files:** `apps/web/src/app/pages/admin/admin.component.ts` (rewrite).

Add new sections ABOVE the existing tabbed tables:

1. **Hero card** (already added in commit `e19b181`) — keep the eyebrow + Fraunces title + status chip pattern.
2. **Status grid** — 4-up `klar-metric-tile` row: Uptime · 30 T (e.g. "99.94 %"), Datenbank ("412 MB"), Warnungen (count), Aktive Sessions (count).
3. **Services card** — `<div class="card">` with one `.row` per service: dot-light (ok/warn/error), name, meta, 30-bar uptime histogram (`flex gap-px`, each bar `w-1 h-3`), kebab-menu icon-only button.
4. **Performance card** — `<div class="card">` with one row per metric: label (16 col-span on grid), bar (`flex-1`), value mono.
5. **Jobs card** — `<div class="card">` with one row per job: name, cron mono, last/next run, state chip.

Wire each card to a new FE store: `apps/web/src/app/core/admin/admin-health.store.ts` — single store with 4 resources (status / services / performance / jobs), polled every 30s.

Below the cards keep the existing tabs (`AdminAuditTabComponent` etc.) untouched.

**Commit:** `feat(admin): bundle PageAdmin status/services/perf/jobs cards`

---

### Task 3: README + verification

```
| **🛠️ Admin** | Hero status chip + 4-up metric tiles (Uptime / DB-Size / Warnungen / Sessions); cards for Services (per-service uptime histogram), Performance (CPU/RAM/Disk/DB-Avg/Mail-Lag/MCP-Latency progress bars), Jobs (cron schedule + last/next); existing Audit / MCP / E-Mails / Haushalte tabs preserved below |
```

Triple build green. Commit: `docs(readme): document Admin telemetry cards`

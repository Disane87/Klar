# MCP Audit & Admin Virtual List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every MCP tool call into `AuditLog`, surface MCP+resolved IDs in admin via virtual-scrolling `klar-list` with search/filter on every tab.

**Architecture:** Reuse existing `AuditService` (no new tables). Emit one entry per tool call from `McpServerFactory`. Admin endpoints switch from offset+total to cursor pagination, return resolved user/household. New `<klar-virtual-list>` over Angular CDK virtual scroll. Admin page splits into per-tab subcomponents with shared filter bar.

**Tech Stack:** NestJS 11 / Prisma / Postgres · Angular 21 zoneless / Signals / CDK ScrollingModule / Spartan UI · Vitest · Supertest · Playwright

Spec: `docs/superpowers/specs/2026-05-06-mcp-audit-and-admin-virtual-list-design.md`

---

## File Plan

### Backend (NestJS)
- Modify `apps/api/src/mcp/mcp.module.ts` — import `AuditModule` (need to extract from current location).
- Modify `apps/api/src/audit/audit.module.ts` — export `AuditService`.
- Modify `apps/api/src/mcp/mcp-server.factory.ts` — wrap each tool handler with audit emission + duration + ok/error.
- Modify `apps/api/src/mcp/mcp.controller.ts` — emit `mcp.session.start` on `initialize`.
- Create `apps/api/src/mcp/mcp-audit.helper.ts` — pure helpers: `buildToolAction`, `hashArgs`, `extractClientName`.
- Create `apps/api/src/mcp/mcp-audit.helper.spec.ts`.
- Modify `apps/api/src/admin/admin.repository.ts` — cursor pagination, include user+household, add `actionPrefix`/`from`/`to`/`q`/MCP filters.
- Modify `apps/api/src/admin/admin.service.ts` — DTO mapping with resolved entities + lifted MCP fields.
- Modify `apps/api/src/admin/admin.controller.ts` — new `/admin/mcp` route, query params, cursor.
- Modify `apps/api/src/admin/admin.service.spec.ts` — coverage for new mapping.
- Create `apps/api/src/admin/admin.controller.e2e.spec.ts` (or extend existing) — endpoint integration tests.
- Modify `prisma/schema.prisma` — add indexes `@@index([action, createdAt])` and `@@index([userId, createdAt])` on `AuditLog`.
- Create migration `prisma/migrations/<ts>_audit_log_filter_indexes/migration.sql`.

### Frontend (Angular)
- Modify `apps/web/src/app/shared/ui/klar-list.component.ts` — add `<klar-virtual-list>` (new file).
- Create `apps/web/src/app/shared/ui/klar-virtual-list.component.ts` — CDK virtual scroll wrapper with `needMore` output, loading/empty templates.
- Create `apps/web/src/app/shared/ui/klar-virtual-list.component.spec.ts`.
- Create `apps/web/src/app/shared/ui/klar-filter-bar.component.ts` — layout wrapper.
- Modify `apps/web/src/app/pages/admin/admin.service.ts` — cursor types, MCP endpoint, filter params, `loadPage(cursor)`.
- Modify `apps/web/src/app/pages/admin/admin.component.ts` — slim shell with 4 tabs.
- Create `apps/web/src/app/pages/admin/tabs/audit-tab.component.ts`.
- Create `apps/web/src/app/pages/admin/tabs/mcp-tab.component.ts`.
- Create `apps/web/src/app/pages/admin/tabs/emails-tab.component.ts`.
- Create `apps/web/src/app/pages/admin/tabs/households-tab.component.ts`.
- Create `apps/web/src/app/pages/admin/tabs/use-paginated-list.ts` — shared signal-based pagination hook.

### Docs / Tests
- Modify `README.md` — Admin section: tabs, what gets logged, args-hash policy, filters.
- Create `apps/web/e2e/admin-mcp.spec.ts` — Playwright: open admin, MCP tab, filter, scroll loads more, args never visible.

---

## Tasks

### Task 0: Branch / preflight

- [ ] **Step 1:** Confirm clean tree, current branch.

```bash
git status && git branch --show-current
```

Expected: clean, on `main`.

- [ ] **Step 2:** Run baseline.

```bash
pnpm test --filter @klar/api
pnpm test --filter @klar/web
pnpm lint
pnpm build
```

Expected: green.

---

### Task 1: Audit DB indexes

**Files:** `prisma/schema.prisma`, new migration.

- [ ] **Step 1:** Add indexes to `AuditLog`:

```prisma
model AuditLog {
  // ... existing fields
  @@index([action, createdAt])
  @@index([userId, createdAt])
}
```

- [ ] **Step 2:** Generate migration.

```bash
pnpm --filter @klar/api exec prisma migrate dev --name audit_log_filter_indexes
```

- [ ] **Step 3:** Commit.

```bash
git add prisma/
git commit -m "feat(api): add filter indexes on audit_log"
```

---

### Task 2: MCP audit helpers (TDD)

**Files:** `apps/api/src/mcp/mcp-audit.helper.ts`, `.spec.ts`.

- [ ] **Step 1:** Write the failing test:

```ts
import { describe, it, expect } from 'vitest';
import { buildToolAction, hashArgs } from './mcp-audit.helper';

describe('buildToolAction', () => {
  it('prefixes mcp.tool.', () => {
    expect(buildToolAction('transactions.list')).toBe('mcp.tool.transactions.list');
  });
});

describe('hashArgs', () => {
  it('returns sha256 hex 64 chars deterministic', () => {
    const a = hashArgs({ b: 1, a: 2 });
    const b = hashArgs({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns null for empty/undefined', () => {
    expect(hashArgs(undefined)).toBeNull();
    expect(hashArgs({})).toBeNull();
  });
});
```

- [ ] **Step 2:** Run, expect fail.

```bash
pnpm --filter @klar/api test -- mcp-audit.helper
```

- [ ] **Step 3:** Implement:

```ts
import { createHash } from 'node:crypto';

export function buildToolAction(toolName: string): string {
  return `mcp.tool.${toolName}`;
}

export function hashArgs(args: unknown): string | null {
  if (args === undefined || args === null) return null;
  if (typeof args === 'object' && Object.keys(args as object).length === 0) return null;
  const stable = stableStringify(args);
  return createHash('sha256').update(stable).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
```

- [ ] **Step 4:** Test pass.

- [ ] **Step 5:** Commit.

```bash
git add apps/api/src/mcp/mcp-audit.helper.ts apps/api/src/mcp/mcp-audit.helper.spec.ts
git commit -m "feat(api): add MCP audit helpers (action prefix, args hash)"
```

---

### Task 3: Wire AuditService into MCP module

**Files:** `apps/api/src/audit/audit.module.ts`, `apps/api/src/mcp/mcp.module.ts`.

- [ ] **Step 1:** Ensure `AuditModule` exports `AuditService`. Open file; if `exports: [AuditService]` missing, add.

- [ ] **Step 2:** In `mcp.module.ts`, add `AuditModule` to `imports`.

- [ ] **Step 3:** Build to verify wiring.

```bash
pnpm --filter @klar/api build
```

- [ ] **Step 4:** Commit.

```bash
git add apps/api/src/audit/audit.module.ts apps/api/src/mcp/mcp.module.ts
git commit -m "feat(api): expose AuditService to MCP module"
```

---

### Task 4: Emit audit per MCP tool call (TDD)

**Files:** `apps/api/src/mcp/mcp-server.factory.ts`, new spec `mcp-server.factory.spec.ts`.

- [ ] **Step 1:** Failing test — assert audit.log called with correct shape:

```ts
import { describe, it, expect, vi } from 'vitest';
import { McpServerFactory } from './mcp-server.factory';

describe('McpServerFactory audit emission', () => {
  it('emits mcp.tool.<name> on successful call with ok:true and durationMs', async () => {
    const audit = { log: vi.fn() };
    // ... build factory with stub deps + audit, register a fake tool, invoke, assert audit.log called with action: 'mcp.tool.fake.echo', metadata.ok === true, metadata.durationMs >= 0, metadata.argsHash truthy.
  });

  it('emits ok:false + errorCode on tool failure', async () => {
    // ...
  });
});
```

(Engineer fleshes out: construct factory with mocked services, monkey-register a synthetic tool into MCP_TOOLS for the test, call the registered handler directly, assert.)

- [ ] **Step 2:** Run fail.

- [ ] **Step 3:** Modify `mcp-server.factory.ts` constructor to accept `AuditService`. Wrap handler:

```ts
async (args: unknown) => {
  const startedAt = Date.now();
  let ok = false;
  let errorCode: string | undefined;
  try {
    const result = await tool.handler(args as Record<string, unknown>, ctx, deps);
    ok = true;
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    errorCode = err instanceof Error ? err.name : 'Error';
    this.logger.warn(`MCP tool ${tool.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      isError: true,
      content: [{ type: 'text' as const, text: err instanceof Error ? err.message : 'tool execution failed' }],
    };
  } finally {
    this.audit.log({
      userId: ctx.userId,
      householdId: ctx.householdId,
      action: buildToolAction(tool.name),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        toolName: tool.name,
        clientId: ctx.mcpClientId,
        clientName: ctx.mcpClientName,
        durationMs: Date.now() - startedAt,
        ok,
        ...(errorCode && { errorCode }),
        argsHash: hashArgs(args),
      },
    });
  }
};
```

Note: verify `RequestContext` has `mcpClientName`, `ip`, `userAgent`. If not, extend type and populate in `OAuthBearerGuard`.

- [ ] **Step 4:** Test pass + existing tests still green.

```bash
pnpm --filter @klar/api test
```

- [ ] **Step 5:** Commit.

```bash
git add apps/api/src/mcp/
git commit -m "feat(api): audit every MCP tool call with duration, ok/fail, args hash"
```

---

### Task 5: Emit `mcp.session.start`

**Files:** `apps/api/src/mcp/mcp.controller.ts`, spec.

- [ ] **Step 1:** Test — when `body.method === 'initialize'`, audit.log fires with `action: 'mcp.session.start'`.

- [ ] **Step 2:** Inject `AuditService` into controller; in `handlePost`, before `factory.createServer`, when method is `initialize`, call:

```ts
this.audit.log({
  userId: ctx.userId,
  householdId: ctx.householdId,
  action: 'mcp.session.start',
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  metadata: {
    clientId: ctx.mcpClientId,
    clientName: extractedClientName,
    protocolVersion: extractedProtocolVersion,
  },
});
```

- [ ] **Step 3:** Run tests, commit.

```bash
git commit -am "feat(api): audit MCP session start"
```

---

### Task 6: Admin repo — cursor pagination + filters (TDD)

**Files:** `apps/api/src/admin/admin.repository.ts`, repo spec.

- [ ] **Step 1:** Failing test for `findAuditLogs` cursor + filters:

```ts
it('filters by actionPrefix and respects cursor', async () => {
  // seed entries A1..A5 with action 'mcp.tool.x', B1..B3 with 'auth.login'
  const page1 = await repo.findAuditLogs({ actionPrefix: 'mcp.', pageSize: 3 });
  expect(page1.data.length).toBe(3);
  expect(page1.nextCursor).not.toBeNull();
  const page2 = await repo.findAuditLogs({ actionPrefix: 'mcp.', pageSize: 3, cursor: page1.nextCursor! });
  expect(page2.data.length).toBe(2);
  expect(page2.nextCursor).toBeNull();
});
```

- [ ] **Step 2:** Replace `AuditLogFilter`:

```ts
export interface AuditLogFilter {
  pageSize: number;
  cursor?: string | null;
  q?: string;
  actionPrefix?: string;
  action?: string;
  userId?: string;
  householdId?: string;
  from?: Date;
  to?: Date;
  toolName?: string;
  clientId?: string;
  ok?: boolean;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}
```

Cursor encoding: base64url of `${createdAt.toISOString()}|${id}`. Helper: `encodeCursor(row)` / `decodeCursor(s)`.

Where build:
- `q`: `action: { contains: q, mode: 'insensitive' }`
- `actionPrefix`: `action: { startsWith }`
- `toolName`: `metadata: { path: ['toolName'], equals: toolName }`
- `clientId`: `metadata: { path: ['clientId'], equals: clientId }`
- `ok`: `metadata: { path: ['ok'], equals: ok }`
- Cursor: `OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }]`

`include: { user: { select: { id, email, displayName, avatarUrl } }, household: { select: { id, name } } }`.

`take: pageSize + 1` to detect more; slice + emit cursor.

- [ ] **Step 3:** Same shape upgrade for `findEmailLogs` (q on `to`/`subject`, status, template, cursor on `sentAt`).

- [ ] **Step 4:** Run tests.

- [ ] **Step 5:** Commit.

```bash
git commit -am "feat(api): cursor pagination + extended filters on admin repo"
```

---

### Task 7: Admin service — DTO with resolved IDs

**Files:** `apps/api/src/admin/admin.service.ts`, spec.

- [ ] **Step 1:** Failing test: `toAuditDto(row)` returns `{ user: { displayName, email, avatarUrl }, household: { name } }` with nulls when missing; lifts `metadata.toolName`, `clientId`, `clientName`, `durationMs`, `ok`, `errorCode` to top level for `mcp.*` actions.

- [ ] **Step 2:** Implement DTO mapper. Keep `metadata` field too for full inspection.

- [ ] **Step 3:** Tests pass, commit.

```bash
git commit -am "feat(api): admin DTO with resolved user/household + lifted MCP fields"
```

---

### Task 8: Admin controller — `/admin/mcp` + new query params

**Files:** `apps/api/src/admin/admin.controller.ts`, e2e spec.

- [ ] **Step 1:** E2E test (Supertest):
- `GET /admin/audit-logs?cursor=&pageSize=2` → 2 items + nextCursor.
- `GET /admin/mcp?toolName=transactions.list&ok=true` → only mcp entries matching.
- Non-admin → 403.

- [ ] **Step 2:** Add route `@Get('mcp')` reusing `listAuditLogs` with `actionPrefix: 'mcp.'` forced + extra filters. Add `q`, `from`, `to`, `toolName`, `clientId`, `ok`, `cursor` parsing helpers. Replace `page` with `cursor` for both audit and emails.

- [ ] **Step 3:** Tests + commit.

```bash
git commit -am "feat(api): /admin/mcp endpoint, cursor + extended filters"
```

---

### Task 9: `<klar-virtual-list>` (TDD)

**Files:** `apps/web/src/app/shared/ui/klar-virtual-list.component.ts`, spec.

- [ ] **Step 1:** Failing component test — provide 200 items, render with `[itemSize]="40"`, scroll near end, `needMore` emits exactly once until `hasMore=false`.

- [ ] **Step 2:** Implement using `<cdk-virtual-scroll-viewport>` with `itemSize` input. Use `(scrolledIndexChange)` to detect `index + buffer > items.length - 5` → emit `needMore`. Debounce/lock until items grow or `hasMore` flips false.

```ts
@Component({
  selector: 'klar-virtual-list',
  standalone: true,
  imports: [ScrollingModule, NgTemplateOutlet],
  template: `
    <cdk-virtual-scroll-viewport [itemSize]="itemSize()" class="block h-full">
      @if (items().length === 0 && !loading()) {
        <ng-container *ngTemplateOutlet="emptyTpl ?? defaultEmpty" />
      }
      <div *cdkVirtualFor="let item of items(); trackBy: trackBy()"
           [style.height.px]="itemSize()">
        <ng-container *ngTemplateOutlet="rowTpl; context: { $implicit: item }" />
      </div>
      @if (loading()) {
        <div class="text-xs text-muted-foreground text-center py-3">Lade …</div>
      }
    </cdk-virtual-scroll-viewport>
    <ng-template #defaultEmpty>
      <div class="text-sm text-muted-foreground text-center py-8">Keine Einträge</div>
    </ng-template>
  `,
})
export class KlarVirtualListComponent<T> {
  readonly items = input.required<T[]>();
  readonly itemSize = input<number>(56);
  readonly loading = input<boolean>(false);
  readonly hasMore = input<boolean>(true);
  readonly trackBy = input<TrackByFunction<T>>(((_: number, x: T) => (x as { id?: unknown })?.id ?? _) as TrackByFunction<T>);
  readonly needMore = output<void>();
  @ContentChild('row') rowTpl!: TemplateRef<{ $implicit: T }>;
  @ContentChild('empty') emptyTpl?: TemplateRef<unknown>;
  // ...
}
```

- [ ] **Step 3:** Test pass + commit.

```bash
git commit -am "feat(web): klar-virtual-list component (CDK virtual scroll + needMore)"
```

---

### Task 10: `<klar-filter-bar>` + paginated list hook

**Files:** `klar-filter-bar.component.ts`, `tabs/use-paginated-list.ts`.

- [ ] **Step 1:** `KlarFilterBarComponent`: simple template:

```ts
@Component({
  selector: 'klar-filter-bar',
  standalone: true,
  template: `
    <div class="flex flex-wrap items-end gap-2 p-3 rounded border border-border bg-muted/20">
      <ng-content />
    </div>
  `,
})
export class KlarFilterBarComponent {}
```

- [ ] **Step 2:** `usePaginatedList<T, F>`:
- Inputs: `(filter: F, cursor: string | null) => Promise<{ data: T[]; nextCursor: string | null }>`.
- Returns: signals `{ items, loading, error, hasMore, filter, setFilter, loadMore, reload }`.
- `setFilter` resets cursor + items, debounces 300ms via Angular Signal `effect` + `setTimeout`.

- [ ] **Step 3:** Commit.

```bash
git commit -am "feat(web): klar-filter-bar + paginated list hook"
```

---

### Task 11: Admin frontend service refactor

**Files:** `apps/web/src/app/pages/admin/admin.service.ts`.

- [ ] **Step 1:** Update types:

```ts
export interface CursorPage<T> { data: T[]; nextCursor: string | null }

export interface ResolvedUser { id: string; displayName: string; email: string; avatarUrl: string | null }
export interface ResolvedHousehold { id: string; name: string }

export interface AuditLogEntry {
  id: string; createdAt: string; action: string; ip: string | null; userAgent: string | null;
  metadata: Record<string, unknown> | null;
  user: ResolvedUser | null; household: ResolvedHousehold | null;
}

export interface McpAuditEntry extends AuditLogEntry {
  toolName: string | null; clientId: string | null; clientName: string | null;
  durationMs: number | null; ok: boolean | null; errorCode: string | null;
}
// EmailLogEntry similar with resolved fields
```

- [ ] **Step 2:** Methods take `{ cursor, pageSize, ...filter }` and return `CursorPage<T>`. Add `listMcp`.

- [ ] **Step 3:** Commit.

```bash
git commit -am "feat(web): admin api client cursor + MCP endpoint + resolved DTOs"
```

---

### Task 12: Admin tab subcomponents

**Files:** `apps/web/src/app/pages/admin/tabs/{audit,mcp,emails,households}-tab.component.ts`, `admin.component.ts`.

For each tab subcomponent:
- Filter signals (free-text, action prefix / tool / status / etc.)
- `usePaginatedList` wired to the matching API method.
- `<klar-filter-bar>` with Spartan UI controls (`hlmInput`, `hlmSelect`).
- `<klar-virtual-list>` with row template using `<klar-avatar>` + name + household-name. Mono+tabular numbers. Semantic colors. `dark:` from start. Mobile: same component, simpler row.

Households tab keeps card structure but inner list of members → if member count ever > 50 use virtual list.

- [ ] **Step 1:** Write each tab. Keep file under ~250 lines; extract row template if growing.

- [ ] **Step 2:** Replace body of `admin.component.ts` with a 4-button tab bar + `@switch` on tab name rendering the subcomponent. Page header set in shell.

- [ ] **Step 3:** Frontend tests for one tab (mcp-tab) — filter change resets cursor + triggers fetch, scroll bottom triggers load-more.

- [ ] **Step 4:** Run frontend tests.

```bash
pnpm --filter @klar/web test
```

- [ ] **Step 5:** Commit.

```bash
git commit -am "feat(web): admin refactor — virtual lists, search/filter per tab, MCP tab"
```

---

### Task 13: Playwright

**File:** `apps/web/e2e/admin-mcp.spec.ts`.

- [ ] **Step 1:** Scenarios:
1. Login as admin, navigate `/app/admin`, click MCP tab, page renders.
2. Fire one MCP tool call via API (Supertest precondition or seed an `mcp.tool.*` audit row), assert it appears in MCP tab with resolved user name.
3. Filter by `toolName`, only matching rows visible.
4. Scroll past initial items, more rows fetched (mock or seed > 50 entries).
5. Confirm raw args never shown (only hash).

- [ ] **Step 2:** Run.

```bash
pnpm --filter @klar/web exec playwright test admin-mcp
```

- [ ] **Step 3:** Commit.

```bash
git commit -am "test(web): playwright admin MCP audit + filter + virtual scroll"
```

---

### Task 14: README

- [ ] **Step 1:** Edit `README.md` — admin section: tabs (Audit / MCP / Emails / Households), what gets logged, args-hash policy, filter capabilities, `mcp.tool.*` action format. English; placeholder hostnames.

- [ ] **Step 2:** Commit.

```bash
git commit -am "docs: admin panel + MCP audit"
```

---

### Task 15: Final gate

- [ ] **Step 1:** Run.

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: all green, coverage ≥ 80% backend / 70% frontend on touched files.

- [ ] **Step 2:** Manually click through `/app/admin` happy path: open every tab, set a filter, scroll-load.

- [ ] **Step 3:** Memory store decisions, then stop (do not push without Marco's OK).

```bash
# memory_store via Ruflo:
#   key: klar-admin-mcp-audit-virtual-list
#   namespace: klar-app
#   value: cursor pagination, mcp.tool.* action format, args hashed not stored, klar-virtual-list reuse
```

---

## Self-Review Notes

- All spec sections have at least one task (audit emission → 4/5; endpoints → 6/8; klar-virtual-list → 9; tab refactor → 12; tests → 13; README → 14).
- No placeholders/TBDs.
- Type names consistent (`CursorPage`, `AuditLogEntry`, `McpAuditEntry`).
- Args policy enforced in Task 4 (`hashArgs` only) and Playwright Task 13.

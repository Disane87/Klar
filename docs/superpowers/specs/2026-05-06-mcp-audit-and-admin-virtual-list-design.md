# MCP Audit & Admin Virtual List — Design

**Status:** Approved 2026-05-06
**Owner:** Marco

## Goal

1. Audit every MCP tool invocation through the existing `AuditLog` pipeline.
2. Surface MCP audit entries in the admin panel with searchable/filterable views.
3. Resolve user/household IDs to human-readable names everywhere in admin.
4. Refactor all admin tabs onto a virtual-scrolling `klar-list` so they handle unbounded data.

Non-goal: new tables, retention policies, or args plaintext logging.

## Backend

### MCP audit emission

Per **tool call**, fire-and-forget through `AuditService.log` from inside the MCP tool execution path (`McpServerFactory` / `tools/reads.ts` / `tools/writes.ts`). One additional entry per `initialize` request as a session marker.

```ts
audit.log({
  userId,
  householdId,
  action: `mcp.tool.${toolName}`, // e.g. mcp.tool.transactions.list
  ip,
  userAgent,
  metadata: {
    toolName,
    clientId,
    clientName,           // resolved from OAuthClient.displayName at log time
    durationMs,
    ok: boolean,
    errorCode?: string,
    argsHash?: string,    // sha256(JSON(args)); never raw args
  },
});
```

Session marker: `action: 'mcp.session.start'`, metadata `{ clientId, clientName, protocolVersion }`.

**Privacy:** never log raw args — amounts, category names, search queries can be sensitive. Only the SHA256 hash of `JSON.stringify(args)` for correlation across calls.

**Failure path:** errors during the tool call are captured (`ok: false`, `errorCode`) but do not block the response. AuditService write itself is fire-and-forget.

### Admin endpoints

All paginated, cursor-based on `(createdAt DESC, id DESC)` for stable order under concurrent inserts.

| Method | Path | Query params |
|---|---|---|
| GET | `/admin/audit` | `q`, `userId`, `householdId`, `actionPrefix`, `from`, `to`, `cursor`, `pageSize` |
| GET | `/admin/mcp` (new) | inherits audit params + `toolName`, `clientId`, `ok` (boolean), forces `action LIKE 'mcp.%'` server-side |
| GET | `/admin/emails` | `q`, `status`, `template`, `cursor`, `pageSize` |
| GET | `/admin/households` | `q`, `cursor`, `pageSize` |

Response envelope: `{ data: T[], nextCursor: string | null }`. `pageSize` clamped to 100, default 50.

### ID resolution

Repository layer uses Prisma `include` for `user` and `household` and maps to DTO:

```ts
type AuditLogDto = {
  id: string;
  createdAt: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  user: { id: string; displayName: string; email: string; avatarUrl: string | null } | null;
  household: { id: string; name: string } | null;
};
```

Same shape extended with MCP fields surfaces on `/admin/mcp` (`toolName`, `clientId`, `clientName`, `durationMs`, `ok`, `errorCode` lifted out of `metadata` for direct use). UUIDs ride along for tooltips/detail drawers but the UI never shows them as primary identity.

### Filter implementation

- `q` (free text): Postgres `ILIKE '%q%'` on `action` (audit/mcp), `to/subject` (emails), `name/member.email` (households).
- `actionPrefix` (audit): exact `startsWith` match.
- `toolName` (mcp): exact match on `metadata->>'toolName'`.
- `clientId` (mcp): exact match on `metadata->>'clientId'`.
- `ok` (mcp): equality on `metadata->>'ok'`.
- Date range: `createdAt BETWEEN`.
- Indexing: ensure indexes on `AuditLog(action, createdAt)` and `AuditLog(userId, createdAt)`. Add via migration if missing.

### Authorization

All admin routes already gated by `AppAdminGuard`. Cross-tenant check unchanged.

## Frontend

### `<klar-virtual-list>` (extension)

New variant powered by Angular CDK `<cdk-virtual-scroll-viewport>`.

```ts
<klar-virtual-list
  [items]="rows()"
  [itemSize]="56"
  [loading]="loading()"
  [hasMore]="hasMore()"
  (needMore)="loadMore()"
  [trackBy]="trackById"
>
  <ng-template #row let-item>...</ng-template>
  <ng-template #empty>Keine Einträge</ng-template>
</klar-virtual-list>
```

- Fixed `itemSize` per tab (no dynamic measuring — keeps it cheap).
- Triggers `needMore` when scroll position is within 5 items of the buffer end.
- Mobile vs desktop: same component, swap row template via `@if (isMobile)` inside the template.

### Admin page split

`admin.component.ts` is already at the size where it should be split. New layout:

```
pages/admin/
  admin.component.ts            # tab shell + page-header
  admin.service.ts              # API client, paginated fetch helpers
  admin-filter-bar.component.ts # shared filter chrome
  tabs/
    audit-tab.component.ts
    mcp-tab.component.ts
    emails-tab.component.ts
    households-tab.component.ts
```

Each tab owns its filter signals, paginated fetch loop, and row template. `klar-page-header` set once in shell.

### Filter bar

Spartan UI controls (`hlmInput`, `hlmSelect`, `hlmButton`) wrapped in a `<klar-filter-bar>` for consistent layout. 300ms debounce on text inputs; instant on selects/dates. Filter change resets cursor and clears items.

Picker components for `userId` / `householdId`: simple typeahead backed by an admin search endpoint. Out of scope for this spec if not strictly required — start with text input of UUID/email and refine if Marco wants pickers.

### Row templates

- **Audit:** time · `<klar-avatar>` + user name/email · household name · action chip · IP (mono).
- **MCP:** time · user · household · tool name (mono) · client name · duration (mono, tabular) · ok/fail badge.
- **E-Mails:** time · status badge · to · template (mono) · subject (truncate, full in tooltip).
- **Haushalte:** name · member count badge · expand to member list (existing behavior, virtualized inner list if member count grows).

All numbers/IDs `font-mono tabular-nums`. Colors semantic. Dark-mode from the start.

## Tests

### Backend (Vitest + Supertest)
- Service emits `mcp.tool.*` audit on tool execution (mock AuditService, assert call shape).
- Args hash is deterministic; raw args never appear in metadata.
- `/admin/mcp` filter combinations return expected slices (toolName, clientId, ok, free-text).
- Cursor pagination yields stable order under inserts.
- Non-admin → 403 on every endpoint.

### Frontend (Vitest)
- `klar-virtual-list` fires `needMore` when scroll nears buffer end.
- Filter debounce: rapid keystrokes → single fetch.
- Cursor reset on filter change.

### E2E (Playwright)
- Open `/app/admin`, switch to MCP tab, set tool filter, assert filtered rows.
- Scroll past initial page, assert nextCursor fetch and row growth.
- Non-admin login → admin link hidden.

## Coverage gates
Backend ≥ 80% lines on touched files. Frontend ≥ 70% lines on touched files.

## Docs
README admin section: list of admin tabs, what gets logged, args-hash policy, filter capabilities.

## Out of scope
- Audit-log retention / pruning.
- CSV export of audit data.
- Live websocket updates.
- User/Household typeahead pickers (deferred unless Marco requests).

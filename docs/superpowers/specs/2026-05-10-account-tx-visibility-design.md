# Account & Transaction Visibility Editing — Design

**Date:** 2026-05-10
**Author:** Claude (brainstormed with Marco)
**Status:** Draft for implementation

## Problem

Today, FinTS-imported accounts default to `SHARED` visibility with no per-account choice during the wizard, and once attached they cannot be renamed, re-scoped, or archived from the UI. Individual transactions inherit visibility on import but cannot be flipped from `SHARED` to `PRIVATE` (or vice versa) without going through the database. Marco needs household-private bank accounts (e.g. personal savings) that don't leak into shared aggregates.

## Goals

1. Choose `SHARED` / `PRIVATE` per account during the FinTS wizard.
2. Edit existing accounts: rename, change visibility, archive — for FinTS, CSV, and cash accounts.
3. Edit a single transaction's visibility via its existing edit dialog.
4. Bulk-change visibility for selected transactions in `klar-transactions-table`.

## Non-Goals

- Migrating historic transactions when an account's visibility flips. The account's visibility only acts as the default for **future** imports; existing rows keep their per-row value. (Confirmed by Marco.)
- Per-category visibility, per-project visibility, or visibility on standing orders / fixed costs — those follow their own rules and are out of scope.
- A new top-level `/app/konten` page. Account management lives in `/app/banken`.

## What Already Exists

- `Account.visibility` enum column (`SHARED` | `PRIVATE`), default `SHARED`.
- `Account.name`, `Account.archivedAt` columns.
- Backend `PickAccountsInput.visibility` per account in `POST /households/:hid/fints/connections/:id/accounts` — wizard UI does not yet send it.
- `PATCH /households/:hid/transactions/:id` already accepts `visibility`.
- `POST /households/:hid/transactions/bulk-move` exists as a precedent for bulk-edit endpoints.

→ No Prisma migration required.

## Architecture

### Backend

**New module: `apps/api/src/accounts`** (controller is new; service + repository already exist).

```
AccountsController (new)
  GET    /households/:hid/accounts
  PATCH  /households/:hid/accounts/:id
  ↓
AccountsService.update(ctx, id, patch)        ← new method
  ↓
AccountsRepository.update(...)                ← new method, uses { householdId } guard
```

`PATCH` body (zod-validated, class-validator on DTO):

```ts
{
  name?: string;             // 1..100 chars, trimmed
  visibility?: 'SHARED' | 'PRIVATE';
  archivedAt?: string | null; // ISO timestamp or null to un-archive
}
```

Authorisation rules in `AccountsService.update`:

- Account must belong to `ctx.householdId` (404 otherwise).
- For `type === 'fints'`: only `account.ownerId === ctx.userId` may change `visibility` and `archivedAt`. Rename also owner-only — the owner of a personal FinTS connection must not be overridable by other members. Other members get 403.
- For `type !== 'fints'` (csv_only, cash): any household member may rename / archive. `visibility` change is permitted for any member because cash/csv pots aren't owner-bound today.
- `archivedAt` is idempotent; setting it to a past timestamp re-uses the existing value.

**New endpoint on `TransactionsController`**:

```
POST /households/:hid/transactions/bulk-visibility
Body: { ids: string[]; visibility: 'SHARED' | 'PRIVATE' }
```

- Up to 500 ids per call (matches `bulk-move`).
- Repository updates only rows where `householdId = ctx.householdId AND id IN (...)`. RLS already enforces this; the explicit `where` is belt-and-braces per CLAUDE.md.
- Response: `{ updated: number }`.

`PATCH /transactions/:id` is unchanged — visibility already passes through.

`PickAccounts` flow is unchanged on the API side; the wizard simply starts sending `visibility` per account.

### Frontend

**Stores**

- `AccountsStore` (new) extends `ResourceStore<Account>`. Lives in `apps/web/src/app/core/accounts/`. Methods: `list()`, `update(id, patch)`, `archive(id)`, `unarchive(id)`. Optimistic update on success, `reload()` on error.
- `FintsStore.pickAccounts(input)`: extend the per-account payload type with `visibility`.
- `TransactionsStore`: add `bulkSetVisibility(ids, visibility)`. Existing `update(id, patch)` already covers single-row visibility because PATCH is generic.

**FinTS Wizard — Step 4 "Konten auswählen"**

Currently a checkbox list of discovered sub-accounts. Add one column per row:

```
[ ✓ ] Sparkasse · DE12 …       Tagesgeld   [ Shared ▾ ]
```

`<klar-select [options]="visibilityOptions" [(value)]="row.visibility">` with `Shared` / `Privat` labels. Default `SHARED`. On submit, payload becomes:

```ts
{ accounts: [{ fintsAccountRef, name?, iban?, bic?, visibility: 'SHARED'|'PRIVATE' }, ...] }
```

Mobile-first: at ≤375px the visibility select drops below the row label, full-width.

**`/app/banken` — Account management**

Below the existing FinTS connection block, add a sub-section "Konten":

- Compact list rendered with `klar-list` patterns: name, IBAN (truncated, mono), `klar-chip` for visibility, ⋮ menu.
- ⋮ → "Bearbeiten" opens `<klar-account-edit-dialog>` (Modal — Marco rule).
- ⋮ → "Archivieren" / "Wiederherstellen" toggles `archivedAt`.
- Archived accounts collapse into a "Archiviert (n)" disclosure section.

Below FinTS, add a "Manuelle Konten" sub-section listing `csv_only` and `cash` accounts with the same edit dialog (no owner-only restriction there).

`<klar-account-edit-dialog>` (new shared component in `apps/web/src/app/shared/ui/`):

- Inputs: `name` (Spartan `hlmInput`), `visibility` (`<klar-select>`), `archivedAt` toggle (`hlmCheckbox`).
- Form-level submit error → `<klar-dialog-callout tone="danger">` (CLAUDE.md rule).
- On Visibility change SHARED→PRIVATE for a FinTS account, show inline `<klar-dialog-callout tone="info">`: "Bestehende Buchungen behalten ihre Sichtbarkeit. Nur künftige Imports werden privat."
- Save button shows mono pending state, calls `AccountsStore.update`, closes dialog on success.

**Transaction edit & bulk-visibility**

- The existing transaction edit dialog adds a Visibility row using `<klar-select>` mirroring the dialog used for category / project. Wired to existing `TransactionsStore.update`.
- `klar-transactions-table` already supports row checkboxes (used by `bulk-move`). Extend the action bar with two buttons: "Auf Privat", "Auf Shared". Both call `TransactionsStore.bulkSetVisibility`. On mobile the action bar becomes a bottom sheet that appears when `selected.size > 0`.
- After success, the store updates the local signal in place — no full reload — and the action bar shows a toast "n Buchungen aktualisiert".

### Data Flow

```
Wizard Step 4 ──► FintsStore.pickAccounts({…, visibility})
              ──► POST /fints/connections/:id/accounts
              ──► Account rows created with chosen visibility

Banken-Page  ──► AccountsStore.update(id, {name?, visibility?, archivedAt?})
              ──► PATCH /accounts/:id
              ──► AccountsService.update (owner check for FinTS)

Tx Edit       ──► TransactionsStore.update(id, {visibility})
              ──► PATCH /transactions/:id  (existing)

Tx Bulk       ──► TransactionsStore.bulkSetVisibility(ids, visibility)
              ──► POST /transactions/bulk-visibility
```

## Error Handling

- 400: missing required field, name length out of range, unknown visibility.
- 403: non-owner trying to rename / re-scope FinTS account → toast in dialog: "Nur der Inhaber des Kontos darf das ändern."
- 404: account/tx not in household.
- Idempotent retries: AccountsStore retries `update` on network blip; backend update is naturally idempotent (last write wins).

## Testing

**Backend (Vitest + Supertest)**

- `accounts.service.spec.ts` — new cases: rename, visibility change, archive/unarchive, owner-only rule for FinTS, household isolation, name length validation.
- `accounts.repository.spec.ts` — `update` only touches the matching householdId row (cross-tenant guard).
- `transactions.controller.spec.ts` / service-spec — `bulkSetVisibility` happy path, foreign-id rejection, 500-id cap, scope-only-own-household.
- Coverage target: ≥80% lines in `accounts/` and the touched files in `transactions/`.

**Frontend (Vitest)**

- `accounts.store.spec.ts` — optimistic update + revert on error.
- `klar-account-edit-dialog.spec.ts` — form validity, error callout rendering, FinTS-vs-CSV inline hint.
- Wizard Step 4 component test — visibility column renders, default `SHARED`, payload includes the value.
- `klar-transactions-table` action-bar test — bulk button calls store with selected ids.

**Playwright smoke** (`apps/web/e2e/`)

- New spec: import a FinTS connection (mocked backend), pick two accounts mixed Shared+Private, assert chips on /app/banken.
- Rename an account, reload, assert new name persists.
- Select 3 transactions in `/app/buchungen`, hit "Auf Privat", assert chips update without page reload.

## Migration / Rollout

- No DB migration.
- No data backfill — existing accounts already have `visibility` defaulted to `SHARED`.
- Single PR, single commit per Marco's policy. README features table gets a new row "Konten verwalten" plus a detail section under "Features im Detail".

## Open Questions

None — all clarifying questions resolved during brainstorming:

1. Account-edit lives in `/app/banken` per-connection. ✓
2. Wizard uses per-account toggle, default `SHARED`. ✓
3. Tx visibility editable in edit dialog **and** bulk action. ✓
4. Account visibility flip does NOT cascade to existing transactions. ✓

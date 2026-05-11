# Account Rename + Sync Toggle + Bank Delete Cascade

**Date:** 2026-05-10
**Status:** Approved (design)

## Problem

Three related gaps in the FinTS account flow on `/app/banken`:

1. FinTS-imported accounts cannot be renamed in the UI (the user sees the bank-supplied label like "Girokonto-1234" forever).
2. There is no way to exclude a single account from sync (e.g. a closed sub-account that the bank still advertises in UPD).
3. Deleting a FinTS connection currently leaves orphan accounts with all their transactions intact (`fintsConnectionId` is set to NULL, `Transaction.account` is `onDelete: Restrict`). The user expects "delete bank" to also remove its FinTS accounts and bookings.

## Out of Scope

- Renaming/toggling for `csv_only` accounts (works via the same endpoint, but no new UI surface this round).
- Re-running detection or balance recalculation after delete — the cascade just removes the rows.
- Soft-delete / undo. The delete is destructive after confirmation.

## Schema Change

```prisma
model Account {
  // ...
  syncEnabled Boolean @default(true)
}
```

Migration `20260510_account_sync_enabled`:

```sql
ALTER TABLE "Account" ADD COLUMN "syncEnabled" BOOLEAN NOT NULL DEFAULT true;
```

The existing FK `Account.fintsConnectionId → FintsConnection.id` stays at `onDelete: SetNull`. The cascade is implemented explicitly in `FintsService.remove` so we only delete FinTS-typed accounts (a future CSV-only account that was never synced through this connection but happens to share the FK is left untouched — defense in depth).

## Backend

### `AccountsService.update`

Extend `UpdateAccountInput` and `UpdateAccountData`:

```ts
export interface UpdateAccountInput {
  name?: string;
  visibility?: 'SHARED' | 'PRIVATE';
  archivedAt?: string | null;
  syncEnabled?: boolean;
}
```

`syncEnabled` follows the same FinTS-owner-only guard as `name`/`visibility` (only the user who owns the FinTS connection may toggle it; for non-FinTS accounts any household member can toggle, consistent with current `update` behavior).

Controller `PATCH /accounts/:id` body validator (zod) gets the new field. `toResponse` includes `syncEnabled`.

### Sync filter

In `FintsSyncService` (or wherever per-account iteration happens — confirmed via grep before edit), filter accounts to `syncEnabled === true` before calling `client.fetchStatements`. Disabled accounts skip silently and do not produce a `FintsSyncRun` entry per account.

### `FintsService.remove` — destructive cascade

Replace the current implementation with a single Prisma transaction:

1. Load connection (existing `findOne` + owner guard).
2. Find all accounts with `fintsConnectionId = id AND type = 'fints'`.
3. For each such account, in order:
   - `transaction.deleteMany({ where: { accountId } })`
   - `standingOrder.deleteMany({ where: { accountId } })`
   - `account.delete({ where: { id } })`
4. Cipher-overwrite + `fintsConnection.delete` (existing logic, now inside the same `prisma.$transaction`).

Other side-effects to verify during implementation: `FintsSyncRun` rows referencing the connection (likely `onDelete: Cascade` already — confirm before merge), audit-log entries (keep — these are an audit trail, not user data).

### New endpoint: `GET /fints/connections/:id/delete-impact`

Returns counts so the confirm dialog can show "3 accounts, 412 transactions, 18 standing orders will be deleted". Owner-only (same guard as `remove`).

```ts
{ accounts: number; transactions: number; standingOrders: number }
```

Computed in the service via three `count` queries scoped to the connection's FinTS accounts.

## Frontend

### Account edit dialog

New `AccountEditDialogComponent` in `apps/web/src/app/pages/banken/`:

- Signal Forms (per CLAUDE.md, no Reactive Forms)
- Fields: name (`hlmInput`, 1..100), syncEnabled (`klar-toggle` "Bei Sync einschließen")
- Submit → `accountsStore.update(id, patch)`, reload bank list, close
- Errors as `<klar-dialog-callout tone="danger" icon="x">` (top-of-form), per Marco's rule

Opens from the bank list: a pencil icon in the per-account row, next to the existing sync icon. The whole control row stays inside the existing card so the click target on the account button (open transactions) is unaffected.

### Account row visual state

When `syncEnabled === false`:
- Account name + IBAN rendered with `text-(--fg-2)` (not full mute, still readable)
- Small "pause" icon (`klar-icon name="pause"`) inline at the end of the metadata row, with `aria-label="Vom Sync ausgeschlossen"`

### Bank delete confirmation

`BankenPageComponent.onDelete(connectionId)` flow:

1. Call `GET /fints/connections/:id/delete-impact`.
2. Open `KlarConfirmService` with body:
   > "Diese Bank, **{accounts} Konten**, **{transactions} Buchungen** und **{standingOrders} Daueraufträge** werden unwiderruflich gelöscht. Wirklich fortfahren?"
3. On confirm → `DELETE /fints/connections/:id` → reload list.

If the impact endpoint fails (network), fall back to the static text "alle Konten und Buchungen dieser Bank" so the delete is not blocked by an observability problem.

### Store

`AccountsStore.update(id, patch)` already exists (built on `ResourceStore`); just plumb `syncEnabled` through. New thin `FintsService.fetchDeleteImpact(connectionId)` on the web client.

## Tests

### Backend

- `accounts.service.spec`:
  - `update` with `syncEnabled: false` succeeds for FinTS owner
  - `update` with `syncEnabled` rejected for non-owner of FinTS account (`ForbiddenException`)
- `fints.service.spec`:
  - `remove` deletes fints accounts + their transactions + their standing orders in one transaction
  - `remove` leaves a `csv_only` account in the same household untouched
  - `remove` returns 403 for non-owner
- `fints-sync.service.spec`: accounts with `syncEnabled: false` are skipped (no `fetchStatements` call, no sync run row)

### Frontend

- `account-edit-dialog.component.spec`: name validation, syncEnabled toggle, submit calls store update
- `banken.component.spec`: pause icon renders when `syncEnabled === false`
- Playwright `e2e/banken-edit.spec.ts`:
  1. Rename a FinTS account → list shows new name
  2. Toggle sync off → run sync → balance unchanged for that account
  3. Delete the bank → confirm dialog shows correct counts → after confirm, transactions list of any deleted account is empty

Coverage: backend ≥ 80% lines (service + controller paths), frontend ≥ 70% (dialog).

## Definition of Done

- Migration applied, `prisma generate` clean
- `pnpm lint && pnpm test && pnpm build` green
- Playwright spec passes
- README "Banken / FinTS" section updated with rename + sync-toggle + delete behavior
- One commit per concern (schema+backend, sync filter, frontend dialog, frontend delete UX, tests, docs)

## Open Risk

The destructive delete has no undo. The dynamic count in the confirm dialog is the primary mitigation. We accept this — backups handle the worst case.

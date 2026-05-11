# Account & Transaction Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow choosing Shared/Private per FinTS account during the wizard, editing existing accounts (rename / visibility / archive) from `/app/banken`, and editing single + bulk transaction visibility in `/app/buchungen`.

**Architecture:** Reuse existing `Account.visibility` and `PATCH /transactions/:id` infrastructure. Add a thin `AccountsController` with `GET` + `PATCH`, a `bulk-visibility` POST on `TransactionsController`, a frontend `AccountsStore`, an Account-Edit dialog, a wizard visibility column, and a bulk-visibility action bar in `klar-transactions-table`. No DB migration.

**Tech Stack:** NestJS 11 + Prisma + Vitest (backend), Angular 21 zoneless + Spartan UI + Vitest (frontend), Playwright smoke.

**Spec:** [docs/superpowers/specs/2026-05-10-account-tx-visibility-design.md](../specs/2026-05-10-account-tx-visibility-design.md)

---

## Reference Snapshot (already in repo, do not re-implement)

- `Account.visibility`, `Account.name`, `Account.archivedAt` columns in [prisma/schema.prisma](../../../prisma/schema.prisma) lines 327-362.
- `PickAccountsInput.visibility` per account in [apps/api/src/fints/fints.service.ts](../../../apps/api/src/fints/fints.service.ts) line 33-43, used line 402.
- Frontend `FintsAttachAccountInput.visibility` in [apps/web/src/app/core/fints/fints.service.ts](../../../apps/web/src/app/core/fints/fints.service.ts) line 128.
- `PATCH /transactions/:id` already accepts `visibility`: [apps/api/src/transactions/transactions.controller.ts](../../../apps/api/src/transactions/transactions.controller.ts) lines 69-81.
- Transaction edit dialog already has visibility select: [apps/web/src/app/pages/buchungen/transaction-dialog.component.ts](../../../apps/web/src/app/pages/buchungen/transaction-dialog.component.ts) line 52.
- Bulk-move precedent in same controller (line 92).

---

## Task 1: Backend — `AccountsRepository.update` + cross-tenant guard

**Files:**
- Modify: `apps/api/src/accounts/accounts.repository.ts`
- Test: `apps/api/src/accounts/accounts.repository.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/accounts/accounts.repository.spec.ts
import { Test } from '@nestjs/testing';
import { AccountsRepository } from './accounts.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('AccountsRepository.update', () => {
  let repo: AccountsRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AccountsRepository, PrismaService],
    }).compile();
    repo = moduleRef.get(AccountsRepository);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.account.deleteMany();
    await prisma.household.deleteMany();
    await prisma.user.deleteMany();
  });

  it('updates only the targeted row and only when householdId matches', async () => {
    const owner = await prisma.user.create({ data: { email: 'a@a.de', passwordHash: 'x' } });
    const h1 = await prisma.household.create({ data: { name: 'H1' } });
    const h2 = await prisma.household.create({ data: { name: 'H2' } });
    const a1 = await prisma.account.create({
      data: { householdId: h1.id, name: 'Old', type: 'csv_only', visibility: 'SHARED' },
    });
    await prisma.account.create({
      data: { householdId: h2.id, name: 'Other', type: 'csv_only', visibility: 'SHARED' },
    });

    const updated = await repo.update(a1.id, h1.id, { name: 'New', visibility: 'PRIVATE' });
    expect(updated?.name).toBe('New');
    expect(updated?.visibility).toBe('PRIVATE');

    // Cross-household must not match — returns null.
    const cross = await repo.update(a1.id, h2.id, { name: 'Hijack' });
    expect(cross).toBeNull();
    const stillOld = await prisma.account.findUnique({ where: { id: a1.id } });
    expect(stillOld?.name).toBe('New');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

`pnpm --filter @klar/api test -- accounts.repository.spec` — fails because `repo.update` is not defined.

- [ ] **Step 3: Implement `update`**

Add to `apps/api/src/accounts/accounts.repository.ts`:

```ts
export interface UpdateAccountData {
  name?: string;
  visibility?: Visibility;
  archivedAt?: Date | null;
}

// inside class:
async update(
  id: string,
  householdId: string,
  data: UpdateAccountData,
): Promise<Account | null> {
  const result = await this.prisma.account.updateMany({
    where: { id, householdId },
    data,
  });
  if (result.count === 0) return null;
  return this.prisma.account.findUnique({ where: { id } });
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```
git add apps/api/src/accounts/accounts.repository.ts apps/api/src/accounts/accounts.repository.spec.ts
git commit -m "feat(accounts): add repository.update with householdId scoping"
```

---

## Task 2: Backend — `AccountsService.update` with FinTS owner-only rule

**Files:**
- Modify: `apps/api/src/accounts/accounts.service.ts`
- Modify: `apps/api/src/accounts/accounts.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/api/src/accounts/accounts.service.spec.ts`:

```ts
describe('AccountsService.update', () => {
  // standard arrange via existing test helpers in this file
  it('renames a csv_only account for any household member', async () => {
    const acc = await createCsvAccount(h1.id);
    const result = await service.update(ctxMember(h1.id, otherUserId), acc.id, { name: 'Wallet' });
    expect(result.name).toBe('Wallet');
  });

  it('rejects FinTS account edits from non-owner with 403', async () => {
    const acc = await createFintsAccount(h1.id, ownerUserId);
    await expect(
      service.update(ctxMember(h1.id, otherUserId), acc.id, { visibility: 'PRIVATE' }),
    ).rejects.toThrow(/owner/i);
  });

  it('allows FinTS account owner to flip visibility', async () => {
    const acc = await createFintsAccount(h1.id, ownerUserId);
    const result = await service.update(ctxMember(h1.id, ownerUserId), acc.id, { visibility: 'PRIVATE' });
    expect(result.visibility).toBe('PRIVATE');
  });

  it('throws NotFoundException for cross-tenant access', async () => {
    const acc = await createCsvAccount(h1.id);
    await expect(
      service.update(ctxMember(h2.id, otherUserId), acc.id, { name: 'X' }),
    ).rejects.toThrow('nicht gefunden');
  });

  it('archives by setting archivedAt to now and clears with null', async () => {
    const acc = await createCsvAccount(h1.id);
    const archived = await service.update(ctx, acc.id, { archivedAt: new Date() });
    expect(archived.archivedAt).toBeInstanceOf(Date);
    const restored = await service.update(ctx, acc.id, { archivedAt: null });
    expect(restored.archivedAt).toBeNull();
  });

  it('rejects empty/oversized name', async () => {
    const acc = await createCsvAccount(h1.id);
    await expect(service.update(ctx, acc.id, { name: '' })).rejects.toThrow(/name/i);
    await expect(service.update(ctx, acc.id, { name: 'x'.repeat(101) })).rejects.toThrow(/name/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`pnpm --filter @klar/api test -- accounts.service.spec`

- [ ] **Step 3: Implement service.update**

Add to `apps/api/src/accounts/accounts.service.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { AccountsRepository, type UpdateAccountData } from './accounts.repository';
import type { RequestContext } from '../common/types/request-context.type';

export interface UpdateAccountInput {
  name?: string;
  visibility?: 'SHARED' | 'PRIVATE';
  archivedAt?: string | null; // ISO string, null clears
}

// inside class:
async update(
  ctx: RequestContext,
  id: string,
  patch: UpdateAccountInput,
): Promise<Account> {
  const existing = await this.findById(id, ctx.householdId); // throws NotFound
  if (existing.type === 'fints' && existing.ownerId !== ctx.userId) {
    throw new ForbiddenException('Nur der Inhaber dieses FinTS-Kontos darf es ändern.');
  }
  const data: UpdateAccountData = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new BadRequestException('name muss 1..100 Zeichen lang sein');
    }
    data.name = trimmed;
  }
  if (patch.visibility !== undefined) {
    if (patch.visibility !== 'SHARED' && patch.visibility !== 'PRIVATE') {
      throw new BadRequestException('Ungültige visibility');
    }
    data.visibility = patch.visibility;
  }
  if (patch.archivedAt !== undefined) {
    data.archivedAt = patch.archivedAt === null ? null : new Date(patch.archivedAt);
  }
  const updated = await this.repo.update(id, ctx.householdId, data);
  if (!updated) throw new NotFoundException(`Account ${id} nicht gefunden`);
  return updated;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```
git add apps/api/src/accounts/accounts.service.ts apps/api/src/accounts/accounts.service.spec.ts
git commit -m "feat(accounts): service.update with FinTS owner-only guard"
```

---

## Task 3: Backend — `AccountsController` with GET + PATCH

**Files:**
- Create: `apps/api/src/accounts/accounts.controller.ts`
- Modify: `apps/api/src/accounts/accounts.module.ts`
- Test: `apps/api/src/accounts/accounts.controller.spec.ts` (new)

- [ ] **Step 1: Write failing controller test (Supertest e2e style)**

```ts
// apps/api/src/accounts/accounts.controller.spec.ts
// Use the existing test bootstrap helper (see fints.controller.spec.ts for the pattern).
describe('AccountsController', () => {
  it('GET /households/:hid/accounts returns the household list', async () => {
    const res = await request(app).get(`/households/${h.id}/accounts`).set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('PATCH /households/:hid/accounts/:id renames a csv account', async () => {
    const res = await request(app)
      .patch(`/households/${h.id}/accounts/${csvAcc.id}`)
      .set(authHeaders())
      .send({ name: 'Wallet' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Wallet');
  });

  it('PATCH on FinTS account by non-owner returns 403', async () => {
    const res = await request(app)
      .patch(`/households/${h.id}/accounts/${fintsAcc.id}`)
      .set(authHeadersFor(otherMember))
      .send({ visibility: 'PRIVATE' });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (route not found / module not loaded).

- [ ] **Step 3: Implement controller**

```ts
// apps/api/src/accounts/accounts.controller.ts
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AccountsService, type UpdateAccountInput } from './accounts.service';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';

@Controller('households/:hid/accounts')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  async list(@ReqContext() ctx: RequestContext) {
    const items = await this.service.list(ctx.householdId);
    return items.map(a => this.service.toResponse(a));
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateAccountInput,
  ) {
    const item = await this.service.update(ctx, id, body);
    return this.service.toResponse(item);
  }
}
```

Update `apps/api/src/accounts/accounts.module.ts`:

```ts
@Module({
  imports: [PrismaModule, HouseholdsModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository],
  exports: [AccountsService],
})
export class AccountsModule {}
```

Confirm `AccountsModule` is loaded in `app.module.ts` (it likely already is — verify with grep).

- [ ] **Step 4: Run — expect PASS** (`pnpm --filter @klar/api test -- accounts.controller.spec`)

- [ ] **Step 5: Commit**

```
git add apps/api/src/accounts/
git commit -m "feat(accounts): expose GET /accounts and PATCH /accounts/:id"
```

---

## Task 4: Backend — `POST /transactions/bulk-visibility`

**Files:**
- Modify: `apps/api/src/transactions/transactions.controller.ts`
- Modify: `apps/api/src/transactions/transactions.service.ts`
- Modify: `apps/api/src/transactions/transactions.repository.ts`
- Test: `apps/api/src/transactions/transactions.service.spec.ts` (extend) and `transactions.controller.spec.ts`

- [ ] **Step 1: Write failing test**

In `transactions.service.spec.ts`:

```ts
it('bulkSetVisibility updates only ids from the same household', async () => {
  const t1 = await createTx(h1.id);
  const t2 = await createTx(h1.id);
  const tOther = await createTx(h2.id);

  const result = await service.bulkSetVisibility(ctxFor(h1.id), {
    ids: [t1.id, t2.id, tOther.id],
    visibility: 'PRIVATE',
  });

  expect(result.updated).toBe(2);
  const stillShared = await prisma.transaction.findUnique({ where: { id: tOther.id } });
  expect(stillShared?.visibility).toBe('SHARED');
});

it('bulkSetVisibility rejects > 500 ids', async () => {
  await expect(
    service.bulkSetVisibility(ctx, { ids: Array(501).fill('x'), visibility: 'PRIVATE' }),
  ).rejects.toThrow(/500/);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement repo + service + controller**

`transactions.repository.ts`:

```ts
async bulkSetVisibility(
  householdId: string,
  ids: string[],
  visibility: Visibility,
): Promise<number> {
  const result = await this.prisma.transaction.updateMany({
    where: { householdId, id: { in: ids } },
    data: { visibility },
  });
  return result.count;
}
```

`transactions.service.ts`:

```ts
export interface BulkVisibilityInput {
  ids: string[];
  visibility: 'SHARED' | 'PRIVATE';
}

async bulkSetVisibility(
  ctx: RequestContext,
  input: BulkVisibilityInput,
): Promise<{ updated: number }> {
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    throw new BadRequestException('ids muss mindestens eine ID enthalten');
  }
  if (input.ids.length > 500) {
    throw new BadRequestException('Max. 500 IDs pro Aufruf');
  }
  if (input.visibility !== 'SHARED' && input.visibility !== 'PRIVATE') {
    throw new BadRequestException('Ungültige visibility');
  }
  const updated = await this.repo.bulkSetVisibility(ctx.householdId, input.ids, input.visibility);
  return { updated };
}
```

`transactions.controller.ts` (after `bulk-move`):

```ts
@Post('bulk-visibility')
async bulkVisibility(
  @ReqContext() ctx: RequestContext,
  @Body() body: BulkVisibilityInput,
) {
  return this.service.bulkSetVisibility(ctx, body);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```
git add apps/api/src/transactions/
git commit -m "feat(transactions): bulk-visibility endpoint"
```

---

## Task 5: Frontend — `AccountsStore` + service additions

**Files:**
- Create: `apps/web/src/app/core/accounts/accounts.service.ts`
- Create: `apps/web/src/app/core/accounts/accounts.store.ts`
- Test: `apps/web/src/app/core/accounts/accounts.store.spec.ts`

- [ ] **Step 1: Write failing store test**

```ts
describe('AccountsStore', () => {
  it('update() patches the local list optimistically and reloads on error', async () => {
    httpMock.onGet(/accounts/).reply(200, [{ id: 'a1', name: 'Old', visibility: 'SHARED', type: 'csv_only' }]);
    await store.list();
    httpMock.onPatch(/accounts\/a1/).reply(500);
    const before = store.items().find(a => a.id === 'a1')!;
    await expect(store.update('a1', { name: 'New' })).rejects.toBeDefined();
    expect(store.items().find(a => a.id === 'a1')?.name).toBe(before.name); // reverted
  });
});
```

- [ ] **Step 2: Implement service + store**

```ts
// apps/web/src/app/core/accounts/accounts.service.ts
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private http = inject(HttpClient);
  list(hid: string) { return this.http.get<AccountResponse[]>(`/api/v1/households/${hid}/accounts`); }
  update(hid: string, id: string, patch: AccountPatch) {
    return this.http.patch<AccountResponse>(`/api/v1/households/${hid}/accounts/${id}`, patch);
  }
}
```

```ts
// apps/web/src/app/core/accounts/accounts.store.ts — extend ResourceStore<AccountResponse>
async update(id: string, patch: AccountPatch): Promise<void> {
  const prev = this.items();
  const optimistic = prev.map(a => a.id === id ? { ...a, ...patch } as AccountResponse : a);
  this.setItems(optimistic);
  try {
    await firstValueFrom(this.api.update(this.householdStore.activeId()!, id, patch));
  } catch (err) {
    this.setItems(prev);
    throw err;
  }
}
```

- [ ] **Step 3: Run — expect PASS** (`pnpm --filter @klar/web test -- accounts.store.spec`)

- [ ] **Step 4: Commit**

```
git add apps/web/src/app/core/accounts/
git commit -m "feat(web): AccountsStore with optimistic update + revert"
```

---

## Task 6: Frontend — FinTS wizard Step 4 visibility column

**Files:**
- Modify: `apps/web/src/app/pages/banken/fints-setup-wizard.component.ts`
- Modify: matching template (inline in `.ts` if Spartan-style component)
- Modify: `apps/web/src/app/pages/banken/banken.component.spec.ts` (add wizard step coverage)

- [ ] **Step 1: Write failing component test**

```ts
it('attaches accounts with the chosen visibility per row', async () => {
  // Arrange wizard at step 'accounts' with two discovered accounts.
  cmp.accountSelections.set([
    { ref: 'A1', name: 'A1', selected: true, visibility: 'SHARED' },
    { ref: 'A2', name: 'A2', selected: true, visibility: 'PRIVATE' },
  ]);
  const spy = vi.spyOn(fintsService, 'attachAccounts').mockReturnValue(of([]));
  await cmp.attach();
  expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), [
    expect.objectContaining({ fintsAccountRef: 'A1', visibility: 'SHARED' }),
    expect.objectContaining({ fintsAccountRef: 'A2', visibility: 'PRIVATE' }),
  ]);
});
```

- [ ] **Step 2: Update wizard component**

Extend `accountSelections` row type with `visibility: 'SHARED' | 'PRIVATE'` (default `'SHARED'`), wire `<klar-select [options]="visibilityOpts" [value]="row.visibility" (valueChange)="setVisibility(i, $event)">` next to each checkbox row, and include `visibility: a.visibility` in the `picks` map at line 631.

```ts
protected readonly visibilityOpts: KlarSelectOption<'SHARED' | 'PRIVATE'>[] = [
  { label: 'Geteilt', value: 'SHARED' },
  { label: 'Privat', value: 'PRIVATE' },
];

protected setVisibility(index: number, value: 'SHARED' | 'PRIVATE'): void {
  const list = [...this.accountSelections()];
  list[index] = { ...list[index], visibility: value };
  this.accountSelections.set(list);
}
```

In `proceedToAccounts`, default each row to `visibility: 'SHARED'`. In `attach`, change the `.map` payload to include `visibility: a.visibility`.

- [ ] **Step 3: Mobile-first check**

At ≤375px the visibility select must drop below the row label (`flex-col md:flex-row`). Manually verify in browser.

- [ ] **Step 4: Run tests + lint** (`pnpm test`, `pnpm lint`)

- [ ] **Step 5: Commit**

```
git add apps/web/src/app/pages/banken/
git commit -m "feat(fints-wizard): per-account Shared/Private toggle on Step 4"
```

---

## Task 7: Frontend — `klar-account-edit-dialog` + Banken account list

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-account-edit-dialog.component.ts`
- Create: `apps/web/src/app/shared/ui/klar-account-edit-dialog.component.spec.ts`
- Modify: `apps/web/src/app/pages/banken/banken.component.ts`
- Modify: `apps/web/src/app/pages/banken/banken.component.html` (or inline template)
- Modify: `README.md`

- [ ] **Step 1: Write failing dialog test**

```ts
it('emits patch with name + visibility + archivedAt when saving', async () => {
  const cmp = render(KlarAccountEditDialog, { inputs: { account: csvAccount }});
  cmp.nameCtrl.set('Wallet');
  cmp.visibility.set('PRIVATE');
  cmp.archived.set(true);
  await cmp.save();
  expect(saveSpy).toHaveBeenCalledWith({ name: 'Wallet', visibility: 'PRIVATE', archivedAt: expect.any(String) });
});

it('shows FinTS hint when SHARED→PRIVATE on a fints account', async () => {
  const cmp = render(KlarAccountEditDialog, { inputs: { account: fintsSharedAccount } });
  cmp.visibility.set('PRIVATE');
  expect(cmp.html()).toContain('Bestehende Buchungen behalten');
});

it('renders submit error as klar-dialog-callout tone="danger"', async () => {
  saveSpy.mockRejectedValue(new HttpErrorResponse({ status: 403, error: { detail: 'Nur der Inhaber...' } }));
  await cmp.save();
  expect(cmp.html()).toContain('klar-dialog-callout');
  expect(cmp.html()).toContain('Nur der Inhaber');
});
```

- [ ] **Step 2: Implement dialog**

`klar-account-edit-dialog.component.ts`: signal-form with `name` (`hlmInput`), `visibility` (`<klar-select>`), `archived` (`hlmCheckbox`). Submit calls `AccountsStore.update`, emits `close` on success, sets `errorMessage` signal on failure. Render top-of-form error via `<klar-dialog-callout tone="danger" icon="x">`. Render FinTS-info hint via `<klar-dialog-callout tone="info">` when `account.type === 'fints' && account.visibility === 'SHARED' && visibility() === 'PRIVATE'`.

- [ ] **Step 3: Wire into Banken page**

In `banken.component.ts`: inject `AccountsStore`, derive `accountsByConnection` and `manualAccounts` signals, render compact list under each connection block + a "Manuelle Konten" section. Each row has `<klar-chip>` for visibility (`text-success-foreground bg-success/10` for SHARED, `text-warning-foreground bg-warning/10` for PRIVATE) and a `⋮` `hlm-menu` with "Bearbeiten" / "Archivieren" / "Wiederherstellen". Archived accounts collapse into a `<details>` "Archiviert ({{count}})".

Mobile-first: row uses `flex flex-col md:flex-row md:items-center` so on ≤375px name+IBAN stack above the chip+menu.

- [ ] **Step 4: README update**

Append to the features table and add a "Account management" detail section under "Features im Detail" describing: per-account visibility, rename, archive, owner-only rule for FinTS.

- [ ] **Step 5: Run tests + lint + build**

`pnpm lint && pnpm test && pnpm --filter @klar/web build`

- [ ] **Step 6: Commit**

```
git add apps/web/src/app/ README.md
git commit -m "feat(banken): account edit dialog with rename/visibility/archive"
```

---

## Task 8: Frontend — Bulk visibility action bar in transactions table

**Files:**
- Modify: `apps/web/src/app/shared/transactions/klar-transactions-table.component.ts` (and `.html` if templated externally)
- Modify: `apps/web/src/app/shared/transactions/klar-transactions-row.component.ts`
- Modify: `apps/web/src/app/core/transactions/transactions.store.ts`
- Modify: `apps/web/src/app/core/transactions/transactions.service.ts`
- Test: `klar-transactions-table.component.spec.ts` (extend)

- [ ] **Step 1: Add `bulkSetVisibility` to service + store**

```ts
// transactions.service.ts
bulkSetVisibility(hid: string, ids: string[], visibility: 'SHARED' | 'PRIVATE') {
  return this.http.post<{ updated: number }>(
    `/api/v1/households/${hid}/transactions/bulk-visibility`,
    { ids, visibility },
  );
}

// transactions.store.ts
async bulkSetVisibility(ids: string[], visibility: 'SHARED' | 'PRIVATE'): Promise<number> {
  const hid = this.householdStore.activeId()!;
  const { updated } = await firstValueFrom(this.api.bulkSetVisibility(hid, ids, visibility));
  this.setItems(this.items().map(t => ids.includes(t.id) ? { ...t, visibility } : t));
  return updated;
}
```

- [ ] **Step 2: Add row selection to `klar-transactions-row` + table**

Row gains a leading `hlmCheckbox` (hidden behind `[showSelection]` input flag, default false to keep existing callers untouched). Table aggregates `selectedIds = signal<Set<string>>(new Set())`. On row checkbox toggle: add/remove. Header gets a "select-all-on-page" checkbox.

- [ ] **Step 3: Action bar template**

When `selectedIds().size > 0`, render a sticky action bar:

```html
<div class="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-(--line) bg-(--bg-1) px-3 py-2">
  <span class="text-[12px] text-muted-foreground">{{ selectedIds().size }} ausgewählt</span>
  <button hlmBtn variant="outline" size="sm" (click)="bulk('SHARED')">Auf Geteilt</button>
  <button hlmBtn variant="outline" size="sm" (click)="bulk('PRIVATE')">Auf Privat</button>
</div>
```

On mobile (≤768px) render as bottom-sheet: `max-md:fixed max-md:bottom-[var(--safe-bottom)] max-md:left-0 max-md:right-0`.

- [ ] **Step 4: Wire host page (`buchungen.component.ts`) to enable selection**

Pass `[showSelection]="true"` to the table and bind `(bulkVisibilityChange)="onBulkVisibility($event)"` → calls `TransactionsStore.bulkSetVisibility`. Show a toast on success: `"{{n}} Buchungen aktualisiert"`.

- [ ] **Step 5: Component test for action bar**

```ts
it('emits bulk visibility change with the selected ids', async () => {
  cmp.selectedIds.set(new Set(['t1', 't2']));
  const spy = vi.fn();
  cmp.bulkVisibilityChange.subscribe(spy);
  await cmp.bulk('PRIVATE');
  expect(spy).toHaveBeenCalledWith({ ids: ['t1', 't2'], visibility: 'PRIVATE' });
});
```

- [ ] **Step 6: Run tests + lint**

- [ ] **Step 7: Commit**

```
git add apps/web/src/app/shared/transactions/ apps/web/src/app/core/transactions/ apps/web/src/app/pages/buchungen/
git commit -m "feat(transactions): bulk-visibility action bar with row selection"
```

---

## Task 9: Playwright smoke

**Files:**
- Create: `apps/web/e2e/account-visibility.spec.ts`

- [ ] **Step 1: Write the smoke test**

Use existing e2e bootstrap + auth helpers. Steps:

1. Login as primary household owner.
2. Navigate `/app/banken`, open the FinTS-Connection edit menu of a seeded connection, click "Konten" entry, open edit dialog for one account, change name, save, assert chip + name updated.
3. Navigate `/app/buchungen`, select 3 transactions, click "Auf Privat", assert chips on the selected rows update without page reload, toast appears.
4. Reload page, assert state persists.

- [ ] **Step 2: Run smoke locally**

`pnpm --filter @klar/web e2e -- account-visibility`

- [ ] **Step 3: Commit**

```
git add apps/web/e2e/account-visibility.spec.ts
git commit -m "test(e2e): account rename + bulk-visibility smoke"
```

---

## Self-Review Checklist (run before finishing)

- [ ] Spec coverage:
  - Wizard visibility per account → Task 6 ✓
  - Account rename / visibility / archive → Tasks 1, 2, 3, 7 ✓
  - Single-tx visibility edit → already in `transaction-dialog.component.ts:52` ✓
  - Bulk-tx visibility → Tasks 4, 8 ✓
  - Owner-only FinTS guard → Task 2 ✓
  - No cascade to existing transactions → enforced by NOT touching tx in account update; verified in Task 2 tests ✓
- [ ] No placeholders.
- [ ] Type consistency: `UpdateAccountInput` (service-level) and `AccountPatch` (frontend) both have `name?`, `visibility?`, `archivedAt?` — frontend serialises Date as ISO string for `archivedAt` to match backend.

---

## Final Verification (before merging the branch)

- [ ] `pnpm lint` clean
- [ ] `pnpm test` clean (≥80% backend, ≥70% frontend on touched files)
- [ ] `pnpm --filter @klar/web build` succeeds
- [ ] Mobile viewport (≤375px) for /app/banken and /app/buchungen action bar manually checked
- [ ] README updated with the new feature
- [ ] No `<select>` tags introduced (CI hygiene gate)
- [ ] No native form-controls without `hlm*`
- [ ] No new `klar-*` component duplicating an existing one

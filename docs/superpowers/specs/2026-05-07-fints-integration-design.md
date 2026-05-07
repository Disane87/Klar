# FinTS Integration — Read-Only Booking Sync

**Status:** Draft · **Date:** 2026-05-07 · **Owner:** Marco
**Scope:** Server-side automated booking sync via FinTS PIN/TAN protocol, read-only.
**Phase:** 14a (between UI-Politur and Hardening)

---

## 1. Motivation & Goals

The CSV import (Sparkasse CAMT v2, see `2026-05-05-csv-import-sparkasse-design.md`) requires the user to manually export and upload statements. FinTS enables fully automated server-side fetching, removing that friction. Bookings still flow through the existing detection and learning pipeline (fixed-cost detection, category suggestions, recurring-cluster detection).

**Goals**

- Automated daily server-side sync of bookings from arbitrary German banks via FinTS PIN/TAN.
- Read-only — no transfers, no balance changes, no schema for write operations.
- All resulting bookings reach the same detection/learning pipeline as CSV imports; no logic duplication.
- Strict module isolation — credentials and bank-protocol details live behind a hard module boundary.
- Encryption at rest for PIN and FinTS session state.
- Bank-agnostic via `lib-fints`; no per-bank code paths in day-1 scope.
- PSD2 90-day SCA compliance with proactive re-auth UX.

**Non-goals (this iteration)**

- Write operations (transfers).
- HSM/KMS-backed crypto.
- Per-user passphrase-based credential encryption.
- Multi-bank aggregation as virtual accounts.
- Native mobile app-to-app TAN integration.

---

## 2. Architecture Overview

### 2.1 Module layout

```
apps/api/src/fints/                  (the FinTS module — strongly isolated)
├── fints.module.ts
├── fints.controller.ts              REST: connections, sync runs, TAN submit, reauth
├── fints.service.ts                 Public orchestration API
├── fints.repository.ts              Prisma I/O — never accessed outside this module
├── crypto/
│   └── fints-crypto.service.ts      AES-256-GCM for PIN + lib-fints state
├── client/
│   └── fints-client.service.ts      lib-fints wrapper
├── sync/
│   ├── fints-sync.scheduler.ts      @nestjs/schedule cron
│   ├── fints-sync.runner.ts         per-connection sync orchestration
│   └── fints-sync.repository.ts     SyncRun persistence
├── mapper/
│   └── fints-booking.mapper.ts      lib-fints booking → RawBooking DTO
├── reauth/
│   └── reauth-watcher.scheduler.ts  daily SCA-expiry watcher
└── banks/
    ├── bank-registry.service.ts     BLZ → bank-record lookup
    ├── blz-fetcher.service.ts       hbci4j upstream fetch
    ├── blz-parser.ts                Java-Properties parser
    ├── blz-refresh.scheduler.ts     daily auto-refresh
    └── banks.fallback.json          bundled fallback dataset

apps/api/src/import-pipeline/        (NEW — shared hub for CSV + FinTS)
├── import-pipeline.module.ts
├── import-pipeline.service.ts       dedup, detection, learning, insert
├── raw-booking.dto.ts               shared contract: { iban, bookingDate, amountCents, purposeRaw, ... }
└── (existing detection/learning logic moved here from csv-import)
```

### 2.2 Boundary contract

- `FintsModule` exports nothing except its `FintsController`.
- Sync runs produce `RawBooking[]` and call `ImportPipelineService.ingest(rawBookings, ctx)`. Detection/learning is centralized — no duplicated logic between CSV and FinTS.
- `csv-import` is refactored: parses CAMT to `RawBooking[]` and calls the same `ImportPipelineService.ingest`.
- Master crypto key (`FINTS_MASTER_KEY`) is read only inside `FintsCryptoService` — nowhere else.
- Plaintext PIN exists only inside the request scope of setup or the sync-runner job scope. Never in DB logs, audit logs, or sync-run error messages.

### 2.3 Runtime model

`@nestjs/schedule` cron jobs in the same NestJS process. No Redis, no BullMQ, no separate worker container. Isolation is logical (module + crypto + tables + DTO contract), not process-physical. Future scale path: extract `sync.runner` into a worker container — boundary already supports it.

### 2.4 Happy-path data flow

```
Scheduler ─► SyncRunner.run(connection)
  ─► FintsCryptoService.decrypt(connection.credentials)
  ─► FintsClient.fetchBookings(creds, fromDate, toDate)            [lib-fints]
  ─► BookingMapper.toRawBookings(fintsBookings)
  ─► ImportPipelineService.ingest(rawBookings, {accountId, sourceType:'fints', syncRunId})
       ─► dedup hash → skip existing → insert new
       ─► detection / learning → category suggestions
       ─► fixed-cost match check (no insert if matches a recurring def)
       ─► cluster detection → "possible fixed cost" notification
  ─► SyncRun update (counts, status=OK)
```

---

## 3. Data Model

### 3.1 New entity: `Account`

The codebase currently lacks an Account concept; transactions hang directly off Household. FinTS forces this entity in (one login → multiple sub-accounts), and it cleanly enables the cash-vs-bank separation needed for the lockout policy.

```prisma
model Account {
  id                String      @id @default(cuid())
  householdId       String
  name              String
  type              AccountType
  currency          String      @default("EUR")
  iban              String?
  bic               String?
  isPrivate         Boolean     @default(false)
  ownerId           String?                          // populated when type=fints
  fintsConnectionId String?
  fintsAccountRef   String?                          // lib-fints sub-account identifier
  lastKnownBalanceCents Int?
  lastBalanceAt     DateTime?
  archivedAt        DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  household       Household        @relation(...)
  fintsConnection FintsConnection? @relation(...)
  transactions    Transaction[]

  @@index([householdId])
  @@index([fintsConnectionId])
}

enum AccountType { fints  csv_only  cash  manual }
```

**Lockout policy by type**

| Type | Manual entry | CSV import | Bank-field edit | Classification edit (category, project, fixed-cost link, notes, icon, color) |
|---|---|---|---|---|
| `fints` | ❌ | ❌ | ❌ | ✅ |
| `csv_only` | ✅ | ✅ | ✅ | ✅ |
| `cash` | ✅ | ❌ | ✅ | ✅ |
| `manual` | ✅ | ❌ | ✅ | ✅ |

The bank-field lock applies per-transaction via `Transaction.bankFieldsLockedAt` (NOT NULL ⇒ locked). On the UI side, the edit modal disables IBAN, booking date, amount, purpose, counterparty fields when `bankFieldsLockedAt` is set.

### 3.2 `FintsConnection`

```prisma
model FintsConnection {
  id                 String   @id @default(cuid())
  ownerId            String                        // user, NOT household
  householdId        String                        // for RLS coherence
  bankName           String
  blz                String
  serverUrl          String
  loginName          String
  credentialsCipher  Bytes
  credentialsIv      Bytes                         // 12 bytes
  credentialsTag     Bytes                         // 16 bytes
  status             FintsConnectionStatus @default(SETUP)
  lastScaAt          DateTime?
  scaExpiresAt       DateTime?                     // lastScaAt + 89 days (configurable)
  lastSyncAt         DateTime?
  lastSyncStatus     FintsSyncStatus?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  owner     User           @relation(...)
  household Household      @relation(...)
  accounts  Account[]
  syncRuns  FintsSyncRun[]

  @@index([ownerId])
  @@index([scaExpiresAt])
}

enum FintsConnectionStatus {
  SETUP             // freshly created, no successful sync yet
  ACTIVE
  TAN_REQUIRED      // an in-flight run is awaiting TAN input
  REAUTH_REQUIRED   // 90-day SCA expired or bank demands fresh auth
  DISABLED          // user-disabled
  ERROR             // permanent error, manual intervention needed
}
```

### 3.3 `FintsSyncRun`

```prisma
model FintsSyncRun {
  id               String   @id @default(cuid())
  connectionId     String
  status           FintsSyncStatus
  triggeredBy      SyncTrigger
  triggeredById    String?                        // user id when MANUAL
  startedAt        DateTime @default(now())
  finishedAt       DateTime?
  fromDate         DateTime?
  toDate           DateTime?
  bookingsFetched  Int      @default(0)
  bookingsImported Int      @default(0)
  bookingsSkipped  Int      @default(0)
  balanceDriftCents Int?                          // diff between FinTS HKSAL balance and local TX sum
  tanChallenge     Json?                          // { method, prompt, mediaBase64? } — cleared after consumption
  errorCode        String?
  errorMessage     String?

  connection FintsConnection @relation(...)

  @@index([connectionId, startedAt])
}

enum FintsSyncStatus { RUNNING  OK  FAILED  TAN_REQUIRED  REAUTH_REQUIRED  CANCELLED }
enum SyncTrigger { CRON  MANUAL  SETUP }
```

### 3.4 `Transaction` extensions

```prisma
model Transaction {
  // ... existing fields ...
  accountId          String?                       // NEW — nullable during migration; NOT NULL after backfill
  source             TxSource @default(manual)
  sourceRunId        String?                       // FintsSyncRun.id or CsvImport.id
  bankTxId           String?                       // SEPA endToEndId / messageReference (primary dedup key)
  dedupHash          String                        // sha256(accountId|bookingDate|amountCents|purposeRaw|counterpartyIban) — always set
  bankFieldsLockedAt DateTime?                     // set when source=fints

  account Account? @relation(...)

  @@unique([accountId, dedupHash])
  @@index([bankTxId])
}

enum TxSource { manual  csv  fints }
```

### 3.5 `BlzRegistry`

```prisma
model BlzRegistry {
  id           Int      @id @default(autoincrement())
  fetchedAt    DateTime @default(now())
  sourceCommit String?                              // ETag/commit SHA from upstream
  sourceUrl    String
  recordCount  Int
  banks        Json                                 // BankRecord[] indexed by BLZ
  contentHash  String                               // sha256 of raw upstream payload
}
```

Single-row semantics: only the latest successful snapshot is retained. Historical version audit goes via `AuditLog`.

### 3.6 Migration plan

1. Create new tables and enums (`Account`, `FintsConnection`, `FintsSyncRun`, `BlzRegistry`).
2. Add new columns to `Transaction` (`accountId`, `source`, `sourceRunId`, `bankTxId`, `dedupHash`, `bankFieldsLockedAt`) — all initially nullable.
3. For each existing Household: auto-create one `Account { name: "Hauptkonto", type: csv_only }`.
4. Backfill all existing Transactions: set `accountId` to the household's default account; derive `source` from `csvImportId` (NULL ⇒ `manual`, else ⇒ `csv`); compute `dedupHash` from existing fields.
5. Tighten `accountId` and `dedupHash` to NOT NULL.
6. Add the unique index `[accountId, dedupHash]`.

---

## 4. Crypto & Credential Lifecycle

### 4.1 Master key

- 32-byte hex in env: `FINTS_MASTER_KEY` (generated via `openssl rand -hex 32`).
- Loaded via `ConfigService`, validated at boot — missing or malformed ⇒ API fails to start.
- Provisioned via Docker Compose env file (gitignored) or Portainer stack env. **Never in repo, never in logs.**
- Pino redaction includes `FINTS_MASTER_KEY`, `pin*`, `tan*`, `credentialsCipher`, `tanChallenge`.
- Backup strategy: master key is backed up separately from the database. Without it, encrypted credentials are unrecoverable. Documented in README.

### 4.2 Encrypted payload

A single JSON blob containing:

- PIN (plaintext only inside the encrypt/decrypt boundary)
- lib-fints session state (TAN method list, BPD/UPD bank parameter data, KundenSystemID)

Encrypted with AES-256-GCM. AAD = `connectionId` — bound to its own connection, no cipher swap possible across connections.

### 4.3 `FintsCryptoService` API

```ts
class FintsCryptoService {
  encrypt(connectionId: string, plain: object): { cipher: Buffer; iv: Buffer; tag: Buffer };
  decrypt(connectionId: string, c: FintsConnection): object; // throws on tag mismatch
}
```

### 4.4 Lifecycle rules

1. **Setup:** PIN arrives once in `POST /fints/connections` over HTTPS, gets encrypted immediately. Plaintext PIN buffer is zeroed after `encrypt()` (`buf.fill(0)`).
2. **Sync:** Runner calls `decrypt()`, passes plaintext to `FintsClient.fetchBookings`, plaintext lives only in job scope.
3. **State update:** After each successful lib-fints call, the updated session state is re-encrypted and persisted (TAN method list can change).
4. **Re-auth:** Status `REAUTH_REQUIRED` keeps the PIN cipher intact; only `lastScaAt` and `scaExpiresAt` are reset. The reauth wizard requests only a fresh TAN, not the PIN.
5. **PIN rotation:** Dedicated `POST /fints/connections/:id/rotate-pin` re-encrypts; logs `fints.connection.pin_rotated` in `AuditLog`.
6. **Deletion:** `DELETE /fints/connections/:id` overwrites cipher columns with random bytes before issuing the actual `DELETE`.

### 4.5 Audit logging

Logged to existing `AuditLog`:

- `fints.connection.created` / `deleted` / `disabled` / `enabled`
- `fints.connection.pin_rotated`
- `fints.connection.reauth_required` (set by watcher)
- `fints.sync.started` / `finished` / `failed` (one per run)
- `fints.tan.submitted` (without the TAN value)
- `blz.registry.updated` (with diff stats)

Never logged: PIN, TAN, plaintext lib-fints state.

---

## 5. Sync Lifecycle

### 5.1 Initial setup

```
1. POST /fints/connections
   body: { bankName, blz, serverUrl, loginName, pin, initialFromDate? }
   → FintsConnection created (status=SETUP)
   → Background job starts: lib-fints login + discovery
        - On TAN required (almost always on first login):
            FintsSyncRun created with tanChallenge = { method, prompt, mediaBase64? }
            Status → TAN_REQUIRED
            return SyncRun id

2. Frontend polls GET /fints/sync-runs/:id every 2s (Angular resource())
   → renders TAN modal once tanChallenge is set:
        - decoupled / pushTAN: spinner + hint text + cancel
        - mobile-tan (SMS): 6-digit input, inputmode=numeric, text-base
        - photoTAN / chipTAN-QR: <img src="data:image/png;base64,..."> + input
        - chipTAN-flicker: HHD-code canvas renderer (phase 2 if Sparkasse pushTAN suffices)

3. POST /fints/sync-runs/:id/tan { tan: "123456" }
   → Runner resumes, lib-fints submits TAN
   → On success: lib-fints returns sub-account list
   → Frontend continues to account-selection step:
        GET /fints/connections/:id/discovered-accounts
        POST /fints/connections/:id/accounts/import { selectedRefs, names, isPrivate }
        → Account records persisted

4. Initial sync runs immediately with user-configured fromDate
   (default: maximum bank-permitted window, lib-fints reports the limit)
   Status → ACTIVE; lastScaAt = now; scaExpiresAt = now + 89 days
```

### 5.2 Daily cron

```
@Cron('0 3 * * *')   — 03:00 local time
for each FintsConnection where status = ACTIVE:
  fromDate = lastSyncAt - 2 days   // 2-day overlap catches late bank postings; dedup hash prevents double-insert
  toDate   = today
  runner.run(connection, fromDate, toDate, trigger=CRON)

  if bank demands TAN mid-sync:
    status → REAUTH_REQUIRED, AuditLog, email to owner, notification
    sync run aborted (cron never enters TAN-polling — user must explicitly reauth)

  on lib-fints error:
    SyncRun.status = FAILED, errorCode/Message set
    transient (network / 5xx): up to 3 retries with backoff (5min, 15min, 30min) via BackoffScheduler
    permanent (auth / bank-specific): Connection.status = ERROR, email to owner
```

### 5.3 Manual on-demand sync

```
POST /fints/connections/:id/sync   (any household member, not just owner)
Rate limit: max 1 per 5 minutes per connection (DB check on most-recent run timestamp)
If status = REAUTH_REQUIRED → 409 Conflict { code: "REAUTH_REQUIRED" }
Else: same path as cron, trigger=MANUAL
```

### 5.4 90-day re-auth watcher

```
@Cron('0 8 * * *')   — daily 08:00
for each FintsConnection:
  if scaExpiresAt - now <= 7 days AND no notification in last 24h:
    create Notification (existing notifications module)
    send email: "FinTS connection {bankName} expires on {scaExpiresAt}"

  if scaExpiresAt < now AND status = ACTIVE:
    status → REAUTH_REQUIRED
    AuditLog
```

**Re-auth UX:** User clicks the banner → modal triggers `POST /fints/connections/:id/reauth` (no PIN dialog, only a confirmation) → backend starts a setup-shaped flow with only the TAN step → on success, `lastScaAt`/`scaExpiresAt` reset, status → ACTIVE.

### 5.5 TAN-challenge cleanup

`tanChallenge` is cleared:

- after successful TAN consumption,
- when sync run reaches `OK | FAILED | CANCELLED`,
- after 10 minutes idle (run set to CANCELLED, challenge cleared) — handled by the cleanup cron every 30 minutes.

---

## 6. Mapping & Import Pipeline

### 6.1 `RawBooking` — shared CSV+FinTS contract

```ts
export interface RawBooking {
  iban: string;
  bookingDate: string;            // ISO YYYY-MM-DD (Temporal.PlainDate-compatible)
  valueDate?: string;
  amountCents: number;            // signed
  currency: string;               // "EUR"
  purposeRaw: string;             // full raw purpose, no truncation
  counterpartyName?: string;
  counterpartyIban?: string;
  counterpartyBic?: string;
  bankTxId?: string;              // SEPA endToEndId / messageReference
  bookingType?: string;           // FinTS GVC / SWIFT code
  source: 'csv' | 'fints';
  sourceRunId: string;            // FintsSyncRun.id or CsvImport.id
}
```

### 6.2 `FintsBookingMapper`

- 1:1 mapping from lib-fints booking shape to `RawBooking`.
- `purposeRaw`: all SEPA purpose subfields (`SVWZ`, `EREF`, `KREF`, `MREF`, `ABWA`, `ABWE`) joined with `\n` — no information loss.
- `bankTxId`: prefer `EREF` (endToEndId), fall back to `KREF`, else empty.
- `bookingType`: lib-fints reports the GVC code — passed through raw for downstream pattern matching.
- Sign convention: lib-fints reports debit/credit — mapper converts to signed `amountCents` (debit ⇒ negative).

### 6.3 `ImportPipelineService.ingest(rawBookings, ctx)`

Per booking, in order:

1. **Resolve `accountId`**
   - FinTS: from `ctx.accountId` (runner sets it because each lib-fints sub-account maps to one Klar account).
   - CSV: lookup by IBAN; mismatch ⇒ surface as `CsvImport` error.

2. **Build `dedupHash`**
   `sha256(accountId | bookingDate | amountCents | purposeRaw | counterpartyIban ?? '')`

3. **Existence check**
   - If `bankTxId` present: `SELECT … WHERE accountId = ? AND bankTxId = ?` — hit ⇒ skip.
   - Else (or no hit above): `SELECT … WHERE accountId = ? AND dedupHash = ?` — hit ⇒ skip.

4. **Insert if new**
   - `Transaction` row with `source`, `sourceRunId`, `bankTxId`, `dedupHash`, `bankFieldsLockedAt = now` if `source=fints`, bank fields verbatim, `categoryId = null` initially.
   - **Fixed-cost match check** (existing logic from csv-import): if the booking matches a `RecurringTransaction` definition (amount within tolerance, dayOfMonth ±3), do NOT persist — recurring transactions are computed on-the-fly per Klar invariant. Instead create a `FixedCostMatch` audit row.
   - **Learning layer:** find similar prior transactions (purpose tokens + counterparty + amount-sign), suggest a `categoryId` as `suggestedCategoryId` (not final).
   - **Cluster detection:** if ≥3 transactions with similar amount (±5%) within similar day-cluster (±3 days) over the last 6 months ⇒ create a notification "possible fixed-cost candidate" linking to a recurring-creation dialog.

5. **Return counts** to the sync run (`importedCount`, `skippedCount`, `suggestionsCreated`).

### 6.4 Balance reconciliation (HKSAL)

Each sync run additionally calls `lib-fints.fetchBalance(accountRef)`:

- Stored on `Account.lastKnownBalanceCents` and `lastBalanceAt`.
- Diff vs. local transaction sum stored as `FintsSyncRun.balanceDriftCents`.
- Drift > 1 € ⇒ warning notification "balance drift — possibly missing transactions".

### 6.5 CSV-import migration

- Detection and learning logic moves from `apps/api/src/csv-import/detection/*` into `apps/api/src/import-pipeline/`.
- `csv-import.service` becomes thin: parse CAMT → emit `RawBooking[]` → call `ImportPipelineService.ingest`.
- All affected tests are updated in the same commit (per CLAUDE.md rule — no `it.skip()`).

---

## 7. Bank Registry (BLZ → FinTS-URL Lookup)

### 7.1 Why custom

- `lib-fints` provides no resolver — `bankUrl` must be supplied externally (verified against the library README).
- The npm package `fints-institute-db` has not been published in ~6 years and is not viable.
- The Rust crate `fints-institute-db` (actively maintained) sources its data from `hbci4j/hbci4java`'s `blz.properties` file — the de-facto live upstream for FinTS endpoint metadata.

### 7.2 Source

```
https://raw.githubusercontent.com/hbci4j/hbci4java/master/src/main/resources/blz.properties
```

Java `.properties` format, one line per BLZ with name, BIC, FinTS PIN/TAN URL, HBCI version, and capability flags.

### 7.3 Components

```
apps/api/src/fints/banks/
├── bank-registry.service.ts    // public API: lookup(blz), forceRefresh(), status()
├── blz-fetcher.service.ts      // HTTPS download with ETag support
├── blz-parser.ts               // Java-Properties → BankRecord[]
├── blz-refresh.scheduler.ts    // @nestjs/schedule
├── banks.fallback.json         // bundled cold-start fallback
└── bank-registry.repository.ts // Postgres-persisted snapshot
```

### 7.4 `BankRecord`

```ts
interface BankRecord {
  blz: string;            // 8 digits
  bic?: string;
  name: string;
  shortName?: string;
  city?: string;
  pinTanUrl?: string;     // FinTS PIN/TAN endpoint — not every bank has one
  pinTanVersion?: string; // "300" for FinTS 3.0
  hbciVersion?: string;
}
```

### 7.5 Boot sequence

1. Load `banks.fallback.json` into in-memory cache (cold start always works, even offline).
2. Load latest `BlzRegistry` row from DB; if newer than fallback, replace cache.
3. If DB snapshot older than 7 days or absent ⇒ trigger non-blocking background refresh.

### 7.6 Daily refresh

```
@Cron('30 3 * * *')   — 03:30 local, 30 min after FinTS sync cron
1. HTTP GET with If-None-Match (ETag); 304 ⇒ no-op.
2. On 200:
   - parse Properties → BankRecord[]
   - sha256 vs. last contentHash
   - unchanged ⇒ update fetchedAt only
   - changed ⇒
     - validate: minimum record count (e.g. > 1000), each row parses, mandatory fields present
     - insert new BlzRegistry row
     - reload in-memory cache
     - AuditLog "blz.registry.updated" with added/removed/changed counts
     - notify app-admin if >5% removed (signal of upstream breakage)
3. On network/HTTP error:
   - log warning, no boot failure, no user impact
   - existing cache remains active
   - if 7 days without successful refresh ⇒ notify app-admin
```

### 7.7 Manual refresh

`POST /admin/fints/banks/refresh` — app-admin only (not household-admin). Forces immediate refresh, returns the `BlzRegistry` row.

### 7.8 Lookup behaviour

```ts
bankRegistry.lookup('37050198')
  → { found: true, record: {...}, fintsCapable: true }

bankRegistry.lookup('99999999')
  → { found: false, allowManualOverride: true }

bankRegistry.lookup('12345678')   // listed but no PIN/TAN
  → { found: true, record: {...}, fintsCapable: false,
      message: "Bank known, but no FinTS PIN/TAN endpoint reported" }
```

In the setup wizard, the `serverUrl` field is editable after the lookup (the lookup result is just the default).

### 7.9 Resilience

- Configurable source URL list via `FINTS_BLZ_SOURCES` env (comma-separated) — alternate mirrors allowed.
- Bundled fallback ensures the app works air-gapped.
- Minimum-record validation prevents cache poisoning.

---

## 8. Ownership, Visibility, Authorization

| Concern | Rule |
|---|---|
| FinTS connection | User-owned. Only `ownerId` may edit credentials, submit TAN, delete, or rotate PIN. |
| Connection visibility | Other household members can see status (active / reauth-required / etc.) but cannot interact. |
| Account record | Household-shared by default (matches existing transaction visibility). The owner may mark an account `isPrivate=true` at creation, in which case only the owner sees it (same `PRIVATE` semantics as transactions). |
| Manual sync trigger | Any household member may trigger, subject to the rate limit, provided no TAN is required. |
| Re-auth | Owner only. |
| Setup wizard | Owner only (the user creating the connection). |
| App-admin endpoints | `BLZ` registry refresh, etc. — `AppAdminGuard`. |

`HouseholdMemberGuard` continues to gate `/api/internal/v1/households/:hid/*` routes; `FintsConnection` and `FintsSyncRun` are read-scoped to the household and write-scoped via additional `ownerId === ctx.userId` checks in service methods.

---

## 9. UI (Angular 21, Spartan UI, Mobile-First)

### 9.1 New routes

```
/app/banks                  list of FinTS connections (own + household-visible)
/app/banks/new              wizard: bank → login/PIN → TAN → account selection → done
/app/banks/:id              detail: status, last sync, SCA countdown, sync history
/app/banks/:id/reauth       modal route: TAN-only re-auth wizard
/app/accounts               list of all accounts (FinTS + cash + CSV) with balance
/app/accounts/:id           account detail: filterable transaction list, drift warning
```

`/app/import` (CSV) is locked per account when that account is `type=fints` (banner: "Dieses Konto wird über FinTS synchronisiert. CSV-Import deaktiviert.").

### 9.2 Components

- `klar-bank-connection-card` — status pill, last sync, SCA countdown, action menu (sync now, re-auth, rotate PIN, disable, delete).
- `klar-tan-modal` — single component rendering all `tanChallenge.method` variants.
- `klar-bank-setup-wizard` — three steps (`<hlm-stepper>`): credentials → TAN → account selection with checkboxes plus name and `isPrivate` per account.
- `klar-account-list-item` — balance (`font-mono` + `tabular-nums`), type badge, drift indicator.
- `klar-sync-run-row` — per `FintsSyncRun`: status icon, trigger badge, counts, expandable error text. Desktop = table, mobile = card list.
- `klar-bank-status-banner` — global app-shell banner shown when `count(connections WHERE status=REAUTH_REQUIRED) > 0`.

### 9.3 Locked transactions in the edit modal

When `bankFieldsLockedAt` is set:

- Bank fields rendered with `[disabled]` plus a lock icon and tooltip "Aus FinTS — schreibgeschützt".
- Editable: `category`, `project`, `notes`, `icon`, `color`, `isFixedCost` confirmation, `linkedRecurringTransactionId`.
- Delete button disabled with tooltip "Aus FinTS — wird beim nächsten Sync wiederkommen".

### 9.4 Resource stores

- `BankConnectionStore extends ResourceStore<FintsConnection>`
- `SyncRunStore` — short-lived `pollFor(runId)` mode for the TAN waiting state via Angular `resource()` with a params-signal that switches to TTL after idle.
- `AccountStore extends ResourceStore<Account>`

Mutations are reactive — after `submitTan()`, the store signal updates immediately (CLAUDE.md mandate).

### 9.5 Mobile-first specifics

- Setup wizard: full-screen modal on mobile, vertical stepper; horizontal sidebar steps on desktop.
- Account-selection list: virtualized via `klar-virtual-list` — some banks expose many sub-accounts.
- TAN input: `text-base` (16px), `autocomplete="one-time-code"`, `inputmode="numeric"`.
- Re-auth banner respects safe-area insets and does not overlap the bottom nav.

### 9.6 Notifications and email

Existing `notifications` module is reused. New types:

- `fints.reauth_warning` (7 days before SCA expiry)
- `fints.reauth_required` (expired or bank-demanded SCA)
- `fints.sync_failed` (after 3 unsuccessful retries)
- `fints.balance_drift` (drift > 1 €)
- `fints.fixed_cost_candidate` (cluster detection)
- `fints.blz_registry_stale` (refresh failing > 7 days, app-admin only)

Email templates added under existing `mail-templates`.

---

## 10. Testing Strategy

Coverage targets per CLAUDE.md: backend ≥ 80% lines, frontend ≥ 70% lines.

### 10.1 Backend (Vitest)

**Unit**

- `FintsCryptoService` — encrypt/decrypt round-trip; tag mismatch throws; AAD binding fails on foreign `connectionId`.
- `FintsBookingMapper` — sign convention, SEPA subfield handling, missing `bankTxId`.
- `BlzParser` — happy path; malformed lines are skipped with a warning, not crashing the parser.
- `FintsSyncRunner` — with mocked `FintsClient`: happy path, TAN required, re-auth, transient retry, permanent error.

**Repository integration (test DB, per-test rollback)**

- `ImportPipelineService.ingest` — dedup via `bankTxId`, dedup via `dedupHash`, fixed-cost-match path, cluster detection, FinTS does not overwrite a user-set category on a pre-existing CSV transaction (collision protection).
- `BankRegistryRepository` — snapshot replacement, latest-row semantics.

**E2E (Supertest)**

- Setup endpoint, TAN submit, account import, manual sync trigger, re-auth flow.
- RLS cross-tenant: Marco cannot read Bea's connection in another household; another member of Marco's household can read but not edit Marco's connection.

**lib-fints integration**

A suite using **recorded fixtures** — sanitized real lib-fints responses as JSON files. `FintsClient` is exercised in tests against an in-process fake backend (msw-node) that replays the fixtures. No live bank traffic in CI.

### 10.2 Frontend (Vitest)

- `BankConnectionStore` mutation/state updates after `connect`, `submitTan`, `triggerSync`.
- `klar-tan-modal` snapshots for all five render variants.
- `klar-bank-setup-wizard` step progression and validation.
- `klar-account-list-item` drift-warning rendering.

### 10.3 Playwright (mandatory per Marco)

- Setup happy path against mock FinTS (backend feature flag `FINTS_MOCK_MODE=true` switches `FintsClient` to an in-memory fake).
- TAN modal interaction.
- Re-auth banner click.
- Manual sync trigger.
- Lockout UI: transaction belonging to a `fints` account → bank fields disabled.

---

## 11. Rollout Phases

The umbrella phase is **14a — FinTS Integration** (between phase 13 "UI-Politur" and phase 14 "Hardening").

- **14a.1 Foundation** — `Account` model, `Transaction` extensions, backfill migration. Existing code/tests adjusted, no FinTS code, no UX change.
- **14a.2 Import-pipeline extraction** — detection/learning extracted from csv-import; CSV path uses it; cluster detection formalised.
- **14a.3 FinTS module skeleton** — `FintsConnection`, crypto service, repo, stub client (no real lib-fints), setup endpoint and wizard against a mock-mode client.
- **14a.4 BLZ registry** — fetcher, parser, scheduler, fallback bundle, lookup endpoint, admin refresh route.
- **14a.5 lib-fints integration** — real `FintsClient`, mapper, account discovery, initial sync. Recorded-fixtures tests.
- **14a.6 TAN flow + UI modal** — all variants except possibly chipTAN-flicker (deferred to 14a.8 if time-pressed).
- **14a.7 Cron + reauth watcher** — daily sync, 90-day logic, notifications, emails.
- **14a.8 Lockout UI + balance drift + cluster notifications** — bank-field locking in transaction edit, drift warning, cluster suggestions.
- **14a.9 Hardening** — audit-log gap closure, Pino-redaction review, rate limits, master-key documentation, README updates per DoD point 6, Playwright smoke.

Each sub-phase: green tests, coverage met, README updated for any user-facing addition, single coherent commit.

---

## 12. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| lib-fints does not handle some bank's quirks | Recorded fixtures plus a real Sparkasse account on Marco's prod stack as live test bank; per-bank quirks live in a `bank-quirks.ts` config map. |
| Master-key loss ⇒ all credentials unrecoverable | Backup instructions in README; `/health` endpoint asserts key presence; on restore, users re-enter PINs. |
| Bank rate-limits us on too-frequent syncs | lib-fints session caching (BPD reuse); back-off on 429-equivalent; user-facing error message. |
| TAN timeout during cron | Cron never solicits TAN — on TAN demand it sets `REAUTH_REQUIRED` and notifies; no hanging jobs. |
| chipTAN-flicker is complex to implement | Deferred to phase 14a.8; Sparkasse pushTAN covers the primary use case. |
| PSD2 SCA window changes | Configurable `FINTS_SCA_DAYS=89`; if the bank advertises a shorter window via lib-fints, watcher reacts to bank-reported `lastScaAt` rather than the fixed 89-day calculation. |
| Cash-vs-bank separation confuses users | Onboarding hint in setup wizard; README section "FinTS account vs. cash account". |
| `hbci4j/hbci4java` upstream goes away | `FINTS_BLZ_SOURCES` accepts alternate mirrors; bundled fallback always works; admin notification on stale-refresh after 7 days. |

---

## 13. Out of Scope (this iteration)

- Write operations (transfers).
- Multi-bank aggregation as virtual accounts.
- HSM/KMS-backed crypto.
- Per-user passphrase-derived encryption.
- Mobile-app native TAN integration.

---

## 14. Open Items for Implementation Phase

These are deliberately deferred to the writing-plans / implementation phase, not pre-decided here:

- Exact `lib-fints` API surface for resuming a session that needs TAN — verify by reading the library source during phase 14a.5 and document the chosen pattern in the implementation plan.
- Final list of TAN methods supported on day one vs. deferred (chipTAN-flicker is the primary candidate for deferral).
- The BLZ-properties parser must handle whatever encoding `hbci4j` ships (likely ISO-8859-1 or UTF-8) — to be confirmed in 14a.4.

---

## References

- [robocode13/lib-fints](https://github.com/robocode13/lib-fints) — chosen FinTS client library (verified: no built-in BLZ resolver).
- [svenstaro/fints-institute-db](https://github.com/svenstaro/fints-institute-db) — Rust crate that pointed us at the live BLZ data source.
- [hbci4j/hbci4java](https://github.com/hbci4j/hbci4java) — upstream BLZ-properties data.
- `docs/superpowers/specs/2026-05-05-csv-import-sparkasse-design.md` — predecessor CSV import design; pipeline being extended in 14a.2.
- `CLAUDE.md` — house rules: TDD, coverage thresholds, mobile-first, Spartan UI, encryption / logging redaction, README DoD.

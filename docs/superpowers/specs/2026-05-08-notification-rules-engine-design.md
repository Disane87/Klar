# Notification Rules Engine + Configurable FinTS Sync Interval

**Status:** Draft · **Date:** 2026-05-08 · **Owner:** Marco

A user-modeled notification rules engine that fires on transactions, standing orders,
budget thresholds, FinTS sync events, and time-based schedules — delivered to in-app
inbox, web push (OS-level), and email. Plus a per-connection FinTS sync interval
selector that replaces the global daily cron.

## Goals

- Generic rules engine: user defines what to be notified about via a typed
  predicate builder. No hard-coded "alert types".
- Three delivery channels (in-app, web push, email) per rule, multi-device push,
  iOS PWA support.
- Quiet hours, per-rule throttling, optional digest mode (immediate / hourly /
  daily) — no spam on bulk imports.
- Time-based ("scheduled") rules that evaluate aggregations against current
  state (account balance, budget usage, sums/counts over windows, upcoming
  standing orders).
- Per-FinTS-connection sync interval (preset dropdown, min 4h).
- PRIVATE transactions stay private — only their owner's rules see them.

## Non-Goals

- Native iOS/Android push (web push only).
- SMS / Telegram / arbitrary webhook channels (can be added later as another
  dispatcher).
- Free-form JS scripting in rules (predicate builder covers it).
- Cross-household rules.
- Geofence / location triggers.

## Architecture

```
Producers ─emit→ EventEmitter2 ─→ RulesEngine ─→ ChannelDispatchers
  • TransactionEvents                  │           • InAppDispatcher
  • StandingOrderTick                  │           • WebPushDispatcher
  • BudgetEvents                       │           • EmailDispatcher (+ Digest)
  • FintsSyncEvents                    ↓
  • ScheduledTick (cron-per-rule)   Predicate-Evaluator + Aggregations
```

Backend modules:

- `notification-rules/` — service, repository, controller, predicate evaluator,
  aggregation providers, scheduler registry rehydration.
- `notification-channels/` — `WebPushDispatcher`, `EmailDispatcher`, digest
  queue + two flush crons.
- `notifications/` — existing in-app sink, reused as `InAppDispatcher`.
- `fints/sync/` — gets `syncInterval` per connection + hourly master tick.

Shared (`packages/shared/notification-rules/`):

- `predicate-types.ts` — typed AST.
- `predicate-evaluator.ts` — pure function, used by backend (live evaluation)
  and frontend (preview "would have fired").
- `humanize.ts` — predicate → human-readable German string.
- `aggregations.ts` — per-trigger field/operator whitelist (drives both
  backend validation and frontend builder).

Frontend:

- `apps/web/src/app/pages/settings/notifications/` — settings subpage with
  three tabs (general / rules / activity).
- `apps/web/src/app/shared/notification-rules/klar-predicate-builder.component.ts`
  — recursive AND/OR/NOT builder.
- `apps/web/src/app/core/notifications/web-push.service.ts` — service worker
  registration, subscribe/unsubscribe.
- `apps/web/src/sw-push.js` — custom service worker that imports
  `ngsw-worker.js` and adds `push` + `notificationclick` handlers.

## Data Model (Prisma)

```prisma
model NotificationRule {
  id              String                @id @default(cuid())
  householdId     String                // RLS
  userId          String                // owner — rule is private per user
  name            String
  enabled         Boolean               @default(true)

  trigger         NotificationTrigger
  predicateJson   Json                  // AST, validated via zod (shared)

  schedule        Json?                 // only for trigger=SCHEDULED:
                                        // { type: 'daily'|'weekly'|'monthly',
                                        //   time: 'HH:mm', dayOfWeek?,
                                        //   dayOfMonth? }
  leadTimeDays    Int?                  // only for STANDING_ORDER_DUE (default 1)

  channels        NotificationChannel[] // [IN_APP, WEB_PUSH, EMAIL]
  digestMode      DigestMode            @default(IMMEDIATE)

  cooldownMinutes Int?
  maxPerHour      Int?
  maxPerDay       Int?

  lastFiredAt     DateTime?
  firedCountToday Int                   @default(0)
  firedBucketDate DateTime?

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  household       Household             @relation(...)
  user            User                  @relation(...)
  fires           NotificationRuleFire[]

  @@index([householdId, userId, enabled])
  @@index([trigger, enabled])
}

enum NotificationTrigger {
  TRANSACTION_CREATED
  STANDING_ORDER_DUE
  BUDGET_THRESHOLD
  FINTS_SYNC_EVENT
  SCHEDULED
}

enum NotificationChannel { IN_APP  WEB_PUSH  EMAIL }
enum DigestMode          { IMMEDIATE  HOURLY  DAILY }

model NotificationRuleFire {
  id             String                @id @default(cuid())
  ruleId         String
  sourceKind     String                // 'transaction' | 'standing_order' | …
  sourceId       String
  firedAt        DateTime              @default(now())
  channelsSent   NotificationChannel[]
  notificationId String?               // FK to created in-app notification
  rule           NotificationRule      @relation(...)
  @@unique([ruleId, sourceKind, sourceId])
  @@index([ruleId, firedAt])
}

model WebPushSubscription {
  id          String   @id @default(cuid())
  userId      String
  householdId String
  endpoint    String   @unique
  p256dh      String
  auth        String
  userAgent   String?
  createdAt   DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  user        User     @relation(...)
  @@index([userId])
}

model NotificationDigestQueue {
  id          String              @id @default(cuid())
  userId      String
  channel     NotificationChannel
  ruleId      String
  payloadJson Json
  bucketKey   String              // 'hour:2026-05-08T14' | 'day:2026-05-08'
  createdAt   DateTime            @default(now())
  @@index([userId, channel, bucketKey])
}

model NotificationUserSettings {
  userId          String   @id
  householdId     String
  quietHoursStart String?  // 'HH:mm', null = disabled
  quietHoursEnd   String?
  quietHoursTz    String?  // IANA TZ, default 'Europe/Berlin'
  emailEnabled    Boolean  @default(true)
  webPushEnabled  Boolean  @default(true)
  user            User     @relation(...)
}

// Extension to existing FintsConnection:
enum FintsSyncInterval { MANUAL  H4  H6  H12  H24  H48  H168 }

model FintsConnection {
  // …existing fields…
  syncInterval FintsSyncInterval @default(H24)
  syncEnabled  Boolean           @default(true)
  nextSyncAt   DateTime?
}
```

### Predicate AST (in `packages/shared`, zod-validated)

```ts
type Predicate =
  | { op: 'and' | 'or'; clauses: Predicate[] }
  | { op: 'not'; clause: Predicate }
  | {
      op: 'cmp';
      field: TriggerField; // restricted per trigger via aggregations.ts
      operator: '=' | '!=' | '>' | '>=' | '<' | '<='
              | 'in' | 'notIn' | 'contains' | 'startsWith' | 'matches';
      value: string | number | string[] | { aggregation: AggregationSpec };
    };

type AggregationSpec =
  | { type: 'accountBalance'; accountId: string }
  | {
      type: 'sumAmount' | 'countTransactions';
      window: 'thisMonth' | 'last7d' | 'last30d' | 'customDays';
      days?: number;
      categoryIds?: string[];
      projectIds?: string[];
      counterpartyMatch?: string;
      kind?: 'income' | 'expense' | 'all';
    }
  | { type: 'budgetUsedPct'; categoryId: string; month?: 'current' }
  | { type: 'upcomingStandingOrdersSum'; days: number }
  | { type: 'upcomingStandingOrdersCount'; days: number };
```

Per-trigger field whitelists live in `aggregations.ts`. Example for
`TRANSACTION_CREATED`: `amountCents, kind, categoryId, projectId, accountId,
counterpartyName, counterpartyIban, description, valueDate`. Backend rejects
predicates referencing fields outside the trigger's whitelist; frontend builder
only offers whitelisted fields.

## Trigger Sources & Data Flow

Producers emit via NestJS `EventEmitter2`. Decouples producers from the rules
engine and keeps testing easy.

| Trigger              | Producer                                                      | Idempotency key                              |
|----------------------|---------------------------------------------------------------|----------------------------------------------|
| `TRANSACTION_CREATED`| `ImportPipelineService.ingest()`, `TransactionsService.create()` | `transactionId`                           |
| `STANDING_ORDER_DUE` | Daily cron 06:00, scans `T+leadTimeDays` per rule             | `${standingOrderGroupKey}|${dueDate}`        |
| `BUDGET_THRESHOLD`   | `TransactionsService` after mutation, threshold freshly crossed| `${budgetId}|${month}|${thresholdPct}`      |
| `FINTS_SYNC_EVENT`   | `FintsSyncService` (start/finish/fail), `ReauthWatcherScheduler`| `${syncRunId}|${eventType}`                |
| `SCHEDULED`          | Per-rule dynamic cron via `SchedulerRegistry`                 | `${ruleId}|${ISO-time-bucket}`               |

### Rules Engine Evaluation Pipeline

```
Event arrives
  ↓
RulesEngine.evaluate(trigger, event)
  ↓
findRules({ trigger, enabled, householdId })
  ↓
for each rule:
  1. PRIVATE check: tx.privacy === PRIVATE && tx.ownerId !== rule.userId → skip
  2. predicateEvaluator.evaluate(rule.predicate, eventContext, aggregations)
     └─ aggregations resolved lazily, memoized per evaluation
  3. if true:
     a) idempotency: NotificationRuleFire-unique([ruleId, sourceKind, sourceId])
     b) throttle: lastFiredAt + cooldown, hourly/daily counters
     c) quiet hours: if active → channels = [IN_APP] (push/email queued for digest)
     d) digest: IMMEDIATE → dispatch now,
                HOURLY/DAILY → enqueue NotificationDigestQueue
  4. dispatch(rule, payload, channels):
     - InAppDispatcher → notifications.service.enqueue() (existing)
     - WebPushDispatcher → web-push.sendNotification() per subscription
     - EmailDispatcher → mail.send() with template
  5. write NotificationRuleFire (channelsSent[])
```

### Bulk Import Deduplication

`ImportPipelineService` batches all `transaction.created` events emitted during
a single ingest and fires them after pipeline completion. The rules engine
groups matches per rule so a CSV import that triggers a rule 12 times produces
one in-app notification ("12 new bookings match …") rather than 12.

### Scheduled Rule Implementation

```ts
// On rule create/update with trigger=SCHEDULED:
this.scheduler.addCronJob(`rule:${rule.id}`, new CronJob(
  cronExpr,                // derived from rule.schedule
  () => this.evaluateScheduledRule(rule.id),
  null, true,
  rule.user.timezone ?? 'Europe/Berlin',
));
```

`OnApplicationBootstrap` rehydrates all enabled scheduled rules. Disable/delete
calls `deleteCronJob`. Single API instance — no distributed locking.

### FinTS Sync Scheduler

Replaces today's `@Cron(EVERY_DAY_AT_3AM)` for all connections with:

- Hourly master cron `FintsSyncTickScheduler` (`@Cron('0 * * * *')`).
- Each tick: `findMany({ where: { syncEnabled: true, status: 'READY',
  nextSyncAt: { lte: now } } })`.
- For each due connection: `start({ triggeredBy: 'CRON' })`, then
  `nextSyncAt = now + intervalHours`.
- `MANUAL` skipped by the scheduler — only the "Sync now" button fires.
- `nextSyncAt` recalculated when the user changes the interval.

### Digest Scheduler

Two crons:

- `@Cron('0 * * * *')` — flushes `bucketKey LIKE 'hour:*'`, grouped by
  `(userId, channel)`.
- `@Cron('0 8 * * *')` — flushes `bucketKey LIKE 'day:*'`, one push/email
  per user per channel summarising all matched rules.

## Web Push

### Backend

Dependency: `web-push` (RFC 8030/8291). VAPID keys generated once and pinned
in `.env`:

```
VAPID_PUBLIC_KEY=BNc...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@your-klar-instance.com
```

Helper: `pnpm vapid:generate`. Validated via zod in `ConfigService`.

Endpoints (`/households/:hid/push-subscriptions`):

- `GET /vapid-public-key` — public key (unauthenticated).
- `POST /` — upsert on `endpoint` (unique).
- `DELETE /:id` — remove own subscription.
- `GET /` — list own subscriptions for "manage devices" UI.

`WebPushDispatcher`:

```ts
async send(userId: string, payload: PushPayload) {
  const subs = await repo.findByUserId(userId);
  await Promise.all(subs.map(async sub => {
    try {
      await webPush.sendNotification(sub, JSON.stringify(payload), { TTL: 86400 });
      await repo.touchLastSeen(sub.id);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await repo.delete(sub.id); // expired/gone
      } else {
        this.logger.warn({ err: e, subId: sub.id }, 'push delivery failed');
      }
    }
  }));
}
```

Payload shape (kept small, push services cap ~4KB):

```ts
{
  title: string,
  body: string,
  icon: '/icons/icon-192.png',
  badge: '/icons/badge-72.png',
  tag: `rule:${ruleId}`,        // replaces previous notification of same rule
  url: '/app/buchungen/123',    // deep link opened by SW
  notificationId: string,       // FK to in-app, used for mark-read on click
}
```

### Service Worker

Klar uses `@angular/pwa` with `ngsw-worker.js`, which doesn't expose push
hooks. Solution: custom SW that imports ngsw as a fallback:

```js
// apps/web/src/sw-push.js
importScripts('./ngsw-worker.js');

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: data.icon, badge: data.badge, tag: data.tag,
    data: { url: data.url, notificationId: data.notificationId },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { url, notificationId } = event.notification.data;
  event.waitUntil((async () => {
    if (notificationId) {
      fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    }
    const clients = await self.clients.matchAll({ type: 'window' });
    const existing = clients.find(c => c.url.includes(url));
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});
```

`angular.json` registers `sw-push.js` instead of the default ngsw service
worker; the build copies `ngsw-worker.js` next to it so `importScripts`
resolves.

### Frontend Service

`WebPushService` in `apps/web/src/app/core/notifications/`:

```ts
@Injectable({ providedIn: 'root' })
export class WebPushService {
  readonly permission = signal<NotificationPermission>('default');
  readonly subscribed = signal(false);

  async enable(): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' };
    }
    const perm = await Notification.requestPermission();
    this.permission.set(perm);
    if (perm !== 'granted') return { ok: false, reason: perm };

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = await firstValueFrom(this.api.getVapidPublicKey());
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await firstValueFrom(this.api.subscribe({
      endpoint: sub.endpoint,
      keys: sub.toJSON().keys,
      userAgent: navigator.userAgent,
    }));
    this.subscribed.set(true);
    return { ok: true };
  }

  async disable() { /* unsubscribe + DELETE on backend */ }
}
```

### iOS Special Case

Web push works on iOS ≥ 16.4 only when the site is installed as a PWA.
Toggle gates on:

```ts
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                  || (navigator as any).standalone;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
if (isIOS && !isStandalone) {
  // toggle disabled, hint: "Add to Home Screen first"
}
```

Reuses the existing iOS install hint flow.

## Frontend: Rules Builder UI

### Routes

```
/app/settings/notifications
  ├── Tab "Allgemein"  → quiet hours, email/push master toggles, device list
  ├── Tab "Regeln"     → rule list + "Neue Regel"
  └── Tab "Aktivität"  → last 50 fires (klar-virtual-list, paginated)
```

### Rules List

Mobile: card list. Desktop: compact table. Per row:

- name + trigger badge (`Buchung` / `Dauerauftrag` / `Budget` / `FinTS` /
  `Zeitplan`),
- humanised predicate (e.g. *"Eingang > 1.000 €, Konto Hauptkonto"*) via
  `packages/shared/notification-rules/humanize.ts`,
- channel icons (inbox / push / mail), digest-mode badge,
- enabled toggle, edit (modal), delete.

Reuses `klar-virtual-list`, `klar-tile`, `klar-dialog-callout`. Edit always
opens a dialog (Marco rule: modal over inline).

### Rule Builder Modal

```
┌────────────────────────────────────────────────────┐
│ NEUE REGEL                                    [X]  │
│ Name: Großer Eingang                               │
│ ──────────────────────────────────────────────     │
│ Wann?                                              │
│  (•) Buchung  ( ) Dauerauftrag fällig              │
│  ( ) Budget-Schwelle  ( ) FinTS-Sync               │
│  ( ) Zeitplan                                      │
│ ──────────────────────────────────────────────     │
│ Bedingung (klar-predicate-builder)                 │
│  Alle treffen ▼                                    │
│   Betrag    ▼  > ▼   1000     [×]                  │
│   Kategorie ▼  ist ▼ Gehalt   [×]                  │
│   + Bedingung    + Gruppe                          │
│  Hinweis: 12 vergangene Buchungen würden matchen   │
│ ──────────────────────────────────────────────     │
│ Kanäle                                             │
│  [✓] Inbox  [✓] Push (3 Geräte)  [ ] Email         │
│ ──────────────────────────────────────────────     │
│ Wann benachrichtigen?                              │
│  (•) Sofort  ( ) Stündlich  ( ) Täglich            │
│  Cooldown: [10] Min  Max/Tag: [5]                  │
│ ──────────────────────────────────────────────     │
│ [Test-Regel ausführen]    [Abbrechen][Speichern]   │
└────────────────────────────────────────────────────┘
```

`klar-predicate-builder` is recursive (and/or/not groups). Each row exposes
three `klar-select` controls: field, operator, value. The value control is
polymorphic: `klar-category-select` for categoryId, `klar-account-select` for
accountId, `klar-input` for free text, nested sub-form for aggregation values.

**Never a native `<select>`** — Marco rule, enforced by the existing UI hygiene
gate. Form-level validation errors render as `<klar-dialog-callout
tone="danger" icon="x">`.

Trigger switch resets predicate fields incompatible with the new trigger
(prevents impossible combinations).

### Live Preview

Edit-time `POST /notification-rules/preview` runs the predicate against the
last 90 days of real data:

```ts
{ wouldHaveFiredCount: 12, sample: [{ at, title }, ...3] }
```

Shown under the builder: *"In den letzten 90 Tagen hätte das 12× gefeuert"*.
Aggregated lazily and cached per evaluation.

### Test Button

`POST /notification-rules/:id/test` sends a sample notification through every
enabled channel — the "I hear it ring, it works" loop.

### FinTS Sync Interval UI

Lives on the existing FinTS connection detail page (`/app/settings/banks/:id`):

```
Sync                                 [Sync jetzt]
Intervall:  [Täglich ▼]
            ├ Manuell
            ├ Alle 4 Stunden
            ├ Alle 6 Stunden
            ├ Alle 12 Stunden
            ├ Täglich (Standard)
            ├ Alle 2 Tage
            └ Wöchentlich
Letzter Sync:  vor 3 Stunden  ✓
Nächster Sync: morgen 03:00
```

`klar-select`. On save the backend recomputes `nextSyncAt = now + interval`,
the UI immediately reloads the connection store (mutation reload, Marco rule).

## API Surface

```
GET    /households/:hid/notification-rules
POST   /households/:hid/notification-rules
GET    /households/:hid/notification-rules/:id
PATCH  /households/:hid/notification-rules/:id
DELETE /households/:hid/notification-rules/:id
POST   /households/:hid/notification-rules/preview     // dry-run vs 90d
POST   /households/:hid/notification-rules/:id/test    // send sample

GET    /households/:hid/notification-rules/activity    // recent fires

GET    /households/:hid/notification-settings          // per-user settings
PATCH  /households/:hid/notification-settings

GET    /households/:hid/push-subscriptions/vapid-public-key
GET    /households/:hid/push-subscriptions
POST   /households/:hid/push-subscriptions
DELETE /households/:hid/push-subscriptions/:id

PATCH  /households/:hid/fints/connections/:id          // includes syncInterval, syncEnabled
```

All routes guarded by `JwtAuthGuard` + `HouseholdMemberGuard`. Service methods
take `RequestContext` first; `householdId` always derived from `:hid`, never
from body. All `findMany` queries explicitly filter by `householdId`.

## Migrations (in order)

1. `add_notification_rules` — `NotificationRule`, `NotificationRuleFire`,
   enums `NotificationTrigger`, `NotificationChannel`, `DigestMode`.
2. `add_web_push_subscriptions` — `WebPushSubscription`.
3. `add_notification_digest_queue` — `NotificationDigestQueue`.
4. `add_notification_user_settings` — `NotificationUserSettings`. Default row
   created on demand, no backfill.
5. `add_fints_sync_interval` — enum `FintsSyncInterval`, `syncInterval`,
   `syncEnabled`, `nextSyncAt` on `FintsConnection`. Backfill: every existing
   connection → `H24`, `nextSyncAt = now + 24h`.

Each migration is independently deployable; Prisma RLS middleware applies
automatically.

## Tests

Coverage gates: API 80% lines, web 70% lines.

| Layer                                                            | Test                                                                                              |
|------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `packages/shared/.../predicate-evaluator.spec.ts`                | pure-func: `and/or/not`, every operator, every field type, property-based where applicable        |
| `packages/shared/.../humanize.spec.ts`                           | predicate → DE string for every trigger × operator                                                |
| `notification-rules.service.spec.ts`                             | listing, create-validation (zod against trigger whitelist), idempotency, throttle, quiet hours, PRIVATE skip |
| `notification-rules.repository.spec.ts`                          | integration with test DB, rollback per test, daily counter bucket reset                           |
| `web-push.dispatcher.spec.ts`                                    | 410 cleanup, multi-sub fan-out, mocked `web-push`                                                  |
| `digest.scheduler.spec.ts`                                       | hourly/daily bucket grouping per `(userId, channel)`                                              |
| `fints-sync.scheduler.spec.ts`                                   | only due connections sync, `nextSyncAt` updated, MANUAL skipped                                    |
| `notification-rules.controller.e2e-spec.ts`                      | cross-tenant isolation, `/preview`, `/test`                                                        |
| `apps/web/.../predicate-builder.component.spec.ts`               | AST ↔ form state, add/remove group, trigger switch resets incompatible fields                     |
| `apps/web/.../web-push.service.spec.ts`                          | permission flows mocked, iOS standalone detection                                                  |
| `apps/web/e2e/notifications.spec.ts` (Playwright)                | create rule → trigger → notification appears in inbox; FinTS interval change persists. **Required by CLAUDE.md.** |

## Implementation Phases

Each phase = one commit, runnable end-to-end, tests green.

| #  | Phase                                  | Contents                                                                                                                              |
|----|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Foundation                             | Migrations 1–4, shared types + predicate evaluator + humanizer + trigger whitelist, EventEmitter2 setup                                |
| 2  | Rules CRUD + In-App                    | `notification-rules` module, `TRANSACTION_CREATED` producer in ImportPipeline + TransactionsService, InAppDispatcher, throttle + quiet hours + idempotency |
| 3  | Web Push                               | `web-push` lib, VAPID setup, `WebPushSubscription` CRUD, `WebPushDispatcher`, custom service worker, `WebPushService` (frontend), iOS detection |
| 4  | Email + Digest                         | `EmailDispatcher` + templates `notification-immediate.hbs` + `notification-digest.hbs`, digest queue + two flush crons                  |
| 5  | Additional Triggers                    | `STANDING_ORDER_DUE` (daily lookahead), `BUDGET_THRESHOLD` (in TransactionsService post-mutation), `FINTS_SYNC_EVENT` (in FintsSyncService + ReauthWatcher) |
| 6  | SCHEDULED Trigger + Aggregations       | `SchedulerRegistry` with rehydration, all four aggregation providers, lazy evaluation in predicate evaluator                            |
| 7  | Frontend Rules UI                      | settings subpage, rule list, builder modal, predicate-builder component, live preview (`/preview`), test button                        |
| 8  | FinTS Per-Connection Interval          | migration 5, master-cron refactor, banking detail UI with `klar-select`                                                                |
| 9  | Polish + Docs                          | README features table + detail section, CHANGELOG, Playwright e2e green, coverage check                                                |

## Risks & Mitigations

| Risk                                                | Mitigation                                                                                                                              |
|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| CSV bulk import fires 200 push notifications        | Per-rule throttle + `digestMode=HOURLY/DAILY`. ImportPipeline batches `transaction.created` events; rules engine groups matches per rule before dispatch. |
| Aggregations are expensive (sumAmount, budgetUsedPct)| Lazy: only evaluated when the predicate references them, memoised per evaluation                                                       |
| `SchedulerRegistry` rehydration race at boot        | `OnApplicationBootstrap` runs synchronously before first request; rule updates do sequential `delete` + `add`                          |
| VAPID key loss = all subscriptions dead             | Pin keys in `.env`, document in personal memory, include in backup. Web push is best-effort; in-app inbox stays the source of truth.    |
| Predicate AST schema drift between DB and UI        | Single zod schema in `packages/shared`, used for backend create/update validation and frontend form building. Tests against every trigger × operator. |
| Bank rate-limit at tight intervals                  | Whitelist (min 4h). Bank-side rate limits are logged but don't auto-disable the connection.                                            |
| PRIVATE leakage                                     | Cross-tenant test suite: a User B rule with predicate `*` must never see a User A PRIVATE transaction on any channel                   |

## Open Questions

None — all decisions captured during brainstorming.

## References

- Existing `apps/api/src/notifications/` — in-app inbox, reused as `InAppDispatcher`.
- Existing `apps/api/src/fints/sync/fints-sync.service.ts` — sync orchestrator
  to be wrapped by the new master tick scheduler.
- `packages/shared/standing-orders/detect-transaction-kind.ts` — already
  classifies transactions; `kind` is a predicate field in
  `TRANSACTION_CREATED` rules.
- CLAUDE.md rules: PRIVATE-aware aggregation, RequestContext on services,
  `householdId` always from `:hid`, no native `<select>`, modal over inline
  edit, mobile-first, Playwright after every implementation, README updated
  per feature.

# Klar Design Pearl — Strict 1:1 Page-by-Page Adoption

**Status:** Design / pending implementation
**Branch:** `feature/design-pearl`
**Source of truth:** `C:\tmp\design-pearl\klar\` (Klar Design Pearl bundle from claude.ai/design)
**Predecessor commits:** see branch history (33 commits already on `feature/design-pearl` covering tokens, sidebar, primitives, audit fixes, Verträge / Kalender / Statistik new pages, Notifications backend, splits backend, Notiz model, etc.).

## Context

Marco has provided a complete handoff bundle from Claude Design containing a styled HTML/JSX prototype of the entire Klar app. Earlier work brought the foundation, primitives, and several pages to 1:1, but a number of pages still deviate. Marco's directive: **strict 1:1 with the bundle, full-stack rebuilds permitted, ask when unsure**.

This spec covers the remaining nine pages in priority order. Each phase ships a dedicated commit (or small commit cluster) and concludes with build / lint / test green.

## Order (confirmed)

1. **Buchungen** — small, high-use
2. **Projekte** — medium, visible
3. **Settings** — large, daily use
4. **Cashflow (Monat)** — medium + needs a new aggregation endpoint
5. **Haushalt** — large
6. **Admin** — very large + many new telemetry endpoints
7. **Auth pages** — medium (mostly polish)
8. **Komponenten-Spec** — small (dev gallery, optional)
9. **CRUD-Demo** — small (dev gallery, optional)

## Common conventions (apply to every phase)

- Render with the global bundle primitives already in `apps/web/src/styles.css`: `.card`, `.row`, `.row-ico-slot`, `.lhs`, `.amt`, `.row.subtotal`, `.card-header`, `.setting-group`, `.setting-card`, `.setting-row`, `.setting-icon`, `.user-switch`, `.segmented`, `.profile-card`, `.app-info`, `.section-head`, `.eyebrow`, `.chip`, `.btn[.tone[.solid]]`, `.kbd`, `.input`, `.money-input`, `.field-label`, `.klar-pop`, `.klar-pop-center`.
- Page header is set via `PageHeaderService.set({ title, subtitle, showAdd, showExport, showUserSwitch, scopeSegments, … })` — never inline.
- Hero figures (€-amounts, KPIs) use Fraunces (`var(--font-display)`, `letter-spacing: -0.02em`); table figures use mono (`mono` utility).
- Eyebrow labels: `.eyebrow` class (10 px uppercase 0.14 em).
- All edits open via dialog/modal (Marco-Vorgabe), never inline.
- iOS rules: inputs ≥ 16 px, touch ≥ 44 px, no `100vh`, safe-area insets.
- DRY: reuse existing primitives before creating new ones; new shared components land under `apps/web/src/app/shared/ui/` with the `klar-*` selector.
- Each phase commit ends with `pnpm --filter @klar/web build && pnpm --filter @klar/web lint && pnpm --filter @klar/api build` green; tests touched by the phase remain green; coverage stays ≥ 45 % web / 70 % api.

---

## Phase 1 — Buchungen 1:1

**Source:** `page-dashboard.jsx` BookingsList component (Z. 427–470).

**Goal:** Replace the current Buchungen page body with the bundle's filtered, day-grouped, .row-pattern transaction list.

- Page header: title `Buchungen`, subtitle `Cashflow · Buchungen`, scope segments (Mai 2026 / Schnitt 6 M / Jahr) + UserSwitch + PDF export + + Buchung add.
- Filter tabs (`.segmented`): Alle / Wiederkehrend / Manuell / Eingänge — bound to a `signal<filter>` that filters `txStore.items()`.
- List: single `<div class="card">` containing rows; each row uses `.row.cat-{slug}` for the category accent + `.row-ico-slot` (brand or category icon) + `.lhs` (name + meta `day · counterparty / note`) + `.amt.mono` (sign-tinted).
- Selection: keep Klar's existing multi-select FAB (Phase 11.8 backend already there). Selection toolbar tri-state from bundle's `useSelection`: All / None / Partial.
- Recurring badge: small `.chip.outline` "wiederkehrend" with repeat icon when `tx.recurringTransactionId` set.
- Empty state: `klar-async-state` empty + CTA.

**Backend:** none (existing list/create/update/delete + bulk endpoints suffice).

**Verification:** Playwright smoke that switches each filter tab and checks expected count for seeded data; existing buchungen specs still pass.

---

## Phase 2 — Projekte 1:1

**Source:** `page-projects.jsx` PageProjects (grid) + PageProjectDetail (drill-down).

**Goal:** Project tile grid + detail page with metric tiles + hero number.

- **PageProjects** (`/app/projekte`):
  - Page header: title `Projekte`, subtitle `Haushalt · alle aktiv`, Filter segment (Aktiv / Abgeschlossen / Archiviert / Alle), `+ Projekt` add.
  - Grid: 2 cols on tablet, 3 cols on desktop. Each tile: hero number (Fraunces 28 px, signed-tinted), name, status chip (active / completed / archived), `klar-progress-ring` 36 px in project color, mono `+ X € / − Y €` deltas, transaction count.
  - Empty state with CTA.
- **PageProjectDetail** (`/app/projekte/:id`):
  - Page header: title `<project name>`, subtitle `Projekte · Detail`, back button, Edit + Delete actions.
  - Hero strip: 3-up `klar-metric-tile` grid (Budget / Ausgegeben / Bilanz). Use `accent` for the most-positive tile.
  - Per-category mini-bars: list of categories used in the project with inline 80 px progress bar tinted in `--cat-color`.
  - Transactions list: same `.card + .row` pattern as Buchungen, scoped to the project.
  - Sticky footer: Edit / Archive / Delete actions in `.btn` tones.

**Backend:** existing `/projects` overview endpoint already returns `balanceCents / spentCents / totalBudgetCents / status`. No new endpoints needed.

**Verification:** Project tile snapshot + detail page renders.

---

## Phase 3 — Settings 1:1

**Source:** `page-settings.jsx` PageSettings (Z. 41–300).

**Goal:** Hero profile-card + six SettingGroups (Profil / Sicherheit / Aktive Sitzungen / Darstellung / Verknüpfte Konten / Daten / Danger).

- Page header: title `Einstellungen`, subtitle `Konto`, RHS chip with the user's email in `.chip.outline.mono`.
- `.page-intro` paragraph above the first group, with link to `/app/haushalt` for household-wide settings.
- **Profil** (hero card, not a list): `.profile-card.profile-grid` — left avatar column with `.avatar-xl` + `Foto ändern` button; right grid 2-col with display name, email (+ verified chip), member-since (mono read-only), role-in-household (read-only). Footer with hint + Verwerfen / Speichern.
- **Sicherheit**: `klar-list-group` + `klar-list-item` rows for Passwort, 2-FA (state chip), Passkeys, Verknüpfte Identitäten — already wired to existing services.
- **Aktive Sitzungen**: real data from `/me/sessions` (Phase 11.6) — per row icon (Monitor / Phone / Database) + label + IP + lastActiveAt + `Diese Sitzung` chip on current + Beenden action. Group action: `Alle anderen widerrufen`.
- **Darstellung**: theme toggle via existing ThemeService rendered as `.segmented` (Hell / Dunkel / System), Sprache (KSelect), Währung (KSelect).
- **Daten**: Export + Import (existing wires).
- **Verknüpfte Konten** (OIDC identities): row per identity + `Authentik verbinden` button.
- **Danger**: `.danger-zone` wrapper, Konto löschen with type-slug confirm dialog.
- Bottom: `.app-info` 4-up strip with Version / Build / Server / Storage.

**Backend:** none new.

**Verification:** Settings page renders all sections, sessions list pulls real data, theme toggle still functional.

---

## Phase 4 — Cashflow (Monat) 1:1

**Source:** `page-dashboard.jsx` PageMonth (Z. 350–425).

**Goal:** Bundle's "Soll vs. Ist" budget-meter card + filtered day-grouped Buchungen card.

- Page header: title `Mai 2026` (year-month from `OverviewStore.currentMonth`), subtitle `Cashflow · Monatsansicht`, UserSwitch + KSelect month-picker + chevron L/R + PDF + CSV.
- **Soll vs. Ist** card: per category row showing Ist / Soll (mono), full-width `.meter` bar tinted in cat-color, signed delta on the right (red if over, otherwise muted). `over` (>100 %), `warn` (>90 %), `ok` tone classes.
- **Buchungen** section: same filter segments as Phase 1 + BookingsList card. Sub-grouping option: by category dot.
- Drop the existing hero-only fallback (the new Soll-vs-Ist + tx list IS the page).

**Backend:** new endpoint `GET /h/:hid/overview/budgets-vs-actuals?month=YYYY-MM` returning per-category `{ categoryId, sollCents, istCents, deltaCents, over, warn }`. Computed by joining `Budget` (existing model) with the month's actual `Transaction` sums + `RecurringTransaction.monthlyEquivalentCents`. Calculation lives in `packages/shared/budgets/budgetsVsActuals.ts` for DRY (FE + BE share the formula).

New `BudgetsVsActualsStore` on FE mirrors the OverviewStore pattern.

**Verification:** unit tests on the calc helper; API e2e for the new endpoint; FE renders the card with seeded data.

---

## Phase 5 — Haushalt 1:1

**Source:** `page-settings.jsx` PageHaushalt (Z. 303 onward).

**Goal:** Members card + Mail-Templates card + Categories-Manager + API-Keys card + Danger-Zone, with the bundle's Hero info chip up top.

- Page header: title `Haushalt`, subtitle `<household-name> · <member-count> Mitglieder`, RHS `+ Einladen` action.
- Hero card: name (Fraunces 24 px) + `.chip.outline.mono` household-id + `Verlassen` ghost-button (members) / `Auflösen` solid-danger (owner).
- **Members** group: row per member with avatar, role chip (`OWNER` success / `MEMBER` default / `VIEWER` warn), edit-role dropdown (KSelect), kick action (owner only).
- **Mail-Templates** group: card per template (kind eyebrow + subject + body markdown preview collapsed) + Edit dialog (existing mail-templates module). Render-preview button hits the API render endpoint.
- **Categories-Manager**: searchable + addable KSelect bound to CategoriesStore — needs upgrade of `klar-select` (add `searchable` + `addable` inputs + `(addNew)` output + `EntityDialog` for new). Earthy preset color picker (8 swatches from `--cat-*`).
- **API-Keys** group: per row: prefix `bgb_live_…`, scope chips, last-used relative time, revoke ghost-danger button. Create-key flow shows the secret once in a modal with a copy-button (existing api-keys flow).
- **Danger-Zone**: Delete-Household with type-slug confirm.

**Backend:** Mail-Templates render-preview endpoint if not already there; otherwise none.

**Verification:** Haushalt page renders all sections with seeded data; member-role change updates immediately; KSelect search + add works; api-key one-time-reveal still works.

---

## Phase 6 — Admin 1:1

**Source:** `page-system.jsx` PageAdmin (Z. 143–270 + later).

**Goal:** Add the bundle's hero / status grid / services-card / performance-card / jobs-card above the existing audit / mcp / emails / households tabbed tables.

- Page header: title `Admin`, subtitle `System · Self-Host Instanz`, RHS chip `v0.9.4 healthy` + ghost button `Backup`.
- Hero: existing `.card` from prior commit — keep.
- **Status grid** 4-up: Uptime · 30 T (% with last incident), Datenbank (size + 7-day delta), Warnungen (count + label), Aktive Sitzungen (count + breakdown).
- **Services card**: 5 services (Web / API / Postgres / MCP Bridge / Mail-Queue) with state-light + 30-bar uptime histogram + meta (host:port / client count) + actions menu.
- **Performance card**: 6 rows (CPU / RAM / Disk I/O / DB-Query Ø / Mail-Queue / MCP Latenz) with progress bars + state.
- **Jobs card**: 4 cron jobs (Backup / Monatsabschluss / OAuth-Cleanup / Audit-Compaction) with last/next + state.
- Existing tabbed tables (Audit / MCP / E-Mails / Haushalte) below the cards — keep functionality, restyle headers to match.

**Backend (new):**
- `GET /admin/health/status` — uptime %, DB size, warning count, session count.
- `GET /admin/health/services` — list of services with state + uptime windows (Postgres health from prisma `$queryRaw SELECT 1`, mail-queue via existing mail module, MCP via existing oauth module session count).
- `GET /admin/health/performance` — process metrics: CPU load via `os.loadavg()`, RAM via `process.memoryUsage().heapUsed / heapTotal`, Disk free via `fs.statfs(uploadDir)` (or platform fallback), DB-Query Ø via a Prisma `$on('query')` middleware that maintains a sliding 5 min average, Mail-Queue lag via the existing mail module's BullMQ `queue.getJobCounts()`, MCP latency via the existing MCP audit p50.
- `GET /admin/jobs` — list of registered BullMQ queues + last/next runs.

All endpoints behind `JwtAuthGuard + AppAdminGuard`. Audit-logged.

**Verification:** Admin page renders all cards with real data on a running dev instance; e2e for each new endpoint.

---

## Phase 7 — Auth pages 1:1

**Source:** `page-system.jsx` PageAuth (login / register / forgot / reset / oidc-callback).

**Goal:** Polish the existing two-pane layout (already close) with bundle's exact Brand-Pane content.

- Brand pane left (≥ md): Klar wordmark top, hero text "Privatfinanzen, klar genug für zwei Erwachsene." with `klar genug` in Fraunces italic + accent-tone, status strip bottom (Argon2id / 100% LOKAL / RS256 JWT chips), online indicator.
- Form pane right: existing flows (login / register / verify-email / oauth-consent / onboarding / join) get the bundle's exact field-label + input + `.btn.primary.solid` submit pattern.
- Mobile: brand pane collapses to wordmark-only header; form pane fills.

**Backend:** none.

**Verification:** Each flow renders correctly on desktop + mobile; existing e2e tests still pass.

---

## Phase 8 — Komponenten-Spec page (optional, dev gallery)

**Source:** `page-system.jsx` PageSpec.

**Goal:** Dev-only gallery showing every primitive (buttons × tones × sizes × icon-only, chips × variants, inputs, kselect, money-input, kbd, segmented, alerts, list rows, setting rows, profile-card, metric-tile, progress-ring, confidence-bar, hypo-chip).

- Route `/app/spec`, sidebar entry under SYSTEM, admin-only.
- Each section: `.section-head` + matrix of primitives.

**Verification:** page builds + lints; not part of test coverage by default.

---

## Phase 9 — CRUD-Demo page (optional, dev gallery)

**Source:** `page-crud.jsx`.

**Goal:** 8 dialog patterns as a card grid (Anlegen / Detail / Bearbeiten / Löschen / Verschieben / Massenaktion / Pausieren / Verwerfen-Schutz) for design-system reference.

- Route `/app/crud`, sidebar entry under SYSTEM, admin-only.
- Each card opens the corresponding pattern dialog.

**Verification:** page builds + lints.

---

## Risks / open questions

- **Phase 4 / 6** introduce new backend endpoints. Both require migrations only for cached metrics if we add caching later — for now, computed-on-the-fly is fine.
- **Phase 5** Mail-Templates render-preview may already exist — verify in implementation; if not, add to the existing mail-templates module.
- **Phase 7** existing auth flow has many edge-case states (TOTP, OIDC, invite-token); polish must not regress them.
- **Phase 6** real telemetry (uptime, mail queue) needs careful read-only access (no mutation from these endpoints).
- **DRY ruthlessly**: every new primitive lands under `apps/web/src/app/shared/ui/` with `klar-*` selector; every backend calc lives in `packages/shared/`.

## Verification per phase (Marco's DoD)

- `pnpm test`, `pnpm lint`, `pnpm build` green
- Mobile-viewport ≤ 375 px: no overflow, touch ≥ 44 px, inputs ≥ 16 px
- Dark + Light theme validated on touched page
- README features table updated with the new user-facing capability (per phase)
- One commit per phase (or per page within phase), conventional `feat(<area>): …` message, English, no `Co-Authored-By: Claude`, no `--no-verify`

## Out of scope

- New tests beyond smoke-coverage to keep thresholds; comprehensive Playwright coverage is a separate effort.
- Public-API endpoints for the new models (Marco overrode: internal-only).
- i18n centralization (separate session).
- Brand asset regen (favicon / splash) — already done in earlier commit.

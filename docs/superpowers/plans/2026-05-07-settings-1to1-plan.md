# Settings 1:1 Implementation Plan

> Subagent-driven. Continuous execution.

**Goal:** Bring `/app/settings` to 1:1 with bundle PageSettings — Hero profile-card + 6 SettingGroups (Sicherheit / Aktive Sitzungen / Darstellung / Verknüpfte Konten / Daten / Danger).

**Architecture:** Hero is a dedicated `.profile-card.profile-grid` (avatar column + 2-col fields grid) — NOT a klar-list-group. The 6 SettingGroups continue to use `klar-list-group` + `klar-list-item` (already styled as bundle .setting-row from earlier commit `b9d8629`). Page-header gets crumb 'Konto' + RHS chip for the user's email. Bottom: `.app-info` 4-up strip with Version / Build / Server / Storage.

---

## File Structure

**Modify:**
- `apps/web/src/app/pages/settings/settings.component.html` — restructure top section into `.profile-card`, replace existing toolbar/list with bundle SettingGroup chrome, add `.app-info` strip + page-intro paragraph.
- `apps/web/src/app/pages/settings/settings.component.ts` — page-header `set` with crumb 'Konto' subtitle + RHS chip slot, and any helpers needed.
- `apps/web/src/app/core/page-header/page-header.service.ts` — extend with optional `rhsChip` field (text + tone) so pages can render an inline chip in the header actions.
- `apps/web/src/app/layout/top-bar/top-bar.component.html` — render the `rhsChip` if present (single span with `.chip.outline.mono`).

---

### Task 1: Add rhsChip slot to PageHeaderService + top-bar render

- [ ] **Step 1: Extend PageHeaderConfig + service signal**

In `apps/web/src/app/core/page-header/page-header.service.ts`, add to `PageHeaderConfig`:

```ts
/** Optional text-only chip rendered in the header actions row (e.g. user email). */
rhsChip?: string;
```

In the service class, add:

```ts
readonly rhsChip = signal<string | null>(null);
```

In `set(config)`, wire:

```ts
this.rhsChip.set(config.rhsChip ?? null);
```

- [ ] **Step 2: Render in top-bar**

In `apps/web/src/app/layout/top-bar/top-bar.component.html`, add to the actions area (after stat badges, before the user-switch / scope-segment / bell / user-avatar trio — wherever the natural left-most position is):

```html
@if (pageHeader.rhsChip(); as chip) {
  <span class="chip outline mono">{{ chip }}</span>
}
```

(The component already injects `pageHeader` per the service field. If not, follow the existing pattern in top-bar.component.ts.)

- [ ] **Step 3: Build + commit**

```
pnpm --filter @klar/web build && pnpm --filter @klar/web lint
```

Commit:
```
git add apps/web/src/app/core/page-header apps/web/src/app/layout/top-bar
git commit -m "feat(page-header): add rhsChip slot for inline header chip

Settings (and likely Vertraege/Statistik later) need a small text chip
in the page-header actions row — typically the logged-in user's email
or a provider name. Adds a single optional rhsChip string field on
PageHeaderConfig + matching signal, rendered as .chip.outline.mono in
top-bar.component.html before the existing slots.

Phase 3 (Settings) of feature/design-pearl, step 1/3."
```

---

### Task 2: Settings hero profile-card + page-header config + app-info strip

- [ ] **Step 1: Update settings.component.ts**

Add (or update) the page-header config to:

```ts
this.pageHeader.set({
  title:    'Einstellungen',
  subtitle: 'Konto',
  rhsChip:  this.authStore.user()?.email,
  // existing addLabel / onAdd etc. preserved if any
});
```

If the existing component does NOT call `pageHeader.set`, add it in `ngOnInit` or constructor.

- [ ] **Step 2: Restructure settings.component.html top**

The existing template is wrapped in `<klar-list>` with klar-list-group blocks. Replace just the top (Profil) block with the bundle `.profile-card`:

```html
<div class="flex flex-col gap-(--s-5) p-(--s-6) pb-16">

  <p class="page-intro">
    Profil, Sicherheit, Anmeldung und Datenexport. Was den ganzen Haushalt betrifft —
    Mitglieder, Kategorien, Mail-Vorlagen — findest du unter
    <a class="link" routerLink="/app/haushalt">Haushalt</a>.
  </p>

  <!-- PROFIL — hero card -->
  <section class="setting-group">
    <div class="setting-group-head"><span>Profil</span></div>
    <div class="card profile-card">
      <div class="profile-grid">
        <div class="profile-avatar">
          <klar-avatar
            [avatarUrl]="authStore.user()?.avatarUrl"
            [seed]="authStore.user()?.displayName ?? ''"
            [size]="64"
            [initials]="avatarInitials()" />
          <button type="button"
                  class="btn ghost sm"
                  [disabled]="avatarBusy()"
                  (click)="triggerAvatarFile()">
            Foto ändern
          </button>
          @if (authStore.user()?.avatarUrl) {
            <button type="button"
                    class="btn ghost sm danger"
                    [disabled]="avatarBusy()"
                    (click)="removeAvatar()">
              Entfernen
            </button>
          }
          <input #avatarInput type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                 aria-label="Profilfoto wählen" title="Profilfoto wählen"
                 class="sr-only" (change)="onAvatarFileSelected($event)" />
        </div>
        <div class="profile-fields">
          <div class="profile-field">
            <label class="field-label" for="profile-name">Anzeigename</label>
            @if (editingProfile()) {
              <input class="input" id="profile-name"
                     [ngModel]="editDisplayName()" (ngModelChange)="editDisplayName.set($event)" />
            } @else {
              <div class="profile-readonly">{{ store.profile()?.displayName ?? '—' }}</div>
            }
          </div>
          <div class="profile-field">
            <label class="field-label">
              E-Mail-Adresse
              @if (store.profile()?.emailVerified) {
                <span class="chip success" style="margin-left: 6px; height: 16px; font-size: 9px;">verifiziert</span>
              }
            </label>
            <div class="profile-readonly">{{ store.profile()?.email ?? '—' }}</div>
          </div>
          <div class="profile-field">
            <label class="field-label">Mitglied seit</label>
            <div class="profile-readonly mono">{{ formatDate(store.profile()?.createdAt) }}</div>
          </div>
          <div class="profile-field">
            <label class="field-label">Rolle im Haushalt</label>
            <div class="profile-readonly">{{ hhStore.activeRole() ?? '—' }} · {{ hhStore.activeName() }}</div>
          </div>
        </div>
      </div>
      <div class="profile-foot">
        <span class="setting-hint">Änderungen werden lokal gespeichert — nichts verlässt deinen Server.</span>
        <div class="flex gap-(--s-2)">
          @if (editingProfile()) {
            <button type="button" class="btn ghost" (click)="cancelEditProfile()">Verwerfen</button>
            <button type="button" class="btn primary" [disabled]="savingProfile()" (click)="saveProfile()">
              <klar-icon name="check" [size]="14" /> Speichern
            </button>
          } @else {
            <button type="button" class="btn ghost" (click)="startEditProfile()">Bearbeiten</button>
          }
        </div>
      </div>
    </div>
  </section>

  <!-- ... existing klar-list-group sections preserved below ... -->
```

For all the EXISTING klar-list-group sections (Sicherheit / Verbundene Apps / Haushalt / Darstellung / Verknüpfte Konten / Aktive Sitzungen / Import-Export / App-Infos / Konto), keep them as-is — they already render in bundle `.setting-row` style after commit `b9d8629`. Just **drop** the wrapping `<klar-list>` and the `<klar-list-group label="Profil">` block (replaced by the new profile-card section above), and put each remaining `<klar-list-group>` in its own `<section>` with no outer `<klar-list>` wrapper.

- [ ] **Step 3: Drop "App-Infos" klar-list-group, replace with .app-info strip at the bottom**

Replace the existing App-Infos section with:

```html
<div class="app-info">
  <div>
    <span>Version</span>
    <span class="mono">{{ version() }}</span>
  </div>
  <div>
    <span>Build</span>
    <span class="mono">{{ buildId() }}</span>
  </div>
  <div>
    <span>Server</span>
    <span class="mono">{{ serverHost() }}</span>
  </div>
  <div>
    <span>Sprache</span>
    <span>Deutsch</span>
  </div>
</div>
```

Add helpers in the .ts:

```ts
protected readonly version = signal('1.0.0');
protected readonly buildId = signal('—');
protected readonly serverHost = signal(
  typeof window !== 'undefined' ? window.location.hostname : 'klar.local',
);
```

- [ ] **Step 4: Build + lint + test**

```
pnpm --filter @klar/web build && pnpm --filter @klar/web lint && pnpm --filter @klar/web test --run
```

All exit 0 (tests + ≥45% coverage).

- [ ] **Step 5: Commit**

```
git add apps/web/src/app/pages/settings
git commit -m "feat(settings): hero profile-card + bundle SettingGroup layout + app-info strip

Bundle PageSettings replaces the flat klar-list with a dedicated
.profile-card hero (avatar column + 2-col fields grid + footer with
'Änderungen werden lokal gespeichert' hint + Verwerfen/Speichern
actions). The existing Sicherheit / Sessions / Darstellung / OIDC /
Konto klar-list-group sections sit below as standalone <section>s
(no outer <klar-list> wrapper) — they already render in the bundle's
.setting-row pattern from commit b9d8629.

Page-header config gains crumb subtitle 'Konto' + rhsChip with the
user's email rendered as .chip.outline.mono in the top-bar.

App-Infos previously a klar-list-group is now the bundle's .app-info
4-up strip (Version / Build / Server / Sprache) at the bottom of the
page, mono numerals, eyebrow labels.

Phase 3 (Settings) of feature/design-pearl, step 2/3."
```

---

### Task 3: README + final verification

- [ ] **Step 1: README features-table row**

In `README.md`, find or add a row for Settings. Replace if exists:

```
| **⚙️ Einstellungen** | Hero profile card with avatar / display name / email (verified chip) / member-since / role; SettingGroups for Security (2FA, Passkeys, OIDC), Sessions, Darstellung (theme via segmented), Verknüpfte Konten, Daten (Export/Import), Danger Zone; bottom .app-info strip (Version / Build / Server / Sprache) |
```

- [ ] **Step 2: Final triple-build sweep + commit**

```
pnpm --filter @klar/web build
pnpm --filter @klar/web lint
pnpm --filter @klar/api build
```

Then:
```
git add README.md
git commit -m "docs(readme): document Settings hero profile-card + SettingGroups

Phase 3 (Settings) of feature/design-pearl, step 3/3."
```

---

## Self-review

- ✓ Spec coverage: hero profile-card + 6 SettingGroups (existing logic preserved) + .app-info strip + page-intro + rhsChip in header.
- ✓ DRY: rhsChip is a generic page-header slot reusable by Vertraege / Statistik / etc.
- ✓ Existing klar-list-group + klar-list-item already render bundle .setting-row pattern — no per-row template churn.
- ✓ Modal-only edits respected (existing change-password / 2FA / delete-account dialogs untouched).
- ✓ A11y: profile-card edit Verwerfen/Speichern keep keyboard focus order; chip uses `aria` semantics inherited from .chip.

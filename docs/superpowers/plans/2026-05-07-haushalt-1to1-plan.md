# Haushalt 1:1 Implementation Plan

> Subagent-driven. Continuous execution.

**Goal:** Bring `/app/haushalt` to 1:1 with bundle PageHaushalt — Hero info card + Members + Mail-Templates + Categories-Manager + API-Keys + Danger-Zone, all using bundle .setting-group / .setting-row / .profile-card pattern.

---

## Tasks

### Task 1: Hero info card + page-header config

**File: `apps/web/src/app/pages/haushalt/haushalt.component.html` + `.ts`**

Page header:
```ts
this.pageHeader.set({
  title:    'Haushalt',
  subtitle: this.hh.activeName() + ' · ' + this.hh.members().length + ' Mitglieder',
  rhsChip:  'WG',
  showAdd:  true,
  addLabel: '+ Einladen',
  onAdd:    () => this.openInviteDialog(),
});
```

Hero card (just below the page-header):

```html
<section class="card profile-card flex flex-col gap-(--s-3) mb-(--s-5)">
  <div class="flex items-baseline justify-between gap-(--s-3)">
    <h1 class="text-[24px] m-0"
        style="font-family: var(--font-display); letter-spacing: -0.02em; font-weight: 500;">
      {{ hh.activeName() }}
    </h1>
    <span class="chip outline mono">{{ hh.activeId() }}</span>
  </div>
  <p class="text-[13px] text-(--fg-2) m-0">
    {{ hh.members().length }} Mitglied(er) · {{ hh.activeRole() === 'OWNER' ? 'Eigner' : 'Mitglied' }}
  </p>
  <div class="flex gap-(--s-2) mt-(--s-2)">
    @if (hh.activeRole() === 'OWNER') {
      <button type="button" class="btn ghost danger" (click)="confirmDelete()">Auflösen</button>
    } @else {
      <button type="button" class="btn ghost danger" (click)="confirmLeave()">Verlassen</button>
    }
  </div>
</section>
```

Commit: `feat(haushalt): hero info card + page-header rhsChip`

---

### Task 2: Members + Mail-Templates + Categories sections aligned to bundle

The existing haushalt.component.html already uses klar-list-group / klar-list-item which now render in bundle .setting-row pattern (commit b9d8629). Just ensure each top-level section is wrapped in a `<section class="setting-group">` with a `.setting-group-head` eyebrow + matching action button (e.g. `+ Mitglied einladen`, `+ Kategorie`).

For **Members**: each row's RHS slot gets a role-Chip (OWNER / MEMBER / VIEWER tone-mapped to success / default / warn).

For **Mail-Templates**: keep existing card grid, ensure templates use `.card` + `.row` style if currently using klar-list. If they're already using a Card grid, leave as-is — only adjust .ts to use page-header service and remove any custom toolbar.

For **Categories-Manager**: bundle requires KSelect searchable+addable; if our `klar-select` doesn't support this yet, **skip the upgrade** — just render the existing category list with bundle .setting-row pattern. Add a deferred TODO comment in the .ts noting "klar-select searchable+addable upgrade pending — Phase Haushalt-2".

**API-Keys** + **Danger-Zone**: existing implementations should already work — wrap each in `<section class="setting-group">` with eyebrow head, and add the `.danger-zone` modifier on the Danger section.

Commit: `feat(haushalt): align all sections to bundle setting-group + role chips`

---

### Task 3: README + verification

```
| **🏠 Haushalt** | Hero info card with name (Fraunces) + ID chip + role + Auflösen/Verlassen action; SettingGroups for Members (role-chip OWNER/MEMBER/VIEWER), Mail-Templates (card grid), Kategorien (manage), API-Keys (one-time-reveal + revoke), Danger-Zone (delete) |
```

Triple-build green. Commit: `docs(readme): document Haushalt hero + sections`

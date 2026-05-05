# Header Redesign + Avatar Upload — Design Spec

**Date:** 2026-05-04
**Status:** Approved

---

## Overview

Two related changes:
1. Redesign the desktop top-bar for visual coherence (Option B: compact & minimal)
2. Add user avatar upload (stored as base64 in DB, shown everywhere initials appear)

---

## 1. Header Redesign

### Layout (desktop top-bar)

**Left side:**
- Page title (15px, font-weight 500)
- Month as subtitle directly below (10px, uppercase, `tracking-widest`, `text-(--text-muted)`)

**Right side (left → right):**
1. Stat badge(s) — compact pill with label + value (existing `PageStat[]`)
2. Action buttons — Planspiel (ghost), Export (outline), "+ Buchung" (default)
3. Single 32px user avatar — replaces the two separate HH + User buttons

### Avatar button (32px, header)
- Shape: `rounded-full`, `size-8`
- Style when **no photo**: flat initials — dark surface bg, accent-colored border, accent-colored initials text (`font-mono text-[11px]`)
- Style when **photo uploaded**: `<img>` tag with `object-cover`, same `rounded-full size-8`

### Changes to `klar-top-bar`
- Add `monthChip` label under title (was previously a separate chip element)
- Remove `<klar-month-chip>` from the right side
- Replace `<klar-header-user>` (which currently renders two separate buttons) with the redesigned single-avatar version

### Changes to `klar-header-user`
- Single trigger button (32px circle) instead of two separate buttons
- One combined popover dropdown (see below)

### Avatar dropdown (popover)

```
┌─────────────────────────────┐
│  [40px avatar]  Marco        │  ← user section
│                marco@…       │
│                Foto ändern   │  ← triggers file input
├─────────────────────────────┤
│  HAUSHALT                    │
│  [HH icon]  Mein Haushalt  Owner │
│             → Haushalt verwalten  │
├─────────────────────────────┤
│  Einstellungen               │
│  ─────────────────           │
│  Abmelden                    │  ← red
└─────────────────────────────┘
```

### Mobile header
No changes — stays as-is (title + month chip + `klar-header-user`).
The mobile `klar-header-user` also gets the single-avatar treatment.

---

## 2. Avatar Upload

### Data model

Add to Prisma `User` model:
```prisma
avatarUrl  String?   // base64 data URL, max ~15 KB after resize
```

Add to `AuthUser` type in `packages/shared/src/types.ts`:
```ts
avatarUrl?: string | null;
```

### API endpoints

**Upload:** `POST /api/v1/users/me/avatar`
- Auth: `JwtAuthGuard`
- Body: `multipart/form-data`, field `avatar`, max 5 MB
- Processing: resize to 128×128, convert to JPEG (quality 85), encode as base64 data URL
- Response: `{ avatarUrl: string }` — the new data URL
- Update `AuthUser` in the JWT/session response going forward

**Delete:** `DELETE /api/v1/users/me/avatar`
- Auth: `JwtAuthGuard`
- Clears `avatarUrl` to `null`
- Response: `204 No Content`

**Image library:** `sharp` (already common in Node.js stacks; add as dep to `apps/api`)

### Auth response update
`LoginResponse`, `RefreshResponse` — both include `user: AuthUser` which now carries `avatarUrl`. Frontend `AuthStore` already propagates this via `setSession`.

### Frontend: avatar display

Shared helper computed in `klar-header-user`:
```ts
protected hasAvatar = computed(() => !!this.authStore.user()?.avatarUrl);
```

Template pattern used everywhere:
```html
@if (hasAvatar()) {
  <img [src]="authStore.user()!.avatarUrl" ... />
} @else {
  <!-- flat initials fallback -->
}
```

### Upload flow (in dropdown)
1. "Foto ändern" — hidden `<input type="file" accept="image/*">`, triggered via click
2. On `change` — POST to `/api/v1/users/me/avatar`
3. On success — call `authStore.updateAvatar(avatarUrl)` (new method that patches `_user` signal)
4. Loading state on the avatar during upload
5. Error toast on failure

### Constraints
- Max file size: 5 MB (enforced in NestJS via `FileSizeValidator`)
- Accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/gif` (enforced via `FileTypeValidator`)
- Output: always JPEG 128×128, base64 data URL (~10–15 KB)
- Pino redaction: `avatarUrl` added to redaction list (contains personal data)

---

## 3. Components to Create / Modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `avatarUrl String?` to User |
| `packages/shared/src/types.ts` | Add `avatarUrl?: string \| null` to AuthUser |
| `apps/api/src/users/users.controller.ts` | Add POST + DELETE avatar endpoints |
| `apps/api/src/users/users.service.ts` | `uploadAvatar()`, `deleteAvatar()` methods |
| `apps/web/src/app/shared/ui/klar-header-user.component.ts` | Full redesign: single avatar, combined dropdown, upload trigger |
| `apps/web/src/app/layout/top-bar/top-bar.component.html` | Month as subtitle under title, remove `<klar-month-chip>` from right |
| `apps/web/src/app/core/auth/auth.store.ts` | Add `updateAvatar(url)` method |

---

## Out of Scope

- Avatar shown in other users' views (e.g., household member list) — separate task
- Cropping UI — server-side center-crop is sufficient
- Multiple avatar sizes — 128×128 covers all current uses

# Invitation Links — Design Spec

**Date:** 2026-05-04  
**Status:** Approved  
**Replaces:** InviteCode-based system (code-entry flow)

---

## Overview

Replace the existing code-entry invitation flow with one-time invitation links that can be sent via email or shared via the OS share sheet. Links work for users with and without an existing Klar account.

---

## Data Model

### New: `InvitationLink`

Replaces `InviteCode` entirely. Migration drops `InviteCode`, creates `InvitationLink`.

```prisma
model InvitationLink {
  id              String    @id @default(cuid())
  householdId     String
  token           String    @unique   // 32-byte URL-safe random (crypto.randomBytes)
  email           String?             // set when created via email flow
  createdByUserId String?
  expiresAt       DateTime?           // default: now + 7 days
  usedAt          DateTime?           // null = not yet consumed
  usedByUserId    String?
  createdAt       DateTime  @default(now())

  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@index([householdId])
  @@index([token])
}
```

Single-use enforcement: `usedAt` is set atomically via `UPDATE ... WHERE usedAt IS NULL`. A link where `usedAt IS NOT NULL` or `expiresAt < NOW()` is invalid.

---

## Mail Templates

`MailTemplateType.INVITE` is already defined in the schema. The `HouseholdMailTemplate` model is per-household.

### Seeding strategy (two cases)

**Existing households (production rollout):**  
A Prisma data migration runs `INSERT INTO "HouseholdMailTemplate" ... SELECT FROM "Household" ... ON CONFLICT DO NOTHING` for all existing households. Runs automatically via `migrate deploy`.

**New households:**  
`HouseholdsService.createDefault()` calls `seedDefaultTemplates(householdId)` which upserts default templates for all `MailTemplateType` values. Every new household is pre-populated from day one.

### Template variables for INVITE

```handlebars
{{ inviterName }}     — display name of the person who invited
{{ householdName }}   — name of the household
{{ inviteUrl }}       — full one-time link, e.g. https://klar.app/join/xK9p2mN...
{{ expiresAt }}       — formatted expiry date
{{ year }}            — current year (footer)
```

`MailService.sendInviteEmail()` checks for a household-specific `INVITE` template first; falls back to `invite.hbs` Handlebars file if none exists.

---

## API Endpoints

All household-scoped endpoints require `JwtAuthGuard` + `HouseholdMemberGuard` (OWNER role enforced in service).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/households/:hid/invites` | JWT | Create new link |
| `POST` | `/households/:hid/invites/:iid/send` | JWT | Send existing link via email |
| `GET` | `/households/:hid/invites` | JWT | List active (unused + non-expired) links |
| `DELETE` | `/households/:hid/invites/:iid` | JWT | Revoke link (delete) |
| `GET` | `/join/:token` | Public | Validate token; return household name for landing page |
| `POST` | `/join/:token` | JWT | Consume token; join household |

### `POST /households/:hid/invites` request body

```ts
{ expiresInDays?: number } // default: 7
```

Response: `{ id, token, link: "https://{frontendUrl}/join/{token}" }`.

### `POST /households/:hid/invites/:iid/send` request body

```ts
{ email: string } // required: recipient address
```

Sends the existing link via email. Does not create a new link. Returns 204.

### `GET /join/:token` response (public)

```ts
{ householdName: string; expiresAt: string | null }
```

Returns 404 if token unknown, 410 Gone if already used or expired.

### `POST /join/:token`

Requires JWT. Atomically sets `usedAt + usedByUserId`. Returns the new `HouseholdMembership`. Returns 410 Gone if already used or expired, 409 Conflict if already a member.

---

## User Flows

### Flow 1 — Inviter (Owner)

1. Opens invite dialog in household settings
2. `POST /households/:hid/invites` fires immediately → one link created, displayed at once
3. **Option A:** Enter email address → click "Senden" → `POST /households/:hid/invites/:iid/send` → sends the **same link** via email → confirmation shown, link stays visible
4. **Option B:** Click "Teilen" → Web Share API (`navigator.share()`) with the link URL → OS share sheet opens; fallback: copy to clipboard
5. "Neu generieren" → `DELETE /households/:hid/invites/:iid` + `POST /households/:hid/invites` → old link invalidated immediately, fresh link shown

### Flow 2 — Recipient clicks `/join/:token`

**Already logged in:**
1. Frontend calls `GET /join/:token` to show household name
2. User confirms → `POST /join/:token` → joined
3. Redirect to household dashboard

**Not logged in:**
1. Token stored in `sessionStorage` as `pendingInviteToken`
2. Redirect to `/register?invite=TOKEN` (preferred) or `/login?invite=TOKEN`
3. Registration page shows: "Nach der Registrierung wirst du automatisch zum Haushalt hinzugefügt"
4. After successful register/login → frontend reads `pendingInviteToken` from sessionStorage → `POST /join/:token` → joined → redirect to household
5. `sessionStorage` entry cleared after use

**Error cases on `/join/:token`:**
- Token not found → 404: "Dieser Einladungslink ist ungültig"
- Already used or expired → 410: "Dieser Einladungslink wurde bereits verwendet oder ist abgelaufen"
- Already a member → 409: "Du bist bereits Mitglied dieses Haushalts"

---

## Frontend Components

### Dialog: `InviteDialog` (replaces current invite-code UI)

- Opens from household settings
- On open: fires `POST /households/:hid/invites` to pre-generate link
- Email input (optional) with "Senden" button
- Divider: "oder Link direkt teilen"
- Read-only link input with "Kopieren" button
- "Teilen" button (Web Share API, clipboard fallback)
- "Neu generieren" button
- Footer: "Gültig 7 Tage · Einmalig verwendbar"

### Page: `/join/:token`

- Calls `GET /join/:token` on load (public, no auth required)
- Shows household name and expiry
- If authenticated: "Haushalt beitreten" button → `POST /join/:token`
- If not authenticated: "Registrieren" and "Anmelden" buttons, token saved to sessionStorage

### Auth pages: register + login

- Read `?invite=TOKEN` query param on load, store to sessionStorage
- After success: auto-consume token before redirecting

---

## Security

- Token: `crypto.randomBytes(32).toString('base64url')` — 256 bits of entropy
- Single-use: atomic `UPDATE WHERE usedAt IS NULL` prevents race conditions
- Public `GET /join/:token` returns only household name — no member data leaked
- Token is never logged (add to Pino redaction list: `inviteToken`, `token`)
- RLS: `InvitationLink` scoped to `householdId` via existing RLS policy pattern

---

## Testing

| Level | What to test |
|-------|-------------|
| Unit | `InvitationLinkRepository.consumeAndJoin()` atomicity, expired/used checks |
| Integration | Create → consume flow against real DB; double-consume returns 410 |
| Security | Consume another household's token → 404; expired token → 410 |
| E2E (Playwright) | Full invite flow: create link → open in new session → register → verify household membership |
| Mail | `sendInviteEmail` uses household template when present, falls back to `invite.hbs` |

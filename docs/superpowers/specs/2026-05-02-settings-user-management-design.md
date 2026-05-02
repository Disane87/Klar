# Settings + User Management — Design Spec
**Date:** 2026-05-02  
**Status:** Approved  
**Scope:** `/app/settings` (neue Seite) + `/app/haushalt` (Mitglieder-Rollenwechsel)

---

## Überblick

Zwei Lieferobjekte:

1. **Neue Seite `/app/settings`** — persönliche Einstellungen für den eingeloggten User (Profil, Darstellung, Sicherheit, OIDC-Konten, Sitzungen, Account-Löschung).
2. **Erweiterung `/app/haushalt`** — Owner kann Mitglieder-Rollen ändern (Member ↔ Owner) via Dropdown + Bestätigungs-Dialog.

---

## 1. `/app/settings` — Mein Konto

### 1.1 Sektionen

#### PROFIL
- Zeigt Avatar-Initialen (2 Buchstaben aus `displayName`), Name, E-Mail.
- **Bearbeiten**-Button öffnet Inline-Edit-Mode (wie Haushalt-Name):
  - `displayName` — Pflichtfeld, 1–100 Zeichen.
  - E-Mail — Pflichtfeld, gültige E-Mail; nach Änderung wird `emailVerified = false` und ein neuer Verifikations-Link verschickt.
- Speichern via `PATCH /api/v1/users/me`.
- Zeigt Badge **VERIFIZIERT** (income-Farbe) wenn `emailVerified = true`, sonst **NICHT VERIFIZIERT** (muted) + Link "Erneut senden".

#### DARSTELLUNG
- Toggle-Gruppe: **Hell** / **Dunkel** / **System**.
- Kein API-Call. Wert in `localStorage` unter Key `klar-theme`.
- Angular-Service `ThemeService` setzt `document.documentElement.classList`.
- Beim App-Start wird der gespeicherte Wert angewendet (in `app.config.ts` oder Root-Komponente).

#### SICHERHEIT
- Nur sichtbar wenn `user.passwordHash !== null` (Backend gibt `hasPassword: boolean` zurück, kein Hash).
- **Passwort ändern** öffnet einen KlarDialog mit drei Feldern:
  - Aktuelles Passwort
  - Neues Passwort (min. 8 Zeichen)
  - Neues Passwort wiederholen
- Route: `POST /api/v1/users/me/change-password` mit `{ currentPassword, newPassword }`.
- Bei falschem aktuellem Passwort: 422 mit Feldvalidierungsfehler.

#### VERKNÜPFTE KONTEN
- Liste aller `OidcIdentity`-Einträge des Users: Provider-Name, E-Mail, Verbindungsdatum.
- **Trennen**-Button: `DELETE /api/v1/users/me/oidc/:identityId`.
  - Disabled wenn: das die letzte Anmeldemethode ist UND kein Passwort gesetzt (`hasPassword = false`).
  - Hint: "Mindestens eine Anmeldemethode muss aktiv bleiben."
- **+ Verbinden**-Button: nur sichtbar wenn weitere OIDC-Provider konfiguriert sind (Backend-Config). Leitet zum OIDC-Flow weiter.

#### AKTIVE SITZUNGEN
- Liste der nicht-widerrufenen, nicht-abgelaufenen `RefreshToken`-Einträge (`revokedAt = null && expiresAt > now`).
- Pro Eintrag: Browser/OS aus `userAgent` (geparst, z.B. "Chrome · macOS Sequoia"), IP-Adresse, relative Zeitangabe ("vor 2 Tagen").
- Aktuelle Sitzung: Badge **DIESE SITZUNG** (income-Farbe), kein Widerrufen-Button.
- Andere Sitzungen: ✕-Button → `DELETE /api/v1/users/me/sessions/:tokenId`.
- **Alle widerrufen**-Button (Header): `DELETE /api/v1/users/me/sessions` — widerruft alle außer der aktuellen. Danger-Styling.

#### KONTO
- Danger Zone (Border-left in expense-Farbe).
- **Konto löschen …**-Button öffnet Bestätigungs-Dialog:
  - Warnung: "Diese Aktion ist unwiderruflich. Deine Einträge in gemeinsamen Haushalten bleiben anonymisiert erhalten."
  - Bestätigung: User muss E-Mail-Adresse eintippen.
  - Route: `DELETE /api/v1/users/me`.
  - Nach Erfolg: logout + Redirect zu `/login`.
- Soft-Delete: `isDeleted = true`, `createdByUserId` in Transactions etc. wird nicht geändert (Anonymisierung durch fehlende User-Relation).

### 1.2 Routing

```
/app/settings  →  SettingsPageComponent  (lazy-loaded)
```

In `SideNavComponent` ist `/app/settings` bereits als SYS_ITEMS-Eintrag definiert — nur die Route muss in `app.routes.ts` ergänzt werden.

### 1.3 Store

`UserSettingsStore` (providedIn: 'root'):
- `profile` — `resource()` gegen `GET /api/v1/users/me`.
- `sessions` — `resource()` gegen `GET /api/v1/users/me/sessions`.
- `oidcIdentities` — aus `profile` abgeleitet (kein eigener Endpoint nötig, kommen mit Profil-Response).
- Mutations: `updateProfile`, `changePassword`, `unlinkOidc`, `revokeSession`, `revokeAllSessions`, `deleteAccount`.

---

## 2. `/app/haushalt` — Mitglieder-Rollenwechsel

### 2.1 Änderungen an der Mitglieder-Liste

Für jeden Member (nicht der eigene Account):
- Dropdown `<select [hlmSelect]>` mit Optionen `MEMBER` / `OWNER`.
- Bei Änderung: KlarDialog öffnet sich mit:
  - Titel: "Rolle ändern"
  - Text: "[Name] zu [neue Rolle] machen? Owner können Mitglieder einladen, entfernen und Rollen ändern."
  - Buttons: Abbrechen · Bestätigen
- Bei Bestätigung: `PATCH /api/v1/households/:hid/members/:userId` mit `{ role: 'OWNER' | 'MEMBER' }`.
- Bei Abbruch: Select springt auf alten Wert zurück.
- Der eigene Account-Eintrag (Owner) zeigt nur Badge **Du** — kein Dropdown, kein Entfernen-Button.

### 2.2 Guard

- Dropdown und Entfernen-Button nur gerendert wenn `canManage()` — bereits in `HaushaltComponent` implementiert.

---

## 3. Backend — neue Endpoints

Alle unter `UsersModule` (neues Modul oder Erweiterung des bestehenden Auth-Moduls).

| Method | Path | Guard | Body | Response |
|--------|------|-------|------|----------|
| `GET` | `/api/v1/users/me` | JwtAuthGuard | — | `UserProfileDto` |
| `PATCH` | `/api/v1/users/me` | JwtAuthGuard | `UpdateProfileDto` | `UserProfileDto` |
| `POST` | `/api/v1/users/me/change-password` | JwtAuthGuard | `ChangePasswordDto` | `204` |
| `DELETE` | `/api/v1/users/me/oidc/:identityId` | JwtAuthGuard | — | `204` |
| `GET` | `/api/v1/users/me/sessions` | JwtAuthGuard | — | `SessionDto[]` |
| `DELETE` | `/api/v1/users/me/sessions/:tokenId` | JwtAuthGuard | — | `204` |
| `DELETE` | `/api/v1/users/me/sessions` | JwtAuthGuard | — | `204` |
| `DELETE` | `/api/v1/users/me` | JwtAuthGuard | — | `204` |
| `PATCH` | `/api/v1/households/:hid/members/:userId` | JwtAuthGuard + HouseholdMemberGuard | `{ role }` | `MemberDto` |

### DTOs

```ts
// UserProfileDto
{
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  hasPassword: boolean;          // true wenn passwordHash !== null
  appRole: 'USER' | 'ADMIN';
  createdAt: string;             // ISO
  lastLoginAt: string | null;
  oidcIdentities: OidcIdentityDto[];
}

// OidcIdentityDto
{
  id: string;
  providerName: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

// SessionDto
{
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;            // true wenn tokenHash der aktuellen Session entspricht
}

// ChangePasswordDto
{
  currentPassword: string;
  newPassword: string;           // min. 8 Zeichen
}

// UpdateProfileDto
{
  displayName?: string;          // 1–100 Zeichen
  email?: string;                // valide E-Mail, wird lowercase gespeichert
}
```

### Business Rules

- `DELETE /users/me/oidc/:id` → 409 wenn letzte Methode ohne Passwort.
- `DELETE /users/me` → revoked alle RefreshTokens, setzt `isDeleted = true`. Falls User einziger Owner eines Haushalts: 409 mit Fehlermeldung "Du bist der einzige Owner von [Name]. Übertrage zuerst die Owner-Rolle oder lösche den Haushalt."
- `PATCH /households/:hid/members/:userId` → 403 wenn aufrufer nicht Owner. 422 wenn versucht eigene Rolle zu ändern. Mindestens ein Owner pro Haushalt muss immer erhalten bleiben (409 wenn letzter Owner degradiert werden soll).

---

## 4. Frontend-Architektur

```
apps/web/src/app/
  pages/
    settings/
      settings.component.ts
      settings.component.html
      settings.component.css
      change-password-dialog.component.ts
      change-password-dialog.component.html
      delete-account-dialog.component.ts
      delete-account-dialog.component.html
  core/
    user/
      user-settings.store.ts
      user-settings.service.ts   (API-Calls)
    theme/
      theme.service.ts           (localStorage + DOM)
```

`HaushaltComponent` bekommt:
- Neues Signal `roleChangePending` (Map userId → boolean) für Loading-State.
- Methode `changeRole(userId, newRole)` → Dialog → API-Call.

---

## 5. Sicherheits-Überlegungen

- `isCurrent` bei Sessions: Backend vergleicht den aktuellen `Authorization`-Header-Token mit dem tokenHash der Einträge. Kein tokenHash darf in der Response erscheinen.
- E-Mail-Änderung setzt `emailVerified = false` und triggert neuen Verifikations-Flow.
- Passwort-Änderung widerruft alle anderen Refresh-Tokens (Sicherheits-Best-Practice — außer aktuelle Session).
- Account-Löschung widerruft zuerst alle Tokens, dann Soft-Delete.

---

## 6. Out of Scope

- Notification-Einstellungen (kein Push/E-Mail-System implementiert).
- Sprach-/Locale-Einstellungen (App ist DE-only).
- Export eigener Daten (DSGVO — spätere Phase).
- Haushalt löschen (separate Admin-Funktion).

# PLAN-MCP — MCP Endpoint mit OAuth 2.1 für Klar

Stand: 2026-05-06 · Status: bereit zur Umsetzung

---

## 0. Kontext & Ziel

Klar bekommt einen **MCP-Endpoint** (`POST /mcp`, Streamable HTTP), den LLM-Clients (Claude Desktop, Cursor, Continue, …) ansprechen können. Auth via vollständigem **OAuth 2.1 Flow** nach MCP-Spec 2025-06-18:

- **Authorization Code + PKCE-S256** (RFC 7636)
- **Dynamic Client Registration** (RFC 7591)
- **Authorization Server Metadata** (RFC 8414)
- **Protected Resource Metadata** (RFC 9728)
- **Token Revocation** (RFC 7009)

Klar fungiert als **Authorization Server** und **Resource Server** in einem. Strikt nur für MCP — bestehende Auth-Wege (lokal, OIDC, API-Keys) bleiben unberührt.

**Per-User-Sicherheit:** Jeder Access-Token ist an genau einen User + Household gebunden, jedes MCP-Tool prüft den passenden Scope und ruft die existierenden Klar-Services mit `RequestContext`. RLS greift wie immer.

---

## 1. Globale Entscheidungen

| Frage | Entscheidung |
|---|---|
| Token-Format | JWT RS256, eigenes Key-Pair (`jwt.mcp.privateKeyPath`, `jwt.mcp.publicKeyPath`) — **getrennt** vom Klar-Session-JWT |
| `aud` Claim | `klar-mcp` (Bearer Guard verifiziert hart) |
| `iss` Claim | `${APP_BASE_URL}` (z. B. `https://your-klar-instance.com`) |
| Access-Token TTL | 1h |
| Refresh-Token | Rotating, 30d, in DB als SHA-256 Hash gespeichert |
| Auth Code TTL | 60s, single-use (consumed-Lock) |
| PKCE | **S256 Pflicht**, `plain` abgelehnt |
| Client-Auth am Token-Endpoint | `none` (PKCE-only public clients, der Standard für MCP-Desktop-Clients) — `client_secret_post` optional vorbereitet |
| Dynamic Client Registration | Offen, Rate-Limit 5/IP/h, Auto-Disable bei > 100 fehlgeschlagene Token-Requests in 24h |
| Login-Wiederverwendung | `/oauth2/authorize` redirected unauth User auf `/login?return=${absoluteAuthorizeUrl}` |
| Consent-Persistenz | Tabelle `OAuthConsent` — neue Anfrage mit Subset bekannter Scopes → Auto-Approve. Anfrage mit zusätzlichen Scopes → Consent-Screen erneut |
| Schreibrechte im MVP | Ja — `create_*` + `set_budget` |
| Logging | Pino, Redaction-Liste erweitert um `code`, `code_verifier`, `access_token`, `refresh_token`, `client_secret`, `registration_access_token` |
| Audit | `OAuthGrant` Anlage/Revoke, fehlgeschlagene Token-Requests → Audit-Log |
| Rate-Limit | `/oauth2/register` 5/h/IP, `/oauth2/token` 30/min/IP+clientId, `/oauth2/authorize` 60/min/IP, `/mcp` 600/min/userId |

---

## 2. OAuth-Scopes (Single Source of Truth)

`packages/shared/src/oauth-scopes.ts`:

```ts
export const OAUTH_SCOPES = [
  'klar:transactions:read',
  'klar:transactions:write',
  'klar:recurring:read',
  'klar:recurring:write',
  'klar:categories:read',
  'klar:categories:write',
  'klar:projects:read',
  'klar:projects:write',
  'klar:budgets:read',
  'klar:budgets:write',
  'klar:overview:read',
  'klar:household:read',
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const SCOPE_DISPLAY: Record<OAuthScope, { title: string; desc: string; icon: string }> = {
  'klar:transactions:read':  { title: 'Buchungen lesen',     desc: 'Alle deine Transaktionen sehen',          icon: 'list' },
  'klar:transactions:write': { title: 'Buchungen anlegen',   desc: 'Neue Transaktionen für dich erstellen',   icon: 'plus' },
  'klar:recurring:read':     { title: 'Fixkosten lesen',     desc: 'Wiederkehrende Buchungen sehen',          icon: 'repeat' },
  'klar:recurring:write':    { title: 'Fixkosten anlegen',   desc: 'Neue wiederkehrende Buchungen erstellen', icon: 'repeat-plus' },
  'klar:categories:read':    { title: 'Kategorien lesen',    desc: 'Alle Kategorien deines Haushalts sehen',  icon: 'tag' },
  'klar:categories:write':   { title: 'Kategorien anlegen',  desc: 'Neue Kategorien erstellen',               icon: 'tag-plus' },
  'klar:projects:read':      { title: 'Projekte lesen',      desc: 'Deine Projekte sehen',                    icon: 'folder' },
  'klar:projects:write':     { title: 'Projekte anlegen',    desc: 'Neue Projekte erstellen',                 icon: 'folder-plus' },
  'klar:budgets:read':       { title: 'Budgets lesen',       desc: 'Deine Budgets sehen',                     icon: 'wallet' },
  'klar:budgets:write':      { title: 'Budgets setzen',      desc: 'Budgets erstellen oder ändern',           icon: 'wallet-plus' },
  'klar:overview:read':      { title: 'Übersicht lesen',     desc: 'Zusammenfassungen und Aggregate',         icon: 'chart' },
  'klar:household:read':     { title: 'Haushalt lesen',      desc: 'Basis-Infos zu deinem Haushalt',          icon: 'home' },
};
```

Re-Export aus `apps/api/src/oauth/oauth-scopes.ts` und Import im Frontend via `@klar/shared`.

---

## 3. MCP-Tools (MVP)

### Reads

| Tool | Scope | Args (zod) | Ergebnis |
|---|---|---|---|
| `list_transactions` | `klar:transactions:read` | `{ month?: string (YYYY-MM), categoryId?: string, projectId?: string, limit?: number (≤200, default 50), cursor?: string }` | `{ items: Tx[], nextCursor?: string }` |
| `list_recurring` | `klar:recurring:read` | `{}` | `{ items: Recurring[] }` |
| `list_categories` | `klar:categories:read` | `{}` | `{ items: Category[] }` |
| `list_projects` | `klar:projects:read` | `{}` | `{ items: Project[] }` |
| `list_budgets` | `klar:budgets:read` | `{ month?: string }` | `{ items: Budget[] }` |
| `get_overview` | `klar:overview:read` | `{ month: string (YYYY-MM) }` | aggregierte KPIs |
| `get_household_info` | `klar:household:read` | `{}` | `{ id, name, memberCount, currency }` |

### Writes

| Tool | Scope | Args (zod) | Ergebnis |
|---|---|---|---|
| `create_transaction` | `klar:transactions:write` | `{ amountCents: number (signed, ≠0), categoryId: string, date: string (YYYY-MM-DD), description?: string, projectId?: string, visibility: 'HOUSEHOLD' \| 'PRIVATE' }` | `{ id }` |
| `create_recurring` | `klar:recurring:write` | `{ name, amountCents, categoryId, frequency: 'MONTHLY' \| 'WEEKLY' \| 'QUARTERLY' \| 'HALF_YEARLY' \| 'YEARLY', dayOfMonth?: number (1–31), startDate: string, endDate?: string, color?, icon?, visibility }` | `{ id }` |
| `create_category` | `klar:categories:write` | `{ name, type: 'INCOME' \| 'EXPENSE', color: string, icon?: string }` | `{ id }` |
| `create_project` | `klar:projects:write` | `{ name, description?: string, color: string }` | `{ id }` |
| `set_budget` | `klar:budgets:write` | `{ categoryId: string, month: string (YYYY-MM), amountCents: number (>0) }` | `{ id, action: 'created' \| 'updated' }` |

Tool-Beschreibungen (`description`) sind LLM-freundlich formuliert und enthalten Hinweise auf Klar-Konventionen (Cents, Signed Amount, Temporal-Date-Format).

---

## 4. Architektur

```
apps/api/src/
├── oauth/
│   ├── oauth.module.ts
│   ├── oauth.controller.ts            Discovery + /oauth2/* Endpoints
│   ├── oauth.service.ts               Code/Token-Issuance, PKCE-Verify, Consent-Logik
│   ├── oauth.repository.ts            Prisma für Clients/Grants/Consents/AuthCodes
│   ├── oauth-scopes.ts                Re-Export aus @klar/shared
│   ├── pkce.util.ts                   verifyS256(verifier, challenge): boolean
│   ├── token.util.ts                  signMcpAccessToken / generateRefreshToken / hashRefreshToken
│   ├── dto/
│   │   ├── register-client.dto.ts     RFC 7591 Client Metadata zod
│   │   ├── token-request.dto.ts       grant_type=authorization_code | refresh_token
│   │   ├── revoke-request.dto.ts
│   │   └── consent-decision.dto.ts    { authCodeRequestId, approve, scopes }
│   ├── oauth.service.spec.ts
│   ├── oauth.repository.spec.ts
│   └── oauth.e2e.spec.ts
│
├── mcp/
│   ├── mcp.module.ts
│   ├── mcp.controller.ts              POST /mcp (Streamable HTTP)
│   ├── mcp-server.factory.ts          Erzeugt McpServer pro Request, registriert Tools
│   ├── guards/oauth-bearer.guard.ts   Verifiziert MCP-JWT, baut RequestContext
│   ├── guards/scope.guard.ts          Prüft Scope eines Tool-Calls
│   ├── tools/
│   │   ├── tool-registry.ts           Liste aller Tools mit Scope+Schema+Handler
│   │   ├── list-transactions.tool.ts
│   │   ├── list-recurring.tool.ts
│   │   ├── list-categories.tool.ts
│   │   ├── list-projects.tool.ts
│   │   ├── list-budgets.tool.ts
│   │   ├── get-overview.tool.ts
│   │   ├── get-household-info.tool.ts
│   │   ├── create-transaction.tool.ts
│   │   ├── create-recurring.tool.ts
│   │   ├── create-category.tool.ts
│   │   ├── create-project.tool.ts
│   │   └── set-budget.tool.ts
│   ├── mcp.controller.e2e.spec.ts
│   └── tools/*.spec.ts
│
└── common/
    └── types/request-context.type.ts  ← erweitert: source: 'web' | 'api-key' | 'mcp', mcpClientId?, scopes?

apps/web/src/app/
├── pages/oauth-consent/
│   ├── oauth-consent.page.ts
│   ├── oauth-consent.page.html
│   └── oauth-consent.page.spec.ts
├── pages/settings/connected-apps/
│   ├── connected-apps.page.ts
│   ├── connected-apps.page.html
│   └── connected-apps.page.spec.ts
└── core/api/
    └── oauth-consent.api.ts           GET /oauth2/consent/:requestId, POST /oauth2/consent/:requestId

packages/shared/src/
└── oauth-scopes.ts                    OAUTH_SCOPES, OAuthScope, SCOPE_DISPLAY

prisma/
├── schema.prisma                      ← +4 Models
└── migrations/20260506_oauth_mcp/
    └── migration.sql
```

---

## 5. DB-Schema

```prisma
model OAuthClient {
  id                       String    @id @default(cuid())
  clientId                 String    @unique
  clientSecretHash         String?
  clientName               String
  redirectUris             String[]
  logoUri                  String?
  clientUri                String?
  tosUri                   String?
  policyUri                String?
  tokenEndpointAuthMethod  String    @default("none")
  registrationAccessTokenHash String?
  createdAt                DateTime  @default(now())
  disabled                 Boolean   @default(false)
  failedTokenRequests24h   Int       @default(0)
  failedTokenWindowStart   DateTime?
  grants                   OAuthGrant[]
  consents                 OAuthConsent[]
  authCodes                OAuthAuthCode[]
}

model OAuthAuthCode {
  code                String    @id              // SHA-256 Hex des ausgegebenen Codes
  clientId            String
  client              OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  userId              String
  user                User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  householdId         String
  scopes              String[]
  redirectUri         String
  codeChallenge       String
  codeChallengeMethod String                       // immer "S256"
  expiresAt           DateTime
  consumedAt          DateTime?
  createdAt           DateTime  @default(now())
  @@index([userId])
  @@index([clientId])
}

model OAuthGrant {
  id                String    @id @default(cuid())
  clientId          String
  client            OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  householdId       String
  scopes            String[]
  refreshTokenHash  String    @unique
  refreshExpiresAt  DateTime
  lastUsedAt        DateTime?
  revokedAt         DateTime?
  createdAt         DateTime  @default(now())
  @@index([userId, clientId])
}

model OAuthConsent {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId  String
  client    OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  scopes    String[]
  grantedAt DateTime  @default(now())
  @@unique([userId, clientId])
}
```

User-Model bekommt Back-Refs (`oauthGrants`, `oauthConsents`, `oauthAuthCodes`).

**RLS:** Diese Tabellen sind **nicht** household-scoped — sie sind user/client-bezogen. Keine RLS-Policies, aber die Repos filtern explizit auf `userId`. Cleanup-Job (Phase 12) löscht abgelaufene `OAuthAuthCode` und `OAuthGrant` mit `refreshExpiresAt < now()`.

---

## 6. HTTP-Endpoints — vollständige Shapes

### 6.1 Discovery

**`GET /.well-known/oauth-authorization-server`** (RFC 8414)

```json
{
  "issuer": "https://your-klar-instance.com",
  "authorization_endpoint": "https://your-klar-instance.com/oauth2/authorize",
  "token_endpoint": "https://your-klar-instance.com/oauth2/token",
  "registration_endpoint": "https://your-klar-instance.com/oauth2/register",
  "revocation_endpoint": "https://your-klar-instance.com/oauth2/revoke",
  "scopes_supported": ["klar:transactions:read", "klar:transactions:write", ...],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
  "code_challenge_methods_supported": ["S256"],
  "service_documentation": "https://your-klar-instance.com/docs/mcp"
}
```

**`GET /.well-known/oauth-protected-resource`** (RFC 9728)

```json
{
  "resource": "https://your-klar-instance.com/mcp",
  "authorization_servers": ["https://your-klar-instance.com"],
  "scopes_supported": [...],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://your-klar-instance.com/docs/mcp"
}
```

Beide ungeschützt, beide werden in E2E-Test gegen JSON-Schema validiert.

### 6.2 Dynamic Client Registration

**`POST /oauth2/register`** (RFC 7591)

Request:
```json
{
  "client_name": "Claude Desktop",
  "redirect_uris": ["http://localhost:33418/callback"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "logo_uri": "https://...",
  "client_uri": "https://...",
  "tos_uri": "https://...",
  "policy_uri": "https://..."
}
```

Validierung (zod):
- `client_name` 1–100 Zeichen
- `redirect_uris`: 1–5 URIs, jede `https://...` **oder** `http://localhost(:port)?/...` **oder** `http://127.0.0.1(:port)?/...` — **kein** `http://` auf öffentlichen Hostnames
- `token_endpoint_auth_method ∈ {"none", "client_secret_post"}` (Default `"none"`)
- `grant_types ⊆ {"authorization_code", "refresh_token"}`
- `response_types = ["code"]`

Response 201:
```json
{
  "client_id": "klar_mcp_<24 random hex>",
  "client_secret": "<nur wenn auth_method=client_secret_post>",
  "client_id_issued_at": 1714989600,
  "client_secret_expires_at": 0,
  "registration_access_token": "klar_rat_<48 random hex>",
  "registration_client_uri": "https://your-klar-instance.com/oauth2/register/<client_id>",
  ...echo der akzeptierten Felder
}
```

Errors: `400 invalid_redirect_uri`, `400 invalid_client_metadata`.

Rate-Limit per IP via existierender Throttler-Konfiguration.

### 6.3 Authorize

**`GET /oauth2/authorize`**

Query-Params:
- `response_type=code` (Pflicht, sonst `400 unsupported_response_type`)
- `client_id` (Pflicht)
- `redirect_uri` (Pflicht, muss exakt in `OAuthClient.redirectUris` liegen)
- `scope` (Pflicht, space-separated, jeder muss in `OAUTH_SCOPES` liegen)
- `state` (Pflicht, vom Client)
- `code_challenge` (Pflicht)
- `code_challenge_method=S256` (Pflicht; `plain` → `400 invalid_request`)

Logik:
1. Validiere alle Params. Bei Fehler: wenn `redirect_uri` valide → Redirect mit `?error=...&state=...`. Sonst Plain-400.
2. Prüfe Klar-Session-Cookie. Unauth → `302 /login?return=<absolute url>`.
3. User authentifiziert → lade aktiven Household (`req.user.activeHouseholdId`).
4. Lade `OAuthConsent` für `(userId, clientId)`. Wenn vorhanden und `requestedScopes ⊆ consent.scopes` → **Auto-Approve** (Schritt 6 direkt).
5. Sonst: lege `pendingConsent` in Session/Redis-State an (key = `consentRequestId`, TTL 5 min) mit allen Authorize-Params + userId + householdId. Redirect auf `/oauth/consent?request=<consentRequestId>`.
6. Auto-Approve / nach Consent: erstelle `OAuthAuthCode` (Code = 32 Bytes random, in DB als SHA-256 gespeichert), TTL 60s. Redirect auf `redirect_uri?code=<plain code>&state=<state>`.

**Consent-Backend:**

`GET /oauth2/consent/:requestId` → JSON mit `{ clientName, logoUri, scopes: [{ id, title, desc, icon }], userEmail, redirectUri }` für die Angular-Page.

`POST /oauth2/consent/:requestId` mit Body `{ approve: boolean, scopes: string[] }`:
- `approve=false` → Redirect auf `redirect_uri?error=access_denied&state=<state>`. Pending-State löschen.
- `approve=true` → Schreibe `OAuthConsent` (`upsert`, Scopes-Union mit bestehenden), erstelle AuthCode, Redirect.

### 6.4 Token

**`POST /oauth2/token`** (Content-Type `application/x-www-form-urlencoded`)

**Authorization-Code-Grant:**
```
grant_type=authorization_code
code=<plain code>
redirect_uri=<must match>
client_id=<>
code_verifier=<>
```

Logik:
1. `OAuthAuthCode` per SHA-256(code) finden. Nicht gefunden → `400 invalid_grant`.
2. `consumedAt != null` → mark client als suspect (alle Grants dieses Clients revoken), `400 invalid_grant`.
3. `expiresAt < now()` → `400 invalid_grant`.
4. `clientId/redirectUri` mismatch → `400 invalid_grant`.
5. PKCE: `verifyS256(code_verifier, codeChallenge) === false` → `400 invalid_grant`.
6. `consumedAt = now()` (in Transaktion mit AuthCode-Lookup).
7. Refresh-Token generieren (32 Bytes), SHA-256-Hash speichern als `OAuthGrant`.
8. Access-Token signieren (siehe 6.6).

Response 200:
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "klar_rt_<plain>",
  "scope": "klar:transactions:read klar:overview:read"
}
```

**Refresh-Grant:**
```
grant_type=refresh_token
refresh_token=<>
client_id=<>
scope=<optional, Subset>
```

Logik:
1. SHA-256(refresh_token) → `OAuthGrant`. Nicht gefunden / `revokedAt != null` / `refreshExpiresAt < now()` → `400 invalid_grant`.
2. `clientId` mismatch → `400 invalid_grant`.
3. Wenn `scope` gegeben: muss Subset von `grant.scopes` sein, sonst `400 invalid_scope`.
4. **Rotating**: alten Grant `revokedAt = now()`, neuen Grant mit neuem Refresh-Token anlegen, neuen Access-Token signieren.
5. Response identisch.

### 6.5 Revoke

**`POST /oauth2/revoke`** (RFC 7009)

```
token=<refresh_or_access>
token_type_hint=<optional: "refresh_token"|"access_token">
client_id=<>
```

Logik: SHA-256(token) → wenn Match in `OAuthGrant.refreshTokenHash` → `revokedAt = now()`. Access-Token-Revoke ist **No-Op** (kurzlebig, nicht in DB) — Response trotzdem 200 (RFC verlangt). User-initiierte Revoke aus Settings nutzt internen Endpoint mit Klar-JWT (siehe Phase 11).

### 6.6 Token-Signatur

Helper `signMcpAccessToken(grant, client)`:

```ts
{
  iss: APP_BASE_URL,
  sub: grant.userId,
  aud: 'klar-mcp',
  exp: now + 3600,
  iat: now,
  jti: <random>,
  azp: client.clientId,        // Authorized party
  scope: grant.scopes.join(' '),
  hh: grant.householdId,       // Custom claim — Bearer Guard liest
}
```

Signiert mit `jwt.mcp.privateKey` (RS256).

---

## 7. MCP-Endpoint

**`POST /mcp`** — Streamable HTTP via `@modelcontextprotocol/sdk` `StreamableHTTPServerTransport`.

NestJS-Controller delegiert Body+Response an Transport. Pro Request:

1. `OAuthBearerGuard` extrahiert `Authorization: Bearer <jwt>`, verifiziert mit `jwt.mcp.publicKey`, prüft `aud === 'klar-mcp'`, `exp`, `revokedAt` (DB-Lookup über `azp+sub` → letzter aktiver Grant). Setzt `req.context = { userId, householdId, source: 'mcp', mcpClientId, scopes }`.
2. `McpServerFactory.create(req.context)` baut `McpServer` mit Server-Info `{ name: "klar", version: pkg.version }`, registriert nur die Tools, deren Scope in `req.context.scopes` enthalten ist. Tools, die fehlen, sind dem LLM gar nicht sichtbar (Prinzip der geringsten Überraschung).
3. Tool-Handler ruft existierenden Service mit `req.context`. Throws → MCP-Error mit übersetzter Message.

**Tool-Registry-Eintrag (Beispiel):**
```ts
export const listTransactionsTool: McpToolDef = {
  name: 'list_transactions',
  scope: 'klar:transactions:read',
  description: 'Listet Transaktionen des Users im aktiven Haushalt. Beträge sind in Cents (signed: + Einnahme, − Ausgabe). Datum im Format YYYY-MM-DD.',
  inputSchema: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    categoryId: z.string().optional(),
    projectId: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  }),
  handler: async (args, ctx, deps) => {
    const result = await deps.transactionsService.list(ctx, args);
    return { items: result.items.map(toMcpTx), nextCursor: result.nextCursor };
  },
};
```

`deps` = injected NestJS-Services (TransactionsService, RecurringService, …). Factory bekommt sie über DI.

---

## 8. Phasen — ausformuliert

Jede Phase = ein Commit. Vor dem Commit: `pnpm test` + `pnpm lint` + `pnpm build` grün, Coverage-Threshold (Backend 80% Lines, Frontend 70%) eingehalten.

### Phase 1 — Schema, Migration, Shared-Scopes (30 min)

**Files:**
- `packages/shared/src/oauth-scopes.ts` (neu)
- `packages/shared/src/index.ts` (Export ergänzen)
- `prisma/schema.prisma` (4 Models hinzu, User-Backrefs)
- `prisma/migrations/20260506_oauth_mcp/migration.sql` (auto via `prisma migrate dev --name oauth_mcp`)

**Tests:**
- `packages/shared/src/oauth-scopes.spec.ts`: `OAUTH_SCOPES.length === 12`, jedes hat `SCOPE_DISPLAY`-Eintrag.

**DoD:** `pnpm db:migrate:dev` läuft idempotent durch, `pnpm prisma generate` aktualisiert Types, Frontend kann `import { OAUTH_SCOPES } from '@klar/shared'`.

---

### Phase 2 — Discovery-Endpoints (30 min)

**Files:**
- `apps/api/src/oauth/oauth.module.ts` (neu, in `AppModule` registriert)
- `apps/api/src/oauth/oauth.controller.ts` mit zwei `@Get`-Methoden, beide `@Public()`
- `apps/api/src/config/configuration.ts` ergänzt um `app.baseUrl` aus `APP_BASE_URL`

**Tests:**
- `apps/api/src/oauth/oauth.e2e.spec.ts`: GETs returnen 200, Schemas korrekt, `issuer === APP_BASE_URL`.

**DoD:** `curl https://localhost:3000/.well-known/oauth-authorization-server | jq` gibt valides JSON.

---

### Phase 3 — Dynamic Client Registration (45 min)

**Files:**
- `apps/api/src/oauth/dto/register-client.dto.ts` (zod)
- `apps/api/src/oauth/oauth.repository.ts` (`createClient`, `findClientById`, `incrementFailedTokenRequests`)
- `apps/api/src/oauth/oauth.service.ts` (`registerClient`)
- `apps/api/src/oauth/oauth.controller.ts` `@Post('register')`, `@Public()`, `@Throttle({ default: { limit: 5, ttl: 3600_000 } })`
- `apps/api/src/oauth/random.util.ts` (`generateClientId`, `generateSecret`, `generateRegistrationAccessToken`)

**Tests:**
- Service-Spec: redirect_uri-Validierung (https ok, localhost ok, http+public abgelehnt), client_name-Length, Defaults.
- E2E: POST mit minimalem Body returned 201, `client_id` matcht Pattern.

**DoD:** `curl -X POST .../oauth2/register -d '{"client_name":"x","redirect_uris":["http://localhost:33418/cb"]}'` returned 201.

---

### Phase 4 — Authorize-Endpoint (60 min)

**Files:**
- `apps/api/src/oauth/oauth.service.ts` (`prepareAuthorize`, `consumeConsent`)
- `apps/api/src/oauth/oauth.controller.ts` `@Get('authorize')`
- `apps/api/src/oauth/dto/authorize-query.dto.ts` (zod)
- `apps/api/src/oauth/pending-consent.store.ts` (in-memory Map mit TTL-Cleanup; später Redis falls Multi-Instance — Marker `// TODO(spec): redis when scaling out`)

**Tests:**
- Service: jede Validierungs-Branch (missing param, wrong response_type, invalid redirect_uri, plain PKCE, unknown scope).
- E2E: Unauth → 302 nach `/login?return=...`. Auth + bekannter Consent → 302 mit `?code=...&state=...`. Auth + neuer Consent → 302 nach `/oauth/consent?request=...`.

**DoD:** Manueller Flow mit eingeloggtem Browser endet auf Consent-Page (404 noch ok, Phase 5 baut die Page).

---

### Phase 5 — Consent-UI (Angular) (90 min)

**Files:**
- `apps/web/src/app/pages/oauth-consent/oauth-consent.page.ts` (Standalone, Signals, `resource()` für GET)
- `apps/web/src/app/pages/oauth-consent/oauth-consent.page.html`
- `apps/web/src/app/core/api/oauth-consent.api.ts`
- `apps/web/src/app/app.routes.ts` (Route `/oauth/consent`)
- `apps/web/src/app/pages/oauth-consent/oauth-consent.page.spec.ts`
- Playwright `apps/web/tests/e2e/oauth-consent.spec.ts` (Login → `/oauth/consent?request=mock`, klick Approve, prüfe Redirect)

**UI-Komponenten:** nur bestehende `klar-*` und `hlm-*`. Layout-Klassen Tailwind 4. Dark-Mode von Anfang an.

**Edge Cases:**
- `requestId` ungültig/abgelaufen → Error-Page mit "Anfrage abgelaufen, bitte App neu starten"
- Beim Approve: Loading-State auf Button, Disable beider Buttons während Submit
- Deny zeigt Toast "Zugriff verweigert" und redirected via Backend-Response

**DoD:** Playwright grün. Visuell auf Mobile + Desktop getestet.

---

### Phase 6 — Token-Endpoint (60 min)

**Files:**
- `apps/api/src/oauth/dto/token-request.dto.ts` (Discriminated Union via zod)
- `apps/api/src/oauth/token.util.ts` (`signMcpAccessToken`, `generateRefreshToken`, `hashRefreshToken`)
- `apps/api/src/oauth/pkce.util.ts` (`verifyS256`)
- `apps/api/src/oauth/oauth.service.ts` (`exchangeCode`, `refresh`)
- `apps/api/src/oauth/oauth.repository.ts` (`consumeAuthCode`, `createGrant`, `findGrantByRefreshHash`, `revokeGrant`)
- `apps/api/src/oauth/oauth.controller.ts` `@Post('token')`, `@Public()`
- `apps/api/src/config/configuration.ts` (`jwt.mcp.privateKeyPath`, `jwt.mcp.publicKeyPath`, `jwt.mcp.audience`)
- Key-Generierung: `pnpm tsx scripts/generate-mcp-keys.ts` (legt `secrets/mcp.private.pem` und `secrets/mcp.public.pem` an, falls fehlend)
- `.gitignore` ergänzen für `secrets/mcp*.pem`
- `docker-compose.dev.yml` Volume-Mount für secrets

**Tests:**
- pkce.spec: bekannte Vector-Pairs grün/falsch.
- oauth.service.spec: Code-Reuse → Grant-Cascade-Revoke; expired code; bad verifier; mismatch redirect_uri; bad scope on refresh.
- E2E: kompletter Code+Verifier → Access+Refresh; sofortiger Refresh → neuer Access+Refresh, alter Refresh tot; Replay alter Refresh → 400.

**DoD:** End-to-End mit `curl` (siehe Anhang) liefert valide Tokens.

---

### Phase 7 — OAuth Bearer Guard (30 min)

**Files:**
- `apps/api/src/mcp/guards/oauth-bearer.guard.ts`
- `apps/api/src/mcp/mcp.module.ts` (vorbereitet)
- `apps/api/src/common/types/request-context.type.ts` (`source: 'web' | 'api-key' | 'mcp'`, `mcpClientId?: string`, `scopes?: string[]`)

**Tests:**
- guard.spec: gültiger Token → context gesetzt; falsches `aud` → 401; `exp < now` → 401; revokedGrant → 401; fehlender Header → 401 mit `WWW-Authenticate: Bearer realm="klar-mcp", error="invalid_token", resource_metadata=".../.well-known/oauth-protected-resource"`.

**DoD:** Guard kann später auf `/mcp` montiert werden, Unit-Tests grün.

---

### Phase 8 — MCP-Server-Skeleton (60 min)

**Deps hinzufügen:** `@modelcontextprotocol/sdk` in `apps/api/package.json`.

**Files:**
- `apps/api/src/mcp/mcp.controller.ts` `@Post('/mcp')`, Guard angehängt, ruft `McpServerFactory.handle(req, res, ctx)`.
- `apps/api/src/mcp/mcp-server.factory.ts` — erzeugt `new McpServer({ name: 'klar', version })`, attached `StreamableHTTPServerTransport`, registriert Tools aus `tool-registry.ts` gefiltert nach `ctx.scopes`.
- `apps/api/src/mcp/tools/tool-registry.ts` (leeres Array zunächst).
- `apps/api/src/mcp/mcp.module.ts` registriert Controller + Factory + Repos der Domänen-Module (re-exportiert).

**Tests:**
- e2e: `initialize` → 200 mit ServerInfo. `tools/list` mit Scope-leerem Token → leeres Array.

**DoD:** `mcp-inspector` (`npx @modelcontextprotocol/inspector`) kann mit Bearer-Token connecten und `initialize` machen.

---

### Phase 9 — MCP-Tools Reads (90 min)

**Files:**
- `apps/api/src/mcp/tools/list-transactions.tool.ts` … `get-household-info.tool.ts` (7 Files)
- `apps/api/src/mcp/tools/tool-registry.ts` (alle Reads aufgenommen)
- Pro Tool ein `*.spec.ts` mit Mock-Service.

**Pro Tool prüfen:**
1. Scope-Check (Test: ohne Scope → MCP-Error `forbidden`)
2. zod-Parse mit Edge-Cases (z. B. `month=2025-13` → Error)
3. Rückgabe-Shape gegen Schema validiert

**DoD:** mcp-inspector kann jedes Tool aufrufen, sieht echte Daten.

---

### Phase 10 — MCP-Tools Writes (90 min)

**Files:**
- `apps/api/src/mcp/tools/create-transaction.tool.ts` … `set-budget.tool.ts` (5 Files)
- Pro Tool ein `*.spec.ts`

**Wichtig:** zod-Validation **strikt**:
- `amountCents`: Integer, `≠ 0`, Range `[-1_000_000_000, 1_000_000_000]`
- `date`: Regex + `Temporal.PlainDate.from()` Try-Parse
- `categoryId`/`projectId`: muss Existence-Check im Service durchlaufen (existierender Service kümmert sich)
- `visibility`: enum, default `HOUSEHOLD`

**Audit:** Jeder Write protokolliert in existierendem Audit-Log mit `source: 'mcp'`, `mcpClientId`.

**DoD:** mcp-inspector legt Test-Transaction an, sie taucht in Web-UI auf, Audit-Log-Eintrag vorhanden.

---

### Phase 11 — Settings → Verbundene Apps (60 min)

**Backend:**
- `apps/api/src/oauth/oauth.controller.ts` `@Get('grants')` (mit `JwtAuthGuard`, listet eigene Grants), `@Delete('grants/:id')` (revoked)
- `apps/api/src/oauth/oauth.service.ts` (`listUserGrants`, `revokeUserGrant`)

**Frontend:**
- `apps/web/src/app/pages/settings/connected-apps/connected-apps.page.ts` (Resource-Store-Pattern)
- Settings-Navigation ergänzen

**UI:** Liste pro Grant: ClientName + Logo, Scopes als Chips, "verbunden seit", "zuletzt verwendet", Revoke-Button mit Confirm-Dialog (`hlm-alert-dialog`).

**Tests:** Page-Spec, Playwright (Revoke → Liste leer).

**DoD:** User kann Apps revoken, Revoke wirkt sofort (nächster MCP-Call → 401).

---

### Phase 12 — Revocation-Endpoint + Cleanup-Job (30 min)

**Files:**
- `apps/api/src/oauth/oauth.controller.ts` `@Post('revoke')`
- `apps/api/src/oauth/oauth.cleanup.cron.ts` (`@Cron('0 */15 * * * *')`) löscht abgelaufene `OAuthAuthCode` und revoked Grants > 90d.
- `apps/api/src/app.module.ts` (`ScheduleModule` falls noch nicht da).

**Tests:** Service-Spec für Cleanup mit injected Date.

**DoD:** Cron-Job läuft im Container, Logs zeigen "cleaned X auth codes, Y grants".

---

### Phase 13 — Vollständiger E2E-Flow-Test (60 min)

**File:** `apps/api/src/oauth/oauth-flow.e2e.spec.ts`

Schritte im Test:
1. `POST /oauth2/register` → clientId
2. User in Test-DB anlegen, Login-Cookie via existierender Helper.
3. `GET /oauth2/authorize?...` mit Cookie → folge Redirect, simuliere Consent-Approval via internen Endpoint, capture `code`.
4. `POST /oauth2/token` mit code+verifier → access+refresh.
5. `POST /mcp` mit `initialize` → 200.
6. `POST /mcp` mit `tools/call list_transactions` → erwartete Daten.
7. `POST /oauth2/revoke` mit refresh → 200.
8. `POST /oauth2/token` mit altem refresh → 400 invalid_grant.
9. `POST /mcp` mit altem access → 401.

**DoD:** Spec grün im CI.

---

### Phase 14 — Hardening + Doku (45 min)

**Files:**
- `apps/api/src/main.ts` Pino-Redaction-Liste erweitern
- `apps/api/src/oauth/oauth.controller.ts` Throttle-Decorators auf alle Endpoints
- `apps/api/src/audit/audit.events.ts` Events `OAUTH_CLIENT_REGISTERED`, `OAUTH_GRANT_CREATED`, `OAUTH_GRANT_REVOKED`, `OAUTH_TOKEN_FAILED`
- `docs/mcp.md` mit
  - Architektur-Diagramm (Mermaid)
  - Setup-Guide für Claude Desktop / Cursor / Continue
  - Scope-Übersicht
  - Beispiel-Curls
  - Troubleshooting
- `README.md` Verweis auf `docs/mcp.md`

**DoD:** Doku gegen frischen Claude-Desktop-Setup verifiziert.

---

## 9. Env-Vars (neu)

```
APP_BASE_URL=https://your-klar-instance.com
JWT_MCP_PRIVATE_KEY_PATH=/secrets/mcp.private.pem
JWT_MCP_PUBLIC_KEY_PATH=/secrets/mcp.public.pem
JWT_MCP_AUDIENCE=klar-mcp
OAUTH_AUTH_CODE_TTL_SECONDS=60
OAUTH_ACCESS_TOKEN_TTL_SECONDS=3600
OAUTH_REFRESH_TOKEN_TTL_SECONDS=2592000
OAUTH_REGISTRATION_RATE_LIMIT_PER_HOUR=5
OAUTH_REGISTRATION_OPEN=true     # Kill-Switch
```

In `apps/api/src/config/configuration.ts` als typed config + zod-Validierung beim Boot.

---

## 10. Curl-Beispiele (für Doku & Manual-Test)

```bash
# 1. Discovery
curl -s https://your-klar-instance.com/.well-known/oauth-authorization-server | jq

# 2. Register
CLIENT=$(curl -s -X POST https://your-klar-instance.com/oauth2/register \
  -H 'content-type: application/json' \
  -d '{"client_name":"my-cli","redirect_uris":["http://localhost:33418/cb"]}')
CID=$(echo $CLIENT | jq -r .client_id)

# 3. PKCE
VERIFIER=$(openssl rand -base64 64 | tr -d '/+\n=' | cut -c1-64)
CHALLENGE=$(echo -n $VERIFIER | openssl dgst -binary -sha256 | base64 | tr -d '/+=' | tr '/' '_' | tr '+' '-')

# 4. Authorize (Browser-Flow)
open "https://your-klar-instance.com/oauth2/authorize?response_type=code&client_id=$CID&redirect_uri=http://localhost:33418/cb&scope=klar:transactions:read&state=xyz&code_challenge=$CHALLENGE&code_challenge_method=S256"

# 5. Token (nach Capture des Codes)
curl -s -X POST https://your-klar-instance.com/oauth2/token \
  -d "grant_type=authorization_code&code=$CODE&redirect_uri=http://localhost:33418/cb&client_id=$CID&code_verifier=$VERIFIER" | jq

# 6. MCP-Call
curl -s -X POST https://your-klar-instance.com/mcp \
  -H "Authorization: Bearer $ACCESS" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 11. Reihenfolge

**Block A — Backend-Auth (Phasen 1–7):** in einem Rutsch. Push erst wenn Block A grün.
**Block B — MCP + Tools (Phasen 8–10):** dogfood mit `mcp-inspector`.
**Block C — UI + Hardening (Phasen 11–14):** abschließen.

Nach jedem Block: `memory_store(key="klar-mcp-block-A-done", namespace="klar-app")`.

---

## 12. Definition of Done (Gesamt)

- [ ] Alle 14 Phasen committed, jeder Commit für sich grün
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` global grün
- [ ] Coverage Backend ≥ 80% Lines, Frontend ≥ 70% Lines
- [ ] Playwright Smoke für Consent-Page + Connected-Apps grün
- [ ] mcp-inspector kann gegen lokal connecten und alle Tools nutzen
- [ ] Claude Desktop kann gegen `your-klar-instance.com` connecten und `list_transactions` aufrufen
- [ ] `docs/mcp.md` vollständig, von frischem Setup verifiziert
- [ ] Stack 162 redeployed, Smoke-Test grün
- [ ] Memory aktualisiert (`klar-mcp-implemented`)

---

## 13. Referenzen

- MCP Spec 2025-06-18: https://modelcontextprotocol.io/specification/2025-06-18
- Authorization (MCP Auth Spec): https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- RFC 7591 — Dynamic Client Registration
- RFC 7009 — Token Revocation
- RFC 8414 — Authorization Server Metadata
- RFC 9728 — OAuth Protected Resource Metadata
- RFC 7636 — PKCE
- `@modelcontextprotocol/sdk` Docs: https://github.com/modelcontextprotocol/typescript-sdk

# MCP Endpoint mit OAuth 2.1

Klar exponiert ihre Daten via [Model Context Protocol](https://modelcontextprotocol.io) — LLM-Clients (Claude Desktop, Cursor, Continue …) können nach User-Consent direkt mit Klar interagieren.

## Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│  Klar API (NestJS + Fastify)                                     │
│                                                                  │
│  Authorization Server                Resource Server             │
│  ├─ /.well-known/oauth-…             ├─ /mcp (Streamable HTTP)   │
│  ├─ /oauth2/register (RFC 7591)      └─ Tools (read + write)     │
│  ├─ /oauth2/authorize                                            │
│  ├─ /oauth2/token                    Bearer-Guard verifiziert    │
│  └─ /oauth2/revoke (RFC 7009)        JWT (aud=klar-mcp)          │
│                                                                  │
│  Bestehende Auth bleibt unberührt:                               │
│  /api/v1/auth/* (Klar-Session) · /api/public/* (API-Keys M2M)    │
└──────────────────────────────────────────────────────────────────┘
```

- **Auth**: OAuth 2.1 Authorization Code + PKCE (S256) + Dynamic Client Registration
- **Token**: JWT RS256 (eigenes Key-Pair, getrennt von Klar-Session-JWT). Audience `klar-mcp`
- **Transport**: Streamable HTTP (`@modelcontextprotocol/sdk`)
- **Per-User-Sicherheit**: Jeder Token bindet User + Household. Tools nutzen die existierenden Klar-Services mit `RequestContext` — RLS greift wie überall

## Scopes

| Scope | Beschreibung |
|---|---|
| `klar:transactions:read` / `:write` | Buchungen lesen / anlegen |
| `klar:recurring:read` / `:write` | Fixkosten lesen / anlegen |
| `klar:categories:read` / `:write` | Kategorien lesen / anlegen |
| `klar:projects:read` / `:write` | Projekte lesen / anlegen |
| `klar:budgets:read` / `:write` | Budgets lesen / setzen |
| `klar:overview:read` | Aggregierte Monatsübersicht |
| `klar:household:read` | Basis-Infos zum Haushalt |

Tools, deren Scope nicht im ausgestellten Token enthalten sind, sind dem LLM **nicht** sichtbar.

## MCP-Tools (MVP)

### Reads
- `list_transactions(month?, categoryId?, projectId?)`
- `list_recurring(isActive?)`
- `list_categories(type?, includeArchived?)`
- `list_projects(status?)`
- `list_budgets(month?, categoryId?)`
- `get_overview(month)`
- `get_household_info()`

### Writes
- `create_transaction(amountCents, categoryId, date, description?, projectId?, visibility?)`
- `create_recurring(name, amountCents, categoryId, frequency, …)`
- `create_category(name, type, color, icon?)`
- `create_project(name, color, description?, …)`
- `set_budget(categoryId, month, amountCents)`

Alle Beträge sind `amountCents: number` (Int, signed). Datum YYYY-MM-DD. Monat YYYY-MM.

## Setup-Guide für Claude Desktop / Cursor / Continue

In der Settings-Konfiguration den MCP-Server hinzufügen:

```json
{
  "klar": {
    "url": "https://klar.disane.dev/mcp",
    "transport": "http"
  }
}
```

Beim ersten Aufruf öffnet der Client den Browser zu `/oauth2/authorize`, der User landet auf der Klar-Consent-Page, klickt **Autorisieren**, der Client tauscht den Code gegen einen Access-Token. Fertig.

User kann den Zugriff jederzeit unter **Einstellungen → Verbundene Apps** widerrufen.

## Manueller Smoke-Test (curl)

```bash
APP_URL=https://klar.disane.dev

# 1. Discovery
curl -s "$APP_URL/.well-known/oauth-authorization-server" | jq

# 2. Client registrieren
CLIENT=$(curl -s -X POST "$APP_URL/oauth2/register" \
  -H 'content-type: application/json' \
  -d '{"client_name":"smoke-test","redirect_uris":["http://localhost:33418/cb"]}')
CID=$(echo "$CLIENT" | jq -r .client_id)

# 3. PKCE
VERIFIER=$(openssl rand -base64 64 | tr -d '/+\n=' | cut -c1-64)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 \
  | base64 | tr -d '=' | tr '/' '_' | tr '+' '-')

# 4. Authorize (Browser-Flow — öffnet die Klar Consent-Page)
echo "$APP_URL/oauth2/authorize?response_type=code&client_id=$CID&redirect_uri=http://localhost:33418/cb&scope=klar:transactions:read&state=xyz&code_challenge=$CHALLENGE&code_challenge_method=S256"

# 5. Nach Approval Code aus Redirect copy & paste:
CODE="..."
TOKENS=$(curl -s -X POST "$APP_URL/oauth2/token" \
  -d "grant_type=authorization_code&code=$CODE&redirect_uri=http://localhost:33418/cb&client_id=$CID&code_verifier=$VERIFIER")
ACCESS=$(echo "$TOKENS" | jq -r .access_token)

# 6. MCP tools/list
curl -s -X POST "$APP_URL/mcp" \
  -H "Authorization: Bearer $ACCESS" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Sicherheits-Highlights

- **PKCE-S256 Pflicht**, `plain` abgelehnt
- **Authorization Code single-use**: Replay → Cascade-Revoke aller Grants des Clients
- **Refresh-Token rotating** (jeder Refresh erzeugt neuen, alter wird revoked)
- **Bearer-Guard prüft Grant-Status** in DB → Revocation greift sofort, nicht erst nach Token-Ablauf
- **Token-Felder in Pino-Redaction** (kein Klartext in Logs)
- **Rate-Limits**: `/oauth2/register` 5/h/IP, `/oauth2/token` 30/min, `/mcp` 600/min/User
- **Cleanup-Job** (alle 15 Min): abgelaufene AuthCodes + revoked Grants > 90d

## Konfiguration

Env-Variablen (siehe `apps/api/.env.example`):

```
APP_BASE_URL=https://klar.disane.dev
JWT_MCP_PRIVATE_KEY_PATH=/secrets/mcp.private.pem
JWT_MCP_PUBLIC_KEY_PATH=/secrets/mcp.public.pem
JWT_MCP_AUDIENCE=klar-mcp
OAUTH_AUTH_CODE_TTL_SECONDS=60
OAUTH_ACCESS_TOKEN_TTL_SECONDS=3600
OAUTH_REFRESH_TOKEN_TTL_SECONDS=2592000
OAUTH_REGISTRATION_OPEN=true
OAUTH_REGISTRATION_RATE_LIMIT_PER_HOUR=5
```

Key-Pair generieren (einmalig):

```bash
pnpm --filter @klar/api exec tsx scripts/generate-mcp-keys.ts
```

## Referenzen

- [MCP Spec 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- RFC 7591 (Dynamic Client Registration)
- RFC 7009 (Token Revocation)
- RFC 8414 (Authorization Server Metadata)
- RFC 9728 (Protected Resource Metadata)
- RFC 7636 (PKCE)

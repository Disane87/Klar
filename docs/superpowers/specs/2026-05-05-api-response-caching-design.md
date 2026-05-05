# API Response Caching — Design

**Status:** Draft
**Date:** 2026-05-05
**Scope:** Vollständiges Response-Caching für `/api/v1/*` (NestJS) + Frontend-HTTP-Cache (Angular) mit Tag-basierter Invalidierung und ETag/304-Validation.

---

## Ziele

- Alle GET-Responses der internen API cachen, mit präziser Invalidierung bei Mutations.
- Hot Path: Overview-Endpoints (Cashflow, Fixkosten, Projekte) — teure Aggregate, hohe Lese-Frequenz.
- Cross-Tenant- und Cross-User-Isolation: keine Daten-Leaks zwischen Households oder zwischen Usern desselben Households (PRIVATE-Visibility).
- Frontend-Roundtrips minimieren (In-Memory + ETag) ohne Stale-Daten nach Mutationen.

## Nicht-Ziele (V1)

- LRU-Eviction im Frontend (Map ohne Limit reicht für SPA-Session).
- BroadcastChannel für Multi-Tab-Sync (ETag-Counter macht das implizit korrekt beim nächsten Request).
- Live-Updates via SSE/WebSocket für Cross-User-Mutations.
- Cache-Warming nach Login.
- Per-Field/N+1-Caching (DataLoader) — separater Spec falls Prisma-Queries zum Bottleneck werden.
- Public API (`/api/public/v1/*`) wird im Rahmen einer separaten Spec entfernt; dieses Caching-Design behandelt sie nicht.

## Voraussetzungen

- Phase 9 (Overview-Endpoints) abgeschlossen — Hot Path existiert.
- Public API ist entweder noch vorhanden (dann ungecached, kein eigener Scope) oder bereits entfernt. Caching ignoriert sie in beiden Fällen.

---

## Architektur — Backend

### Stack-Ergänzung

- **Redis** (oder Valkey) als zusätzlicher Container in `docker/docker-compose.dev.yml` und `docker/docker-compose.prod.yml`.
- **Client:** `ioredis` über `@nestjs/cache-manager` mit `cache-manager-ioredis-yet` als Store.
- **Modul:** Neues `apps/api/src/caching/` Modul (CachingModule, global).

### Redis-Layout

Drei Schlüsselarten:

```
cache:{scope}:{hid}:[{userId}:]{routeHash}    → JSON Response + Meta (TTL gesetzt)
tag:{tagName}:{hid}                           → Set<cacheKey>  (Mitgliedschaft pro Tag)
tagver:{tagName}:{hid}                        → Integer        (Version-Counter für ETag)
```

- `cache:*` enthält die serialisierte Response inkl. Status, Body und der zur Berechnung benutzten Tag-Versionen.
- `tag:*` Sets verbinden Tags mit Cache-Keys → Invalidierung iteriert Members und löscht.
- `tagver:*` Counter wird bei jeder Invalidierung inkrementiert und fließt in den ETag ein.

### Cache-Key

```
{scope}:{hid}:[{userId}:]{method}:{routePath}:sha1(sortedQueryJson)
```

`sortedQueryJson` = JSON.stringify mit deterministisch sortierten Keys, damit Reihenfolge in der URL irrelevant ist.

### Scope-Regeln

| Scope | Wann | Key enthält userId? |
|---|---|---|
| `household` | Endpoint liefert ausschließlich SHARED-Daten (Categories, Projects, SHARED-only Recurring) | Nein |
| `user` | Endpoint kann PRIVATE-Daten enthalten (Transactions, Overview, Recurring mit Visibility-Mix) | Ja |

Default bei fehlender Annotation: `user` (fail-safe — verhindert versehentliches Leaken von PRIVATE-Daten an Household-Mitglieder).

### Decorator-API

```ts
@Cacheable({
  scope: 'household' | 'user',     // default: 'user'
  tags: ['transactions', 'categories'],
  ttl: 300                          // sekunden, default 300
})
@Get()
findAll(@Ctx() ctx: RequestContext, @Query() filter: TransactionFilter) { ... }

@InvalidateTags(['transactions', 'overview', 'budgets'])
@Post()
create(@Ctx() ctx: RequestContext, @Body() dto: CreateTransactionDto) { ... }

@NoCache()
@Get('me')
me(@Ctx() ctx: RequestContext) { ... }
```

### Interceptors

**`CacheInterceptor`** (global registriert):

- Pre-Handler bei GET:
  1. `@Cacheable`-Metadaten via `Reflector` lesen. Fehlt → kein Cache, weiter.
  2. Cache-Key berechnen.
  3. Aktuellen ETag berechnen (`MGET tagver:{t1}:{hid} ... tagver:{tn}:{hid}` → `W/"sha1(versions+routeHash)"`).
  4. `If-None-Match` Header prüfen → Match → `304 Not Modified` ohne Body.
  5. `cache:{key}` `GET` → Hit + nicht abgelaufen → Response zurück (mit `ETag`-Header).
  6. Miss → Handler ausführen, Response in Redis schreiben (`SETEX`), Key zu allen Tag-Sets hinzufügen (`SADD tag:{t}:{hid} {key}`), `ETag`-Header setzen.
- Auth-Endpoints (`/auth/*`, `/api/v1/auth/me`) sind via Path-Liste in der Module-Config global vom Interceptor ausgenommen.

**`InvalidationInterceptor`** (global registriert):

- Post-Handler bei Mutations (POST/PATCH/PUT/DELETE) mit `@InvalidateTags`:
  1. Nur bei `2xx` Response.
  2. Pro Tag: `SMEMBERS tag:{t}:{hid}` → `DEL` aller Keys → `INCR tagver:{t}:{hid}` → `DEL tag:{t}:{hid}`.
  3. Response-Header `X-Invalidate-Tags: t1,t2,...` setzen (für Frontend-Invalidation).

### ETag-Logik

- Schwacher ETag (`W/`), weil semantisch (nicht byte-genau).
- Hash über: aktuelle Versions-Werte aller deklarierten Tags + Route-Hash. Reihenfolge der Tags wird vor Hashing sortiert (Determinismus).
- Bei Cache-Miss kein zusätzlicher Round-Trip nötig — Versions-Counter werden ohnehin gelesen.

### Stale & Race Conditions

- Multi-Instance: Cache + Tag-Versions liegen in Redis → automatisch geteilt. Race zwischen Schreiben (Instanz A) und Invalidieren (Instanz B): A schreibt potenziell stale Eintrag mit Version 5, B inkrementiert auf 6. Nächster Read erkennt Mismatch via ETag und ersetzt.
- Cross-User-Mutation: Tag-Set enthält Keys aller User des Haushalts → eine Mutation invalidiert alle relevanten User-Caches im selben Schritt.
- Vergessener Tag bei Mutation-Endpoint: Worst-Case Stale-Window = TTL (Default 300 s). Mitigation: Code-Review-Checkliste.

---

## Architektur — Frontend (Angular)

### Module

`packages/shared-frontend/caching/`:

- `CacheStore` — In-Memory Store (Map).
- `cache.interceptor.ts` — functional HTTP-Interceptor.
- `cache-key.ts` — Key-Berechnung (identisch zur Backend-Logik).

### CacheStore

```ts
type CacheEntry = {
  body: unknown;
  status: number;
  etag: string | null;
  expiresAt: number;     // ms epoch
};

@Injectable({ providedIn: 'root' })
export class CacheStore {
  private store = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | null;        // null wenn nicht vorhanden ODER abgelaufen-ohne-etag
  getStaleWithEtag(key: string): CacheEntry | null;
  set(key: string, entry: CacheEntry): void;
  refreshTtl(key: string, expiresAt: number): void;  // bei 304
  invalidateByTags(tags: string[]): void;
  clear(): void;                              // bei Logout
}
```

- Map ohne Eviction in V1.
- `expiresAt` aus `Cache-Control: max-age` Response-Header (Backend setzt das passend zum TTL).

### CacheInterceptor (functional)

Reihenfolge in `provideHttpClient(withInterceptors([...]))`:

```
authInterceptor → cacheInterceptor → refreshInterceptor → errorInterceptor
```

**GET:**

1. Header `X-No-Cache: 1` → skip, normaler Request.
2. Cache-Key berechnen.
3. `CacheStore.get(key)` → Live-Hit → Response synchron via `of(...)` returnen, kein Netzwerk-Request.
4. Sonst `CacheStore.getStaleWithEtag(key)` → vorhanden → Request mit `If-None-Match: <etag>` weiterreichen.
5. Response-Pfad:
   - `200` → neuen Entry schreiben (`body`, `status`, `etag` aus Response-Header, `expiresAt` aus `Cache-Control`).
   - `304` → bestehenden Entry behalten, nur `expiresAt` updaten (TTL-Reset). Ausgegebene Response = gecachter Body mit `200`-Status für den Aufrufer.

**Mutations (POST/PATCH/PUT/DELETE):**

1. Request normal durchreichen.
2. Bei `2xx` → Response-Header `X-Invalidate-Tags` lesen, kommagetrennt parsen.
3. `CacheStore.invalidateByTags(tags)`.

### ApiClient-Anpassung

- `ApiClient` setzt für Auth-Calls (`POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /api/v1/auth/me`) den Header `X-No-Cache: 1`.
- Alle anderen Calls laufen durch den Interceptor.

### Logout-Reset

`AuthStore.logout()` → `CacheStore.clear()` zwingend, sonst Daten-Leak zwischen Sessions am gleichen Browser.

### Service Worker

- `ngsw-config.json` bleibt unverändert. SW arbeitet als zweite Schicht (Offline-Fallback). RAM-Cache läuft davor.
- Bei Stale-Eintrag im RAM und Offline → ETag-Request schlägt fehl → Interceptor liefert stale Body als Fallback (Best-Effort, V1 optional). Falls nicht implementiert → SW liefert seine Cache-Variante, akzeptabel.

---

## Daten-/Kontroll-Flow

```
Browser                 Angular                  NestJS                  Redis
   │                       │                       │                       │
   │── GET /transactions ─▶│                       │                       │
   │                       │── interceptor:        │                       │
   │                       │   key+stale+etag ────▶│                       │
   │                       │                       │── tagver MGET ───────▶│
   │                       │                       │◀── versions ──────────│
   │                       │                       │── compute etag        │
   │                       │                       │── If-None-Match? Yes  │
   │                       │                       │◀── cache GET ────────▶│
   │                       │                       │── 304 (no body)       │
   │                       │◀── 304 ───────────────│                       │
   │                       │── refreshTtl, return cached body              │
   │◀── 200 (from cache) ──│                       │                       │
```

```
Browser                 Angular                  NestJS                  Redis
   │── POST /transactions ▶                       │                       │
   │                       │── pass through ─────▶│                       │
   │                       │                       │── handler executes    │
   │                       │                       │── invalidate:        ▶│
   │                       │                       │   SMEMBERS, DEL keys, │
   │                       │                       │   INCR tagver         │
   │                       │                       │── set X-Invalidate-Tags
   │                       │◀── 201 + header ──────│                       │
   │                       │── invalidateByTags(...)                       │
   │◀── 201 ───────────────│                       │                       │
```

---

## Konfiguration

### Default-TTLs

- Default `@Cacheable.ttl`: 300 s.
- Categories/Projects: 3600 s (selten geändert, Tag-Invalidierung sorgt für Frische).
- Overview: 300 s.
- Auth: nicht gecached.

### Environment

```
REDIS_URL=redis://redis:6379
CACHE_DEFAULT_TTL_SECONDS=300
CACHE_ENABLED=true                # global Kill-Switch (Tests, Debugging)
```

### Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "no", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
```

`maxmemory-policy: allkeys-lru` als Sicherheitsnetz falls Memory-Limit erreicht. Persistenz aus (Cache ist regenerierbar).

---

## Migration / Tag-Katalog

Initiale Tag-Liste pro Modul:

| Modul | Tags |
|---|---|
| Categories | `categories` |
| Projects | `projects` |
| Recurring | `recurring`, `overview` |
| Transactions | `transactions`, `overview`, `budgets` |
| Budgets | `budgets`, `overview` |
| Overview | (read-only — `transactions`, `recurring`, `budgets`, `categories`, `projects` als gelesene Tags) |

Mutation-Endpoints `@InvalidateTags` referenzieren genau die Tags die ihre Daten betreffen. Overview liest mehrere Tags → ETag wird bei Änderung jedes beteiligten Tags ungültig.

---

## Testing

### Unit

- `CacheInterceptor` (Backend) gegen Mocked Redis: Hit, Miss, Stale, ETag-Match → 304, NoCache-Skip, Tag-Set-Population.
- `InvalidationInterceptor` gegen Mocked Redis: Tag-Members gelöscht, Counter inkrementiert, Header gesetzt.
- `CacheStore` (Frontend): Map-Logik, TTL-Ablauf, Tag-Invalidierung dropped richtige Entries.
- `cacheInterceptor` (Frontend): Live-Hit kein Netzwerk-Request, Stale-Hit fügt `If-None-Match` an, 304 → cached body, 200 → Entry aktualisiert, Mutation-Header verarbeitet.

### Integration (Backend)

- Echte Redis-Test-Instanz (Container in CI).
- E2E-Sequenz: GET → Miss → Cache populated → GET → Hit. POST → Invalidate → GET → Miss + neuer ETag. Cross-Household: GET als User-A im Household-X → GET als User-B im Household-Y darf nicht denselben Eintrag treffen.
- PRIVATE-Visibility: User-A legt PRIVATE-Transaction an → User-B im selben Household sieht sie nicht im gecachten `GET /transactions` (separater `user`-Scope).

### E2E (Playwright)

- Buchung anlegen → Cashflow-Seite öffnen → Buchung sichtbar (verifiziert Frontend-Invalidation via `X-Invalidate-Tags`).
- Tab-A Buchung anlegen, Tab-B (vorher gecached) → Reload (oder Navigation) → frische Daten via ETag-Mismatch.

### Coverage-Target

Caching-Modul (Backend + Frontend): ≥ 90 % Lines (kritischer Querschnittscode).

---

## Sicherheits-Aspekte

- **Cross-Household-Leak:** Cache-Key enthält immer `householdId` → strukturell ausgeschlossen. Tests verifizieren.
- **Cross-User-PRIVATE-Leak:** `user`-Scope ist Default. Endpoints mit ausschließlich SHARED-Daten müssen explizit `scope: 'household'` setzen — Code-Review prüft.
- **Auth-Token-Caching:** Auth-Endpoints sind global ausgenommen, zusätzlich `X-No-Cache: 1` vom Frontend gesetzt.
- **Logout:** Frontend-Cache wird komplett geleert.
- **API-Keys (falls Public API noch existiert):** Werden nicht gecached (nicht in `@Cacheable`-Endpoint-Set). Wird via Path-Filter im Modul ausgeschlossen.

---

## Phasen-Einordnung

Neue **Phase 9.5** zwischen Phase 9 (Overview) und Phase 10 (API-Keys), weil:

- Phase 9 liefert den Hot Path → Caching dort am wertvollsten.
- Phase 10+ können ab dann von Caching profitieren (Decorators als Standard-Pattern).
- Vor Phase 9 bringt Caching wenig (kaum teure Reads).

---

## Definition of Done

- [ ] Redis-Container in beiden Compose-Files; Healthcheck grün.
- [ ] `CachingModule` global registriert; Decorators (`@Cacheable`, `@InvalidateTags`, `@NoCache`) verfügbar und typisiert.
- [ ] Alle bestehenden GET-Endpoints in Phasen 5–9 mit `@Cacheable` annotiert; Mutations mit `@InvalidateTags`.
- [ ] Auth-Endpoints global vom Interceptor ausgenommen.
- [ ] ETag-Roundtrip funktioniert (304 verifiziert in Integration-Test).
- [ ] Frontend `CacheStore` + `cacheInterceptor` integriert; `ApiClient` setzt `X-No-Cache` für Auth.
- [ ] `AuthStore.logout()` ruft `CacheStore.clear()`.
- [ ] Coverage Caching-Modul ≥ 90 %.
- [ ] Playwright-Test: Mutation → Invalidation in UI sichtbar.
- [ ] Cross-Household + Cross-User-PRIVATE Integration-Tests grün.
- [ ] Doku in `CLAUDE.md` ergänzt: Decorator-Pattern, Tag-Katalog, Default-TTLs.

---

## Offene Punkte

- Public-API-Entfernung läuft separat (eigene Spec). Bis dahin: Public API ungecached.
- BroadcastChannel für Multi-Tab → erst nachrüsten wenn UX-Problem messbar.
- Redis-Cluster für HA → erst bei horizontaler Skalierung relevant.

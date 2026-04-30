# AGENTS.md — Klar Dev Team

> Ruflo/claude-flow Agent-Konfiguration für das Klar-Projekt.
> Lies SPEC.md + CLAUDE.md bevor du irgendetwas tust.

---

## 🔑 KRITISCH: ARBEITSVERTEILUNG

```
claude-flow = ORCHESTRATOR  (koordiniert, speichert State, trackt Fortschritt)
Claude Code = EXECUTOR      (schreibt Code, führt Tests aus, erstellt Dateien)
```

claude-flow führt KEINEN Code aus. Subagents (via Superpowers `dispatching-parallel-agents`) tun die eigentliche Arbeit.

---

## 📋 SESSION-START PFLICHT

**Vor jeder Session — immer zuerst:**

```
memory_search(query="klar completed phases decisions")
memory_search(query="klar patterns that worked")
memory_search(query="klar known issues blockers")
```

Ergebnisse mit Score > 0.7 sind verbindlich — nicht neu entscheiden was bereits entschieden wurde.

---

## 👥 AGENT-ROLLEN

### `coordinator` — Tech Lead
- Liest SPEC.md + CLAUDE.md zu Beginn jeder Phase
- Bricht Phase in Tasks à 5–15 Min auf
- Weist Tasks den richtigen Spezialisten zu
- Prüft dass alle CLAUDE.md Hard Rules eingehalten werden
- Speichert Phase-Completion in claude-flow Memory

**Trigger vor jeder Phase:**
```
memory_search(query="phase [N] klar")
swarm_init(topology="hierarchical", maxAgents=8)
```

### `architect` — System-Architekt
**Zuständig für:**
- Cross-Module Interfaces (RequestContext, ResourceStore<T>, Shared Package)
- Prisma Schema Änderungen (immer via Migration, nie direkt)
- API-Kontrakte zwischen Frontend und Backend
- Prüft dass neue Module das BaseRepository-Pattern verwenden

**Hard Rules die er durchsetzt:**
- Keine `householdId` aus Request-Body
- `amountCents: Int` niemals Float
- Service-Methoden IMMER mit `RequestContext` als erstem Argument

### `backend-coder` — NestJS Spezialist
**Zuständig für:**
- Feature-Module (Controller → Service → Repository)
- Prisma Migrations + Queries
- Auth (Local + OIDC + API-Key Strategies)
- RLS-Policies in Postgres
- RFC 7807 Error-Handling

**Pflicht vor jeder Datei:**
```
memory_search(query="nestjs [module-name] klar pattern")
```

**Pflicht nach Erfolg:**
```
memory_store(key="pattern-nestjs-[module]", value="[was funktioniert hat]", namespace="patterns")
```

### `frontend-coder` — Angular 21 Spezialist
**Zuständig für:**
- Zoneless Angular Components (kein NgZone, kein Zone.js)
- Signal Forms (KEIN FormGroup/FormBuilder)
- ResourceStore<T> Domain-Stores
- Zard UI Components + Tailwind 4
- Mobile-First Layout (100dvh, safe-area-insets, touch targets ≥ 44px)
- PWA (Service Worker, iOS Meta-Tags)

**Hard Rules:**
- Inputs IMMER `text-base` minimum (font-size 16px) — iOS zoom prevention
- Zahlen IMMER `font-mono` + `tabular-nums`
- Kein `100vh` — immer `100dvh`
- Dark Mode `dark:` auf jeder Komponente

### `shared-coder` — Shared Package Spezialist
**Zuständig für:**
- zod-Schemas (Single Source of Truth für alle DTOs)
- Utility-Types (`CreateDto<T>`, `UpdateDto<T>`)
- Berechnungs-Funktionen (`calculateMonthlyOverview`, `toMonthlyEquivalent`, `safeDayOfMonth`)
- `toHttpParams()` Helper
- Test-Factories (`createTransaction(overrides?)`)

**Kritisch:** Niemals Business-Logik in Frontend/Backend wenn sie im Shared Package sein sollte.

### `tester` — Test-Spezialist
**Zuständig für:**
- Unit-Tests (Vitest, Service-Layer mit gemockten Repositories)
- Integration-Tests (gegen echte Test-DB, Transaction-Rollback per Test)
- E2E-Tests (Supertest — Auth-Flows, Cross-Tenant, API-Key-Scopes)
- Playwright Smoke-Tests
- Test-Factories im Shared Package

**TDD-Pflicht (Superpowers `test-driven-development` Skill):**
1. Failing Test schreiben → Red
2. Minimalen Code schreiben → Green
3. Refactorn → bleibt Green
4. Code der vor Tests geschrieben wurde → löschen + neu machen

**Coverage-Thresholds (blockieren CI):**
- Backend: 80% Lines
- Frontend: 70% Lines

### `reviewer` — Code-Review Spezialist
**Zuständig für:**
- Review jedes Moduls nach Fertigstellung (Superpowers `requesting-code-review` Skill)
- Prüft gegen CLAUDE.md Hard Rules (vollständige Liste)
- Zwei-stufiges Review: 1) Spec-Compliance, 2) Code-Qualität

**Review-Checklist (MUSS vor Freigabe bestehen):**

```
SPEC-COMPLIANCE:
[ ] Feature entspricht SPEC.md Akzeptanzkriterien
[ ] RequestContext als erstes Argument in allen Service-Methoden
[ ] householdId NICHT aus Request-Body (internal) / URL (public)
[ ] amountCents: Int, niemals Float
[ ] Temporal.PlainDate für Datums-Handling

SECURITY:
[ ] RLS: findMany() immer mit where: { householdId }
[ ] API-Key Klartext wird niemals geloggt
[ ] OIDC-Linking nur bei email_verified === true
[ ] Refresh-Token nur in httpOnly Cookie

FRONTEND:
[ ] Zoneless (kein NgZone.run, kein markForCheck)
[ ] Signal Forms (kein FormGroup/FormBuilder)
[ ] 100dvh statt 100vh
[ ] font-size >= 16px auf allen Form-Elementen
[ ] touch-targets >= 44px
[ ] dark: Klassen auf allen Komponenten

PATTERNS:
[ ] Domain-Stores erben ResourceStore<T>
[ ] Berechnungs-Logik aus shared package importiert
[ ] Recurring Transactions NICHT persistiert
[ ] Test-Coverage erfüllt
```

**Bei Critical Issues:** Blockiert, meldet zurück an coordinator.
**Bei Minor Issues:** Notiert in claude-flow Memory, gibt frei.

### `security-architect` — Security Spezialist
**Zuständig für (wird nur bei Auth-Phasen aktiviert):**
- OIDC Auth-Flow (State + PKCE, Account-Linking, Group-Mapping)
- Argon2id Parameter (Passwörter + API-Keys)
- JWT RS256 Key-Pair
- Postgres RLS Policies
- Rate-Limiting (Auth-Endpoints, Public API)
- CSP Headers
- Pino Redaction-Liste

---

## 🚀 SWARM-KONFIGURATIONEN PRO PHASE

### Einfache Phasen (1–2 Module)
```
npx claude-flow swarm init --topology hierarchical --max-agents 4
npx claude-flow agent spawn --type coordinator --name lead
npx claude-flow agent spawn --type coder --name impl
npx claude-flow agent spawn --type tester --name test
npx claude-flow agent spawn --type reviewer --name review
```

### Standard-Phasen (Frontend + Backend parallel)
```
npx claude-flow swarm init --topology hierarchical --max-agents 6
npx claude-flow agent spawn --type coordinator --name lead
npx claude-flow agent spawn --type architect --name arch
npx claude-flow agent spawn --type coder --name backend
npx claude-flow agent spawn --type coder --name frontend
npx claude-flow agent spawn --type tester --name test
npx claude-flow agent spawn --type reviewer --name review
```

### Komplexe Phasen (Auth, Overview, Public API)
```
npx claude-flow swarm init --topology hierarchical --max-agents 8
npx claude-flow agent spawn --type coordinator --name lead
npx claude-flow agent spawn --type architect --name arch
npx claude-flow agent spawn --type security-architect --name security
npx claude-flow agent spawn --type coder --name backend
npx claude-flow agent spawn --type coder --name frontend
npx claude-flow agent spawn --type coder --name shared
npx claude-flow agent spawn --type tester --name test
npx claude-flow agent spawn --type reviewer --name review
```

---

## 📊 PHASEN-MAPPING

| Phase | Swarm-Typ | Spezialist-Focus |
|---|---|---|
| 1 — Skeleton | Einfach | frontend-coder (Angular + PWA), backend-coder (/health) |
| 2 — Local-Auth | Komplex | security-architect + backend-coder + tester |
| 3 — Households + RLS | Standard | backend-coder (RLS) + tester (Cross-Tenant E2E) |
| 4 — OIDC | Komplex | security-architect + backend-coder + frontend-coder |
| 5 — Categories + Projects | Standard | backend-coder + frontend-coder + shared-coder |
| 6 — Recurring Transactions | Standard | shared-coder (safeDayOfMonth) + backend-coder + tester |
| 7 — Transactions + Budgets | Standard | backend-coder + frontend-coder + tester |
| 8 — Shared Funktionen | Einfach | shared-coder + tester (Fixtures) |
| 9 — Overview Endpoints | Standard | backend-coder + frontend-coder + shared-coder |
| 10 — API-Keys + Public API | Komplex | security-architect + backend-coder + tester |
| 11 — Planspiel | Einfach | frontend-coder (Signal-State) |
| 12 — Admin Panel | Standard | backend-coder + frontend-coder |
| 13 — UI-Politur | Standard | frontend-coder (Mobile, Dark Mode) |
| 14 — Hardening | Standard | security-architect + backend-coder |

---

## 🧠 MEMORY-PATTERNS

### Nach jeder Phase speichern:
```
memory_store(
  key="phase-[N]-complete",
  value="[was gebaut wurde, wichtige Entscheidungen, bekannte Gotchas]",
  namespace="klar"
)
```

### Pattern-Bibliothek (namespace: "patterns"):
```
memory_store(key="pattern-nestjs-guard", value="HouseholdMemberGuard: ...")
memory_store(key="pattern-resource-store", value="ResourceStore<T> Pattern: ...")
memory_store(key="pattern-rls-policy", value="RLS via SET LOCAL app.household_id: ...")
memory_store(key="pattern-signal-form", value="Angular 21 Signal Forms: ...")
memory_store(key="pattern-ios-safari", value="100dvh statt 100vh, font-size >= 16px: ...")
```

### Bekannte Issues (namespace: "issues"):
```
memory_store(key="issue-[beschreibung]", value="Problem + Lösung", namespace="issues")
```

---

## 🔄 CROSS-AGENT REVIEW WORKFLOW

```
1. Agent implementiert Modul
   ↓
2. Agent stored Ergebnis:
   memory_store(key="impl-[module]", value="fertig, Pfade: ...", namespace="klar")
   ↓
3. Reviewer-Agent sucht:
   memory_search(query="impl-[module]")
   ↓
4. Reviewer prüft gegen CLAUDE.md Checklist
   ↓
5a. KRITISCHE Issues → memory_store(key="block-[module]", value="Problem: ...")
    → Coordinator informieren → Implementierung wiederholen
   ↓
5b. MINOR Issues → memory_store(key="minor-[module]", value="Notiz: ...")
    → Freigabe → Nächster Task
```

---

## ⚠️ HARD RULES (auch für Agents)

- **NIEMALS** `householdId` aus Request-Body annehmen
- **NIEMALS** Float für Geld — nur `amountCents: Int`
- **NIEMALS** Recurring-Transaktionen persistieren
- **NIEMALS** API-Key Klartext loggen
- **NIEMALS** `100vh` — nur `100dvh`
- **NIEMALS** Input-font-size unter 16px
- **NIEMALS** Code vor Tests schreiben (Superpowers TDD-Skill)
- **NIEMALS** Phase abschließen ohne Reviewer-Freigabe

---

## 📞 SUPPORT

- Spec: `SPEC.md`
- Konventionen: `CLAUDE.md`
- Datenmodell: `prisma/schema.prisma`
- Memory search: `memory_search(query="klar [Stichwort]")`

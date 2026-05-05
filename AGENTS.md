# AGENTS.md — Klar Dev Team

> Ruflo Agent-Konfiguration für das Klar-Projekt.
> Lies SPEC.md + CLAUDE.md bevor du irgendetwas tust.

---

## 🔑 KRITISCH: ARBEITSVERTEILUNG

```
Claude (Hauptcontext) = ORCHESTRATOR  (koordiniert, speichert State, trackt Fortschritt)
Ruflo Swarm Agents    = EXECUTORS     (schreiben Code, führen Tests aus, erstellen Dateien)
```

Hauptcontext führt KEINEN Code aus. Ruflo Swarm Agents tun die eigentliche Arbeit.

---

## 📋 SESSION-START PFLICHT

**Vor jeder Session — immer zuerst:**

```bash
git status && git branch --show-current
memory_search(query="klar completed phases decisions")
memory_search(query="klar patterns that worked")
memory_search(query="klar known issues blockers")
```

Ergebnisse mit Score > 0.7 sind verbindlich — nicht neu entscheiden was bereits entschieden wurde.

---

## 🤖 RUFLO SWARM SETUP

### Installation (einmalig)

```bash
/plugin install ruflo-core@ruflo
/plugin install ruflo-swarm@ruflo
/plugin install ruflo-ruvllm@ruflo
/plugin install ruflo-agentdb@ruflo
```

### Swarm-Konfiguration (.claude/ruflo.config.json)

```json
{
  "swarm": {
    "defaultTopology": "hierarchical",
    "maxAgents": 8,
    "memoryNamespace": "klar-app"
  },
  "modelRouting": {
    "coordinator": "claude-sonnet-4-6",
    "architect": "claude-opus-4-6",
    "coder": "claude-sonnet-4-6",
    "tester": "claude-haiku-4-5",
    "reviewer": "claude-sonnet-4-6",
    "security-architect": "claude-opus-4-6"
  },
  "autoRoute": true
}
```

---

## 👥 AGENT-ROLLEN & MODEL ASSIGNMENTS

### `coordinator` — Tech Lead
**Model:** Sonnet 4.6 (Koordination braucht kein Opus)

**Zuständig für:**
- Liest SPEC.md + CLAUDE.md zu Beginn jeder Phase
- Bricht Phase in Tasks à 5–15 Min auf
- Weist Tasks den richtigen Spezialisten zu via `agent_spawn`
- Prüft dass alle CLAUDE.md Hard Rules eingehalten werden
- Speichert Phase-Completion in AgentDB Memory

**Workflow:**
```bash
# Phase-Start
memory_search(query="phase [N] klar")
swarm_init(topology="hierarchical", maxAgents=8)
agent_spawn(role="architect", model="opus")
agent_spawn(role="backend-coder", model="sonnet")
agent_spawn(role="frontend-coder", model="sonnet")
agent_spawn(role="tester", model="haiku")
agent_spawn(role="reviewer", model="sonnet")
```

### `architect` — System-Architekt
**Model:** Opus 4.6 (komplexe Architektur-Entscheidungen)

**Zuständig für:**
- Cross-Module Interfaces (RequestContext, ResourceStore<T>, Shared Package)
- Prisma Schema Änderungen (immer via Migration, nie direkt)
- API-Kontrakte zwischen Frontend und Backend
- Prüft dass neue Module das BaseRepository-Pattern verwenden

**Hard Rules die er durchsetzt:**
- Keine `householdId` aus Request-Body
- `amountCents: Int` niemals Float
- Service-Methoden IMMER mit `RequestContext` als erstem Argument

**Memory Pattern:**
```bash
memory_store(key="architecture-[decision]", value="[Entscheidung + Begründung]", namespace="klar-app")
```

### `backend-coder` — NestJS Spezialist
**Model:** Sonnet 4.6 (Standard-Implementierung)

**Zuständig für:**
- Feature-Module (Controller → Service → Repository)
- Prisma Migrations + Queries
- Auth (Local + OIDC + API-Key Strategies)
- RLS-Policies in Postgres
- RFC 7807 Error-Handling

**Pflicht vor jeder Datei:**
```bash
memory_search(query="nestjs [module-name] klar pattern")
```

**Pflicht nach Erfolg:**
```bash
memory_store(key="pattern-nestjs-[module]", value="[was funktioniert hat]", namespace="patterns")
```

**Model-Override für komplexe Module:**
- Simple CRUD: Haiku (`agent_spawn(role="backend-coder", model="haiku")`)
- Standard Features: Sonnet (default)
- Komplexe Auth/RLS: Opus (`agent_spawn(role="backend-coder", model="opus")`)

### `frontend-coder` — Angular 21 Spezialist
**Model:** Sonnet 4.6 (UI-Logik + State Management)

**Zuständig für:**
- Zoneless Angular Components (kein NgZone, kein Zone.js)
- Signal Forms (KEIN FormGroup/FormBuilder)
- ResourceStore<T> Domain-Stores
- Spartan UI → klar-* Components
- Mobile-First Layout (100dvh, safe-area-insets, touch targets ≥ 44px)
- PWA (Service Worker, iOS Meta-Tags)

**Hard Rules:**
- Inputs IMMER `text-base` minimum (font-size 16px) — iOS zoom prevention
- Zahlen IMMER `font-mono` + `tabular-nums`
- Kein `100vh` — immer `100dvh`
- Dark Mode `dark:` auf jeder Komponente
- **NIEMALS** `hlm-*` direkt in Features — nur `klar-*`

**Model-Override:**
- Simple Komponenten (nur Template): Haiku
- Standard Features: Sonnet (default)
- Komplexe State-Management: Opus

### `shared-coder` — Shared Package Spezialist
**Model:** Sonnet 4.6 (Business-Logik + Validierung)

**Zuständig für:**
- zod-Schemas (Single Source of Truth für alle DTOs)
- Utility-Types (`CreateDto<T>`, `UpdateDto<T>`)
- Berechnungs-Funktionen (`calculateMonthlyOverview`, `toMonthlyEquivalent`, `safeDayOfMonth`)
- `toHttpParams()` Helper
- Test-Factories (`createTransaction(overrides?)`)

**Kritisch:** Niemals Business-Logik in Frontend/Backend wenn sie im Shared Package sein sollte.

### `tester` — Test-Spezialist
**Model:** Haiku 4.5 (Tests brauchen kein Opus, 10x günstiger)

**Zuständig für:**
- Unit-Tests (Vitest, Service-Layer mit gemockten Repositories)
- Integration-Tests (gegen echte Test-DB, Transaction-Rollback per Test)
- E2E-Tests (Supertest — Auth-Flows, Cross-Tenant, API-Key-Scopes)
- Playwright Smoke-Tests
- Test-Factories im Shared Package

**TDD-Workflow (Skill: test-driven-development):**
1. Failing Test schreiben → Red
2. Minimalen Code schreiben → Green
3. Refactorn → bleibt Green
4. Code der vor Tests geschrieben wurde → löschen + neu machen

**Coverage-Thresholds (blockieren CI):**
- Backend: 80% Lines
- Frontend: 70% Lines

**Model-Override:**
- Standard Unit/Integration: Haiku (default)
- Komplexe E2E-Szenarien: Sonnet

### `reviewer` — Code-Review Spezialist
**Model:** Sonnet 4.6 (Review-Logik)

**Zuständig für:**
- Review jedes Moduls nach Fertigstellung (Skill: requesting-code-review)
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
[ ] hlm-* nur in klar-* Komponenten, nie direkt in Features

PATTERNS:
[ ] Domain-Stores erben ResourceStore<T>
[ ] Berechnungs-Logik aus shared package importiert
[ ] Recurring Transactions NICHT persistiert
[ ] Test-Coverage erfüllt
```

**Bei Critical Issues:** Blockiert, meldet zurück an coordinator via `memory_store`.
**Bei Minor Issues:** Notiert in AgentDB, gibt frei.

### `security-architect` — Security Spezialist
**Model:** Opus 4.6 (Security braucht beste Analyse)

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

### Einfache Phasen (1–2 Module, < 500 LOC)
**Agents:** 4 · **Queen Model:** Sonnet

```bash
swarm_init(topology="hierarchical", maxAgents=4)
agent_spawn(role="coordinator", model="sonnet")
agent_spawn(role="coder", model="sonnet")  # Backend ODER Frontend
agent_spawn(role="tester", model="haiku")
agent_spawn(role="reviewer", model="sonnet")
```

**Beispiel-Phasen:** 1 (Skeleton), 8 (Shared Functions), 11 (Planspiel)

### Standard-Phasen (Frontend + Backend parallel, 500-2000 LOC)
**Agents:** 6 · **Queen Model:** Sonnet

```bash
swarm_init(topology="hierarchical", maxAgents=6)
agent_spawn(role="coordinator", model="sonnet")
agent_spawn(role="architect", model="opus")
agent_spawn(role="backend-coder", model="sonnet")
agent_spawn(role="frontend-coder", model="sonnet")
agent_spawn(role="tester", model="haiku")
agent_spawn(role="reviewer", model="sonnet")
```

**Beispiel-Phasen:** 3 (Households), 5 (Categories), 6 (Recurring), 7 (Transactions), 9 (Overview), 12 (Admin), 13 (UI-Politur)

### Komplexe Phasen (Auth, Security, Public API, > 2000 LOC)
**Agents:** 8 · **Queen Model:** Sonnet

```bash
swarm_init(topology="hierarchical", maxAgents=8)
agent_spawn(role="coordinator", model="sonnet")
agent_spawn(role="architect", model="opus")
agent_spawn(role="security-architect", model="opus")
agent_spawn(role="backend-coder", model="sonnet")
agent_spawn(role="frontend-coder", model="sonnet")
agent_spawn(role="shared-coder", model="sonnet")
agent_spawn(role="tester", model="haiku")
agent_spawn(role="reviewer", model="sonnet")
```

**Beispiel-Phasen:** 2 (Local Auth), 4 (OIDC), 10 (API-Keys), 14 (Hardening)

---

## 📊 PHASEN-MAPPING MIT MODEL ALLOCATION

| Phase | Swarm | Agents | Opus-Count | Sonnet-Count | Haiku-Count | Geschätzte Tokens |
|---|---|---|---|---|---|---|
| 1 — Skeleton | Einfach | 4 | 0 | 3 | 1 | ~15K |
| 2 — Local-Auth | Komplex | 8 | 2 | 5 | 1 | ~45K |
| 3 — Households + RLS | Standard | 6 | 1 | 4 | 1 | ~25K |
| 4 — OIDC | Komplex | 8 | 2 | 5 | 1 | ~50K |
| 5 — Categories + Projects | Standard | 6 | 1 | 4 | 1 | ~30K |
| 6 — Recurring Transactions | Standard | 6 | 1 | 4 | 1 | ~25K |
| 7 — Transactions + Budgets | Standard | 6 | 1 | 4 | 1 | ~35K |
| 8 — Shared Funktionen | Einfach | 4 | 0 | 3 | 1 | ~12K |
| 9 — Overview Endpoints | Standard | 6 | 1 | 4 | 1 | ~30K |
| 10 — API-Keys + Public API | Komplex | 8 | 2 | 5 | 1 | ~40K |
| 11 — Planspiel | Einfach | 4 | 0 | 3 | 1 | ~10K |
| 12 — Admin Panel | Standard | 6 | 1 | 4 | 1 | ~25K |
| 13 — UI-Politur | Standard | 6 | 0 | 5 | 1 | ~20K |
| 14 — Hardening | Standard | 6 | 1 | 4 | 1 | ~30K |

**Gesamt:** ~392K Tokens (vs. ~600K ohne Model Selection = **35% Einsparung**)

---

## 🧠 MEMORY-PATTERNS

### Nach jeder Phase speichern:
```bash
memory_store(
  key="phase-[N]-complete",
  value="[was gebaut wurde, wichtige Entscheidungen, bekannte Gotchas]",
  namespace="klar-app"
)
```

### Pattern-Bibliothek (namespace: "patterns"):
```bash
memory_store(key="pattern-nestjs-guard", value="HouseholdMemberGuard: ...", namespace="patterns")
memory_store(key="pattern-resource-store", value="ResourceStore<T> Pattern: ...", namespace="patterns")
memory_store(key="pattern-rls-policy", value="RLS via SET LOCAL app.household_id: ...", namespace="patterns")
memory_store(key="pattern-signal-form", value="Angular 21 Signal Forms: ...", namespace="patterns")
memory_store(key="pattern-ios-safari", value="100dvh statt 100vh, font-size >= 16px: ...", namespace="patterns")
memory_store(key="pattern-klar-components", value="Spartan UI → hlm-* → klar-* Pipeline: ...", namespace="patterns")
```

### Bekannte Issues (namespace: "issues"):
```bash
memory_store(key="issue-[beschreibung]", value="Problem + Lösung", namespace="issues")
```

### Agent-Ergebnisse (namespace: "klar-app"):
```bash
memory_store(key="impl-[module]-[agent]", value="fertig, Pfade: [files], Tests: grün", namespace="klar-app")
```

---

## 🔄 CROSS-AGENT REVIEW WORKFLOW

```
1. Agent implementiert Modul
   ↓
2. Agent stored Ergebnis:
   memory_store(key="impl-[module]", value="fertig, Pfade: ...", namespace="klar-app")
   ↓
3. Reviewer-Agent sucht:
   memory_search(query="impl-[module] klar-app")
   ↓
4. Reviewer prüft gegen CLAUDE.md Checklist
   ↓
5a. KRITISCHE Issues → memory_store(key="block-[module]", value="Problem: ...", namespace="klar-app")
    → Coordinator informieren → Implementierung wiederholen
   ↓
5b. MINOR Issues → memory_store(key="minor-[module]", value="Notiz: ...", namespace="klar-app")
    → Freigabe → Nächster Task
   ↓
6. Coordinator markiert Phase als complete:
   memory_store(key="phase-[N]-complete", value="[Summary]", namespace="klar-app")
```

---

## ⚡ RUFLO SWARM COMMANDS REFERENCE

### Swarm Lifecycle

```bash
# Swarm starten
swarm_init(topology="hierarchical", maxAgents=6)

# Agent spawnen (Model wird automatisch aus Config gewählt)
agent_spawn(role="backend-coder", model="sonnet")

# Agent mit Override spawnen (z.B. Auth → Opus statt Sonnet)
agent_spawn(role="backend-coder", model="opus")

# Swarm-Status prüfen
swarm_status()

# Swarm beenden
swarm_shutdown()
```

### Memory Operations

```bash
# Suchen
memory_search(query="klar patterns", namespace="patterns")

# Speichern
memory_store(key="phase-5-complete", value="Categories + Projects done", namespace="klar-app")

# Task-Routing (automatisch via Hooks)
hooks_route(taskType="frontend", module="categories")
```

---

## ⚠️ HARD RULES (auch für Agents)

- **NIEMALS** `householdId` aus Request-Body annehmen
- **NIEMALS** Float für Geld — nur `amountCents: Int`
- **NIEMALS** Recurring-Transaktionen persistieren
- **NIEMALS** API-Key Klartext loggen
- **NIEMALS** `100vh` — nur `100dvh`
- **NIEMALS** Input-font-size unter 16px
- **NIEMALS** Code vor Tests schreiben (TDD-Skill aktiv)
- **NIEMALS** Phase abschließen ohne Reviewer-Freigabe
- **NIEMALS** `hlm-*` direkt in Feature-Komponenten — nur über `klar-*`
- **NIEMALS** Zone.js-Patterns in Angular 21
- **NIEMALS** Opus für simple Tasks (Haiku/Sonnet reichen)

---

## 📈 TOKEN-EFFIZIENZ MONITORING

### Pro Phase tracken:

```bash
# Nach Phase-Ende
swarm_status()  # zeigt Token-Verbrauch pro Agent + Model
memory_store(
  key="phase-[N]-metrics",
  value="Agents: [count], Tokens: [total], Models: [Haiku: X, Sonnet: Y, Opus: Z]",
  namespace="klar-app"
)
```

### Optimierungs-Ziele:

- **Einfache Phasen:** < 20K Tokens
- **Standard-Phasen:** < 35K Tokens
- **Komplexe Phasen:** < 55K Tokens

**Wenn über Target:** Mehr Haiku-Agents einsetzen, Opus nur für echte Architektur-Entscheidungen.

---

## 📞 SUPPORT

- Spec: `SPEC.md`
- Konventionen: `CLAUDE.md`
- Datenmodell: `prisma/schema.prisma`
- Memory search: `memory_search(query="klar [Stichwort]", namespace="klar-app")`
- Swarm Status: `swarm_status()`
- Ruflo Docs: `https://github.com/ruvnet/ruflo`
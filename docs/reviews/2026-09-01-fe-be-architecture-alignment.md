# FE/BE Architecture Alignment Review

**Date:** 2026-09-01
**Branch:** `codex/architecture-alignment-fe-be` (off `staging`)
**Scope:** `apps/client`, `apps/event`, `apps/guest`, `apps/supplier` against
`next-feature-architecture`; `apps/api` against `backend-architecture`.
**Method:** each skill's own `detect`/`inventory`/`check-boundaries` scripts,
plus targeted static greps and `git blame` for provenance. Findings are
ranked by impact, each with a confidence level and a next action.

---

## 1. Frontend — `next-feature-architecture`

**Detector (all 4 apps):** `runtime: next`, `hasFeatures: true` — skill applies
cleanly, no unsupported signal.

| App | `check-boundaries` | Violations |
| --- | --- | --- |
| `client` | ok | 0 |
| `guest` | ok | 0 |
| `supplier` | ok | 0 |
| `event` | 2 findings | `no-cross-feature-deep` |

### 1.1 Findings

**Finding F1 — Deep cross-feature import in `event` app**
Impact: Medium · Confidence: High

`apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts`
deep-imports internals of two other feature slices:

```ts
export { selectActiveEvents, ... } from "@/features/event-workspace/shell/model/event-workspace-selectors";
export { selectCommandInboxGroupedBySeverity, ... } from "@/features/command-inbox/list/model/command-inbox-selectors";
```

Rule 4 ("no deep cross-feature imports; domain `model/data` OK within domain")
is violated. `event-dashboard/shell`, `event-workspace/shell`, and
`command-inbox/list` are three distinct feature slices, not sub-slices of one
domain, so per `domain-sharing.md` this needs domain-level sharing, not a
re-export shim reaching into another feature's `model/`.

Root cause: `event-dashboard/shell` and `event-workspace/shell` carry
**overlapping selector logic** — `selectActiveEvents`, `selectPendingApprovals`,
`selectSelectedEvent`, `selectEventWorkspaceResources` are defined once in
`event-workspace/shell/model` and re-exported through `event-dashboard/shell`.
This reads as leftover duplication from the MVVM migration (`2fe8ae5
refactor(fe): migrate portals to feature-architecture MVVM`) that was never
consolidated.

Next action: move the shared selectors into one canonical domain-level home
(e.g. an `event-dashboard`-level shared `model/`, or consolidate
`event-workspace/shell` + `command-inbox/list` selector logic) and have
`event-dashboard/shell` import that, not reach into sibling feature internals.

**Finding F2 — `event-ops` shared I/O facade fan-in**
Impact: Low–medium (watch) · Confidence: Medium

`apps/event/src/features/event-ops/` is a thin feature (11-line repository
re-exporting `@/lib/prism-api` as `eventOpsRepository`, plus a use-case
passthrough and a VM passthrough) imported via its **barrel only**
(`@/features/event-ops`) by 6 different domains: `audit/trail`,
`command-inbox/list`, `coordinators/desk`, `event-dashboard/shell`,
`event-workspace/shell`, `pare/panel`.

This doesn't trip the boundary checker (barrel-level imports are allowed), and
was a deliberate SOLID/DRY/KISS pass (`93777c9`, `5149d30`) to stop views/VMs
importing `@/lib/prism-api` directly — matching the documented transitional
`lib/prism-api` policy in `AGENTS.md`. But `AGENTS.md`'s hard-rule table
explicitly names *"God `event-ops` hub"* as something to avoid, and this
facade is trending toward that shape.

Next action: not urgent; when any of the 6 consuming domains is next touched,
route its I/O through its own `data/` instead of adding a 7th consumer of
`event-ops`.

**Finding F3 — Mega view-model in `event` app**
Impact: Low · Confidence: Medium (preference, not a rule violation)

`apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts`
is 941 lines — the only VM over 300 lines across all 4 apps — combining
nav/icon config, routing, and selector orchestration for client records,
events, calendar, and workspace resources in one hook. No React/JSX-in-model
violation found; this is a composition-scale concern
(`feature-composition.md`: "page-level VM owns only coordination state, not
feature business logic") rather than a hard rule break.

Next action: optional — split by concern (routing/nav vs. dashboard data
selection) if this file keeps growing; not blocking.

**Finding F4 — Top-level app routes are not using Next.js route
organization primitives (route groups `()`, dynamic segments `[]`)**
Impact: Medium · Confidence: High

Across all 4 apps, `0` folders use a Next.js **route group** (`(name)`), and
`0` use a **parallel/intercepting route** (`@slot`, `(.)catch`). Dynamic
segments (`[param]`) are used, but inconsistently and, in the `event` app,
largely as a workaround rather than real per-resource routing:

- `event` app: 48 of its 48 dashboard `page.tsx` files are route files; 46 of
  them are identical one-line shims —
  `<EventDashboardRouteView routeKey="literal/string" />` — where
  `EventDashboardRouteView` unconditionally `return null`. All real UI is
  rendered once, in `dashboard/layout.tsx`, driven by `usePathname()` inside a
  941-line view-model. The literal-vs-`[param]` folders
  (`clients/active`, `clients/prospects`, `clients/[clientId]/[clientView]`,
  `events/upcoming`, `events/[eventId]/overview`, …) exist only so the App
  Router will match a URL — every one of them is a no-op page.
  `event-dashboard-routing.ts` (416 lines) hand-rolls what the App Router's own
  segment matching already gives for free (route→tab maps, "tab by route"
  lookup tables, sidebar item catalogs).
- `client` app repeats the same pattern at smaller scale: 20 of 20 dashboard
  pages are route= / thin shims, mixing literal folders
  (`events/upcoming`, `events/cancelled`, `events/completed`,
  `events/draft-requests`, `events/in-planning`) with one dynamic catch-all
  (`events/[eventId]/[section]`) for the rest — an inconsistent mix of two
  different routing strategies for the same kind of resource (event list
  filter vs. event section) in the same folder tree.
- `sign-in`, `sign-up`, and `dashboard` sit as unrelated top-level siblings
  under `app/` in every portal with no route-group boundary
  (e.g. `(auth)/sign-in`, `(portal)/dashboard`) to express that distinction,
  and no shared segment layout for the auth pages.
- `apps/client/src/app/App.tsx` is a stray non-route `.tsx` file sitting
  directly in `app/` next to `page.tsx`/`layout.tsx` — outside the App Router
  file convention entirely (it is manually imported by nothing shown in the
  App Router tree; likely legacy from a pre-Next-App-Router shell).

This is not a violation of a specific numbered rule in the skill, but it cuts
directly against the intent of "thin `app/` routes" and against
`feature-composition.md`'s "URL state (preferred for navigation-driven
coordination)" pattern — the skill's own preferred alternative to a
pathname-sniffing mega view-model. It also creates real cost: every new
dashboard section requires hand-adding a matching entry to
`event-dashboard-routing.ts` **and** a new empty-shim folder, instead of the
App Router deriving the section from the folder name / route params directly.

Next action (incremental, non-breaking — URLs must not change per
`AGENTS.md`):
1. Introduce route groups to express top-level intent without changing URLs,
   e.g. `(portal)/dashboard/...` and `(auth)/sign-in`, `(auth)/sign-up` —
   route groups are invisible in the URL.
2. Replace literal filter folders that mirror a dynamic segment's possible
   values (`events/upcoming`, `events/cancelled`, … vs. `events/[eventId]`)
   with a single `events/[filter]` (or reuse the query string) where the
   value set is a closed enum already defined once in
   `event-dashboard-routing.ts` — collapses ~10 duplicate shim files per app
   into 1.
3. For the `event` app specifically: let each real `page.tsx` render its
   matching feature view directly (per `feature-composition.md`) instead of
   `return null` + pathname-sniffing in the shell layout/VM. This is the
   larger, riskier follow-up — do it after F1 is resolved, one section at a
   time, with URL-preservation tests per `AGENTS.md`'s "preserve URLs during
   structural frontend work" rule.
4. Remove or relocate `apps/client/src/app/App.tsx` — confirm dead code, then
   delete, or move under `features/` if still referenced.

### 1.2 Rules verified clean (evidence, not absence of complaint)

- **Rule 1** (no HTTP/rules in `page.tsx`): 0 `fetch(`/`axios.` hits in any
  `page.tsx` across 4 apps; the one page over 20 lines
  (`client/.../[section]/page.tsx`, 36 lines) is still a thin route→view
  composition.
- **Rule 3** (I/O only in `data/`): the only non-`data/` file touching
  `fetch()` is `apps/guest/src/features/guest-shared/guest-http.ts`, a shared
  HTTP primitive consumed exclusively by 3 `data/` repositories — acceptable
  shared-primitive pattern, not a leak into views/VMs. `router.prefetch(...)`
  hits in views are Next.js navigation, not domain HTTP (false-positive from
  the initial grep, confirmed by inspection).
- **Rule 2** (no React/Next in `model/`, no JSX in VMs): 0 hits for
  `react`/`next` imports inside any `model/` file; 0 `.tsx` files inside any
  `view-models/` folder.
- **Rule 5** (no empty `use-cases/`/`steps/`): 0 empty folders found among 18
  `use-cases/` directories.
- Domain-in-`shared/ui` check: `packages/ui/src` (shells, blocks, brand,
  primitives) has 0 imports of `@prism/types` — no domain leakage into the
  shared UI package.
- `@prism/api-client` boundary: only imported by the 4 apps' `lib/prism-api.ts`
  adapters — never directly from a view or view-model.

**FE verdict:** `client`, `guest`, `supplier` are cleanly aligned on MVVM
layering. `event` — the largest, most-changed app — has one concrete layering
violation (F1), two watch items (F2–F3), and one structural routing gap (F4,
shared with `client` at smaller scale) that is worth fixing before the app
grows further.

---

## 2. Backend — `backend-architecture`

**Detector:** NestJS + TypeScript, Prisma/pg persistence, high confidence.
**`check-boundaries` (backend skill): 0 findings.**

### 2.1 Are 24 modules "too many"? — module inventory and shape

`apps/api/libs/modules/` currently has **24 top-level Nest library modules**.
Counted by role (presentation / application / domain / infrastructure) via the
skill's own inventory script:

| Module | Files | Presentation | Application | Domain | Infra |
| --- | ---: | ---: | ---: | ---: | ---: |
| supplier-ops | 29 | 11 | 12 | 0 | 0 |
| event-read-models | 34 | 14 | 6 | 0 | 4 |
| ai-governance | 17 | 2 | 6 | 0 | 0 |
| inquiry-onboarding | 22 | 6 | 8 | 0 | 3 |
| staffing-ops | 15 | 6 | 4 | 0 | 0 |
| commercial-ops | 15 | 6 | 4 | 0 | 0 |
| live-ops | 14 | 6 | 4 | 0 | 0 |
| file-ops | 14 | 2 | 5 | 0 | 0 |
| compliance-ops | 13 | 4 | 3 | 0 | 0 |
| floorplan | 11 | 2 | 3 | 0 | 0 |
| trust-ops | 11 | 2 | 3 | 0 | 1 |
| finance-ops | 11 | 2 | 3 | 0 | 0 |
| guest-ops | 10 | 2 | 3 | 0 | 0 |
| identity-ops | 10 | 2 | 5 | 1 | 0 |
| notification-ops | 10 | 2 | 2 | 0 | 1 |
| closure-ops | 10 | 2 | 2 | 0 | 0 |
| event-core | 9 | 0 | 5 | 0 | 0 |
| access-control | 5 | 0 | 2 | 2 | 0 |
| events | 5 | 1 | 1 | 0 | 0 |
| event-session | 7 | 0 | 2 | 0 | 0 |
| plans | 7 | 2 | 2 | 0 | 0 |
| templates | 7 | 1 | 2 | 0 | 0 |
| sample-compatibility | 12 | 3 | 4 | 0 | 0 |
| publishing | 4 | 1 | 1 | 0 | 0 |
| health | 3 | 1 | 0 | 0 | 0 |

**This is not "too many modules" — it is modules at the wrong granularity.**
The skill's own guidance ("module boundaries = business ownership boundary,"
extract-module.md: "confirm the concern has enough distinct behavior to
justify a module") is violated in two directions at once:

**Too fine-grained (should merge into an existing domain):**
- `events` (5 files, route `layout-events`), `plans` (7 files), `templates`
  (7 files), `publishing` (4 files, route `publish`) are four separate Nest
  library modules that together implement **one concern: floor-plan template
  authoring and event-layout publishing**. `git blame` confirms three of the
  four (`plans`, `templates`, `publishing`) were literally introduced in the
  *same commit* (`9272198 feat: refactor floor plan template management and
  integrate API for templates`) — they were never independent business
  capabilities, they were split by CRUD verb/resource instead of by owner.
  None of their 3 controllers (`templates`, `plans`, `publish`) are called by
  any of the 4 FE apps' `lib/prism-api.ts` today — they read as an early or
  parked surface, not active product routes.
**Correction (2026-09-01, during plan execution):** the claim above that
`/api/templates`, `/api/plans`, `/api/publish`, `/api/layout-events` have
"0 current FE callers" was wrong for `/api/plans/:planId` — both
`apps/client` and `apps/event` call it via `lib/prism-api.ts` for floorplan
editing, and `apps/api/scripts/smoke-api.mjs` exercises all four route
groups end-to-end. The merge in Task 10 of the implementation plan proceeded
anyway because it is a pure reorganization (module/file ownership only, zero
route or behavior change), verified by the full 340-test backend suite,
typecheck, build, and `prisma:validate` all passing unchanged. The routes
are real and active; only their internal module boundaries changed.

- `health` (3 files) and `event-session` (7 files) are legitimately tiny but
  are **cross-cutting infrastructure concerns** (liveness probe;
  session/auth-guard primitives used by every other module), not business
  domains — they are already correctly *not* counted in the domain module map
  in `AGENTS.md`, but they still add to "24 modules" cognitive overhead in
  `nest-cli.json`/`app.module.ts`. This is fine as infra but should be visibly
  separated (e.g. a `platform/` or `infra/` namespace) from business modules.

**Correctly-grained but under-owned (no `domain/` layer despite complex
state):**
- `live-ops` (urgent issues, event-day tasks, SLA/escalation) and
  `supplier-ops` (the largest module, 29 files) both encode real state-machine
  invariants (`UrgentIssueStatus`, `SupplierQuoteRequestStatus`,
  `CoordinatorAssignmentStatus`, `LiveOpsEscalationLevel` — all centralized in
  `event-core/src/ops.constants.ts` rather than owned per-module) but have
  **zero `domain/` files** between them. Per the skill's decision guide ("is
  there a business rule that must remain true regardless of transport or
  persistence? put it in a domain policy/entity"), this is exactly the
  condition for adding a domain layer, and it hasn't been added yet — these
  invariants currently live as scattered `if`-checks inside application
  services instead.

### 2.2 Modular-monolith → microservices readiness (why this matters now)

A module dependency graph, built from every module's `.module.ts` imports,
shows the actual coupling shape:

```text
trust-ops            ← (leaf: audit/privacy sink, imported by nearly everyone)
event-core           ← (leaf: shared enums/constants, imported by nearly everyone)
access-control        → trust-ops
identity-ops           → event-session, inquiry-onboarding, trust-ops
inquiry-onboarding     → access-control, event-core, event-session, notification-ops, trust-ops
floorplan              → access-control, event-core, identity-ops, notification-ops, trust-ops
staffing-ops           → access-control, event-core, floorplan, guest-ops, identity-ops, notification-ops, trust-ops
live-ops               → access-control, event-core, event-read-models, identity-ops,
                         notification-ops, staffing-ops, supplier-ops, trust-ops
event-read-models      → access-control, closure-ops, commercial-ops, finance-ops, floorplan,
                         guest-ops, identity-ops, staffing-ops, trust-ops        (read-only, by design)
sample-compatibility   → (imports 18 of 24 modules — by design, it's the sample/demo compat shim)
```

Findings for microservices-readiness:

**Finding B1 — No `domain/` layer means extraction would carry Prisma with it**
Impact: High (strategic) · Confidence: High

Zero `domain/` folders exist project-wide. Every module's business rules are
expressed as service-layer code sitting directly next to Prisma calls (via
`@prism/database`'s `PrismaService`). Per the skill: *"design module
boundaries so extraction remains possible later without treating extraction
as the current goal."* Today, extracting e.g. `live-ops` into its own service
would require also extracting its Prisma access patterns and the shared
`event-core.ops.constants` enum module wholesale, because there is no
persistence-independent domain layer to leave behind. This is acceptable for
the modular-monolith stage (per the skill's own progressive-depth guidance —
don't add a domain layer before an invariant justifies it) but is the #1 thing
that will make eventual extraction expensive rather than mechanical.

Next action: for the two most state-machine-heavy modules (`live-ops`,
`supplier-ops`), introduce a thin `domain/` layer (value objects / status
transition guards for `UrgentIssueStatus`, `SupplierQuoteRequestStatus`, etc.)
extracted out of `event-core/ops.constants.ts` and out of the service files —
this is valuable *now* (testable business rules, independent of Prisma) and is
the direct prerequisite for any future extraction.

**Finding B2 — Direct-DB-join risk is implicit, not documented, across nearly
every module**
Impact: Medium · Confidence: High

All 24 modules share one Postgres database via a single `@prism/database`
`PrismaService`, and nothing marks which cross-module Prisma queries are
"intentional read joins" vs. accidental coupling. The skill's own module
communication guidance requires documenting this explicitly: *"A direct SQL
join across module tables is acceptable when... the coupling is documented
and the owning module's schema is stable."* `event-read-models` is the one
correctly-designed exception (documented, read-only, composition-only — see
`AGENTS.md`: *"Cross-domain reads via event-read-models readers only"*), but
outside that lane there's no per-module note of which Prisma models a given
module is allowed to touch beyond its own.

Next action: for each business module, add a one-paragraph "owned tables /
read-only tables" note (in the module's own README or a comment block in its
`.module.ts`) — cheap now, and it is the exact artifact `extract-module.md`
step 8 asks for before any future extraction ("Note any shared database tables
and ownership").

**Finding B3 — `sample-compatibility` is a god-adjacent module by necessity,
not neglect**
Impact: Low (informational) · Confidence: High

`sample-compatibility` imports 18 of the 24 modules — by far the widest
fan-in in the graph. This matches its documented purpose exactly (`AGENTS.md`:
`sample-compatibility` (`/sample/*` only)) — it is a deliberate, scoped compat
shim behind its own route prefix, not an accidental "everything module." No
action needed; flagged only so it isn't miscounted as an anti-pattern in a
future automated fan-in check.

**Finding B4 — Two controllers bypass the service layer (repeated from prior
review)**
Impact: Medium · Confidence: High

`apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.ts`
and `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts`
inject `PrismaService` directly and query `opsEvent` from the controller,
violating *"presentation contains no business workflow or persistence logic."*
Both are pre-existing (`git blame`: `377ac6b`, `f9b7daa`, `ea8e2ab` — module
relocation refactors), not a regression from the latest merged PR. Scope: 2 of
41 controllers.

Next action: move the `opsEvent` lookup into each module's existing service
(`FileRequirementsMatrixService`, `FloorPlanWorkflowService` already exist)
and inject the service, not `PrismaService`, into the controller. This is
also a microservices-readiness item: a controller with direct DB access can't
be safely proxied to a remote service boundary later.

### 2.3 Recommended target module shape (modular monolith, extraction-ready)

| Action | Modules | Why |
| --- | --- | --- |
| **Merge** into one `floorplan-authoring` (or fold into existing `floorplan`) | `events`, `plans`, `templates`, `publishing` | One concern (template CRUD + layout publish), same commit origin, currently unrouted from any FE app — 4 Nest library modules doing the job of 1 |
| **Relabel as platform/infra**, not business domains | `health`, `event-session` | Cross-cutting, not owned by a PMCM capability; keep as-is functionally, just group visibly (e.g. a `platform` folder or `nest-cli.json` project comment) so the "24 modules" count reads as ~20 business modules + a small platform layer |
| **Add a `domain/` layer**, no module split | `live-ops`, `supplier-ops` | Real state machines today with zero domain code; this is the direct precondition for eventual extraction |
| **Document ownership**, no code change | all 24 | One paragraph per module: owned Prisma models, read-only cross-module reads (mirrors `event-read-models` pattern) |
| **Fix presentation-layer leak**, no module change | `file-ops`, `floorplan` | Move Prisma calls out of controllers into existing services (finding B4) |

This keeps the *number* of controller-facing modules roughly the same
(dropping ~24 → ~20 real business modules after the floorplan-authoring
merge) while making the two modules most likely to ever need independent
scaling/extraction (`live-ops`, `supplier-ops`) actually own their invariants
instead of just their Prisma queries — which is what "ready for microservices"
concretely means at this size, per the skill's own guidance: *"design module
boundaries so extraction remains possible later without treating extraction
as the current goal."*

### 2.4 Rules verified clean

- No deep imports of another module's `/src/services/*` internals found; the
  only relative-path escapes were into `libs/core/shared-kernel/src` (shared
  cross-cutting infra — explicitly sanctioned).
- `event-read-models` (the documented read-only composition module) is
  consumed correctly and only by `live-ops` and `sample-compatibility`.
- 7 controllers already use `zodBody` — matches `AGENTS.md`'s "migrated write
  surfaces" list exactly; 19 modules still on `class-validator` DTOs is
  pre-existing, documented, in-progress debt, not a new finding.
- A single global `PrismaExceptionFilter` correctly separates transport,
  infra-availability, and unexpected errors; 227 call sites throw Nest's
  built-in exceptions directly, proportionate for the current no-`domain/`
  shape.
- 76 co-located `*.test.ts` files against 229 source files (~1:3); 19
  explicitly cover forbidden-role/authorization paths.

**BE verdict:** Clean boundary-checker run, correct DI/ports shape, Zod
migration on schedule. The "24 modules" instinct is correct but the fix is not
fewer modules everywhere — it's merging one clearly-duplicated concern
(floorplan template/publish, 4→1), separating infra from business modules, and
adding a `domain/` layer to the two modules that actually carry invariants
today, so extraction later is mechanical rather than a rewrite.

---

## 3. Overall Summary

| Axis | Status | Actionable findings |
| --- | --- | --- |
| FE — `client`, `guest`, `supplier` | Aligned | F4 (routing organization) applies at smaller scale |
| FE — `event` | Mostly aligned | F1 (rule violation), F2–F3 (watch), F4 (routing organization, most severe here) |
| BE — `apps/api` | Mostly aligned | B4 (rule violation, narrow), B1/B2 (strategic, pre-microservices), B3 informational |

Nothing found is a security or correctness risk — these are structural/
boundary/organization debts. All are fixable as small, scoped,
behavior-preserving refactors, and none require a whole-app rewrite.

---

## 4. Cross-repo learning: `alphaci-enterprise-be` / `alphaci-enterprise-fe`

Reviewed the sibling AlphaCI Enterprise monorepo (same author, same two
skills already in active use there) specifically to answer: *what would we
take from that codebase and apply to Prism?* Findings below are concrete,
file-level comparisons, not general advice.

### 4.1 BE — what AlphaCI does that Prism doesn't (yet)

**A domain layer actually exists, and it's small.** AlphaCI's `runtime`
module has a real `domain/` folder with exactly two files:
`deployment-strategy.resolver.ts` (a pure class resolving which deploy
strategy applies for a given provider/ownership combo — no NestJS, no Prisma,
no I/O) and `deployment-target.policy.ts` (pure functions +
a typed `DeploymentPolicyViolation` error class enforcing "Render is
backend-only, Vercel is frontend-only" and lane/branch pairing invariants).
Both are unit-testable with zero mocking. This is the exact shape Prism's
review recommended for `live-ops`/`supplier-ops` (finding B1) — AlphaCI is
concrete proof the pattern works at this codebase's scale: **domain layer
doesn't mean heavyweight DDD, it means "the 2–3 files where an invariant
would otherwise leak into a service" get pulled out.**

**Contracts vs. core vs. domain are cleanly separated, per-module.** AlphaCI's
`runtime` module has `contracts/` (interfaces two modules agree on),
`core/` (the registry + controller — the actual composition root for that
concern), `domain/` (pure policy), and `application/ports/` (external-capability
interfaces) as four distinct, consistently-named folders repeated per module
(`identity-access`, `pipelines`, `platform-ops`, `projects` all follow
`contracts/dto/infra` or `api/application/contracts/dto` sub-splits). Prism's
modules are flatter (`controllers/dto/services/mappers/ports`) which is fine
for Level 1–2 modules, but AlphaCI shows the natural next increment when a
module's application layer grows past a handful of services: split
`application/` into named sub-concerns (`application/catalog`,
`application/dashboard`, `application/workflows`, etc. — see AlphaCI's
`projects` module) rather than one flat `services/` folder. Not needed for
every Prism module today, but directly applicable to `supplier-ops` (29
files, flat) if/when it gets the domain-layer treatment (B1b).

**A provider registry pattern for swappable infra.** AlphaCI's
`DeploymentProviderRegistry` (`register`/`get`/`list`, duplicate-id guard,
generic over a `RegisteredDeploymentProvider` shape) is a clean, small
example of the port/adapter pattern the backend skill recommends for
"external capability, prefer a focused port only when replacement... justifies
it." Prism doesn't currently have an equivalent swappable-provider need, but
if PMCM ever needs to support more than one notification channel provider or
storage backend beyond what `notification-ops`/`file-ops` ports already do,
this is the reference shape to copy (not a new finding — noted for future
use, no action needed today).

### 4.2 FE — what AlphaCI does that Prism should adopt (this directly answers
the "top-level app folder" question)

This is the concrete, actionable difference. Side-by-side:

| | Prism (`apps/event`, worst case) | AlphaCI (`alphaci-enterprise-fe`) |
| --- | --- | --- |
| Route groups | 0 used, in any of the 4 apps | 3 used: `(access)`, `(platform)`, `(public)` |
| Top-level `app/` siblings | `dashboard/`, `sign-in/` sit as unrelated flat folders | `(access)/login`, `(access)/signup`, `(access)/auth/callback` grouped under one intent; `(platform)/home`, `/admin`, `/projects`, `/groups`, etc. grouped under another; `(public)/guide` separated as the one public page |
| Route `page.tsx` shape | 46 of 48 dashboard pages in `event` are `return null` shims keyed by a hand-rolled `routeKey` string, real UI lives in a pathname-sniffing 941-line VM | every `page.tsx` is a **one-line re-export** of its feature's view, e.g. `export { HomeDashboardView as default } from "@/features/home/dashboard";` — matches `next-feature-architecture`'s own 80% example exactly |
| Dynamic segments | mixed with literal enum-mirror folders inconsistently (`events/upcoming` next to `events/[eventId]/[section]`) | consistent: every parameterized resource is a real `[id]` segment (`groups/[groupId]/repositories/[repositoryId]`, `admin/users/[id]`) — no literal folders standing in for a closed value set |
| Layout ownership per concern | one `dashboard/layout.tsx` renders the entire shell for every route via client-side pathname parsing | `(platform)/admin/layout.tsx` wraps just the admin sub-tree with its own gate (`<AdminGate>`) and header — layout composition is scoped to the route group/segment that needs it, not global |
| Page transitions | not present | `(platform)/home/template.tsx` (and `settings`, `workflows`) use Next's `template.tsx` convention for per-segment enter/exit animation — a convention Prism doesn't use anywhere |
| Root path | `page.tsx` renders a client landing feature directly | root `page.tsx` is 3 lines: `redirect("/login")`, with a code comment explaining *why* (session cookie lives on a different origin) — makes the auth-entry decision legible at a glance |

**This directly validates and sharpens finding F4 from §1.1.** AlphaCI is
proof, in a codebase by the same author, that the exact fix already proposed
(route groups + real per-route pages instead of shim-and-VM) is not
theoretical — it's the working pattern one commit away in a sibling repo.
Two additions promoted into the matrix from this comparison:

- **F5 (new): adopt the one-line barrel `page.tsx` convention everywhere a
  shim exists.** AlphaCI's `export { X as default } from "@/features/..."`
  is strictly simpler than Prism's `export default function Page() { return
  <X />; }` wrapper and removes even the small ceremony Prism's *few* already-
  correct pages carry. Trivial, mechanical, zero risk — can be folded into
  F4a/F4c as they're done rather than run standalone.
- **F6 (new): scope layout composition to the route group that needs it**,
  following AlphaCI's `(platform)/admin/layout.tsx` pattern, instead of one
  global `dashboard/layout.tsx` doing pathname-detection for every section.
  This is the structural piece that makes F4c (real per-section pages)
  actually pay off — without it, splitting the shim pages still leaves one
  monolithic layout doing all the section-switching work.

See the companion priority/risk matrix for where F5 and F6 now sit in the
sequence.

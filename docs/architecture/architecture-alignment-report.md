---
type: "Architecture Alignment Report"
title: "P.R.I.S.M frontend and backend architecture alignment"
description: "Evidence-led report for frontend route composition, feature MVVM, backend bounded contexts, persistence ownership, and extraction readiness."
tags: [architecture, alignment, frontend, backend, ddd, modular-monolith, nextjs]
status: canonical
updated: "2026-09-01"
authority: informative
owner: "D (Anthony)"
audience: [agents, engineers, reviewers, product]
scope: "all Prism portals, apps/api, packages, architecture decisions, and roadmap"
last_verified: "codex/architecture-alignment-fe-be"
sources:
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "P.R.I.S.M current architecture"
  - id: context-contracts
    resource: "docs/architecture/context-contracts.md"
    title: "P.R.I.S.M context contracts"
  - id: persistence-ownership
    resource: "docs/architecture/persistence-ownership.md"
    title: "P.R.I.S.M persistence ownership and joins"
  - id: priority-risk-matrix
    resource: "docs/roadmap/architecture-priority-risk-matrix.md"
    title: "P.R.I.S.M architecture priority and risk matrix"
  - id: next-architecture
    resource: "C:/Users/anton/.agents/skills/next-feature-architecture/SKILL.md"
    title: "Next.js progressive feature MVVM guidance"
  - id: backend-architecture
    resource: "C:/Users/anton/.agents/skills/backend-architecture/SKILL.md"
    title: "Progressive hexagonal-clean backend guidance"
---
# P.R.I.S.M frontend and backend architecture alignment

## At a glance

- **System shape:** One Next.js portal per actor boundary, one NestJS modular
  monolith, one Prisma client, and shared contract/UI packages.
- **Frontend target:** `page → View → ViewModel → use-case → data →
  @prism/api-client`, with App Router pages acting as explicit composition
  roots.
- **Backend target:** bounded contexts organized by business capability, with
  `api`, `application`, `contracts`, `domain`, and `infrastructure` used only
  where each layer has a real responsibility.
- **Current slice:** Event dashboard route composition, ViewModel seams,
  selector ownership, legacy filter-route compatibility, floorplan query
  bounds, focused backend ports, and persistence ownership documentation are
  implemented in the architecture-alignment branch.
- **Not claimed:** Production deployment, staging promotion, independent
  microservices, or completion of every legacy DTO migration.
- **Primary follow-up:** Continue one justified contract/domain/route slice at
  a time; do not start a big-bang rewrite.

## Reference implementation lessons

The reference AlphaCI Enterprise codebase and its visible `client/src/app`
shape are useful as architecture evidence, not as a template to copy blindly.

### Apply these lessons

| Lesson | Application in Prism |
| --- | --- |
| Make top-level intent visible | Use route groups such as `(access)` and `(portal)` so authentication and portal layouts are legible without changing URLs. |
| Keep the App Router thin | A route page should import the owning feature view and pass route parameters; it should not own HTTP, policy, or a hidden route switch. |
| Organize features by user capability | Use `features/<domain>/<action>/{model,view-models,views,data}` and add `use-cases` only when an action is genuinely shared or multi-step. |
| Keep shared UI domain-free | Put shells, brand, status chrome, and public blocks in `packages/ui`; keep role workflows in the role app. |
| Organize backend code by business domain | A modular monolith should have one module per bounded context with explicit sub-areas, not one module per table or one global event-ops hub. |
| Use composition roots | Bind adapters and focused ports in Nest modules; application services consume contracts instead of vendor or neighboring concrete services. |
| Use executable guardrails | Boundary checks, query audits, typechecks, focused tests, and build checks make architecture enforceable rather than aspirational. |
| Preserve behavior during structure changes | Move route ownership and folders independently from visible behavior; prove old URLs and actor paths still work. |

### Do not copy these incidental details

- `.next`, `.turbo`, `node_modules`, and coverage output are generated artifacts,
  not an application architecture.
- A top-level `app/components` folder is useful for app-local UI, but it does
  not replace feature-local views or shared package boundaries.
- A single dashboard shell can be a temporary migration boundary, but it must
  not become the permanent owner of every route, action, and domain rule.
- AlphaCI's business domains, deployment assumptions, and provider registry do
  not automatically belong in Prism. Adopt a pattern only when Prism has the
  same ownership, replacement, or operational need.

## Frontend assessment

### Target top-level app structure

```text
apps/<portal>/src/
  app/
    (access)/                 # sign-in and access-only layout
    (portal)/                 # authenticated portal layout and URL-preserving routes
    components/               # app-local primitives/chrome only
    lib/                      # app adapter/session helpers only
  features/
    <domain>/<action>/
      model/                  # pure types/selectors/rules
      view-models/            # state and orchestration
      views/                  # JSX bound to the ViewModel
      data/                   # API/client adapters and DTO mapping
      use-cases/              # only for shared/multi-step actions
      index.ts
```

This is a progressive shape. A static screen may only need a route and view; a
form/list/detail normally needs a ViewModel and data adapter. Empty folders and
ceremony are not goals.

### Event dashboard result

The event dashboard now demonstrates the intended composition pattern:

```text
apps/event/src/app/(portal)/dashboard/<route>/page.tsx
  -> EventDashboardRouteView (shared runtime only)
     -> explicit section view supplied by the page
        -> section feature ViewModel/data adapters
```

Implemented changes:

- Pages pass explicit `section`, `tab`, `eventId`, `clientId`, and `view` values.
- `event-dashboard-route-content-view.tsx` provides context and common error
  chrome; it no longer chooses content from a `SECTION_VIEWS` dispatcher.
- `event-dashboard-shell-view.tsx` owns presentational shell chrome only.
- `use-event-dashboard-navigation-view-model.ts` owns router, prefetch,
  sidebar, and sign-out behavior.
- `use-event-dashboard-workspace-view-model.ts` owns session, cache, workspace,
  command-inbox, live-ops, and loading orchestration.
- The remaining shell ViewModel is a page-level coordinator/action registry;
  it does not parse pathname strings and does not perform HTTP directly.
- Shared PMCM selectors live in
  `apps/event/src/features/pmcm-kit/model/pmcm-dashboard-selectors.ts`.
- The old `features/event-ops` facade and its production consumers are retired.
- Literal event filter directories were consolidated behind `[eventSlug]`; the
  compatibility helper preserves `/dashboard/events/upcoming`,
  `/completed`, `/cancelled`, and the other existing filter URLs.

### Frontend residuals

- All portal apps have legible `(access)` and `(portal)` groups in the source
  tree; `(public)` is used where a public surface exists. The event dashboard
  route slice is complete, while client-side literal filter compatibility is
  intentionally left as a separate route-family change rather than mixed into
  this delivery.
- The event dashboard still has a deliberately broad action registry because
  it coordinates one PMCM workspace. Split it again only when a feature can own
  a coherent state boundary without duplicating refresh/error semantics.
- Full browser smoke evidence requires a running stack and role accounts; a
  typecheck or unit suite alone does not prove visual or navigation behavior.

## Backend assessment

### Target modular-monolith structure

```text
apps/api/src/
  kernel/                    # technical primitives; imports no business context
  modules/<bounded-context>/
    api/                      # HTTP adapters
    application/              # use cases and orchestration
    contracts/                # public ports/tokens and serialisable contracts
    domain/                   # pure policy only where invariants justify it
    infrastructure/           # adapters at a real replacement/composition seam
    <context>.module.ts       # one composition root
    index.ts                  # supported in-process surface
  compatibility/sample/      # /sample/* seed/reset compatibility only
```

Current business contexts are `event-lifecycle`, `commercial`, `operations`,
`live-ops`, `floorplan`, `identity-access`, `platform-ops`, and read-only
`read-models`. They are capability/domain groups, not a microservice per folder.
Sub-areas such as `commercial/{quotes,suppliers,billing}` and
`event-lifecycle/{onboarding,compliance,closure,files}` keep code navigable
without creating new deployment units.

Implemented alignment:

- `kernel/access-control` depends on kernel `AUDIT_WRITER`; the composition root
  binds platform audit through `PlatformOpsAuditWriterModule`.
- Identity authentication uses `AUTH_AUDIT`; lifecycle file workflows use
  `DOCUMENT_VAULT`; notification writes use a focused outbox port.
- Read-model controllers and mappers use focused finance, staffing, floorplan,
  and guest reader/command seams and remain write-free.
- Floorplan authoring queries have explicit bounds and regression tests.
- Existing live-ops and commercial policies are pure, tested domain policies;
  no empty DDD folders were added. Additional policies remain evidence-driven.

### Modular monolith to microservices

The current architecture is **microservice-ready in direction**, not a
microservice deployment. The useful preparation is:

1. stable context ownership and public indices;
2. focused ports and serialisable contracts;
3. bounded queries and explicit read-model composition;
4. named transitional writes and a persistence ownership register;
5. audit, authorization, idempotency, and failure semantics at each seam.

Extraction is justified only after a context has an independent data boundary,
deployment lifecycle, authentication/authorization contract, observability,
retry/idempotency policy, operational owner, and measured scaling or failure
reason. Until then, one modular monolith is lower risk.

## Persistence and cross-context assessment

[`persistence-ownership.md`](persistence-ownership.md) is the source of truth
for Prisma model owners, physical schemas, intentional joins, and transitional
writes. The key rule is that a PostgreSQL schema namespace is not an ownership
grant. `read-models` may compose role-scoped records, while business writes stay
with the owner or a named transitional workflow.

Known transitional seams are intentionally documented rather than hidden:

- lifecycle bootstraps initial billing records during accepted-inquiry
  onboarding; ongoing billing belongs to commercial;
- live-ops updates staffing assignments for event-day replacement and
  attendance; a future staffing command port should remove the shared-table
  write;
- platform privacy execution anonymises records owned by several contexts;
- login history is physically in `identity` but currently written by the
  platform audit implementation behind `AUTH_AUDIT`.

These are follow-up design inputs, not reasons to split the database or deploy
services immediately.

## Priority and risk disposition

The full sequenced matrix is
[`../roadmap/architecture-priority-risk-matrix.md`](../roadmap/architecture-priority-risk-matrix.md).

| Priority | Current disposition |
| --- | --- |
| P0 | Route-group intent and backend boundary checks are complete for the current portals; further wrapper simplification is opportunistic. |
| P1 | Event dashboard route/VM/selector work, floorplan query bounds, audit inversion, ownership notes, and focused seams are complete for the identified slice. |
| P2 | Remaining legacy DTO migrations are controlled, one touched contract at a time; further domain policies and platform-ops splitting remain evidence-driven. |
| P3 | Parallel/intercepting routes, provider-registry expansion, broad visual redesign, and microservice deployment remain intentionally deferred. |

## Verification and acceptance

### Latest branch evidence

The architecture-alignment branch currently has the following fresh evidence:

| Check | Result |
| --- | --- |
| API typecheck and build | Pass |
| API suite | 81 files / 352 tests passed |
| Event portal suite | 18 files / 57 tests passed |
| Shared contract tests | 13 tests passed |
| API-client tests | 21 tests passed |
| Client, supplier, guest, and event production builds | Pass |
| Prisma validation and query audit | Pass; 226 API source files audited |
| Backend and frontend architecture boundaries | Pass; zero warnings |
| Repository boundary scan and tests | Pass; 845 files scanned, 6 tests passed |
| Static UI source guards | Pass; 5 dashboard views checked |
| Network UI smoke | Not run to completion; local API was unavailable on port 4000 |
| Root Turbo typecheck | Not used; local environment could not resolve the package-manager binary |

For a future architecture slice, run the narrow checks first and widen only as
the dependency surface grows:

```powershell
npm --workspace @prism/types run build
npm --workspace @prism/event run typecheck
npm --workspace prism-api run typecheck
npm --workspace prism-api run test
npm --workspace prism-api run db:audit:queries
npm --workspace prism-api run prisma:validate
npm run check:boundaries
npm run test:boundaries
git diff --check
```

When the stack and accounts are available, add route-by-route role smoke tests.
Before delivery, verify that the pushed remote tip equals local `HEAD`; do not
describe staging or production status without direct environment evidence.

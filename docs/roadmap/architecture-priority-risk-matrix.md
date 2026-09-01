---
type: "Roadmap Matrix"
title: "P.R.I.S.M architecture priority and risk matrix"
description: "Sequenced frontend and backend architecture follow-up with dependencies, risks, owners, and required closure evidence."
tags: [roadmap, architecture, risk, frontend, backend]
status: active
updated: "2026-09-01"
authority: informative
owner: "D (Anthony)"
audience: [engineering, product, design, reviewers]
scope: "frontend and backend architecture debt, dependencies, risks, owners, and closure evidence"
last_verified: "codex/architecture-alignment-fe-be"
sources:
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture reference"
  - id: context-contracts
    resource: "docs/architecture/context-contracts.md"
    title: "Context contract register"
  - id: alignment-report
    resource: "docs/architecture/architecture-alignment-report.md"
    title: "Frontend and backend architecture alignment report"
  - id: frontend-inventory
    resource: "docs/product/redesign-inventory.md"
    title: "Frontend and surface redesign inventory"
  - id: constitution
    resource: "docs/constitution.md"
    title: "Prism constitution"
---
# P.R.I.S.M architecture priority and risk matrix

## At a glance

- **Purpose:** Track active frontend/backend architecture debt with priority, risk, ownership, dependencies, and closure evidence.
- **Authority:** Informative delivery roadmap; it cannot authorize unplanned product or behavior changes.
- **Owner:** D (Anthony).
- **Scope:** Portal route organization, feature seams, API contexts, persistence ownership, contracts, and extraction readiness.
- **Use when:** Selecting the next architecture slice or assessing the risk of a structural change.
- **Change when:** A row is completed, reprioritized, split, deferred, or replaced by an ADR.
- **Verify with:** The row's required evidence plus touched code checks; documentation alone cannot mark work complete.

This matrix sequences completed foundation work and material architecture
follow-up. It is a delivery aid, not permission to change product behavior
without a feature-specific design, owner, contract, and verification evidence.

## Scoring

- **Priority:** P0 = safety/blocker or prerequisite; P1 = do soon; P2 =
  planned debt; P3 = monitor/opportunistic.
- **Impact:** consequence of leaving the item unresolved.
- **Fix risk:** chance the change itself regresses behavior.
- **Effort:** XS, S, M, or L for an independently reviewable slice.
- Every row needs the listed verification before it is marked complete.

## Current execution snapshot

This snapshot separates work delivered by the current architecture-alignment
slice from the remaining plan. `Complete` means source, focused tests, and
the relevant static checks are in this branch; it does not mean production or
staging deployment.

| Area | Status | Evidence / next action |
| --- | --- | --- |
| Event dashboard route composition | Complete | App Router pages pass explicit route state and compose section views; the shared route runtime no longer selects content by pathname or a section map. |
| Event dashboard ViewModel | Complete | Navigation and workspace loading are separate ViewModels; the remaining shell ViewModel is a page-level coordinator/action registry. |
| PMCM selector ownership | Complete | Shared selectors are under `apps/event/src/features/pmcm-kit/model/pmcm-dashboard-selectors.ts` with focused tests. |
| Legacy event filter routes | Complete | Literal filter folders were consolidated behind `[eventSlug]`; existing `/dashboard/events/<filter>` URLs still resolve to the same list view. |
| FE `event-ops` facade | Complete | Production consumers use feature-local data adapters or focused PMCM commands; facade files are removed. |
| Floorplan query audit | Complete | Authoring list queries are bounded and have regression tests; the API query audit passes. |
| Kernel audit dependency | Complete | `AUDIT_WRITER` is kernel-owned and bound to platform-ops at the composition root. |
| Focused backend seams | Complete for identified seams | Audit, notifications, auth audit, document vault, finance, staffing, floorplan, and guest seams are explicit; new broad workflow abstractions remain prohibited. |
| Persistence ownership register | Complete | [`docs/architecture/persistence-ownership.md`](../architecture/persistence-ownership.md) records owners, physical schemas, joins, and transitional writes. |
| Contract boundary cleanup | Partial / controlled | Floorplan draft/preference writes, briefing submission, and guarded live-ops routes now use shared Zod or verified session context; remaining legacy DTOs are migrated one touched contract at a time, with no new class-validator writes. |
| Further domain policies | Complete for identified invariants | Live-ops urgent-issue/escalation and commercial quote-request policies are pure and tested; add another only when a named invariant is found, not for folder symmetry. |
| Microservice extraction | Deferred | No independent deployment/data/operations boundary is claimed; keep modular-monolith seams extraction-ready. |

## Completed in the current backend consolidation

| ID | Completed item | Evidence / residual note |
| --- | --- | --- |
| BE-C1 | Consolidated commercial + supplier + finance ownership into `apps/api/src/modules/commercial` | One `commercial.module.ts` and `index.ts`; `quotes`, `suppliers`, and `billing` remain explicit sub-areas. |
| BE-C2 | Consolidated inquiry/onboarding + compliance + closure + files into `modules/event-lifecycle` | Routes and behavior preserved; file requirements remains a lifecycle sub-area. |
| BE-C3 | Consolidated floorplan plus events/plans/templates/publishing into `modules/floorplan` | Live and authoring sub-areas; no route deletion. |
| BE-C4 | Consolidated staffing + guest into `modules/operations`; kept `live-ops` separate | Avoids the circular dependency found when live-ops consumes read models. |
| BE-C5 | Consolidated trust + notifications + AI governance into `modules/platform-ops` | Public context boundary; future split requires an explicit ownership decision. |
| BE-C6 | Rehomed `event-read-models` as read-only `modules/read-models` | Queries/mappers/services are grouped under `application`; no writes allowed. |
| BE-C7 | Moved event-core, access-control, event-session, database, health, shared, and shared-kernel under `src/kernel` | Technical primitives are visibly separate from business contexts. |
| BE-C8 | Isolated sample compatibility at `src/compatibility/sample` | `/sample/*` remains the only broad aggregate compatibility boundary. |
| BE-C9 | Removed the former per-library Nest CLI projects and source roots | One Nest API source tree; public context aliases and indices are the supported surface. |
| BE-C10 | Added/updated executable boundary checks | Backend skill checker: 0 errors/0 warnings; repository tests: 6 passed. |
| BE-C11 | Fixed controller persistence leak | File-requirements and floorplan controllers delegate `opsEvent` lookup to services; B4 is closed. |
| BE-C12 | Added progressive domain policies | `live-ops/domain` and `commercial/domain` contain pure invariant policies; no empty DDD ceremony added. |

**Completed-work verification:** API typecheck and build, full API suite (81
files / 352 tests), event suite (18 files / 57 tests), shared contract tests
(13 tests), API-client tests (21 tests), four portal production builds,
Prisma validation, 226-file query audit, backend boundary checker, frontend
boundary checker with zero warnings, repository boundary scan, repository
boundary tests (6 passed), and `git diff --check` passed for this slice. The
static UI source guards also passed; network UI smoke remains unavailable until
the local API and portals are running.

## Priority 0 — protect behavior and unblock the next slices

| ID | Status | Work | Impact | Fix risk | Effort | Dependencies | Required verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F4a | Complete for current portals | All four portals use legible `(access)` and `(portal)` groups; `(public)` is present where public surfaces exist, while the event app intentionally has no public marketing group. | Medium — top-level intent is explicit without URL changes | Low | S | Existing groups; verify before each route move | Portal route inventory; touched-app typechecks; boundary check |
| F5 | Complete for current event slice / opportunistic elsewhere | Event routes are already one-line feature composition or explicit route-owned composition; client literal filters remain a separate compatibility-preserving slice rather than a forced rewrite. | Low — avoids route ceremony without destabilizing role portals | Very low | XS–S per route family | Fold into future route-family work, not a speculative sweep | Touched-app typecheck/build; exact routes render the same view |
| FE-cleanup | Complete | Confirm/remove `apps/client/src/app/App.tsx` if unreferenced. | Low — dead App Router-adjacent file confuses ownership | Very low | XS | Re-run import search first | No importers; client typecheck/build |
| BE-guard | Ongoing | Preserve the new source boundary for all new backend changes. | High — regression would recreate the 22-root problem | Low | Ongoing | None | `check-prism-boundaries.mjs`, backend skill checker, no old tracked roots |

**P0 rule:** route groups are organization only. Do not combine them with a
rendering rewrite or change any URL in the same commit.

## Priority 1 — remove active boundary and composition debt

| ID | Status | Work | Impact | Fix risk | Effort | Dependencies | Required verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Complete | Move shared event selectors out of deep `event-workspace`/`command-inbox` internals into `pmcm-kit/model/pmcm-dashboard-selectors.ts`. | Medium — selector ownership is now explicit and reusable | Medium | S–M | None | Selector tests, event typecheck, dashboard architecture test |
| F6 | Complete | Scope `event` layouts to route-group/section ownership rather than global pathname detection. | High — route pages now own their route slot | Medium | M | F1 | Architecture tests, route inventory, event typecheck |
| F3 | Complete | Split the event dashboard shell ViewModel by navigation and workspace loading while retaining a page-level coordinator. | Medium — reduces the merge/conflict hotspot and isolates I/O orchestration | Medium | M | F1 + F6 | Focused architecture tests, event typecheck, event suite |
| F4c | Complete | Replace no-op/dispatcher pages with explicit App Router pages that compose the owning section view. | High — App Router now owns route composition | Medium | L | F1 + F3 + F6 | Route inventory, compatibility tests, event typecheck/suite |
| B5 | Complete | Invert `kernel/access-control` → `platform-ops` audit behavior through `AUDIT_WRITER`. | High strategic — kernel no longer imports business platform code | Medium–high | M | Port ownership and composition-root wiring implemented | API audit/access tests, kernel import scan, typecheck/build |
| B6 | Complete | Document owned/read-only Prisma tables and intentional cross-context joins. | Medium–high — shared DB coupling is now visible and reviewable | Low | S–M | Final context grouping | Ownership register, query audit, Prisma validation |
| BE-compat | Complete for the consolidation slice | Verify public alias consumers use context indices rather than private paths. | High — protects extraction seams | Low | S | Context consolidation | Private-import scan, root/backend boundary checks, API suite |

## Priority 2 — planned structural and domain improvements

| ID | Status | Work | Impact | Fix risk | Effort | Dependencies | Required verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F4b | Complete for event filter family | Collapse literal closed-value filter folders behind `[eventSlug]` while preserving legacy filter URLs. | Medium — fewer duplicate route shims and route metadata | Medium | M | F1; route inventory and compatibility decision | Routing tests, route inventory, event typecheck/suite |
| B7 | Deferred by evidence | Decide whether `platform-ops` should split into trust, notifications, and AI governance contexts. | Medium — broad ownership may become an extraction bottleneck | Medium | S design, M implementation if approved | Ownership review plus operational/deployment evidence | Future ADR/ledger update, focused ports, API suite |
| B8 | Deferred by surface | Migrate remaining legacy class-validator write/query surfaces to `@prism/types` Zod schemas and `zodBody` when touched. | Medium — duplicate contracts remain in legacy areas | Medium | S per surface | Feature work; no blind rewrite | Types build, contract tests, forbidden-role tests, typecheck |
| B9 | Deferred by invariant | Add domain policies only where a named supplier or lifecycle invariant is independent of HTTP/Prisma. | High over time — rules otherwise drift into services | Medium | S–M per policy | Identify the invariant first | Pure unit tests; unchanged service tests; no Prisma/HTTP imports in domain |
| B10 | Complete for identified seams | Move broad workflow aggregation behind focused context ports where a real inversion or reader boundary exists. | Medium — public context calls are more focused | Medium | M per seam | B5/B6 ownership map | Dependency scan, DI tests, context boundary check |
| F2 | Complete for current event dashboard | Replace `event-ops` facade consumers with feature-local `data/` adapters and focused dashboard commands. | Low–medium — prevents a new FE god hub | Low–medium | S per consumer | Consumer changes | No production facade refs, event boundary test, event suite |

## Priority 3 — monitor / do not create standalone work yet

| ID | Item | Why it stays deferred |
| --- | --- | --- |
| FE-parallel | Parallel/intercepting route conventions | No current product requirement; route groups and real pages solve the observed problem first. |
| FE-template | `template.tsx` transitions copied from AlphaCI | Useful only after route ownership is corrected; not an architecture prerequisite. |
| BE-provider | Generic provider registry for every adapter | Copy AlphaCI's registry only when Prism has a genuine swappable notification/storage/deployment provider. |
| BE-service-split | Deploy a context as an independent microservice | Shared DB, auth, audit, and runtime contracts are not yet an operational boundary; extraction is a later product/operations decision. |
| UI-redesign | Broad visual redesign during route refactor | Keep route/architecture changes behavior-preserving and separately reviewable. |

## Risk matrix by failure mode

| Risk | Likelihood | Impact | Mitigation / owner |
| --- | --- | --- | --- |
| FE route refactor changes a public URL | Medium | High | Owner C/B; route groups first, URL snapshot/manual checks, one route family per PR. |
| Event dashboard sections regress during real-page extraction | Medium | High | Owner B; F1 → F6 → F3 → F4c order, per-section rollout and smoke. |
| A context becomes a new god module | Medium | High | Owner D; require a named owner goal, sub-area folders, public index, and focused ports before adding behavior. |
| Shared Prisma writes cross ownership boundaries | Medium | High | Owner D; B6 ownership notes, read-model write prohibition, query audit, forbidden-role tests. |
| Kernel depends on business contexts | Mitigated | High | Owner D; `AUDIT_WRITER` and the boundary checks keep `kernel/access-control` business-context-free. |
| Stale generated types break API/portal builds | Medium | Medium | Rebuild `@prism/types` after contract changes; run touched workspace typechecks. |
| Broad sample state becomes the normal product API | Low–medium | High | Keep sample under `compatibility/sample`; reject new role-feature callers in review/checker. |
| Docs and source tree drift | Medium | Medium | Keep canonical architecture, ADRs, ownership register, ledger, report, and matrix synchronized in the same architecture change. |

## Recommended execution order

```text
Completed: BE-C1..BE-C12, F1, F3, F4b, F4c, F6, F2, B5, B6, B10, FE-cleanup

Current slice completed in dependency order:

1. Canonicalize PMCM selectors and retire the event-ops facade.
2. Split workspace loading and navigation from the event dashboard coordinator.
3. Make App Router pages own section composition and consolidate event filters
   behind the compatibility dynamic segment.
4. Bound the remaining floorplan queries and invert the kernel audit seam.
5. Record focused backend seams and Prisma ownership/intentional joins.

Next work, only when evidence justifies it:

1. Migrate the next touched legacy contract from class-validator to shared Zod
   (B8), with contract and forbidden-role tests.
2. Reassess platform-ops splitting (B7) after ownership, deployment, and
   operational evidence; do not start a microservice migration by aesthetics.
```

## Definition of done for the full plan

- Every portal has a legible, URL-preserving route-group/page structure; the
  event dashboard slice and current route-group alignment are complete.
- `event` has no production `event-ops` facade consumer and no
  pathname-sniffing section dispatcher.
- Dashboard VM responsibilities are split by concern and remain free of HTTP.
- Every backend context has one composition root and public index; kernel and
  compatibility boundaries remain intact.
- Context-crossing production code uses public indices, serializable contracts,
  or focused ports; read models remain read-only.
- Domain policies are pure and tested where invariants justify them.
- API typecheck, build, full tests, Prisma validation, both boundary checks,
  route/UI smoke, and `git diff --check` pass for the final release slice.
- The remote branch tip equals the local HEAD after push; no claim of staging or
  production deployment is made without environment evidence.

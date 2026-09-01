# FE/BE Architecture — Priority and Risk Matrix

**Date:** 2026-09-01
**Companion:** [`2026-09-01-fe-be-architecture-alignment.md`](./2026-09-01-fe-be-architecture-alignment.md)
**Branch:** `codex/architecture-alignment-fe-be`
**Purpose:** sequence the completed work and every material follow-up found in
the frontend/backend architecture review. This matrix is a delivery aid, not
permission to perform the future FE work in the current BE change.

## Scoring

- **Priority:** P0 = safety/blocker or prerequisite; P1 = do soon; P2 =
  planned debt; P3 = monitor/opportunistic.
- **Impact:** consequence of leaving the item unresolved.
- **Fix risk:** chance the change itself regresses behavior.
- **Effort:** XS, S, M, or L for an independently reviewable slice.
- Every row needs the listed verification before it is marked complete.

## Completed in the current backend consolidation

| ID | Completed item | Evidence / residual note |
| --- | --- | --- |
| BE-C1 | Consolidated commercial + supplier + finance ownership into `apps/api/apps/api/src/modules/commercial` | One `commercial.module.ts` and `index.ts`; `quotes`, `suppliers`, and `billing` remain explicit sub-areas. |
| BE-C2 | Consolidated inquiry/onboarding + compliance + closure + files into `modules/event-lifecycle` | Routes and behavior preserved; file requirements remains a lifecycle sub-area. |
| BE-C3 | Consolidated floorplan plus events/plans/templates/publishing into `modules/floorplan` | Live and authoring sub-areas; no route deletion. |
| BE-C4 | Consolidated staffing + guest into `modules/operations`; kept `live-ops` separate | Avoids the circular dependency found when live-ops consumes read models. |
| BE-C5 | Consolidated trust + notifications + AI governance into `modules/platform-ops` | Public context boundary; future split requires an explicit ownership decision. |
| BE-C6 | Rehomed `event-read-models` as read-only `modules/read-models` | Queries/mappers/services are grouped under `application`; no writes allowed. |
| BE-C7 | Moved event-core, access-control, event-session, database, health, shared, and shared-kernel under `src/kernel` | Technical primitives are visibly separate from business contexts. |
| BE-C8 | Isolated sample compatibility at `src/compatibility/sample` | `/sample/*` remains the only broad aggregate compatibility boundary. |
| BE-C9 | Removed per-library Nest CLI projects and old `apps/api/libs` source roots | One Nest API source tree; public context aliases and indices are the supported surface. |
| BE-C10 | Added/updated executable boundary checks | Backend skill checker: 0 errors/0 warnings; repository tests: 6 passed. |
| BE-C11 | Fixed controller persistence leak | File-requirements and floorplan controllers delegate `opsEvent` lookup to services; B4 is closed. |
| BE-C12 | Added progressive domain policies | `live-ops/domain` and `commercial/domain` contain pure invariant policies; no empty DDD ceremony added. |

**Completed-work verification:** API typecheck, Nest build, Prisma validation,
full API suite (80 files / 350 tests), backend boundary checker, and repository
boundary tests passed during the source relocation. The final delivery audit
must rerun the repository scan after staging.

## Priority 0 — protect behavior and unblock the next slices

| ID | Work | Impact | Fix risk | Effort | Dependencies | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| F4a | Add invisible `(auth)` and `(portal)` route groups in each portal | Medium — top-level intent is currently flat and hard to navigate | Low if URLs are unchanged | S per app | None; do one app per PR | App typecheck/build; route-by-route URL comparison; auth → dashboard manual flow; boundary check |
| F5 | Use one-line feature-view exports for pages that are only wrappers | Low — removes route ceremony and matches the proven reference pattern | Very low | XS–S | Fold into F4a/F4c, not a speculative sweep | Touched-app typecheck/build; exact routes render the same view |
| FE-cleanup | Confirm and remove `apps/client/src/app/App.tsx` if still unreferenced | Low — dead App Router-adjacent file confuses ownership | Very low | XS | Re-run import search first | No importers; client typecheck/build |
| BE-guard | Preserve the new source boundary for all new backend changes | High — regression would recreate the 22-root problem | Low | Ongoing | None | `check-prism-boundaries.mjs`, backend skill checker, no old tracked roots |

**P0 rule:** route groups are organization only. Do not combine them with a
rendering rewrite or change any URL in the same commit.

## Priority 1 — remove active boundary and composition debt

| ID | Work | Impact | Fix risk | Effort | Dependencies | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Move shared event selectors out of deep `event-workspace`/`command-inbox` internals into one canonical domain/read-model home | Medium — current hard FE boundary violation and duplicated selector ownership | Medium | S–M | None; do before F3/F4c | FE boundary checker 0 findings for the three features; selector tests; dashboard/workspace/inbox smoke |
| F6 | Scope `event` layouts to route group/section ownership instead of global pathname detection | High — prerequisite for real route pages and smaller VMs | Medium | M | F1 recommended; preserve shell behavior section-by-section | Existing dashboard architecture tests; manual QA per section; boundary check |
| F3 | Split 941-line `use-event-dashboard-shell-view-model.ts` by routing/nav, configuration, and read-model coordination | Medium — merge-conflict and change-risk hotspot | Medium | M | F1 first; pair with F6 | VM/feature tests; typecheck; dashboard manual smoke; no HTTP in VM |
| F4c | Replace `event` no-op pages and pathname-sniffed rendering with real per-section feature-view pages | High — App Router currently does not own rendering | High | L, one section at a time | F1 + F3 + F6 | Visual/manual regression per section; URL preservation; feature boundary check; route smoke |
| B5 | Invert `kernel/access-control` → `platform-ops` audit dependency through a focused audit-writer port | High strategic — kernel cannot be extracted cleanly while it imports business platform code | Medium–high | M | Decide port ownership and composition-root wiring first | API tests including audit; backend boundary rule for kernel direction; typecheck/build |
| B6 | Write owned/read-only Prisma table notes per context and define intentional cross-context joins | Medium–high — shared DB can hide accidental coupling | Low | S–M | Use final context grouping | Review each context module; query audit; future static ownership rule proposal |
| BE-compat | Verify all public alias consumers use context indices, not private paths | High — protects future extraction seams | Low | S | After any backend move | `rg` for private imports; root and backend boundary checks; full API test suite |

## Priority 2 — planned structural and domain improvements

| ID | Work | Impact | Fix risk | Effort | Dependencies | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| F4b | Collapse literal closed-value filter folders into `[filter]`/query state where URLs can remain compatible | Medium — fewer duplicate route shims and less route metadata | Medium | M per portal/family | F1; route inventory and compatibility decision | Old URLs resolve identically; new route tests; manual filter checks; boundary check |
| B7 | Decide whether `platform-ops` should later split into trust, notifications, and AI governance contexts | Medium — broad ownership may become a future extraction bottleneck | Medium | S design, M implementation if approved | B6 and ownership review; no split by aesthetics | ADR/ledger update; focused public ports; full API suite and boundary checks |
| B8 | Migrate remaining legacy class-validator write surfaces to `@prism/types` Zod schemas and `zodBody` when touched | Medium — duplicate contract definitions and inconsistent error boundaries | Medium | S per surface | Do with feature work, not a blind rewrite | Types build; API/FE contract tests; forbidden-role tests; typecheck |
| B9 | Add more domain policies where invariants justify them, especially supplier verification and event lifecycle rules | High over time — rules otherwise drift into services | Medium | S–M per policy | Use live-ops/commercial pattern; identify invariant first | Pure unit tests; unchanged service tests; no Prisma/HTTP imports in domain |
| B10 | Move any remaining broad workflow aggregation behind focused context ports | Medium — public context imports can still be too coarse for extraction | Medium | M per seam | B5/B6 ownership map | Dependency graph; DI tests; context boundary check |
| F2 | Gradually replace `event-ops` FE facade consumers with feature-local `data/` adapters | Low–medium — prevents a new FE god hub | Low–medium | S per consumer | Only when consumer is already being changed | No direct HTTP in view/VM; feature boundary checker; focused UI smoke |

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
| Kernel depends on business contexts | Current | High | Owner D; track B5 and block independent extraction until audit seam is inverted. |
| Stale generated types break API/portal builds | Medium | Medium | Rebuild `@prism/types` after contract changes; run touched workspace typechecks. |
| Broad sample state becomes the normal product API | Low–medium | High | Keep sample under `compatibility/sample`; reject new role-feature callers in review/checker. |
| Docs and source tree drift | Medium | Medium | Update `AGENTS.md`, canonical architecture, ledger, report, matrix, and plan in the same architecture PR. |

## Recommended execution order

```text
Completed: BE-C1..BE-C12

1. FE-cleanup + F4a + F5       route organization only, one portal at a time
2. F1                          canonicalize event selectors
3. F6                          scope event layouts
4. F3                          split the event dashboard VM
5. F4c                         real event section pages, one section at a time
6. F4b                         dynamic/filter route cleanup after URL evidence
7. B6                          table ownership ledger and intentional-join notes
8. B5                          invert kernel audit dependency
9. B8/B9/B10                   opportunistic contract, domain, and port hardening
10. B7/F2                      split platform or retire FE facade only when evidence justifies it
```

## Definition of done for the full plan

- All four portals use a legible, URL-preserving route-group/page structure.
- `event` has no deep cross-feature import and no pathname-sniffing mega-shell.
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

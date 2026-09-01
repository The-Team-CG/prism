# FE/BE architecture alignment — master plan

**Date:** 2026-09-01
**Branch:** `codex/architecture-alignment-fe-be` from `staging`
**Owners:** A = Maxine (UX), B = Francis (PMCM operations), C = Ethan
(external portals), D = Anthony (platform trust)

This is the living execution plan for the architecture review and the follow-up
debt. It supersedes the earlier task-by-task plan that targeted the old
`apps/api/libs/modules` library layout.

## Objective

Align Prism with the two local architecture skills without rewriting product
behavior:

- **Frontend:** thin Next.js App Router routes; route groups for intent; real
  feature pages; progressive MVVM (`page → View → ViewModel → use-case → data`);
  no deep cross-feature imports; URL state preferred over pathname sniffing.
- **Backend:** DDD-shaped bounded contexts in one Nest modular monolith; one
  context composition root and public index; progressive `api/`,
  `application/`, `contracts/`, `domain/`, and `infrastructure/`; kernel/shared
  primitives separate; cross-context access through public contracts/ports.
- **Delivery:** preserve existing routes and contracts, work in small commits,
  verify narrow-to-wide, and never claim staging/production deployment without
  evidence.

## Non-negotiable constraints

1. Work from `staging` on `codex/architecture-alignment-fe-be` or a dedicated
   child branch; use conventional commits and PR delivery.
2. Do not change public URLs during frontend organization. A route-group move
   must be invisible to the URL; dynamic-segment changes require route-by-route
   compatibility evidence.
3. Keep PMCM command ownership in `apps/event`; external portals remain narrow.
4. Shared write contracts stay in `@prism/types` as Zod schemas plus `z.infer`.
5. `@prism/api-client` is used from feature `data/` or thin portal adapters,
   never from pages, views, or VMs.
6. Backend contexts may cross boundaries only through a public `index.ts`, a
   serializable shared contract, or a focused injected port/token. No private
   filesystem imports.
7. `modules/read-models` is read-only. `compatibility/sample` is for `/sample/*`
   demo/seed/reset only.
8. Preserve unrelated uncommitted work and never commit credentials or `.env`
   files.

## Target backend tree — implemented

```text
apps/api/apps/api/src/
  modules/
    commercial/         # commercial + supplier + finance
    event-lifecycle/    # onboarding + compliance + closure + files
    floorplan/          # live floorplan + authoring
    identity-access/    # identity business workflows
    live-ops/           # event-day operations; deliberately separate
    operations/         # staffing + guest
    platform-ops/       # trust + notifications + AI governance
    read-models/        # read-only cross-context composition
  kernel/
    access-control database event-core event-session health shared shared-kernel
  compatibility/sample/
```

Every context has `<context>.module.ts` and `index.ts`. There is one Nest API
project in `apps/api/nest-cli.json`; old `apps/api/libs` source roots and
per-library `tsconfig.lib.json` projects are removed. Internal depth is
progressive rather than uniform.

### Backend work already completed

- [x] Confirmed the old module inventory and ownership evidence.
- [x] Moved commercial/supplier/finance into `modules/commercial`.
- [x] Moved onboarding/compliance/closure/files into `modules/event-lifecycle`.
- [x] Moved floorplan plus events/plans/templates/publishing into
  `modules/floorplan`.
- [x] Moved staffing/guest into `modules/operations`; kept live-ops separate
  to avoid a read-model cycle.
- [x] Moved trust/notifications/AI governance into `modules/platform-ops`.
- [x] Moved event-read-models into read-only `modules/read-models`.
- [x] Moved technical primitives into `src/kernel`.
- [x] Moved sample compatibility into `src/compatibility/sample`.
- [x] Repaired relative imports, public aliases, `app.module.ts`, Nest config,
  Vitest aliases, and package scripts.
- [x] Added/updated context ownership notes and public-index boundary rules.
- [x] Fixed the two controller-level Prisma lookups (B4).
- [x] Preserved the existing live-ops and commercial pure domain policies.

## Frontend plan — remaining

### FE-1: route organization and dead-file cleanup (P0)

**Owner:** C with A for UX review.
**Scope:** `apps/client`, `apps/event`, `apps/guest`, `apps/supplier`.

- [ ] Reconfirm `apps/client/src/app/App.tsx` has no importers; delete it if
  dead, otherwise move it to its real feature ownership.
- [ ] Add `(auth)` and `(portal)` route groups one portal at a time.
- [ ] Keep all current paths identical; capture before/after route inventories.
- [ ] Use one-line feature-view default exports where a `page.tsx` is only a
  wrapper.

**Verification:** touched-app typecheck/build, route inventory diff, sign-in →
dashboard manual flow, and feature boundary check. Keep this separate from
rendering changes.

### FE-2: canonicalize shared event selectors (F1, P1)

**Owner:** B/D.
**Files:**
`apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts`,
the corresponding `event-workspace` and `command-inbox` selector modules.

- [ ] Identify the shared event read-model/domain vocabulary.
- [ ] Create one canonical public model/contract home.
- [ ] Update consumers and remove deep sibling-internal re-exports.
- [ ] Keep selectors pure; do not put HTTP or route parsing in them.

**Verification:** event feature boundary check has zero findings; selector
tests, event dashboard, workspace, and command-inbox smoke pass.

### FE-3: scope layouts (F6, P1)

**Owner:** B/C with A.

- [ ] Map the current dashboard shell responsibilities by route section.
- [ ] Move shared chrome to a portal/group layout.
- [ ] Move section gates/headers to the smallest owning layout.
- [ ] Remove pathname-based section switching only after the matching section
  has a real route owner.

**Verification:** existing dashboard architecture tests, manual QA per section,
and no URL/permission regression.

### FE-4: split the event dashboard VM (F3, P1)

**Owner:** B/D.

- [ ] Split `use-event-dashboard-shell-view-model.ts` into routing/URL state,
  navigation/configuration, and dashboard read-model coordination.
- [ ] Keep a thin page-level orchestrator.
- [ ] Preserve loading, error, empty, and authorization states.
- [ ] Do not move API calls out of `data/` into the VM.

**Verification:** feature tests, typecheck, manual dashboard smoke, and static
proof that the VM has no HTTP calls.

### FE-5: real event pages (F4c, P1/high-risk)

**Owner:** B with C/D.

- [ ] Choose one section (for example audit) as the pilot.
- [ ] Make its `page.tsx` render the feature view directly.
- [ ] Remove only that section's no-op shim/pathname branch.
- [ ] Validate visual, permission, loading, and URL behavior.
- [ ] Repeat one section per PR until the dashboard shell no longer acts as a
  hidden router.

**Dependency:** FE-2, FE-3, and FE-4 complete for the pilot section.
**Verification:** per-section UI/manual smoke, route checks, feature boundary
check, and no change to public paths.

### FE-6: dynamic/filter route cleanup (F4b, P2)

**Owner:** C/B.

- [ ] Inventory literal closed-value folders in `client` and `event`.
- [ ] Decide whether each family can use `[filter]` or query state without
  breaking an existing URL or deep link.
- [ ] Migrate one family at a time; retain compatibility aliases/redirects if
  required.

**Verification:** every old URL resolves to equivalent content, route tests,
manual filter checks, and boundary scan.

### FE-7: retire the `event-ops` facade opportunistically (F2, P2/watch)

**Owner:** B/D.

- [ ] Do not add new consumers.
- [ ] When a domain is already touched, give it a scoped `data/` adapter.
- [ ] Keep `lib/prism-api` thin until the scoped API surface is available.

**Verification:** no HTTP in views/VMs, feature boundary check, focused UI smoke.

## Backend follow-up plan — after the source consolidation

### BE-1: invert the kernel audit seam (B5, P1)

**Owner:** D.

Current state: `kernel/access-control` imports the public `platform-ops` module
to emit audit evidence. This is legal in the monolith and preserves behavior,
but it is a kernel-to-business dependency.

- [ ] Define the smallest audit-writer port at the correct boundary.
- [ ] Provide a platform adapter at the application composition root.
- [ ] Remove the kernel import of the platform context.
- [ ] Keep actor correlation, audit payload, and error behavior unchanged.

**Do not:** duplicate audit persistence, import platform internals, or make the
kernel a second trust module.
**Verification:** access-control/audit tests, API typecheck/build, backend
boundary rule for kernel direction, and full API tests.

### BE-2: record Prisma ownership (B6, P1)

**Owner:** D with each domain owner.

- [ ] Add one owned/read-only table note to each context.
- [ ] Mark intentional cross-context joins and their stable owner.
- [ ] Identify writes that should become ports before extraction.
- [ ] Add a future static ownership check only after the table map is reviewed.

**Verification:** review every context composition root; run query/schema audits
where credentials are available; no behavior change.

### BE-3: deepen domain policies where justified (B9, P2)

- [ ] Keep `live-ops/domain` and `commercial/domain` pure and tested.
- [ ] Identify supplier verification and event-lifecycle invariants that must
  hold independently of HTTP/Prisma.
- [ ] Extract only those policies; never add empty domain folders for symmetry.

**Verification:** pure unit tests, unchanged service tests, no Prisma/Nest/HTTP
imports in domain files.

### BE-4: finish shared write-contract migration (B8, P2)

- [ ] When touching a legacy write surface, add/update its Zod schema in
  `packages/types`.
- [ ] Use `zodBody` in the controller and `parseContract`/safe parsing at FE
  boundaries.
- [ ] Preserve user-safe problem details and forbidden-role tests.

**Verification:** `@prism/types` build/test, API tests, touched portal tests,
and typecheck.

### BE-5: decide future platform split (B7, P2)

- [ ] Keep `platform-ops` as the current bounded context.
- [ ] Revisit trust, notifications, and AI governance only with evidence of
  different ownership, scaling, deployment, or data-retention needs.
- [ ] If split is approved, introduce public ports and migrate one sub-area at
  a time; do not copy the old flat-library problem.

### BE-6: preserve public context boundaries (ongoing)

- [ ] New APIs land under the owning final context.
- [ ] New cross-context behavior uses public indices, `@prism/types`, or focused
  ports.
- [ ] New normal features never depend on `/api/sample/state`.
- [ ] Keep `read-models` read-only and query-budgeted.

## Cross-repo lessons to retain

From AlphaCI Enterprise, keep these patterns:

1. one source tree and visible composition roots;
2. public `index.ts` surfaces rather than private path imports;
3. progressive DDD depth, with small pure policies;
4. explicit contracts and adapters for real external capability seams;
5. route groups `(access)`, `(platform)`, `(public)`;
6. scoped layouts and real `[id]` segments;
7. one-line route-to-feature view exports;
8. provider registries only where a capability is genuinely swappable.

Do not copy AlphaCI's business domains, rename Prism's product vocabulary, or
introduce microservices merely to imitate its deployment shape.

## Verification matrix

| Slice | Required checks |
| --- | --- |
| FE route organization | Touched-app typecheck/build, route inventory and URL comparison, manual auth/portal flow, FE boundary check |
| FE event rendering | Feature tests, per-section UI smoke, loading/error/permission checks, no URL change |
| BE source move | API typecheck, Nest build, full API Vitest, Prisma validate, backend skill checker, root boundary check |
| BE contracts | `@prism/types` build/test, API/portal typechecks, forbidden-role tests |
| DB ownership/migration | `prisma validate`, `db:verify:offline`; live audits only with approved credentials and migrated target |
| Delivery | `git diff --check`, scoped diff review, conventional commit, push, local HEAD = `git ls-remote` tip |

### Baseline already observed

- API typecheck: pass.
- Nest build: pass.
- Full API suite: 80 files / 350 tests passed.
- Prisma validation: pass.
- Backend skill checker: 0 errors / 0 warnings.
- Repository boundary tests: 6 passed / 0 failed.
- UI smoke and live database audits: environment-gated, not claimed here.

## Delivery checklist

- [x] Work is isolated on `codex/architecture-alignment-fe-be`.
- [x] Backend source tree and docs use final `src/modules`, `src/kernel`, and
  `src/compatibility/sample` paths.
- [ ] Stage only intended changes after reviewing status and diff.
- [ ] Run final narrow-to-wide verification after all docs/config edits.
- [ ] Commit with conventional messages.
- [ ] Push branch and verify remote tip.
- [ ] Open a PR only when requested/approved; never imply it is merged or on
  staging without GitHub evidence.

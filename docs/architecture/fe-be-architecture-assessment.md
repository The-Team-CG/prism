---
type: "Architecture Assessment"
title: "P.R.I.S.M FE/BE architecture assessment"
description: "Current evidence-backed assessment of Prism portal alignment and backend bounded-context architecture, including residual follow-up debt."
tags: [architecture, assessment, frontend, backend, verification]
status: stable
updated: "2026-09-01"
sources:
  - id: next-architecture
    resource: "next-feature-architecture"
    title: "Next feature architecture guidance used for this assessment"
  - id: backend-architecture
    resource: "backend-architecture"
    title: "Backend architecture guidance used for this assessment"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current Prism architecture"
  - id: roadmap
    resource: "docs/roadmap/architecture-priority-risk-matrix.md"
    title: "Architecture priority and risk matrix"
---
# P.R.I.S.M FE/BE architecture assessment

**Assessment date:** 2026-09-01
**Scope:** `apps/client`, `apps/event`, `apps/guest`, and `apps/supplier`
against Next feature architecture; `apps/api` against backend architecture.
**Assessment status:** The frontend section records review findings and
remaining work. The backend source-tree consolidation is implemented; no
frontend refactor is implied by that completed backend change.

**Method:** each skill's detector/inventory/boundary scripts, repository
boundary tests, targeted static searches, and direct comparison with the
AlphaCI Enterprise reference worktree. Findings distinguish hard violations,
watch items, completed work, and future recommendations.

---

## 1. Frontend — `next-feature-architecture`

**Detector (all four apps):** `runtime: next`, `hasFeatures: true` — the skill
applies cleanly.

| App | Boundary result | Current finding |
| --- | --- | --- |
| `client` | clean | route organization debt at the top-level `app/` tree |
| `guest` | clean | no hard finding |
| `supplier` | clean | no hard finding |
| `event` | 2 findings | one deep cross-feature import; one facade fan-in watch item |

### 1.1 Findings

#### F1 — Deep cross-feature import in `event`

**Impact:** Medium · **Confidence:** High · **Priority:** P1

`apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts`
deep-imports internals from `event-workspace` and `command-inbox` selector
folders. This violates the no-deep-cross-feature rule. The selector logic is
shared domain state, not an implementation detail that should be re-exported
from one feature through another.

**Action:** move the shared selectors to one canonical domain-level model (or a
small shared read-model contract) and make each feature consume that public
surface. Remove the sibling-internal re-export. Verify the dashboard,
workspace, and command-inbox selector tests after the move.

#### F2 — `event-ops` shared I/O facade fan-in

**Impact:** Low–medium · **Confidence:** Medium · **Priority:** P2/watch

`apps/event/src/features/event-ops/` is a thin repository/use-case/VM facade
over `@/lib/prism-api`, imported by six event feature areas through its barrel.
That is currently allowed and was introduced to keep HTTP out of views and
VMs, but it is trending toward the god-hub shape explicitly discouraged by
`AGENTS.md`.

**Action:** do not add more consumers. When a consuming feature is already
being changed, give it a local `data/` repository or a scoped feature adapter.
No standalone rewrite is justified today.

#### F3 — Mega view-model in `event`

**Impact:** Low–medium · **Confidence:** Medium · **Priority:** P1 after F1

`apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts`
is 941 lines, combining navigation/icon configuration, route coordination, and
data selection for clients, events, calendar, and workspace resources. It is
not a hard React/JSX layering violation, but it is composition state at a size
that increases merge conflicts and makes route work risky.

**Action:** after F1, split by concern: navigation/configuration, URL/section
coordination, and dashboard read-model selection. Keep the page-level VM as an
orchestrator; do not move HTTP or business rules into it.

#### F4 — Top-level `app/` routes underuse route groups and real segments

**Impact:** Medium–high in `event` · **Confidence:** High · **Priority:** P0/P1

The four portals use no Next.js route groups (`(name)`). The `event` app has 48
dashboard page files, 46 of which are no-op route shims; the real rendering is
driven by a pathname-sniffing `dashboard/layout.tsx` and the 941-line VM. The
`client` app repeats the pattern at smaller scale with literal filter folders
next to dynamic event segments. The top-level `sign-in`, `sign-up`, and
`dashboard` folders are also unrelated siblings rather than explicit auth and
portal route groups. `apps/client/src/app/App.tsx` is a likely dead legacy file
outside the App Router convention.

**Action, preserving URLs:**

1. Add invisible route groups such as `(auth)` and `(portal)` to express intent.
2. Scope layouts to the route group/section that owns the chrome and gate.
3. Replace literal enum-mirror folders with `[param]` only where the existing
   URL can remain compatible; do one filter family at a time.
4. Make each real `page.tsx` render its feature view directly, one section at
   a time, after selectors, layout ownership, and VM responsibilities are
   ready.
5. Delete `apps/client/src/app/App.tsx` only after the no-import result is
   reconfirmed.

No route-group or page-routing change was included in this BE consolidation.

#### F5 — Page shims carry avoidable wrapper ceremony

**Impact:** Low · **Confidence:** High · **Priority:** P2

Where a route is only a feature-view export, prefer the one-line convention:

```tsx
export { SomeView as default } from "@/features/some-feature";
```

This is the working AlphaCI pattern and the simplest expression of a thin App
Router route. Apply it opportunistically while doing F4; it is not a reason to
touch otherwise stable pages alone.

### 1.2 Rules verified clean

- No `fetch`/Axios calls were found in any portal `page.tsx`.
- No React/Next imports were found in feature `model/` files and no `.tsx` was
  found under `view-models/`.
- I/O remains in `data/`, with the guest shared HTTP primitive used only by
  repositories.
- There are no empty `use-cases/` or `steps/` folders among the inspected
  feature slices.
- `packages/ui/src` has no `@prism/types` imports; shared UI has not absorbed
  role/domain rules.
- `@prism/api-client` is reached through portal adapters, not directly from
  views or VMs.

**FE verdict:** `client`, `guest`, and `supplier` are aligned on the core MVVM
rules. `event` is mostly aligned but needs F1 before further route extraction;
F4 is the largest structural opportunity because the App Router is currently
being used as a URL matcher while the shell performs the actual routing.

---

## 2. Backend — `backend-architecture`

**Detector:** NestJS + TypeScript + Prisma/Postgres, high confidence.
**Backend skill boundary checker:** 0 errors, 0 warnings after relocation.
**Repository boundary tests:** 6 passed, 0 failed.

### 2.1 Is the backend too module-heavy?

Yes at the *composition-root* level, not because every service should be
merged. The old layout exposed 22 small capability/technical roots under
many small capability and technical roots plus a compatibility library. That
made `nest-cli.json`, aliases, and `app.module.ts` describe implementation
history rather than business ownership.

The final layout has eight context roots under
`apps/api/apps/api/src/modules`, seven cross-cutting kernel concerns, and one
isolated sample-compatibility leaf:

| Final root | Consolidated ownership | Internal shape |
| --- | --- | --- |
| `commercial` | commercial, supplier, and finance operations | `api/{quotes,suppliers,billing}`, `application/*`, `contracts`, `domain` |
| `event-lifecycle` | inquiry/onboarding, compliance, closure, and file requirements | `api/*`, `application/*`, `contracts` |
| `floorplan` | live floorplans plus events/plans/templates/publishing authoring | `api/{live,authoring}`, `application/{live,authoring}`, `contracts` |
| `operations` | staffing and guest operations | `api/{staffing,guest}`, `application/{staffing,guest}`, `contracts` |
| `live-ops` | event-day tasks, urgent issues, escalation, attendance, live status | `api`, `application`, `domain` |
| `identity-access` | account authentication and approval | `api/auth`, `application/auth` |
| `platform-ops` | trust/audit, notifications, and AI governance | `api/*`, `application/*`, `contracts`, `infrastructure/*` |
| `read-models` | role-scoped cross-context reads | `api`, `application/{mappers,queries,services}`, `contracts/ports` |

Each context has one `<context>.module.ts` composition root and one public
`index.ts`. The source tree also has:

```text
apps/api/apps/api/src/kernel/
  access-control  database  event-core  event-session
  health          shared    shared-kernel
apps/api/apps/api/src/compatibility/sample/
```

There is one Nest API project now; per-library `tsconfig.lib.json` projects and
the former source roots are removed. The consolidation keeps
routes, public contracts, and behavior stable.

### 2.2 Why these groupings are domain-shaped

- **Commercial** is one supplier-sourcing → quote → billing pipeline, while
  quotes, suppliers, and billing stay visible as sub-areas.
- **Event lifecycle** follows the event record from inquiry to archive; file
  requirements are a lifecycle concern, not an unrelated top-level module.
- **Floorplan** owns the physical-layout domain across live event plans and
  template authoring; this is a merge of ownership, not a route deletion.
- **Operations** groups staffing and guest execution workflows. **Live-ops is
  intentionally separate** because its read-model dependency would create a
  circular context graph if merged.
- **Platform-ops** remains a bounded platform context rather than a kernel
  utility because audit, notification, and AI governance have policies and
  persistence. Split it only if ownership or deployment needs diverge.
- **Read-models** composes data and writes nothing; it is the only normal
  cross-context read composition lane.

This is the modular-monolith version of DDD: a context boundary is a business
ownership boundary, not a promise that each folder is already an independently
deployable service.

### 2.3 Alignment with backend architecture guidance

| Guidance | Current result |
| --- | --- |
| One composition root per context | Implemented: eight context modules and public indices. |
| Progressive depth | Implemented: `domain/` and `infrastructure/` exist only where justified; sub-areas are explicit where a context is broad. |
| Ports/contracts at boundaries | Existing context tokens and focused ports were retained and moved with their owners. |
| No private cross-context imports | Enforced by repository checks; production imports use public indices, serializable shared contracts, or injected ports. |
| Read/write separation | `read-models` is read-only and raw queries are budgeted in approved query files. |
| Kernel separate from business contexts | Database, auth/session, access control, health, event core, and shared primitives live under `src/kernel`. |
| Extraction readiness without premature extraction | Stable composition roots exist, but persistence is still shared and no network boundary was introduced. |

### 2.4 Completed backend findings

- **B4 resolved:** the file-requirements and floorplan controllers no longer
  inject Prisma or query `opsEvent`; their existing application services own
  those lookups.
- **B1 partially resolved in the right way:** `live-ops/domain` and
  `commercial/domain` contain pure status/lifecycle policies. This is useful
  DDD depth, not ceremony. Supplier verification and additional lifecycle
  rules remain future work where invariants justify them.
- **B2 structurally improved:** ownership is recorded on context composition
  roots and read-model composition is explicit. A complete per-Prisma-model
  ownership ledger is still a follow-up.
- **B3 remains intentionally informational:** sample compatibility is a leaf
  behind `/sample/*`; its broad provider aggregation is not a normal product
  dependency.

### 2.5 Residual backend risks

#### B5 — Kernel access control depends on platform audit

`apps/api/apps/api/src/kernel/access-control` currently imports the public
`platform-ops` module so authorization decisions can write audit evidence. The
import is public and passes the current checker, but it is a kernel-to-business
context dependency that would make independent extraction awkward.

**Recommendation:** before extracting either side, invert this through a focused
audit-writer port at the kernel/application boundary and wire the platform
adapter at the composition root. Do not duplicate audit persistence or import
platform internals.

#### B6 — Shared Prisma hides ownership

All contexts still use one Prisma client and database. That is correct for the
current monolith, but the final source layout alone cannot prevent accidental
cross-table writes. Add a concise owned/read-only table note per context and
consider a future static query-ownership check before any service extraction.

#### B7 — `platform-ops` may later be too broad

Trust, notifications, and AI governance are now grouped for composition clarity,
not because they share one domain model. Keep the public context boundary today;
split only after an explicit ownership/scaling decision and focused ports.

#### B8 — Legacy write DTO migration remains

Some older surfaces still use class-validator DTOs. New shared writes must use
Zod contracts in `@prism/types`; migrate legacy bodies when their context is
next touched rather than creating another broad rewrite.

**BE verdict:** the “too many modules” concern is addressed at the correct
level. Prism now has AlphaCI-like `src/modules` and `src/kernel` composition,
progressive DDD internals, and executable boundary rules. The remaining work is
ownership hardening and one kernel audit seam—not another bulk merge.

---

## 3. Cross-repo learning applied from AlphaCI Enterprise

The reference repo is useful because it demonstrates these patterns in working
code, not because Prism should copy its business vocabulary.

### Backend lessons

1. **Use one source tree and public indices.** Applied to Prism by removing
   per-library Nest build wiring and moving contexts to
   `apps/api/apps/api/src/modules/*` with `src/kernel/*` for primitives.
2. **Use progressive DDD.** AlphaCI's pure runtime policies are small and
   persistence-free. Applied to Prism's live-ops and commercial lifecycle
   policies rather than adding empty domain folders everywhere.
3. **Keep contracts and adapters explicit.** Applied by retaining context
   tokens/ports and moving infrastructure adapters under the owning context.
4. **Keep read composition separate.** Applied through the read-only
   `read-models` context and query-budget boundary rule.
5. **Keep provider registries/ports for genuinely swappable integrations.**
   This is a future pattern for notification/storage providers, not a reason to
   add an abstraction to every current service.

### Frontend lessons

AlphaCI's top-level app tree uses `(access)`, `(platform)`, and `(public)` route
groups; scoped layouts; real `[id]` segments; and one-line feature-view
`page.tsx` exports. This is the right lesson for the user's top-level `app/`
folder concern:

| Concern | Prism today | Adopt next |
| --- | --- | --- |
| Intent | flat `dashboard`, `sign-in`, `sign-up` siblings | `(portal)` and `(auth)` route groups; URLs unchanged |
| Rendering | event pages mostly no-op shims plus pathname-sniffing shell | real route pages compose their feature views |
| Parameters | literal filter folders mixed with dynamic resource segments | one `[filter]`/`[id]` pattern where compatibility permits |
| Layouts | one dashboard layout coordinates every section | group/section layouts own only their chrome and gates |
| Route files | wrapper functions around feature views | one-line default re-exports where applicable |

The FE changes are deliberately still a separate follow-up because route
organization has a larger visual/regression surface than the completed BE
source relocation.

---

## 4. Overall status

| Area | Status | Next action |
| --- | --- | --- |
| FE core MVVM | Mostly aligned | Fix event F1, then split F3/F4 incrementally. |
| FE top-level app organization | Needs improvement | Route groups, scoped layouts, real pages, and compatibility-preserving dynamic segments. |
| BE context composition | Implemented | Keep new work inside final contexts and public indices. |
| BE DDD depth | Partially implemented, progressive | Add policies only for real invariants; document table ownership. |
| BE extraction readiness | Good modular-monolith baseline | Invert B5 audit seam before independent service extraction. |
| Runtime/database delivery | Not implied by this review | Run live DB audits/UI smoke only in an environment with the required credentials/stack. |

The current backend verification evidence is: API typecheck pass, Nest build
pass, 80 Vitest files/350 tests pass, Prisma validation pass, backend boundary
checker 0/0, and repository boundary tests 6/6. Final delivery must rerun the
repository scan after staging and compare the pushed branch tip with the remote.

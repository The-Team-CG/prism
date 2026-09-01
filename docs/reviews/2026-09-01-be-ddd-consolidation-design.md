# Backend DDD bounded-context consolidation

**Status:** implemented on 2026-09-01 on `codex/architecture-alignment-fe-be`
**Owner:** D — Anthony
**Reference:** the AlphaCI Enterprise backend worktree used for the attached
`enterprise-modules-consolidation` example.

This document records the final backend structure, the grouping decisions, and
the remaining extraction-readiness debt. It supersedes the earlier design-in-
progress version of this review.

## Decision

Prism keeps one NestJS modular monolith and one Prisma client, but stops treating
each small capability as a top-level Nest CLI library. The source tree now follows
the reference shape:

```text
src/
  modules/<bounded-context>/
    api/
    application/
    contracts/
    domain/             # only where a real invariant exists
    infrastructure/     # only where an adapter exists
    <context>.module.ts
    index.ts
  kernel/<cross-cutting-concern>/
  compatibility/sample/
```

The nested Prism workspace path is `apps/api/apps/api/src`; the same structure is
therefore visible in this repository as:

```text
apps/api/apps/api/src/modules/<context>/
apps/api/apps/api/src/kernel/<concern>/
apps/api/apps/api/src/compatibility/sample/
```

This is a modular-monolith improvement, not a premature microservices split.
Routes, contracts, Prisma models, and behavior remain stable; only ownership and
composition boundaries changed.

## Why the reference pattern applies

The AlphaCI backend has one application source tree, one composition root per
bounded context, public `index.ts` entrypoints, and progressive internal depth.
It does not create a domain folder merely to satisfy a template. It adds
`domain/`, `contracts/`, `core/`, `application/`, or `infrastructure/` when the
context has a reason for that layer. Prism now uses the same rule:

- `api/` contains transport adapters and controllers.
- `application/` contains use cases, workflow services, queries, and mappers.
- `domain/` contains persistence-independent policies where state invariants
  justify it.
- `contracts/` contains ports, tokens, and context-facing interfaces.
- `infrastructure/` contains adapters for external side effects.
- `index.ts` is the only supported public context entrypoint.
- A context's `.module.ts` is its Nest composition root.

The result is fewer *business composition roots*, not fewer files at any cost.
Sub-areas remain explicit inside a context so a future extraction can start from
a stable capability seam instead of from a folder full of unrelated services.

## Final grouping

The initial inventory contained 22 flat capability/technical roots under
`apps/api/libs/modules/*` (plus shared library roots). They are now represented
by eight context roots, seven kernel concerns, and one isolated compatibility
leaf.

| Final area | Former roots | Ownership decision |
| --- | --- | --- |
| `modules/event-lifecycle` | `inquiry-onboarding`, `compliance-ops`, `closure-ops`, `file-ops` | One event record lifecycle from inquiry through closure; files are a lifecycle requirements sub-area. |
| `modules/commercial` | `commercial-ops`, `supplier-ops`, `finance-ops` | One commercial pipeline from supplier sourcing and quotes through billing; `quotes`, `suppliers`, and `billing` remain named sub-areas. |
| `modules/operations` | `staffing-ops`, `guest-ops` | People and attendance operations that support event execution; staffing and guest workflows remain separate application sub-areas. |
| `modules/live-ops` | `live-ops` | Event-day tasks, urgent issues, escalation, attendance/replacement, and live status. It stays separate from `operations` because its read-model dependency would create a circular context dependency. |
| `modules/floorplan` | `floorplan`, `floorplan-authoring` (`events`, `plans`, `templates`, `publishing`) | Official event floorplans and venue-template authoring are the same physical-layout domain; live and authoring are separate sub-areas. |
| `modules/identity-access` | `identity-ops` | Account authentication and approval workflow. Session/verified-actor primitives are kernel concerns, not identity business ownership. |
| `modules/platform-ops` | `trust-ops`, `notification-ops`, `ai-governance` | Platform trust, notification outbox, and AI governance share platform-side operational ownership for this monolith. Their internal sub-areas retain separate contracts and adapters. |
| `modules/read-models` | `event-read-models` | Read-only cross-context composition for role-scoped dashboards and workspaces. It owns no writes. |
| `kernel/*` | `event-core`, `access-control`, `event-session`, `health`, `database`, `shared`, `shared-kernel` | Cross-cutting primitives used by contexts, kept visibly outside business ownership. |
| `compatibility/sample` | `sample-compatibility` | `/sample/*` seed/reset/demo compatibility only; it is a deliberate leaf and not a normal product context. |

### Decisions that prevent over-merging

1. **`live-ops` is not merged into `operations`.** `live-ops` consumes the
   read-model composition needed for its live dashboard and has dependencies on
   commercial and staffing capabilities. Merging it would make the context
   graph circular rather than simpler.
2. **`read-models` remains read-only.** Cross-domain dashboard composition is a
   separate query concern, not permission to write another context's tables.
3. **`platform-ops` is a context, not kernel.** Audit/privacy, notification
   outbox, and AI governance have product-facing policies and persistence. They
   can be split later if their ownership or scaling needs diverge; they are not
   silently promoted into an unbounded shared utility.
4. **`sample` remains outside normal contexts.** It may aggregate many public
   context providers because `/sample/*` is a compatibility boundary. New role
   features must use scoped contracts instead.

## Final source layout

```text
apps/api/apps/api/src/
  app.module.ts
  modules/
    commercial/
      api/{billing,quotes,suppliers}/
      application/{billing,quotes,suppliers}/
      contracts/
      domain/
      commercial.module.ts
      index.ts
    event-lifecycle/
      api/{closure,compliance,files,onboarding}/
      application/{closure,compliance,files,onboarding}/
      contracts/
      event-lifecycle.module.ts
      index.ts
    floorplan/
      api/{authoring,live}/
      application/{authoring,live}/
      contracts/
      floorplan.module.ts
      index.ts
    identity-access/
      api/auth/
      application/auth/
      identity-access.module.ts
      index.ts
    live-ops/
      api/
      application/
      domain/
      live-ops.module.ts
      index.ts
    operations/
      api/{guest,staffing}/
      application/{guest,staffing}/
      contracts/
      operations.module.ts
      index.ts
    platform-ops/
      api/{ai-governance,notifications,trust}/
      application/{ai-governance,notifications,trust}/
      contracts/
      infrastructure/{notifications,trust}/
      platform-ops.module.ts
      index.ts
    read-models/
      api/
      application/{mappers,queries,services}/
      contracts/ports/
      read-models.module.ts
      index.ts
  kernel/
    access-control/
    database/
    event-core/
    event-session/
    health/
    shared/
    shared-kernel/
  compatibility/sample/
```

There is one API project in `apps/api/nest-cli.json`. The old per-library
`tsconfig.lib.json` projects and old `apps/api/libs/*` source roots are gone.
The root `tsconfig.json` and Vitest aliases resolve context and kernel public
indices, while the API `tsconfig.app.json` includes the single source tree.

## Boundary contract

Production code follows this dependency direction:

```text
API adapter -> application -> domain/contracts
                   |              |
                   +-----------> infrastructure ports/adapters

context -> public index of another context
context -> serializable @prism/types contract
context -> focused injected port/token
context -> kernel public index

read-models -> public readers/ports (read-only)
sample compatibility -> public context/kernel indices only
```

The executable checks now enforce the important parts:

- no direct filesystem imports into another context's private folders;
- no private context/kernel alias imports from outside that boundary;
- no context imports `compatibility/sample`;
- no kernel imports `compatibility/sample`;
- `read-models` cannot mutate Prisma and raw read queries must live in approved
  query files with an explicit query budget;
- no tracked source remains under the old `apps/api/libs` roots.

The backend architecture skill boundary checker and the repository boundary
checker both pass after the relocation.

### Known seam to invert before service extraction

`kernel/access-control` currently imports the public `platform-ops` module to
write audit evidence. This is legal at the current modular-monolith boundary
and keeps the existing audit behavior, but it is a kernel-to-business-context
dependency. Before extracting either side, introduce a focused audit writer
port at the kernel/application boundary and wire a platform adapter at the
composition root. Do not duplicate audit persistence or make `access-control`
depend on platform internals as a shortcut.

## Domain depth currently justified

`modules/live-ops/domain/` contains the urgent-issue status and escalation
policies. `modules/commercial/domain/` contains quote-request lifecycle
policies. These are pure, unit-testable rules and are the right level of DDD for
the current monolith. The other contexts remain progressive: add a domain file
when a rule must hold independently of HTTP and Prisma, not because every
context needs identical folders.

## Verification evidence

Fresh checks after the source-tree relocation passed:

| Check | Result |
| --- | --- |
| API TypeScript typecheck | pass |
| Nest API build | pass |
| Full API Vitest suite | 80 files, 350 tests passed |
| `prisma validate` | pass |
| Backend architecture boundary checker | 0 errors, 0 warnings |
| Repository boundary tests | 6 passed, 0 failed |
| Repository boundary scan | pass before final staging; rerun in final delivery audit |
| `git diff --check` | required again immediately before commit |

The move preserves existing HTTP route paths, public contract shapes, and
runtime behavior. A live database audit and UI smoke remain environment-gated;
they are not implied by this source-only consolidation.

## Follow-up order

1. Keep new backend work inside the final context/kernel tree and add a public
   contract or focused port before crossing a context boundary.
2. Invert the `access-control` audit seam before any independent-service
   extraction.
3. Document owned/read-only Prisma tables per context and split
   `platform-ops` only when ownership or deployment needs justify it.
4. Extract more domain policies in `commercial`, `live-ops`, and later
   `event-lifecycle` as invariants become visible; do not introduce a generic
   shared domain god-package.
5. Keep the frontend route-group and feature-slice work in the separate FE plan
   described by the alignment report and priority matrix.

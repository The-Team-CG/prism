---
type: "Architecture Contract Register"
title: "P.R.I.S.M context contracts"
description: "Current public context surfaces, dependency direction, read-model composition, and focused seams in the Prism modular monolith."
tags: [architecture, contracts, boundaries, ddd]
status: stable
updated: "2026-09-01"
sources:
  - id: context-source
    resource: "apps/api/apps/api/src/modules"
    title: "Bounded-context source tree"
  - id: kernel-source
    resource: "apps/api/apps/api/src/kernel"
    title: "Technical kernel source tree"
  - id: boundary-checker
    resource: "scripts/check-prism-boundaries.mjs"
    title: "Prism architecture boundary checker"
  - id: architecture-reference
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture reference"
---
# P.R.I.S.M context contracts

This register describes in-process dependency seams in the one NestJS
deployable. A context index or focused port is an application contract; it is
not a network endpoint and does not imply that the context is already an
independent service.

## Contract rules

1. A context's public `index.ts` is the default surface for stable in-process
   capability use.
2. `contracts/` and shared `@prism/types` types contain serialisable inputs and
   outputs; they do not expose Prisma models, Nest controllers, or vendor SDKs.
3. A focused injected port is used only for genuine inversion, an optional
   integration, a policy seam, a testing replacement, or a transport boundary.
4. Context composition roots may import another context's Nest module only to
   assemble the current module graph. That import is not permission for private
   application code to import the context's concrete implementation.
5. Production code must not import another context's private service,
   repository, DTO, provider adapter, or deep filesystem path.
6. The kernel may be used by contexts and must not import a business context.
7. `read-models` composes role-scoped reads only. It does not own business
   writes, authorization policy, or a general-purpose command facade.

## Context public surfaces

| Context | Public surface | Owns | Cross-context use |
| --- | --- | --- | --- |
| `commercial` | `modules/commercial/index.ts` | supplier sourcing, quotes, and billing | expose focused quote/billing contracts; keep private repositories and pricing policy internal |
| `event-lifecycle` | `modules/event-lifecycle/index.ts` | inquiry/onboarding, compliance, closure, and file requirements | expose lifecycle status and command contracts; keep transition policy with the owner |
| `floorplan` | `modules/floorplan/index.ts` | official live floorplans and venue-template authoring/publishing | expose official-layout reads and mutation contracts; client preference input remains role-scoped |
| `identity-access` | `modules/identity-access/index.ts` | authentication and account approval workflows | expose verified actor/access checks; do not export session implementation details |
| `live-ops` | `modules/live-ops/index.ts` | event-day tasks, urgent issues, escalation, attendance/replacement, and live status | expose live-ops command/read contracts; do not merge into staffing merely for folder symmetry |
| `operations` | `modules/operations/index.ts` | staffing and guest workflows | expose role-scoped staffing/guest contracts; keep assignments and guest policy internal |
| `platform-ops` | `modules/platform-ops/index.ts` | trust/audit, notifications, and AI governance | expose narrow audit/notification/governance seams; provider and persistence details stay private |
| `read-models` | `modules/read-models/index.ts` | cross-context role-scoped read composition | may combine approved reads and map shared interfaces; must not write business state |

## Technical kernel surfaces

The kernel contains technical primitives under
`apps/api/apps/api/src/kernel/`: `access-control`, `database`, `event-core`,
`event-session`, `health`, `shared`, and `shared-kernel`. Contexts may depend on
these facilities. Kernel code must not import `modules/*`.

## Current seam inventory

| Source | Target or resource | Contract rule | Current treatment |
| --- | --- | --- | --- |
| `modules/read-models` | owning business contexts | public index, serialisable read contract, or approved reader | read-only composition; no command/write ownership |
| `kernel/access-control` | `modules/platform-ops` audit behavior | focused audit-writer port is the desired direction | current dependency is a documented extraction-readiness follow-up; do not add more kernel-to-business imports |
| context composition roots | other Nest context modules | module import only at composition root | allowed for one-process assembly; not a private application dependency |
| API controllers | context application services | owning context service and mapper | controllers do not expose Prisma models or perform cross-context persistence lookups |

This table is intentionally small. Add a row when a new cross-context seam is
introduced or an existing seam changes; do not turn it into a copy of the import
graph. The executable checker and boundary tests remain authoritative for
violations.

## Persistence seam

Prism currently uses one Prisma client and a shared database. A query that reads
another context's table must record the stable owner, the reason for the join,
the fields allowed across the seam, and the transition plan if the table will
eventually be isolated. A shared database is an implementation arrangement, not
an ownership grant.

## Verification

Run:

```powershell
npm run check:boundaries
npm run test:boundaries
```

For an API context change, also run the touched API tests, typecheck, build, and
Prisma validation. Inspect the importing file and its public index before
accepting a boundary change; a passing typecheck alone does not prove a clean
seam.

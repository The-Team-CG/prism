---
type: "Architecture Contract Register"
title: "P.R.I.S.M context contracts"
description: "Current public context surfaces, dependency direction, read-model composition, and focused seams in the Prism modular monolith."
tags: [architecture, contracts, boundaries, ddd]
status: canonical
updated: "2026-09-08"
authority: normative
owner: "D (Anthony)"
audience: [agents, backend-engineers, reviewers]
scope: "apps/api/src/modules and kernel seams"
last_verified: "2026-09-08; closeout read seam and API runtime composition"
sources:
  - id: context-source
    resource: "apps/api/src/modules"
    title: "Bounded-context source tree"
  - id: kernel-source
    resource: "apps/api/src/kernel"
    title: "Technical kernel source tree"
  - id: boundary-checker
    resource: "scripts/check-prism-boundaries.mjs"
    title: "Prism architecture boundary checker"
  - id: architecture-reference
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture reference"
---
# P.R.I.S.M context contracts

## At a glance

- **Purpose:** Define the supported in-process seams between bounded contexts.
- **Authority:** Normative for backend imports, ports, contracts, and read-model composition.
- **Owner:** D (Anthony).
- **Scope:** `apps/api/src/modules` and `apps/api/src/kernel`.
- **Use when:** Adding a context dependency, public index, port, or cross-context query.
- **Change when:** A supported seam, context owner, or extraction constraint changes.
- **Verify with:** `scripts/check-prism-boundaries.mjs` and boundary tests.

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
`apps/api/src/kernel/`: `access-control`, `database`, `event-core`,
`event-session`, `health`, `shared`, and `shared-kernel`. Contexts may depend on
these facilities. Kernel code must not import `modules/*`.

## Current seam inventory

| Source | Target or resource | Contract rule | Current treatment |
| --- | --- | --- | --- |
| `modules/read-models` | owning business contexts | public index, serialisable read contract, or approved reader | read-only composition; no command/write ownership |
| `modules/event-lifecycle` | `@prism/contexts/read-models/closeout` | explicit pure public subpath | Reads unresolved urgent issues using the caller's transaction. It imports no Nest controller/module barrel, so archive commands avoid a runtime lifecycle/read-model composition cycle. The boundary checker permits this exact subpath only. |
| `modules/platform-ops` | `@prism/contexts/event-lifecycle/conforme-reminder-window` | focused lifecycle claim contract | Validates accepted, unsigned, five-day inquiry eligibility and atomically claims the reminder window inside the approval transaction. The inquiry owner supplies the stored recipient; the scheduled reminder and approved draft share the compare-and-set claim. The boundary checker permits this exact subpath only. |
| `modules/event-lifecycle`, `modules/floorplan` | `@prism/contexts/read-models/event-scope` | explicit pure public subpath | Joins inquiry email, supplier request identity and active coordinator assignments/profiles for event reads. A shared identity helper derives authorized scope; controllers do not trust actor/query labels or expose the joined identity fields as public DTOs. |
| `kernel/access-control` | platform audit behavior | kernel-owned focused port; composition-root adapter | `AUDIT_WRITER` is implemented in the kernel and bound to platform-ops by `PlatformOpsAuditWriterModule`; kernel has no business-context import |
| `modules/identity-access` | platform trust behavior | identity application depends on `AUTH_AUDIT`; only its infrastructure adapter knows the platform implementation | authentication and account workflows use a focused audit/lockout seam; no `AuditService` import remains in the application layer |
| `modules/event-lifecycle` | document storage behavior | `DOCUMENT_VAULT` port owned by the lifecycle context | onboarding workflows use the port; metadata-only storage is the current composition adapter |
| `modules/read-models` | finance, staffing, floorplan, and guest reads | focused reader/command contracts plus pure mappers | dashboard controllers and mappers use `FINANCE_COMMANDS`, `STAFFING_READER`, `FLOORPLAN_READER`, and `GUEST_READER`; read-models owns no writes |
| context composition roots | other Nest context modules | module import only at composition root | allowed for one-process assembly; not a private application dependency |
| API controllers | context application services | owning context service and mapper | controllers do not expose Prisma models or perform cross-context persistence lookups |

This table is intentionally small. Add a row when a new cross-context seam is
introduced or an existing seam changes; do not turn it into a copy of the import
graph. The executable checker and boundary tests remain authoritative for
violations.

## Persistence seam

Prism currently uses one Prisma client and a shared database. The owned-table and
join register is [`persistence-ownership.md`](persistence-ownership.md). A query
that reads another context's table must record the stable owner, the reason for
the join, the fields allowed across the seam, and the transition plan if the
table will eventually be isolated. A shared database is an implementation
arrangement, not an ownership grant.

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

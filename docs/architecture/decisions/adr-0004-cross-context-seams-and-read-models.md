---
type: "Decision"
title: "Cross-context seams and read models"
description: "Use public context surfaces, serialisable contracts, and focused ports for cross-context behavior while keeping read-model composition read-only."
tags: [architecture, decision, ddd, boundaries, read-models, ports]
status: canonical
updated: "2026-09-01"
authority: normative
owner: "D (Anthony)"
audience: [agents, backend-engineers, reviewers]
scope: "backend context dependencies, read-model composition, and persistence seams"
last_verified: "581e676"
decision_date: "2026-09-01"
sources:
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current context layout"
  - id: context-contracts
    resource: "docs/architecture/context-contracts.md"
    title: "Context contract register"
  - id: context-source
    resource: "apps/api/apps/api/src/modules"
    title: "Bounded-context modules"
  - id: kernel-source
    resource: "apps/api/apps/api/src/kernel"
    title: "Technical kernel"
  - id: boundary-checks
    resource: "scripts/check-prism-boundaries.mjs"
    title: "Repository boundary checker"
---
# ADR-0004: Cross-context seams and read models

## At a glance

- **Decision:** Use public context surfaces, serialisable contracts, or focused ports; keep read-model composition read-only.
- **Applies to:** Cross-context calls, Nest composition, queries, ports, and future extraction seams.
- **Owner:** D (Anthony).
- **Use when:** A context needs another context's data, behavior, or persistence information.
- **Change when:** A seam becomes a supported contract or changes ownership; document the data and transition implications.
- **Verify with:** Backend boundary checks, context tests, and read/write ownership review.

**Decision status:** Accepted
**Scope:** API context dependencies, read composition, ports, and extraction
readiness

## Context

A modular monolith still needs dependency direction. Directly importing a
neighbor's service, repository, DTO, or provider adapter creates a hidden seam
that is difficult to test or extract. At the same time, PMCM screens need
role-scoped views assembled from more than one owning context.

## Decision

Application-level cross-context production code uses one of these explicit
surfaces:

1. the owning context's public `index.ts` for a stable in-process capability;
2. a serialisable contract in a context `contracts/` folder or `@prism/types`;
3. a focused injected port/token for genuine dependency inversion, an optional
   integration, a policy seam, or a testing replacement.

Context composition roots may import another Nest module only to assemble the
in-process graph. That composition import is not an application-level business
API. Private concrete services, repositories, DTOs, provider adapters, and
deep filesystem paths are not supported cross-context interfaces.

`modules/read-models` is the only cross-context read composition area. It may
query or combine role-scoped data through approved ownership seams, map it to
shared read contracts, and expose read endpoints. It must not write business
state, become a command hub, or move authorization policy out of the owning
context.

Persistence remains one Prisma client. A query that reads another context's
table must document the owner, reason, allowed fields, and transition intent;
the shared database is not permission to create an unreviewed dependency.

## Rejected alternatives

- Private service imports were rejected because they couple callers to an
  implementation and bypass the owning context's contract.
- A universal shared business module was rejected because it creates an
  unowned dependency hub.
- Making every class implement an interface was rejected; a port needs a real
  inversion, replacement, or boundary.
- Allowing `read-models` to write was rejected because it would blur command
  ownership and make authorization/accountability unclear.
- Treating Nest module imports as business contracts was rejected; composition
  wiring is allowed only at composition roots.

## Consequences

- Context dependencies are reviewable and can be checked statically.
- Read-model endpoints can serve role apps without granting them business-write
  ownership.
- The current kernel audit dependency on `platform-ops` is visible as a seam to
  invert, not silently normalized as a permanent rule.
- Future microservice extraction has a clearer starting point, but still needs
  independent data, deployment, authentication, and operational decisions.

## Verification

Run `npm run check:boundaries`, `npm run test:boundaries`, the backend
architecture checker, and the touched API tests. For a new seam, verify that
the consumer imports a public index, serialisable contract, or focused port and
that `read-models` has no write path.

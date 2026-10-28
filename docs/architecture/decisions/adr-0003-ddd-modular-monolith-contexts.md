---
type: "Decision"
title: "DDD-shaped modular monolith contexts"
description: "Keep the Prism API as one NestJS deployable organized around business bounded contexts and a technical kernel."
tags: [architecture, decision, backend, ddd, modular-monolith]
status: canonical
updated: "2026-10-28"
authority: normative
audience: [agents, backend-engineers, reviewers]
scope: "apps/api/src/modules, kernel, and compatibility source"
last_verified: "1f73cea"
decision_date: "2026-09-01"
sources:
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism backend source-tree rules"
  - id: api-source
    resource: "apps/api/src"
    title: "Current DDD-shaped API source tree"
  - id: api-composition
    resource: "apps/api/src/app.module.ts"
    title: "Nest application composition root"
  - id: nest-config
    resource: "apps/api/nest-cli.json"
    title: "Nest project configuration"
---
# ADR-0003: DDD-shaped modular monolith contexts

## At a glance

- **Decision:** Organize one NestJS deployable around business bounded contexts and a technical kernel.
- **Applies to:** API source layout, Nest composition, persistence ownership, and extraction readiness.
- **Use when:** Creating or moving a backend capability, provider, repository, or module.
- **Change when:** Business ownership or deployment boundaries change; do not split folders by aesthetics.
- **Verify with:** Boundary checks, API typecheck/build/tests, and Prisma validation for affected changes.

**Decision status:** Accepted
**Scope:** API source layout, Nest composition, persistence ownership, and
future extraction readiness

## Context

The former API layout exposed many small Nest library roots for capabilities and
technical concerns. That made ownership difficult to see and did not create
independent deployables. Prism needs clear business boundaries now while
retaining the operational simplicity of one API and one database client.

## Decision

Prism uses one NestJS modular monolith, one API project, one Prisma client, and
business bounded-context roots under:

```text
apps/api/src/
├── modules/
│   ├── commercial/
│   ├── event-lifecycle/
│   ├── floorplan/
│   ├── identity-access/
│   ├── live-ops/
│   ├── operations/
│   ├── platform-ops/
│   └── read-models/
├── kernel/
└── fixtures/                 # local seed-only module, not imported by AppModule
```

The business contexts own policy and writes:

| Context | Ownership |
| --- | --- |
| `event-lifecycle` | inquiry/onboarding, compliance, closure, and file requirements |
| `commercial` | supplier sourcing, quotes, and billing |
| `operations` | staffing and guest workflows |
| `live-ops` | event-day tasks, urgent issues, escalation, attendance/replacement, and live status |
| `floorplan` | official live floorplans and venue-template authoring/publishing |
| `identity-access` | authentication and account approval workflows |
| `platform-ops` | trust/audit, notifications, and AI governance |
| `read-models` | role-scoped cross-context read composition; no writes |

Each context has a composition-root module and public `index.ts`. Internal
depth is progressive: add `api/`, `application/`, `contracts/`, `domain/`, or
`infrastructure/` when the capability has a real responsibility for that
layer; do not create empty folders for symmetry. Pure domain policies are
framework-independent and are added only for real invariants.

The kernel contains technical infrastructure such as database access, shared
validation, session/auth primitives, access policy, event-core helpers, and
health. It may be used by contexts but must not import business contexts.

## Rejected alternatives

- Keeping every small capability as a top-level Nest library was rejected
  because the composition tree obscured business ownership and produced many
  artificial roots.
- A single `event-ops` or shared business hub was rejected because it creates
  broad ownership and private cross-context coupling.
- A separate top-level context for every provider, technical helper, or
  deployment mode was rejected; those concerns belong inside their owner.
- Immediate microservice extraction was rejected because shared database,
  session, audit, and operational boundaries are not yet independently proven.

## Consequences

- Source ownership and context composition are visible in the repository.
- Contexts can become extraction candidates later because their public indices,
  contracts, and ports are explicit, but no network boundary is implied today.
- A shared Prisma client remains operationally simple while table ownership and
  cross-context joins are documented as separate concerns.
- A future context split requires an explicit ownership, data, deployment, and
  operational decision rather than a folder-only move.

## Verification

Run `npm run check:boundaries`, `npm run test:boundaries`, the API typecheck,
Nest build, Prisma validation, and the API test suite for a context-layout or
cross-context change. Review the current context contract register before
adding a dependency or table reference.

---
type: "Decision"
title: "Shared contracts and former sample compatibility"
description: "Keep shared write contracts in @prism/types; the former sample-runtime policy is superseded."
tags: [architecture, decision, contracts, zod, compatibility]
status: canonical
updated: "2026-09-30"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, frontend-engineers, backend-engineers]
scope: "@prism/types and @prism/api-client; former /sample runtime policy"
last_verified: "2026-09-30; shared-contract guidance and ADR-0007 aligned"
decision_date: "2026-09-01"
sources:
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism contract and sample-path rules"
  - id: types-package
    resource: "packages/types/src"
    title: "Shared Zod schemas and domain types"
  - id: api-client-package
    resource: "packages/api-client/src"
    title: "Shared HTTP transport and clients"
  - id: sample-retirement
    resource: "docs/architecture/decisions/adr-0007-retire-sample-runtime-keep-local-fixture-seeding.md"
    title: "Successor decision for sample runtime and local fixtures"
---
# ADR-0002: Shared contracts and former sample compatibility

## At a glance

- **Decision:** Shared-contract rules remain current; the sample-runtime policy is superseded by ADR-0007.
- **Applies to:** Zod contracts, read models, HTTP transport, and session keys. Sample routes below are historical context.
- **Owner:** D (Anthony).
- **Use when:** Adding a request body, shared type, API client call, or browser storage key.
- **Change when:** A contract boundary or compatibility policy changes; record the successor ADR.
- **Verify with:** Types build, touched API/portal checks, fixture-seed guard tests, and boundary checks.

**Decision status:** Accepted for shared contracts. The sample-runtime portion is superseded by ADR-0007 (2026-09-30).
**Scope:** HTTP request contracts, read models, API transport, and historical compatibility policy

## Context

Prism has four role applications and one API. Shared shapes must be validated at
the boundary and must not drift into app-local DTOs. When this ADR was accepted,
the repository also retained sample authentication and aggregate state for
demonstrations and reset flows. ADR-0007 supersedes that runtime decision and
records the move to seed-only local fixtures.

## Decision

- Put every shared write schema in `packages/types/src/schemas/` using Zod, and
  derive its TypeScript input with `z.infer`.
- Keep shared read-model interfaces and session/storage keys in `@prism/types`.
- Parse untrusted data with `parseContract` or `safeParse` at the feature/use-case
  boundary and use the shared `zodBody` adapter at Nest request boundaries.
- Keep HTTP transport and typed request helpers in `@prism/api-client`.
  Feature `data/` modules and thin portal adapters may call it; pages, views,
  and view-models may not call HTTP directly.
- Keep Prisma models private to the API. Controllers expose mapped contracts,
  not persistence types.
- The former `apps/api/src/compatibility/sample/` runtime has been removed by
  ADR-0007. Development records now live under `apps/api/src/fixtures/` and are
  inserted only by its explicit guarded seed command; `AppModule` does not load
  the fixture module.
- Keep session keys in `@prism/types`; apps must not add literal `prism:*`
  keys.
- `GET /api/sample/state` and `POST /api/sample/reset` are removed. Supported
  product flows use role-scoped APIs and read models.

After changing `@prism/types`, rebuild the package before API or portal
typechecks so generated `dist/` output cannot hide contract drift.

## Rejected alternatives

- App-local copies of shared Zod schemas or DTO types were rejected because the
  copies can diverge while compiling successfully.
- A type-only contract without runtime validation was rejected for writes and
  untrusted boundaries.
- Using `/api/sample/state` as the normal product API was rejected because it
  exposes broad aggregate state and bypasses role-owned read models.
- The former state route could not be made safe by a `NODE_ENV=production`
  disable alone: staging is shared and internet-reachable, and the aggregate
  returned supplier quote `accessToken` values that also authorize write routes.
  ADR-0007 records removal of that route rather than retaining it as an operator
  surface.
- Browser-only mock authentication and new app-local storage keys were rejected
  because they conceal API/session failures and weaken cross-app consistency.

## Consequences

- Contract changes are visible in one package and require a package build/test
  before consumers are trusted.
- Local development fixtures remain available through an explicit guarded seed
  command; they are not loaded into application runtime state.
- New endpoints need an owning bounded context and a role-scoped response.
- Temporary compatibility fallbacks must be named, fenced, and removed when the
  scoped contract fully covers the supported path.

## Verification

Run `npm --workspace @prism/types run build`, the touched API and portal
typechecks/tests, fixture-seed guard tests, and `npm run check:boundaries` when
the contract or fixture setup changes. Search for new app-local `prism:*` keys
and direct page/view/view-model HTTP calls during review.

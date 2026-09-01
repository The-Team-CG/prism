---
type: "Decision"
title: "Shared contracts and sample compatibility"
description: "Keep shared write contracts in @prism/types and fence broad sample routes to demo and compatibility use."
tags: [architecture, decision, contracts, zod, compatibility]
status: canonical
updated: "2026-09-01"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, frontend-engineers, backend-engineers]
scope: "@prism/types, @prism/api-client, and /sample compatibility paths"
last_verified: "581e676"
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
  - id: sample-compatibility
    resource: "apps/api/src/compatibility/sample"
    title: "Sample and compatibility routes"
---
# ADR-0002: Shared contracts and sample compatibility

## At a glance

- **Decision:** Keep shared write schemas in `@prism/types` and fence broad sample routes to compatibility use.
- **Applies to:** Zod contracts, read models, HTTP transport, session keys, and `/sample/*` behavior.
- **Owner:** D (Anthony).
- **Use when:** Adding a request body, shared type, API client call, sample flow, or browser storage key.
- **Change when:** A contract boundary or compatibility policy changes; record the successor ADR.
- **Verify with:** Types build, touched API/portal checks, sample tests, and boundary checks.

**Decision status:** Accepted
**Scope:** HTTP request contracts, read models, API transport, and demo paths

## Context

Prism has four role applications and one API. Shared shapes must be validated at
the boundary and must not drift into app-local DTOs. The repository also retains
sample authentication and aggregate state for demonstrations and reset flows;
that compatibility surface is intentionally broader than a role feature API.

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
- Keep `apps/api/src/compatibility/sample/` limited to `/sample/*`
  demo, seed, reset, and legacy compatibility behavior. New role features use
  scoped context APIs and contracts instead.
- Keep session and sample storage keys in `@prism/types`; apps must not add
  literal `prism:*` keys.

After changing `@prism/types`, rebuild the package before API or portal
typechecks so generated `dist/` output cannot hide contract drift.

## Rejected alternatives

- App-local copies of shared Zod schemas or DTO types were rejected because the
  copies can diverge while compiling successfully.
- A type-only contract without runtime validation was rejected for writes and
  untrusted boundaries.
- Using `/api/sample/state` as the normal product API was rejected because it
  exposes broad aggregate state and bypasses role-owned read models.
- Browser-only mock authentication and new app-local storage keys were rejected
  because they conceal API/session failures and weaken cross-app consistency.

## Consequences

- Contract changes are visible in one package and require a package build/test
  before consumers are trusted.
- Sample compatibility remains available for demos without becoming a product
  dependency.
- New endpoints need an owning bounded context and a role-scoped response.
- Temporary compatibility fallbacks must be named, fenced, and removed when the
  scoped contract fully covers the supported path.

## Verification

Run `npm --workspace @prism/types run build`, the touched API and portal
typechecks/tests, `npm run check:boundaries`, and the sample compatibility tests
when the contract or compatibility surface changes. Search for new app-local
`prism:*` keys and direct page/view/view-model HTTP calls during review.

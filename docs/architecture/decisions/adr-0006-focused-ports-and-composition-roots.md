---
type: "Architecture Decision Record"
title: "Focused ports and composition-root adapters"
description: "Invert real cross-context dependencies with focused ports while keeping the current modular monolith as one deployable system."
tags: [architecture, decision, ddd, modular-monolith, ports, extraction]
status: accepted
updated: "2026-10-28"
authority: normative
audience: [agents, backend-engineers, reviewers]
scope: "apps/api/src/kernel and bounded-context composition seams"
last_verified: "codex/architecture-alignment-fe-be"
sources:
  - id: context-contracts
    resource: "docs/architecture/context-contracts.md"
    title: "P.R.I.S.M context contracts"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "P.R.I.S.M current architecture"
  - id: persistence-ownership
    resource: "docs/architecture/persistence-ownership.md"
    title: "P.R.I.S.M persistence ownership and joins"
---
# ADR-0006: Focused ports and composition-root adapters

## At a glance

- **Decision:** Put a focused port at the consumer boundary when a real
  cross-context dependency needs inversion; bind the concrete adapter only at
  a composition root.
- **Applies to:** Kernel-to-context behavior, context integrations, optional
  providers, and read-model seams.
- **Does not mean:** A port is not automatically a network API, a new package,
  a new database, or a microservice.
- **Use when:** A consumer needs behavior owned elsewhere and direct concrete
  coupling would obscure ownership, testing, or extraction.
- **Do not use when:** A stable public context capability is already the right
  in-process contract or an interface would only rename one concrete class.

## Context

Prism is a modular monolith with one NestJS deployable and one Prisma client.
Some dependencies are intentionally cross-context: access control must emit
audit evidence, identity needs authentication telemetry, lifecycle needs file
metadata storage, and role read models combine data owned by several contexts.
Direct concrete imports in application code make those relationships harder to
test and would make a later transport boundary ambiguous.

## Decision

Use this dependency direction:

```text
consumer application -> consumer-owned port/token
composition root -> concrete adapter -> owning context implementation
```

The port must be narrow enough to describe the consumer need, use serialisable
or domain-safe inputs, and have a test replacement. The adapter may depend on
the owning context's implementation. Nest module imports are allowed at module
composition roots only.

The current implementations are:

| Consumer need | Port/token | Adapter/composition |
| --- | --- | --- |
| Kernel forbidden-access audit | `kernel/access-control` `AUDIT_WRITER` | `PlatformOpsAuditWriterModule` binds `AuditWriterAdapter` |
| Identity login and lockout audit | `identity-access` `AUTH_AUDIT` | `AuthAuditAdapter` is the only identity adapter that knows the platform audit implementation; authentication telemetry and lockout/forbidden alert paths record a known, hash-validated two-chain historical tail as an incident without denying normal responses, while broken hash links, audit-storage failures, and incident-write failures remain fail-closed |
| Lifecycle document storage | `event-lifecycle` `DOCUMENT_VAULT` | metadata-only document adapter is bound in the lifecycle module |
| Notification outbox writes | `platform-ops` `NOTIFICATION_OUTBOX_WRITER` | notification adapter binds the outbox implementation |
| Cross-context dashboard reads | `FINANCE_COMMANDS`, `STAFFING_READER`, `FLOORPLAN_READER`, `GUEST_READER` | owning contexts bind readers/commands; `read-models` maps and never writes |

The table is an implementation inventory, not permission to add a new broad
facade. New seams require an owner, a reason, a contract, and verification.

## Rejected alternatives

- Kernel importing `platform-ops` directly was rejected because it reverses
  technical-kernel dependency direction.
- A universal `WorkflowService` or `PlatformService` port was rejected because
  it recreates a god dependency with a new name.
- Splitting contexts into services now was rejected because deployment,
  authentication, data ownership, and operational boundaries are not yet
  independently proven.
- Ports for every class were rejected because unused abstractions add ceremony
  without improving a seam.

## Consequences

- Consumers can be unit-tested with focused fakes and no platform implementation.
- Composition roots remain the visible place to inspect runtime wiring.
- Persistence ownership still needs separate documentation because an
  in-process port does not stop accidental shared-table writes.
- A future service extraction has a candidate contract, but still requires a
  transport protocol, failure semantics, data migration, and operations plan.

## Verification

Run the API typecheck/build, focused context and DI tests, the API query audit,
the repository and backend boundary checks, and review the ownership register
when a port or table seam changes.

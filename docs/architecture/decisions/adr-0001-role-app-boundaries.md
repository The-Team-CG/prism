---
type: "Decision"
title: "Role-app boundaries"
description: "Keep Prism's client, supplier, guest, and PMCM event experiences as separate role-owned applications."
tags: [architecture, decision, frontend, roles]
status: canonical
updated: "2026-10-29"
authority: normative
audience: [agents, frontend-engineers, product-reviewers]
scope: "apps/client, apps/supplier, apps/guest, and apps/event"
last_verified: "2026-10-29; four portal app trees and event-games feature placement checked against source"
decision_date: "2026-09-01"
sources:
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism role ownership rules"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current application boundaries"
  - id: client-app
    resource: "apps/client/src/app"
    title: "Client portal routes"
  - id: event-app
    resource: "apps/event/src/app"
    title: "PMCM event command routes"
  - id: supplier-app
    resource: "apps/supplier/src/app"
    title: "Supplier portal routes"
  - id: guest-app
    resource: "apps/guest/src/app"
    title: "Guest portal routes"
---
# ADR-0001: Role-app boundaries

## At a glance

- **Decision:** Keep client, supplier, guest, and PMCM event experiences as separate role-owned applications.
- **Applies to:** Portal routes, role-visible data, shared UI, and cross-app flows.
- **Use when:** Adding a portal surface, moving a workflow, or sharing UI or contracts across apps.
- **Change when:** Actor ownership or a forbidden data boundary changes; record the successor ADR.
- **Verify with:** Role-forbidden tests, route checks, and repository boundary checks.

**Decision status:** Accepted
**Scope:** Prism web applications and role-visible product behavior

## Context

Prism is PMCM's internal event operating system. It has external participation
surfaces, but it is not an all-role public SaaS shell. A shared visual shell or
shared API does not give every actor permission to see every workflow or field.

## Decision

Keep four separate Next.js applications with explicit ownership:

| App | Primary actors | Owns | Must not own |
| --- | --- | --- | --- |
| `apps/client` | public visitors and clients | landing, inquiry, sign-in, client action center, client-visible status, layout preferences | PMCM commands, official floorplan mutation, supplier private data, audit internals |
| `apps/supplier` | suppliers and applicants | assigned quotes, quote submission, assignment confirmation, readiness, contract metadata, event-day status | other bids, client data, PMCM private reviews, internal costs |
| `apps/guest` | guests and walk-ins | access-code entry, event pass, consented check-in, moderated feedback, event game participation | planning, client/supplier dashboards, PMCM internals, cross-event reads |
| `apps/event` | PMCM and coordinators | command inbox, selected event workspace, official floorplans, suppliers, billing, compliance, live ops, event game hosting, closure, trust review | public marketing home, supplier/guest self-service ownership |

The shared `apps/api` serves all apps through role-scoped contracts and policy.
It does not own UI rendering or app-local session storage. `packages/ui` may
provide domain-free shells and presentation primitives, but it cannot absorb
role workflows or permission rules.

Every new cross-app flow names its actor, event scope, allowed fields, forbidden
fields, audit/notification expectation, empty state, error state, and evidence.

## Rejected alternatives

- A single all-role `apps/client` dashboard was rejected because it obscures
  actor ownership and increases the chance of private PMCM data leakage.
- Cross-imports between portal applications were rejected; shared contracts and
  package primitives are the supported reuse surfaces.
- A separate deployable for every role was rejected for the current product;
  app separation is a product and authorization boundary, not a requirement for
  four backend services.

## Consequences

- Role-specific route ownership and data scoping remain visible in the source
  tree.
- Shared UI must stay domain-free and role apps can evolve independently.
- Cross-role experiences require an explicit API contract instead of a copied
  component or broad aggregate state.
- URL-preserving route groups and feature slices may reorganize an app without
  changing its role ownership.

## Verification

Run `npm run check:boundaries` and `npm run test:boundaries`. For a sensitive
flow, add or run the role-forbidden test and a route check for the affected app;
do not treat a shared component render as proof of authorization.

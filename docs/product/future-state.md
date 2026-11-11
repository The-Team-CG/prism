---
type: "Product Target State"
title: "P.R.I.S.M future state"
description: "Durable target outcomes for a role-safe PMCM event operating system."
tags: [product, target-state, maturity]
status: canonical
updated: "2026-11-12"
authority: informative
audience: [product, engineering, design, reviewers]
scope: "Prism target product outcomes and maturity boundaries"
last_verified: "2026-11-12; static documentation review only, no runtime proof"
sources:
  - id: current-system
    resource: "docs/product/actual-system.md"
    title: "Current product system"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture"
---
# P.R.I.S.M future state

## At a glance

- **Purpose:** Describe durable target outcomes for PMCM's internal event operating system.
- **Authority:** Informative target model. The [feature ledger](feature-ledger.md) records active product decisions.
- **Scope:** Product outcomes, role boundaries, and maturity gates.
- **Use when:** Assessing whether proposed work advances the product target.
- **Change when:** A target outcome, role boundary, or dependency gate changes.
- **Verify with:** The current product model, feature ledger, evolution governance, and architecture decisions.

P.R.I.S.M carries a PMCM event from public inquiry through onboarding, planning,
supplier and coordinator work, guest operations, event day, closure, archive,
and learning. PMCM owns the workflow. Clients, suppliers, coordinators, and
guests use scoped views for their work.

The target is a coherent, role-safe operating system. A family can remain
partial when its working slices and open limits are clear. Use the feature
ledger for current implementation status and accepted decisions; this document
does not duplicate that inventory.

## Product outcomes

| Area | Target outcome |
| --- | --- |
| Lifecycle | Each event moves through inquiry, accepted inquiry, signed conforme, planning, event day, closure, and archive with clear ownership and evidence. |
| PMCM operations | PMCM works from the command inbox and selected-event workspace, with scoped workflows for planning, suppliers, billing, compliance, live operations, and closure. |
| External portals | Clients, suppliers, coordinators, and guests can complete their assigned work without access to PMCM internals or unrelated events. |
| Floorplans | PMCM owns official layouts. Clients submit preferences and review official snapshots without editing them. |
| Platform trust | Contracts, permissions, files, privacy, audit, notifications, and external dependencies have explicit owners and failure behavior. |
| Evidence | Milestone claims cite relevant route, actor, contract, boundary, behavior, and dependency evidence. Code presence alone is not runtime or browser acceptance. |

## Maturity boundaries

| Area | Target and remaining boundary |
| --- | --- |
| Planning templates | Event planning templates are implemented. FL-028 remains the broader workflow template builder for reusable templates across workflows. |
| Coordinator staffing | Coordinator selection, role views, availability, event-day work, and skill-based suggestions have implemented slices. FL-023's staffing heatmap and broader matching remain open. Suggestions do not grant assignment authority. |
| Cancellation and postponement | Freeze exceptions, impact review, and recorded postponement conflict history have implemented slices. Interactive rescheduling remains absent; operational policy defaults and addendum effects retain the limits in the feature ledger. |
| Closure and testimonials | Closeout, archive search, and testimonial consent/moderation have implemented slices. A broader testimonial library and post-event knowledge search remain open. |
| Event health | FL-018 still needs a defined formula, thresholds, stale-data behavior, route placement, and evidence. |
| Files and storage | Verified upload behavior exists for selected flows. Production provider activation, retention, and malware scanning remain gated. |
| Notifications | Queue-backed notification intent exists. Production delivery, retry outcomes, and delivery health require configured adapters and operational evidence. |
| AI | AI use cases have separate code, data, and deployment gates. A provider key or `AI_ZDR_CONFIRMED` setting alone does not qualify a use case or establish an approved ZDR route. Follow the [AI data policy](ai-data-policy.md) and [AI provider routing runbook](../runbooks/ai-provider-routing.md). No AI action may bypass PMCM approval. |
| QR and camera | QR passes and typed-code paths are distinct from camera support. Camera use depends on HTTPS, browser/device support, fallback behavior, masterlist reconciliation, and privacy review. |
| External auth | Built-in API auth and RBAC remain the current model. Any provider migration needs approved role mapping, session migration, fallback, tests, and rollback behavior. |

These boundaries describe product maturity, not a delivery sequence. The
feature ledger records family decisions and specific implementation limits.
Evolution governance defines readiness gates.

## Architecture boundary

The backend remains a modular monolith in `apps/api`, with Prisma as the shared
data-access layer. Context ownership, read-model composition, and kernel rules
are defined in the [current architecture](../architecture/current-architecture.md).
Product work must preserve the role-app split and must not add whole-system
sample routes.

## Completion rule

A milestone claim requires a working, role-safe slice or an explicit gate for
each lifecycle step. Every `FL-001` through `FL-028` family needs a recorded
outcome. Each high-risk dependency needs approval evidence or a named gate.

Do not claim system completion from static UI, mock state, or untested role
boundaries. Keep implementation, browser acceptance, production delivery, and
live database performance as separate evidence claims.

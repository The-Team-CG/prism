---
type: "Product Governance"
title: "P.R.I.S.M product evolution governance"
description: "Rules for adding, revising, merging, deferring, and retiring Prism feature families without losing role, contract, or operational clarity."
tags: [product, governance, features, decisions]
status: canonical
updated: "2026-10-29"
authority: normative
audience: [product, engineering, design, agents]
scope: "feature decisions, product documentation, system goals, and lifecycle governance"
last_verified: "2026-10-29; ledger FL-017..FL-028 rows and merge decisions; readiness gates against AGENTS.md and the storage workflow contract"
sources:
  - id: feature-ledger
    resource: "docs/product/feature-ledger.md"
    title: "Active feature-family decisions"
  - id: v4-reference
    resource: "docs/reference/prism-v4/complete-feature-catalog.md"
    title: "Source-preserving V4 catalog"
  - id: constitution
    resource: "docs/constitution.md"
    title: "Prism documentation and architecture constitution"
---
# P.R.I.S.M product evolution governance

## At a glance

- **Purpose:** Define how features are added, revised, merged, deferred, gated, or retired.
- **Authority:** Normative product decision process; it does not replace architecture ADRs or implementation checks.
- **Scope:** Feature-family decisions, system goals, evidence requirements, and documentation lifecycle.
- **Use when:** Evaluating a new feature, changing scope, or deciding whether an existing feature remains justified.
- **Change when:** Product authority, system goals, decision states, or evidence requirements change.
- **Verify with:** The feature ledger, product model, readiness gates below, and architecture boundaries.

This document defines how P.R.I.S.M can evolve beyond the original Version 4
catalog. The catalog remains a valuable baseline, but it is not a hard ceiling.
Features may be added, revised, merged, deferred, or retired when doing so makes
the product clearer, safer, more usable, or more aligned with PMCM operations.

## Product Authority Model

| Source | Role |
| --- | --- |
| `../reference/prism-v4/complete-feature-catalog.md` | Baseline feature inventory and original manuscript/defense reference. |
| `feature-ledger.md` | Active feature-family decisions. |
| `../architecture/current-architecture.md` | Architecture, module ownership, and stop rules. |
| `../../AGENTS.md` | App boundaries, system goals, and agent stop rules. |
| This document | Rules for changing the feature set. |

If these documents conflict, use this order for product planning:

1. Current app boundaries in `../../AGENTS.md`.
2. Architecture and feature ledger (`../architecture/current-architecture.md`, `feature-ledger.md`).
3. This product evolution governance document.
4. Current implementation evidence in the feature ledger, current architecture, and accepted ADRs.
5. Original feature catalog in `../reference/prism-v4/`.

The original catalog should still be preserved for traceability, but implementation should not blindly ship catalog items that are outdated, redundant, unsafe, or weak from a product perspective.

## System Goal Governance

Development has one primary maintainer. Evaluate work by its system outcome rather than former developer assignments.

| System goal | Outcome used for governance decisions |
| --- | --- |
| UX | Coherent information architecture, design system, workflow language and interaction standards. |
| PMCM operations | Executable inquiry, planning, event-day and closure workflows without exposing internal state externally. |
| External portals | Safe, narrow and clear client, supplier, guest and public workflows. |
| Platform trust | Reliable contracts, permissions, audit, notifications, files, lifecycle, integrations, verification and documentation. |

Every ledger row includes the affected role/context, permission boundary, audit/notification/file/lifecycle impact and verification requirement. Record an actual collaborator or reviewer when one participates; do not require former team assignments.

### Evaluate acceptance criteria as product decisions

For each mismatch, record both literal conformance and whether the written requirement remains a useful target. Use one of four actions: retain the stronger current design and revise the criterion; fix the implementation; resolve a business-rule tradeoff; or obtain missing evidence. State the user benefit, replacement observable criterion and remaining verification. Keep the original wording for traceability; do not rewrite criteria merely to make existing code pass.

A source-supported feature is not an executed acceptance pass. More screens, templates or infrastructure do not establish a better user journey. Runtime evidence and business-policy approval remain separate from implementation progress.

If a proposed feature does not advance one of these system goals, it should be deferred, revised, or retired.

## Allowed Feature Decisions

Every feature should eventually receive one of these decisions in the feature ledger:

| Decision | Meaning |
| --- | --- |
| Keep | Feature remains valid and should be implemented or hardened as described. |
| Revise | Feature is directionally valid but needs better UX, data model, workflow boundaries, or wording. |
| Merge | Feature should be combined with another feature to reduce duplication. |
| Split | Feature is too broad and should become multiple implementation slices. |
| Add | New feature not in the original catalog should be added because it improves the product. |
| Defer | Feature is useful but not needed until a later maturity stage. |
| Retire | Feature should be removed from active scope because it is outdated, redundant, unsafe, or no longer aligned. |
| Gate | Feature can exist only after a prerequisite is complete, such as privacy, storage, notification, auth, QR, or AI governance. |

## When to Add a Feature

Add a new feature when it meets at least one condition:

- It removes repeated manual PMCM work from the core lifecycle.
- It reduces operational risk on event day.
- It clarifies responsibility between PMCM, client, supplier, coordinator, or guest.
- It improves privacy, auditability, or security.
- It makes a key workflow easier to complete without training.
- It replaces several weaker catalog features with one stronger workflow.
- It supports the redesign system, such as shared workflow templates or status language.

Every new feature must include:

- Persona
- Problem
- Primary user action
- Data needed
- Permission boundary
- Audit/notification needs
- UX surface
- Verification requirement
- Phase placement

## When to Revise a Feature

Revise an existing feature when:

- The feature wording is too generic.
- The original design assumes an all-role dashboard.
- The feature duplicates another workflow.
- The feature creates unclear ownership between apps.
- The feature exposes too much internal PMCM state.
- The feature is useful but needs better sequencing.
- The feature belongs in a different persona app.
- The feature should be represented as a system behavior instead of a UI panel.

Examples:

- A generic "communication thread" should be revised into role-specific message surfaces with notification audit and visibility rules.
- A broad "file hub" should be revised into document categories, visibility, validation, source workflow, and required/missing states.
- A "dashboard" feature should be revised into a work queue, event workspace, or action center when that better fits the user job.

## When to Retire a Feature

Retire a feature from active scope when:

- It pushes P.R.I.S.M toward generic SaaS instead of PMCM's operating system.
- It duplicates another stronger workflow.
- It depends on external services that PMCM does not want to operate.
- It introduces privacy/security risk without clear value.
- It creates work for users without reducing operational risk.
- It is only useful as a sample artifact and not as a real PMCM workflow.

Retired features should remain traceable in the ledger with a short reason. Do not delete the historical catalog row unless the document is explicitly being regenerated as a new catalog version.

## Features Likely to Need Revision

These catalog areas should not be implemented literally without redesign:

| Area | Revision direction |
| --- | --- |
| Generic dashboards | Replace with command inboxes, work queues, event workspaces, or role-specific action centers. |
| Communication threads | Define visibility, channel, audit, and notification rules per role and per event. |
| File hub | Split into required files, uploaded assets, generated documents, visibility, validation, and source workflow. |
| AI features | Treat as reviewed recommendations, not autonomous actions. Gate behind ZDR, sanitizer, audit, and PMCM approval. |
| QR scanning | Gate behind HTTPS/camera constraints and masterlist reconciliation. |
| Public supplier registration | Make it a complete application workflow, not just a form. |
| Proposal integration | Treat Canva/PowerPoint/Zoom as adapters behind PMCM-controlled workflow state. |
| Event archive | Make it searchable operational knowledge, not just storage. |
| Security/privacy | Treat as PMCM-operated workflows, not passive compliance pages. |

Committed candidates and merged catalog families are recorded as feature-ledger
rows (FL-017 through FL-028 and the Merge decisions); do not keep a parallel
candidate list here.

## Product Review Gates

Before implementing or redesigning a feature, answer:

1. Which persona owns the action?
2. Which app owns the surface?
3. Which system goal does the change advance?
4. What system condition becomes true when this is complete?
5. What is the one primary user job?
6. What data does the user need?
7. What data must be hidden?
8. What state changes?
9. What must be audited?
10. What notification is created?
11. What file, lifecycle, integration, or privacy rule is affected?
12. What is the empty state?
13. What is the failure state?
14. What should happen on mobile?
15. Which feature ledger row is updated?

If these cannot be answered, the feature is not ready for implementation.

## Readiness Gates

A feature may claim readiness only when these gates hold:

- **Contract dependency:** UI depends on a field, filter, paging, upload state,
  error, or action result only after it exists in `@prism/types`,
  `@prism/api-client`, and focused tests. Lists stay bounded unless the
  endpoint names its paging/filter fields; infinite scroll, saved views,
  generalized grids, multipart or bulk upload, bulk action managers, and
  app-local error taxonomies wait for that support.
- **Cross-app data flow:** Name the source and target app, actor role, event
  scope, allowed and forbidden fields, audit and notification effect, empty and
  error states, and the verification command before UI depends on the flow.
- **Files:** An attachment counts only after the verified-storage rules in
  [client and supplier workflows](client-supplier-workflows.md#files) pass.
- **External dependencies:** AI, QR/camera, production notifications, external
  auth, and production storage follow the
  [external dependency policy](actual-system.md#external-dependency-policy).
- **Evidence:** Source or unit-test completion does not satisfy local database
  or HTTP acceptance, browser walkthroughs, staging evaluation, provider privacy
  review, or production approval; record each separately.

## Documentation Rules

Follow the documentation contract in [`../constitution.md`](../constitution.md#documentation-contract):
one canonical record per initiative (feature ledger for product work, ADRs for
architecture), no long-lived execution plans, and conversation-agnostic living
docs. Preserve the V4 catalog unless a new catalog version replaces it.

## How To Apply This Document

When evolving scope:

1. Update [`feature-ledger.md`](feature-ledger.md) with the decision and reason.
2. Mark affected catalog features as keep, revise, merge, split, add, defer, retire, or gate.
3. Add candidate features only when they materially improve PMCM operations.
4. Align the product model, readiness gates, and architecture stop rules when behavior changes.
5. Remove or rewrite outdated active planning docs rather than layering new ones.

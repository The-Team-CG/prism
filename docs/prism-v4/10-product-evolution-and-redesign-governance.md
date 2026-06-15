# P.R.I.S.M Product Evolution and Redesign Governance

Last updated: 2026-06-15

This document defines how P.R.I.S.M can evolve beyond the original Version 4 catalog. The catalog remains a valuable baseline, but it is not a hard ceiling. During the whole-app redesign, features may be added, revised, merged, deferred, or retired when doing so makes the product clearer, safer, more usable, or more aligned with PMCM operations.

## Product Authority Model

| Source | Role |
| --- | --- |
| `01-complete-feature-catalog.md` | Baseline feature inventory and original manuscript/defense reference. |
| `07-implemented-feature-revisions.md` | Current implementation reality and revision backlog. |
| `08-revision-phase-plan.md` | Historical revision-first roadmap. |
| `14-redesign-readiness-foundation.md` | Handoff rules for sample-state fencing, session conventions, owner boundaries, and legacy removal before UI redesign work. |
| `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` | Active whole-app redesign and capability maturity plan. |
| This document | Rules for changing the feature set during redesign. |

If these documents conflict, use this order for product planning:

1. Current app boundaries in `AGENTS.md`.
2. Whole-app redesign plan.
3. This product evolution governance document.
4. Current implementation backlog.
5. Original feature catalog.

The original catalog should still be preserved for traceability, but implementation should not blindly ship catalog items that are outdated, redundant, unsafe, or weak from a product perspective.

## Owner Goal Governance

Feature decisions must now identify which owner system goal they advance. Ownership is not just assignment to an app or code area.

| Owner | System goal used for governance decisions |
| --- | --- |
| Owner A | The change makes P.R.I.S.M more coherent as a PMCM operating system through IA, design system, workflow language, and interaction standards. |
| Owner B | The change makes PMCM/coordinator operations more executable from inquiry through event day and closure without exposing internal state externally. |
| Owner C | The change makes client, supplier, guest, or public surfaces safer, narrower, clearer, and easier to complete without PMCM-only leakage. |
| Owner D | The change makes platform behavior more trustworthy through contracts, permissions, audit, notifications, files, lifecycle, integrations, tests, and docs. |

Every ledger row should include:

- Primary owner.
- Owner system goal.
- Secondary owner if another surface is affected.
- Permission boundary.
- Audit/notification/file/lifecycle impact.
- Verification requirement.

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

## New Features to Consider During Redesign

These are not yet committed implementation requirements. They are candidates the redesign team should evaluate during Phase 0 and Phase 1.

| Candidate | Persona | Why it may improve P.R.I.S.M |
| --- | --- | --- |
| Event Command Inbox | PMCM | A unified queue of items requiring PMCM action across inquiries, conformes, billing, suppliers, coordinators, files, privacy, and live ops. |
| Event Health Score | PMCM | A deterministic score summarizing readiness, overdue actions, supplier/coordinator gaps, billing risk, document gaps, and live issues. |
| Decision Log | PMCM | Captures important choices, overrides, approvals, scope changes, and why they happened. More useful than generic activity for management review. |
| Client Action Center | Client | A focused list of what the client needs to do next across briefing, proposal, floorplan, documents, billing, and feedback. |
| PMCM Handoff Brief | PMCM/coordinator | Generates a concise operational brief from event state for coordinators and event-day operators. |
| Supplier Readiness Board | PMCM/supplier | Consolidates readiness confirmation, contract status, ingress schedule, concerns, and event-day setup state. |
| Coordinator Staffing Heatmap | PMCM | Shows availability, double-booking, staffing gaps, role coverage, and replacement options across event dates. |
| File Requirements Matrix | PMCM/client/supplier | Shows required documents by event type, owner, visibility, due date, validation state, and missing items. |
| Risk and Change Register | PMCM | Combines risk assessment, scope changes, addendum conformes, postponements, cancellations, and operational mitigations. |
| Event Day Run Sheet | PMCM/coordinator | Time-ordered operational run sheet combining supplier ingress, coordinator tasks, program moments, guest flow, and live issue status. |
| Privacy Operations Console | PMCM | Centralizes consent gaps, retention schedules, privacy requests, redaction state, and audit verification. |
| Workflow Template Builder | PMCM | Lets PMCM define reusable event templates for document requirements, supplier categories, coordinator roles, and compliance checks. |

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

## Features Likely to be Merged

| Feature family | Merge direction |
| --- | --- |
| FR-04 file hub, FR-32 document submission, FR-33 file hub access, FR-67 templates, FR-70 accreditation tracker | Merge into a document and file operations capability with role visibility and required-item matrix. |
| FR-05 live dashboard, Phase 6 event-day operations, Phase 7 reliability items, coordinator role views | Merge into live operations and coordinator command capability. |
| FR-19 CE builder, FR-60 proposal review, FR-69 payment terms, FR-20/FR-21 payment flows, cancellation/postponement finance | Merge into commercial workflow capability. |
| FR-14/FR-15 supplier directory, FR-17 quote requests, FR-75 assignment, New-SUP readiness/status | Merge into supplier network operations capability. |
| FR-22 closeout, FR-23 archive, New-P2 insights, New-P3 testimonials, New-P4 logistics | Merge into post-event knowledge and archive capability. |

## Product Review Gates

Before implementing or redesigning a feature, answer:

1. Which persona owns the action?
2. Which app owns the surface?
3. Which owner owns the system goal?
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

## Documentation Cleanup Rules

During redesign, outdated docs should be handled intentionally:

- Preserve historical catalog files unless a new catalog version is created.
- Remove or archive planning docs that contradict the current role-specific app boundaries.
- Rewrite planning docs that still use old product-name terminology.
- Prefer one active plan per initiative.
- Keep `00-index.md` current whenever new governing docs are added.
- Keep `MANIFEST.md` current enough to help navigation, but do not treat byte counts as authoritative planning data.

## Immediate Use

Phase 0 of the whole-app redesign should apply this document by:

1. Creating the feature ledger.
2. Adding `Decision` and `Decision reason` columns to the ledger.
3. Marking each original catalog feature as keep, revise, merge, split, add, defer, retire, or gate.
4. Adding candidate new features that materially improve PMCM operations.
5. Removing or rewriting outdated active planning docs.

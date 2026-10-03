---
type: "Decision"
title: "One PostgreSQL schema per owning domain"
description: "Assign every business table to exactly one write domain and keep foreign keys within that domain."
tags: [architecture, decision, persistence, ddd, postgres]
status: canonical
updated: "2026-10-03"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, reviewers, operators]
scope: "apps/api Prisma models, PostgreSQL namespaces, relations, and cross-context persistence contracts"
last_verified: "approved manifest validated against 91 source models at staging 7f64c0b"
decision_date: "2026-10-03"
sources:
  - id: approved-ownership
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Approved model, owner, and target-schema inventory"
  - id: persistence-register
    resource: "docs/architecture/persistence-ownership.md"
    title: "Current placement and target ownership register"
  - id: context-contracts
    resource: "docs/architecture/context-contracts.md"
    title: "Public context capabilities and read-model seams"
---
# ADR-0008: One PostgreSQL schema per owning domain

## At a glance

- **Decision:** Every business table has one owning write domain and resides in that domain's PostgreSQL schema in the target design.
- **Foreign keys:** Allowed within one domain; prohibited between different domains.
- **Deployment:** Keep one PostgreSQL database, one Prisma client, and the existing NestJS modular monolith.
- **Transition:** The accepted target does not claim that staging has already moved. Replace cross-domain writes and relations first, then move namespaces and remove external constraints in one rehearsed release.
- **Verify with:** The approved ownership manifest, persistence guard, PostgreSQL replay/equivalence checks, and a final zero-cross-domain-FK catalog query.

## Context

The codebase has seven write domains but the reviewed staging database has ten populated application schemas. Some schemas contain tables owned by multiple contexts, and 45 of 112 reviewed foreign keys cross domain boundaries under the approved owner map. A PostgreSQL namespace therefore does not consistently represent business ownership, and a cross-domain relation can make one domain's deletion policy mutate another domain's evidence.

Prism remains an internal PMCM event operating system and a modular monolith. This decision makes write ownership explicit without introducing microservices, separate databases, or a claim that schemas alone enforce authorization.

## Decision

The target schemas are:

| Write domain | PostgreSQL schema | Owns |
| --- | --- | --- |
| event-lifecycle | event_lifecycle | Inquiry, event lifecycle, briefing, document metadata, compliance, decisions, freeze/addenda, closure |
| commercial | commercial | Supplier network, quote requests and evidence, proposals, billing, payments and commercial communications |
| operations | operations | Coordinator pool, availability, coverage, assignments, acknowledgments, reliability notes, guest operations |
| live-ops | live_ops | Event-day tasks, schedule, operators, handoffs, end-of-day reports, issues and logs |
| floorplan | floorplan | Official plans, drafts, templates, published copies and review state |
| identity-access | identity_access | Accounts, approval requests, password recovery and account-authentication state |
| platform-ops | platform_ops | Audit, security, privacy orchestration, notifications, AI governance, storage metadata and command-receipt persistence |

The complete assignment of all 91 Prisma models, current namespaces, target namespaces, and column counts is maintained in apps/api/prisma/domain-ownership.json. Each model is assigned exactly once. A model move or reassignment updates that manifest and the canonical persistence register in the same review.

A foreign key may target a table owned by the same domain. A foreign key may not target another domain, even when both tables are in the same current physical schema. Cross-domain identifiers remain scalar values. The writing owner validates them through a focused public capability or transaction-aware contract when the operation requires live eligibility. Read-only cross-domain composition remains in read-models with explicit scope and public projections.

The schema boundary is a persistence organization rule, not a security boundary. The application continues to authorize actors through the established API/session policies. Database roles, grants, RLS, or service extraction require separate evidence and decisions.

## Ownership decisions

- Lifecycle owns document metadata and lifecycle eligibility. Commercial keeps contract and billing decisions, but asks the document-vault capability to register and validate document references.
- Commercial owns billing records. A future Lifecycle onboarding initializer must receive priced-source input, enforce the approved event/conforme gate through an owner capability, and be replay-safe; current briefing/conforme workflows do not create billing rows from signature alone. Lifecycle-issued addenda use a transaction-aware Commercial capability for billing-source and selected-quote changes, while Lifecycle retains addendum decisions and impact history.
- Operations owns assignment, attendance, replacement, cancellation, acknowledgment, and reliability-note writes, including requests initiated by LiveOps or lifecycle decisions.
- Floorplan owns official plan and review state. Lifecycle-facing event status fields are a temporary, versioned projection until consumers move; they do not grant lifecycle a second write authority over floorplan state.
- Platform-ops owns command-receipt persistence behind the existing kernel technical port. The command's business decision, authorization, and atomic replay transaction remain with its owning context.
- Platform-ops coordinates privacy requests. Each data-owning domain performs its own redaction/retention mutation through an owner capability; global audit and issued evidence follow their own retention rules.
- Coordinator reliability notes belong to Operations, matching the staffing writer and approved model manifest.

## Transition and constraints

1. Preserve all applied migration directories and their SQL byte-for-byte. Record new forward migrations only.
2. Keep the current physical schema map documented as transitional until owner capabilities and persistence tools are ready.
3. Before dropping a cross-domain FK or Prisma relation, prove that every write path uses the owning capability, historical reads survive, and deletion/disable behavior is explicit.
4. Convert only the approved 45 cross-domain FKs to scalar references in a coordinated, rehearsed namespace release. Keep same-domain FKs and add justified local constraints after orphan/event-scope preflight.
5. Move all 83 reassigned tables without changing IDs, rows, columns, or audit/receipt/outbox history. The exact table-to-schema transition comes from the manifest, not a broad schema rename.
6. Rehearse clean replay, a populated upgrade, query/tool/fixture updates, restore, and application/schema compatibility before integration.
7. Do not treat removal of an FK as a data cleanup. Preserve the identifier and replace its behavior with an owner contract.

The reviewed baseline includes 112 applied FKs: 67 classified local and 45 classified cross-domain. The approved quote-request repair adds a further same-Commercial constraint; this is a valid local integrity relation. Do not carry the baseline count forward after migrations without querying the resulting catalog.

## Consequences

- Each owner has a clear namespace and can enforce local invariants with same-domain keys and constraints.
- Cross-domain deletion no longer cascades into another owner's tables. Owners must define retention, redaction, archival, and missing-owner behavior before the coordinated cutover.
- Scalar cross-domain IDs require explicit capability checks for writes that depend on the referenced object. Read joins remain authorized and bounded.
- The Prisma schema temporarily contains external relations until replacement capabilities are implemented. The persistence migration is not complete until those relations and physical constraints are removed together.
- One database and deployable remain; no independent data plane is implied.

## Verification

Run the migration and boundary checks for source changes. During the coordinated schema release, require PostgreSQL 16 clean and populated replay, exact Prisma/catalog equivalence, a zero-cross-domain-FK query, all owner behavior suites, and tested restore/recovery. Static owner files or Prisma validation alone do not prove a live catalog is aligned.

---
type: "Decision"
title: "One PostgreSQL schema per owning domain"
description: "Assign every business table to exactly one write domain and keep foreign keys within that domain."
tags: [architecture, decision, persistence, ddd, postgres]
status: canonical
updated: "2026-10-29"
authority: normative
audience: [agents, engineers, reviewers, operators]
scope: "apps/api Prisma models, PostgreSQL namespaces, relations, and cross-context persistence contracts"
last_verified: "2026-10-06 baseline replay on disposable PostgreSQL 16; 2026-10-29 offline db:check:domain-persistence --final (132 models, 8 schemas, 0 cross-domain relations)"
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
- **Transition:** The approved pre-production history replacement uses seven owner-schema baselines on a clean database. Existing databases are unchanged and require a verified backup plus an approved rebuild before adopting the new ledger.
- **Verify with:** The approved ownership manifest, persistence guard, PostgreSQL replay/equivalence checks, and a final zero-cross-domain-FK catalog query.

## Context

The codebase has seven write domains. The pre-rebaseline staging snapshot had ten populated application schemas and 45 cross-domain foreign keys among 112 reviewed constraints. Some legacy schemas mixed tables owned by different contexts, and cross-domain delete actions could affect another domain's evidence. The replacement baseline now defines one schema per owner and no cross-domain relations on a fresh database.

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

`event-games` / `event_games` (game definitions, sessions, participation, scoring, moderation) was added later as an eighth write domain under this decision.

The complete assignment of every current Prisma model (94 at decision time), owner schemas, and column counts is maintained in apps/api/prisma/domain-ownership.json. Each model is assigned exactly once. A model move or reassignment updates that manifest and the canonical persistence register in the same review.

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

## Migration-history adoption (approved 2026-10-06)

The owner approved replacing the pre-production migration ledger before real
data is introduced. The former 102 migration folders are replaced by seven
ordered, owner-scoped schema baselines. The order is deterministic and each
baseline creates objects for exactly one domain schema. Same-domain foreign
keys remain; cross-domain foreign keys are not recreated. This is a
clean-database baseline, not a forward data migration.

The source change does not rewrite an existing database. An existing
pre-production database may still have the old Prisma ledger and physical
constraints. Before adopting the new history, take a backup, verify a restore,
confirm any data is disposable with its owner, and rebuild only the approved
pre-production database. If data must be kept, restore the retired migration
chain and design a separate data-preserving conversion.

1. Keep cross-domain IDs as scalar values and validate live references through owner capabilities.
2. Keep same-domain foreign keys and add only justified local constraints after owner review.
3. Do not interpret schema ownership as database privilege isolation.
4. Rehearse fresh replay, restore, schema equivalence, and application compatibility before rebuilding a shared pre-production database.
5. Never apply this pre-production history replacement to production; production requires its own plan.

The legacy staging snapshot recorded 112 FKs: 67 classified local and 45 cross-domain. The quote-request repair added a same-Commercial constraint in that history. The new clean-database baseline contains 76 same-domain FKs and zero cross-domain FKs, confirmed by the local PostgreSQL replay.

## Consequences

- Each owner has a clear namespace and can enforce local invariants with same-domain keys and constraints.
- Fresh databases created from these baselines do not cascade deletes across domains. Existing databases keep their legacy constraints until the approved rebuild; owner retention, redaction, archival, and missing-owner behavior remains explicit.
- Scalar cross-domain IDs require explicit capability checks for writes that depend on the referenced object. Read joins remain authorized and bounded.
- The current Prisma schema and fresh-database baselines contain no cross-domain relations. Existing databases may still retain legacy physical constraints until separately rebuilt.
- One database and deployable remain; no independent data plane is implied.

## Verification

At adoption, the seven baselines were applied to a fresh disposable PostgreSQL 16 database; migration status was current, the Prisma/catalog diff was empty, and the catalog showed 94 tables, 76 same-domain FKs, and zero cross-domain FKs. Existing staging adoption remains a separate backup-and-rebuild operation ([cutover runbook](../../runbooks/database-migrations.md#databases-with-the-retired-ledger)). For later changes, run `npm --workspace prism-api run db:check:domain-persistence` and `db:check:references`; they verify the current manifest has no cross-domain relation or private cross-owner write.

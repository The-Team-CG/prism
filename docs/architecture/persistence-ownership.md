---
type: "Persistence Ownership Register"
title: "P.R.I.S.M persistence ownership and intentional joins"
description: "At-a-glance ownership of Prisma models, physical database schemas, allowed cross-context reads, and documented transitional writes."
tags: [architecture, persistence, prisma, ddd, modular-monolith, data-ownership]
status: canonical
updated: "2026-10-03"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, reviewers]
scope: "apps/api/prisma/schema.prisma and apps/api/src/modules"
last_verified: "staging 7f64c0b; 91-model ownership manifest validated"
sources:
  - id: prisma-schema
    resource: "apps/api/prisma/schema.prisma"
    title: "Prism Prisma schema"
  - id: context-modules
    resource: "apps/api/src/modules"
    title: "Bounded-context modules and services"
  - id: read-models
    resource: "apps/api/src/modules/read-models/application/queries"
    title: "Role-scoped read-model queries"
  - id: approved-domain-ownership
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Approved table owners and target schema map"
  - id: migration-policy
    resource: "apps/api/prisma/migration-policy.json"
    title: "Prisma migration ownership policy"
  - id: migration-guard
    resource: "apps/api/scripts/check-prisma-migrations.mjs"
    title: "Prisma migration guard"
---
# P.R.I.S.M persistence ownership and intentional joins

## At a glance

- **Purpose:** Make database ownership and cross-context joins visible without
  pretending that one Prisma client is already several services.
- **Authority:** Normative for new writes and new cross-context queries.
- **Owner:** D (Anthony).
- **Use when:** Adding a Prisma read/write, changing a model, or designing a
  context extraction seam.
- **Rule:** The owning context controls invariants and writes. Other contexts
  use an owning public capability, focused port, or the read-model composition
  boundary. A physical PostgreSQL schema is useful evidence, not permission to
  write.
- **Verify with:** Context tests, query audit, Prisma validation, and the
  repository/backend boundary checks.

## Ownership vocabulary

| Term | Meaning |
| --- | --- |
| **Owner** | Context responsible for the model's invariants, write policy, and public mapping. |
| **Current physical schema** | PostgreSQL namespace currently declared by Prisma; the staging namespace is transitional until the approved move is rehearsed and integrated. |
| **Target schema** | The single PostgreSQL schema assigned to a write domain in ADR-0008 and the approved model manifest. |
| **Read** | A scoped projection or lookup explicitly allowed by the join register. |
| **Transitional write** | A known cross-context update retained for a workflow; it must be named, tested, and replaced by a command/event seam before service extraction. |
| **Read-model join** | Composition of owner-provided records for a role-safe response; it is never a business write authority. |

## Approved target schema map and owner

ADR-0008 establishes one PostgreSQL schema per owning write domain. The
current database stays one PostgreSQL database with one Prisma client; this
policy does not create microservices or a database authorization boundary.

| Write domain | Target schema | Tables | Columns | Owns |
| --- | --- | ---: | ---: | --- |
| event-lifecycle | event_lifecycle | 18 | 279 | Inquiry, events, lifecycle documents, briefing, compliance, decisions, freeze/addenda, closure |
| commercial | commercial | 28 | 319 | Suppliers, quotes, communications, estimates, proposals, billing, receipts |
| operations | operations | 12 | 142 | Coordinator pool, availability, coverage, assignments, acknowledgment/reliability, guest operations |
| live-ops | live_ops | 10 | 122 | Event-day tasks, schedule, operators, handoffs, end-of-day, urgent issues/logs |
| floorplan | floorplan | 6 | 72 | Plans, objects, templates, layout instances, published copies, official drafts |
| identity-access | identity_access | 4 | 38 | Accounts, approvals, password reset and authentication state |
| platform-ops | platform_ops | 13 | 187 | Privacy, security, login history, audit, notifications, AI, storage, command receipts |
| **Total** | **7 schemas** | **91** | **1,159** | Every business table has one owner |

The machine-readable domain ownership manifest linked above is the complete
model-level inventory. It records each current and target schema, domain owner,
table name, and scalar column count. This summary table is not a substitute for
the 91 model assignments.

The reviewed staging baseline has ten populated application schemas and 112
foreign keys. By target owner, 67 baseline keys are local and 45 cross domain.
The source and migration work have not yet moved all tables or removed the 45
external constraints. Preserve current placement as transitional evidence.
A quote-to-request relation is a valid same-Commercial constraint and is
repaired in its existing namespace before the schema cutover.

The rule is based on owning domain, not current namespace: a key between two
Commercial tables is permitted even if their tables currently live in
supplier_ops and finance_ops; a key from Commercial to Lifecycle is prohibited
even if a legacy table placement would make it look local. Cross-domain IDs
remain scalar values, with writes validated through the referenced owner's
public capability. Read-only composition remains scoped in read-models.

Approved domain ownership decisions:

- Lifecycle owns document metadata for every document kind; Commercial owns
  contract and billing decisions and references document IDs through the
  lifecycle capability.
- Commercial owns billing rows and exposes transaction-capable initialization
  for accepted-inquiry onboarding.
- Operations owns coordinator reliability notes and every assignment,
  attendance, replacement, cancellation, and acknowledgment mutation.
- Floorplan owns official plan and review state; lifecycle-facing status fields
  are temporary versioned projections during migration.
- Platform-ops owns command-receipt persistence behind the kernel technical
  port, and coordinates privacy work through domain-owned retention/redaction
  capabilities.
- Read-models composes authorized reads and never becomes a write owner.

## Current migration placement and historical ownership

Prism keeps one Prisma migration history under
`apps/api/prisma/migrations`. It remains a flat, append-only runtime tree because
Prisma's migration engine owns discovery, checksums, and the `_prisma_migrations`
ledger. New migration directory names carry the owning context:
`YYYYMMDDHHmmss_<owner>_<change_slug>`. Existing applied directories are
immutable and remain grandfathered in the policy.

The current migration policy maps owner-aware migrations to legacy physical schemas as follows. These permissions preserve the existing migration history during transition; they do not change ADR-0008 target ownership:

| Migration owner | Physical schemas | Boundary note |
| --- | --- | --- |
| `event-lifecycle` | `event_core`, `compliance_ops` | Inquiry, event, briefing, compliance, closure, and lifecycle records. |
| `commercial` | `supplier_ops`, `finance_ops` | Supplier network and finance persistence. |
| `operations` | `guest_ops`, `staffing_ops` | Guest workflows and coordinator/staffing records. |
| `live-ops` | `staffing_ops` | Event-day records in the intentionally shared staffing schema. |
| `floorplan` | `floorplan` | Official plans, drafts, templates, and snapshots. |
| `identity-access` | `identity` | Authentication, approval, session, and identity records. |
| `platform-ops` | `platform_ops`, `trust_ops` | Storage metadata, audit, notification, security, and AI governance. |

`staffing_ops` is intentionally shared by `operations` and `live-ops` while
their table ownership is split in this register. A migration that crosses an
owner boundary or changes a table-level exception requires an explicit policy
and ownership review; the schema allowlist is not blanket permission to write
another context's records. `read-models`, the kernel, and local fixture seed tooling
do not own business migrations.

`apps/api/scripts/check-prisma-migrations.mjs` enforces the policy for future
migrations: direct Prisma directory structure, immutable legacy names, unique
future versions and calendar timestamps, owner-aware names and headers,
normalized legacy SQL checksums, schema-qualified SQL and relation references,
allowed physical schemas, documented table-owner exceptions, inferred change
kind, and a risk declaration that cannot understate static risk. Unsupported
procedural/dynamic migration SQL fails closed. It is a static guard and does
not authorize database repair or deployment.

## Model ownership

### Floorplan

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `FloorPlan`, `FloorPlanObject`, `VenueTemplate`, `PublishedSnapshot`, `OpsFloorPlanDraft` | `floorplan` | `floorplan`; official layout authoring, draft, publish, and snapshot workflows. |

Floorplan owns authoritative official-plan and review state. Until the
projection migration is complete, a floorplan command requests a versioned
update of lifecycle-facing event fields through the lifecycle capability;
direct writes do not transfer ownership of the event lifecycle aggregate.

### Identity and access

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| OpsUser, OpsApprovalRequest, OpsPasswordResetToken, OpsPasswordResetRateLimit | identity | identity-access; authentication, approval, lockout, password recovery and account-authentication state. Target schema: identity_access. |

OpsLoginHistory and OpsSecurityAlert are platform-ops-owned even though
their current physical schema is identity; the target namespace is
platform_ops. Identity reaches platform audit behavior through AUTH_AUDIT.

### Event lifecycle and compliance

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsInquiry`, `OpsEvent`, `OpsBriefing` | `event_core` | `event-lifecycle`; inquiry intake, event creation, onboarding, and briefing state. |
| OpsDocument (all kinds) | event_core | event-lifecycle; document metadata, registration, eligibility and retention. Target schema: event_lifecycle. |
| `OpsComplianceRule`, `OpsComplianceCheck`, `OpsPostEventDocument`, `OpsEventInsight` | `compliance_ops` | `event-lifecycle`; compliance, closure gates, post-event records, and lifecycle insights. |

OpsDocument metadata has one owner: event-lifecycle. Commercial retains
business decisions and statuses, but validates and registers document IDs
through the document-vault capability. New kinds require an explicit
business owner and lifecycle metadata contract.

### Commercial

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsSupplier`, `OpsSupplierApplication`, `OpsSupplierCertification`, `OpsSupplierReview`, `OpsSupplierReliabilityNote` | `supplier_ops` | `commercial`; supplier directory, onboarding, certification, review, and reliability policy. |
| `OpsSupplierCategory`, `OpsSupplierReviewDimension`, `OpsSupplierReviewDimensionRating` | `supplier_ops` | `commercial`; reference and review-dimension configuration. Some rows are currently fixture-seeded and have no separate administration workflow. |
| `OpsSupplierQuoteRequest`, `OpsSupplierQuote` | `supplier_ops` | `commercial`; request, submission, revision, selection, and withdrawal lifecycle. |
| `OpsBillingSource`, `OpsBillingStatement`, `OpsPaymentMilestone`, `OpsPaymentRecord` | `finance_ops` | `commercial`; proposal-to-billing conversion, statements, milestones, and payment history. |
| Commercial contract and billing models | finance_ops / supplier_ops | commercial; retains business decisions and scalar document IDs. Lifecycle alone owns document metadata and validates references through its public capability. Target schema: commercial. |

### Operations and live operations

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsCoordinatorAssignment` | `staffing_ops` | `operations`; owns assignment, attendance, replacement, cancellation, acknowledgment, and reliability mutations. LiveOps and Lifecycle callers use the Operations capability; event decisions pass the initiating transaction context. |
| `OpsGuestCheckIn`, `OpsGuestFeedback` | `guest_ops` | `operations`; guest check-in, consent, feedback, and moderation workflows. |
| `OpsCoordinator` | `staffing_ops` | Reference data is currently fixture-seeded and read through operations; add a real directory owner before introducing administration writes. |
| OpsEventDayTask, OpsUrgentIssue, OpsEventDayLog | staffing_ops | live-ops; event-day task, issue, log, and escalation workflows. Target schema: live_ops. |
| OpsCoordinatorReliabilityNote | staffing_ops | operations; coordinator reliability history, matching its focused writer. Target schema: operations. |

### Platform trust, notifications, and AI governance

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| OpsAuditLog, OpsNotificationLog, OpsSecurityAlert, OpsPrivacyRequest, OpsLoginHistory | trust_ops, identity, and event_core as declared in Prisma | platform-ops; audit, outbox, security, privacy governance, and login history. Target schema: platform_ops. Each data owner executes redaction through a focused capability. |
| OpsCommandReceipt | trust_ops | platform-ops owns receipt persistence behind the kernel technical port. Business command authorization and replay remain in the calling owner transaction. Target schema: platform_ops. |
| `OpsAiAuditLog`, `OpsAiApprovalRecord` | `trust_ops` | `platform-ops`; AI sanitisation, human approval, and governance records. |

## Intentional cross-context joins and writes

Read-model collection queries use named per-collection `take` limits and a
deterministic timestamp or business-key order with an ID tie-breaker. Nested
history (floorplan drafts, supplier history, acknowledgements, and event-day
logs) is bounded independently. Where a response derives readiness or
attendance counts from a collection, the query runs an exact count alongside
the bounded rows so a high-volume result cannot silently change the aggregate.
Consumers should treat these arrays as bounded windows until an explicit paged
contract is introduced.

| Caller | Owner/resource | Allowed operation | Reason and guardrail |
| --- | --- | --- | --- |
| `read-models` | `event-lifecycle`, `commercial`, `operations`, `live-ops`, `floorplan`, `platform-ops` | Read scoped rows and map to role contracts | Build PMCM/client/supplier/coordinator projections. Queries stay bounded and read-only; authorization remains in the owning context/controller. |
| event-lifecycle | Commercial billing capability | Initialize billing and request owner-approved billing changes | Commercial owns these records; direct lifecycle writes remain transitional until routed through the capability. Preserve eligibility, replay, and outbox atomicity. |
| commercial | event-lifecycle document-vault capability | Register and validate contract/billing document references | Commercial retains business state; lifecycle owns metadata and validates event, kind, and eligibility. |
| `commercial` | `OpsEvent`, `OpsInquiry` | Read event scope/client source; invoke lifecycle/public capabilities where needed | Billing and supplier requests require event and inquiry context; no direct lifecycle status mutation. |
| floorplan | event-lifecycle event capability | Publish a versioned floorplan-state projection | Floorplan currently writes lifecycle fields directly; replace that path with a versioned contract. Lifecycle owns the event aggregate and rejects stale projection updates. |
| live-ops | Operations staffing capability | Request owner-validated assignment, replacement, and attendance transitions | LiveOps currently writes assignment rows directly; Operations owns the mutation and applies it under event scope. |
| event-lifecycle | Operations staffing capability | Request owner-validated cancellation and postponement transitions | Event-decision workflows currently write assignments directly; Operations applies the transition within the caller transaction. |
| `platform-ops` privacy workflow | identity, event, commercial, guest records | Locate and anonymise/delete subject data when an approved privacy request executes | Governance requires a coordinated erasure transaction. Each affected model is named in the workflow; this is not general write permission. |
| `identity-access` | platform trust records | Login-history and lockout telemetry via `AUTH_AUDIT` | Keeps platform implementation out of identity application code while the physical table ownership is clarified. |
| `kernel/access-control` | platform audit | Emit forbidden-access evidence via kernel `AUDIT_WRITER` | Kernel stays business-context-free; the composition root binds the platform adapter. |
| Local fixture seed tooling | selected development-reference models | Direct inserts only through the guarded CLI into an empty disposable local database; the API has no fixture routes or reset workflow. | Fixture setup is not a product write path and does not own ongoing business writes. |

## Join rules for new work

Before adding a cross-context query or write, record:

1. the owner and physical model/schema;
2. the exact fields and row scope needed;
3. whether the operation is a read, owner command, focused port, or named
   transitional write;
4. the actor/authorization boundary and audit requirement;
5. the replacement contract and data-isolation implication if extraction is a
   real future goal.

Do not add a general-purpose Prisma repository, context-wide workflow facade,
or read-model write. A model move without a change to this register is
incomplete.

## Verification

```powershell
npm run check:boundaries
npm run test:boundaries
npm --workspace prism-api run db:audit:queries
npm --workspace prism-api run prisma:validate
npm --workspace prism-api run typecheck
```

Live schema/index audits require database credentials; offline query and Prisma
checks remain required for a source-only change.

---
type: "Persistence Ownership Register"
title: "P.R.I.S.M persistence ownership and intentional joins"
description: "At-a-glance ownership of Prisma models, physical database schemas, allowed cross-context reads, and documented transitional writes."
tags: [architecture, persistence, prisma, ddd, modular-monolith, data-ownership]
status: canonical
updated: "2026-10-06"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, reviewers]
scope: "apps/api/prisma/schema.prisma and apps/api/src/modules"
last_verified: "local s11-cutover worktree; 93-model manifest, Prisma validation, persistence guard, and populated PostgreSQL cutover replay passed 2026-10-06; Prisma migrate deploy was not exercised"
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
| event-lifecycle | event_lifecycle | 18 | 280 | Inquiry, events, lifecycle documents, briefing, compliance, decisions, freeze/addenda, closure |
| commercial | commercial | 28 | 319 | Suppliers, quotes, communications, estimates, proposals, billing, receipts |
| operations | operations | 12 | 142 | Coordinator pool, availability, coverage, assignments, acknowledgment/reliability, guest operations |
| live-ops | live_ops | 10 | 122 | Event-day tasks, schedule, operators, handoffs, end-of-day, urgent issues/logs |
| floorplan | floorplan | 7 | 75 | Plans, objects, templates, layout instances, published copies, official drafts, projection clock |
| identity-access | identity_access | 4 | 42 | Accounts, approvals, password reset and authentication state |
| platform-ops | platform_ops | 14 | 201 | Privacy requests and legal holds, security, login history, audit, notifications, AI, storage, command receipts |
| **Total** | **7 schemas** | **93** | **1,181** | Every business table has one owner |

The machine-readable domain ownership manifest linked above is the complete
model-level inventory. It records each current and target schema, domain owner,
table name, and scalar column count. Ten tables already reside in their owner
schema; the coordinated cutover moves the other 83.

The cutover retires no tables or columns. The separate
[column authority register](column-authority-register.md) records the reviewed
trim candidate (`OpsEventDecision.storage_intent`) and why response
compatibility, historical values, and owner approval must be resolved before a
separate retirement migration. Other columns remain pending owner or usage
evidence; none is treated as removable based on lexical search alone.

The [domain schema map](domain-schema-map.md) shows the reviewed baseline and
the one-schema-per-domain target. It distinguishes the current physical
database from the target Prisma layout represented on the cutover branch.

Use the [active column authority register](column-authority-register.md) for each baseline field's
physical type, nullability, default, provisional semantics, candidate consumers, sensitivity and DDL
disposition. The register does not approve unresolved business units, timezones or retention periods.

The reviewed staging baseline has ten populated application schemas and 45
cross-domain foreign keys. By target owner, 68 same-domain foreign keys are
retained. The cutover migration removes the 45 external constraints while
preserving same-domain constraints. A populated disposable PostgreSQL replay
confirmed 93 tables retained their relation OIDs, row counts, and index counts;
the post-cutover catalog had 68 same-schema foreign keys and no cross-schema
foreign keys. The replay used psql after applying the branch's four pending
forward migrations; Prisma's migrate deploy command was not exercised.
The quote-to-request relation remains a valid same-Commercial constraint and
is repaired in its existing namespace before cutover.

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
- Commercial owns billing rows. Current Lifecycle briefing/conforme workflows
  do not initialize billing because they provide no priced-source input; a
  future initializer requires an approved product contract, owner-validated
  eligibility, and replay safety. Lifecycle-issued addenda request
  transaction-aware Commercial billing-source and selected-quote changes,
  while Lifecycle owns addendum impact history.
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

The migration policy maps each owner to exactly one physical schema, matching ADR-0008. Migrations before the cutover keep their original schema names through the frozen historical policy:

| Migration owner | Physical schema | Boundary note |
| --- | --- | --- |
| `event-lifecycle` | `event_lifecycle` | Inquiry, event, briefing, compliance, closure, and lifecycle records. |
| `commercial` | `commercial` | Supplier network, communications, estimates, proposals, and billing. |
| `operations` | `operations` | Coordinator pool, assignments, reliability, and guest operations. |
| `live-ops` | `live_ops` | Event-day tasks, schedule, handoffs, issues, and logs. |
| `floorplan` | `floorplan` | Official plans, drafts, templates, and snapshots. |
| `identity-access` | `identity_access` | Authentication, approval, and password-recovery records. |
| `platform-ops` | `platform_ops` | Privacy, audit, notification, security, storage, receipts, and AI governance. |

A migration that touches another owner's schema fails the guard, so a physical
schema is never permission to write another context's records. `read-models`,
the kernel, and local fixture seed tooling do not own business migrations.

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

Floorplan owns authoritative official-plan and review state. Event-scoped
mutations ask Lifecycle's `FLOORPLAN_EVENT_REFERENCE_READER` to lock and return
current conforme, ocular, archive, freeze, portal, and projection facts in the
same transaction. Official-draft eligibility is checked from those owner
facts; archived or frozen events reject writes, while authorized historical
reads remain available. Floorplan sends lifecycle-facing status through the
versioned projection writer; direct writes do not transfer event ownership.
Drafts reference the event by scalar ID only; the cutover removed the
draft-to-event foreign key.

### Identity and access

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| OpsUser, OpsApprovalRequest, OpsPasswordResetToken, OpsPasswordResetRateLimit | identity_access | identity-access; authentication, approval, lockout, password recovery and account-authentication state. |

OpsLoginHistory and OpsSecurityAlert are platform-ops-owned and live in
platform_ops. Identity reaches platform audit behavior through AUTH_AUDIT.

### Event lifecycle and compliance

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsInquiry`, `OpsEvent`, `OpsBriefing` | `event_lifecycle` | `event-lifecycle`; inquiry intake, event creation, onboarding, and briefing state. |
| OpsDocument (all kinds) | event_lifecycle | event-lifecycle; document metadata, registration, eligibility and retention. |
| `OpsComplianceRule`, `OpsComplianceCheck`, `OpsPostEventDocument`, `OpsEventInsight` | `event_lifecycle` | `event-lifecycle`; compliance, closure gates, post-event records, and lifecycle insights. |

OpsDocument metadata has one owner: event-lifecycle. Commercial retains
business decisions and statuses, but validates and registers document IDs
through the document-vault capability. New kinds require an explicit
business owner and lifecycle metadata contract.

### Commercial

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsSupplier`, `OpsSupplierApplication`, `OpsSupplierCertification`, `OpsSupplierReview`, `OpsSupplierReliabilityNote` | `commercial` | `commercial`; supplier directory, onboarding, certification, review, and reliability policy. |
| `OpsSupplierCategory`, `OpsSupplierReviewDimension`, `OpsSupplierReviewDimensionRating` | `commercial` | `commercial`; reference and review-dimension configuration. Some rows are currently fixture-seeded and have no separate administration workflow. |
| `OpsSupplierQuoteRequest`, `OpsSupplierQuote` | `commercial` | `commercial`; request, submission, revision, selection, and withdrawal lifecycle. Deleting a request referenced by submitted quote evidence is restricted; requestId remains nullable for manually entered quotes. |
| `OpsBillingSource`, `OpsBillingStatement`, `OpsPaymentMilestone`, `OpsPaymentRecord` | `commercial` | `commercial`; proposal-to-billing conversion, statements, milestones, and payment history. |
| Commercial contract and billing models | commercial | commercial; retains business decisions and scalar document IDs. Lifecycle alone owns document metadata and validates references through its public capability. |

### Operations and live operations

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsCoordinatorAssignment` | `operations` | `operations`; owns assignment, attendance, replacement, cancellation, acknowledgment, and reliability mutations. LiveOps and Lifecycle callers use the Operations capability; event decisions pass the initiating transaction context. |
| `OpsGuestCheckIn`, `OpsGuestRosterEntry`, `OpsGuestFeedback`, `OpsGuestFeedbackMedia` | `operations` | `operations`; guest roster identity/contact data, check-in, consent, feedback, moderation, and feedback filename metadata. Stored media bytes remain in the storage provider and are outside database redaction. |
| `OpsGuestCheckIn`, `OpsGuestFeedback`, guest roster and registration records | `operations` | `operations`; guest check-in, consent, feedback, moderation, roster and registration workflows. Event command checks use Lifecycle’s scoped reference capability; Commercial owns supplier/category/selection checks for registration links. |
| `OpsCoordinator` | `operations` | Reference data is currently fixture-seeded and read through operations; add a real directory owner before introducing administration writes. |

Guest provenance stays inside Operations and agrees on the event: a roster entry
references its import batch, and a check-in references its roster entry, through
composite same-schema foreign keys on `(id, event_id)` with `RESTRICT`.
Roster entries and imports are only withdrawn or retained, never deleted, so the
links protect check-in evidence. Walk-in check-ins keep a null roster link. The
migration clears an untrusted link (missing parent or a parent in another event)
to NULL and keeps the row. The import batch row is now written before the entries
that reference it.
| OpsEventDayTask, OpsUrgentIssue, OpsEventDayLog | live_ops | live-ops; event-day task, issue, log, and escalation workflows. |
| OpsCoordinatorReliabilityNote | operations | operations; coordinator reliability history, matching its focused writer. |

### Platform trust, notifications, and AI governance

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| OpsAuditLog, OpsNotificationLog, OpsSecurityAlert, OpsPrivacyRequest, OpsLoginHistory | platform_ops | platform-ops; audit, outbox, security, privacy governance, and login history. Each data owner executes redaction through a focused capability. |
| OpsCommandReceipt | platform_ops | platform-ops owns technical receipt persistence behind the kernel `CommandReceiptStore` port. Business authorization and replay remain in the caller transaction; reservation, command writes, and completion are atomic. |
| `OpsPrivacyLegalHold` | `platform_ops` | `platform-ops`; PMCM-admin placement/release, subject and optional event scope, with release provenance. `event_id` is a scalar reference and has no cross-domain FK. |
| `OpsAiAuditLog`, `OpsAiApprovalRecord` | `platform_ops` | `platform-ops`; AI sanitisation, human approval, and governance records. |

## External-reference lifecycle

The exact baseline foreign-key actions and additional scalar references are in
the [external-reference lifecycle register](external-reference-lifecycle.md)
and linked machine policy. The pre-cutover baseline had 45 cross-domain foreign
keys (38 CASCADE, 6 SET NULL, 1 RESTRICT) and 28 additional scalar references.
Those delete actions describe baseline database behavior, not approved
retention policy. The cutover migration removed all 45 constraints and kept the
scalar references and indexes. It has been replayed on disposable PostgreSQL
only; no shared or production database has run it.

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
| `identity-access` | event, inquiry, supplier, and coordinator participant facts | `@prism/contexts/read-models/participant-facts`; caller transaction is forwarded when supplied | Identity keeps approved-account and role policy, email matching, verified actor stamping, and EventAccessPolicy checks. The read module returns only scoped event identity, supplier assignment/contact, and coordinator assignment/user-link facts; no cross-domain FK or write is introduced. |
| event-lifecycle | Commercial billing capability | Initialize billing and request owner-approved billing changes | Commercial owns these records; direct lifecycle writes remain transitional until routed through the capability. Preserve eligibility, replay, and outbox atomicity. |
| commercial | event-lifecycle document-vault capability | Register and validate contract/billing document references | Commercial retains business state; lifecycle owns metadata and validates event, kind, and eligibility. |

| floorplan | event-lifecycle reference and projection capabilities | Validate event/conforme/ocular/freeze/archive state and publish a versioned floorplan-state projection | Implemented through `FLOORPLAN_EVENT_REFERENCE_READER` and Lifecycle's compare-and-set writer. Floorplan locks Lifecycle state before local draft changes and projection-clock reservation; cross-domain FKs remain until cutover. |
| live-ops | Operations staffing capability | Request owner-validated assignment, replacement, and attendance transitions | LiveOps currently writes assignment rows directly; Operations owns the mutation and applies it under event scope. |
| event-lifecycle | Operations staffing capability | Request owner-validated cancellation and postponement transitions | Event-decision workflows currently write assignments directly; Operations applies the transition within the caller transaction. |
| `platform-ops` privacy workflow | identity, event, commercial, guest records | Locate and anonymise/delete subject data when an approved privacy request executes | Governance requires a coordinated erasure transaction. Each affected model is named in the workflow; this is not general write permission. |
| `commercial` | `OpsEvent`, `OpsInquiry` | Read event scope/client source; invoke lifecycle/public capabilities where needed | Additional billing uses Lifecycle's locked post-event reader; other direct event and inquiry reads remain transitional. Commercial does not mutate Lifecycle status. |
| `operations` | `OpsEvent` | Validate event state in guest and staffing commands; use narrowly scoped client-access facts | The Lifecycle reference capability locks event rows in command transactions. Guest access-code and coordinator workspace projections use the public read-model capability; its Prisma composition selects only required fields and bounds related floorplan drafts. |
| `operations` | `OpsSupplier`, `OpsSupplierCategory`, selected quote requests | Validate registration supplier eligibility through Commercial | Commercial owns supplier/category/selection reads and row locks. Existing links remain editable when a category becomes inactive; active category is required for a new or changed supplier link. |
| floorplan | event-lifecycle event capability | Publish a versioned floorplan-state projection | Implemented through the Lifecycle compare-and-set capability. Floorplan persists its draft and projection clock in its own transaction; Lifecycle rejects stale versions. |
| live-ops | Operations staffing and LiveOps-reference capabilities; Lifecycle event-reference capability | Request owner-validated assignment transitions; validate current operator and handoff references and event state | Operations locks and rechecks coordinator profile and event-assignment eligibility in the caller transaction. Lifecycle supplies event state. LiveOps owns designation/handoff history and action authorization; the external FKs remain until the coordinated schema cutover. |
| event-lifecycle | Operations staffing capability | Request owner-validated cancellation and postponement transitions | Implemented: Lifecycle passes its transaction to Operations, which validates and applies assignment transitions atomically. |
| platform-ops privacy workflow | identity, event, commercial, guest records | Coordinate approved owner-specific retention or redaction actions | No generic cascade orchestrator exists. Owner-scoped receipts, legal-hold checks, partial retry, and audit/evidence preservation are required before destructive execution. Physical event deletion is unsupported. |
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

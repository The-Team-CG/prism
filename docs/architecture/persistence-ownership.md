---
type: "Persistence Ownership Register"
title: "P.R.I.S.M persistence ownership and intentional joins"
description: "At-a-glance ownership of Prisma models, physical database schemas, allowed cross-context reads, and documented transitional writes."
tags: [architecture, persistence, prisma, ddd, modular-monolith, data-ownership]
status: canonical
updated: "2026-09-01"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, reviewers]
scope: "apps/api/prisma/schema.prisma and apps/api/src/modules"
last_verified: "codex/architecture-alignment-fe-be"
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
| **Physical schema** | PostgreSQL namespace currently declared by Prisma; it may lag effective domain ownership during consolidation. |
| **Read** | A scoped projection or lookup explicitly allowed by the join register. |
| **Transitional write** | A known cross-context update retained for a workflow; it must be named, tested, and replaced by a command/event seam before service extraction. |
| **Read-model join** | Composition of owner-provided records for a role-safe response; it is never a business write authority. |

## Model ownership

### Floorplan

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `FloorPlan`, `FloorPlanObject`, `VenueTemplate`, `PublishedSnapshot`, `OpsFloorPlanDraft` | `floorplan` | `floorplan`; official layout authoring, draft, publish, and snapshot workflows. |

`floorplan` may update only the floorplan-related fields on `OpsEvent`
(`floorPlanId`, status, and review timestamps) through its workflow. The event
record and lifecycle status remain owned by `event-lifecycle`.

### Identity and access

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsUser`, `OpsApprovalRequest` | `identity` | `identity-access`; authentication, account approval, lockout state, and role assignment. |

`OpsLoginHistory` is listed under platform trust below because its current
writer is the platform audit service. Its physical schema is `identity`; this
is an intentional schema/ownership mismatch to resolve before independent
identity extraction. The identity application reaches it through `AUTH_AUDIT`.

### Event lifecycle and compliance

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsInquiry`, `OpsEvent`, `OpsBriefing` | `event_core` | `event-lifecycle`; inquiry intake, event creation, onboarding, and briefing state. |
| `OpsDocument` (inquiry/onboarding kinds) | `event_core` | `event-lifecycle`; document requirements and onboarding metadata. |
| `OpsComplianceRule`, `OpsComplianceCheck`, `OpsPostEventDocument`, `OpsEventInsight` | `compliance_ops` | `event-lifecycle`; compliance, closure gates, post-event records, and lifecycle insights. |

`OpsDocument` is a shared physical table with kind-based ownership. Supplier
contract and billing-document kinds are commercial-owned; lifecycle owns only
its documented onboarding/closure kinds. New document kinds must name an owner
before implementation.

### Commercial

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsSupplier`, `OpsSupplierApplication`, `OpsSupplierCertification`, `OpsSupplierReview`, `OpsSupplierReliabilityNote` | `supplier_ops` | `commercial`; supplier directory, onboarding, certification, review, and reliability policy. |
| `OpsSupplierCategory`, `OpsSupplierReviewDimension`, `OpsSupplierReviewDimensionRating` | `supplier_ops` | `commercial`; reference and review-dimension configuration. Some rows are currently sample-seeded and have no separate administration workflow. |
| `OpsSupplierQuoteRequest`, `OpsSupplierQuote` | `supplier_ops` | `commercial`; request, submission, revision, selection, and withdrawal lifecycle. |
| `OpsBillingSource`, `OpsBillingStatement`, `OpsPaymentMilestone`, `OpsPaymentRecord` | `finance_ops` | `commercial`; proposal-to-billing conversion, statements, milestones, and payment history. |
| `OpsDocument` (supplier/billing kinds) | `event_core` | `commercial`; contract and billing document metadata through the document-vault capability. |

### Operations and live operations

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsCoordinatorAssignment` | `staffing_ops` | `operations`; day-to-day staffing assignment and coordinator workspace. Live-ops event-day replacement/attendance updates are named transitional writes. |
| `OpsGuestCheckIn`, `OpsGuestFeedback` | `guest_ops` | `operations`; guest check-in, consent, feedback, and moderation workflows. |
| `OpsCoordinator` | `staffing_ops` | Reference data is currently sample-seeded and read through operations; add a real directory owner before introducing administration writes. |
| `OpsEventDayTask`, `OpsUrgentIssue`, `OpsEventDayLog`, `OpsCoordinatorReliabilityNote` | `staffing_ops` | `live-ops`; event-day task, urgent-issue, log, escalation, and reliability workflows. |

### Platform trust, notifications, and AI governance

| Models | Physical schema | Write owner and boundary |
| --- | --- | --- |
| `OpsAuditLog`, `OpsNotificationLog`, `OpsSecurityAlert`, `OpsPrivacyRequest` | `trust_ops` / `event_core` as declared in Prisma | `platform-ops`; audit, outbox, security, and privacy governance. Privacy execution may update subject records owned elsewhere only as an explicit erasure workflow. |
| `OpsLoginHistory` | `identity` | `platform-ops` implementation behind `AUTH_AUDIT`; future ownership should be made explicit before identity extraction. |
| `OpsAiAuditLog`, `OpsAiApprovalRecord` | `trust_ops` | `platform-ops`; AI sanitisation, human approval, and governance records. |

## Intentional cross-context joins and writes

| Caller | Owner/resource | Allowed operation | Reason and guardrail |
| --- | --- | --- | --- |
| `read-models` | `event-lifecycle`, `commercial`, `operations`, `live-ops`, `floorplan`, `platform-ops` | Read scoped rows and map to role contracts | Build PMCM/client/supplier/coordinator projections. Queries stay bounded and read-only; authorization remains in the owning context/controller. |
| `event-lifecycle` | `OpsEvent` plus commercial billing models | Initial billing source, statement, and milestone creation during accepted-inquiry onboarding | Existing workflow is transactional and preserves the current product path. Ongoing billing writes belong to `commercial`; replace bootstrap coupling with an explicit command/event contract before service extraction. |
| `event-lifecycle` | `OpsDocument` | Read/write onboarding document kinds through `DOCUMENT_VAULT` | One physical document table has kind ownership; lifecycle does not write supplier/billing kinds. |
| `commercial` | `OpsEvent`, `OpsInquiry` | Read event scope/client source; invoke lifecycle/public capabilities where needed | Billing and supplier requests require event and inquiry context; no direct lifecycle status mutation. |
| `floorplan` | `OpsEvent` | Read event scope and update floorplan fields only | Keeps official layout state linked to the event without taking ownership of the event lifecycle aggregate. |
| `live-ops` | `OpsEvent`, `OpsCoordinator`, `OpsCoordinatorAssignment` | Read event/coordinator scope; transitional event-day assignment updates | Event-day operations must replace a coordinator safely. The assignment transition is isolated in a workflow and audited; a future staffing command port should remove the shared-table write. |
| `platform-ops` privacy workflow | identity, event, commercial, guest records | Locate and anonymise/delete subject data when an approved privacy request executes | Governance requires a coordinated erasure transaction. Each affected model is named in the workflow; this is not general write permission. |
| `identity-access` | platform trust records | Login-history and lockout telemetry via `AUTH_AUDIT` | Keeps platform implementation out of identity application code while the physical table ownership is clarified. |
| `kernel/access-control` | platform audit | Emit forbidden-access evidence via kernel `AUDIT_WRITER` | Kernel stays business-context-free; the composition root binds the platform adapter. |
| `compatibility/sample` | all seeded models | Seed/reset compatibility data only under `/sample/*` | Demo compatibility is not a product write path and must not be copied into new features. |

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

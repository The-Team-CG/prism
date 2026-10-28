---
type: "Decision"
title: "Privacy legal-hold scope and authority"
description: "Define who can place or release a privacy hold, what it protects, and how it coordinates with owner-controlled redaction."
tags: [architecture, decision, privacy, retention, ddd, postgres]
status: canonical
updated: "2026-10-28"
authority: normative
audience: [agents, engineers, reviewers, operators]
scope: "Platform privacy legal holds and owner-driven privacy redaction"
last_verified: "Prisma validation, migration guard, focused API tests, and API/event typechecks passed; PostgreSQL lock-race test remains gated"
decision_date: "2026-10-05"
sources:
  - id: legal-hold-model
    resource: "apps/api/prisma/schema.prisma#OpsPrivacyLegalHold"
    title: "Platform-owned legal-hold record"
  - id: legal-hold-policy
    resource: "apps/api/src/modules/platform-ops/application/trust/privacy-legal-hold.policy.ts"
    title: "Identity, scope, and lock-order policy"
  - id: privacy-contracts
    resource: "packages/types/src/schemas/platform-ops-inputs.ts"
    title: "Shared placement, release, and inventory contracts"
  - id: owner-capabilities
    resource: "apps/api/src/modules"
    title: "Domain-owned redaction capabilities"
---
# ADR-0009: Privacy legal-hold scope and authority

## At a glance

- **Decision:** A hold applies to a whole subject, optionally limited to one event; it does not select individual rows.
- **Authority:** Only a verified PMCM administrator may place or release a hold, and each action requires a reason.
- **Effect:** An active matching hold blocks privacy deletion before any owner redaction runs. A denial leaves the request approved and all owner records untouched.
- **Ownership:** Platform owns the hold workflow and table; each data domain owns its redaction writes. Event IDs remain scalar references without cross-domain foreign keys.
- **Retention:** Holds do not expire automatically. Released rows remain as history until a separate retention decision is made.

## Context

Platform coordinates privacy requests, but Lifecycle, Commercial, Operations,
and Identity own the data being redacted. The previous execution path had no
durable hold scope or placement/release authority. Redaction must check a
persisted hold consistently with placement and release, while keeping each
owner's write policy inside that owner.

## Decision

### Scope and matching

A hold matches one subject identity:

- Clients and suppliers match on normalized, case-insensitive email.
- Guests match on case-insensitive full name, because the current privacy
  request contract does not carry a stable guest identifier.
- An optional event ID narrows the hold to one event. An event-scoped hold
  blocks deletion for that event. A subject-wide hold blocks deletion across
  events. A subject-wide deletion is also blocked by any active event-scoped
  hold because the requested deletion is broader than that hold.

Guest names can collide. PMCM operators should use event scope when the
identity is only a guest name; a subject-wide guest hold can match same-name
guests in other events. The operator UI calls out this behavior.

### Authority and lifecycle

Only a verified `pmcm-admin` may place, list, or release holds. Placement and
release require a non-empty reason. If an event scope is supplied, Platform
checks that the event exists before persisting the hold. Placement and release
are audited in the same transaction as the hold mutation. Release records its
actor, time, and reason; it does not delete the hold row or its audit evidence.

Holds have no automatic expiry. They remain active until a PMCM administrator
releases them. Post-release retention or archival is not defined by this
decision and must be decided before adding cleanup behavior.

### Redaction coordination

Placement, release, and execution acquire the subject advisory lock first; an
event-specific action then acquires the event lock. This fixed order serializes
the check with changes to a matching hold. Execution checks active holds before
calling any owner capability. If a hold matches, execution fails closed and
leaves the privacy request approved.

When no hold matches, Platform invokes focused Lifecycle, Commercial,
Operations, and Identity capabilities in the existing transaction. Per-owner
receipts and the final audit summary commit with those writes and the request
status. A failed owner operation rolls back the whole transaction, so retry
does not observe a partially completed redaction.

### Persistence

`OpsPrivacyLegalHold` is owned by `platform-ops` and targets
`platform_ops.privacy_legal_holds`. `event_id` is nullable scalar attribution;
it does not introduce a foreign key to the Lifecycle schema. The record keeps
subject type and identity, placement reason/actor/time, optional event scope,
and release reason/actor/time.

## Consequences

- The policy is enforceable before redaction starts and visible to PMCM admins.
- Subject-level holds intentionally protect all records for the matching
  identity in scope; this decision does not support selected-record holds.
- Guest name ambiguity requires event-scoped holds for precise matching.
- There is no time-based expiry or automatic deletion of released hold history.
- The lock and rollback behavior still needs the gated PostgreSQL race and
  rollback suite before the database-integrity milestone can be closed.

## Verification

Run the focused privacy service/controller tests, API and event typechecks,
Prisma validation/offline verification, migration guard, and boundary scan.
Run the PostgreSQL placement-versus-execution race and transaction rollback
cases with the disposable test database at the integrated database milestone.

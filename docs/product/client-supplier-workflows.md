---
type: "Portal Workflow Contract"
title: "Client and supplier workflows"
description: "Ownership, durable evidence, and operational limits for client and supplier portal actions."
tags: [product, client, supplier, files, approvals, payments]
status: canonical
updated: "2026-10-28"
authority: normative
audience: [product, engineering, agents, reviewers]
scope: "Client and supplier portal workflows and their PMCM controls"
last_verified: "2026-10-16 portal acceptance; 2026-10-18 staging adaptation verification tracked separately below"
sources:
  - id: shared-contracts
    resource: "packages/types/src"
    title: "Shared workflow schemas and read models"
  - id: lifecycle
    resource: "apps/api/src/modules/event-lifecycle"
    title: "Onboarding, files, and client closeout"
  - id: commercial
    resource: "apps/api/src/modules/commercial"
    title: "Supplier operations, payables, and client option reviews"
  - id: floorplan
    resource: "apps/api/src/modules/floorplan"
    title: "Official snapshot review"
  - id: storage
    resource: "apps/api/src/modules/platform-ops"
    title: "Object storage and authorization"
---
# Client and supplier workflows

## At a glance

- **Purpose:** Define the evidence behind portal actions and PMCM controls.
- **Owners:** C owns external portal journeys, B owns PMCM operating policy,
  and D owns contracts, authorization, storage, and audit. A owns visual quality.
- **Scope:** The selected client/supplier completion work. The broader feature
  families retain their ledger status until their other criteria are satisfied.
- **Verify with:** Shared contracts, focused API/portal behavior tests, database
  concurrency tests, migration checks, and the affected role paths.

## Files

A filename, file size, or MIME declaration is metadata. A file becomes available
only after storage receives its bytes and the API verifies the declaration,
checksum, size, and supported content. Failed or pending uploads do not satisfy
document requirements or authorize a contract binding.

Every list, upload, confirmation, and download checks the verified actor and
event. Suppliers see their own assignment documents; clients see their own
client-visible event documents and deliverables. PMCM controls internal files
and releases. A changed file uses a new upload target and object identity.
Retries of the same target cannot replace its content or transfer ownership.
Supplier document objects are preserved as workflow evidence: generic PMCM
storage deletion is rejected for that usage. Corrections create new versions;
retention and privacy disposal remain separate owner-controlled processes.

PMCM opens stored files from the event workspace's Files entry at
`/dashboard/events/:eventId/files`. Floorplans retain their separate route and
official authoring controls. Clients open shared files from their own event's
Documents screen; the conforme entry remains visible for clients who already
have another active event.

The local filesystem adapter is for development. The Supabase adapter requires
an explicitly configured private bucket and server credentials. Its direct
upload flow avoids passing file bodies through a deployed API function; the
API confirms provider bytes before binding a file to a workflow. Credentials
never enter portal configuration. Download URLs are temporary capabilities.
Provider implementation and local tests do not establish production activation,
retention, legal hold, or malware scanning.

## Supplier operations

| Action | Authority and durable evidence |
| --- | --- |
| Contract submission | The verified supplier binds a confirmed object to its selected, confirmed assignment. Each upload creates an immutable numbered version. |
| Contract review | PMCM accepts the current version or requests correction with a reason. A later submission retains the earlier file and review history. |
| Ingress and egress | PMCM owns the schedule. Supplier acknowledgement names the current revision; a change request includes a reason. Revised details require a new acknowledgement; an unchanged publish preserves the acknowledgement and revision. |
| Creative deliverables | PMCM creates assignment tasks with payload-bound idempotent retries. Suppliers report progress and submit notes or stored files; PMCM accepts, requests changes, or cancels through its review contract. Numbered submissions retain the evidence reviewed. |
| Payable schedule | PMCM creates arbitrary positive milestones against the selected locked quote. Their total cannot exceed that quote. |
| Payment release | PMCM records an actual release with amount, date, method, and reference. The supplier sees its own recorded releases and remaining balance. Quote locking alone creates no payment evidence. |
| Payment correction | PMCM records a reasoned reversal. Original releases remain in the ledger; net releases determine the balance. Idempotent retries and database locks prevent duplicate or excess releases. |

Supplier payables are distinct from client invoices and receipts. A recorded
release is operational evidence entered by PMCM; the software does not move
money or reconcile a bank account. Supplier views exclude competing bids,
client invoices, internal cost notes, and other suppliers' records.

Storage derives the supplier ID from the verified account email and persisted
booking. Readiness and booking progress use the latest actual contract version:
submitted versions await review, corrections remain actionable, and only PMCM
acceptance completes the contract handoff. Legacy filename metadata is not
accepted-contract evidence.

## Client decisions

Only the primary client's verified identity may submit briefings or record
formal decisions for that event. Event-scoped sessions remain scoped. Briefing
submissions preserve history and retain the fields already supplied when the
client edits the form.

PMCM continues to author and approve official floorplans. Client decisions and
annotations are separate records referencing a submitted/approved snapshot
hash. An annotation may target an object or a normalized point in that snapshot.
Clients cannot modify official geometry or grant PMCM approval. A replacement
snapshot needs its own client decision; the earlier decision remains evidence
for the version actually reviewed.

PMCM issues immutable venue and styling options with numbered versions.
Clients approve or request revision against the current issued version.
These decisions do not approve a budget, create a payable, or replace the
commercial proposal approval workflow.

## Conforme and closeout

The conforme template preserves its original text and hash. Prefill creates a
separate immutable document and hash from the accepted inquiry. Both parties
acknowledge that exact version, with verified identity, consent text/version,
and timestamp. Client acknowledgement precedes PMCM countersignature. Only a
completed execution may satisfy the signed-conforme gate. Scanned-document
acceptance remains an alternative. This is an in-app acknowledgement record;
it does not claim an external certificate or qualified signing service.

Clients acknowledge submitted deliverables and the opened event closeout.
Their feedback is separate from guest feedback and PMCM private notes.
Testimonial publication requires explicit consent, defaulting to false, and
PMCM moderation. Moderation never automatically publishes a testimonial.
Clients may withdraw their own testimonial consent after archive. Other
archived workflow records remain read-only.
The client workspace lists archived events separately as read-only history;
active workspace data and the client action center exclude them.

Reopening the PMCM signing dialog loads the persisted execution before offering
an action. A signed version cannot be replaced. Client event selection follows
the API's verified ownership scope, so a changed display name does not hide an
owned event. Event history includes unlocked archived events and opens their
Summary for reading closeout evidence and withdrawing testimonial consent.
Active workspace navigation and other closeout controls are unavailable there.

## Audit integrity

Audit hashes serialize metadata in PostgreSQL JSONB key order recursively, so
persisting and reading a nested object does not change its hash. Existing
valid hashes remain compatible. Previously mismatched history still fails
integrity checks and blocks workflow writes; this delivery does not rewrite
historical records or bypass the integrity guard.

## Delivery evidence

The following evidence covers the original local delivery on 2026-10-16,
before adaptation to staging's owner-specific schema. It is historical evidence,
not verification of the integrated branch:

| Check | Result |
| --- | --- |
| Production builds | The full 10/10-task monorepo build passed. Subsequent API, client, supplier, and PMCM integration fixes each passed their affected production build. |
| Typechecks | All workspaces passed on the final source: 14/14 Turbo tasks excluding the client, then the client workspace typecheck after its final navigation fix. |
| API suite | 918 cases passed across the full-suite run (917) and isolated rerun of its timed-out architecture check (1); 47 environment-gated tests skipped. No API source changed between those checks. |
| Shared packages | Types: 64 passed. API client: 35 passed. |
| Role portals | Client: 70 passed in 19 files. PMCM event: 234 cases passed across its suite (233) and isolated timeout recheck (1). Supplier: 30 passed. |
| Actual PostgreSQL behavior | Signing activation, supplier lifecycle and retries, concurrent payout cap, stale floorplan decisions, and audit JSONB round trip passed against isolated local databases. |
| Architecture and database checks | Boundary scan and 53 guard tests, migration policy and 31 tooling tests, query audit, Prisma validation, and offline schema generation passed. |
| Client browser acceptance | Upload/download and briefing edits persisted after refresh. Official layouts remained read-only; snapshot-bound approvals, revision requests, and annotations persisted. Venue and styling approval/revision paths, deliverable and wrap-up acknowledgments, feedback with consent initially off, explicit testimonial opt-in, and PMCM moderation persisted after reload. After PMCM archived the test event with an audited override, closeout was read-only and testimonial consent withdrawal persisted as withdrawn after reload. Completed opened the archived Summary, workspace links were absent, return to history worked, and Upcoming excluded archived events. |
| Supplier browser acceptance | Actual contract uploads, correction and acceptance history, schedule revision/change request/acknowledgment, creative progress and revision history, and arbitrary payable release/reversal balances persisted in both role portals. Contract downloads matched the uploaded bytes. |
| Signing browser acceptance | Client prefill and acknowledgment, PMCM reopen and countersignature, exactly-one-event activation, and Approved signed-conforme status passed. Actual client-uploaded and PMCM-shared files downloaded with matching byte lengths and SHA-256; legacy metadata-only conforme remained Pending. |

Browser acceptance used production portal builds, the real API, and an isolated
local database. Supplier contract uploads and corrections, schedule revisions
and acknowledgments, creative submissions and correction history, and payable
release/reversal history all survived browser reloads. Downloads matched their
stored bytes. Concurrent payout caps and stale floorplan decisions also passed
real PostgreSQL service tests. The earlier failed audit-chain database was
preserved as evidence.

For the archived-closeout case, guarded fixture setup moved only the isolated
acceptance event to event day; the PMCM browser then used the real archive
action with an explicit override reason for incomplete fixture close gates.
This does not claim that the fixture satisfied the ordinary archive checklist.

The first parallel final-suite attempt exceeded Windows test-worker startup
and timeout limits. The API architecture check passed in isolation. The PMCM
filesystem architecture check also passed in isolation (177 ms) with a 15-second
runner timeout; other portal checks use bounded worker concurrency. Timeout
attempts are not recorded as clean full-suite passes. After browser mutations,
the actual acceptance database's complete audit chain passed the rolled-back
JSONB regression and integrity check without rewriting history.

The staging adaptation preserves the eight current owner schemas. New
Commercial records use `commercial`, conforme and closeout records use
`event_lifecycle`, and snapshot decisions use `floorplan`. Cross-domain IDs
remain scalar references. The five database suites above now use the standard
`P0_TEST_DATABASE_URL` runner, which recreates an isolated local test database
between suites. Integrated-branch verification is pending while adaptation
continues.

Production provider activation, external signing certification, bank execution,
and external message delivery remain separate operational work. Database replay
uses an isolated local PostgreSQL instance and does not migrate a remote database.

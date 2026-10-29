---
type: "Portal Workflow Contract"
title: "Client and supplier workflows"
description: "Ownership, durable evidence, and operational limits for client and supplier portal actions."
tags: [product, client, supplier, files, approvals, payments]
status: canonical
updated: "2026-10-29"
authority: normative
audience: [product, engineering, agents, reviewers]
scope: "Client and supplier portal workflows and their PMCM controls"
last_verified: "2026-10-29; client/supplier routes, floorplan client-review and annotation endpoints, PMCM event files view"
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
- **Authority:** Normative workflow contract for client and supplier portal
  actions; feature-family status stays in the feature ledger.
- **Scope:** Files, supplier operations and payables, client decisions,
  conforme, closeout, and audit integrity. The broader feature families retain
  their ledger status until their other criteria are satisfied.
- **Use/change:** Apply when changing these portal workflows or their PMCM
  controls; revise when ownership, evidence, or a limit changes.
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

An issued commercial proposal is reviewable without a billing statement. Client
approval and revision requests refer to the issued version; after requesting a
revision, the client waits for a newer issued version before deciding again.

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
The closeout read model exposes an `acknowledgementRecorded` flag for wrap-up
and deliverables so portals can distinguish a PMCM-recorded acknowledgement
from a missing one. This flag does not identify a PMCM record as a verified
client submission or disclose its private acknowledgement note. A client may
acknowledge an opened wrap-up before all PMCM completion checks are finished;
completion itself includes acknowledgement among its prerequisites.
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
integrity checks and blocks workflow writes; the serialization rule does not
rewrite historical records or bypass the integrity guard.

Production provider activation, external signing certification, bank
execution, and external message delivery remain separate operational work.

## Lifecycle decision boundaries

Clients receive billing statements and their related file requirements after PMCM sends the statement. Sending again preserves the original sent time and notification keys. Source approval locks the event before checking the approved-proposal cap; additional charges use the additional-billing workflow. Superseded proposal evidence and differing totals require an explicit override reason, and an override does not bypass the event cap.

Proposal issue retries with identical content retain the issued version. Identical supplier quote retries do not consume a revision; past deadlines and selection of released bids are refused. Supplier event-day status advances in order; PMCM can correct it with a recorded reason.

Client floorplan decisions use the snapshot-bound decision endpoint. Requesting revision updates the draft and lifecycle projection in the same transaction. The legacy PATCH floorplan review route is retired; official approval remains with PMCM.

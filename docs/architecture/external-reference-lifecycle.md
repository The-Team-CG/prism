---
type: "Architecture Reference"
title: "P.R.I.S.M external-reference lifecycle"
description: "Owner rules for cross-domain foreign keys and scalar identifiers, including current eligibility, history, delete effects, failure, and recovery."
tags: [architecture, persistence, references, ddd, retention]
status: canonical
updated: "2026-10-04"
authority: normative
owner: "D (Anthony)"
audience: [agents, backend-engineers, reviewers]
scope: "apps/api/prisma/domain-reference-policy.json and cross-context commands"
last_verified: "Local manifest guard and source review; PostgreSQL behavior and FK removal remain pending"
sources:
  - id: reference-policy
    resource: "apps/api/prisma/domain-reference-policy.json"
    title: "Cross-domain foreign-key and scalar-reference policy"
  - id: ownership-manifest
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Model ownership and current foreign-key definitions"
  - id: context-contracts
    resource: "docs/architecture/context-contracts.md"
    title: "In-process owner capabilities and read seams"
---

# P.R.I.S.M external-reference lifecycle

## At a glance

- **Purpose:** Define what a cross-domain identifier means before its foreign key is removed.
- **Authority:** Normative for reference checks, historical attribution, failure, and recovery.
- **Owner:** D (Anthony), with each data-owning context responsible for its capability.
- **Use when:** Adding, validating, retaining, redacting, or migrating an external identifier.
- **Current state:** 45 cross-domain foreign keys and 28 scalar references are inventoried. This register does not remove constraints or establish database runtime behavior.

## Boundary rule

Each write domain owns one PostgreSQL schema in the target state. Foreign keys may remain between tables owned by the same domain. Cross-domain references are scalar identifiers. A command that needs the target's current state asks its owner to validate the target in the same transaction and against the same event scope. The caller remains responsible for actor authorization. A successful lookup or identifier is never authorization.

Read-model composition can join owner data for a role-safe projection. It is read-only and does not replace owner validation for a command.

The canonical inventories are:

- apps/api/prisma/domain-ownership.json: every model's current and target schema, owner, columns, and current foreign-key definition.
- apps/api/prisma/domain-reference-policy.json: every cross-domain foreign-key constraint grouped by behavior profile, plus plain scalar references and their intended owner behavior.
- apps/api/scripts/check-domain-reference-policy.mjs: static coverage and drift guard.

The current database still has ten populated application schemas. The approved target has seven schemas. No external foreign key has been dropped by this delivery.

## Reference meanings and actions

| Profile | Meaning and command rule | Lifecycle and deletion | Failure and recovery |
| --- | --- | --- | --- |
| event-current | Lifecycle owns the event. A command requiring a live event validates existence, current eligibility, and agreement with the command event ID. | Archive, cancellation, and postponement preserve owner records. Physical event deletion is unsupported. | Missing or cross-event required targets fail closed. Roll back all owner writes; retry only through the command idempotency contract. Reconcile through the owner, never by matching names or dates. |
| event-history | Event IDs are optional historical context, not current authorization or eligibility. | Preserve evidence through archive, cancellation, and postponement. Erasure must be owner-scoped and record the redaction result. | Retain unresolved attribution; do not attach it to a guessed replacement event. |
| identity-history | Identity Access controls current accounts and sessions. Historical user IDs preserve who acted; they grant no current authority. | Disable or revoke accounts without erasing business history. Privacy erasure may null account links only under approved retention policy. | New actions check the current actor. Do not restore identity by mutable email or display name. |
| identity-coordinator | Identity Access owns account state; Operations owns coordinator eligibility and assignment. | Operations rechecks the profile active flag and linked Identity role, approval, and active lockout under the assignment transaction; disablement blocks new authenticated work while assignment history remains. | Resolve through the owners; explicitly relink or deactivate rather than inferring identity. |
| principal-history | Historical attribution may name an account, system principal, or role-scoped portal principal. | Keep completed action evidence even when no OpsUser row exists. | Check current authentication at command time; a saved principal ID is not a credential. |
| document-current-optional | Lifecycle document-vault checks event, kind, and eligibility for Commercial commands. | A nullable link can preserve its source row if metadata is removed. Redaction remains disabled pending retention policy. | Reject missing, wrong-event, wrong-kind, or ineligible documents before the Commercial write; reconcile only through Lifecycle. |
| operations-coordinator-current | Operations validates current coordinator and assignment eligibility for LiveOps designation and handoff actions. LiveOps authorizes its own action. | Preserve completed designation and handoff history; do not hard-delete a referenced coordinator. | Missing, disabled, cancelled, or cross-event assignments fail before the LiveOps write. Roll back and retry by command receipt. |
| supplier-current | Commercial owns supplier existence/status. Operations validates a selected supplier against the registration event before attaching it. | Keep registration and import history when a supplier becomes inactive. | Missing, wrong-category, unselected, or wrong-event suppliers fail closed. Re-select explicitly through Commercial. |
| polymorphic-owner-current | The discriminator and usage select an owner; that owner checks record and event agreement before confirmation or retrieval. | Retain a typed scalar link under its owner's retention policy. | Missing type, unsupported usage, or owner failure denies confirmation/retrieval. Reconcile through the identified owner. |
| polymorphic-history | A type-qualified ID is historical attribution, such as audit or event-day evidence; consumers do not dereference it for permission. | Preserve the evidence and its explicit type through normal lifecycle changes. | A missing target does not erase evidence and never authorizes access. |
| lifecycle-inquiry-current | Lifecycle verifies accepted, unsigned inquiry eligibility before a conforme reminder draft is prepared or approved. | Inquiry lifecycle remains Lifecycle-owned; the draft records its external inquiry ID. | Reject stale or ineligible inquiries before approval and preserve retry safety. |
| liveops-issue-current | LiveOps owns urgent issues. Commercial requires the issue to belong to the same event before issuing additional billing. | Billing and issue history survive archive/cancellation. Physical deletion needs owner-defined retention rules. | A missing or cross-event issue fails before billing commits; use an idempotent retry after owner recovery. |
| commercial-addendum-history | Lifecycle stores an immutable impact snapshot and type-qualified Commercial target ID; Commercial applies billing-source and quote mutations. | Preserve the addendum decision and impact snapshot as history. | A missing or stale target fails the owner capability; do not rewrite historical attribution. |

The machine policy records source field, target, owners, behavior profile, current status, and meaning for all 28 non-FK references. The ownership manifest records each cross-domain foreign-key constraint and its actual ON DELETE and ON UPDATE actions. Read both before a schema change; do not create a partial second source of truth.

## Current foreign-key delete effects

The refreshed baseline contains 45 cross-domain foreign keys: 38 CASCADE, 6 SET NULL, and 1 RESTRICT. Exact constraint-level actions are in the ownership manifest.

A physical parent delete currently has database consequences across write owners. CASCADE may erase another domain's records; SET NULL preserves the source row but removes its current link; RESTRICT blocks deletion while a dependent remains. These are legacy database behaviors, not approved retention policy. No production event hard-delete command was found. Test cleanup and fixture teardown are not product deletion workflows. Archive, cancellation, and postponement do not authorize a physical delete.

Before any FK removal, owner capabilities must preserve required current checks and every former delete effect must have an explicit owner action and recovery path. Privacy work requires per-owner retention/redaction receipts, legal-hold checks, retryable partial completion, and preserved audit/issued evidence. There is no generic cascade orchestrator.

## Implemented seams and remaining work

The policy marks a reference implemented only where source inspection found the named capability: Commercial addendum impact writes, Lifecycle document validation and conforme-inquiry eligibility, and the Lifecycle post-event / LiveOps urgent-issue readers used by additional billing. Floorplan event references remain transitional in this stack. Other references remain transitional until call sites use the required capability and behavior tests cover failures and retries.
The policy marks a reference implemented only where source inspection found the named capability: Floorplan's versioned event projection clock, Commercial addendum impact writes, Lifecycle document validation and conforme-inquiry eligibility, Lifecycle post-event / LiveOps urgent-issue readers used by additional billing, and the Operations registration supplier and coordinator-conflict references. Operations guest and staffing commands also use Lifecycle event-state reads and transactional locks; the remaining guest access-code and coordinator workspace projections are read compositions still to move behind a read-model seam. Other references remain transitional until call sites use the required capability and behavior tests cover failures and retries. No cross-domain foreign key has been removed.

The static guard verifies exact cross-domain FK coverage and scalar source/target ownership/profile drift. It does not prove every caller uses an owner capability, validate a live PostgreSQL catalog, or authorize FK removal.

A schema cutover remains gated on owner behavior tests, clean replay, populated-upgrade/restore evidence, zero cross-domain foreign keys, and deployment compatibility controls.
---
type: "Product Decision Register"
title: "P.R.I.S.M feature ledger"
description: "Active product-family decisions, ownership, sequencing, and evidence for Prism feature work."
tags: [product, features, decisions, ownership]
status: canonical
updated: "2026-10-03"
authority: normative
owner: "B (Francis)"
audience: [product, engineering, design, agents]
scope: "Prism feature-family decisions, ownership, sequencing, and closure evidence"
last_verified: "2026-10-03"
sources:
  - id: v4-reference
    resource: "docs/reference/prism-v4/complete-feature-catalog.md"
    title: "Source-preserving V4 catalog"
  - id: governance
    resource: "docs/product/evolution-governance.md"
    title: "Product evolution governance"
  - id: architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture"
---
# P.R.I.S.M feature ledger

## At a glance

- **Purpose:** Record the active product decision for each feature family and candidate.
- **Authority:** Normative product decision register; implementation work must not silently change a row.
- **Owner:** B (Francis).
- **Scope:** Feature intent, current state, decision, ownership, dependencies, permissions, evidence, and UX surface.
- **Use when:** Adding, revising, merging, splitting, deferring, gating, or retiring feature scope.
- **Change when:** Product intent, owner goal, lifecycle placement, dependency, permission boundary, or completion evidence changes.
- **Verify with:** The current product model, readiness gates, architecture, and affected app/API checks.

This ledger is the product decision layer for feature work. It does not replace
the source-preserving catalog. It decides how catalog features and redesign
candidates should move forward.

Use this file with:

- [`../reference/prism-v4/complete-feature-catalog.md`](../reference/prism-v4/complete-feature-catalog.md) for source feature text and official counts.
- [`evolution-governance.md`](evolution-governance.md) for decision rules.
- [`../../AGENTS.md`](../../AGENTS.md) for owner system goals (A–D) and app boundaries.
- [`../architecture/current-architecture.md`](../architecture/current-architecture.md) for module ownership and technical stop rules.

## Decision Legend

| Decision | Meaning |
| --- | --- |
| Keep | Implement or harden mostly as described. |
| Revise | Keep the intent but change UX, data, workflow, boundaries, or wording. |
| Merge | Fold multiple catalog items into a stronger workflow. |
| Split | Break an oversized feature into smaller implementation slices. |
| Add | New feature should enter scope because it improves P.R.I.S.M. |
| Defer | Valid feature, but not needed until a later maturity stage. |
| Retire | Remove from active scope; keep traceability. |
| Gate | Allow only after a prerequisite is complete. |

## Active Ledger

| Ledger ID | Source refs | Persona | Current state | Decision | Decision reason | Owner | Phase placement | Dependencies | Permission boundary | Audit/notification needs | UX surface | Verification requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FL-001 Inquiry intake and triage | FR-01, FR-44, FR-45, FR-46, FR-47, FR-48, FR-50, FR-51, FR-52, FR-53, FR-54, FR-AI-01 | Public, PMCM | Live/partial | Revise | Keep the public inquiry path, but redesign PMCM intake as an action queue with referral context, duplicate history, organization merge/history cues, and explicit PMCM-only log-on-behalf flow. AI triage remains gated. | B, C, D | Phase 2, Phase 12 for AI | Consent copy, inquiry scoped APIs, organization matching, AI governance for FR-AI-01 | Public can submit only; PMCM owns review, accept, pend, decline, organization merge, and log-on-behalf metadata. | Audit accept/pend/decline/log-on-behalf/organization merge; notify PMCM on high-fit or duplicate inquiries. | Public inquiry, PMCM inquiry inbox, Event Command Inbox | Public cannot spoof PMCM fields; scoped API tests; no dashboard links from public pages; organization merge changes leave an audit trail. |
| FL-002 Onboarding and conforme gate | FR-02, FR-03, FR-26, FR-67, FR-68 | Client, PMCM | Live/partial | Keep | This is a core product boundary: no client dashboard or event creation before accepted inquiry and signed conforme. Template prefill and dual-signing need later maturity. | B, C, D | Phase 2, Phase 7 | Document storage, invitations, reminder policy, template service | PMCM uploads/validates signed documents; client can view own status and complete allowed actions. | Audit uploads, signature method, invitation opened/expired, reminder sends. | PMCM onboarding tracker, client action center | Client portal locked until conforme; document state persists; reminder eligibility tests. |
| FL-003 PMCM command dashboard | FR-04, FR-05, FR-12, FR-24 | PMCM | Partial | Merge | Generic dashboards and file/task panels should merge into Event Command Inbox, event workspace, and workflow templates. | A, B, D | Phase 2, Phase 7 | Route inventory, shared shell, task/event APIs | PMCM only; coordinator views get role-safe subsets. | Audit command actions; notify owners on overdue/blocked work. | `apps/event` dashboard, event workspace, command inbox | Route smoke checks; PMCM-only data cannot appear in portals. |
| FL-004 Client portal after conforme | FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-65, FR-66, New-CL1, New-CL2 | Client | Partial | Revise | Client needs a narrow action center, not a broad dashboard. Official floorplan remains read-only except approval/comment workflows; client drafts are preferences only. | A, C, D | Phase 3, Phase 7 | Client scoped reads, document matrix, floorplan preference APIs | Client sees only own event data; cannot see CE, supplier private notes, PMCM costs, coordinator internals, or audit logs. | Audit client submissions, approvals, comments, uploads, walk-in policy; notify PMCM on client action. | Client dashboard, event action center, billing/docs/floorplan sections | Client cannot mutate official layouts; forbidden role access tests; mobile action flow verified. |
| FL-005 Proposal, briefing, and commercial workflow | FR-09, FR-10, FR-11, FR-19, FR-43, FR-58, FR-59, FR-60, FR-61, FR-62, FR-AI-03, FR-AI-09 | PMCM, Client | Partial | Merge/Gate | CE, bid workspace, venue scouting, moodboard/styling approval, proposal review, billing terms, and communication drafts should become one commercial workflow. Canva, Zoom, PowerPoint, and AI are adapters gated by governance and credentials. | B, C, D | Phase 7, Phase 10, Phase 12 | Billing source records, proposal records, venue/styling records, adapter abstraction, AI governance | PMCM owns CE, bid, scouting, styling, and proposal prep; client sees approved proposal, venue/styling options, and comments only. | Audit proposal revisions, approvals, adapter exports, AI drafts, venue/styling decisions, and PMCM approvals. | PMCM proposal workspace, bid workspace, client proposal review, venue/styling review | Proposal approval and billing source stay linked; AI cannot send messages automatically; venue/styling work does not bypass budget confirmation. |
| FL-006 Document and file operations | FR-04, FR-32, FR-33, FR-54, FR-67, FR-70, New-SEC3 | PMCM, Client, Supplier | Partial | Merge | Replace generic file hub with a File Requirements Matrix: owner, visibility, due date, required state, validation, source workflow. A role-filtered event matrix endpoint and shared DTO now exist; upload validation/storage are still later maturity. | A, B, C, D | Phase 7, Phase 10 | Upload validation, storage provider, template service, visibility rules | Users see only files allowed for their role/event. PMCM manages requirements and visibility. | Audit upload/download/delete/visibility changes; notify missing/invalid required files. | PMCM files, client files, supplier contract uploads | MIME/size validation tests; forbidden file visibility tests; storage adapter tests. |
| FL-007 Supplier network operations | FR-14, FR-15, FR-16, FR-17, FR-18, FR-35, FR-36, FR-37, FR-38, FR-49, FR-63, FR-64, FR-75, FR-76, FR-77, FR-78, FR-79, FR-87, New-EX1, New-S1, New-S2, New-S3, New-S4, New-S5, New-SUP1, New-SUP2, New-SUP3, New-SUP4, FR-AI-04, FR-AI-04b, FR-AI-06 | Supplier, PMCM | Live/partial | Merge/Revise | Supplier directory, public applications, application inbox/status, quote requests, assignment, readiness, ingress/egress schedule, contract mismatch, outsourced creative sub-tickets, performance assessment, and reliability should become one supplier network workflow. | B, C, D | Phase 4, Phase 7, Phase 12 for PARE/reliability output | Supplier scoped APIs, application intake, quote locks, notifications, readiness/ingress model, AI approval gate | Suppliers see only assigned or application-scoped data. PMCM sees private reviews, reliability, and application decisions. | Audit quotes, revisions, selection, readiness, contract metadata, tier changes, applications, ingress/egress status, creative sub-ticket progress; notify supplier/PMCM. | Supplier portal, PMCM supplier board, Supplier Readiness Board, supplier applications inbox | Supplier cannot see client private data in confidential bids; quote lock tests; assignment confirmation tests; public supplier application cannot expose PMCM-only review data. |
| FL-008 Coordinator and staffing operations | FR-13, FR-88, FR-89, FR-90, FR-91, New-C1, New-C2, New-C3, New-C4, New-CO1, New-CO2, New-CO3, New-CO4, New-CO5, New-CO6, FR-AI-07 | Coordinator, PMCM | Partial | Revise/Add | Use the shared seven-role catalog for new staffing writes, advisory server skill ranking, active-assignment scope, and manual reassignment approval. Delivered slices are recorded below; heatmap and AI copilot remain gated. | B, D | Phase 5, Phase 7, Phase 12 for AI copilot | Availability model, role tags, live ops APIs, notification queue, AI governance | Coordinators see only assigned event details for their role. PMCM owns roster, replacement, reliability, escalation, and any AI recommendation approval. | Audit assignment, acknowledgment, attendance, reassignment, replacement, event-day alerts; notify coordinator and PMCM. | PMCM team/staffing, coordinator role views, live ops workspace, event-day run sheet | Role-safe selector tests; no finance/private supplier/audit data in coordinator views; AI copilot cannot act without PMCM approval. |
| FL-009 Compliance, risk, and change control | FR-06, FR-07, FR-10+, New-SY3, New-SY4, FR-96, FR-97 | PMCM | Live/partial | Revise/Add | Compliance should join risk, change freeze, addendum conformes, cancellation/postponement impact, and decision log as one operational control layer. AI advisory remains gated. | B, D | Phase 7, Phase 8, Phase 12 for AI advisory | Compliance rules, event values, change register, billing/conforme links, supplier/coordinator impact records | PMCM owns overrides, cancellation/postponement, and addendum decisions; clients see only client-facing requests/status. | Audit overrides, change requests, freeze exceptions, addendum conformes, cancellation, postponement, supplier/coordinator impact checks; notify affected owners. | PMCM risk/change register, compliance panel, cancellation/postponement panels | Override reason required; change freeze enforcement tests; addendum creates billing/conforme trace; cancellation/postponement cannot silently skip supplier/coordinator/billing impact review. |
| FL-010 Billing and payments | FR-20, FR-21, FR-69, FR-92, FR-93, FR-94, New-P5 | PMCM, Client | Partial | Revise | Billing should be tied to approved proposal/CE, terms, disputes, partial payments, waivers, and additional billing. | B, C, D | Phase 8 | Proposal source records, payment records, notification queue | PMCM manages billing; client sees statements, milestones, receipts, and required actions only. | Audit payment records, disputes, waivers, billing generation; notify upcoming/overdue payment. | PMCM finance workspace, client billing action center | Billing amount traces to approved source; waiver/dispute reason required; client cannot edit payment records. |
| FL-011 Floorplan and spatial workflow | FR-08, FR-80, FR-81, FR-82, FR-83, FR-84, FR-28, FR-29 | PMCM, Client | Live/partial | Keep/Revise | Keep editor internals and PMCM official ownership. Revise venue library, presets, table assignment, and client annotation around the official/preference boundary. | B, C, D | Phase 3, Phase 7 | Floorplan editor, venue library, table eligibility, client annotations | PMCM edits official layouts; clients submit preferences and approve/comment on submitted official layouts. | Audit submit/approve/reject/comment/version lock; notify client/PMCM on approval requests. | PMCM floorplan editor, client read-only official layout | Client official mutation forbidden; snapshot persistence tests; table eligibility tests. |
| FL-012 Guest and lightweight access | FR-39, FR-40, FR-41, FR-42, FR-95, New-GU1, New-EX2 | Guest, PMCM, Public | Partial | Gate/Revise | Keep guest access lightweight. Gate QR/camera flows behind HTTPS and masterlist reconciliation; build moderation and consent first. Keep the guest pass promotional sample as an external non-live-data demo. | C, D | Phase 6, Phase 7, Phase 10 | Guest access codes, consent, moderation, file upload, HTTPS/camera constraints, public demo isolation | Guests need no account; access is event-code or QR scoped; PMCM moderates feedback; promotional sample cannot touch live event data. | Audit consent, check-in, walk-in flag, feedback, moderation; notify PMCM on flagged items. | Guest open-code, guest dashboard, moderation queue, guest pass promotional sample | Consent required; no cross-event guest reads; QR not enabled until constraints pass; promotional sample stays isolated from authenticated surfaces. |
| FL-013 Closure, archive, and learning loop | FR-22, FR-23, New-P1, New-P2, New-P3, New-P4, New-SY1, New-SY2, FR-AI-08 | PMCM, Client | Partial | Merge/Gate | Closure, archive, insights, testimonials, logistics, and PEIL should become post-event knowledge and closeout workflow. AI analysis remains gated. Archive is now guarded by the central lifecycle transition table. | B, C, D | Phase 9, Phase 12 for PEIL | Close gates, archive search, feedback, billing/logistics, AI governance | PMCM owns archive and private notes; client sees deliverables/acknowledgment/testimonial only. | Audit close/override/archive/testimonial/logistics; notify required owners before close deadlines. | PMCM closure workspace, archive, client closeout surface | Close blocked unless gates pass or override reason exists; event cannot skip directly from planning to archive; private notes hidden from portals. |
| FL-014 Notifications and communications | FR-25, FR-55, FR-64, FR-AI-09, FR-AI-05 | All | Partial | Revise/Gate | Treat email/Viber as queue-backed notification adapters with templates, language preference, audit, retries, and PMCM-reviewed AI communication drafts. POA remains a PMCM-only assistant concept until AI governance is complete. | C, D | Phase 10, Phase 12 | Notification queue, templates, adapter credentials, language preferences, AI governance | Users receive only role-appropriate messages; PMCM controls broadcast, assistant use, and sensitive content. | Audit queued/sent/failed/acknowledged, template version, recipient scope, AI draft approval. | Notification settings, PMCM communication queue, role-specific message surfaces, PMCM assistant review surface | No direct send from UI; adapter retry tests; template visibility tests; AI assistant cannot act or send without PMCM approval. |
| FL-015 Security, privacy, and audit | New-SEC1, New-SEC2, New-SEC3, New-SEC4, FR-56, FR-AI-ZDR | All | Partial | Keep/Gate | Security and privacy remain mandatory cross-cutting capabilities. External auth, privacy notices, export/anonymization, ZDR, retention, and legal hold should mature before high-risk features. | D | Phase 11, Phase 12 | Auth provider decision, retention policy, privacy operations, AI provider agreement | PMCM sees privacy operations; users can exercise rights only over own data. | Audit auth, access denied, privacy requests, redaction, retention, AI calls. | Privacy operations console, audit settings, auth flows | Forbidden access tests; audit integrity tests; privacy request execution tests; ZDR required before AI. |
 | FL-016 Shared design system and shell | Cross-cutting, old UI modernization Phase 2 plan | All | Partial | Keep/Complete | Shared blocks, public shell, client blocks, and smoke script now exist. Future redesign work should follow living docs (`AGENTS.md`, this ledger, `redesign-inventory.md`, `readiness-foundation.md`, and `../architecture/current-architecture.md`), not the old standalone checklist. | A, B, C, D | Phase 1 and ongoing | `packages/ui`, route inventory, smoke script | Shared UI must preserve app role boundaries and avoid public dashboard shortcuts. | N/A except UI actions wired to audited workflows. | Shared app shell, public shell, dashboard/workflow blocks | `npm run smoke:ui`, `npm run check:boundaries`, visual QA checklist. |

## Ownership Overlay

The Active Ledger above remains the product decision record. This table assigns one DRI, a treatment, and the evidence needed to close each family.

| Ledger ID | Treatment | DRI | Support | Required task | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| FL-001 | Finish thin slice | Francis | Ethan, Anthony, Maxine | PMCM inquiry/triage appears in command path with client-safe status feeding the portal where supported. | PMCM route check; public inquiry cannot spoof PMCM fields; lifecycle docs updated. |
| FL-002 | Finish thin slice | Francis | Ethan, Anthony | Conforme/portal gate remains explicit across PMCM and client action center. | Client portal locked before accepted inquiry plus signed conforme; lifecycle contract tests. |
| FL-003 | Finish | Francis | Maxine, Anthony | PMCM command dashboard centers on command inbox and selected-event summary instead of generic panels. | `/dashboard` route check; command inbox uses shared contract; no portal leakage. |
| FL-004 | Finish thin slice | Ethan | Maxine, Anthony | Client dashboard becomes next-action center for client-owned work. | `PrismClientActionCenter` source verified; public/signed-in route boundary checked. |
| FL-005 | Gate/thin slice | Francis | Ethan, Anthony | Show approved proposal/billing evidence only where current contracts support it; gate adapters and AI drafts. | Billing/proposal gap documented; no adapter/AI claims without governance. |
| FL-006 | Thin slice | Anthony | Ethan, Francis, Maxine | File Requirements Matrix is metadata-only; real storage remains gated. | File matrix type/API tests; storage gate remains in readiness foundation. |
| FL-007 | Thin slice | Ethan | Francis, Anthony | Supplier readiness portal and PMCM review path use scoped supplier records. | Supplier readiness tests; supplier route check; private reviews hidden from supplier. |
| FL-008 | Gate or thin slice | Francis | Anthony | Choose one coordinator/staffing slice only if scoped data is ready. | Chosen slice test/route evidence or explicit gate/deferred row. |
| FL-009 | Gate or thin slice | Francis | Anthony | Risk/change register ships only as bounded PMCM evidence unless contracts are added. | PMCM-only route evidence or documented missing contract. |
| FL-010 | Thin slice | Francis | Ethan, Anthony | Billing milestones/statements appear safely in PMCM/client surfaces; corrections/disputes gated. | Client cannot edit payment records; PMCM internal costs hidden from portals. |
| FL-011 | Finish boundary, thin eligibility | Francis | Ethan, Anthony, Maxine | PMCM owns official floorplans; client sees read-only official snapshots and preference/comment actions. | Client official mutation denial test/evidence; route screenshots if touched. |
| FL-012 | Thin slice | Ethan | Anthony, Maxine | Guest access-code, consent, check-in, and moderated feedback ship without QR/camera. | Valid/invalid access-code tests; consent/check-in/feedback tests; QR gate documented. |
| FL-013 | Thin slice | Francis | Ethan, Anthony | Closure/readiness evidence uses close gates and file matrix; archive comparison remains deferred unless already supported. | Close gate evidence; private notes hidden from portals; docs row updated. |
| FL-014 | Gate/thin queue state | Anthony | Ethan, Francis | Existing notification queue state may be shown; production SendGrid/Viber and AI drafts remain gated. | Notification service tests if touched; adapter gate documented. |
| FL-015 | Finish evidence/gate external auth | Anthony | Maxine | Audit/privacy evidence remains PMCM-scoped; external auth and AI/ZDR stay gated. | Forbidden access/privacy/audit tests; external auth gate documented. |
| FL-016 | Finish shell foundation | Maxine | Francis, Ethan | Shared shell/status language applies to first PMCM and portal surfaces. | UX brief; visual QA checklist; screenshots. |
| FL-017 | Finish | Francis | Maxine, Anthony | Event Command Inbox is the primary PMCM command surface. | Command route check; shared contract source verified. |
| FL-018 | Thin slice or defer | Francis | Anthony, Maxine | Deterministic event health appears only if derived from scoped data; otherwise defer. | Health calculation source documented or deferred row. |
| FL-019 | Thin slice or defer | Francis | Anthony | Decision log ships only if audit/override records support it. | Audit source documented or deferred row. |
| FL-020 | Finish | Ethan | Maxine, Anthony | Client Action Center becomes dashboard entry point. | Client route check; next-action hierarchy screenshot. |
| FL-021 | Thin slice or defer | Francis | Anthony | PMCM Handoff Brief ships as evidence panel only if selected-event data supports it. | Selected-event evidence or deferred row. |
| FL-022 | Thin slice | Ethan | Francis, Anthony | Supplier Readiness Board is clear in supplier portal and reviewable by PMCM. | Supplier route/typecheck; PMCM review path evidence if touched. |
| FL-023 | Gate or thin slice | Francis | Anthony | Staffing heatmap waits for availability/role contract unless chosen as a bounded staffing slice. | Contract/test evidence or explicit gate. |
| FL-024 | Thin slice | Anthony | Ethan, Francis, Maxine | File Requirements Matrix metadata supports PMCM/client/supplier visibility. | Type/API-client/API service tests; real upload gate. |
| FL-025 | Gate or thin slice | Francis | Anthony | Risk/change register waits for scoped mutation contract unless chosen as a bounded control slice. | Contract/test evidence or explicit gate. |
| FL-026 | Thin slice or defer | Francis | Maxine, Anthony | Event Day Run Sheet remains time-ordered evidence if current data supports it. | PMCM route evidence or deferred row. |
| FL-027 | Gate | Anthony | Maxine | Privacy Operations Console remains PMCM-scoped; full console can defer if not demo-critical. | Scope decision, privacy tests if touched, docs gate. |
| FL-028 | Defer | Maxine | Francis, Anthony | Workflow Template Builder is deferred unless explicitly scoped and documented. | Deferred row; no capacity assumed. |

## Correctness and policy evidence

The following notes distinguish bounded correctness fixes from full feature
completion. They do not promote a whole feature family from partial to complete.

- **FL-007/New-S5:** Closure review prompts are event-scoped to confirmed
  supplier assignments. Reviews are advisory, not an archive gate, and ratings,
  dimensions, and notes remain PMCM-only.
- **FL-002/FL-010:** Signed conforme no longer fabricates approved billing. Client payment totals reconcile actual paid and outstanding amounts.
- **FL-005:** Proposal decisions require the primary client's verified identity and an issued proposal version. Reasons, actor/version identity and retries are durable. The production issuer is missing (W12), so the complete review journey remains gated.
- **FL-007:** Supplier terminal transitions, selected-assignment confirmation, cancellation and event-review retries now enforce state, identity and transactional audit rules. Application conversion and complete assessment remain later work.
- **FL-008:** Active assignment identity controls coordinator scope and availability. Same-date booking and replacement share a database lock. Namesakes do not grant authority.
- **FL-013:** Closeout uses explicit deliverables, billing, logistics, unresolved issues and client feedback. Logistics remains missing until an authoritative completion source exists; an archive override needs a durable PMCM reason.
- **FL-015:** Sensitive routes require verified sessions and role/event ownership. Supported operational deletion redacts identity copies atomically; unsupported access, correction and native-account erasure remain unexecuted. Live AI remains disabled before any provider call.
- **W08:** The [accepted authority/lifecycle policy](event-authority-and-lifecycle-policy.md) permits a designated event attendance operator, a seven-day guest-feedback window from recorded event end including archive, and catalog client categories with Private mapped to Individual. Their downstream engineering is not counted as implemented here.

## Earlier thin-slice evidence (2026-09-04)

Active Ledger decisions are unchanged. Additional thin-slice evidence:

- **FL-013:** PMCM can search archived events by venue, event type, and month. Side-by-side compare stays deferred.
- **FL-005:** A client primary-contact approve/request-revision surface exists with a revision cap of 3. The current version/issuer gate above supersedes the earlier assumption that the production review journey was ready. CE builder depth, Canva/Zoom, and AI drafts stay gated.
- **FL-007:** PMCM supplier-applications inbox can request proposal, schedule, or decline; readiness board shows a category gap hard-block when no quote is selected. Storage, production notify, and confidential-bid depth remain gated.
- **FL-008:** Same-date coordinator assignment is blocked with same-role suggestions; override stays secondary. Heatmap, phone/Mys notify, and live AI copilot stay gated.
- **FL-010:** Client billing shows remaining balance and follow-up copy per milestone. Client still cannot edit payments; production reminders stay gated.

## New Candidate Features Added To Scope

| Ledger ID | Candidate | Persona | Decision | Phase | Owner | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| FL-017 | Event Command Inbox | PMCM | Add | Phase 2 | A, B, D | Converts scattered dashboard panels into a single action queue for PMCM work. |
| FL-018 | Event Health Score | PMCM | Add | Phase 2 | A, B, D | Gives deterministic readiness signal across suppliers, coordinators, files, billing, and live issues. |
| FL-019 | Decision Log | PMCM | Add | Phase 7 | B, D | Captures overrides, approvals, scope changes, and management reasoning. |
| FL-020 | Client Action Center | Client | Add | Phase 3 | A, C, D | Narrows client portal to next required actions instead of a generic dashboard. |
| FL-021 | PMCM Handoff Brief | PMCM, Coordinator | Add | Phase 5 | B, D | Creates a reliable bridge from planning data to event-day coordination. |
| FL-022 | Supplier Readiness Board | PMCM, Supplier | Add | Phase 4 | B, C, D | Consolidates supplier readiness, contracts, ingress, concerns, and setup state. |
| FL-023 | Coordinator Staffing Heatmap | PMCM | Add | Phase 5 | B, D | Makes availability, staffing gaps, and replacement options visible before event day. |
| FL-024 | File Requirements Matrix | PMCM, Client, Supplier | Add | Phase 7 | A, B, C, D | Replaces generic file hub thinking with required-item operations. |
| FL-025 | Risk and Change Register | PMCM | Add | Phase 7 | B, D | Combines risk assessment, scope change, freeze, addendum, postponement, and cancellation decisions. |
| FL-026 | Event Day Run Sheet | PMCM, Coordinator | Add | Phase 5 | A, B, D | Gives event-day teams a time-ordered operational view. |
| FL-027 | Privacy Operations Console | PMCM | Add | Phase 11 | D | Turns privacy compliance into an operated workflow. |
| FL-028 | Workflow Template Builder | PMCM | Add | Phase 10 | A, B, D | Lets PMCM define reusable event templates for docs, suppliers, coordinators, and checks. |

## Coordinator stack decisions and scoped evidence (2026-10-03)

**Decision owners:** B (Francis) for staffing and operational policy; D (Anthony) for contracts, authorization and scheduled work; A (Maxine) for shared chrome and PMCM views; C (Ethan) for supplier/guest boundaries. These bounded deliveries retain the Active Ledger family states above. Automated verification does not establish browser acceptance, production notification delivery, or live database performance.

### Accepted staffing policy

- New staffing-role writes use the catalog in `packages/types/src/schemas/coordinator-roles.ts`: General Coordinator, Event Day System Operator, Registration Staff, Floor Director, Stage Director, Ingress and Egress Assistant, Usher. Historical unknown strings remain readable and are not rewritten. Operator actions still require event-specific designation; the role label does not grant authority.
- Skill requirements are advisory. Explicit desk filters require every selected skill. The API preserves activity, role, date-conflict and declared-availability eligibility; normalizes tags; ranks required-skill overlap before deterministic name/ID ties; then caps suggestions at five. Match/missing details explain the result. This supports FL-008/FL-023 without claiming a full staffing heatmap.
- Reassignment approval remains manual. The stored two-minute deadline is not an approval trigger. Acknowledgment follow-ups use the configurable seven-day default; the supplier ingress sweep uses the fifteen-minute late threshold. Notification queue evidence does not establish external delivery.
- Registration staff need an active assignment to the event. Their roster projection is minimized; walk-ins require explicit consent, verification before check-in, and the current PMCM walk-in policy under the event lock. PMCM retains policy ownership.

### Delivery traceability

All links identify implementation/review scope; they are not evidence that a PR is merged.

| PR | Ledger scope | Delivered slice and behavior evidence |
| --- | --- | --- |
| [#105](https://github.com/The-Team-CG/prism/pull/105) | FL-016, A/D | Shared shell extraction with stable exports; package/portal typechecks and boundary gate. |
| [#106](https://github.com/The-Team-CG/prism/pull/106) | Shared contracts, D | Context schema modules and compatibility exports; integrated staging ocular/event-day schemas retained; shared contract tests. |
| [#107](https://github.com/The-Team-CG/prism/pull/107), merged | FL-004/FL-020, FL-005, FL-011, C/B/D | Client actions, timeline/visibility and ocular flow are staging dependencies; client timeline/ocular redaction tests retained during integration. Ocular PA-59 governance remains open. |
| [#108](https://github.com/The-Team-CG/prism/pull/108)–[#112](https://github.com/The-Team-CG/prism/pull/112) | FL-008/FL-023, B/D/A | Approved role/matching design, contracts, server ranking and PMCM filters/conflict suggestions. Shared role rejection, legacy queues, operator authorization, ranking and assignment desk tests. Durable policy is promoted here; completed staffing working documents are retired. |
| [#113](https://github.com/The-Team-CG/prism/pull/113) | FL-008/New-CO1, B/D | Multi-event coordinator selection and venue/history cards; workspace selector and view-model tests. |
| [#114](https://github.com/The-Team-CG/prism/pull/114) | FL-008/New-C3, B/D | PMCM reliability history and withdrawal notes; scoped read-model and idempotent withdrawal tests. |
| [#115](https://github.com/The-Team-CG/prism/pull/115) | FL-008/FL-013, B/D | PMCM coordinator insights; aggregation and client-private-field exclusion tests. |
| [#116](https://github.com/The-Team-CG/prism/pull/116) | FL-008/FL-026, B/D | Coordinator and PMCM event-day polling; visibility, overlap, stale response and last-good-data tests. |
| [#117](https://github.com/The-Team-CG/prism/pull/117) | FL-008/FL-014, B/D | Scheduled acknowledgment follow-ups; lead-time and repeated/concurrent sweep tests. |
| [#118](https://github.com/The-Team-CG/prism/pull/118) | FL-007/FL-022, B/C/D | Supplier ingress late sweep; threshold, exemption, idempotency and atomic audit tests. |
| [#119](https://github.com/The-Team-CG/prism/pull/119) | FL-008/FL-009/FL-025, B/D | PMCM recorded postponement conflict panel and decision-history authorization. Snapshot/retry tests; this is retrospective evidence, not the full interactive rescheduling or risk/change workflow. |
| [#120](https://github.com/The-Team-CG/prism/pull/120) | FL-008/FL-021/FL-026, A/B/D | Schedule authoring/status, handoff and end-of-day forms; event scope, operator permission, transition serialization and report-author tests. A complete handoff brief remains broader work. |
| [#121](https://github.com/The-Team-CG/prism/pull/121) | FL-008/FL-012/FL-015, B/C/D | Coordinator registration/search/verification/check-in and pending walk-in registration; active-role scope, policy/consent, verification and check-in serialization tests. QR/camera and external registration integrations remain gated. |

The integrated stack preserves staging's client changes and existing migration history. Required CI and final immutable-head review are merge gates; live role-path smoke testing remains an acceptance step. Broader heatmap, AI copilot, external notification adapters, interactive postponement handling, and unrelated family criteria are not closed by these slices.

## Next Ledger Maintenance

- 2026-09-03 P0/P1 overlay evidence (uncommitted on `feat/p0-p1-catalog-slices`; Active Ledger decisions unchanged): FL-001 copy-link + rejection history + log-on-behalf copy; FL-002/FL-012 invitation sent/opened/expired + reminder evidence; FL-003/FL-017 Command Inbox on `/dashboard`; FL-004/FL-020 labeled action-center fallback; FL-006/FL-024 file matrix UX with storage gated; FL-007/FL-022 PMCM supplier readiness + quote-lock tests; FL-008 coordinator ack preserves role view (PA-294); FL-010 client billing omits `billingSources`; FL-011 official vs preference floorplan copy; FL-012 guest access-code check-in, QR gated; FL-013 close-gates copy + client-visible insight omits `privateNotes`; FL-015 privacy create/audit tests. P2/P3 gates (live AI, storage adapter, production email/Viber, external IdP, camera QR) remain deferred.
- Expand ledger rows into one row per catalog feature only when implementation teams need ticket-level traceability.
- Keep family-level rows authoritative for product direction.
- Add implementation PR links or commit hashes after each phase lands.
- Do not add a new plan file when a ledger update is enough.
- Keep rows portable: record durable decisions and evidence, not transient context.

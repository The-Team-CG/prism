---
type: "Product Decision Register"
title: "P.R.I.S.M feature ledger"
description: "Active product-family decisions, ownership, sequencing, and evidence for Prism feature work."
tags: [product, features, decisions, ownership]
status: canonical
updated: "2026-11-18"
authority: normative
audience: [product, engineering, design, agents]
scope: "Prism feature-family decisions, ownership, sequencing, and closure evidence"
last_verified: "2026-11-18; slices reconciled with the changelog and shipped portal, API and package surfaces; static documentation review only, no runtime proof"
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
- **Scope:** Feature intent, current state, decision, ownership, dependencies, permissions, evidence, and UX surface.
- **Use when:** Adding, revising, merging, splitting, deferring, gating, or retiring feature scope.
- **Change when:** Product intent, system goal, lifecycle placement, dependency, permission boundary, or completion evidence changes.
- **Verify with:** The current product model, readiness gates in evolution governance, architecture, and affected app/API checks.

This ledger is the product decision layer for feature work. It does not replace
the source-preserving catalog. It decides how catalog features and redesign
candidates should move forward.

Use this file with:

- [`../reference/prism-v4/complete-feature-catalog.md`](../reference/prism-v4/complete-feature-catalog.md) for source feature text and official counts.
- [`evolution-governance.md`](evolution-governance.md) for decision rules.
- [`../../AGENTS.md`](../../AGENTS.md) for system goals and app boundaries.
- [`../architecture/current-architecture.md`](../architecture/current-architecture.md) for module ownership and technical stop rules.

## Selected client and supplier delivery

The [client and supplier workflow contract](client-supplier-workflows.md) records the selected FL-002, FL-004, FL-005, FL-006/024, FL-007, FL-010, FL-011, and closure slices: versioned signing and files, briefing submission, official-layout decisions and annotations, venue/styling decisions, closeout and consent moderation, supplier contract corrections, schedules, creative tasks, and an actual payable release ledger. These slices do not mark the broader feature families complete or activate external services.

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

## Acceptance tracker reconciliation

Evaluate the workbook against current product outcomes, not historical developer assignments. Keep the original criterion and a separate product judgment; source support alone does not certify runtime acceptance.

| Area | Product disposition | Observable acceptance target |
| --- | --- | --- |
| Billing | Retain approved commercial sources; revise automatic-on-signing wording. | A statement traces to approved same-event scope and reconciles recorded payments; signing alone creates no approved amount. |
| Floorplan ownership | Retain separate client preferences and PMCM official editing; revise blanket client-canvas denial. | Client preference edits cannot mutate official layouts or approved snapshots. |
| Attendance | Retain event-specific, revocable operator designation; reconcile contradictory coordinator denials. | Ordinary coordinators mark themselves; only the designated operator gains audited same-event delegated attendance. |
| Client billing visibility | Retain own-event milestones; revise blanket client denial. | Clients see their obligations without PMCM costs, supplier bids or unrelated records. |
| Architecture | Revise historical module, sample-runtime, portal-count and token-location criteria. | Four role apps use scoped contracts, seed-only fixtures and documented context boundaries. |
| Business-rule tradeoffs | Keep open: inquiry retry/matching policy, reassignment timeout authority, post-approval comments, signature sequencing, required games and reviewer capabilities. | Record the chosen behavior and a verifiable criterion before treating the mismatch as accepted or implementing an alternative. |
| Delivery gaps | Keep missing AI use cases and unproven delivery/upload/scheduler execution open. | Verify the actual actor journey and resulting persisted/delivered outcome; foundation code or metadata is insufficient. |

## Active Ledger

| Ledger ID | Source refs | Persona | Current state | Decision | Decision reason | Phase placement | Dependencies | Permission boundary | Audit/notification needs | UX surface | Verification requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FL-001 Inquiry intake and triage | FR-01, FR-44, FR-45, FR-46, FR-47, FR-48, FR-50, FR-51, FR-52, FR-53, FR-54, FR-AI-01 | Public, PMCM | Live/partial | Revise | Keep the public inquiry path, but redesign PMCM intake as an action queue with referral context, duplicate history, organization merge/history cues, and explicit PMCM-only log-on-behalf flow. AI triage remains gated. | Phase 2, Phase 12 for AI | Consent copy, inquiry scoped APIs, organization matching, AI governance for FR-AI-01 | Public can submit only; PMCM owns review, accept, pend, decline, organization merge, and log-on-behalf metadata. | Audit accept/pend/decline/log-on-behalf/organization merge; notify PMCM on high-fit or duplicate inquiries. | Public inquiry, PMCM inquiry inbox, Event Command Inbox | Public cannot spoof PMCM fields; scoped API tests; no dashboard links from public pages; organization merge changes leave an audit trail. |
| FL-002 Onboarding and conforme gate | FR-02, FR-03, FR-26, FR-67, FR-68 | Client, PMCM | Live/partial | Keep | This is a core product boundary: no client dashboard or event creation before accepted inquiry and signed conforme. Versioned template prefill and client/PMCM acknowledgments are implemented in the selected portal slice; production activation and external signing certification remain separate. FR-02 invitation tracking is real: PMCM accepting an inquiry provisions the client login, so the client can review and sign the conforme, and records sent, opened or expired. PMCM can re-send it. | Phase 2, Phase 7 | Document storage, invitations, reminder policy, template service | PMCM uploads/validates signed documents; client can view own status and complete allowed actions. | Audit uploads, signature method, invitation opened/expired, reminder sends. | PMCM onboarding tracker, client action center | Client portal locked until conforme; document state persists; reminder eligibility tests. |
| FL-003 PMCM command dashboard | FR-04, FR-05, FR-12, FR-24 | PMCM | Partial | Merge | Generic dashboards and file/task panels should merge into Event Command Inbox, event workspace, and workflow templates. | Phase 2, Phase 7 | Route inventory, shared shell, task/event APIs | PMCM only; coordinator views get role-safe subsets. | Audit command actions; notify owners on overdue/blocked work. | `apps/event` dashboard, event workspace, command inbox | Route smoke checks; PMCM-only data cannot appear in portals. |
| FL-004 Client portal after conforme | FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-65, FR-66, New-CL1, New-CL2 | Client | Partial | Revise | Client needs a narrow action center, not a broad dashboard. Official floorplan remains read-only except approval/comment workflows; client drafts are preferences only. | Phase 3, Phase 7 | Client scoped reads, document matrix, floorplan preference APIs | Client sees only own event data; cannot see CE, supplier private notes, PMCM costs, coordinator internals, or audit logs. | Audit client submissions, approvals, comments, uploads, walk-in policy; notify PMCM on client action. | Client dashboard, event action center, billing/docs/floorplan sections | Client cannot mutate official layouts; forbidden role access tests; mobile action flow verified. |
| FL-005 Proposal, briefing, and commercial workflow | FR-09, FR-10, FR-11, FR-19, FR-43, FR-58, FR-59, FR-60, FR-61, FR-62, FR-AI-03, FR-AI-09 | PMCM, Client | Partial | Merge/Gate | CE, bid workspace, venue scouting, moodboard/styling approval, proposal review, billing terms, and communication drafts should become one commercial workflow. Canva, Zoom, PowerPoint, and AI code or adapters do not establish credentialed deployment or approved provider use. | Phase 7, Phase 10, Phase 12 | Billing source records, proposal records, venue/styling records, adapter abstraction, AI governance | PMCM owns CE, bid, scouting, styling, and proposal prep; client sees approved proposal, venue/styling options, and comments only. | Audit proposal revisions, approvals, adapter exports, AI drafts, venue/styling decisions, and PMCM approvals. | PMCM proposal workspace, bid workspace, client proposal review, venue/styling review | Proposal approval and billing source stay linked; AI cannot send messages automatically; venue/styling work does not bypass budget confirmation. |
| FL-006 Document and file operations | FR-04, FR-32, FR-33, FR-54, FR-67, FR-70, New-SEC3 | PMCM, Client, Supplier | Partial | Merge | Replace generic file hub with a File Requirements Matrix: owner, visibility, due date, required state, validation, source workflow. A role-filtered event matrix endpoint and shared DTO now exist; confirmed object storage and upload validation are implemented for the selected portal slice; production provider activation, retention, and malware scanning remain separate. | Phase 7, Phase 10 | Upload validation, storage provider, template service, visibility rules | Users see only files allowed for their role/event. PMCM manages requirements and visibility. | Audit upload/download/delete/visibility changes; notify missing/invalid required files. | PMCM files, client files, supplier contract uploads | MIME/size validation tests; forbidden file visibility tests; storage adapter tests. |
| FL-007 Supplier network operations | FR-14, FR-15, FR-16, FR-17, FR-18, FR-35, FR-36, FR-37, FR-38, FR-49, FR-63, FR-64, FR-75, FR-76, FR-77, FR-78, FR-79, FR-87, New-EX1, New-S1, New-S2, New-S3, New-S4, New-S5, New-SUP1, New-SUP2, New-SUP3, New-SUP4, FR-AI-04, FR-AI-04b, FR-AI-06 | Supplier, PMCM | Live/partial | Merge/Revise | Supplier directory, public applications, application inbox/status, quote requests, assignment, readiness, ingress/egress schedule, contract mismatch, outsourced creative sub-tickets, performance assessment, and reliability should become one supplier network workflow. | Phase 4, Phase 7, Phase 12 for PARE/reliability output | Supplier scoped APIs, application intake, quote locks, notifications, readiness/ingress model, AI approval gate | Suppliers see only assigned or application-scoped data. PMCM sees private reviews, reliability, and application decisions. | Audit quotes, revisions, selection, readiness, contract metadata, tier changes, applications, ingress/egress status, creative sub-ticket progress; notify supplier/PMCM. | Supplier portal, PMCM supplier board, Supplier Readiness Board, supplier applications inbox | Supplier cannot see client private data in confidential bids; quote lock tests; assignment confirmation tests; public supplier application cannot expose PMCM-only review data. |
| FL-008 Coordinator and staffing operations | FR-13, FR-88, FR-89, FR-90, FR-91, New-C1, New-C2, New-C3, New-C4, New-CO1, New-CO2, New-CO3, New-CO4, New-CO5, New-CO6, FR-AI-07 | Coordinator, PMCM | Partial | Revise/Add | Use the shared seven-role catalog for new staffing writes, advisory server skill ranking, active-assignment scope, and manual reassignment approval. Delivered slices are recorded below; heatmap and AI copilot remain gated. | Phase 5, Phase 7, Phase 12 for AI copilot | Availability model, role tags, live ops APIs, notification queue, AI governance | Coordinators see only assigned event details for their role. PMCM owns roster, replacement, reliability, escalation, and any AI recommendation approval. | Audit assignment, acknowledgment, attendance, reassignment, replacement, event-day alerts; notify coordinator and PMCM. | PMCM team/staffing, coordinator role views, live ops workspace, event-day run sheet | Role-safe selector tests; no finance/private supplier/audit data in coordinator views; AI copilot cannot act without PMCM approval. |
| FL-009 Compliance, risk, and change control | FR-06, FR-07, FR-10+, New-SY3, New-SY4, FR-96, FR-97 | PMCM | Live/partial | Revise/Add | Compliance should join risk, change freeze, addendum conformes, cancellation/postponement impact, and decision log as one operational control layer. AI advisory remains gated. | Phase 7, Phase 8, Phase 12 for AI advisory | Compliance rules, event values, change register, billing/conforme links, supplier/coordinator impact records | PMCM owns overrides, cancellation/postponement, and addendum decisions; clients see only client-facing requests/status. | Audit overrides, change requests, freeze exceptions, addendum conformes, cancellation, postponement, supplier/coordinator impact checks; notify affected owners. | PMCM risk/change register, compliance panel, cancellation/postponement panels | Override reason required; change freeze enforcement tests; addendum creates billing/conforme trace; cancellation/postponement cannot silently skip supplier/coordinator/billing impact review. |
| FL-010 Billing and payments | FR-20, FR-21, FR-69, FR-92, FR-93, FR-94, New-P5 | PMCM, Client | Partial | Revise | Billing should be tied to approved proposal/CE, terms, disputes, partial payments, waivers, and additional billing. | Phase 8 | Proposal source records, payment records, notification queue | PMCM manages billing; client sees statements, milestones, receipts, and required actions only. | Audit payment records, disputes, waivers, billing generation; notify upcoming/overdue payment. | PMCM finance workspace, client billing action center | Billing amount traces to approved source; waiver/dispute reason required; client cannot edit payment records. |
| FL-011 Floorplan and spatial workflow | FR-08, FR-80, FR-81, FR-82, FR-83, FR-84, FR-28, FR-29 | PMCM, Client | Live/partial | Keep/Revise | Keep editor internals and PMCM official ownership. Revise venue library, presets, table assignment, and client annotation around the official/preference boundary. | Phase 3, Phase 7 | Floorplan editor, venue library, table eligibility, client annotations | PMCM edits official layouts; clients submit preferences and approve/comment on submitted official layouts. | Audit submit/approve/reject/comment/version lock; notify client/PMCM on approval requests. | PMCM floorplan editor, client read-only official layout | Client official mutation forbidden; snapshot persistence tests; table eligibility tests. |
| FL-012 Guest and lightweight access | FR-39, FR-40, FR-41, FR-42, FR-95, New-GU1, New-EX2 | Guest, PMCM, Public | Partial | Gate/Revise | Keep guest access lightweight. Gate QR/camera flows behind HTTPS and masterlist reconciliation; build moderation and consent first. In-event games (FR-40) run as PMCM-hosted sessions guests join without an account. A guest pass promotional sample, if built, stays an external non-live-data demo. | Phase 6, Phase 7, Phase 10 | Guest access codes, consent, moderation, file upload, HTTPS/camera constraints, public demo isolation | Guests need no account; access is event-code or QR scoped; PMCM moderates feedback; promotional sample cannot touch live event data. | Audit consent, check-in, walk-in flag, feedback, moderation; notify PMCM on flagged items. | Guest open-code, guest dashboard, guest games join/session, PMCM games host view, moderation queue | Consent required; no cross-event guest reads; QR not enabled until constraints pass; promotional sample stays isolated from authenticated surfaces. |
| FL-013 Closure, archive, and learning loop | FR-22, FR-23, New-P1, New-P2, New-P3, New-P4, New-SY1, New-SY2, FR-AI-08 | PMCM, Client | Partial | Merge/Gate | Closure, archive, insights, testimonials, logistics, and PEIL should become post-event knowledge and closeout workflow. AI analysis remains gated. Archive is now guarded by the central lifecycle transition table. | Phase 9, Phase 12 for PEIL | Close gates, archive search, feedback, billing/logistics, AI governance | PMCM owns archive and private notes; client sees deliverables/acknowledgment/testimonial only. | Audit close/override/archive/testimonial/logistics; notify required owners before close deadlines. | PMCM closure workspace, archive, client closeout surface | Close blocked unless gates pass or override reason exists; event cannot skip directly from planning to archive; private notes hidden from portals. |
| FL-014 Notifications and communications | FR-25, FR-55, FR-64, FR-AI-09, FR-AI-05 | All | Partial | Revise/Gate | Treat email/Viber as queue-backed notification adapters with templates, language preference, audit, retries, and PMCM-reviewed AI communication drafts. POA remains a PMCM-only assistant concept until AI governance is complete. | Phase 10, Phase 12 | Notification queue, templates, adapter credentials, language preferences, AI governance | Users receive only role-appropriate messages; PMCM controls broadcast, assistant use, and sensitive content. | Audit queued/sent/failed/acknowledged, template version, recipient scope, AI draft approval. | Notification settings, PMCM communication queue, role-specific message surfaces, PMCM assistant review surface | No direct send from UI; adapter retry tests; template visibility tests; AI assistant cannot act or send without PMCM approval. |
| FL-015 Security, privacy, and audit | New-SEC1, New-SEC2, New-SEC3, New-SEC4, FR-56, FR-AI-ZDR | All | Partial | Keep/Gate | Security and privacy remain mandatory cross-cutting capabilities. External auth, privacy notices, export/anonymization, ZDR, retention, and legal hold should mature before high-risk features. | Phase 11, Phase 12 | Auth provider decision, retention policy, privacy operations, AI provider agreement | PMCM sees privacy operations; users can exercise rights only over own data. | Audit auth, access denied, privacy requests, redaction, retention, AI calls. | Privacy operations console, audit settings, auth flows | Forbidden access tests; audit integrity tests; privacy request execution tests; ZDR required before AI. |
| FL-016 Shared design system and shell | Cross-cutting, old UI modernization Phase 2 plan | All | Partial | Keep/Complete | Shared shell, brand/public blocks, and smoke script exist; unused client-blocks exports are retired. Redesign work follows living docs (`AGENTS.md`, this ledger, [evolution governance](evolution-governance.md), and `../architecture/current-architecture.md`). | Phase 1 and ongoing | `packages/ui`, route inventory, smoke script | Shared UI must preserve app role boundaries and avoid public dashboard shortcuts. | N/A except UI actions wired to audited workflows. | Shared app shell, public shell, dashboard/workflow blocks | `npm run smoke:ui`, `npm run check:boundaries`, visual QA checklist. |

## New Candidate Features Added To Scope

| Ledger ID | Candidate | Persona | Decision | Phase | Reason |
| --- | --- | --- | --- | --- | --- |
| FL-017 | Event Command Inbox | PMCM | Add | Phase 2 | Converts scattered dashboard panels into a single action queue for PMCM work. |
| FL-018 | Event Health Score | PMCM | Add | Phase 2 | Gives deterministic readiness signal across suppliers, coordinators, files, billing, and live issues. |
| FL-019 | Decision Log | PMCM | Add | Phase 7 | Captures overrides, approvals, scope changes, and management reasoning. |
| FL-020 | Client Action Center | Client | Add | Phase 3 | Narrows client portal to next required actions instead of a generic dashboard. |
| FL-021 | PMCM Handoff Brief | PMCM, Coordinator | Add | Phase 5 | Creates a reliable bridge from planning data to event-day coordination. |
| FL-022 | Supplier Readiness Board | PMCM, Supplier | Add | Phase 4 | Consolidates supplier readiness, contracts, ingress, concerns, and setup state. |
| FL-023 | Coordinator Staffing Heatmap | PMCM | Add | Phase 5 | Makes availability, staffing gaps, and replacement options visible before event day. |
| FL-024 | File Requirements Matrix | PMCM, Client, Supplier | Add | Phase 7 | Replaces generic file hub thinking with required-item operations. |
| FL-025 | Risk and Change Register | PMCM | Add | Phase 7 | Combines risk assessment, scope change, freeze, addendum, postponement, and cancellation decisions. |
| FL-026 | Event Day Run Sheet | PMCM, Coordinator | Add | Phase 5 | Gives event-day teams a time-ordered operational view. |
| FL-027 | Privacy Operations Console | PMCM | Add | Phase 11 | Turns privacy compliance into an operated workflow. |
| FL-028 | Workflow Template Builder | PMCM | Add | Phase 10 | Lets PMCM define reusable event templates for docs, suppliers, coordinators, and checks. |

## Correctness and policy evidence

These are bounded fixes; they do not move a family from partial to complete.

- **FL-002/FL-010:** Signing a conforme creates no billing; client totals reconcile paid and outstanding amounts.
- **FL-005:** Proposal decisions need the primary client's verified identity and an issued version. PMCM issues the estimate, numbered version and PDF together; the client sees title, summary and total, revisions cap at 3, and an approved proposal changes only through the change register.
- **FL-007:** Supplier transitions, confirmation, cancellation and reviews enforce state, identity and audit. Approved applications become pending-first-event suppliers; one PMCM assessment per supplier per event; reviews and ratings stay PMCM-only and do not gate archive.
- **FL-008:** Active assignment controls coordinator scope; same-date booking and replacement share a database lock.
- **FL-010:** An amount-discrepancy correction needs a second PMCM approver (self-approval is a 403); waivers and additional billing are single-step.
- **FL-013:** Archive checks deliverables, billing, logistics, open issues and client feedback; logistics needs an audited PMCM record and an override needs a reason.
- **FL-015:** Sensitive routes need verified sessions and event ownership. Erasure, correction and export run atomically through PMCM privacy operations; guest deletion needs a unique roster identity, and ambiguous guest records need manual review.
- **Authority and lifecycle policy:** The [accepted policy](event-authority-and-lifecycle-policy.md) is implemented: designated event-day operator, seven-day guest feedback window from the recorded end, and the four client categories (legacy Private becomes Individual).

## Accepted staffing policy

- New staffing-role writes use the catalog in `packages/types/src/schemas/coordinator-roles.ts`: General Coordinator, Event Day System Operator, Registration Staff, Floor Director, Stage Director, Ingress and Egress Assistant, Usher. Historical unknown strings remain readable and are not rewritten. Operator actions still require event-specific designation; the role label does not grant authority.
- Skill requirements are advisory. Explicit desk filters require every selected skill. The API preserves activity, role, date-conflict and declared-availability eligibility; normalizes tags; ranks required-skill overlap before deterministic name/ID ties; then caps suggestions at five. Match/missing details explain the result. This supports FL-008/FL-023 without claiming a full staffing heatmap.
- Reassignment approval remains manual. The stored two-minute deadline is not an approval trigger. Acknowledgment follow-ups use the configurable seven-day default; the supplier ingress sweep uses the fifteen-minute late threshold. Notification queue evidence does not establish external delivery.
- Archived coordinator events remain selectable for scoped historical reads. Portal action controls and coordinator event-day, schedule, handoff, report, acknowledgment and withdrawal API writes enforce read-only archive access; switching to a current event restores normal actions.
- Registration staff need an active assignment to the event. Archived roster reads remain available, while verification, walk-in creation and check-in reject archived events; verification checks archive status under the event lock. Their roster projection is minimized; walk-ins require explicit consent, verification before check-in, and the current PMCM walk-in policy under the event lock. PMCM retains policy ownership.

## Implemented slices and open limits

Each slice closes only the behavior listed. Automated checks do not establish browser acceptance, production delivery or live database performance.

| Ledger scope | Implemented behavior | Open limits |
| --- | --- | --- |
| FL-001 | PMCM organization merge with reason and audit; duplicate, previous-decline and high-fit cues; log-on-behalf with a Pending Full Details state; optional spatial preferences on the public form; advisory AI triage that changes no status and never sends contact details. | Triage advice is not in the access export and has no staging evaluation; company-name change log and dormant-client alerts are unbuilt. |
| FL-002 | PMCM downloads the conforme PDF with its SHA-256 for physical signing; an accepted inquiry whose email matches a client account joins that account. | Physical signing returns through a manual PMCM upload; no external e-signature certification. |
| FL-004 | Styling options wait for the client's confirmed styling budget; venue options do not. A venue submission opens one PMCM ocular task. | Budget confirmation happens on briefing submit; there is no separate confirm step. |
| FL-017/FL-020 | PMCM command inbox with live-ops, overdue, blocked, payment, dispute, correction and late-payout items; one shared work-list row on the PMCM Inbox, client home and supplier Today; PMCM Events opens on events that need action; client action center with feedback, change requests and addendum acknowledgment. | The client feedback prompt runs from event end until archive. |
| FL-003/FL-004/FL-022 | Events and bookings are cards (cover, countdown, stage, what is waiting, money) on every portal; event overviews lead with the cover, next step, Needs you, readiness and the next 30 days. PMCM sets covers. | Browser acceptance of cards and overviews is not recorded. |
| FL-006/FL-024 | One file library for every role: per-event cards, a Needed from you list, search, filters and preview; PMCM review queue with reasons and notices; ZIP download and server-side reuse for clients; valid-until dates with expiry reminders; cleanup of unfinished uploads; message attachments as member-only copies. Role-filtered requirement matrix, custom requirements, overrides and reminders; byte-checked uploads; one file access policy for every file kind. | Database acceptance is open. `uploadedAssetId` has two meanings; the event file list truncates at 500 rows; the client billing read still returns the statement's storage ids. Supplier-owned custom requirements apply to every selected supplier. Supplier contracts, status photos and guest feedback media bypass storage confirm. |
| FL-007/FL-022 | Supplier applications inbox and public apply/status pages; shared server readiness with keyset paging; category-gap block; late-ingress sweep and reliability notes; readiness requests seven days out; ingress conflict flags; private verification data removed from supplier reads. | Stored historical receipts are filtered, not rewritten. Broader reliability reporting is open. Venue type is not shown to suppliers. |
| FL-005 | AI proposal wording drafts into the form without client identity and is never stored; PowerPoint and Canva export, package options, revision comments, presentation booking with optional Zoom, and the bid workspace have slices. | Providers need credentials and operational verification; AI quality has no staging evaluation. |
| FL-008 | Multi-event coordinator selection, reliability history, insights, event-day polling, blockable tasks, acknowledgment follow-ups, schedules, handoffs, end-of-day reports with PMCM flags, registration desk with walk-in verification, and registration platform tracking. | Staffing heatmap (FL-023) is open. Phone notices need Viber. QR/camera and external registration are gated. Flagged walk-ins send no instant notice; the large-event threshold is not enforced. |
| FL-009/FL-025 | Freeze exceptions for cancellation and postponement; change requests with impact checks and risk levels; client notices without internal reasons; hashed addendum versions acknowledged by the client before PMCM countersigns, with billing changes applied only then. | An addendum can exceed the proposal ceiling and never changes payment milestones (follow-ups). Statements cut while an addendum is pending exclude its delta. Older billing lines are untraced. Policy defaults are unconfirmed; there is no interactive rescheduling. |
| FL-010 | Client billing across events with payment reporting and proof that counts after PMCM verifies it; How to pay from PMCM's payment details; PMCM Finance desk with queue, bulk verify, reminders, history, charts and export; branded PDFs; supplier payouts with confirmation and receipts; disputes with severity, corrections, waivers and additional billing; receipt recording, reversal and refunds; once-per-milestone reminders. | Browser acceptance and production reminder delivery are separate evidence. |
| FL-011 | Official drafts from venue presets; table-assignment eligibility in the editor and on save; reopen and resubmit of client preferences; non-binding notes from secondary contacts; PMCM-set event privacy (private by default). | Browser acceptance; event privacy is API-only with no PMCM control; ocular findings cannot be saved to the venue library. |
| FL-012 | Access-code check-in with consent, moderated feedback, QR passes scanned over HTTPS or typed, and PMCM-hosted games joined by PIN. | Camera scanning needs a browser QR reader; typed codes are the fallback. |
| FL-013 | Audited logistics record drives the close gate; archive is read-only; archive search and comparison of 2 to 4 events; five-day deliverable endorsement window; testimonial consent and moderation; advisory PEIL report. | A broader testimonial library and post-event knowledge search are open. |
| FL-014 | One Notifications screen per portal with acknowledgment and unread counts; one Messages inbox across events with members, closing, attachments and PMCM read receipts; message notices by email and linked Viber; per-recipient delivery and escalation. | A delivery record is not proof a person read it. Email needs a configured provider; Viber needs its bot and webhook; other channels and AI-drafted messages are gated ([operational communications](../runbooks/operational-communications.md)). |
| FL-015 | Account page on every portal: name, password, recent sign-ins, per-device sessions, optional two-step sign-in (required for PMCM admins, resettable by PMCM), and email change by confirmation link that relinks every email-keyed record. | Guests have no account. Sessions from before device sessions end every session on sign-out. No automated browser suite for Account. |
| FL-015/FL-027 | PMCM privacy console (Queue, Log a request, Legal holds, Retention) with paging, due dates and self-assignment; access/export, erasure and correction; disabled-by-default retention with a review queue and legal holds. Clients and suppliers file password-confirmed requests on one Privacy screen, withdraw them, see notices, and download their data instantly. | The 30-day default and retention periods need sign-off; no operator assignment or overdue notices; retention covers inquiry and guest records only (no finance); guest feedback identity linkage is unfinished. |
| FL-019 | PMCM-only decision log with paged reads, reasons, filters and pending requests. | Access-category audit records are excluded. |
| FL-021 | Read-only handoff brief: full for PMCM, a reduced subset for assigned coordinators. | A complete handoff brief is broader work. |
| FL-026 | Role-projected run sheet with schedule, supplier windows, deadlines and issues, a printable PMCM route, and a guest-operations block without guest names. | Days follow Philippine time; an unknown day returns 404. |
| FL-003/FL-004/FL-008/FL-026 | One calendar (Month, Week, Day, Agenda) for PMCM, clients, suppliers and coordinators, with side-panel details linking to where each item is handled. | Guests have no calendar; nothing spans days; browser acceptance is not recorded. |

FL-018 Event Health Score and FL-023 Staffing Heatmap remain open; FL-028 Workflow Template Builder is deferred. External auth, storage-provider activation and malware scanning keep their gates. A configured AI provider does not qualify a use case for live data; follow the [AI data policy](ai-data-policy.md).

## Catalog coverage

The counts below are a 2026-11-11 source-audit snapshot of `staging`. This
documentation cleanup did not rerun the complete catalog audit. A feature that
appears in more than one catalog section is counted once. Browser role-path
acceptance, production delivery, and live database performance remain separate
evidence.

| Result | Features |
| --- | --- |
| Done | 124 |
| Partial | 3 (FR-20 and New-C4 by recorded decision; New-SEC2 waits on legal sign-off) |
| Built, held behind an external gate | 8 (Viber: FR-13, FR-25, FR-34, FR-64, FR-75; Zoom: FR-61; Canva: FR-59, New-P3) |
| Not built | 0 |

**Done** (124): FR-01 Inquiry Intake Log · FR-02 Client Onboarding Tracker · FR-03 Conforme and MOA Storage · FR-04 Per-Event File Hub · FR-05 Live Operations Dashboard · FR-06 Compliance Engine · FR-07 Risk Assessment · FR-08 Floor Plan Upload and Client Approval · FR-09 Moodboard Upload · FR-10 Venue Scouting · FR-12 EOD Report Inbox · FR-14 Supplier Directory · FR-15 Tier 1/Tier 2 Designation · FR-16 Supplier Selection Policy Layer · FR-17 Quote Request and Comparison · FR-18 Competitive Bidding · FR-19 Cost Estimation Builder · FR-21 Post-Event Additional Billing · FR-22 Post-Event Documentation Tracker · FR-23 Event Archive with Search · FR-24 Toggle System · FR-26 Portal Gated by Signed Conforme · FR-27 Event Progress Visibility · FR-28 Client Draft Floor Plan · FR-29 Official Floor Plan Approval · FR-30 Moodboard Client Approval · FR-31 Styling Budget Confirmation · FR-32 Document Submission Portal · FR-33 Per-Event File Hub Access · FR-35 Supplier Profile · FR-36/FR-49 Quote Submission / Confidential Bid · FR-37 Assignment Confirmation · FR-38 Contract Upload · FR-39 Digital Registration and Masterlist · FR-40 Event Games · FR-41 Guest Experience Upload · FR-42 Guest Pass Promotional Sample · FR-43 Bid Workspace · FR-44 Organization Merge · FR-45 Referral Details · FR-46 Public Inquiry Page · FR-47 Spatial Preference Form · FR-48 Referral Source Dropdown · FR-50 Abandoned Inquiry Draft Save · FR-51 Client Type Field · FR-52 Send Inquiry Link and Log on Behalf · FR-53 Pre-Conforme Context Notes · FR-54 Pre-Conforme Document Attachment · FR-55 Bilingual Email Templates · FR-56 Data Anonymization · FR-58 Event Briefing Form · FR-60 Proposal Review · FR-62 Tiered Package Options · FR-63 Supplier Gap Warning · FR-65 Client-Owned Supplier Sub-Ticket · FR-66 Venue Ocular Task Trigger · FR-67 Template Pre-Fill · FR-68 Dual Signing Path · FR-69 Payment Terms · FR-70 Accreditation Tracker · FR-76 Supplier Unresponsive Escalation · FR-77 Contract Mismatch Warning · FR-78 Ingress and Egress Schedule · FR-79 Supplier Reliability Notes · FR-80 Floor Plan Builder · FR-81 Venue Library · FR-82 Quick Setup Presets · FR-83 Client Annotation and Approval · FR-84 Table Assignment List · FR-87 Creative Designer Sub-Ticket · FR-88 Coordinator Double Booking · FR-89 Coordinator Withdrawal · FR-90 Coordinator Acknowledgment · FR-91 Coordinator Availability · FR-92 Payment Milestones · FR-93 Partial Payments · FR-94 Statement to Proposal Link · FR-95 Lightweight Digital Registration · FR-96 Cancellation · FR-97 Postponement · New-C1 Coordinator Role Views · New-C2 System Operator Tag · New-C3 Late/No-Show Flag · New-CL1 Walk-In Policy · New-CL2 Event Day Limited View · New-CO1 Coordinator Homepage · New-CO2 Floor/Stage Director View · New-CO3 Registration Staff View · New-CO4 Ingress/Egress Assistant View · New-CO5 Operator View · New-CO6 Usher/General Coordinator View · New-EX2 Guest Feedback Page · New-GU1 Ticketed Registration Coordination · New-P1 Event Comparison · New-P2 Event Insights Card · New-P4 Logistics Booking Record · New-P5 Billing Waiver · New-S1/New-SUP3/New-EX1 Supplier Registration · New-S2 Applications Inbox · New-S3 Pending First Event · New-S4 Performance Assessment · New-S5 Internal Supplier Review · New-SEC1 Authentication and Sessions · New-SEC3 Upload Validation · New-SEC4 Audit Trail · New-SUP1 Event-Day Status Updates · New-SUP2 Readiness Confirmation · New-SUP4 Application Status · New-SY1 Wrap-Up Screen · New-SY2 One-Screen Close · New-SY3 Change Freeze · New-SY4 Addendum Conforme. AI: FR-AI-01 Inquiry Triage · FR-AI-03 Proposal Drafting · FR-AI-04 PARE · FR-AI-04b PARE Supplier Recommendation · FR-AI-05 Operations Assistant · FR-AI-06 Reliability Scoring · FR-AI-07 Event-Day Copilot · FR-AI-08 PEIL · FR-AI-09 Client Communication Assistant · FR-10+ Compliance Advisory · FR-11/FR-15 Theme and Moodboard Suggestions · FR-AI-ZDR Governance Layer.

**Partial**, with the missing part:

- FR-20 Billing Statement Generation: issued by PMCM, not on signing (decision below).
- New-C4 Task Reassignment: approval stays manual by policy (decision below). The phone notice goes out on Viber once Viber is configured.
- New-SEC2 Privacy Module: retention stays off by default until legal sign-off on the defaults, and the retention sweep has no finance category, which also needs that sign-off. The personal information inventory covers inquiry, guest and finance surfaces. Both the privacy request queue and the retention review queue are paged.

**Built, held behind an external gate:**

- Viber (FR-13, FR-25, FR-34, FR-64, FR-75): accounts link the P.R.I.S.M bot and choose Viber on or off; email stays on. Needs `VIBER_AUTH_TOKEN`, `VIBER_BOT_URI` and a registered webhook.
- Zoom (FR-61): the presentation's Zoom meeting is created when the client books and deleted on reschedule. Needs a Zoom Server-to-Server OAuth app (`ZOOM_*`).
- Canva (FR-59, New-P3): issued proposals and approved testimonials fill PMCM's Canva brand templates; the PowerPoint export also stays. Needs Canva Enterprise, a Canva Connect integration (`CANVA_*`) and the two templates.
- AI: Provider code and deployment settings do not qualify an AI use case. Each use case needs policy, data-flow, approval, and deployment evidence. See the [AI data policy](ai-data-policy.md) and [AI provider routing runbook](../runbooks/ai-provider-routing.md). Camera QR scanning needs HTTPS and a supported browser, with typed pass codes as the fallback.

Setup for Viber, Zoom and Canva: [external integrations](../runbooks/external-integrations.md).

**Not built:** none.

**Recorded decisions where code differs from the catalog text:**

- FR-55: Filipino email copy needs review by a fluent speaker before launch.
- FR-20: signing a conforme generates no billing statement; statements trace to an approved proposal source.
- FR-22: PMCM has five days after the recorded actual event end to endorse deliverables.
- New-C4: reassignment approval stays manual; the stored two-minute deadline is not an approval trigger.
- FR-52: Pending Full Details ignores privacy consent, because an inquiry logged on behalf never passes the public consent step.
- FR-31: only styling options wait for the confirmed styling budget; venue options are not design work.
- FR-06: the compliance engine is rule-based, not NLP. Inquiry event types are free text, so the eighteen event-type rules match six event-type groups by keyword; an event matching no group gets none of them.
- FR-40: Live Trivia is the V4 Ice Breaker Quiz and Spin the Wheel is the Raffle Draw; Live Poll, Word Cloud and Open Q and A are their own games.
- FR-AI-04: PARE coordinator mode ranks and drafts by rule (coordinators have no budget stage) and waits for PMCM approval; the AI model is used only in supplier mode.
- FR-39/FR-95: the API holds no guest portal URL, so PMCM sends each guest's pass link from the event portal; the pass page draws the QR from the link alone.
- New-CL1: the client owns the walk-in policy until event day; PMCM owns it from event day on.
- FR-43: a bid's workspace is the inquiry's locked pre-conforme record. PMCM can hold the TOR and bid documents, send confidential quote requests, prepare venue options and build the cost estimate there before signing. Styling options keep the FR-31 confirmed-budget gate, so a bid's styling concept goes in the bid proposal document. A won bid accepts the inquiry; a lost bid is left for PMCM to close, because the decline email would be wrong for a lost pitch.
- FR-61: PMCM either pastes a Zoom, Meet or Teams link or has the Zoom meeting created on booking through the deployment's Zoom account.
- FR-25: email always stays on, because account, security and invitation mail depend on it; the preference is whether Viber gets updates too. A Viber row for email-only accounts is skipped, not failed.
- FR-AI-07: the copilot advises the operator and never acts; the panel polls each minute and reuses the last advice while the minimized facts are unchanged.
- FR-AI-05: the assistant answers from event-level counts and statuses only and has no tools; suggested next steps are text PMCM acts on.
- New-SEC3: the coordinator on-site status form takes no photo; suppliers attach byte-checked photos to their own status updates, and guest feedback media is stored only after the byte check.

## Next Ledger Maintenance

- Expand ledger rows into one row per catalog feature only when implementation work needs ticket-level traceability.
- Keep family-level rows authoritative for product direction.
- Record delivered behavior and open limits in the family tables above; PR numbers and dates are not status.
- Do not add a new plan file when a ledger update is enough.
- Keep rows portable: record durable decisions and evidence, not transient context.

---
type: "Product Reference"
title: "P.R.I.S.M actual system"
description: "Current product identity, actors, lifecycle, workflows, ownership, and completion evidence for PMCM's event operating system."
tags: [product, current-state, lifecycle, roles]
status: stable
updated: "2026-09-01"
sources:
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism product boundaries"
  - id: architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current technical architecture"
  - id: feature-ledger
    resource: "docs/product/feature-ledger.md"
    title: "Active feature decisions"
---
# P.R.I.S.M actual system

This document describes the current P.R.I.S.M system in product terms: what the
complete system is, who uses it, what each workflow must do, and what
information each role owns or can see. For implementation gaps, use
[`implementation-revisions.md`](implementation-revisions.md) and
[`feature-ledger.md`](feature-ledger.md). For software architecture,
app/package/API boundaries, and technical stop rules, use
[`../architecture/current-architecture.md`](../architecture/current-architecture.md).
For target maturity, use [`future-state.md`](future-state.md).

## System Identity

P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It supports the complete lifecycle of a PMCM event from inquiry intake to post-event archive. It is built around operational trust: every actor should know what needs attention, who owns the next action, what is blocked, what changed, and what evidence supports the decision.

P.R.I.S.M is not a public SaaS product. It is not a generic venue, ticketing, supplier marketplace, or CRM product. It is a role-specific operating system for PMCM's internal event delivery model, with external portals only where clients, suppliers, and guests need constrained participation.

## System Goals

| Goal | What the system must make true |
| --- | --- |
| Lifecycle continuity | A single event can move from inquiry to conforme, planning, event-day operation, closure, and archive without losing state or ownership. |
| Role clarity | PMCM, client, supplier, coordinator, and guest users each see the right work surface for their responsibility. |
| Operational command | PMCM can see priority work, risk, blockers, approvals, supplier status, client actions, billing state, files, floorplans, and live event issues from the event command app. |
| Portal safety | Client, supplier, and guest portals expose only scoped information and never PMCM internal costs, private supplier notes, audit records, or unrelated event data. |
| Evidence-backed work | Important actions produce audit, notification, status, or evidence records so decisions can be reviewed later. |
| Human-controlled automation | AI and automation assist PMCM but cannot silently approve, send, mutate, or execute high-risk actions without human approval. |
| Completion honesty | A feature is complete only when its route, actor, contract, boundary, failure state, and evidence are clear. |

## System Actors

| Actor | Purpose in the system | Primary app |
| --- | --- | --- |
| PMCM admin / Ms. Mys | Owns event decisions, inquiry acceptance, supplier selection, billing, compliance, floorplans, approvals, privacy/audit review, and closure. | `apps/event` |
| PMCM team member | Operates event planning work, task queues, client/supplier follow-up, documents, and event-day coordination. | `apps/event` |
| Coordinator | Receives role-safe event-day assignments, updates status, responds to tasks/issues, and supports live operations. | `apps/event` coordinator-safe views |
| Client | Submits inquiry, signs conforme, reviews approved planning outputs, completes required actions, submits preferences, pays/acknowledges billing, and reviews closeout items. | `apps/client` |
| Supplier | Receives quote requests, submits/revises quotes, confirms awarded assignments, uploads/records contract metadata, reports readiness, and updates event-day status. | `apps/supplier` |
| Guest | Uses lightweight event access, checks in with consent, may be flagged as walk-in, and may submit moderated feedback. | `apps/guest` |
| Public visitor | Views public entry points and submits inquiry or supplier application where enabled. | `apps/client` public pages and future supplier application path |

## System Surfaces

| Surface | Role in the full system |
| --- | --- |
| Public inquiry | Public event request intake with consent, event details, contact details, duplicate/referral context, and PMCM-safe triage metadata. |
| PMCM command inbox | Priority queue for inquiries, approvals, overdue items, file gaps, supplier issues, billing risks, live operations, privacy requests, and closure blockers. |
| Selected event workspace | PMCM's event-specific operating view: lifecycle, client, proposal, floorplan, suppliers, files, billing, compliance, live ops, audit, and closure. |
| Client action center | Client's next-action view for conforme, documents, proposal review, billing, floorplan preferences/approval, closeout, and allowed messages/status. |
| Supplier readiness board | Supplier and PMCM view of quote, assignment, contract, readiness, ingress/egress, concerns, and event-day supplier progress. |
| Coordinator/live-ops workspace | Role-safe event-day task, issue, attendance, replacement, and status surfaces for PMCM/coordinators. |
| Guest pass and check-in | Lightweight event-code access, pass display, consented name check-in, walk-in flagging, and feedback. |
| Privacy and audit console | PMCM-only trust surface for privacy requests, redaction, retention, login/security events, audit integrity, and AI governance evidence. |
| Archive and learning loop | Post-event closure, deliverables, feedback, insights, testimonials, archive search/comparison, and reusable learning. |

## End-To-End Lifecycle

| Step | System behavior | Primary owner | External actor involvement |
| --- | --- | --- | --- |
| 1. Public inquiry | Collect event request, consent, contact details, event basics, source/referral, and duplicate context. | PMCM | Public visitor submits. |
| 2. Inquiry triage | PMCM reviews, accepts, pends, declines, merges/flags duplicates, or logs on behalf with audit. | PMCM | Client sees only appropriate status if portal access exists. |
| 3. Conforme and onboarding | Event creation and client dashboard access are gated until accepted inquiry plus signed conforme. | PMCM | Client signs/acknowledges and sees own onboarding status. |
| 4. Briefing and proposal | PMCM prepares event brief, commercial proposal, venue/styling options, budget/CE evidence, and client-safe review artifacts. | PMCM | Client reviews approved artifacts and gives allowed feedback/approval. |
| 5. Planning | PMCM operates files, floorplans, suppliers, billing, compliance, risk, approvals, and schedule readiness from selected event workspace. | PMCM | Client, supplier, and coordinator interact only through scoped views. |
| 6. Supplier procurement and readiness | PMCM sends quote requests, compares supplier responses, selects suppliers, locks quote states, tracks contracts/readiness/ingress/egress. | PMCM | Suppliers submit quotes, confirm assignments, and update readiness/status. |
| 7. Floorplan workflow | PMCM owns official floorplan edits, submits snapshots, controls approval/versioning, and manages table/venue rules. | PMCM | Client submits preferences/comments and reviews official snapshots read-only. |
| 8. Event-day operations | PMCM and coordinators operate tasks, urgent issues, attendance, replacements, supplier status, guest operations, and live logs. | PMCM | Coordinators, suppliers, and guests update only their scoped areas. |
| 9. Closure | PMCM completes close gates for files, billing, supplier review, floorplan/logistics, feedback, deliverables, and archive readiness. | PMCM | Client sees closeout items and allowed deliverables/testimonial requests. |
| 10. Archive and learning | System preserves event history, insights, decisions, supplier/coordinator reliability, feedback, and reusable patterns. | PMCM | External users see only allowed post-event artifacts. |

## Functional System Areas

| Area | Full system detail |
| --- | --- |
| Inquiry intake and triage | Public inquiry submission, consent, duplicate detection, referral/source capture, previous rejection flags, PMCM log-on-behalf, accept/pend/decline actions, organization merge/history cues, and audit trail. |
| Onboarding and conforme gate | Invitation, accepted inquiry state, signed conforme validation, reminder policy, awaiting/opened/expired states, document evidence, and portal unlock rules. |
| PMCM command dashboard | Event Command Inbox, selected-event summary, lifecycle status, urgent actions, owner visibility, blockers, approvals, overdue tasks, and event health/readiness cues. |
| Client portal | Conforme-gated dashboard, client action center, own event status, approved proposal review, document requirements, billing statements/milestones, floorplan preference and read-only official layout review, activity/status, and closeout actions. |
| Proposal and commercial workflow | CE/bid preparation, proposal source records, venue/styling options, client-approved proposal surfaces, billing source linkage, adapter export decisions, and PMCM-reviewed communication/AI drafts where approved. |
| Document and file operations | File Requirements Matrix with owner, visibility, due date, required state, generated/uploaded source, validation state, audit, notification intent, and role-filtered views. |
| Supplier network operations | Supplier directory, categories, tiering, PMCM private reviews, certifications, public application/status path, quote request lifecycle, confidential bids, quote revisions, selection, contract metadata, readiness, ingress/egress, creative sub-tickets, performance assessment, and reliability signals. |
| Coordinator and staffing operations | Coordinator roster, roles, skills, availability, assignments, acknowledgment, attendance, replacement, role-safe event-day views, staffing heatmap, escalation, and live status feed. |
| Compliance, risk, and change control | Event-type rules, phase rules, severity/layer, override reason audit, risk register, freeze exceptions, addendum conformes, cancellation/postponement impact, decision log, and supplier/coordinator/billing impact review. |
| Billing and payments | Approved proposal/CE source linkage, billing statements, payment milestones, payment records, receipts, disputes, waivers, typo corrections, post-event additional billing, overdue/payment-at-risk alerts, and client-safe billing visibility. |
| Floorplan and spatial workflow | Venue templates, official floorplan editing, layout objects, table rules, table assignments, client preferences, comments, submitted/approved official snapshots, version locks, approval/revision states, and PMCM-only mutation. |
| Guest operations | Event access code, guest pass, consent, name check-in, attendance count, walk-in flag, guest feedback, moderation, future masterlist reconciliation, and future QR/camera path when approved. |
| Closure, archive, and learning loop | Close gates, archive guard, override reason, event insights, feedback capture, testimonial library, archive search/comparison, post-event documents, logistics review, and reusable lessons. |
| Notifications and communications | Queue-backed notification intent, template/version record, recipient scoping, retry/failure/acknowledgment state, role-safe messages, language preference, and PMCM approval before sensitive or AI-assisted sends. |
| Security, privacy, and audit | Role-based access, consent, privacy requests, retention, redaction/anonymization, legal hold, audit logs, login history, security alerts, forbidden access tracking, and audit integrity checks. |
| AI governance and PARE | Data sanitization, ZDR requirement, AI audit log, approval records, PMCM human approval, PARE emergency response planning, reliability scoring, recommendation review, and no autonomous action without approval. |
| Shared system design | Shared shell, tokens, UI primitives, role-specific density, state language, responsive behavior, no public dashboard shortcuts, and visual consistency without merging role ownership. |

## Full Feature Family Map

| Ledger ID | Full system role |
| --- | --- |
| FL-001 | Inquiry intake and triage. |
| FL-002 | Onboarding and conforme gate. |
| FL-003 | PMCM command dashboard. |
| FL-004 | Client portal after conforme. |
| FL-005 | Proposal, briefing, and commercial workflow. |
| FL-006 | Documents and file operations. |
| FL-007 | Supplier network operations. |
| FL-008 | Coordinator and staffing operations. |
| FL-009 | Compliance, risk, and change control. |
| FL-010 | Billing and payments. |
| FL-011 | Floorplan and spatial workflow. |
| FL-012 | Guest and lightweight access. |
| FL-013 | Closure, archive, and learning loop. |
| FL-014 | Notifications and communications. |
| FL-015 | Security, privacy, and audit. |
| FL-016 | Shared design system and shell. |
| FL-017 | Event Command Inbox. |
| FL-018 | Event Health Score. |
| FL-019 | Decision Log. |
| FL-020 | Client Action Center. |
| FL-021 | PMCM Handoff Brief. |
| FL-022 | Supplier Readiness Board. |
| FL-023 | Coordinator Staffing Heatmap. |
| FL-024 | File Requirements Matrix. |
| FL-025 | Risk and Change Register. |
| FL-026 | Event Day Run Sheet. |
| FL-027 | Privacy Operations Console. |
| FL-028 | Workflow Template Builder. |

## Data Ownership Rules

| Data or action | PMCM | Client | Supplier | Coordinator | Guest |
| --- | --- | --- | --- | --- | --- |
| Inquiry decision | Full control | Own inquiry status only | Not applicable | Not applicable | Not applicable |
| Conforme and onboarding | Full control and verification | Own status and required actions | Not applicable | Not applicable | Not applicable |
| Official floorplan | Create/edit/submit/approve/lock | Read-only review plus preferences/comments | Assigned logistics only | Role-safe event-day logistics | Not visible |
| Proposal/CE/internal costs | Full PMCM control | Approved client-facing proposal only | Not visible | Not visible | Not visible |
| Supplier quotes | Create/compare/select/lock | Not visible unless approved into proposal | Own quote only | Not visible | Not visible |
| Supplier private review | Full PMCM control | Not visible | Not visible | Not visible | Not visible |
| File requirements | Define and manage visibility | Own visible requirements | Own visible requirements | Role-safe attachments only | Not visible unless guest-specific later |
| Billing | Full control | Statements, receipts, milestones, required actions | Contract metadata only where relevant | Not visible | Not visible |
| Live operations | Full control | Client-safe status only if exposed | Own assignment/status | Own role-safe tasks/status | Check-in/pass/feedback only |
| Audit logs | Full PMCM trust surface | Not visible except own request status if exposed | Not visible except own request status if exposed | Not visible | Not visible |
| Privacy operations | Full PMCM processing | Own privacy request path | Own privacy request path | Own privacy request path if applicable | Consent/feedback scope only |
| AI recommendations | Review, approve, reject, audit | No autonomous effect | No autonomous effect | No autonomous effect | No autonomous effect |

## Core Records The Full System Needs

| Record family | Examples |
| --- | --- |
| Identity and access | Users, roles, sessions, login history, security alerts, actor context. |
| Inquiry and event | Inquiry, accepted status, event record, lifecycle phase, selected event workspace, approval requests. |
| Documents and files | Requirements, generated docs, uploaded metadata, visibility, validation, due dates, audit events. |
| Floorplans | Venue templates, draft layouts, objects, submitted snapshots, approved snapshots, comments, version locks. |
| Suppliers | Supplier profile, category, certification, review, quote request, quote, assignment, contract metadata, readiness, reliability note. |
| Coordinators | Coordinator profile, skills, availability, assignment, task, replacement, attendance, reliability note. |
| Operations | Compliance rules/checks, risk/change records, live logs, urgent issues, event-day run sheet, handoff brief. |
| Commercials | Billing source, statements, milestones, payment records, disputes, waivers, additional billing. |
| Guests | Access code, pass data, check-in, walk-in flag, feedback, moderation. |
| Trust | Audit logs, notification logs, privacy requests, retention policy, redaction actions, AI audit and approval records. |

## Completion Evidence The Actual System Requires

| Evidence | Why it matters |
| --- | --- |
| Route and actor evidence | Proves each lifecycle step can be operated by the correct role. |
| Scoped API/type contract | Proves portals are not relying on broad shared state or hidden PMCM data. |
| Permission-boundary proof | Proves clients, suppliers, guests, and coordinators cannot cross role boundaries. |
| Failure/empty/loading states | Proves operators understand what is missing, blocked, invalid, or waiting. |
| Audit/notification decision | Proves important actions leave reviewable trace or queued communication intent. |
| External dependency decision | Proves storage, auth, notifications, QR/camera, and AI are approved or explicitly gated. |
| Documentation synchronization | Proves the catalog, ledger, calendar, architecture, current state, and future state agree. |

## External Dependency Policy

| Dependency | Full-system rule |
| --- | --- |
| Database | The system needs reliable database access for normal API-backed operation. Workarounds for local/free-tier connectivity must be documented without exposing secrets. |
| File storage | Real storage must include validation, signed access, progress/retry behavior, visibility rules, audit, and failure handling before being called complete. |
| Notifications | Production delivery must run behind queue-backed templates, retries, recipient scope, failure states, and audit. |
| External auth | Provider integration must preserve role boundaries, session migration, local/dev fallback, tests, and rollback behavior. |
| QR/camera | QR scanning must wait for HTTPS/device support, fallback code path, masterlist reconciliation, and consent/privacy review. |
| AI | AI must wait for ZDR/provider approval, data sanitizer proof, prompt/data policy, audit retention, PMCM approval workflow, and no-autonomous-action enforcement. |

## Owner Outcomes For The Full System

| Owner | Full-system outcome |
| --- | --- |
| Maxine | The whole system feels like one coherent PMCM operating system across separate role apps, with usable density, clear states, route-level review, and no banned visual treatments. |
| Francis | PMCM and coordinator workflows are operationally useful: command inbox, selected event workspace, supplier/quote/floorplan/billing/compliance/live-ops/closure evidence, and chosen depth slices. |
| Ethan | External portals are safe and useful: clients, suppliers, and guests can complete their own work without seeing PMCM internals or unrelated event data. |
| Anthony | Platform trust is explicit: scoped contracts, session conventions, file matrix, privacy/audit, AI governance, dependency gates, source-ID traceability, and final evidence packet. |

## Actual System Completion Rule

The actual P.R.I.S.M system is complete enough for a milestone claim only when every lifecycle step has a working, role-safe slice or an explicit gate, every `FL-001` through `FL-028` row has an outcome, and every high-risk dependency is either approved with evidence or named as gated/deferred.

Do not use this document to claim the current implementation is done. Use
[`implementation-revisions.md`](implementation-revisions.md) and
[`feature-ledger.md`](feature-ledger.md) for current gaps, and
[`future-state.md`](future-state.md) for the target transition.

# P.R.I.S.M Revision Phase Plan

Last updated: 2026-05-01

This is the durable look-back plan for revising the current P.R.I.S.M implementation. It uses `07-implemented-feature-revisions.md` as the current-state source and `01-complete-feature-catalog.md` as the complete Version 4 feature source.

The rule for all phases is revision first: if a feature already exists as live, partial, or prototype, deepen and correct that path before creating a parallel mockup.

## Phase Summary

| Phase | Focus | Definition of done |
| --- | --- | --- |
| Phase 0 | Docs consolidation and cleanup | Active docs point to `docs/prism-v4`; superseded root planning files are removed; no child app source is touched. |
| Phase 1 | API RBAC, actor context, and scoped reads | Dashboard data is protected by demo role context and new work no longer expands broad `/api/demo/state` by default. |
| Phase 2 | Inquiry/onboarding extraction and dashboard splits | Inquiry and conforme workflows are extracted from the API facade; PMCM and client dashboard shells are smaller and workflow-owned. |
| Phase 3 | Supplier, quote, finance, and floorplan hardening | Supplier directory, quote lifecycle, payment records, and official floorplan snapshots behave as event-owned workflows. |
| Phase 4 | Compliance, billing source of truth, close gates, archive, and insights | Compliance rules are configurable; billing is tied to proposal/CE data; archive requires close indicators or documented override. |
| Phase 5 | Portal hardening, notifications, file validation, and AI governance | Supplier/guest workflows are event-scoped; notifications and uploads have safe infrastructure; AI cannot ship without ZDR, sanitization, audit, and approval. |
| Phase 6 | Event-day live operations | PMCM and assigned coordinators can run event-day tasks, urgent issues, supplier setup verification, coordinator attendance, guest attendance, and live logs from scoped APIs. |
| Phase 7 | Live-ops reliability | Event-day work has SLA status, escalation, coordinator replacement, role-safe status feeds, and queued notification hooks without live AI, QR scanning, or production notification adapters. |
| Phase 8 | Security, privacy, and audit readiness | Demo auth stores hashed credentials with legacy upgrade; public personal-data writes require consent; PMCM has privacy inventory and audit hash-chain verification. |
| Phase 9 | Privacy operations and audit hardening | PMCM can manage privacy requests, see retention policies, execute soft redaction, and keep audit/event history append-only in normal workflows. |

## Phase 0 - Docs Consolidation And Cleanup

Goal: make `docs/prism-v4` the active documentation home.

| Work item | Action |
| --- | --- |
| Canonical phase file | Keep this file as the look-back roadmap. |
| V4 navigation | Link this file from `00-index.md` and `MANIFEST.md`. |
| Root references | Keep `README.md`, `CLAUDE.md`, and `AGENTS.md` pointed at `docs/prism-v4`. |
| Superseded files | Remove `Prism-CHECKLIST.md`, `prism-strategy.md`, `prism-feature-list.md`, and `DESIGN.md` from the root workspace. |
| Kept root files | Keep `README.md`, `CLAUDE.md`, `AGENTS.md`, `.impeccable.md`, `.gitignore`, `skills-lock.json`, `start-prism.*`, and `stop-prism.*`. |

Verification:

- `rg -n "Prism-CHECKLIST|prism-strategy|prism-feature-list|DESIGN.md" . -g "*.md"` returns no active references to removed files.
- `rg -n "07-implemented-feature-revisions|08-revision-phase-plan|01-complete-feature-catalog" docs README.md CLAUDE.md AGENTS.md` shows the active doc chain.
- `git status -sb` is checked in all five child repos.

## Phase 1 - API RBAC, Actor Context, And Scoped Reads

Goal: stop portal data access from depending on UI-only routing and broad state payloads.

| Area | Revision |
| --- | --- |
| Demo auth | Add API actor context for PMCM admin, client, supplier, coordinator, and guest flows. |
| Role guards | Add route-level demo RBAC metadata for dashboard/event endpoints. |
| Scoped reads | Add focused reads for inquiries, onboarding, events, suppliers, audit, billing, and guest access instead of expanding `/api/demo/state`. |
| Audit | Ensure restricted or denied access attempts are visible in audit/security logs where appropriate. |

Verification:

- `npm run test:event-ops`
- `npm run typecheck`
- `npm run build`
- `npm run prisma:validate`

## Phase 2 - Inquiry/Onboarding Extraction And Dashboard Splits

Goal: protect the first defense flow and reduce high-risk large files.

| Area | Revision |
| --- | --- |
| API services | Extract inquiry acceptance, pending/decline, duplicate detection, previous rejection flags, conforme reminders, portal invitations, and conforme upload into focused services. |
| PMCM app | Split `prism-event` PMCM shell into inquiry, event list, event detail, billing/activity, and action-handler units. |
| Client app | Split client dashboard into overview, briefing, layout, billing, documents, and activity units. |
| State | Preserve current behavior while migrating panels to scoped reads. |

Verification:

- Focused API tests for inquiry accept/pend/decline, duplicate flag, previous rejection flag, conforme upload, and reminder eligibility.
- `npm run build` in `prism-event`.
- `npm run build` in `prism-client`.

## Phase 3 - Supplier, Quote, Finance, And Floorplan Hardening

Goal: make the strongest partial workflows operational instead of demo-only.

| Area | Revision |
| --- | --- |
| Supplier directory | Add create/edit, private PMCM review, tier-change reason, certification metadata, and audit trail. |
| Quote lifecycle | Connect PMCM quote requests to supplier-side submit/revise flows with deadline, status, confidentiality, comparison, selection, and lock behavior. |
| Finance | Keep billing statement generation, manual payment history, remaining balance, and Payment At Risk as separate finance surfaces. |
| Floorplans | Persist submitted/approved official snapshots; keep PMCM official editing in `prism-event`; keep client official layout review read-only. |

Verification:

- API tests for supplier tier/review, quote request/submission/selection, payment record audit, and floorplan submit/approve boundary.
- `npm run build` in `prism-event`.
- `npm run build` in `prism-supplier` once supplier submission UI is touched.

## Phase 4 - Compliance, Billing Source, Close Gates, Archive, And Insights

Goal: turn the defense differentiators into rule-backed workflows.

| Area | Revision |
| --- | --- |
| Compliance | Replace hardcoded checks with configurable rules by phase, event type, severity, condition key, and active flag. |
| Billing source | Generate billing from approved proposal/CE totals and link disputes or corrections to source records. |
| Close gates | Require document, billing, logistics, supplier review, and feedback indicators before archive unless PMCM overrides with reason. |
| Insights | Generate Event Insights from supplier reviews, issues, billing, documents, and feedback. |

Verification:

- API tests for compliance rule generation, override audit, billing-source link, archive blocking, archive override, and insights output.
- `npm run build` in `prism-api` and `prism-event`.

## Phase 5 - Portal Hardening, Notifications, File Validation, And AI Governance

Goal: harden the outer workflows after the core PMCM lifecycle is reliable.

| Area | Revision |
| --- | --- |
| Supplier portal | Add event-scoped quote submission, assignment confirmation, readiness confirmation, and event-day status buttons. |
| Guest portal | Add name-based check-in first, then walk-in verification, attendance counts, feedback submission, and moderation queue. |
| Notifications | Replace mock-only logs with queued, sent, failed, and acknowledged notification job states. |
| Uploads | Validate MIME type, file size, allowed extensions, generated filenames, and rejection messages. |
| AI | Implement `FR-AI-ZDR`, `DataSanitizer`, `AIAuditLog`, and human approval records before any live AI feature. |

Verification:

- `npm run build` in touched frontend apps.
- API tests for notification queue, upload rejection/acceptance, sanitizer behavior, audit writes, and AI approval gates.

## Phase 6 - Event-Day Live Operations

Goal: add the missing live event-day layer without starting live AI, QR scanning, or a new coordinator app.

| Area | Revision |
| --- | --- |
| Live operations API | Add event-scoped records for event-day tasks, urgent issues, coordinator attendance, supplier setup verification, and event-day log entries. |
| Supplier verification | Keep supplier self-reported Phase 5 statuses, then let PMCM/coordinators mark setup as `self_reported`, `verified`, or `disputed`. |
| Coordinator attendance | Track `present`, `late`, `absent`, and `replaced`; create reliability/audit metadata when a coordinator is marked late or absent. |
| PMCM workspace | Add a PMCM live-ops panel for supplier readiness, coordinator attendance, guest attendance count, urgent issues, task completion, and live log review. |
| Coordinator role views | Keep coordinator surfaces in `prism-event`; show assigned-event, role-safe views for floor/stage, registration, ingress/egress, event-day operator, and usher/general coordinator roles. |

Verification:

- API tests for PMCM full live ops, assigned coordinator role-safe reads, urgent issue create/resolve, coordinator late/absent reliability notes, supplier verification, and registration attendance access.
- `npm run test:event-ops`, `npm run typecheck`, `npm run build`, and `npm run prisma:validate` in `prism-api`.
- `npm run build` in `prism-event`.
- Regression checks for public dashboard links, client official floorplan mutation, and PMCM-only private data leakage.

## Phase 7 - Live-Ops Reliability

Goal: harden the Phase 6 live event-day layer for real PMCM execution pressure.

| Area | Revision |
| --- | --- |
| Live-ops extraction | Keep routes compatible while moving SLA/status-feed helper behavior out of the broad event-ops facade. |
| SLA timers | Add SLA due time, computed status, escalation level, escalated actor, escalation notes, and resolution timestamps to event-day tasks and urgent issues. |
| Escalation | Add PMCM/coordinator escalation writes for tasks and urgent issues with event-day log, audit log, and queued notification side effects. |
| Coordinator replacement | Let PMCM replace a coordinator assignment with a new pending assignment, reliability note, audit metadata, live log, and queued notifications. |
| Role-safe feeds | Add PMCM/coordinator-scoped status feeds; registration can see check-ins while other coordinator roles only see assigned tasks, issues, supplier setup status, and live logs. |
| PMCM workspace | Add overdue/SLA badges, escalation controls, replacement picker, and status-feed filters in `prism-event`. |

Verification:

- API tests for overdue SLA computation, task/issue escalation side effects, coordinator replacement, replaced reliability metadata, role-safe feeds, and non-live-ops actor rejection.
- `npm run db:generate`, `npm run test:event-ops`, `npm run typecheck`, `npm run build`, and `npm run prisma:validate` in `prism-api`.
- `npm run build` in `prism-event`.
- Regression checks for public dashboard links, client official floorplan mutation, and supplier/guest/coordinator private data leakage.

## Phase 8 - Security, Privacy, And Audit Readiness

Goal: harden the demo security and privacy story before live AI, QR scanning, production notification adapters, external auth, or real file storage.

| Area | Revision |
| --- | --- |
| Demo auth | Move password hashing/verification helpers out of the event-ops facade; store seeded passwords as `scrypt` hashes; upgrade legacy plaintext values after successful login. |
| Privacy consent | Require persisted consent metadata on public inquiry, supplier approval request, guest check-in, and guest feedback writes. |
| Privacy inventory | Add PMCM-only event and surface inventory for personal-data categories, counts, consent gaps, privacy notice versions, and retention notes. |
| Audit integrity | Add PMCM-only audit hash-chain verification with first broken row reporting. |
| PMCM workspace | Show audit integrity, security alerts, failed-login trends, approval backlog, privacy records, and consent gaps from scoped PMCM reads. |
| Portal updates | Add concise privacy consent checkboxes on public inquiry, approval request, guest check-in, and guest feedback forms. |

Verification:

- API tests for hashed password login, legacy plaintext upgrade, wrong-password lockout counters, pending-account gate, consent rejection/persistence, audit integrity pass/tamper detection, and PMCM-only privacy inventory.
- `npm run db:generate`, `npm run test:event-ops`, `npm run typecheck`, `npm run build`, and `npm run prisma:validate` in `prism-api`.
- `npm run build` in `prism-event`, `prism-client`, `prism-supplier`, and `prism-guest`.
- Regression checks for public dashboard links, client official floorplan mutation, and PMCM-only private data leakage.

## Phase 9 - Privacy Operations And Audit Hardening

Goal: move from passive privacy inventory to PMCM-operated privacy request handling without starting live AI, QR scanning, external auth, production notification adapters, or real file storage.

| Area | Revision |
| --- | --- |
| Auth extraction | Keep `/api/auth/*` contracts compatible while delegating login, approval requests, approval review, and login history to a focused auth operations service. |
| Privacy requests | Add PMCM-only request logging, queue reads, review, reject, approve, and execute actions for access, correction, deletion, and export requests. |
| Retention policies | Add PMCM-only retention policy reads for inquiry, approval request, supplier, guest check-in, guest feedback, documents, and audit surfaces. |
| Soft redaction | Execute deletion requests by redacting personal fields while preserving event, finance, operations, and audit records. |
| Audit hardening | Use append-only audit entries for privacy review and redaction; normal privacy execution must not delete or mutate audit rows. |
| PMCM workspace | Add privacy operations controls beside audit/security monitoring in `prism-event`. |

Verification:

- API tests for auth compatibility, retention policies, privacy request create/list/review/execute, soft redaction, audit-chain validity, and non-PMCM rejection.
- `npx prisma migrate dev --name phase9_privacy_operations_audit_hardening`, `npm run db:generate`, `npm run test:event-ops`, `npm run typecheck`, `npm run build`, and `npm run prisma:validate` in `prism-api`.
- `npm run build` in `prism-event`.
- Regression checks for public dashboard links, client official floorplan mutation, and PMCM-only private data leakage.

## Phase Guardrails

- Keep `prism-client` as the client/public portal, not an all-role PMCM shell.
- Keep PMCM command workflows in `prism-event`.
- Keep one shared API in `prism-api`.
- Do not expose PMCM internal CE, private supplier reviews, audit logs, or internal cost data to clients, suppliers, or guests.
- Do not let public pages link directly to dashboards.
- Do not let clients edit official floorplans.
- Do not ship AI actions without PMCM approval.

## Look-Back Checklist

Before starting any phase:

1. Re-read `07-implemented-feature-revisions.md`.
2. Confirm which feature refs the phase touches in `01-complete-feature-catalog.md`.
3. Confirm child repo status is clean or intentionally scoped.
4. Write or update focused tests for the touched workflow.
5. Run the verification commands listed for that phase.

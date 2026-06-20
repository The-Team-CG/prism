# Implemented Feature Revision Backlog

Last updated: 2026-06-15

This file separates the complete feature catalog from the current implementation reality. Use it when deciding what already exists, what needs revision, and how to revise it without breaking the role-specific app boundaries.

The complete feature source remains `01-complete-feature-catalog.md`, but the catalog is now treated as the baseline inventory rather than a hard ceiling. Use `10-product-evolution-and-redesign-governance.md` and `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` when deciding whether to add, revise, merge, split, defer, retire, or gate a feature during the whole-app redesign.

This document is a working backlog for implemented or partially implemented features that need hardening before more scope is added. It should feed the Phase 0 feature ledger rather than freeze the product scope.

## Sources Reviewed

| Source | Use |
| --- | --- |
| `01-complete-feature-catalog.md` | Complete Version 4 feature list and official counts. |
| `04-implementation-plan.md` | Target frontend, backend, entity, dependency, and acceptance criteria by feature. |
| `10-product-evolution-and-redesign-governance.md` | Rules for adding, revising, merging, deferring, or retiring features during redesign. |
| `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` | Active whole-app redesign and capability maturity plan. |
| `14-redesign-readiness-foundation.md` | Current handoff rules for sample-state fencing, session conventions, owner boundaries, and legacy removal. |
| `apps/api/prisma/schema.prisma` | Current persistence model coverage. |
| `apps/api/libs/modules/event-ops/src/controllers/*` | Current API surface. |
| `apps/event/src/app/dashboard/EventDashboardClient.tsx`, `apps/event/src/app/dashboard/components/event-dashboard-skeleton.tsx`, `apps/event/src/app/components/pmcm/*`, and `apps/event/src/app/components/public/event-command-landing.tsx` | Current PMCM command app surfaces. |
| `apps/client/src/app/components/dashboard/Dashboard.tsx` | Current client portal dashboard. |
| `apps/supplier/src/app/dashboard/page.tsx` | Current supplier portal dashboard. |
| `apps/guest/src/app/open/page.tsx` | Current guest access-code entry flow. |

## Status Legend

| Status | Meaning |
| --- | --- |
| Live | Visible UI and API flow are connected enough for the defense story. |
| Partial | Main model, endpoint, or UI exists, but important catalog behavior is missing. |
| Prototype | Mostly seeded, static, mock-log, or locally scoped behavior. |
| Planned | Present in docs, not meaningfully implemented in the current apps. |

## Current Implementation Snapshot

| Area | Current state | Keep | Revision pressure |
| --- | --- | --- | --- |
| Shared API | `apps/api` owns the NestJS event-ops module, Prisma models, sample auth, scoped reads, inquiry/onboarding service, event, floorplan, supplier, coordinator, billing source, compliance rule, close gate, insights, audit, notification queue, upload validation, guest access, AI governance foundation routes, Phase 6 event-day live operations routes, Phase 7 SLA/escalation/replacement status-feed routes, Phase 8 security/privacy/audit readiness endpoints, and Phase 9 privacy request operations. | One shared API on port `4000`. | Phase 9 adds auth operations extraction, PMCM retention policy reads, privacy request queue/review/execute actions, and soft redaction while preserving audit/event history; `EventOpsService` is still broad and later phases should continue extracting billing, floorplan, closure, notifications, guest, AI governance, and live-ops services. |
| PMCM command app | `apps/event` has PMCM sign-in, extracted public event-command landing, extracted inquiry intake, onboarding tracker, event workspace, supplier directory create/edit/review/certification/tier controls, quote planner, financial workspace, Phase 4 closeout workspace, coordinator desk, Phase 6/7 live-ops workspace, audit/security/privacy summary, privacy operations queue, approval requests, floorplan editor access, and API-backed command inbox/selected-event workspace read models. The shell command actions now consume `PrismPmcmCommandInbox`; selected-event sections load `PrismPmcmEventWorkspace` through a feature hook plus shared selector; event readiness/live-ops and approval-request loading live in feature hooks; PMCM action orchestration now lives in `use-pmcm-action-runner.ts`; admin approvals are now `AdminApprovalsPanel`; floorplans, briefing, suppliers, activity, and the event messages workspace are now `EventFloorplansTab`, `EventBriefingPanel`, `EventSuppliersTab`, `EventActivityPanel`, and `EventMessagesWorkspace`; signed-in loading state is now `EventRoleLoadingState`; public entry is now `EventCommandLanding`; legacy dashboard skeleton/loading states are now isolated in `event-dashboard-skeleton.tsx`; dashboard route-to-shell helpers now live in `event-dashboard.routing.ts`; and the root page now uses `apps/event/src/app/lib/session.ts` for event-session storage. | PMCM and coordinator ownership stays in `apps/event` on port `3004`. | Next redesign work should continue route-section extraction, event-workspace route decomposition, live-ops/file-matrix enrichment, and production notification adapters. |
| Client portal | `apps/client` has public/client surfaces, privacy-consented public inquiry and access approval request flows, conforme-gated dashboard, event filtering, split overview/briefing/billing/documents/activity sections, layout preference actions, read-only official layout snapshot review, and an API-backed client action-center read model that now feeds the dashboard action cards with derived-action fallback. | Public pages remain landing and inquiry only; client dashboard stays signed in. | Next redesign work should enrich document/file-matrix and approval actions, then remove fallback derivation after all action types are covered by `PrismClientActionCenter`. |
| Supplier portal | `apps/supplier` has a supplier-scoped dashboard that reads assigned quote requests, submits/revises quotes, confirms awarded assignments, records readiness, saves contract metadata, sends event-day statuses through the API, submits privacy-consented supplier approval requests, and now displays the API-backed Supplier Readiness Board on the dashboard. | Supplier remains a separate portal on port `3002`. | Next redesign work should deepen supplier self-service applications, PMCM-side readiness parity, and real file upload. |
| Guest portal | `apps/guest` has an access-code entry flow backed by `/api/guest/events/:accessCode`, a shared `PrismGuestEventPass` contract, event attendance count, privacy-consented name-based check-in, walk-in flagging, and privacy-consented moderated feedback writes. | Guest remains a separate portal on port `3003`. | Next redesign work should keep the pass lightweight while adopting the shared guest pass contract; QR scanning, masterlist reconciliation, and richer moderation queues remain future work. |
| Shared docs | `docs/prism-v4` now contains the complete v4 catalog, implementation plan, defense guide, revision backlog, and product evolution governance. | `01-complete-feature-catalog.md` remains the baseline traceability source for catalog rows and official counts. | Root docs must not drift back to the old all-role `apps/client` shell, stale v3-only counts, or fixed-catalog planning assumptions. |

## Revision Backlog By Capability

| Capability | Feature refs | Current status | Revision needed | How to revise |
| --- | --- | --- | --- | --- |
| Public inquiry and intake log | FR-01, FR-46, FR-48, FR-51, FR-52 | Live | Phase 2 added duplicate detection, previous rejection flags, referral details, and PMCM-only log-on-behalf metadata. | Keep public inquiry unable to spoof `Log on Behalf`. Continue by adding a visible PMCM log-on-behalf form and richer referral filtering when the PMCM page split continues. |
| Client onboarding and conforme gate | FR-02, FR-03, FR-26 | Live | Phase 2 extracted inquiry/onboarding behavior and added invitation opened/expired behavior. Reminder policy remains simple and event-specific reminder configuration is still future work. | Keep event creation and client portal access gated by signed conforme. Continue with per-event reminder policy and clearer PMCM UI states for awaiting conforme vs invitation sent/opened/expired. |
| PMCM event command dashboard | FR-04, FR-05 | Partial | Phase 7 adds SLA timers/statuses, task and urgent-issue escalation, role-safe status feed, queued notification hooks, and coordinator replacement controls on top of Phase 6 live operations. | Continue extracting `apps/event/src/app/page.tsx` and `apps/event/src/app/dashboard/EventDashboardClient.tsx` into shell, event detail, live-ops, billing/activity, and action-handler units. Add richer operator-specific automation and production delivery adapters only after credentials and retry policy are settled. |
| Client portal after conforme | FR-27, FR-29, FR-32, FR-33, FR-34, New-CL1 | Partial | Phase 1 added scoped reads; Phase 2 moved client event and billing refreshes to scoped reads and split several dashboard sections. The File Requirements Matrix now has a role-filtered event endpoint for client-visible document requirements. Anthony Sprint 2 contract note: File Requirements Matrix remains the shared metadata contract for PMCM/client/supplier file visibility, with tests covering client filtering and PMCM-only supplier review requirements. Real storage, signed URLs, upload progress, and retry behavior are gated until a storage adapter contract and tests exist. | Continue replacing remaining broad state slices for briefings, activity, and floorplan drafts with event-scoped endpoints. Keep official layouts read-only for clients. |
| Floorplan builder and approval | FR-08, FR-80, FR-81, FR-82, FR-83, FR-84 | Live | Phase 3 persists submitted and approved official snapshots and blocks client actors from official floorplan mutation. Table rules and event-type/guest-count conditions still need hardening. | Keep editor internals intact. Make `apps/event` the edit owner. Keep `apps/client` read-only for official layout snapshots and preference-only for client drafts. Continue with table-assignment eligibility rules. |
| Supplier directory and tiering | FR-14, FR-15, FR-35, FR-79, New-S5 | Live | Phase 3 added supplier create/edit, private PMCM reviews, certification metadata, and tier-change reason audit. Supplier application intake is still separate from directory CRUD. | Keep supplier reviews private to PMCM. Continue with application intake and supplier self-service status tracking in the later portal hardening phase. |
| Supplier quote requests | FR-16, FR-17, FR-18, FR-43, FR-49, FR-63, FR-64, FR-75, FR-76, FR-77 | Live | Phase 3 connects PMCM quote requests to supplier submit/revise flows, confidential token reads, comparison, selection, competitor closeout, and quote locks. | Keep quote comparison in `apps/event` and supplier submission in `apps/supplier`. Continue with assignment/readiness handoffs in Phase 5. |
| Coordinator assignment and portal | FR-13, FR-88, FR-89, FR-90, FR-91, New-C1 to New-C4, New-CO1 to New-CO6 | Partial | Phase 7 adds replacement actions that mark the old assignment replaced, create a new pending assignment, write reliability/audit/live-log metadata, and queue notifications; coordinator role views now surface SLA/escalation badges. Roster, availability calendar, skills filtering depth, and reminder automation still need work. | Extend coordinator model with availability windows and richer replacement conflict handling. Keep role-specific views in `apps/event`; continue hardening floor/stage, registration, ingress/egress, operator, and usher task payloads without exposing finance, private reviews, compliance overrides, or audit logs. |
| Compliance engine | FR-06, FR-07, New-SY3 | Live | Phase 4 replaced hardcoded sample checks with active compliance rules by event type, phase, severity, layer, condition key, and title. PMCM override now requires a documented reason and writes audit metadata. | Continue with richer condition evaluation from event values and the 7-day pre-event re-check. AI advisory stays blocked until Phase 5 governance exists. |
| Billing and payments | FR-20, FR-21, FR-69, FR-92, FR-93, FR-94, New-P5 | Partial | Phase 4 added approved CE/proposal billing source records and billing generation from approved source line items while keeping statement, payment schedule, history, and Payment At Risk separate. | Continue with configurable payment terms, amount-discrepancy dispute records, typo correction workflow, post-event additional billing, waiver reason, and urgent-issue linkage. |
| Closure, archive, and insights | FR-22, FR-23, New-P1, New-P2, New-SY1, New-SY2 | Partial | Phase 4 added close gates for documents, billing, floorplan/logistics, supplier review, and feedback; archive blocks unless gates pass or PMCM gives an override reason; deterministic Event Insights are generated from supplier reviews, compliance, billing, documents, and feedback. Close gates now expose the same typed matrix contract used by the dedicated file requirements endpoint. Archive also uses the central lifecycle transition table, so events cannot skip directly from planning into closure/archive. | Continue with archived-event search/comparison views, testimonial library, richer feedback capture, explicit transition commands for earlier lifecycle steps, and PEIL AI only after Phase 5 governance. |
| Notifications | FR-25, FR-55 | Partial | Phase 5 adds queued, sent, retried, failed, and acknowledged notification states with sample processing and PMCM acknowledgement; Phase 7 uses queued hooks for escalation and coordinator replacement. Queue processing now retries failed adapter attempts before terminal failure. Real SendGrid/Viber adapters are still not connected. | Keep sample adapters credential-free. Add production adapters behind the queue only after environment setup, dedicated integration metadata, and delivery audit questions are settled. |
| Security, privacy, and audit | New-SEC1 to New-SEC4, FR-56, FR-AI-ZDR | Partial | Phase 9 adds focused auth operations delegation, PMCM retention policies, privacy request queue/review/execute flows, and soft redaction for personal fields while keeping audit rows append-only in normal workflows. API-backed sample auth now preserves normal HTTP auth/validation responses while mapping Prisma database connectivity failures to explicit service-unavailable guidance for `db:doctor:runtime`; Anthony Sprint 2 verification also records the local free-tier Supabase session-pooler path with `ALLOW_POOLER_FOR_PRISMA=1` when paid IPv4 direct database access is unavailable. Browser session key names and read/write/clear mechanics now live in `@prism/types`, including explicit legacy client-key migration; production-grade auth/provider controls remain out of scope. | Continue with richer retention calendars, explicit legal hold handling, document-specific redaction, and external auth only when that scope is approved. |
| Supplier portal | FR-35 to FR-38, New-SUP1 to New-SUP4 | Live | Phase 5 connects awarded supplier assignments to assignment confirmation, readiness confirmation, contract metadata validation, and Arrived/Set Up/Done event-day status buttons. | Continue with supplier application intake, supplier-side document history, and real upload storage after Phase 5 upload policy is stable. |
| Guest portal | FR-39, FR-40, FR-41, FR-95, New-GU1, New-EX2 | Partial | Phase 5 adds access-code-scoped name check-in, walk-in flagging, attendance counts, moderated feedback records, and the shared `PrismGuestEventPass` read contract. QR scanning and masterlist reconciliation remain deferred. | Keep guest lightweight. Build moderation and masterlist reconciliation before QR scanning; QR scanning should wait until HTTPS/sample constraints are solved. |
| AI features | FR-AI-01, FR-AI-03, FR-AI-04, FR-AI-04b, FR-AI-05 to FR-AI-09, FR-AI-ZDR | Partial | Phase 5 adds `DataSanitizer`, `OpsAiAuditLog`, `OpsAiApprovalRecord`, ZDR confirmation blocking, and human approval-gate records. No live AI call is shipped. | Keep live AI blocked until governance records are reviewed, ZDR is confirmed for the selected provider, and every AI suggestion requires PMCM approval before action. |
| Shared UI, contracts, and editor code | Cross-cutting | Partial | UI primitives and editor internals are copied across apps. Shared DTO coverage now includes the File Requirements Matrix, close-gate matrix payload, API-client route for event file requirements, lifecycle transition rules consumed by the API lifecycle service, shared role-session storage helpers consumed by the client, event, supplier, and guest apps, and Sprint 2 role-boundary and contract tests for PMCM command inbox, client action center, supplier readiness board, official floorplans, internal costs, privacy operations, event scoping, and File Requirements Matrix visibility. | Add `packages/prism-ui`, `packages/prism-contracts`, and `packages/prism-floorplan-editor` or a temporary source-sync strategy. Continue moving route responses, actor-scoped view models, and auth/session provider seams into shared contracts before large UI rewrites depend on them. |
| Root documentation | Cross-cutting | Partial | Root folder is not a git repo, so active planning docs need one canonical local home. | Keep `AGENTS.md`, `README.md`, and `CLAUDE.md` pointed at `docs/prism-v4`. Use `08-revision-phase-plan.md` for phase planning and keep superseded root planning docs removed. |

## Recommended Revision Order

| Order | Revision slice | Why it comes first |
| ---: | --- | --- |
| 1 | API sample RBAC, actor context, and scoped reads | Prevents portal features from leaking data and reduces dependence on broad `/api/sample/state`. |
| 2 | Inquiry and onboarding extraction | Protects the first defense flow: inquiry, acceptance, conforme, portal unlock. |
| 3 | PMCM page split and client dashboard split | Reduces risk before adding more workflow depth. |
| 4 | Supplier directory CRUD and quote lifecycle | Connects `apps/event` and `apps/supplier` into a real workflow. |
| 5 | Floorplan submit/approve snapshots | Protects the PMCM-owned official floorplan rule. |
| 6 | Configurable compliance rules | Completed in Phase 4 for rule-backed checks and override audit; richer condition evaluation remains future hardening. |
| 7 | Billing from CE/proposal and payment audit tests | Completed in Phase 4 for approved billing sources; disputes, waivers, and additional billing remain future hardening. |
| 8 | Close gates, archive, and Event Insights Card | Completed in Phase 4 for gated archive, override reason, and deterministic Event Insights; archive comparison remains future hardening. |
| 9 | Notification queue and file validation | Completed in Phase 5 for queued/sent/failed/acknowledged notification states and upload metadata validation; real delivery adapters and storage remain future hardening. |
| 10 | Guest and AI scope | Phase 5 adds guest check-in/feedback writes and AI governance foundation only; live AI and QR scanning stay blocked until constraints are resolved. |
| 11 | Event-day operations layer | Phase 6 adds scoped PMCM/coordinator live ops, tasks, urgent issues, attendance, supplier verification, and live logs. |
| 12 | Live-ops reliability | Phase 7 adds SLA timers/status, escalation, coordinator replacement, role-safe status feeds, and queued notification hooks; production notification adapters, QR scanning, and live AI remain out of scope. |
| 13 | Security, privacy, and audit readiness | Phase 8 adds hashed sample credentials, consent persistence, PMCM privacy inventory, and audit integrity verification before any live AI, QR scanning, external auth, production notification adapter, or real file storage work. |
| 14 | Privacy operations and audit hardening | Phase 9 adds PMCM privacy request handling, retention policy reads, soft redaction, and auth operations extraction; live AI, QR scanning, external auth, production notification adapters, and real file storage remain out of scope. |

## How To Revise Safely

### API

1. Keep route compatibility while extracting services from `EventOpsService`.
2. Move one workflow at a time into focused services: inquiry, onboarding, billing, floorplan, closure, notifications.
3. Add tests before and after extraction for the workflow being moved.
4. Prefer scoped endpoints for new work instead of expanding `/api/sample/state`.
5. Write audit and notification side effects explicitly in the owning service.

### PMCM Event App

1. Keep PMCM-only operations in `apps/event`.
2. Split large page sections into `src/app/components/pmcm/*` before adding new panels.
3. Keep official floorplan edit, supplier selection, billing, coordinator assignment, audit, and archive actions in this app.
4. Do not expose PMCM internal CE, supplier notes, private reviews, or audit logs to client/supplier/guest portals.

### Client Portal

1. Keep public pages limited to landing and inquiry.
2. Keep dashboards signed in and conforme-gated.
3. Treat client floorplan input as preference drafts only.
4. Show official layouts read-only with approve/revision actions.
5. Split the dashboard by workflow before adding more client features.

### Supplier Portal

1. Scope every read to the logged-in supplier or quote token.
2. Start with quote submission and assignment confirmation before readiness and event-day status.
3. Do not show PMCM internal ratings, private supplier reviews, or other suppliers' quotes.

### Guest Portal

1. Keep access-code flow lightweight.
2. Build name-based check-in before QR scanning.
3. Store post-event feedback in moderation state; never auto-publish guest uploads.

## Verification Checklist

Use these checks before marking a revision slice complete:

| Area | Minimum verification |
| --- | --- |
| API behavior | Run focused `apps/api` tests for the touched service, then `npm --workspace prism-api run test:event-ops` when available. |
| API build/type safety | Run `npm --workspace prism-api run typecheck`, `npm --workspace prism-api run build`, and `npm --workspace prism-api run prisma:validate` for backend/schema changes. |
| PMCM frontend | Run `npm --workspace @prism/event run build` after PMCM UI changes. |
| Client portal | Run `npm --workspace @prism/client run build` after client dashboard or public inquiry changes. |
| Supplier portal | Run `npm --workspace @prism/supplier run build` after supplier workflow changes. |
| Guest portal | Run `npm --workspace @prism/guest run build` after guest workflow changes. |
| Scope regression | Confirm public pages still cannot jump directly into dashboards and client users still cannot edit official floorplans. |
| Docs | Update this file and `04-implementation-plan.md` whenever a revision changes what is already live or what is still needed. |

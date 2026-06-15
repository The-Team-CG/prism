# P.R.I.S.M Redesign Agile Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the completed redesign readiness foundation into an actionable sprint calendar through July 31, 2026. This includes the whole-app redesign and the partial, planned, or otherwise unfinished feature families from the feature ledger.

**Architecture:** This plan divides the redesign into four numbered sprints: one one-week Sprint 1 alignment sprint and three two-week delivery/stabilization sprints. Maxine owns product UX/design system, Francis owns the PMCM/coordinator event app, Ethan owns external portals, and Anthony owns API/platform/contracts/QA/docs. Work proceeds only when the required contract, owner, feature family, and verification gates are explicit. By July 31, every incomplete feature family must be either finished, accepted as an already-working verified slice, delivered as a thin but usable slice, documented as gated, or intentionally moved to post-July.

**Tech Stack:** Next.js role apps in `apps/client`, `apps/event`, `apps/supplier`, and `apps/guest`; NestJS API in `apps/api`; shared contracts in `packages/types` and `packages/api-client`; shared UI in `packages/ui`; canonical docs in `docs/prism-v4` and `docs/superpowers`.

---

## Calendar

| Sprint | Dates | Working shape | Sprint outcome |
| --- | --- | --- | --- |
| Sprint 1 | June 15-20, 2026 | One-week alignment and completion-cutline sprint | Owners agree on the July 31 system target, existing feature credit, release blockers, scorecard, shell patterns, scoped contracts, and exact Sprint 2-4 work. |
| Sprint 2 | June 22-July 3, 2026 | Two-week foundation delivery sprint | Shared shell/design foundations, Event Command Inbox, and Client Action Center are implemented behind verified boundaries. |
| Sprint 3 | July 6-July 17, 2026 | Two-week workflow completion sprint | PMCM event workspace, supplier readiness, guest pass/check-in, file matrix, floorplan, billing, risk/change, and coordinator gaps reach the July feature-freeze cutline. |
| Sprint 4 | July 20-July 31, 2026 | Two-week stabilization and release-readiness sprint | Core redesigned surfaces are integrated, QA'd, documented, screenshotted, scored against the 90% target, and ready for defense/demo review. |

## July Completion Strategy

The July 31 target is not a prototype MVP. It is a 90% finished internal operating system target. The practical definition is: the core event lifecycle works end to end, the already-built feature slices are verified and polished, the must-finish gaps are closed, and every gated production dependency is explicit rather than hidden.

### 90% System Completion Scorecard

| Area | Weight | July 31 target | Counts as complete only when |
| --- | ---: | --- | --- |
| Core lifecycle | 30% | Inquiry -> conforme -> briefing/proposal -> planning -> event day -> closure/archive evidence works as one traceable flow. | The flow can be shown through PMCM and relevant portals without role leakage or manual state edits outside approved sample/reset paths. |
| PMCM command app | 20% | PMCM can operate active events from command inbox and selected event workspace instead of scattered dashboard panels. | Command actions, selected-event state, supplier/floorplan/guest/live-ops/billing/closure cues, and loading/error states are verified. |
| External portals | 15% | Client, supplier, and guest users can complete their own work safely. | Client cannot edit official floorplans, supplier sees only assigned/application-scoped data, guest access is event-code scoped, and public pages do not jump to dashboards. |
| Platform trust | 15% | Permissions, audit, lifecycle, file requirements, notification queue, privacy, and session conventions hold. | Boundary checks pass, shared contracts are used, audit/privacy evidence exists, and gated production dependencies are named. |
| Feature coverage | 10% | Every catalog family is finished, thin-sliced, accepted as existing, gated, or post-July. | `docs/prism-v4/11-feature-ledger.md` and this plan agree on status, owner, gate, and verification. |
| QA/docs/evidence | 10% | Route checks, screenshots, docs, and verification commands are current. | Sprint closeout notes list commands, pass/fail status, screenshots, and remaining gates. |

### July Treatment Labels

Every feature family and sprint task must use one of these labels before Sprint 2 starts:

| Label | Meaning | July handling |
| --- | --- | --- |
| Accept as existing | The feature has enough current UI/API behavior to count toward July if verified and polished. | Verify, polish, document evidence, and avoid rebuilding. |
| Finish | The feature is required for the end-to-end system and is not complete enough today. | Implement in Sprint 2 or Sprint 3 before feature freeze. |
| Thin slice | The full catalog behavior is too large, but a usable July slice is required. | Build the smallest real slice with clear post-July remainder. |
| Gate | The feature depends on production auth, real storage, QR/camera, live AI, provider credentials, or similar external readiness. | Document prerequisite, owner, risk, and safe fallback. |
| Post-July | The feature is valid but does not block the July 31 operating-system target. | Keep in ledger; do not spend July sprint capacity on it. |

### Release Blockers

These block the July 31 system target and override ordinary sprint priorities:

- Any public route can jump into a signed-in dashboard without a valid session.
- Client can mutate PMCM official floorplans.
- Supplier can read another supplier's assignment, private PMCM review, confidential bid data, or client-private data.
- Guest access can read across events or bypass consent/check-in constraints.
- PMCM command actions depend on broad sample state as the normal path instead of scoped contracts.
- Event lifecycle can skip required conforme, planning, closure, or archive gates without an audited override reason.
- File requirements, billing, compliance, or close gates display misleading complete states when required data is missing.
- Audit, notification, privacy, or lifecycle side effects silently fail without visible error or documented gate.
- Local database/runtime blockers prevent authenticated route verification and are not documented with recovery steps.
- Advanced frontend tables, infinite scroll, upload managers, bulk actions, or complex filters ship before the UI-enabling API contracts are finalized.

### Feature Freeze

Sprint 3 ends on July 17, 2026 and is the feature-freeze point. After July 17, Sprint 4 may only accept:

- Release-blocker fixes.
- Verification failures from route/API/typecheck/boundary checks.
- Documentation and screenshot evidence updates.
- Small UX clarity fixes that do not change API/data scope.
- Explicitly approved gate documentation for work that cannot safely finish by July 31.

### UI-Enabling API Contract Gate

The current codebase gives the redesign a useful read-model foundation, but it does not yet give frontend teams unlimited freedom. The shared contracts cover role workspaces, command/action queues, supplier readiness, guest pass, and file requirement display shapes. They do not yet standardize the operational contracts that advanced UI patterns need.

Until this gate passes, frontend implementation must stay inside bounded work queues, dashboard panels, known-small arrays, simple client-side filters, and metadata-style upload flows. Do not build generalized data grids, infinite scroll, complex saved filters, upload managers, retrying multipart flows, or bulk action consoles until the matching contract row below is complete.

| Contract area | Current coverage from code audit | Gap to close | DRI | Support | Sprint target | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Role read models | `PrismPmcmCommandInbox`, `PrismPmcmEventWorkspace`, `PrismClientActionCenter`, `PrismSupplierReadinessBoard`, `PrismFileRequirementsMatrix`, and `PrismGuestEventPass` exist in `packages/types` and `packages/api-client`. | Keep these as the stable baseline and prevent app-local shape drift. | Anthony | Francis, Ethan, Maxine | Sprint 1-2 | Typecheck passes for `@prism/types` and `@prism/api-client`; app surfaces import shared types rather than redefining them. |
| Pagination/result envelopes | Most API client methods return full arrays or single read models; no shared `page`, `limit`, `cursor`, `total`, `nextCursor`, or `hasMore` contract exists. | Define `PrismPageRequest`, `PrismCursorPage<T>`, and list metadata rules before advanced tables or infinite scroll. | Anthony | Francis, Ethan | Sprint 2 | Shared types and API-client signatures exist; at least one list endpoint test proves pagination metadata behavior or the feature remains bounded. |
| Filtering and sorting | Audit logs have local `query`, `category`, `eventId`, `actor`, `severity`, `dateRange`, and `limit`; there is no cross-resource filter/sort standard. | Define shared query/filter/sort contracts for command inbox, event lists, supplier readiness, file requirements, billing, audit/privacy, and closure views. | Anthony | Maxine, Francis, Ethan | Sprint 2-3 | Filter/sort types are in `packages/types`; UX labels and empty states are documented; app code does not invent incompatible filter payloads. |
| Upload sessions and file rules | DTOs accept `fileName`, `mimeType`, and `sizeBytes`; `document-vault.service.ts` validates size/type metadata. | Define accepted file matrix, per-requirement rules, upload intent/session shape, signed URL or multipart strategy, progress/retry states, and upload error semantics. | Anthony | Ethan, Francis | Sprint 3 gate | If real storage is not approved, the plan explicitly ships metadata-only upload UX and names the storage adapter as gated/post-July. |
| Normalized errors and empty states | `PrismApiError` carries `status` and `body`; no normalized app error code, field error, retryability, user message, or empty-state reason contract exists. | Define `PrismApiProblem`, `PrismFieldError`, `PrismEmptyReason`, and retry/permission/error display rules. | Anthony | Maxine | Sprint 2 | API client exposes normalized error helpers; Maxine's state-language checklist maps each error/empty reason to copy. |
| Bulk and action responses | Mutation results are not standardized across command actions, reminders, uploads, check-in, or feedback flows. | Define `PrismActionResult`, partial-success behavior, audit reference, notification reference, and safe retry semantics. | Anthony | Francis, Ethan | Sprint 3 | PMCM, client, supplier, and guest action surfaces can show success, partial success, denied, retryable failure, and audited override outcomes consistently. |

## Owner Map

| Owner label | Person | System goal | Primary scope |
| --- | --- | --- | --- |
| Owner A | Maxine | Make P.R.I.S.M feel like one coherent PMCM operating system across every role surface. | Product UX, design system, route IA, visual QA, copy, responsive behavior. |
| Owner B | Francis | Make PMCM and coordinator work operable from inquiry intake through event-day command and closure. | `apps/event`, PMCM command app, coordinator role views, event workspace, live operations. |
| Owner C | Ethan | Make every external portal a narrow, safe action surface instead of a dashboard clone. | `apps/client`, `apps/supplier`, `apps/guest`, public inquiry, supplier application, guest access. |
| Owner D | Anthony | Make the platform enforce trust: correct data, permissions, audit, files, notifications, lifecycle, and verification. | `apps/api`, Prisma, `packages/types`, `packages/api-client`, boundary checks, tests, docs. |

## Operating Rules

- Start each sprint with a one-hour planning review using this document, `docs/prism-v4/14-redesign-readiness-foundation.md`, and `docs/prism-v4/12-redesign-inventory.md`.
- Use `docs/prism-v4/11-feature-ledger.md` as the source of truth for incomplete feature families. Do not treat the redesign as complete if a partial/planned feature is neither implemented, gated, nor explicitly deferred.
- Keep one branch per owner per sprint when work can run independently: `codex/sprint-N-maxine`, `codex/sprint-N-francis`, `codex/sprint-N-ethan`, and `codex/sprint-N-anthony`.
- Merge order is Anthony contracts/guards first, then Maxine shell/design rules, then Francis and Ethan app surfaces, then Anthony final verification/docs.
- Do not add new broad sample-state reads, app-local literal `prism:*` keys, cross-role app imports, or PMCM-only data in external portals.
- Demo only work that passes the stated verification commands. Screens that cannot run because the local database is misconfigured must show the explicit API service-unavailable message and list the database fix as a blocker.
- AI, QR scanning, production notification adapters, external auth, and real file storage stay gated unless this plan explicitly moves them into a spike.
- Every executable task has exactly one DRI. Feature-family rows may list support or affected owners, but sprint tasks, backlog items, and closeout decisions must name one person who owns completion evidence.
- Frontend branches must wait for Anthony-owned shared contract changes before depending on new response fields, filters, sort options, pagination metadata, upload states, normalized errors, or action-result payloads.

## Single-Owner Task Backlog

This backlog turns the sprint plan into executable tasks. Each row has one DRI, named support, a concrete feature target, and evidence required for completion.

| Task ID | Sprint | Task | DRI | Support | Feature families | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Sprint 1 | Assign July treatment labels to every feature family and record disputed items in the ledger. | Maxine | Francis, Ethan, Anthony | FL-001 to FL-028 | Every row has accept/finish/thin-slice/gate/post-July treatment and no disputed item is ownerless. |
| T02 | Sprint 1 | Finalize the UI-enabling API contract audit and cutline. | Anthony | Maxine, Francis, Ethan | FL-003, FL-004, FL-006, FL-007, FL-010, FL-012, FL-014, FL-015, FL-024 | Contract gate table is updated with current coverage, missing contracts, sprint target, and explicit frontend restrictions. |
| T03 | Sprint 1 | Choose the first PMCM demo path and identify coupled areas to avoid in Sprint 2. | Francis | Maxine, Anthony | FL-001, FL-002, FL-003, FL-017 | PMCM demo path names route, read model, actions, gates, and verification commands. |
| T04 | Sprint 1 | Choose the first portal demo path and portal surfaces for Sprint 3. | Ethan | Maxine, Anthony | FL-004, FL-020, FL-022, FL-012 | Portal demo path names client, supplier, and guest route targets with role-boundary notes. |
| T05 | Sprint 2 | Define normalized error, empty-state, pagination, and filter/sort contracts before advanced frontend patterns. | Anthony | Maxine, Francis, Ethan | FL-003, FL-004, FL-006, FL-007, FL-010, FL-015, FL-024 | Shared types/API-client changes or documented gates exist; typecheck and focused API-client tests pass. |
| T06 | Sprint 2 | Deliver shared shell/state-language rules through the first PMCM and client surfaces. | Maxine | Francis, Ethan | FL-016, FL-017, FL-020 | UX brief is updated; banned visual patterns are checked; PMCM/client surfaces use the agreed hierarchy. |
| T07 | Sprint 2 | Ship the PMCM Event Command Inbox and selected-event summary slice. | Francis | Anthony, Maxine | FL-001, FL-002, FL-003, FL-017 | `/dashboard`, `/dashboard/events`, and one selected event workspace route render; PMCM-only actions remain scoped. |
| T08 | Sprint 2 | Ship the Client Action Center thin slice. | Ethan | Anthony, Maxine | FL-004, FL-020 | Public/signed-in boundary holds; client next actions use `PrismClientActionCenter`; official floorplans remain read-only. |
| T09 | Sprint 2 | Establish the File Requirements Matrix contract decision. | Anthony | Francis, Ethan | FL-006, FL-024 | Matrix types and endpoint behavior are verified, or real storage/upload manager work is explicitly gated. |
| T10 | Sprint 3 | Deliver PMCM selected-event depth for supplier, risk/change, floorplan, billing, or closure based on ready contracts. | Francis | Anthony, Maxine | FL-007, FL-009, FL-010, FL-011, FL-013, FL-025 | One selected-event area is extracted or deepened; scoped data is used; PMCM-only controls stay in `apps/event`. |
| T11 | Sprint 3 | Deliver supplier readiness portal and supplier status scope. | Ethan | Anthony, Francis, Maxine | FL-007, FL-022 | Supplier sees only assigned/application-scoped records; readiness states and event-day status are mobile-safe. |
| T12 | Sprint 3 | Deliver guest access, consent, check-in, and moderated feedback slice without QR/camera scanning. | Ethan | Anthony, Maxine | FL-012 | `/open` and guest dashboard flows are event-code scoped; QR/camera scanning remains gated. |
| T13 | Sprint 3 | Close upload-session, bulk-action, and action-result contract gaps or mark them as gated. | Anthony | Francis, Ethan | FL-006, FL-014, FL-024 | `PrismActionResult`/upload-session contract exists or the metadata-only file flow and storage gate are documented. |
| T14 | Sprint 4 | Run route-by-route QA and verification evidence capture. | Anthony | Francis, Ethan, Maxine | FL-001 to FL-027 | Typecheck/boundary/API/browser evidence is recorded; database blockers have exact recovery notes. |
| T15 | Sprint 4 | Complete final design QA and demo story. | Maxine | Francis, Ethan | FL-016 plus demo-path families | Demo follows inquiry -> PMCM command -> client action -> supplier readiness -> guest check-in -> closure evidence. |
| T16 | Sprint 4 | Close PMCM release blockers and PMCM demo notes. | Francis | Anthony, Maxine | FL-003, FL-007, FL-008, FL-009, FL-011, FL-013, FL-017, FL-021, FL-026 | PMCM bugs are closed or gated; PMCM notes cite route, feature family, and verification evidence. |
| T17 | Sprint 4 | Close external portal release blockers and portal demo notes. | Ethan | Anthony, Maxine | FL-004, FL-007, FL-012, FL-013, FL-014, FL-020, FL-022 | Client, supplier, and guest bugs are closed or gated; portal notes cite route, role boundary, and verification evidence. |
| T18 | Sprint 4 | Finalize feature-ledger and July 31 scorecard closeout. | Anthony | Maxine, Francis, Ethan | FL-001 to FL-028 | Ledger, sprint plan, scorecard, screenshots, and verification notes agree on delivered/gated/post-July status. |

## Incomplete Feature Backlog Coverage

This table is the sprint-level cutline for all ledger items that are live/partial, partial, planned, or newly proposed. It keeps the July 31 scope honest: not every item must become fully production-complete by July 31, but every item must have a real owner decision and an implementation or gate.

| Feature family | Current state | Feature DRI | Sprint target | July 31 outcome |
| --- | --- | --- | --- | --- |
| FL-001 Inquiry intake and triage | Live/partial | Francis | Sprint 1-2 | Public inquiry remains live; PMCM log-on-behalf, referral filtering, and triage state are either implemented as a thin slice or documented as the first post-July PMCM intake task. Support: Ethan, Anthony. |
| FL-002 Onboarding and conforme gate | Live/partial | Anthony | Sprint 1-2 | Accepted inquiry -> signed conforme -> portal access remains the enforced lifecycle gate; per-event reminder policy and visible awaiting/sent/opened/expired states are scoped. Support: Francis, Ethan. |
| FL-003 PMCM command dashboard | Partial | Francis | Sprint 2 | Event Command Inbox and selected-event summary become the first redesigned PMCM operating surface, with remaining finance/files/closure/live-ops sections split into later slices. Support: Maxine, Anthony. |
| FL-004 Client portal after conforme | Partial | Ethan | Sprint 2-3 | Client Action Center is the primary portal slice; remaining broad state usage for briefings, activity, floorplan drafts, documents, and billing is reduced or logged as compatibility-only. Support: Maxine, Anthony. |
| FL-005 Proposal, briefing, and commercial workflow | Partial | Francis | Sprint 3-4 | Briefing/proposal status is visible in PMCM and client-safe views; deep commercial generation and full CE/proposal source-of-truth work can continue post-July if contracts are not ready. Support: Ethan, Anthony. |
| FL-006 Document and file operations | Partial | Anthony | Sprint 2-4 | File Requirements Matrix is represented in PMCM/client UX and typed contracts; real upload storage remains gated unless Anthony confirms adapter/storage readiness. Support: Francis, Ethan, Maxine. |
| FL-007 Supplier network operations | Live/partial | Ethan | Sprint 3 | Supplier readiness board covers quote requests, assignments, readiness, contract metadata, and event-day status; supplier application/status tracking is scoped as MVP or post-July. Support: Francis, Anthony. |
| FL-008 Coordinator and staffing operations | Partial | Francis | Sprint 3 | Coordinator roster, availability/staffing gaps, assignment acknowledgement, and role-safe task payloads are represented in PMCM live-ops or explicitly deferred with tests/contract gaps listed. Support: Anthony. |
| FL-009 Compliance, risk, and change control | Live/partial | Francis | Sprint 3-4 | Risk/change register and compliance condition visibility are present in PMCM; richer condition evaluation and seven-day recheck may remain post-July with a named gate. Support: Anthony. |
| FL-010 Billing and payments | Partial | Anthony | Sprint 3-4 | Client-safe billing/payment milestone visibility and PMCM dispute/correction/additional billing states are scoped; full configurable payment terms can remain post-July if data model work is too large. Support: Francis, Ethan. |
| FL-011 Floorplan and spatial workflow | Live/partial | Francis | Sprint 3 | Official floorplan control remains PMCM-only; client preference/comment flow stays read-only against official layouts; table assignment eligibility rules are scoped. Support: Ethan, Anthony. |
| FL-012 Guest and lightweight access | Partial | Ethan | Sprint 3 | Guest access-code entry, consent, check-in state, and moderated feedback are improved; QR/camera scanning stays gated unless HTTPS/masterlist readiness is confirmed. Support: Anthony. |
| FL-013 Closure, archive, and learning loop | Partial | Francis | Sprint 4 | Closure/readiness evidence appears in the demo path; testimonial request and archive search get a scoped slice, while rich event comparison can remain post-July. Support: Ethan, Anthony. |
| FL-014 Notifications and communications | Partial | Anthony | Sprint 4 | Notification queue/outbox state is visible where useful; production SendGrid/Viber adapters remain gated behind environment, retry, audit, and privacy readiness. Support: Ethan. |
| FL-015 Security, privacy, and audit | Partial | Anthony | Sprint 4 | Privacy/audit cues, retention/legal-hold decisions, and redaction gaps are documented; external auth and full privacy operations console remain gated unless separately approved. |
| FL-016 Shared design system and shell | Partial | Maxine | Sprint 2 | Shared shell/page patterns, presentation-only component candidates, state language, and banned-pattern checks are applied to the first PMCM and portal surfaces. Support: Francis, Ethan. |
| FL-017 Event Command Inbox | Planned/add | Francis | Sprint 2 | Delivered as the first PMCM command-surface slice. Support: Maxine, Anthony. |
| FL-018 Event Health Score | Planned/add | Francis | Sprint 4 | Implement only as an explainable readiness/status summary if source signals already exist; otherwise document as post-July. Support: Maxine, Anthony. |
| FL-019 Decision Log | Planned/add | Anthony | Sprint 4 | Add a scoped PMCM decision/audit surface if backed by existing audit records; otherwise keep as post-July audit UX. Support: Francis. |
| FL-020 Client Action Center | Planned/add | Ethan | Sprint 2 | Delivered as the first client portal redesign slice. Support: Maxine, Anthony. |
| FL-021 PMCM Handoff Brief | Planned/add | Francis | Sprint 3-4 | Produce a selected-event handoff/readiness summary if contracts already expose enough data; otherwise document contract gaps. Support: Anthony. |
| FL-022 Supplier Readiness Board | Planned/add | Ethan | Sprint 3 | Delivered as the supplier portal/PMCM supplier readiness slice. Support: Maxine, Francis, Anthony. |
| FL-023 Coordinator Staffing Heatmap | Planned/add | Francis | Sprint 3-4 | Implement only if assignment/availability data is ready; otherwise ship roster/availability gap list as the July slice. Support: Maxine, Anthony. |
| FL-024 File Requirements Matrix | Planned/add | Anthony | Sprint 2-4 | Establish typed matrix/status model and show it in PMCM/client surfaces; full storage adapter work remains gated. Support: Francis, Ethan. |
| FL-025 Risk and Change Register | Planned/add | Francis | Sprint 3-4 | Deliver a PMCM-scoped register slice for active risks, changes, overrides, and audit references. Support: Anthony. |
| FL-026 Event Day Run Sheet | Planned/add | Francis | Sprint 4 | Deliver a demo-ready event-day run sheet only if live-ops data is stable; otherwise document it as the first post-July live-ops slice. Support: Anthony. |
| FL-027 Privacy Operations Console | Planned/add | Anthony | Sprint 4 | Document privacy operations states and minimal audit/retention visibility; full console is post-July unless security scope is approved. |
| FL-028 Workflow Template Builder | Planned/add | Maxine | Post-July | Keep out of July implementation. Capture template-builder requirements during Sprint 3 only if they fall out of real workflow stabilization. Support: Francis, Anthony. |

## Feature Coverage Audit Result

This plan was checked against `docs/prism-v4/01-complete-feature-catalog.md`, `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/11-feature-ledger.md`, the current route/API inventory, and the shared contracts in `packages/types` and `packages/api-client`.

Audit result as of June 15, 2026:

- Catalog IDs checked from `01-complete-feature-catalog.md`: 138.
- Catalog IDs explicitly represented in `11-feature-ledger.md` after this audit: 138.
- Catalog IDs missing from the ledger after this audit: 0.
- Feature families tracked by this sprint calendar: FL-001 through FL-028.
- Current implementation has meaningful working slices for inquiry, onboarding/conforme, PMCM dashboard/workspace, client action center, supplier readiness, guest pass/check-in/feedback, floorplan submit/approve, billing source/statements, compliance checks, notification outbox, audit/privacy, file matrix contracts, and AI governance records.
- Current implementation does not fully fill the catalog for production adapters, external auth/2FA/password reset, real file storage, QR/camera scanning, full venue scouting/styling workflow, full supplier application/status workflow, full coordinator heatmap/run sheet, full archive comparison/testimonials/logistics, workflow template builder, or live AI features.

### Fill Status Meaning

| Status | Meaning |
| --- | --- |
| Filled for July demo | The current product or planned July slice can demonstrate the core workflow with scoped API/UI behavior and verification. |
| Partially filled | A model, route, contract, or UI exists, but important catalog behavior is incomplete. |
| Gated | The feature should not ship until a prerequisite is true, such as ZDR, HTTPS/camera readiness, storage adapter readiness, notification adapter credentials, or external auth approval. |
| Post-July | The feature is valid but should not consume July sprint capacity unless a required July demo path breaks without it. |

## Detailed Feature Fill Audit

| Feature family | Catalog coverage | Current implementation evidence | Does current Prism fill it? | Remaining gap to track | July 31 decision |
| --- | --- | --- | --- | --- | --- |
| FL-001 Inquiry intake and triage | FR-01, FR-44, FR-45, FR-46, FR-47, FR-48, FR-50, FR-51, FR-52, FR-53, FR-54, FR-AI-01 | `apps/client/src/app/components/public-inquiry/PublicInquiryPage.tsx`; `apps/api/libs/modules/event-ops/src/controllers/inquiries.controller.ts`; `apps/api/libs/modules/event-ops/src/services/inquiry-workflow.service.ts`; `PrismInquiry` duplicate/rejection/referral fields; `apps/event/src/lib/prism-api.ts` log-on-behalf and reminder calls. | Partially filled. Public inquiry, PMCM status decisions, duplicate/rejection metadata, referral/client-type fields, log-on-behalf API, conforme reminder/upload paths, and inquiry-scoped contracts exist. | Visible PMCM log-on-behalf UI, organization merge UI, richer referral filtering, abandoned draft save/edit window, pre-conforme notes/documents, and AI triage output are not complete. AI remains gated by ZDR/governance. | Sprint 1 confirms treatment; Sprint 2 must show inquiry/action queue status in PMCM command. Sprint 3 can add visible log-on-behalf/referral filtering if route scope allows. AI triage is gated/post-July. |
| FL-002 Onboarding and conforme gate | FR-02, FR-03, FR-26, FR-67, FR-68 | `OpsOnboardingController`; `client-onboarding-workflow.service.ts`; `packages/types/src/lifecycle.ts`; `PrismClientActionCenter`; client dashboard gating; conforme reminder/upload API. | Partially filled. Accepted inquiry plus signed conforme is the product gate, and dashboard unlock status is represented. | Document template prefill, dual signing path, per-event reminder policy, and complete invitation state UI need deeper workflow treatment. | Sprint 1 confirms treatment. Sprint 2 must preserve the gate and expose next actions in client action center. Template prefill and full dual-signing workflow are post-July unless needed for demo. |
| FL-003 PMCM command dashboard | FR-04, FR-05, FR-12, FR-24 | `PrismPmcmCommandInbox`; `/api/pmcm/command-inbox`; `PrismPmcmEventWorkspace`; `/api/pmcm/events/:eventId/workspace`; `apps/event/src/app/dashboard/EventDashboardClient.tsx`; extracted dashboard hooks/components. | Partially filled. The command inbox and selected-event workspace contracts exist, and the event app has many extracted surfaces. | EOD report inbox, per-event module toggle system, unified command queue UX, health scoring, and route-by-route decomposition remain incomplete. | Sprint 2 must deliver the PMCM command inbox as the first redesigned operating surface. |
| FL-004 Client portal after conforme | FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-65, FR-66, New-CL1, New-CL2 | `PrismClientActionCenter`; `/api/client/action-center`; `apps/client/src/app/dashboard/page.tsx`; client event section routes; floorplan preference and snapshot APIs; file-requirements route. | Partially filled. Client dashboard, event status, file visibility, billing/doc surfaces, action cards, layout preference, and official read-only floorplan behavior exist. | Moodboard viewing/approval, styling budget confirmation, client-owned supplier sub-ticket, ocular task trigger, walk-in policy configuration, event-day limited view, and full removal of derived/fallback action cards remain incomplete. | Sprint 2 delivers the client action center slice. Sprint 3 can deepen file/billing/floorplan summaries. Styling, ocular trigger, and event-day limited view are scoped only if contract-ready. |
| FL-005 Proposal, briefing, and commercial workflow | FR-09, FR-10, FR-11, FR-19, FR-43, FR-58, FR-59, FR-60, FR-61, FR-62, FR-AI-03, FR-AI-09 | `commercial-workflow.service.ts`; briefing endpoint; billing source and statement APIs; PMCM briefing/billing panels; AI governance foundation. | Partially filled. Briefing capture, approved billing source records, billing generation, and proposal-adjacent data exist. | Bid workspace, full CE builder UX, venue scouting, moodboard/styling approval, budget confirmation, Canva/PowerPoint export, Zoom scheduling, tiered package options, AI proposal drafting, and AI communication drafting are incomplete or gated. | Sprint 3-4 can show proposal/briefing status and client-safe commercial state. Adapters and AI are gated/post-July. |
| FL-006 Document and file operations | FR-04, FR-32, FR-33, FR-54, FR-67, FR-70, New-SEC3 | `PrismFileRequirementsMatrix`; `/api/events/:eventId/file-requirements`; `file-requirements-matrix.service.ts`; `document-vault.service.ts`; PMCM/client file routes. | Partially filled. File matrix DTOs and event-scoped requirement reads exist, with upload metadata validation foundations. | Real storage provider, signed URLs, complete role-filtered file UI, accreditation SLA depth, template-generated document records, and full MIME/size/storage enforcement are incomplete. | Sprint 2 establishes file-matrix action visibility. Sprint 4 documents storage gate unless Anthony approves real storage scope. |
| FL-007 Supplier network operations | FR-14, FR-15, FR-16, FR-17, FR-18, FR-35, FR-36, FR-37, FR-38, FR-49, FR-63, FR-64, FR-75, FR-76, FR-77, FR-78, FR-79, FR-87, New-EX1, New-S1, New-S2, New-S3, New-S4, New-S5, New-SUP1, New-SUP2, New-SUP3, New-SUP4, FR-AI-04b, FR-AI-06 | Supplier controllers; `supplier-network-workflow.service.ts`; `PrismSupplierReadinessBoard`; `/api/supplier/readiness-board`; supplier dashboard; PMCM supplier directory/quote planner; PARE approval records. | Partially filled. Supplier directory, quote requests, quote submission/revision, assignment confirmation, readiness, contract metadata, event-day status, PMCM private review/tier data, supplier board contract, and PARE approval foundation exist. | Public supplier application/status, PMCM supplier applications inbox, pending-first-event promotion workflow, performance assessment loop, ingress/egress schedule depth, outsourced creative sub-ticket, production notifications, real upload storage, and probabilistic reliability scoring are incomplete or gated. | Sprint 3 must deliver supplier readiness board depth. Supplier application/status can be MVP or post-July. AI reliability/PARE live behavior stays gated. |
| FL-008 Coordinator and staffing operations | FR-13, FR-88, FR-89, FR-90, FR-91, New-C1, New-C2, New-C3, New-C4, New-CO1, New-CO2, New-CO3, New-CO4, New-CO5, New-CO6, FR-AI-07 | Coordinator controllers; `coordinators.service.ts`; `live-operations.service.ts`; `PrismCoordinatorWorkspace`; `PrismCoordinatorRoleView`; PMCM coordinator pages; live-ops status feed. | Partially filled. Coordinator roster, assignments, acknowledgement, role views, status feed, attendance/update, replacement, urgent issues, and live-ops tasks have foundations. | Availability calendar, skills filtering depth, staffing heatmap, all confirmed role-specific UX, late/no-show profile reliability depth, reassignment approval timing, and real-time event-day copilot are incomplete or gated. | Sprint 3 should ship roster/availability gap list or heatmap only if data is ready. AI copilot is gated/post-July. |
| FL-009 Compliance, risk, and change control | FR-06, FR-07, FR-10+, New-SY3, New-SY4, FR-96, FR-97 | Compliance controller; `compliance-workflow.service.ts`; `event-lifecycle.service.ts`; audit services; urgent issue/escalation routes. | Partially filled. Rule-backed compliance checks, override reasons, lifecycle transition guards, urgent issues, and audit paths exist. | Unified risk/change register, change-freeze enforcement, addendum conforme flow, cancellation workflow, postponement workflow, richer condition evaluation, seven-day recheck, and compliance AI advisory are incomplete or gated. | Sprint 3-4 should deliver a PMCM risk/change slice if contract-ready. AI advisory is gated. Cancellation/postponement impact can be documented if too large. |
| FL-010 Billing and payments | FR-20, FR-21, FR-69, FR-92, FR-93, FR-94, New-P5 | `billing-operations.service.ts`; `commercial-workflow.service.ts`; billing controller; event billing source/payment routes; `PrismBillingSource`, `PrismBillingStatement`, `PrismPaymentMilestone`. | Partially filled. Approved source records, generated billing statements, payment milestones/records, and client-safe billing surfaces exist. | Flexible payment terms, discrepancy disputes, typo correction workflow, post-event additional billing, waiver reason handling, and urgent-issue linkage are incomplete. | Sprint 3-4 can show client-safe milestones and PMCM billing state. Full disputes/waivers/configurable terms are post-July unless essential to demo. |
| FL-011 Floorplan and spatial workflow | FR-08, FR-80, FR-81, FR-82, FR-83, FR-84, FR-28, FR-29 | Floorplan routes in `events.controller.ts`; `floor-plan-workflow.service.ts`; PMCM floorplan tab; client floorplan routes; shared floorplan snapshot/preference types. | Partially filled. PMCM official drafts, submit/approve snapshots, client preference flow, and client read-only official layout boundary exist. | Venue library/presets, table eligibility rules, designated-primary-contact annotation authority, richer client approval/rejection comments, and event-type/guest-count rules need hardening. | Sprint 3 must preserve PMCM-only official control and can add table eligibility scope if ready. |
| FL-012 Guest and lightweight access | FR-39, FR-40, FR-41, FR-42, FR-95, New-GU1, New-EX2 | `PrismGuestEventPass`; `/api/guest/events/:accessCode`; guest open/dashboard pages; `guest-workflow.service.ts`; guest check-in and feedback routes. | Partially filled. Access-code event pass, name-based check-in, walk-in flagging, attendance count, privacy consent, and moderated feedback writes exist. | QR generation/scanning, browser camera flow, full masterlist reconciliation, game builder, ticket-platform coordination, media upload, richer moderation queue, and promotional sample isolation need completion. | Sprint 3 delivers non-QR guest access/check-in/feedback. QR/camera and game builder are gated/post-July. |
| FL-013 Closure, archive, and learning loop | FR-22, FR-23, New-P1, New-P2, New-P3, New-P4, New-SY1, New-SY2, FR-AI-08 | `event-closure.service.ts`; close-gates endpoint; archive endpoint; insights endpoints; lifecycle transition table; close-gate matrix. | Partially filled. Close gates, archive guard, override reason, deterministic insights, post-event document completion, and lifecycle constraints exist. | Archive search/comparison, testimonial library, logistics booking records, full wrap-up reminders, richer feedback, private notes UX, and PEIL AI are incomplete or gated. | Sprint 4 must show closure/readiness evidence. Archive comparison, testimonials library, logistics, and PEIL are post-July unless specifically pulled in. |
| FL-014 Notifications and communications | FR-25, FR-55, FR-64, FR-AI-09, FR-AI-05 | `notification-outbox.service.ts`; notification controller; notification log DTOs; queued hooks in live ops/coordinator replacement/billing; PMCM acknowledgement. | Partially filled. Queue states, retry/failure/acknowledgement, sample processing, and audit correlation foundations exist. | Production SendGrid/Viber adapters, bilingual template management, language preference UI, supplier/client/coordinator message thread delivery, and AI communication assistant/POA are incomplete or gated. | Sprint 4 can expose queue/outbox state. Production adapters and AI assistant behavior are gated/post-July. |
| FL-015 Security, privacy, and audit | New-SEC1, New-SEC2, New-SEC3, New-SEC4, FR-56, FR-AI-ZDR | Auth controller; audit/privacy controller; `auth-security.service.ts`; `privacy-operations.service.ts`; `audit.service.ts`; `DataSanitizerService`; audit integrity tests; shared session helpers. | Partially filled. API-backed sample auth, audit logs/export/integrity, privacy inventory, retention policy reads, privacy request queue/review/execute, soft redaction, consent persistence, AI audit/ZDR confirmation fields, and shared session key helpers exist. | External auth provider, mandatory PMCM 2FA, password reset, account lockout, full privacy notice UX, full data export/anonymization execution, legal hold, document-specific redaction, and formal provider ZDR agreement remain incomplete or gated. | Sprint 4 must document privacy/audit gates and show minimal privacy operations state. External auth and full console are post-July unless separately approved. |
| FL-016 Shared design system and shell | Cross-cutting, old UI modernization Phase 2 plan | `packages/ui`; `packages/types`; `packages/api-client`; role-specific app shells; `scripts/check-prism-boundaries.test.mjs`; route inventory docs. | Partially filled. Shared primitives, shared contracts, session helpers, API client helpers, and boundary checks exist. | Full shared design-system adoption, duplicated UI cleanup across role apps, floorplan editor source-sync/shared package, and consistent state language across all redesigned pages remain incomplete. | Sprint 2 must make shell/page patterns real in PMCM command and client action center. |
| FL-017 Event Command Inbox | New candidate | `PrismPmcmCommandInbox`; `/api/pmcm/command-inbox`; event shell command actions. | Partially filled. Contract and API exist; the surface needs final UX prioritization and command-work decomposition. | Health score enrichment, richer source grouping, owner/action assignment, and route-owned command handlers need completion. | Sprint 2 working slice. |
| FL-018 Event Health Score | New candidate | `PrismDefenseReadiness`; readiness metrics in `PrismEvent`; live-ops/readiness hooks. | Partially filled. Deterministic readiness inputs exist, but there is no complete health-score product surface. | Weighting, explanation, signal source mapping, and false-confidence guardrails need definition. | Sprint 4 only if explainable from existing signals; otherwise post-July. |
| FL-019 Decision Log | New candidate | Audit logs, lifecycle transitions, compliance overrides, approval records. | Partially filled. Decision evidence exists in audit-like records, but there is no dedicated decision-log UX/model. | Scope-change, override, approval, cancellation/postponement, and management-reason records need a unified PMCM view. | Sprint 4 if backed by existing audit records; otherwise post-July. |
| FL-020 Client Action Center | New candidate | `PrismClientActionCenter`; `/api/client/action-center`; client dashboard action cards. | Partially filled. Read model and dashboard usage exist. | Coverage for all action types, file-matrix actions, approval/comment actions, closeout/testimonial actions, and removal of fallback derivation remain incomplete. | Sprint 2 working slice. |
| FL-021 PMCM Handoff Brief | New candidate | `PrismPmcmEventWorkspace`; coordinator role view; live-ops status feed; readiness data. | Planned/partially filled. Required source data exists in pieces, but no formal handoff brief exists. | A concise PMCM-to-coordinator handoff model and screen need to be created. | Sprint 3-4 only if source data is stable; otherwise post-July contract gap. |
| FL-022 Supplier Readiness Board | New candidate | `PrismSupplierReadinessBoard`; `/api/supplier/readiness-board`; supplier dashboard. | Partially filled. Supplier-scoped board exists and is visible in the supplier portal. | PMCM-side readiness parity, application/status integration, ingress/egress readiness, and contract/file depth remain incomplete. | Sprint 3 working slice. |
| FL-023 Coordinator Staffing Heatmap | New candidate | Coordinator assignments, role requirements, live-ops status, coordinator workspace. | Planned/partially filled. Data foundations exist, but no heatmap exists. | Availability windows, role/skill counts, double-booking display, replacement options, and staffing-gap visualization need completion. | Sprint 3-4 only if data is ready; otherwise ship gap list and defer heatmap. |
| FL-024 File Requirements Matrix | New candidate | `PrismFileRequirementsMatrix`; file requirements endpoint; close-gate matrix integration; API-client route. | Partially filled. The typed matrix and event-scoped read path exist. | UI coverage across PMCM/client/supplier, real upload storage, signed URLs, and validation enforcement need completion. | Sprint 2-4 working contract/surface slice; storage gated. |
| FL-025 Risk and Change Register | New candidate | Compliance checks, urgent issues, lifecycle transitions, audit logs. | Planned/partially filled. Source records exist in separate workflows, but no unified register exists. | Risk entry, owner, severity, mitigation, change-freeze/addendum linkage, and decision-log linkage need one PMCM surface. | Sprint 3-4 if contract-ready; otherwise post-July with exact source gaps. |
| FL-026 Event Day Run Sheet | New candidate | Live-ops tasks, supplier status, coordinator attendance, event-day log, urgent issues. | Planned/partially filled. Live-ops data exists, but no time-ordered run sheet exists. | Timeline model, operational grouping, print/export mode, coordinator role filtering, and live update behavior need definition. | Sprint 4 only if live-ops data is stable; otherwise post-July. |
| FL-027 Privacy Operations Console | New candidate | Privacy inventory, retention policies, privacy requests, audit integrity, auth operations. | Partially filled. API operations exist, and PMCM audit/privacy surfaces have foundations. | Full PMCM console UX, legal hold, document-specific redaction, export/anonymization completion, and external auth integration remain incomplete. | Sprint 4 minimal state/gate documentation; full console post-July. |
| FL-028 Workflow Template Builder | New candidate | `apps/api/libs/modules/templates`; plans/templates modules; feature-ledger requirements. | Planned/partially filled. Generic template modules exist, but no PMCM workflow template builder is implemented. | Reusable templates for documents, suppliers, coordinators, checks, event types, and workflow gates need a dedicated model and PMCM UI. | Post-July. Capture requirements only during Sprint 4 if stabilization exposes repeated workflow patterns. |

## Catalog Gaps That Must Not Be Hidden

These are the feature areas most likely to be accidentally lost because they were previously implicit, grouped by range syntax, or buried inside broader workflows:

- Venue styling and venue scouting: FR-09, FR-10, FR-11.
- Bid workspace and organization merge: FR-43, FR-44.
- Guest promotional sample: FR-42.
- Supplier ingress/egress and outsourced creative sub-ticket: FR-78, FR-87.
- Cancellation and postponement workflows: FR-96, FR-97.
- AI assistant/reliability/copilot rows: FR-AI-05, FR-AI-06, FR-AI-07.
- Explicit coordinator role views: New-C2, New-C3, New-CO2, New-CO3, New-CO4, New-CO5.
- Supplier application inbox/status/performance/readiness rows: New-EX1, New-S2, New-S3, New-S4, New-SUP2, New-SUP3.
- Privacy notice/export/anonymization row: New-SEC2.

Sprint owners must either implement the relevant July slice, mark the feature as gated with a prerequisite, or move it into the post-July backlog with the exact owner and verification expectation.

## July 31 Must-Land Cutline

- [ ] One coherent demo path works through public inquiry, PMCM command, client action center, supplier readiness, guest access/check-in, and closure/readiness evidence.
- [ ] FL-003, FL-004, FL-016, FL-017, FL-020, and FL-022 have working redesigned slices, not just documentation.
- [ ] FL-001, FL-002, FL-006, FL-007, FL-011, FL-012, FL-013, FL-014, and FL-015 have either working MVP slices or explicit gates in the feature ledger.
- [ ] FL-005, FL-008, FL-009, FL-010, FL-018, FL-019, FL-021, FL-023, FL-024, FL-025, FL-026, and FL-027 have scoped July slices only when the underlying contracts are ready; otherwise they must be documented as named post-July work.
- [ ] FL-028 stays post-July unless all owners agree it is only being documented, not built.
- [ ] Gated capabilities stay gated unless their prerequisites are met: live AI, QR/camera scanning, production notification adapters, external auth, real file storage, full archive comparison, and workflow template building.

## Sprint 1: June 15-20, 2026

### Sprint Goal

Turn readiness into execution inputs: named owner responsibilities, exact sprint surfaces, agreed shell patterns, API contract gaps, release blockers, scorecard targets, and demo criteria. No broad visual redesign starts until each owner has a thin, reviewable target and every feature family has a July treatment label.

### Owner Tasks

#### Maxine: Product UX and Shell Direction

- [ ] Review `docs/prism-v4/12-redesign-inventory.md` and pick the first redesigned surface template for each app: PMCM command, client action center, supplier readiness, and guest access.
- [ ] Review every row in the Incomplete Feature Backlog Coverage table and mark each July 31 outcome as "working slice", "documented gate", or "post-July".
- [ ] Confirm every sprint task has one DRI and that support owners are not treated as shared accountability.
- [ ] Draft a one-page shell pattern note in `docs/prism-v4/12-redesign-inventory.md` covering page hierarchy, navigation behavior, status language, loading/empty/error states, and banned visual patterns.
- [ ] Define the shared component candidates for Sprint 2: app header, section header, work queue row, status timeline, metric tile, notice banner, empty state, and command/action panel.
- [ ] Produce a review checklist for redesigned pages: primary job, next action, role boundary, lifecycle status, mobile fit, no nested cards, no decorative eyebrow pills, no active underline nav.

#### Francis: PMCM Event App Slice Definition

- [ ] Review `apps/event/src/app/dashboard/EventDashboardClient.tsx` and extracted modules under `apps/event/src/app/components/pmcm` and `apps/event/src/features/event-dashboard`.
- [ ] Choose the Sprint 2 PMCM surface: Event Command Inbox plus selected-event summary.
- [ ] Identify which unfinished PMCM features must appear in the July demo path: inquiry triage, PMCM command, supplier readiness, coordinator/live-ops, billing, risk/change, floorplan, closure, and audit/privacy cues.
- [ ] List the event app sections that remain too coupled for Sprint 2: finance, files, closure/archive, coordinator replacement, live-ops board, and settings.
- [ ] Create acceptance notes for the PMCM slice: PMCM-only visibility, selected event remains stable, command actions are route-safe, and loading states do not flash incorrect role data.

#### Ethan: Portal Slice Definition

- [ ] Review `apps/client`, `apps/supplier`, and `apps/guest` route inventory from `docs/prism-v4/12-redesign-inventory.md`.
- [ ] Choose one thin Sprint 2 portal surface: client action center shell with safe event status and next actions.
- [ ] Identify which unfinished portal features must appear in the July completion path: client action center, client-safe documents/billing/floorplan summary, supplier readiness, supplier application/status, guest access/check-in, and moderated feedback.
- [ ] List Sprint 3 portal surfaces: supplier readiness board, guest access/check-in, client event workspace documents/billing/floorplan summary.
- [ ] Create portal acceptance notes: no PMCM-only data, no official floorplan editing from client, supplier sees only assigned/application-scoped records, guest stays access-code scoped.

#### Anthony: Contracts, Guards, and Environment Readiness

- [ ] Verify `npm run check:boundaries` and `node --test scripts\check-prism-boundaries.test.mjs` still pass after the calendar doc is added.
- [ ] Document the local database blocker and exact recovery command in `docs/prism-v4/14-redesign-readiness-foundation.md`: `npm --workspace prism-api run db:doctor:runtime`.
- [ ] Translate incomplete feature rows from `docs/prism-v4/11-feature-ledger.md` into the Sprint 2-4 contract/test cutline, especially files, notifications, privacy, floorplan eligibility, guest access, supplier readiness, and billing.
- [ ] Identify missing typed response shapes needed by Sprint 2: PMCM command summary, selected-event summary, client action card, shared status vocabulary.
- [ ] Finalize the UI-enabling API contract gate: pagination/result envelopes, filtering/sorting, upload sessions/file rules, normalized errors, empty-state reasons, and bulk/action responses.
- [ ] Mark which frontend patterns are allowed before the gate passes: bounded queues, known-small lists, simple local filters, metadata upload flows, and no generalized grid/upload/bulk manager.
- [ ] Define the Sprint 2 verification baseline: `npm --workspace @prism/types run typecheck`, `npm --workspace @prism/api-client run typecheck`, app typecheck for touched apps, API focused tests for touched controllers/services, `git diff --check`.

### Sprint 1 Review Output

- [ ] Updated owner names remain correct in `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md`.
- [ ] Updated owner names remain correct in `docs/prism-v4/14-redesign-readiness-foundation.md`.
- [ ] This agile calendar is committed or ready to commit.
- [ ] Incomplete feature backlog cutline is reviewed and any disputed item is moved to the feature ledger with a named owner, gate, and next action.
- [ ] July treatment labels are assigned for every feature family: accept as existing, finish, thin slice, gate, or post-July.
- [ ] UI-enabling API contract gate is approved, and any frontend work that would violate it is moved to a later sprint or marked gated.
- [ ] Single-owner task backlog is reviewed so every executable task has exactly one DRI and one completion evidence line.
- [ ] Sprint 2 backlog is small enough for four people to complete in two weeks without each person owning more than one primary surface.

### Sprint 1 Scope Cuts

- Do not redesign every dashboard route.
- Do not introduce external auth.
- Do not replace the floorplan editor internals.
- Do not add production notification adapters.
- Do not start QR scanning.

## Sprint 2: June 22-July 3, 2026

### Sprint Goal

Implement the first reusable design and workflow foundation: shared shell rules, first PMCM command surface, first client action-center slice, and verified API/client contract paths.

### Owner Tasks

#### Maxine: Shared Shell and UX Foundation

- [ ] Create the Sprint 2 UX brief in `docs/prism-v4/12-redesign-inventory.md` with the selected shell pattern, density rules, page title rules, action hierarchy, and state language.
- [ ] Inventory existing shared UI exports from `packages/ui` and identify which components can be reused without moving workflow logic into the package.
- [ ] Define shared visual standards for app shell, page header, section panel, status badge, metric tile, and action queue row.
- [ ] Make sure FL-016 shared shell patterns are expressed through real Sprint 2 surfaces: FL-017 Event Command Inbox and FL-020 Client Action Center.
- [ ] Review Francis and Ethan surfaces before merge for role-specific language, scan density, mobile behavior, and banned visual patterns.

#### Francis: PMCM Command Surface

- [ ] Move the command inbox surface into a focused component if it still depends on broad renderer state.
- [ ] Implement or wire the FL-017 Event Command Inbox slice using scoped PMCM data and safe selected-event actions.
- [ ] Keep command inbox filtering bounded to the approved contract; do not add advanced filters, saved views, infinite scroll, or bulk actions until Anthony lands the shared contract.
- [ ] Include a thin FL-001/FL-002 intake and conforme status view if the current event command data supports it; otherwise document the exact missing contract.
- [ ] Make selected-event summary use `PrismPmcmEventWorkspace` wherever the contract already covers the needed data.
- [ ] Keep fallback filtering only where the scoped workspace does not yet cover a tab, and label it in code as compatibility-only.
- [ ] Verify PMCM routes `/dashboard`, `/dashboard/events`, and one selected event workspace route render without cross-role data leaks.

#### Ethan: Client Action Center Thin Slice

- [ ] Make the client dashboard entry prioritize `PrismClientActionCenter` action cards over broad workspace-derived cards.
- [ ] Implement or wire the FL-020 Client Action Center slice with conforme, briefing/proposal, file, billing, floorplan preference, and next-action status cards where contracts already exist.
- [ ] Keep file/document behavior metadata-first until upload sessions, upload errors, retry behavior, and per-requirement rules are contract-ready.
- [ ] Redesign the client top section around one primary job: "what needs my attention next".
- [ ] Keep official floorplans read-only and client floorplan input as preferences/comments only.
- [ ] Verify `/`, `/inquiry`, `/sign-in`, and `/dashboard` preserve the public-to-signed-in boundary.

#### Anthony: Contracts and Verification

- [ ] Add shared pagination/result envelope, filter/sort, normalized error, empty-state, and action-result types if Sprint 2 UI depends on those patterns; otherwise keep the frontend bounded and document the gate.
- [ ] Add or tighten tests around PMCM command inbox read shape, client action center read shape, and forbidden role access if a contract changes.
- [ ] Update `packages/types` and `packages/api-client` before app code depends on new fields.
- [ ] Establish FL-024 File Requirements Matrix types or a documented contract gap before file/document UI depends on matrix states.
- [ ] Run verification for every touched package and app.
- [ ] Update `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/12-redesign-inventory.md`, and `docs/prism-v4/14-redesign-readiness-foundation.md` with Sprint 2 results.

### Sprint 2 Acceptance

- [ ] PMCM command surface is visibly more focused and still PMCM-only.
- [ ] Client action center has a clear next-action hierarchy and does not expose PMCM internals.
- [ ] Shared UI work stays presentation-only.
- [ ] Any frontend pagination, filtering, sorting, upload, error, empty-state, or bulk/action behavior is either backed by the shared contract gate or explicitly kept out of Sprint 2.
- [ ] FL-017 and FL-020 are real working slices, and FL-001, FL-002, FL-006, and FL-024 have a working slice or a documented gate.
- [ ] Boundary checks catch forbidden broad sample-state and magic storage-key coupling.
- [ ] Sprint 2 demo can show one PMCM flow and one client flow.

### Sprint 2 Verification

Run the commands that match touched surfaces:

```bash
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/event run typecheck
npm --workspace @prism/client run typecheck
npm run check:boundaries
node --test scripts\check-prism-boundaries.test.mjs
git diff --check
```

Add focused API tests when Anthony changes `apps/api`.

## Sprint 3: July 6-July 17, 2026

### Sprint Goal

Deepen and complete the main role workflows before feature freeze: PMCM selected-event workspace, supplier readiness, guest access/check-in, client event workspace summaries, file matrix visibility, floorplan boundaries, billing state, and risk/change visibility. Each workflow should consume scoped contracts wherever available.

### Owner Tasks

#### Maxine: Cross-App Workflow Consistency

- [ ] Create workflow maps for inquiry to conforme, selected event planning, supplier readiness, and guest check-in.
- [ ] Normalize status labels across PMCM, client, supplier, and guest surfaces so the same lifecycle states do not use conflicting language.
- [ ] Review FL-007, FL-008, FL-011, FL-012, FL-022, FL-023, and FL-025 for consistent readiness, risk, assignment, and access language.
- [ ] Review mobile layouts for supplier and guest surfaces, especially event-day status and check-in actions.
- [ ] Define empty/error/no-permission copy for each role surface touched in Sprint 3.

#### Francis: Selected Event Workspace Depth

- [ ] Split one additional selected-event workspace area from `EventDashboardClient.tsx` into a focused route/component if it remains inline.
- [ ] Prioritize live operations/readiness, files/documents, or billing/closure based on which has the clearest scoped data.
- [ ] Use only shared query/filter/sort/action-result contracts for any selected-event table or command list; otherwise keep the view as a bounded panel.
- [ ] Add the PMCM side of FL-007 Supplier Readiness Board, FL-008 coordinator/staffing operations, FL-009 Risk and Change Register, or FL-011 floorplan eligibility based on which contract is ready first.
- [ ] Preserve PMCM-only controls for official floorplans, supplier decisions, audit, and closure overrides.
- [ ] Verify selected-event refresh does not regress command inbox or event list behavior.

#### Ethan: Supplier and Guest Portal Depth

- [ ] Redesign supplier dashboard top section around quote requests, assignments, readiness, contract metadata, and event-day statuses.
- [ ] Implement the portal side of FL-022 Supplier Readiness Board and scope supplier application/status tracking as an MVP or post-July item.
- [ ] Keep supplier readiness and guest lists bounded unless shared pagination/filter/sort contracts are available.
- [ ] Keep supplier data scoped to the logged-in supplier or quote token.
- [ ] Redesign guest `/open` and `/dashboard` around event-code entry, consent, check-in state, and moderated feedback.
- [ ] Implement the FL-012 guest access/check-in slice without QR/camera scanning.
- [ ] Keep QR scanning and media upload gated; do not implement camera flows in Sprint 3.
- [ ] Add a client event summary polish pass only after supplier and guest flows have working states.

#### Anthony: Scoped APIs and Policy Tests

- [ ] Add or harden supplier readiness/read model tests for assigned records only.
- [ ] Add or harden guest access-code tests for valid pass, invalid pass, check-in write, and feedback moderation state.
- [ ] Close or gate upload-session and `PrismActionResult` contracts before Sprint 3 file, supplier, guest, or notification actions present retry/progress/bulk behavior.
- [ ] Add or harden contract/test coverage for whichever FL-008, FL-009, FL-010, FL-011, FL-023, or FL-025 slice is pulled into Sprint 3.
- [ ] Add event workspace contract coverage for whichever Francis surface moves deeper in Sprint 3.
- [ ] Keep `/api/sample/state` as seed/demo/reset only and reject new normal app dependencies on it.

### Sprint 3 Acceptance

- [ ] One selected-event workspace area is easier to redesign independently.
- [ ] Supplier readiness and event-day status are clearer and scoped.
- [ ] Guest access/check-in is lightweight, consent-aware, and event-code scoped.
- [ ] Client event summary changes do not grant floorplan edit access.
- [ ] FL-007, FL-011, FL-012, and FL-022 have working July slices; FL-008, FL-009, FL-010, FL-023, and FL-025 are either working slices or explicitly gated.
- [ ] Tests cover the highest-risk role boundaries touched in the sprint.
- [ ] Feature freeze is respected: any unfinished feature is moved to Sprint 4 blocker/stabilization, gated, or post-July.

### Sprint 3 Verification

Run the commands that match touched surfaces:

```bash
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/event run typecheck
npm --workspace @prism/supplier run typecheck
npm --workspace @prism/guest run typecheck
npm --workspace @prism/client run typecheck
npm run check:boundaries
node --test scripts\check-prism-boundaries.test.mjs
git diff --check
```

Add focused API tests for supplier, guest, or event workspace services when Anthony changes `apps/api`.

## Sprint 4: July 20-July 31, 2026

### Sprint Goal

Stabilize the redesigned system for July 31: fix release blockers, run route-by-route QA, capture evidence, update docs, score the product against the 90% completion scorecard, and prepare a defensible demo story. No new feature scope enters Sprint 4 unless it fixes a release blocker.

### Owner Tasks

#### Maxine: Design QA and Demo Story

- [ ] Run the design QA checklist from `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` against every redesigned surface.
- [ ] Create a demo path that follows the lifecycle: public inquiry, PMCM command, client action center, supplier readiness, guest check-in, and closure/readiness evidence.
- [ ] Confirm every incomplete feature row in this plan has one of three outcomes: working slice, documented gate, or post-July task.
- [ ] Identify visual issues that should be fixed before July 31 and separate them from post-July polish.
- [ ] Confirm no redesigned surface uses banned visual patterns.

#### Francis: PMCM Stabilization

- [ ] Fix PMCM command/event workspace bugs found during QA.
- [ ] Add closure/readiness evidence for FL-013 and decide whether FL-018, FL-019, FL-021, and FL-026 can ship as thin PMCM slices or must move post-July.
- [ ] Verify PMCM-only actions remain inside `apps/event`.
- [ ] Check selected-event state transitions and loading states under slow or failed API responses.
- [ ] Prepare PMCM demo notes for command inbox, event workspace, supplier/floorplan/guest/live-ops visibility, and audit/security cues.

#### Ethan: Portal Stabilization

- [ ] Fix client, supplier, and guest portal bugs found during QA.
- [ ] Add client/supplier/guest closeout or feedback states needed for FL-013 and FL-014 where contracts already exist.
- [ ] Verify public pages cannot jump directly into signed-in dashboards without valid sample session state.
- [ ] Verify supplier and guest mobile states for the core flows selected in Sprint 3.
- [ ] Prepare portal demo notes for client next actions, supplier readiness/status, and guest access/check-in.

#### Anthony: QA, Evidence, and Release Readiness

- [ ] Run the full relevant verification sweep for touched apps and packages.
- [ ] Complete the feature-ledger closeout for every incomplete row: delivered, gated, deferred, or post-July, with owner and verification evidence.
- [ ] Add the July scope decision for FL-014 notifications, FL-015 security/privacy/audit, and FL-027 privacy operations console.
- [ ] Run route-by-route smoke checks for known demo paths. Use Browser or Playwright where local database config permits; otherwise capture the explicit database-unavailable behavior.
- [ ] Capture screenshots for demo-ready surfaces with `scripts/capture-prism-feature-pages.mjs` after local database configuration is healthy.
- [ ] Update `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/12-redesign-inventory.md`, `docs/prism-v4/13-docs-cleanup-checklist.md`, and `docs/prism-v4/14-redesign-readiness-foundation.md`.
- [ ] Confirm `git status --short --branch` is clean after final commit and push.

### Sprint 4 Acceptance

- [ ] Each owner can point to the system goal they advanced and the evidence that it is true in the product.
- [ ] Demo path covers one coherent lifecycle story instead of disconnected screens.
- [ ] No known role-boundary regression remains.
- [ ] No new broad sample-state dependency remains outside documented compatibility paths.
- [ ] Every partial/planned feature family is accounted for as delivered, gated, deferred, or post-July.
- [ ] Screenshots and docs match the current implementation.
- [ ] Post-July items are explicitly listed instead of hidden as unfinished sprint work.
- [ ] The 90% System Completion Scorecard is filled in with evidence, not estimates.

### Sprint 4 Verification

Run the broad final sweep:

```bash
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/event run typecheck
npm --workspace @prism/client run typecheck
npm --workspace @prism/supplier run typecheck
npm --workspace @prism/guest run typecheck
npm --workspace prism-api run typecheck
npm run check:boundaries
node --test scripts\check-prism-boundaries.test.mjs
git diff --check
```

Add `npm run build` only after local environment blockers are resolved or when a release candidate branch is being cut.

## Recommended Changes Before Sprint 2 Starts

1. **Fix local API database configuration.** The current local authenticated browser checks are blocked when Prisma cannot reach the configured database. Anthony should make `npm --workspace prism-api run db:doctor:runtime` green or document the exact environment variable correction before Sprint 2 demo work depends on live sample auth.
2. **Approve the feature cutline.** Maxine is the DRI for the treatment-label review, with Francis, Ethan, and Anthony supporting their owned rows. This prevents hidden unfinished work from being mistaken for completed redesign.
3. **Choose one PMCM and one portal demo path.** Francis and Ethan should not redesign every route in parallel. Sprint 2 should show one PMCM command path and one client action path end to end.
4. **Keep Phase 1 narrower than the full visual redesign.** Maxine should define shell/page patterns and review first surfaces, not redesign all screens at once.
5. **Make Anthony's contract work merge first.** If app work depends on new response fields, the shared type/API-client update should merge before app UI branches.
6. **Use a weekly Friday demo.** Every Friday by 4 PM, each owner should show either a working surface, a contract/test result, or a documented blocker with the next action.
7. **Record scope cuts immediately.** Anything not needed for the July 31 demo path goes into a post-July list instead of expanding sprint scope.

## Cross-Sprint Risk Register

| Risk | Owner to watch | Mitigation |
| --- | --- | --- |
| Event app remains too broad to change safely. | Francis | Extract one route-owned component/hook per sprint, verify with `@prism/event` typecheck, avoid unrelated rewrites. |
| Visual system becomes generic or decorative. | Maxine | Enforce PMCM workflow language, dense operational layouts, and banned visual-pattern checks. |
| Portals expose PMCM-only data. | Ethan | Keep portal reads scoped, add forbidden-role tests when contracts change, review copy for internal terms. Anthony supports the API/security checks. |
| Scoped contracts lag behind UI. | Anthony | Merge type/API-client work before app branches depend on new fields. |
| Local DB blocks demo verification. | Anthony | Fix `db:doctor:runtime` before relying on authenticated local demos; show explicit 503 behavior until fixed. |
| July 31 becomes a feature-expansion deadline. | Anthony | Treat Sprint 4 as stabilization and evidence, not new feature intake. Maxine, Francis, and Ethan support by refusing new feature intake without a release-blocker label. |
| Unfinished features hide inside vague redesign language. | Anthony | Track every partial/planned ledger item as delivered, gated, deferred, or post-July before Sprint 4 closes. Each feature DRI owns its evidence row. |

## Definition Of Done For July 31

- [ ] Phase 0/readiness remains current and does not need reopening.
- [ ] Phase 1 shell/design foundation is represented in at least one PMCM surface and one portal surface.
- [ ] PMCM command/event workspace work is decomposed enough for continued parallel development.
- [ ] Client, supplier, and guest portal direction is clear and role-safe.
- [ ] All partial/planned feature families from the ledger have a July 31 outcome: working slice, documented gate, deferred slice, or post-July task.
- [ ] Shared contracts and boundary checks guard future work.
- [ ] Demo path and screenshots are current.
- [ ] Docs name the actual owners: Maxine, Francis, Ethan, and Anthony.
- [ ] Verification commands for touched apps and packages are recorded in the sprint closeout notes.

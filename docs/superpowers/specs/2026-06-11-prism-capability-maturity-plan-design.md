# P.R.I.S.M Capability Maturity Plan Design

Date: 2026-06-11

## Purpose

This document defines a full-product capability maturity plan for P.R.I.S.M beyond defense scope. It uses `docs/prism-v4/01-complete-feature-catalog.md` as the feature source of truth, `docs/prism-v4/07-implemented-feature-revisions.md` as the current-state backlog, and the current role-specific app boundaries in `AGENTS.md`.

The plan is designed for four people working in parallel without breaking product ownership boundaries:

- P.R.I.S.M remains PMCM's internal event operating system, not a public generic SaaS.
- `apps/event` remains the PMCM admin and coordinator command app.
- `apps/client`, `apps/supplier`, and `apps/guest` remain separate role portals.
- `apps/api` remains the shared NestJS API.
- Clients submit guided layout preferences and review official layouts read-only.
- PMCM owns official floorplan editing and approval workflow from `apps/event`.

## Four-Person Ownership Model

The four owners are workstream owners, not necessarily permanent code owners. They can work in parallel in every phase if they respect the dependency gates listed below.

| Owner | Primary ownership | Secondary responsibilities | Must not own alone |
| --- | --- | --- | --- |
| Owner A: API and Data Lead | NestJS services, Prisma schema/migrations, event-scoped endpoints, RBAC, audit side effects, tests | Shared contracts in `packages/types`, API client contracts in `packages/api-client` | Final UI behavior without the matching app owner |
| Owner B: PMCM and Coordinator Lead | `apps/event`, PMCM dashboard, event workspace, coordinator role views, live-ops UI, action flows | PMCM-facing docs and demo workflows | Client/supplier/guest portal behavior |
| Owner C: Portal Lead | `apps/client`, `apps/supplier`, `apps/guest`, public inquiry, supplier application, guest access, role-specific portal UX | Portal-scoped selectors/hooks and API client usage | PMCM-only internals, private supplier reviews, audit logs |
| Owner D: Platform, QA, Security, and Docs Lead | Verification matrix, boundary checks, privacy/security acceptance, notification/upload adapter policy, docs ledger | Cross-app regression testing, release checklist, feature ledger updates | Feature implementation without an owning app/API partner |

## Parallel Working Rules

1. Owner A defines or updates API contracts before app owners depend on new behavior.
2. Owners B and C may build UI in parallel once DTOs, response shapes, and route ownership are agreed.
3. Owner D writes acceptance checks, verifies boundary rules, and keeps docs current during each phase.
4. Any feature that crosses roles must include an API test plus at least one app build before the phase is marked complete.
5. AI, QR scanning, production notification adapters, external auth, and real file storage remain gated until their prerequisite phases are complete.

## Phase 1: Docs and Feature Ledger Refresh

Feature refs: all catalog features.

Goal: make the feature backlog current after the Prism rename and architecture extraction work, then create a durable ledger for all remaining work.

| Owner | Parallel work |
| --- | --- |
| Owner A | Review API/service state against the backlog. Mark extracted demo, inquiry, billing, and floorplan services as current implementation reality. |
| Owner B | Review PMCM/coordinator surfaces and identify stale references to old large-file or routing assumptions. |
| Owner C | Review client/supplier/guest/public portal feature rows and note which are live, partial, or planned. |
| Owner D | Create or update the feature ledger with statuses: `Live`, `Partial`, `Planned`, `Blocked`, `Phase 2`, `AI gated`. Clean semantic old product-name references in untracked/active docs. |

Deliverables:

- Updated `docs/prism-v4/07-implemented-feature-revisions.md`.
- Updated `docs/prism-v4/08-revision-phase-plan.md`.
- Feature ledger covering feature ID, persona, current status, owner, dependency, and verification command.
- Decision on whether to rewrite, rename, or delete `docs/superpowers/plans/2026-06-10-prism-architecture-hardening.md`.

Acceptance:

- Source docs no longer claim recently completed extractions are future work.
- Semantic old product-name references are removed from tracked docs and chosen active planning docs.
- The ledger can answer: what exists, what is partial, what is planned, what is blocked, and who owns the next slice.

Verification:

- Run the repository old-name sweep, excluding dependency/build output folders; only dependency integrity substrings may remain.
- `npm run check:boundaries`
- Docs link check by targeted `rg` over `docs README.md CLAUDE.md AGENTS.md`.

## Phase 2: Core Lifecycle Completion

Feature refs: FR-01, FR-02, FR-03, FR-04, FR-05, FR-26, FR-27, FR-52, FR-58, FR-60.

Goal: make the inquiry-to-active-event lifecycle coherent from public inquiry through signed conforme, briefing/proposal, planning workspace, and activity history.

| Owner | Parallel work |
| --- | --- |
| Owner A | Add or harden event-scoped lifecycle endpoints for inquiry, onboarding, briefing, proposal status, activity, and event detail. Keep broad demo state as compatibility only. |
| Owner B | Add PMCM log-on-behalf UI, clearer conforme/invitation state controls, and event workspace action history. Continue extracting PMCM action handlers from large dashboard files. |
| Owner C | Wire client dashboard to scoped lifecycle reads and expose client-facing status, proposal review state, and next actions without PMCM internals. |
| Owner D | Add lifecycle regression matrix: public cannot enter dashboard, client portal stays conforme-gated, event creation requires accepted inquiry and signed conforme. |

Deliverables:

- Event-scoped lifecycle read APIs and typed API client functions.
- PMCM inquiry/onboarding controls for log-on-behalf, reminder, invite, conforme upload, and proposal status.
- Client portal status model for active event progress and proposal review.
- Tests for inquiry acceptance, conforme gate, portal unlock, and scoped client reads.

Acceptance:

- A new event can be traced from public/manual inquiry to accepted conforme to active planning workspace.
- Client users cannot see PMCM internal CE, private supplier notes, audit logs, or unrelated events.
- New lifecycle UI does not depend on reading all demo state unless no scoped endpoint exists yet.

Verification:

- Focused API lifecycle tests.
- `npm run typecheck`
- `npm run build`
- `npm run check:boundaries`

## Phase 3: Client and Document/File Maturity

Feature refs: FR-08, FR-29, FR-32, FR-33, FR-34, FR-67, FR-68, FR-70, FR-80, FR-81, FR-82, FR-83, FR-84.

Goal: make client documents, file hub access, official floorplan review, and client asset submission production-shaped while preserving PMCM floorplan ownership.

| Owner | Parallel work |
| --- | --- |
| Owner A | Add scoped document/file APIs, document categories, file validation metadata, floorplan revision-comment records, and table assignment eligibility primitives. |
| Owner B | Build PMCM file hub, document review states, official floorplan revision management, and table assignment controls for eligible events. |
| Owner C | Build client asset submission, allowed file views, read-only official floorplan review, revision comments, and client preference draft state. |
| Owner D | Define file permission tests, upload validation fixtures, floorplan mutation regression tests, and document privacy checks. |

Deliverables:

- Event file hub model with document categories and role visibility.
- Client asset submission flow.
- Official floorplan review/revision comment workflow.
- Template metadata for conforme/billing documents.
- Table assignment planning limited by event type and pax rules.

Acceptance:

- Client users can submit and view only allowed event documents.
- PMCM can review and organize files from `apps/event`.
- Official floorplans remain editable only by PMCM and read-only for clients.
- Table assignment is only offered when the catalog rules allow it.

Verification:

- API document/floorplan permission tests.
- `npm --workspace @prism/client run typecheck`
- `npm --workspace @prism/event run typecheck`
- `npm run build`

## Phase 4: Finance and Commercial Workflow Maturity

Feature refs: FR-19, FR-20, FR-21, FR-60, FR-69, FR-92, FR-93, FR-94, FR-96, FR-97, New-P5.

Goal: make CE/proposal, billing, payment, cancellation, postponement, additional billing, and waiver workflows auditable from source records.

| Owner | Parallel work |
| --- | --- |
| Owner A | Extend billing source, payment terms, dispute, correction, additional billing, waiver, cancellation, and postponement records. |
| Owner B | Build PMCM finance controls for configurable terms, disputes, corrections, waivers, cancellation/postponement summaries, and source-linked statements. |
| Owner C | Show client-safe billing statements, milestones, dispute status, and approved proposal/payment state in the client portal. |
| Owner D | Add finance audit tests, data-leak checks, and docs explaining the commercial source-of-truth model. |

Deliverables:

- CE/proposal source records linked to billing statements.
- Configurable payment schedule with fixed 50% downpayment rule and override audit.
- Payment discrepancy and typo-correction workflow.
- Additional billing and waiver reason flow.
- Cancellation and postponement financial impact summaries.

Acceptance:

- Every billing statement and payment milestone can be traced to an approved source record.
- Every financial correction, waiver, cancellation, or postponement has audit metadata.
- Client sees only client-safe billing state.

Verification:

- API finance tests.
- `npm --workspace prism-api run typecheck`
- `npm --workspace @prism/event run typecheck`
- `npm --workspace @prism/client run typecheck`

## Phase 5: Supplier Network Maturity

Feature refs: FR-14, FR-15, FR-16, FR-17, FR-18, FR-35, FR-36, FR-37, FR-38, FR-49, FR-63, FR-64, FR-75, FR-76, FR-77, FR-78, FR-79, FR-87, New-S1, New-S2, New-S3, New-S4, New-S5, New-SUP1, New-SUP2, New-SUP3, New-SUP4.

Goal: mature supplier management from directory and quote handling into application intake, assignment, contract, readiness, event-day status, and reliability history.

| Owner | Parallel work |
| --- | --- |
| Owner A | Add supplier application, status tracking, contract metadata, reliability note triggers, quote policy, and supplier-scoped endpoints. |
| Owner B | Build PMCM supplier applications inbox, supplier approval-to-directory flow, quote policy controls, reliability history, and event supplier schedule view. |
| Owner C | Build public supplier registration, supplier application status view, contract upload metadata, readiness confirmation, and event-day status buttons. |
| Owner D | Add supplier privacy tests, quote confidentiality tests, private review leak checks, and application workflow docs. |

Deliverables:

- Public supplier application and status page.
- PMCM supplier applications inbox.
- Approved supplier lifecycle with Pending First Event.
- Contract upload metadata and quote mismatch warning.
- Readiness and event-day status flows.
- Supplier reliability notes from withdrawal, unresponsiveness, mismatch, and event-day underperformance.

Acceptance:

- Supplier users see only their own application, assignments, quotes, contracts, and statuses.
- PMCM private reviews and internal reliability assessment never appear in supplier portal.
- Quote confidentiality is enforced before bid win.

Verification:

- API supplier/application/quote tests.
- `npm --workspace @prism/supplier run typecheck`
- `npm --workspace @prism/event run typecheck`
- `npm run build`

## Phase 6: Coordinator and Live-Ops Maturity

Feature refs: FR-13, FR-88, FR-89, FR-90, FR-91, New-C1, New-C2, New-C3, New-C4, New-CO1, New-CO2, New-CO3, New-CO4, New-CO5, New-CO6.

Goal: mature coordinator assignment and event-day operations into role-safe, operationally useful workflows.

| Owner | Parallel work |
| --- | --- |
| Owner A | Add coordinator availability windows, staffing requirements, role payload contracts, conflict/replacement records, and live-ops status-feed hardening. |
| Owner B | Build PMCM coordinator staffing views, replacement controls, event-day operator view, role payload management, and live-ops dashboards. |
| Owner C | Support coordinator role views inside `apps/event` session flow only; coordinate with Owner B for mobile/laptop usability. |
| Owner D | Add role-leak tests, SLA/escalation tests, replacement/audit tests, and live-ops regression scripts. |

Deliverables:

- Coordinator availability and staffing gap model.
- Role-specific coordinator payloads.
- Event Day System Operator workflow.
- Late/no-show reliability notes.
- Task reassignment with Ms. Mys notification approval semantics.
- Live status feed filters and escalation controls.

Acceptance:

- Coordinator users only see assigned-event operational data for their role.
- PMCM can detect staffing gaps before event day and replace coordinators with audit/reliability side effects.
- Registration staff can access check-in data; other roles cannot.

Verification:

- API coordinator/live-ops tests.
- `npm --workspace @prism/event run typecheck`
- `npm run build`
- Manual role-session regression checklist.

## Phase 7: Guest, Registration, and Feedback Maturity

Feature refs: FR-39, FR-40, FR-41, FR-95, New-GU1, New-EX2.

Goal: complete lightweight guest access, registration, check-in, feedback, and moderation before QR scanning or engagement games.

| Owner | Parallel work |
| --- | --- |
| Owner A | Add guest masterlist import/reconciliation, check-in mode configuration, walk-in verification records, feedback moderation state, and ticket-platform coordination records. |
| Owner B | Add PMCM/registration dashboards for masterlist reconciliation, walk-in verification, attendance, and feedback moderation. |
| Owner C | Build guest check-in mode UI, walk-in flow, post-event feedback page, and supplier/client-safe guest surfaces. |
| Owner D | Define HTTPS/QR readiness gate, guest privacy tests, moderation acceptance tests, and access-code scope checks. |

Deliverables:

- Name-based checklist and headcount-only modes.
- Masterlist reconciliation.
- Walk-in verification policy enforcement.
- Moderated feedback queue.
- Ticket platform coordination record for large events.
- QR scanning deferred behind HTTPS readiness.

Acceptance:

- Guest access is access-code scoped.
- Guest feedback is never auto-published.
- Unauthorized walk-ins trigger verification according to client policy.

Verification:

- API guest tests.
- `npm --workspace @prism/guest run typecheck`
- `npm --workspace @prism/event run typecheck`
- `npm run build`

## Phase 8: Closure, Archive, Knowledge, and Testimonials

Feature refs: FR-22, FR-23, New-P1, New-P2, New-P3, New-P4, New-SY1, New-SY2.

Goal: turn event closure into a complete learning and archive loop.

| Owner | Parallel work |
| --- | --- |
| Owner A | Extend close gates, archive search indexes, comparison records, testimonial records, logistics booking records, and event insights source aggregation. |
| Owner B | Build PMCM wrap-up screen, one-screen close, archive search, event comparison, logistics booking, and event insights panels. |
| Owner C | Build client acknowledgement/testimonial submission surfaces and safe post-event visibility. |
| Owner D | Add close gate tests, archive search tests, override audit checks, and post-event privacy/retention docs. |

Deliverables:

- Post-event wrap-up screen.
- One-screen close indicators and override flow.
- Archive search and event comparison.
- Event insights card with private notes.
- Testimonial request/library.
- Logistics booking record and billing linkage.

Acceptance:

- Events cannot close without green gates or documented override.
- Archived records are searchable and complete.
- Client testimonials require explicit submission and do not expose private PMCM notes.

Verification:

- API close/archive/insights tests.
- `npm --workspace @prism/event run typecheck`
- `npm --workspace @prism/client run typecheck`
- `npm run build`

## Phase 9: Notifications, Upload Storage, and Integration Adapters

Feature refs: FR-25, FR-55, FR-59, FR-61, FR-64, FR-76.

Goal: replace demo-only notification and storage behavior with adapter-backed infrastructure that can fail safely.

| Owner | Parallel work |
| --- | --- |
| Owner A | Define notification adapter interfaces, retry policy, delivery audit, upload storage abstraction, signed URL flow, and integration shell APIs. |
| Owner B | Build PMCM notification center, delivery status visibility, template controls, and integration status panels. |
| Owner C | Add portal notification preferences and safe delivery state displays where needed. |
| Owner D | Own credential readiness checklist, adapter failure tests, storage security tests, and integration runbooks. |

Deliverables:

- Email and Viber adapter interfaces.
- Queued delivery with sent/failed/retry/acknowledged states.
- Bilingual notification templates.
- Real storage abstraction with signed access.
- Canva/PowerPoint/Zoom integration shells where credentials exist.

Acceptance:

- Failed adapters do not corrupt workflow state.
- Delivery attempts are auditable.
- Uploaded files are validated, stored under generated names, and served only through authorized access.

Verification:

- Adapter unit tests with fake providers.
- Upload validation tests.
- `npm run typecheck`
- `npm run build`

## Phase 10: Security, Privacy, and Production Auth

Feature refs: New-SEC1, New-SEC2, New-SEC3, New-SEC4, FR-56, FR-AI-ZDR foundation.

Goal: raise P.R.I.S.M from demo auth/privacy to production-shaped security controls before live AI or external integrations process real data.

| Owner | Parallel work |
| --- | --- |
| Owner A | Add production auth abstractions, session expiry, password reset tokens, 2FA primitives, retention calendars, legal hold, redaction records, and audit hardening. |
| Owner B | Build PMCM security/privacy console, retention controls, legal hold visibility, and audit verification views. |
| Owner C | Update portal privacy notices, consent surfaces, account/session states, and user-facing privacy request entry points. |
| Owner D | Own privacy/security threat model, audit-chain verification tests, retention/redaction acceptance, and production auth decision record. |

Deliverables:

- Production auth decision record.
- 2FA for PMCM admin.
- Password reset and session controls.
- Retention policy calendar.
- Legal hold handling.
- Document-specific redaction.
- Privacy request execution with append-only audit.

Acceptance:

- PMCM can answer access, correction, deletion, and export requests.
- Audit history remains append-only in normal workflows.
- Production auth requirements are explicit before external launch.

Verification:

- Security/privacy API tests.
- Audit-chain tamper tests.
- Role access regression suite.
- `npm run typecheck`
- `npm run build`

## Phase 11: AI and Agentic Layer

Feature refs: FR-AI-01, FR-AI-03, FR-AI-04, FR-AI-04b, FR-AI-05, FR-AI-06, FR-AI-07, FR-AI-08, FR-AI-09, FR-AI-ZDR.

Goal: add AI only after governance, privacy, audit, and human approval controls are operational.

| Owner | Parallel work |
| --- | --- |
| Owner A | Build provider abstraction, sanitizer enforcement, AI audit records, approval records, prompt/input contracts, and deterministic fallback behavior. |
| Owner B | Build PMCM approval queue, AI triage review, POA controls, PARE approval flow, event-day copilot review, and PEIL review surfaces. |
| Owner C | Add only reviewed/approved AI outputs to client/supplier/guest-facing flows. No raw AI output leaves PMCM review. |
| Owner D | Own ZDR/provider verification, sanitizer tests, prompt privacy review, AI risk register, and AI acceptance gates. |

Deliverables:

- ZDR/provider verification record.
- Sanitizer test suite.
- AI audit and approval queue.
- Intelligent inquiry triage.
- Proposal drafting assistant.
- POA chatbot.
- PARE supplier replacement workflow.
- Supplier reliability scoring.
- Event-day copilot.
- PEIL post-event intelligence.
- Client communication assistant.

Acceptance:

- No AI feature runs without ZDR/provider approval and sanitizer enforcement.
- No AI recommendation executes without PMCM approval.
- Raw AI output is never sent directly to clients, suppliers, coordinators, or guests.
- AI audit records show model version, data categories, sanitizer status, ZDR confirmation, and approval state.

Verification:

- Sanitizer redaction tests.
- AI audit tests.
- Human approval gate tests.
- Prompt privacy review checklist.
- `npm run typecheck`
- `npm run build`

## Cross-Phase Cadence

Each phase should be split into small implementation branches. A normal phase should use this sequence:

1. Owner D updates the feature ledger and acceptance checklist.
2. Owner A lands API contracts, Prisma changes, and tests behind compatible routes.
3. Owner B and Owner C build app surfaces in parallel against those contracts.
4. Owner D runs cross-role regression, boundary checks, and docs updates.
5. The team merges only after the phase has passing verification and no role-boundary regressions.

## Branching and Parallel Work Strategy

Recommended branch pattern:

- `codex/phase-N-api-data`
- `codex/phase-N-pmcm-coordinator`
- `codex/phase-N-portals`
- `codex/phase-N-platform-qa-docs`

Merge order inside a phase:

1. API/data contracts.
2. PMCM and portal app surfaces in either order once API is merged.
3. Platform/QA/docs finalization.

When app work must start before API merge, use typed local fixtures or feature flags, then switch to the real API before merge.

## Definition of Done for Any Phase

- Feature ledger updated.
- API and app ownership documented.
- Role-boundary tests or checks updated.
- Focused tests for touched workflows pass.
- `npm run typecheck` passes.
- `npm run build` passes before final merge.
- `npm run check:boundaries` passes.
- No semantic old product-name references are introduced.
- Public pages do not link directly to dashboards.
- Clients cannot mutate official floorplans.
- PMCM-only data stays PMCM-only.

## Risks and Gates

| Risk | Gate |
| --- | --- |
| Live AI before legal/privacy readiness | Block until Phase 10 and FR-AI-ZDR verification are complete. |
| QR scanning instability in local/demo environments | Block until HTTPS and camera constraints are solved. |
| Production notification failures | Route all providers through queue/retry/audit adapters. |
| File upload privacy leakage | Require storage abstraction, generated names, validation, and signed access. |
| Cross-role data leakage | Require boundary checks and scoped API tests for every cross-role feature. |
| Large dashboard files returning | Use selectors/hooks/services and route-specific components as phase acceptance criteria. |

## Immediate Next Implementation Plan

The first implementation plan should cover Phase 1 only:

1. Refresh current-state docs after the Prism architecture work.
2. Create the feature ledger.
3. Decide the fate of the untracked old architecture plan with semantic old product-name references.
4. Add a docs verification checklist.

Phase 1 is the right first implementation slice because it prevents the team from planning against stale feature status while four people work in parallel.

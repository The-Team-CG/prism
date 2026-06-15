# P.R.I.S.M Whole-App Redesign and Capability Maturity Plan

Date: 2026-06-11
Last updated: 2026-06-15

## Purpose

This document defines a full-product redesign and capability maturity plan for P.R.I.S.M. It treats the project as a complete operating system for PMCM, not as a set of isolated feature tickets. The plan covers UX redesign, information architecture, design system work, role-specific app flows, backend/data maturity, security/privacy, integrations, and AI/agentic features.

This is the active redesign plan. It now assigns each owner an explicit system goal, not only a workstream. Owner A is Maxine, Owner B is Francis, Owner C is Ethan, and Owner D is Anthony. A phase is not complete when an owner finishes screens or endpoints in isolation; it is complete when the owner's system goal is measurably true in the running product. The sprint calendar in `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md` is the execution cutline for partial, planned, or otherwise unfinished feature families through July 31, 2026.

Primary sources:

- `docs/prism-v4/01-complete-feature-catalog.md`
- `docs/prism-v4/07-implemented-feature-revisions.md`
- `docs/prism-v4/08-revision-phase-plan.md`
- `docs/prism-v4/10-product-evolution-and-redesign-governance.md`
- `docs/prism-v4/11-feature-ledger.md`
- `docs/prism-v4/12-redesign-inventory.md`
- `docs/prism-v4/13-docs-cleanup-checklist.md`
- `docs/prism-v4/14-redesign-readiness-foundation.md`
- `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`
- `AGENTS.md`
- Current code in `apps/client`, `apps/event`, `apps/supplier`, `apps/guest`, `apps/api`, `packages/types`, `packages/api-client`, and `packages/ui`

## Product Positioning

P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It is not a generic SaaS product, public marketplace, or all-role mega-dashboard. The experience should feel like a serious operating desk for event work: quiet, exact, fast to scan, and trustworthy under pressure.

The product is role-specific:

- `apps/event`: PMCM admin and coordinator command app.
- `apps/client`: public inquiry plus signed-in client portal.
- `apps/supplier`: supplier portal.
- `apps/guest`: guest portal.
- `apps/api`: shared NestJS API.

The lifecycle is:

1. Inquiry
2. Conforme
3. Briefing and proposal
4. Planning
5. Event day
6. Closure and archive

The redesign must make that lifecycle visible and operable across apps.

## Design Context

### Target Audience

Primary users:

- Ms. Mys and PMCM admin staff who need a command view of active events, risks, supplier status, billing, files, and live operations.
- Coordinators working from phones or laptops during assignments and event day.
- Clients who need confidence, clarity, and a narrow set of next actions.
- Suppliers who need quote, assignment, contract, readiness, and event-day status workflows.
- Guests who need lightweight access without account friction.

### Use Context

The app is used in mixed conditions:

- PMCM admin planning work on laptop/desktop.
- Event-day command activity under time pressure.
- Coordinators using phone-first task views onsite.
- Suppliers responding from mobile or desktop.
- Clients checking status and submitting assets asynchronously.
- Guests opening access-code or QR-like flows on phones.

### Brand and UX Tone

The product should feel:

- Operational, not promotional.
- Calm, not sterile.
- Dense enough for real work, not cluttered.
- High-trust, with explicit status and audit cues.
- PMCM-specific, not generic event SaaS.

Visual direction:

- Use restrained layouts with clear hierarchy.
- Prefer tables, timelines, work queues, split panes, and event workspaces over decorative card grids.
- Use color to signal workflow state and urgency, not decoration.
- Avoid active underline nav treatments, decorative eyebrow pills, uppercase badge labels, avatar blocks in sidebars, nested cards, gradient orbs, and marketing-style heroes.

## Planning Model

Every phase has two required tracks:

1. Experience redesign
   - Information architecture
   - Navigation
   - Page layout
   - Task flow
   - Interaction model
   - Role-specific UX
   - Responsive behavior
   - Empty/error/loading states

2. Capability maturity
   - API shape
   - Data model
   - Permissions
   - Audit
   - Notifications
   - Upload/storage
   - Tests
   - Documentation

No phase is complete if it only makes the UI prettier or only adds backend endpoints. A phase is complete when the affected workflow works end to end, has clear role boundaries, and is verified.

## Current Architecture Baseline

As of 2026-06-15, the highest-impact backend architecture hardening work is treated as the starting baseline for the redesign, not as future discovery work.

Implemented baseline:

- `EventOpsService` remains the public facade, but operational ownership has been split into workflow services for inquiry, onboarding, commercial workflow, supplier network, live operations, closure, compliance, AI governance, notifications, read models, lifecycle, and document validation.
- Role-aware read models and scoped controllers exist alongside seed/sample compatibility. Broad sample state remains for demo/reset paths only and should not become the default design dependency for new surfaces.
- `EventAccessPolicyService` is the central permission and role-boundary layer for event access decisions.
- Workflow writes increasingly follow the command pattern: validate permission, validate state, write, audit, queue notification, return typed result.
- Notification delivery uses a durable outbox with attempt state, failure reason, acknowledgement state, and audit correlation.
- File upload metadata validation is centralized in `DocumentVaultService`; the file requirements matrix is the target product model for document/file surfaces.
- Lifecycle transitions are encoded in `EventLifecycleService`.
- Shared actor context, notification log details, lifecycle types, and event-ops contracts live in `packages/types` and `packages/api-client`.
- The redesign readiness foundation is complete: active docs, app ownership, sample-state fencing, session/storage conventions, scoped-contract direction, event-app extraction seams, stale-doc removal, and `.tmp/` hygiene are documented in `docs/prism-v4/14-redesign-readiness-foundation.md`.
- Session key names and browser session read/write/clear helpers live in `@prism/types`, and the client, event, supplier, guest, and screenshot-capture flows consume that shared contract.
- The event app now has explicit extracted handoff surfaces for public entry, loading/skeleton states, selected-event workspace loading, live-ops/readiness loading, approval requests, action orchestration, floorplans, briefing, suppliers, activity, and messages.
- Boundary checks prevent backend services from injecting `Prisma` as `any`, block cross-role app imports, and catch new broad sample-state or magic storage-key coupling.

Remaining implementation debt:

- Keep reducing `EventOpsService` until it is only a route-facing orchestrator and mapper.
- Continue replacing compatibility fallbacks after scoped read APIs cover the full surface area.
- Convert remaining direct integration/file side effects into durable command or adapter boundaries.
- Keep frontend feature modules aligned to workflow ownership instead of route sprawl.
- Fix local database configuration before treating API-backed sample data as live in local demos.

## Product Evolution Model

The Version 4 catalog is the baseline feature inventory, not a hard ceiling. The redesign may add, revise, merge, split, defer, retire, or gate features when doing so makes P.R.I.S.M clearer, safer, more usable, or more aligned with PMCM operations.

Every catalog feature and proposed new feature should receive a feature-ledger decision:

| Decision | When to use it |
| --- | --- |
| Keep | The feature is still valid and should be implemented or hardened as written. |
| Revise | The feature is valuable but needs stronger UX, data, permission, workflow, or wording. |
| Merge | Multiple features should become one stronger workflow. |
| Split | One broad feature should become multiple implementation slices. |
| Add | A new capability should be introduced because it improves PMCM's operating model. |
| Defer | The feature is valid but should wait for a later maturity stage. |
| Retire | The feature is outdated, redundant, unsafe, or no longer product-aligned. |
| Gate | The feature can proceed only after a prerequisite such as privacy, auth, storage, notification, QR, or AI governance is complete. |

Add or revise features when they reduce repeated PMCM work, reduce event-day risk, clarify responsibility across roles, improve audit/privacy/security, replace weak catalog items with stronger workflows, or make a core workflow easier to complete without training. Retire or merge features that push the product toward generic SaaS, duplicate a stronger workflow, expose too much PMCM state, depend on unwanted external operations, or exist only as sample artifacts.

Ownership:

| Owner | Person | Product evolution responsibility |
| --- | --- | --- |
| Owner A | Maxine | Owns the product/UX quality case for add, revise, merge, split, defer, or retire decisions. |
| Owner B | Francis | Validates PMCM and coordinator workflow impact. |
| Owner C | Ethan | Validates client, supplier, guest, and public portal impact. |
| Owner D | Anthony | Validates API, data, permission, audit, security, test, and documentation impact. |

Phase 0 must produce the feature ledger with at least these fields: feature ID, source, persona, current state, decision, decision reason, owner, phase placement, dependencies, permission boundary, audit/notification needs, UX surface, and verification requirement.

## Four-Person Ownership Model

The plan assumes four people can work in parallel. The owners below are named workstream owners.

| Owner | Person | Workstream | Primary ownership | Secondary ownership | Main risk to prevent |
| --- | --- | --- | --- | --- | --- |
| Owner A | Maxine | Product UX and Design System Lead | Whole-app IA, design language, app shells, workflow layout patterns, component standards, UX writing, responsive rules | Feature ledger UX status, design QA, page-by-page redesign briefs | Redesign becoming inconsistent across apps |
| Owner B | Francis | PMCM and Coordinator App Lead | `apps/event`, PMCM command app, event workspace, coordinator role views, live operations, PMCM actions | PMCM/coordinator fixture data, app-specific selectors/hooks | PMCM command app becoming a generic dashboard or leaking too much data |
| Owner C | Ethan | Portal Apps Lead | `apps/client`, `apps/supplier`, `apps/guest`, public inquiry, supplier application, guest access, portal UX | Portal-specific scoped reads and state hooks | Portals becoming all-purpose dashboards or exposing PMCM-only data |
| Owner D | Anthony | API, Platform, QA, Security, and Docs Lead | `apps/api`, Prisma, shared contracts, API client, permission boundaries, audit, notifications, uploads, integration adapters, verification, docs | Cross-role regression matrix, release checklist, feature ledger | UI work outrunning data/security foundations |

## Owner System Goals

Each owner has one durable goal for the system. The goal describes the product condition that must become true, regardless of which individual tickets or files are involved.

| Owner | Person | System goal | What the system must let PMCM do | Success signals | Non-goal |
| --- | --- | --- | --- | --- | --- |
| Owner A | Maxine | Make P.R.I.S.M feel like one coherent PMCM operating system across every role surface. | PMCM, clients, suppliers, coordinators, and guests should recognize the same lifecycle, status language, action hierarchy, and interaction patterns while still seeing role-specific surfaces. | Every redesigned page has one primary job, a visible next action, consistent status language, responsive states, and no banned visual patterns. | Maxine does not own every component implementation or turn portals into the same shell. |
| Owner B | Francis | Make PMCM and coordinator work operable from inquiry intake through event-day command and closure. | Ms. Mys, EA, PMCM admins, and coordinators should be able to see operational risk, resolve blockers, run events, replace people, verify suppliers, manage official floorplans, and close/archive events from the PMCM command app. | Event Command Inbox, selected event workspace, live-ops board, staffing/role views, finance/files/closure surfaces, and PMCM-only data boundaries are usable and verified. | Francis does not expose PMCM internal state to client, supplier, or guest portals. |
| Owner C | Ethan | Make every external portal a narrow, safe action surface instead of a dashboard clone. | Clients, suppliers, and guests should complete their own next action without seeing internal PMCM work, unrelated events, private reviews, internal costs, or cross-role data. | Client Action Center, supplier readiness/quote/contract/status flows, guest access/check-in/feedback, public inquiry, and supplier application flows are scoped, mobile-ready, and role-safe. | Ethan does not build all-role shells or bypass PMCM gates for event creation, official floorplan edits, or supplier decisions. |
| Owner D | Anthony | Make the platform enforce trust: correct data, permissions, audit, files, notifications, lifecycle, and verification. | PMCM should be able to trust that every workflow state change is typed, permissioned, auditable, queued when external delivery is involved, and backed by durable records. | Scoped APIs replace broad state dependencies, shared contracts are source of truth, policy checks gate reads/writes, command handlers own side effects, outbox/file/lifecycle services are tested, and docs stay current. | Anthony does not block product work with speculative platform rewrites or move workflow UX into backend abstractions. |

## Owner Definitions of Done

| Owner | Person | Definition of done |
| --- | --- | --- |
| Owner A | Maxine | UX brief, IA, state language, layout pattern, responsive expectations, empty/error/no-permission states, and design QA notes exist for every redesigned workflow before implementation is called complete. |
| Owner B | Francis | PMCM/coordinator workflows can be completed from the event command app with correct PMCM-only visibility, clear next actions, and verified lifecycle/audit/notification side effects. |
| Owner C | Ethan | Portal users can complete their scoped tasks without PMCM-only leakage, all public-to-signed-in boundaries are explicit, and mobile/low-friction states are verified. |
| Owner D | Anthony | API/data contracts, permission policy, audit, outbox/file/lifecycle behavior, tests, build/typecheck/boundary checks, and docs are updated for the changed workflow. |

## Owner Goal To Phase Mapping

The same four goals apply in every phase:

| Phase group | Maxine / Owner A goal in that phase | Francis / Owner B goal in that phase | Ethan / Owner C goal in that phase | Anthony / Owner D goal in that phase |
| --- | --- | --- | --- | --- |
| Phase 0-1 foundation | Define the shared operating language and page patterns. | Confirm PMCM/coordinator IA and command workflows. | Confirm portal IA and external action boundaries. | Lock contracts, policies, fixtures, and verification gates. |
| Phase 2-6 app redesign | Keep every app coherent while preserving role-specific UX. | Make PMCM/coordinator surfaces operationally complete. | Make client/supplier/guest/public surfaces focused and safe. | Provide scoped APIs and prevent role-boundary regressions. |
| Phase 7-9 workflow maturity | Align lifecycle/action/status models across apps. | Deepen PMCM command, commercial, live-ops, closure, and archive work. | Deepen portal next-action, visibility, and feedback flows. | Mature workflow data, audit, notification, file, and search foundations. |
| Phase 10-12 platform/AI maturity | Define visible, understandable states for integrations, security, privacy, and AI review. | Operate notifications, privacy/security, and AI review from PMCM surfaces. | Show only approved and portal-safe external states. | Own adapters, storage, auth, privacy, ZDR, AI audit, approval gates, and regression suites. |

## Parallel Work Rules

1. Maxine defines design patterns before Francis and Ethan implement redesigned pages.
2. Anthony defines or validates API contracts before redesigned surfaces depend on new behavior.
3. Francis and Ethan may build in parallel once route ownership and DTOs are stable.
4. Anthony owns cross-app verification and prevents role-boundary regressions.
5. Every owner must state which system goal their branch advances before implementation starts.
6. Any page redesign must identify the workflow it improves, not just the visual changes.
7. Any capability expansion must identify the user-facing surface where it is operated.
8. AI, QR scanning, production notification adapters, external auth, and real file storage stay gated until their prerequisite phases are complete.

## Phase 0: Whole-App Audit, Feature Ledger, and Redesign Inventory

### Goal

Establish the full current-state map before redesigning or adding more features. This phase answers: what exists, what is partial, what is missing, what needs redesign, and who owns each next slice.

Status: complete as of 2026-06-15. The readiness output is committed on `main` in `9ab88c5` and captured by `docs/prism-v4/14-redesign-readiness-foundation.md`.

### Feature Scope

All catalog features.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Create a whole-app UX audit covering IA, navigation, density, status language, page templates, empty states, form patterns, action hierarchy, responsive behavior, and visual debt. |
| Owner B | Audit `apps/event` page inventory: PMCM home, inquiries, clients, events, event workspace tabs, finance, suppliers, files, messages, calendar, tasks, team, audit, settings, coordinator role views. |
| Owner C | Audit portal inventory: public landing/inquiry, client dashboard and event detail, supplier dashboard, supplier quote/assignment/readiness/status flows, guest access/check-in/feedback. |
| Owner D | Create feature ledger and technical maturity ledger: feature ID, persona, current UI, API endpoint, data model, permission status, audit/notification state, tests, owner, status, blocker. |

### Redesign Inventory Fields

Each page or workflow should be recorded with:

- App
- Route
- Persona
- Primary user job
- Current status
- Redesign severity: none, light, moderate, major, rebuild
- Capability maturity: live, partial, planned, blocked
- Data dependencies
- Permission dependencies
- Visual issues
- Interaction issues
- Mobile/laptop behavior
- Test coverage
- Owning workstream

### Deliverables

- Updated `docs/prism-v4/07-implemented-feature-revisions.md`.
- Updated `docs/prism-v4/08-revision-phase-plan.md`.
- `docs/prism-v4/11-feature-ledger.md`.
- `docs/prism-v4/12-redesign-inventory.md`.
- `docs/prism-v4/13-docs-cleanup-checklist.md`.
- `docs/prism-v4/14-redesign-readiness-foundation.md`.
- Retired stale app-local docs and old standalone plans from active guidance.

### Acceptance

- Every feature in the catalog has a status.
- Every current app route has an owner and redesign severity.
- Existing architecture work is reflected accurately in docs.
- Semantic old product-name references are removed from active planning docs.
- App ownership, sample-state compatibility boundaries, shared session conventions, and scoped-contract direction are explicit enough for four owners to start Phase 1 without guessing.

### Verification

- Repository old-name sweep.
- `npm run check:boundaries`
- `node --test scripts\check-prism-boundaries.test.mjs`
- `npm --workspace @prism/types run typecheck`
- `npm --workspace @prism/api-client run typecheck`
- Targeted doc link scan across `docs`, `README.md`, `CLAUDE.md`, and `AGENTS.md`.

## Phase 1: Design System, Navigation, and Shell Foundation

### Goal

Create the foundation that every redesign depends on: shared visual language, role-specific shells, navigation rules, workflow components, and page layout patterns.

### Feature Scope

Cross-cutting all features.

### Experience Redesign

Owner A leads:

- Define the P.R.I.S.M design principles.
- Define role-specific shell patterns:
  - PMCM command shell
  - Coordinator role shell
  - Client portal shell
  - Supplier portal shell
  - Guest lightweight shell
  - Public inquiry shell
- Define standard page structures:
  - Work queue
  - Event workspace
  - Timeline/activity
  - Action checklist
  - Review/approval flow
  - File/document hub
  - Financial ledger
  - Live operations board
  - Archive/search view
- Define standard status language:
  - Inquiry
  - Conforme
  - Proposal
  - Planning
  - Supplier assignment
  - Coordinator assignment
  - Billing
  - Floorplan
  - Event-day operations
  - Closure
- Define navigation rules:
  - No active underline treatments.
  - No profile/avatar block in sidebars when topbar has account menu.
  - Signed-in dashboards only.
  - Public routes remain public inquiry/landing only.
  - No all-role shell.
- Define responsive rules:
  - PMCM desktop-first but usable on laptop.
  - Coordinator and guest phone-first.
  - Client/supplier responsive with action-first mobile views.

### Capability Maturity

Owner D leads:

- Expand `packages/ui` only for stable shared primitives.
- Keep role-specific workflow components in app packages until repeated use is proven.
- Add boundary tests for shared UI imports.
- Add visual QA checklist.
- Define fixtures for page states:
  - Empty
  - Loading
  - Error
  - No permission
  - First-time use
  - High-volume data
  - Overdue/urgent state

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Design system brief, component inventory, IA model, page template standards, UX writing rules. |
| Owner B | Apply shell/nav standards to `apps/event` skeleton without rewriting every page yet. |
| Owner C | Apply shell/nav standards to client/supplier/guest/public skeletons. |
| Owner D | Boundary tests, component ownership rules, fixture state matrix, build/typecheck verification. |

### Deliverables

- Design system brief.
- Navigation map for every app.
- Shared component extraction plan.
- Page state matrix.
- App shell redesign plan.
- Updated boundary checker if needed.

### Acceptance

- All apps have consistent navigation logic but retain role-specific IA.
- Shared UI remains presentation-only.
- No workflow logic is moved into `packages/ui`.
- Designers/developers can identify which template a page should use.

### Verification

- `npm run check:boundaries`
- `npm run typecheck`
- `npm run build`

## Phase 2: PMCM Command App Redesign

### Goal

Redesign `apps/event` as the operational center of P.R.I.S.M. PMCM should be able to see what needs attention, move across active events, operate each workflow, and trust that private/internal data stays inside the command app.

### Feature Scope

FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-08, FR-13, FR-14, FR-15, FR-17, FR-19, FR-20, FR-21, FR-22, FR-23, FR-52, FR-58, FR-60, FR-63, FR-75, FR-76, FR-78, FR-88, FR-89, FR-90, FR-96, FR-97, New-P2, New-P5, New-SY1, New-SY2, New-SY3.

### Experience Redesign

Owner B leads with Owner A:

#### PMCM Home

Redesign as a command board, not a landing dashboard.

Primary sections:

- Today and next 7 days
- Active event risk list
- New inquiries and pending conformes
- Supplier/coordinator gaps
- Billing/payment risk
- Live event-day status
- Pending approvals
- Privacy/security alerts

Expected interactions:

- Open event workspace
- Review inquiry
- Chase conforme
- Resolve supplier/coordinator gap
- Open finance issue
- Enter live-ops mode

#### Inquiry and Client Management

Redesign as a two-pane work queue:

- Left: inquiry/client list with filters.
- Right: selected record detail with timeline and actions.

Must support:

- Public inquiry review
- Log on behalf
- Send inquiry link
- Duplicate/previous rejection indicators
- Accepted/pending/declined decisions
- Conforme status
- Portal invitation state
- Client organization grouping future path

#### Event Workspace

Redesign as the main operational object.

Recommended IA:

- Overview
- Briefing and proposal
- Floorplans
- Suppliers
- Coordinators
- Files
- Finance
- Live ops
- Compliance
- Activity
- Closure

Each tab should have:

- Current state summary
- Required next action
- Blocking issues
- History/audit
- Related documents

#### PMCM Finance

Redesign as a ledger/workflow surface:

- Billing source
- Statement
- Payment schedule
- Payment history
- Disputes/corrections
- Additional billing
- Waivers
- Cancellation/postponement impact

#### PMCM Files

Redesign as event file hub:

- Categories
- Visibility
- Upload state
- Validation state
- Required/missing documents
- Source workflow

### Capability Maturity

Owner D and Owner A:

- Continue extracting app selectors/hooks/action handlers.
- Add event-scoped PMCM API reads where missing.
- Maintain audit/notification side effects.
- Add route-level permission checks.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | PMCM IA, page templates, status language, workflow action hierarchy, dense layout standards. |
| Owner B | Implement PMCM shell, command home, inquiry/client queue, event workspace IA, finance/files redesign surfaces. |
| Owner C | Validate client/supplier/guest boundary implications for PMCM actions that trigger portal state. |
| Owner D | PMCM API contracts, event-scoped endpoints, permission/audit tests, performance and build checks. |

### Deliverables

- Redesigned PMCM shell and navigation.
- Redesigned PMCM command home.
- Redesigned inquiry/client queue.
- Redesigned event workspace framework.
- Redesigned finance and file hub surfaces.
- PMCM action-handler extraction plan and first implementation slices.

### Acceptance

- PMCM users can identify the next operational action within 5 seconds on home and event workspace.
- Event workspace is organized by lifecycle, not by sample panels.
- PMCM-only data remains inaccessible from other apps.
- Large component growth is controlled by selectors, hooks, and feature components.

### Verification

- `npm --workspace @prism/event run typecheck`
- `npm run check:boundaries`
- `npm run build`
- Role-boundary manual checklist.

## Phase 3: Client Portal Redesign

### Goal

Redesign the client portal around clarity, confidence, and next actions. Clients should not feel like they are inside PMCM's internal tool.

### Feature Scope

FR-26, FR-27, FR-29, FR-32, FR-33, FR-34, FR-58, FR-60, FR-65, FR-66, New-CL1, New-CL2.

### Experience Redesign

Owner C leads with Owner A:

#### Client Home

Primary jobs:

- See active events.
- See required actions.
- See upcoming milestones.
- Start a new event request if allowed.
- View event history.

Avoid:

- PMCM operational terms.
- Too many dashboard cards.
- Internal risk/compliance detail.

#### Client Event Workspace

Recommended IA:

- Overview
- Required actions
- Briefing
- Proposal
- Floorplan
- Documents
- Billing
- Messages/activity

Each view should answer:

- What is the current state?
- What does PMCM need from me?
- What has PMCM already done?
- What is locked/read-only?

#### Floorplan Review

Must preserve:

- Client preference drafts are not official floorplans.
- Official floorplans are read-only.
- Client can approve or request revision/comment where supported.
- Approved plans are locked.

#### Documents

Client-facing file hub:

- Required uploads
- Submitted assets
- PMCM shared documents
- Rejected/needs-revision documents
- Visibility labels

### Capability Maturity

Owner D:

- Replace remaining broad state slices with scoped client APIs.
- Add document visibility permissions.
- Add client action audit/notification hooks.
- Add floorplan mutation regression tests.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Client portal IA, action language, client-safe status model, mobile rules. |
| Owner B | Ensure PMCM actions produce client-safe portal states. |
| Owner C | Implement client home, event workspace, documents, billing, floorplan review redesign. |
| Owner D | Scoped client endpoints, tests, file permissions, boundary checks. |

### Deliverables

- Redesigned client shell and event workspace.
- Scoped client data hooks.
- Client action center.
- Client document/file hub.
- Client-safe floorplan review.
- Billing/proposal state visibility.

### Acceptance

- Client cannot access PMCM internal CE, audit, private supplier reviews, private notes, or unrelated events.
- Client sees clear next actions.
- Client official floorplan view remains read-only.
- Client document submission routes to PMCM event file hub.

### Verification

- `npm --workspace @prism/client run typecheck`
- Client scoped API tests.
- Floorplan read-only regression.
- `npm run build`

## Phase 4: Supplier Portal and Supplier Network Redesign

### Goal

Redesign supplier workflows from application to event-day completion. The supplier portal should be focused, low-friction, and scoped to the supplier's own work.

### Feature Scope

FR-14, FR-15, FR-16, FR-17, FR-18, FR-35, FR-36, FR-37, FR-38, FR-49, FR-63, FR-64, FR-75, FR-76, FR-77, FR-78, FR-79, FR-87, New-S1, New-S2, New-S3, New-S4, New-S5, New-SUP1, New-SUP2, New-SUP3, New-SUP4.

### Experience Redesign

Owner C leads portal surfaces; Owner B leads PMCM supplier management.

#### Public Supplier Application

Workflow:

- Company profile
- Service category
- Portfolio/past events
- Certifications
- Price range
- Contact details
- Privacy consent
- Submitted confirmation
- Application status lookup

#### PMCM Supplier Applications Inbox

PMCM actions:

- Review
- Request proposal
- Schedule meeting
- Approve
- Decline
- Convert to supplier profile with Pending First Event

#### Supplier Portal Home

Primary jobs:

- See quote requests.
- Submit/revise quote.
- Confirm assignments.
- Submit contract metadata.
- Confirm readiness.
- Send event-day status.

#### PMCM Supplier Directory

Redesign to support:

- Category/tier view
- BNI flag
- Certifications
- Private PMCM reviews
- Reliability notes
- Pending First Event
- Past event performance
- Capacity/scale rating

### Capability Maturity

Owner D:

- Supplier application model.
- Supplier status tracking.
- Quote confidentiality rules.
- Contract upload metadata.
- Reliability trigger records.
- Supplier-scoped APIs.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Supplier UX patterns, application form design, supplier-safe language, PMCM directory IA. |
| Owner B | PMCM supplier directory, applications inbox, quote policy, reliability history, schedule view. |
| Owner C | Supplier public application, status page, portal quote/assignment/readiness/status flows. |
| Owner D | Supplier API/data, confidentiality tests, private-review leak tests, contract metadata model. |

### Deliverables

- Public supplier application and status page.
- PMCM applications inbox.
- Redesigned supplier directory.
- Supplier portal quote/assignment/readiness/event-day surfaces.
- Reliability history and Pending First Event lifecycle.

### Acceptance

- Supplier sees only own quotes, assignments, contracts, readiness, and status.
- PMCM private reviews remain PMCM-only.
- Confidential bid requests hide client-identifying information until bid win.

### Verification

- Supplier-scoped API tests.
- `npm --workspace @prism/supplier run typecheck`
- `npm --workspace @prism/event run typecheck`
- `npm run build`

## Phase 5: Coordinator Experience and Live-Ops Redesign

### Goal

Redesign coordinator and live-ops workflows for event-day pressure. Coordinators need role-specific simplicity; PMCM needs operational command.

### Feature Scope

FR-13, FR-88, FR-89, FR-90, FR-91, New-C1, New-C2, New-C3, New-C4, New-CO1, New-CO2, New-CO3, New-CO4, New-CO5, New-CO6.

### Experience Redesign

Owner B leads:

#### Coordinator Home

Phone-first list of assignments:

- Event name
- Date
- Venue
- Role
- Acknowledgment state
- Next action

#### Role Views

Each role gets a distinct operational layout:

- Floor/Stage Director: script, floorplan, call times, tasks, urgent issue.
- Registration Staff: guest search, check-in, walk-in, verification flag, attendance.
- Ingress/Egress Assistant: supplier schedule, setup status, verified toggle, photo notes.
- Event Day System Operator: full task dashboard, supplier status, coordinator check-in, urgent issues, reassignment.
- Usher/General Coordinator: simple instructions, assigned tasks, urgent issue.

#### PMCM Live-Ops View

Should show:

- Active tasks by SLA state
- Urgent issues
- Supplier readiness
- Coordinator attendance
- Guest attendance count
- Escalations
- Replacement controls
- Live log

### Capability Maturity

Owner D:

- Availability windows.
- Staffing requirements.
- Role-safe payloads.
- Assignment acknowledgment reminders.
- Replacement and reliability records.
- Escalation audit/notifications.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Coordinator role UX standards, phone-first task patterns, live-ops density model. |
| Owner B | Coordinator role views, PMCM live-ops command, replacement and reassignment UI. |
| Owner C | Validate guest/supplier data exposure in coordinator views. |
| Owner D | Role-safe API contracts, availability model, SLA/escalation/replacement tests. |

### Deliverables

- Redesigned coordinator home.
- Role-specific coordinator views.
- PMCM live-ops command redesign.
- Availability/staffing model.
- Reassignment and replacement workflow.
- Late/no-show reliability notes.

### Acceptance

- Coordinator roles see only relevant operational information.
- Registration role can see guest check-in data; other roles cannot unless required.
- PMCM can replace coordinators and see audit/reliability side effects.

### Verification

- Coordinator role access tests.
- Live-ops API tests.
- `npm --workspace @prism/event run typecheck`
- `npm run build`

## Phase 6: Guest, Public, and Lightweight Access Redesign

### Goal

Redesign public and guest experiences so low-friction external users can complete their tasks without account-heavy UI.

### Feature Scope

FR-39, FR-40, FR-41, FR-42, FR-46, FR-47, FR-48, FR-50, FR-51, FR-95, New-GU1, New-EX1, New-EX2.

### Experience Redesign

Owner C leads:

#### Public Inquiry

Needs:

- Clear PMCM/P.R.I.S.M signal.
- Structured inquiry fields.
- Referral source.
- Client type.
- Privacy consent.
- Optional spatial preference section later.
- Confirmation state.

#### Guest Access

Needs:

- Access-code entry.
- Event confirmation.
- Name-based check-in.
- Walk-in flow.
- Verification flag.
- Feedback flow.

#### Post-Event Feedback

Needs:

- Short rating/text/photo/video submission.
- Clear consent.
- Moderation expectation.
- No public auto-publish.

### Capability Maturity

Owner D:

- Masterlist import/reconciliation.
- Check-in mode configuration.
- Feedback moderation state.
- Ticket platform coordination records.
- HTTPS/QR readiness gate.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Public/guest UX pattern, low-friction form standards, mobile-first states. |
| Owner B | PMCM moderation and registration command surfaces. |
| Owner C | Public inquiry, guest access, check-in, feedback, supplier public application coordination. |
| Owner D | Guest APIs, moderation model, access-code tests, QR/HTTPS readiness gate. |

### Deliverables

- Redesigned public inquiry.
- Guest access redesign.
- Check-in modes.
- Walk-in verification.
- Feedback moderation queue.
- Ticket platform coordination record.
- QR scanning deferred until readiness gate is met.

### Acceptance

- Guest access is scoped by access code.
- Guest feedback is moderated and never auto-published.
- Public pages do not route directly into dashboards.

### Verification

- Guest API tests.
- Public route regression.
- `npm --workspace @prism/guest run typecheck`
- `npm --workspace @prism/client run typecheck`
- `npm run build`

## Phase 7: Core Workflow Maturity Across Apps

### Goal

After the app redesign foundations are stable, deepen the core lifecycle workflows so they are operationally complete.

### Feature Scope

FR-01 through FR-08, FR-13, FR-19 through FR-23, FR-26 through FR-34, FR-52, FR-58, FR-60, FR-63, FR-75, FR-88 through FR-90, FR-96, FR-97, New-CL1, New-P2, New-P5, New-SY1, New-SY2, New-SY3.

### Capability Areas

- Inquiry and onboarding.
- Conforme and portal activation.
- Briefing and proposal lifecycle.
- Event workspace status model.
- Compliance rules and override audit.
- Floorplan snapshots and review.
- Supplier assignment readiness.
- Coordinator acknowledgment.
- Billing and payment risk.
- Event-day status.
- Closure gates.

### Owner Work Packages

| Owner | Work package |
| --- | --- |
| Owner A | Cross-app workflow maps and UX consistency checks. |
| Owner B | PMCM workflow depth in event workspace and live ops. |
| Owner C | Client/supplier/guest workflow depth and scoped reads. |
| Owner D | API consistency, audit side effects, notification hooks, tests. |

### Deliverables

- End-to-end lifecycle map.
- Scoped APIs for remaining broad state areas.
- Consistent workflow status model.
- Role-specific next-action model.
- Audit and notification side effects for key actions.

### Acceptance

- Every active event has a traceable lifecycle state.
- Every persona sees the right next action.
- No workflow depends on UI-only permission checks.

### Verification

- End-to-end API tests for lifecycle.
- Role-boundary regression.
- `npm run typecheck`
- `npm run build`

## Phase 8: Finance and Commercial Workflow Redesign

### Goal

Make finance understandable, auditable, and separated from PMCM internal costing where client access exists.

### Feature Scope

FR-19, FR-20, FR-21, FR-59, FR-60, FR-61, FR-62, FR-67, FR-68, FR-69, FR-92, FR-93, FR-94, FR-96, FR-97, New-P5, New-SY4.

### Experience Redesign

Owner B and Owner A:

- PMCM CE builder.
- Proposal source record.
- Billing statement generation.
- Payment schedule.
- Payment history.
- Corrections.
- Disputes.
- Additional billing.
- Waiver reason.
- Cancellation/postponement summary.

Owner C:

- Client-safe proposal and billing views.
- Payment milestone visibility.
- Dispute/correction status.

### Capability Maturity

Owner D:

- Source-linked finance records.
- Configurable payment terms.
- Fixed downpayment rule.
- Override audit.
- Dispute/correction data model.
- Additional billing and waiver data model.

### Deliverables

- Redesigned PMCM finance workspace.
- Client billing/proposal review redesign.
- CE/proposal source of truth.
- Payment dispute/correction workflow.
- Cancellation/postponement financial summary.
- Additional billing and waiver workflow.

### Acceptance

- Billing statements can be explained from source records.
- Corrections and waivers have audit metadata.
- Client sees only client-safe financial information.

### Verification

- Finance API tests.
- `npm --workspace @prism/event run typecheck`
- `npm --workspace @prism/client run typecheck`
- `npm run build`

## Phase 9: Closure, Archive, Knowledge, and Learning Loop

### Goal

Make event closure a structured learning and archive workflow, not just an end state.

### Feature Scope

FR-22, FR-23, FR-41, New-P1, New-P2, New-P3, New-P4, New-SY1, New-SY2.

### Experience Redesign

Owner B:

- Post-event wrap-up.
- One-screen close.
- Close gate indicators.
- Archive search.
- Event comparison.
- Event insights.
- Logistics booking.
- Private PMCM notes.

Owner C:

- Client acknowledgement.
- Testimonial request.
- Feedback submission state.

### Capability Maturity

Owner D:

- Archive indexes.
- Close gate records.
- Testimonial records.
- Logistics records.
- Insights source aggregation.
- Retention implications.

### Deliverables

- Post-event wrap-up screen.
- One-screen close.
- Archive search.
- Event comparison.
- Event insights card.
- Client testimonial feature.
- Logistics booking record.

### Acceptance

- Events cannot be archived without green close gates or documented override.
- Archived events are searchable.
- Comparison view uses normalized event records.
- PMCM private notes stay private.

### Verification

- Close/archive API tests.
- Search/compare tests.
- `npm --workspace @prism/event run typecheck`
- `npm run build`

## Phase 10: Platform Services, Notifications, Upload Storage, and Integrations

### Goal

Move from sample infrastructure to adapter-backed services that fail safely and can be audited.

### Feature Scope

FR-25, FR-55, FR-59, FR-61, FR-64, FR-76, New-SEC3.

### Experience Redesign

Owner A:

- Notification preference patterns.
- Delivery state language.
- Upload progress/error patterns.
- Integration status surfaces.

Owner B:

- PMCM notification center.
- PMCM upload/storage visibility.
- Integration status panels.

Owner C:

- Portal notification preferences.
- Portal-safe upload states.

### Capability Maturity

Owner D:

- Email adapter.
- Viber adapter.
- Queue retry policy.
- Delivery audit.
- Storage abstraction.
- Signed URLs.
- Upload validation.
- Canva/PowerPoint/Zoom integration shells.

### Deliverables

- Production adapter interfaces.
- Notification retry and delivery audit.
- Bilingual templates.
- Real storage abstraction.
- Signed file access.
- Integration shells where credentials exist.

### Acceptance

- Provider failures do not corrupt workflow state.
- Files are validated and permissioned.
- Delivery attempts are auditable.

### Verification

- Adapter tests with fake providers.
- Upload validation tests.
- `npm run typecheck`
- `npm run build`

## Phase 11: Security, Privacy, and Production Auth Redesign

### Goal

Make privacy and security visible, operable, and production-shaped before live AI or broader external use.

### Feature Scope

New-SEC1, New-SEC2, New-SEC3, New-SEC4, FR-56, FR-AI-ZDR foundation.

### Experience Redesign

Owner A:

- Security/privacy console IA.
- Consent UX patterns.
- Privacy request UX.
- Audit state language.

Owner B:

- PMCM privacy/security console.
- Audit integrity view.
- Retention/legal hold controls.

Owner C:

- Portal privacy notices.
- User-facing privacy request entry.
- Session/account states.

### Capability Maturity

Owner D:

- Production auth decision.
- PMCM 2FA.
- Password reset.
- Session expiry.
- Retention calendars.
- Legal hold.
- Document-specific redaction.
- Audit-chain verification.

### Deliverables

- Production auth decision record.
- PMCM 2FA flow.
- Password reset/session controls.
- Privacy request workflows.
- Retention calendar.
- Legal hold handling.
- Document redaction.
- Audit-chain hardening.

### Acceptance

- PMCM can handle access, correction, deletion, and export requests.
- Audit rows remain append-only in normal workflows.
- Production auth requirements are explicit.
- Live AI remains blocked until this phase is complete.

### Verification

- Security/privacy API tests.
- Audit-chain tamper tests.
- Role-boundary regression.
- `npm run typecheck`
- `npm run build`

## Phase 12: AI and Agentic Layer Redesign

### Goal

Add AI after the product has the governance, audit, approval, and UX surfaces required to use it safely.

### Feature Scope

FR-AI-01, FR-AI-03, FR-AI-04, FR-AI-04b, FR-AI-05, FR-AI-06, FR-AI-07, FR-AI-08, FR-AI-09, FR-AI-ZDR.

### Experience Redesign

Owner A:

- AI interaction model.
- Approval queue UX.
- AI confidence/explanation patterns.
- Human-review language.
- Safe output presentation rules.

Owner B:

- PMCM AI triage review.
- POA assistant.
- PARE approval flow.
- Event-day copilot review.
- PEIL review.
- Communication assistant review.

Owner C:

- Only approved AI outputs in portals.
- No direct raw AI-to-client/supplier/guest output.

### Capability Maturity

Owner D:

- Provider abstraction.
- ZDR verification record.
- DataSanitizer enforcement.
- AI audit records.
- Approval records.
- Prompt/input contracts.
- Deterministic fallback behavior.
- AI risk register.

### Deliverables

- ZDR/provider verification.
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

### Acceptance

- No AI feature runs without ZDR/provider approval.
- No AI action executes without PMCM approval.
- Raw AI output is never sent directly outside PMCM review.
- AI audit records include model version, data categories, sanitizer status, ZDR confirmation, and approval state.

### Verification

- Sanitizer redaction tests.
- AI audit tests.
- Human approval gate tests.
- Prompt privacy review.
- `npm run typecheck`
- `npm run build`

## Cross-Phase Operating Cadence

Each phase should run with four coordinated branches:

- `codex/phase-N-product-ux`
- `codex/phase-N-pmcm-coordinator`
- `codex/phase-N-portals`
- `codex/phase-N-api-platform`

Recommended sequence inside a phase:

1. Maxine drafts the UX brief and page/workflow acceptance criteria.
2. Anthony drafts API contracts, fixture shapes, data model changes, and test expectations.
3. Francis and Ethan implement app surfaces in parallel against stable contracts or typed fixtures.
4. Anthony runs role-boundary, API, build, and regression verification.
5. Maxine reviews visual consistency and UX completeness.
6. Docs and feature ledger are updated before merge.

Every branch or work package should include:

- Owner label.
- Owner system goal advanced.
- Workflow or app surface changed.
- API/data contracts changed.
- Permission boundary affected.
- Audit/notification/file/lifecycle side effects affected.
- Verification evidence.

## Branch Merge Strategy

Preferred merge order:

1. Product/UX and API contract docs.
2. API/data changes.
3. PMCM/coordinator app changes.
4. Portal app changes.
5. QA/docs finalization.

When PMCM and portal app work can happen independently, both may proceed in parallel after DTOs and permission rules are stable.

## Whole-App Definition of Done

For any phase:

- Each owner can point to the system goal they advanced and the evidence that it is true in the product.
- Feature ledger updated.
- Redesign inventory updated.
- Page/workflow acceptance criteria met.
- Role boundaries verified.
- Focused tests pass.
- `npm run typecheck` passes.
- `npm run build` passes before final merge.
- `npm run check:boundaries` passes.
- No semantic old product-name references are introduced.
- Public pages do not link directly to dashboards.
- Clients cannot mutate official floorplans.
- PMCM-only data stays PMCM-only.
- Empty, loading, error, no-permission, and high-volume states are accounted for.

## Design QA Checklist

Owner A should apply this before any redesigned surface merges:

- Does the page have one clear primary job?
- Is the next action visible without reading every panel?
- Is the density appropriate for the user's context?
- Is the page using a known P.R.I.S.M template?
- Are cards used only where they clarify repeated items or framed tools?
- Are status labels consistent with the lifecycle?
- Are destructive actions gated and explained?
- Are empty states useful?
- Are errors recoverable?
- Does the mobile/laptop layout preserve critical functionality?
- Does the page avoid decorative eyebrow pills, active underline nav, nested cards, and generic dashboard filler?

## Technical QA Checklist

Owner D should apply this before any phase merges:

- API route has role-aware scope.
- Response shape is typed in shared contracts or app-local types.
- Side effects are audited where required.
- Notifications are queued rather than sent directly when applicable.
- File uploads validate metadata and permissions.
- Privacy consent is captured for public personal-data writes.
- Tests cover forbidden role access.
- Boundary checker passes.
- Build and typecheck pass.
- Docs reflect current implementation state.

## Immediate Next Implementation Plan

Phase 0 and the redesign readiness foundation are complete. The active Phase 0/readiness documents are:

1. `docs/prism-v4/11-feature-ledger.md` for feature-family decisions, owners, phase placement, boundaries, audit needs, UX surfaces, and verification requirements.
2. `docs/prism-v4/12-redesign-inventory.md` for app and route redesign severity.
3. `docs/prism-v4/13-docs-cleanup-checklist.md` for canonical docs, retired artifacts, and verification commands.
4. `docs/prism-v4/14-redesign-readiness-foundation.md` for sample-state fencing, session conventions, owner boundaries, scoped-contract direction, and legacy removal before redesign branches.
5. `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md` for the one-week kickoff sprint and three two-week sprints through July 31, 2026.

The old standalone UI modernization plan has been retired because its named deliverables exist and future redesign work should flow through this capability maturity plan. The next implementation work should start at Phase 1 design system and shell foundation, using the Phase 0 ledger, route inventory, and readiness foundation as inputs. Do not reopen Phase 0 unless docs drift, route ownership changes, or a redesign branch exposes a missing contract that belongs in the readiness handoff.

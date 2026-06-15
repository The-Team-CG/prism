# P.R.I.S.M Redesign Agile Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the completed redesign readiness foundation into an actionable sprint calendar through July 31, 2026. This includes the whole-app redesign and the partial, planned, or otherwise unfinished feature families from the feature ledger.

**Architecture:** This plan divides the redesign into one short kickoff sprint and three two-week delivery sprints. Maxine owns product UX/design system, Francis owns the PMCM/coordinator event app, Ethan owns external portals, and Anthony owns API/platform/contracts/QA/docs. Work proceeds only when the required contract, owner, feature family, and verification gates are explicit. By July 31, every incomplete feature family must be either delivered as a scoped working slice, documented as a gated/post-July item with a named blocker, or intentionally cut from the demo path.

**Tech Stack:** Next.js role apps in `apps/client`, `apps/event`, `apps/supplier`, and `apps/guest`; NestJS API in `apps/api`; shared contracts in `packages/types` and `packages/api-client`; shared UI in `packages/ui`; canonical docs in `docs/prism-v4` and `docs/superpowers`.

---

## Calendar

| Sprint | Dates | Working shape | Sprint outcome |
| --- | --- | --- | --- |
| Sprint 0 | June 15-20, 2026 | One-week kickoff and alignment sprint | Four owners can start Phase 1 from the same shell patterns, surface priorities, scoped contracts, and demo criteria. |
| Sprint 1 | June 22-July 3, 2026 | Two-week foundation delivery sprint | Shared shell/design foundations and the first PMCM command surface are implemented behind verified boundaries. |
| Sprint 2 | July 6-July 17, 2026 | Two-week workflow depth sprint | PMCM event workspace, client action center, supplier readiness, and guest pass/check-in workflows are made coherent against scoped contracts. |
| Sprint 3 | July 20-July 31, 2026 | Two-week stabilization and demo-readiness sprint | Core redesigned surfaces are integrated, QA'd, documented, screenshotted, and ready for defense/demo review. |

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

## Incomplete Feature Backlog Coverage

This table is the sprint-level cutline for all ledger items that are live/partial, partial, planned, or newly proposed. It keeps the July 31 scope honest: not every item must become fully production-complete by July 31, but every item must have a real owner decision and an implementation or gate.

| Feature family | Current state | Primary owners | Sprint target | July 31 outcome |
| --- | --- | --- | --- | --- |
| FL-001 Inquiry intake and triage | Live/partial | Francis, Ethan, Anthony | Sprint 1-2 | Public inquiry remains live; PMCM log-on-behalf, referral filtering, and triage state are either implemented as a thin slice or documented as the first post-July PMCM intake task. |
| FL-002 Onboarding and conforme gate | Live/partial | Francis, Ethan, Anthony | Sprint 1-2 | Accepted inquiry -> signed conforme -> portal access remains the enforced lifecycle gate; per-event reminder policy and visible awaiting/sent/opened/expired states are scoped. |
| FL-003 PMCM command dashboard | Partial | Maxine, Francis, Anthony | Sprint 1 | Event Command Inbox and selected-event summary become the first redesigned PMCM operating surface, with remaining finance/files/closure/live-ops sections split into later slices. |
| FL-004 Client portal after conforme | Partial | Maxine, Ethan, Anthony | Sprint 1-2 | Client Action Center is the primary portal slice; remaining broad state usage for briefings, activity, floorplan drafts, documents, and billing is reduced or logged as compatibility-only. |
| FL-005 Proposal, briefing, and commercial workflow | Partial | Francis, Ethan, Anthony | Sprint 2-3 | Briefing/proposal status is visible in PMCM and client-safe views; deep commercial generation and full CE/proposal source-of-truth work can continue post-July if contracts are not ready. |
| FL-006 Document and file operations | Partial | All owners | Sprint 1-3 | File Requirements Matrix is represented in PMCM/client UX and typed contracts; real upload storage remains gated unless Anthony confirms adapter/storage readiness. |
| FL-007 Supplier network operations | Live/partial | Francis, Ethan, Anthony | Sprint 2 | Supplier readiness board covers quote requests, assignments, readiness, contract metadata, and event-day status; supplier application/status tracking is scoped as MVP or post-July. |
| FL-008 Coordinator and staffing operations | Partial | Francis, Anthony | Sprint 2 | Coordinator roster, availability/staffing gaps, assignment acknowledgement, and role-safe task payloads are represented in PMCM live-ops or explicitly deferred with tests/contract gaps listed. |
| FL-009 Compliance, risk, and change control | Live/partial | Francis, Anthony | Sprint 2-3 | Risk/change register and compliance condition visibility are present in PMCM; richer condition evaluation and seven-day recheck may remain post-July with a named gate. |
| FL-010 Billing and payments | Partial | Francis, Ethan, Anthony | Sprint 2-3 | Client-safe billing/payment milestone visibility and PMCM dispute/correction/additional billing states are scoped; full configurable payment terms can remain post-July if data model work is too large. |
| FL-011 Floorplan and spatial workflow | Live/partial | Francis, Ethan, Anthony | Sprint 2 | Official floorplan control remains PMCM-only; client preference/comment flow stays read-only against official layouts; table assignment eligibility rules are scoped. |
| FL-012 Guest and lightweight access | Partial | Ethan, Anthony | Sprint 2 | Guest access-code entry, consent, check-in state, and moderated feedback are improved; QR/camera scanning stays gated unless HTTPS/masterlist readiness is confirmed. |
| FL-013 Closure, archive, and learning loop | Partial | Francis, Ethan, Anthony | Sprint 3 | Closure/readiness evidence appears in the demo path; testimonial request and archive search get a scoped slice, while rich event comparison can remain post-July. |
| FL-014 Notifications and communications | Partial | Ethan, Anthony | Sprint 3 | Notification queue/outbox state is visible where useful; production SendGrid/Viber adapters remain gated behind environment, retry, audit, and privacy readiness. |
| FL-015 Security, privacy, and audit | Partial | Anthony | Sprint 3 | Privacy/audit cues, retention/legal-hold decisions, and redaction gaps are documented; external auth and full privacy operations console remain gated unless separately approved. |
| FL-016 Shared design system and shell | Partial | All owners | Sprint 1 | Shared shell/page patterns, presentation-only component candidates, state language, and banned-pattern checks are applied to the first PMCM and portal surfaces. |
| FL-017 Event Command Inbox | Planned/add | Maxine, Francis, Anthony | Sprint 1 | Delivered as the first PMCM command-surface slice. |
| FL-018 Event Health Score | Planned/add | Maxine, Francis, Anthony | Sprint 3 | Implement only as an explainable readiness/status summary if source signals already exist; otherwise document as post-July. |
| FL-019 Decision Log | Planned/add | Francis, Anthony | Sprint 3 | Add a scoped PMCM decision/audit surface if backed by existing audit records; otherwise keep as post-July audit UX. |
| FL-020 Client Action Center | Planned/add | Maxine, Ethan, Anthony | Sprint 1 | Delivered as the first client portal redesign slice. |
| FL-021 PMCM Handoff Brief | Planned/add | Francis, Anthony | Sprint 2-3 | Produce a selected-event handoff/readiness summary if contracts already expose enough data; otherwise document contract gaps. |
| FL-022 Supplier Readiness Board | Planned/add | Maxine, Francis, Ethan, Anthony | Sprint 2 | Delivered as the supplier portal/PMCM supplier readiness slice. |
| FL-023 Coordinator Staffing Heatmap | Planned/add | Maxine, Francis, Anthony | Sprint 2-3 | Implement only if assignment/availability data is ready; otherwise ship roster/availability gap list as the July slice. |
| FL-024 File Requirements Matrix | Planned/add | All owners | Sprint 1-3 | Establish typed matrix/status model and show it in PMCM/client surfaces; full storage adapter work remains gated. |
| FL-025 Risk and Change Register | Planned/add | Francis, Anthony | Sprint 2-3 | Deliver a PMCM-scoped register slice for active risks, changes, overrides, and audit references. |
| FL-026 Event Day Run Sheet | Planned/add | Francis, Anthony | Sprint 3 | Deliver a demo-ready event-day run sheet only if live-ops data is stable; otherwise document it as the first post-July live-ops slice. |
| FL-027 Privacy Operations Console | Planned/add | Anthony | Sprint 3 | Document privacy operations states and minimal audit/retention visibility; full console is post-July unless security scope is approved. |
| FL-028 Workflow Template Builder | Planned/add | Maxine, Francis, Anthony | Post-July | Keep out of July implementation. Capture template-builder requirements during Sprint 3 only if they fall out of real workflow stabilization. |

## July 31 Must-Land Cutline

- [ ] One coherent demo path works through public inquiry, PMCM command, client action center, supplier readiness, guest access/check-in, and closure/readiness evidence.
- [ ] FL-003, FL-004, FL-016, FL-017, FL-020, and FL-022 have working redesigned slices, not just documentation.
- [ ] FL-001, FL-002, FL-006, FL-007, FL-011, FL-012, FL-013, FL-014, and FL-015 have either working MVP slices or explicit gates in the feature ledger.
- [ ] FL-005, FL-008, FL-009, FL-010, FL-018, FL-019, FL-021, FL-023, FL-024, FL-025, FL-026, and FL-027 have scoped July slices only when the underlying contracts are ready; otherwise they must be documented as named post-July work.
- [ ] FL-028 stays post-July unless all owners agree it is only being documented, not built.
- [ ] Gated capabilities stay gated unless their prerequisites are met: live AI, QR/camera scanning, production notification adapters, external auth, real file storage, full archive comparison, and workflow template building.

## Sprint 0: June 15-20, 2026

### Sprint Goal

Turn readiness into execution inputs: named owner responsibilities, exact sprint surfaces, agreed shell patterns, API contract gaps, and demo criteria. No broad visual redesign starts until each owner has a thin, reviewable target.

### Owner Tasks

#### Maxine: Product UX and Shell Direction

- [ ] Review `docs/prism-v4/12-redesign-inventory.md` and pick the first redesigned surface template for each app: PMCM command, client action center, supplier readiness, and guest access.
- [ ] Review every row in the Incomplete Feature Backlog Coverage table and mark each July 31 outcome as "working slice", "documented gate", or "post-July".
- [ ] Draft a one-page shell pattern note in `docs/prism-v4/12-redesign-inventory.md` covering page hierarchy, navigation behavior, status language, loading/empty/error states, and banned visual patterns.
- [ ] Define the shared component candidates for Sprint 1: app header, section header, work queue row, status timeline, metric tile, notice banner, empty state, and command/action panel.
- [ ] Produce a review checklist for redesigned pages: primary job, next action, role boundary, lifecycle status, mobile fit, no nested cards, no decorative eyebrow pills, no active underline nav.

#### Francis: PMCM Event App Slice Definition

- [ ] Review `apps/event/src/app/dashboard/EventDashboardClient.tsx` and extracted modules under `apps/event/src/app/components/pmcm` and `apps/event/src/features/event-dashboard`.
- [ ] Choose the Sprint 1 PMCM surface: Event Command Inbox plus selected-event summary.
- [ ] Identify which unfinished PMCM features must appear in the July demo path: inquiry triage, PMCM command, supplier readiness, coordinator/live-ops, billing, risk/change, floorplan, closure, and audit/privacy cues.
- [ ] List the event app sections that remain too coupled for Sprint 1: finance, files, closure/archive, coordinator replacement, live-ops board, and settings.
- [ ] Create acceptance notes for the PMCM slice: PMCM-only visibility, selected event remains stable, command actions are route-safe, and loading states do not flash incorrect role data.

#### Ethan: Portal Slice Definition

- [ ] Review `apps/client`, `apps/supplier`, and `apps/guest` route inventory from `docs/prism-v4/12-redesign-inventory.md`.
- [ ] Choose one thin Sprint 1 portal surface: client action center shell with safe event status and next actions.
- [ ] Identify which unfinished portal features must appear in the July demo path: client action center, client-safe documents/billing/floorplan summary, supplier readiness, supplier application/status, guest access/check-in, and moderated feedback.
- [ ] List Sprint 2 portal surfaces: supplier readiness board, guest access/check-in, client event workspace documents/billing/floorplan summary.
- [ ] Create portal acceptance notes: no PMCM-only data, no official floorplan editing from client, supplier sees only assigned/application-scoped records, guest stays access-code scoped.

#### Anthony: Contracts, Guards, and Environment Readiness

- [ ] Verify `npm run check:boundaries` and `node --test scripts\check-prism-boundaries.test.mjs` still pass after the calendar doc is added.
- [ ] Document the local database blocker and exact recovery command in `docs/prism-v4/14-redesign-readiness-foundation.md`: `npm --workspace prism-api run db:doctor:runtime`.
- [ ] Translate incomplete feature rows from `docs/prism-v4/11-feature-ledger.md` into the Sprint 1-3 contract/test cutline, especially files, notifications, privacy, floorplan eligibility, guest access, supplier readiness, and billing.
- [ ] Identify missing typed response shapes needed by Sprint 1: PMCM command summary, selected-event summary, client action card, shared status vocabulary.
- [ ] Define the Sprint 1 verification baseline: `npm --workspace @prism/types run typecheck`, `npm --workspace @prism/api-client run typecheck`, app typecheck for touched apps, API focused tests for touched controllers/services, `git diff --check`.

### Sprint 0 Review Output

- [ ] Updated owner names in `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md`.
- [ ] Updated owner names in `docs/prism-v4/14-redesign-readiness-foundation.md`.
- [ ] This agile calendar committed or ready to commit.
- [ ] Incomplete feature backlog cutline is reviewed and any disputed item is moved to the feature ledger with a named owner, gate, and next action.
- [ ] Sprint 1 backlog is small enough for four people to complete in two weeks without each person owning more than one primary surface.

### Sprint 0 Scope Cuts

- Do not redesign every dashboard route.
- Do not introduce external auth.
- Do not replace the floorplan editor internals.
- Do not add production notification adapters.
- Do not start QR scanning.

## Sprint 1: June 22-July 3, 2026

### Sprint Goal

Implement the first reusable design and workflow foundation: shared shell rules, first PMCM command surface, first client action-center slice, and verified API/client contract paths.

### Owner Tasks

#### Maxine: Shared Shell and UX Foundation

- [ ] Create the Sprint 1 UX brief in `docs/prism-v4/12-redesign-inventory.md` with the selected shell pattern, density rules, page title rules, action hierarchy, and state language.
- [ ] Inventory existing shared UI exports from `packages/ui` and identify which components can be reused without moving workflow logic into the package.
- [ ] Define shared visual standards for app shell, page header, section panel, status badge, metric tile, and action queue row.
- [ ] Make sure FL-016 shared shell patterns are expressed through real Sprint 1 surfaces: FL-017 Event Command Inbox and FL-020 Client Action Center.
- [ ] Review Francis and Ethan surfaces before merge for role-specific language, scan density, mobile behavior, and banned visual patterns.

#### Francis: PMCM Command Surface

- [ ] Move the command inbox surface into a focused component if it still depends on broad renderer state.
- [ ] Implement or wire the FL-017 Event Command Inbox slice using scoped PMCM data and safe selected-event actions.
- [ ] Include a thin FL-001/FL-002 intake and conforme status view if the current event command data supports it; otherwise document the exact missing contract.
- [ ] Make selected-event summary use `PrismPmcmEventWorkspace` wherever the contract already covers the needed data.
- [ ] Keep fallback filtering only where the scoped workspace does not yet cover a tab, and label it in code as compatibility-only.
- [ ] Verify PMCM routes `/dashboard`, `/dashboard/events`, and one selected event workspace route render without cross-role data leaks.

#### Ethan: Client Action Center Thin Slice

- [ ] Make the client dashboard entry prioritize `PrismClientActionCenter` action cards over broad workspace-derived cards.
- [ ] Implement or wire the FL-020 Client Action Center slice with conforme, briefing/proposal, file, billing, floorplan preference, and next-action status cards where contracts already exist.
- [ ] Redesign the client top section around one primary job: "what needs my attention next".
- [ ] Keep official floorplans read-only and client floorplan input as preferences/comments only.
- [ ] Verify `/`, `/inquiry`, `/sign-in`, and `/dashboard` preserve the public-to-signed-in boundary.

#### Anthony: Contracts and Verification

- [ ] Add or tighten tests around PMCM command inbox read shape, client action center read shape, and forbidden role access if a contract changes.
- [ ] Update `packages/types` and `packages/api-client` before app code depends on new fields.
- [ ] Establish FL-024 File Requirements Matrix types or a documented contract gap before file/document UI depends on matrix states.
- [ ] Run verification for every touched package and app.
- [ ] Update `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/12-redesign-inventory.md`, and `docs/prism-v4/14-redesign-readiness-foundation.md` with Sprint 1 results.

### Sprint 1 Acceptance

- [ ] PMCM command surface is visibly more focused and still PMCM-only.
- [ ] Client action center has a clear next-action hierarchy and does not expose PMCM internals.
- [ ] Shared UI work stays presentation-only.
- [ ] FL-017 and FL-020 are real working slices, and FL-001, FL-002, FL-006, and FL-024 have a working slice or a documented gate.
- [ ] Boundary checks catch forbidden broad sample-state and magic storage-key coupling.
- [ ] Sprint 1 demo can show one PMCM flow and one client flow.

### Sprint 1 Verification

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

## Sprint 2: July 6-July 17, 2026

### Sprint Goal

Deepen the main role workflows: PMCM selected-event workspace, supplier readiness, guest access/check-in, and client event workspace summaries. Each workflow should consume scoped contracts wherever available.

### Owner Tasks

#### Maxine: Cross-App Workflow Consistency

- [ ] Create workflow maps for inquiry to conforme, selected event planning, supplier readiness, and guest check-in.
- [ ] Normalize status labels across PMCM, client, supplier, and guest surfaces so the same lifecycle states do not use conflicting language.
- [ ] Review FL-007, FL-008, FL-011, FL-012, FL-022, FL-023, and FL-025 for consistent readiness, risk, assignment, and access language.
- [ ] Review mobile layouts for supplier and guest surfaces, especially event-day status and check-in actions.
- [ ] Define empty/error/no-permission copy for each role surface touched in Sprint 2.

#### Francis: Selected Event Workspace Depth

- [ ] Split one additional selected-event workspace area from `EventDashboardClient.tsx` into a focused route/component if it remains inline.
- [ ] Prioritize live operations/readiness, files/documents, or billing/closure based on which has the clearest scoped data.
- [ ] Add the PMCM side of FL-007 Supplier Readiness Board, FL-008 coordinator/staffing operations, FL-009 Risk and Change Register, or FL-011 floorplan eligibility based on which contract is ready first.
- [ ] Preserve PMCM-only controls for official floorplans, supplier decisions, audit, and closure overrides.
- [ ] Verify selected-event refresh does not regress command inbox or event list behavior.

#### Ethan: Supplier and Guest Portal Depth

- [ ] Redesign supplier dashboard top section around quote requests, assignments, readiness, contract metadata, and event-day statuses.
- [ ] Implement the portal side of FL-022 Supplier Readiness Board and scope supplier application/status tracking as an MVP or post-July item.
- [ ] Keep supplier data scoped to the logged-in supplier or quote token.
- [ ] Redesign guest `/open` and `/dashboard` around event-code entry, consent, check-in state, and moderated feedback.
- [ ] Implement the FL-012 guest access/check-in slice without QR/camera scanning.
- [ ] Keep QR scanning and media upload gated; do not implement camera flows in Sprint 2.
- [ ] Add a client event summary polish pass only after supplier and guest flows have working states.

#### Anthony: Scoped APIs and Policy Tests

- [ ] Add or harden supplier readiness/read model tests for assigned records only.
- [ ] Add or harden guest access-code tests for valid pass, invalid pass, check-in write, and feedback moderation state.
- [ ] Add or harden contract/test coverage for whichever FL-008, FL-009, FL-010, FL-011, FL-023, or FL-025 slice is pulled into Sprint 2.
- [ ] Add event workspace contract coverage for whichever Francis surface moves deeper in Sprint 2.
- [ ] Keep `/api/sample/state` as seed/demo/reset only and reject new normal app dependencies on it.

### Sprint 2 Acceptance

- [ ] One selected-event workspace area is easier to redesign independently.
- [ ] Supplier readiness and event-day status are clearer and scoped.
- [ ] Guest access/check-in is lightweight, consent-aware, and event-code scoped.
- [ ] Client event summary changes do not grant floorplan edit access.
- [ ] FL-007, FL-011, FL-012, and FL-022 have working July slices; FL-008, FL-009, FL-010, FL-023, and FL-025 are either working slices or explicitly gated.
- [ ] Tests cover the highest-risk role boundaries touched in the sprint.

### Sprint 2 Verification

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

## Sprint 3: July 20-July 31, 2026

### Sprint Goal

Stabilize the redesigned surfaces for review: finish priority fixes, run route-by-route QA, capture evidence, update docs, and prepare a defensible demo story.

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
- [ ] Verify supplier and guest mobile states for the core flows selected in Sprint 2.
- [ ] Prepare portal demo notes for client next actions, supplier readiness/status, and guest access/check-in.

#### Anthony: QA, Evidence, and Release Readiness

- [ ] Run the full relevant verification sweep for touched apps and packages.
- [ ] Complete the feature-ledger closeout for every incomplete row: delivered, gated, deferred, or post-July, with owner and verification evidence.
- [ ] Add the July scope decision for FL-014 notifications, FL-015 security/privacy/audit, and FL-027 privacy operations console.
- [ ] Run route-by-route smoke checks for known demo paths. Use Browser or Playwright where local database config permits; otherwise capture the explicit database-unavailable behavior.
- [ ] Capture screenshots for demo-ready surfaces with `scripts/capture-prism-feature-pages.mjs` after local database configuration is healthy.
- [ ] Update `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/12-redesign-inventory.md`, `docs/prism-v4/13-docs-cleanup-checklist.md`, and `docs/prism-v4/14-redesign-readiness-foundation.md`.
- [ ] Confirm `git status --short --branch` is clean after final commit and push.

### Sprint 3 Acceptance

- [ ] Each owner can point to the system goal they advanced and the evidence that it is true in the product.
- [ ] Demo path covers one coherent lifecycle story instead of disconnected screens.
- [ ] No known role-boundary regression remains.
- [ ] No new broad sample-state dependency remains outside documented compatibility paths.
- [ ] Every partial/planned feature family is accounted for as delivered, gated, deferred, or post-July.
- [ ] Screenshots and docs match the current implementation.
- [ ] Post-July items are explicitly listed instead of hidden as unfinished sprint work.

### Sprint 3 Verification

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

## Recommended Changes Before Sprint 1 Starts

1. **Fix local API database configuration.** The current local authenticated browser checks are blocked when Prisma cannot reach the configured database. Anthony should make `npm --workspace prism-api run db:doctor:runtime` green or document the exact environment variable correction before Sprint 1 demo work depends on live sample auth.
2. **Approve the feature cutline.** All owners should review the Incomplete Feature Backlog Coverage table and decide which items are July working slices, which are gates, and which are post-July. This prevents hidden unfinished work from being mistaken for completed redesign.
3. **Choose one PMCM and one portal demo path.** Francis and Ethan should not redesign every route in parallel. Sprint 1 should show one PMCM command path and one client action path end to end.
4. **Keep Phase 1 narrower than the full visual redesign.** Maxine should define shell/page patterns and review first surfaces, not redesign all screens at once.
5. **Make Anthony's contract work merge first.** If app work depends on new response fields, the shared type/API-client update should merge before app UI branches.
6. **Use a weekly Friday demo.** Every Friday by 4 PM, each owner should show either a working surface, a contract/test result, or a documented blocker with the next action.
7. **Record scope cuts immediately.** Anything not needed for the July 31 demo path goes into a post-July list instead of expanding sprint scope.

## Cross-Sprint Risk Register

| Risk | Owner to watch | Mitigation |
| --- | --- | --- |
| Event app remains too broad to change safely. | Francis | Extract one route-owned component/hook per sprint, verify with `@prism/event` typecheck, avoid unrelated rewrites. |
| Visual system becomes generic or decorative. | Maxine | Enforce PMCM workflow language, dense operational layouts, and banned visual-pattern checks. |
| Portals expose PMCM-only data. | Ethan and Anthony | Keep portal reads scoped, add forbidden-role tests when contracts change, review copy for internal terms. |
| Scoped contracts lag behind UI. | Anthony | Merge type/API-client work before app branches depend on new fields. |
| Local DB blocks demo verification. | Anthony | Fix `db:doctor:runtime` before relying on authenticated local demos; show explicit 503 behavior until fixed. |
| July 31 becomes a feature-expansion deadline. | All owners | Treat Sprint 3 as stabilization and evidence, not new feature intake. |
| Unfinished features hide inside vague redesign language. | All owners | Track every partial/planned ledger item as delivered, gated, deferred, or post-July before Sprint 3 closes. |

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

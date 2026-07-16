# P.R.I.S.M Redesign Readiness Foundation

Last updated: 2026-06-19

This document is the handoff contract for making whole-app redesign work easier to distribute. It does not replace the capability maturity plan; it turns the current architecture cleanup into concrete rules that each owner can rely on before redesigning screens.

## Purpose

The redesign should not start from ambiguous product truth, broad demo state, copied session behavior, or stale docs. The readiness foundation makes four things true:

1. Each owner knows which app and system goal they own.
2. New work uses scoped API/view contracts instead of the broad sample aggregate.
3. Temporary sample/demo paths are named as compatibility paths.
4. Outdated docs do not compete with the current Prism v4 docs and maturity plan.

## Current Foundation Decisions

| Area | Decision | Why it matters for redesign handoff |
| --- | --- | --- |
| Product truth | `AGENTS.md`, `README.md`, `docs/prism-v4/*`, and the active maturity plan are the active sources. | Owners should not design against old app-local audits or retired planning files. |
| App ownership | Keep role-specific apps: client, event, supplier, guest, and shared API. | Prevents redesign work from rebuilding an all-role client shell. |
| Sample state | `/api/sample/state` and client local sample state are compatibility-only seed/demo paths. | New UI should not depend on a whole-system JSON aggregate. |
| Sessions | Storage key names and browser storage helpers live in `@prism/types` while API-backed sample auth remains in this pass. | Redesigners do not need to invent app-local localStorage conventions or copied JSON parse/cleanup logic. |
| Shared contracts | `@prism/types` and `@prism/api-client` are the contract surfaces to grow; PMCM now has explicit dashboard, command inbox, and selected-event workspace contracts, client has workspace plus action-center contracts, supplier has workspace plus readiness-board contracts, and guest has an event-pass contract. | Keeps app redesign from importing across role app boundaries or thinking in sample aggregates. |
| Boundaries | `npm run check:boundaries` is the architectural guard before merge. | Catches cross-app imports, broad sample-state reads, and new magic storage keys. |
| Stale docs | App-local event audit docs are removed from active guidance. | Current truth lives in the v4 docs, not old snapshots. |

## Owner Handoff Rules

| Owner | Person | System goal | Must use | Must not do |
| --- | --- | --- | --- | --- |
| Owner A | Maxine | Make all role surfaces feel like one coherent PMCM operating system while preserving role-specific workflows. | `packages/ui`, design tokens, route inventory, status language, shared shell patterns. | Put workflow logic into `packages/ui` or create visual patterns that contradict app boundaries. |
| Owner B | Francis | Make PMCM/coordinator work executable from inquiry through event day and archive. | `apps/event`, PMCM/coordinator scoped API calls, event workspace route inventory. | Move PMCM-only command behavior into `apps/client` or expose internal state externally. |
| Owner C | Ethan | Make external portals narrow, safe, mobile-ready action surfaces. | `apps/client`, `apps/supplier`, `apps/guest`, public and external portal contracts. | Let external portals read PMCM-only state, mutate official floorplans directly, or depend on broad sample state. |
| Owner D | Anthony | Make platform behavior trustworthy through contracts, permissions, audit, notifications, file/lifecycle services, tests, and docs. | `apps/api`, `packages/types`, `packages/api-client`, boundary checks, scoped controllers. | Expand `EventOpsService` or `/api/sample/state` as the default path for new surfaces. |

## Sample-State Rule

Sample state means either:

- API compatibility aggregate: `GET /api/sample/state` and `POST /api/sample/reset` (no dedicated seed endpoint).
- Client local fallback: `apps/client/src/mock/prism-sample-state.ts` plus browser storage under `PRISM_SAMPLE_STATE_STORAGE_KEY`.

Allowed use:

- Local demo reset.
- Seed verification.
- Backward-compatible fallback while replacing old screens.
- Tests that intentionally verify sample/demo behavior.

Blocked for new redesign work:

- New role app screens calling `eventOpsClient.sample.state()`.
- New role app screens calling `prismApi.state()`.
- New imports of `@/mock/prism-sample-state` outside the client API compatibility adapter.
- New hardcoded `prism:*session` or sample-state storage keys in role apps.

Migration target:

| Current compatibility path | Redesign target |
| --- | --- |
| `/api/sample/state` | `/api/client/workspace`, `/api/pmcm/dashboard`, `/api/supplier/workspace`, `/api/events/:id`, `/api/billing`, `/api/inquiries` |
| `PrismSampleState` as screen state | Role-specific read models and view models |
| Client `localStorage` sample state | API-backed client workspace plus explicit demo seed/reset tooling |
| App-local session keys and storage helpers | Shared constants plus `readPrismSession`, `savePrismSession`, and `clearPrismSession` from `@prism/types`; later external auth/session provider |

## Session Rule

Until external auth is approved, the system still uses API-backed sample auth/RBAC. New work should still treat session behavior as a platform contract:

- Import storage keys and browser storage helpers from `@prism/types`.
- Use `readPrismSession`, `savePrismSession`, and `clearPrismSession` for role app browser-session reads, writes, corrupt-session cleanup, and any allowed legacy-key migration.
- Do not add new literal `prism:*session` strings inside role apps.
- Do not add new app-local JSON parse/remove wrappers for role sessions.
- Do not add new client mock-auth callers.
- Keep role checks app-specific: client users stay in `apps/client`, supplier users stay in `apps/supplier`, guest code access stays in `apps/guest`, and PMCM/coordinator users stay in `apps/event`.
- Treat sample auth as database-backed API behavior, not a browser-only mock. If sign-in, `/api/sample/state`, or `/api/sample/reset` fails because the configured Prisma database is unavailable, the API should return the explicit service-unavailable message that points to `npm --workspace prism-api run db:doctor:runtime`; do not redesign around localStorage bypasses or copied mock users.

## Local Database Runtime Gate

Anthony owns the local API database readiness gate for authenticated browser and API verification. Before Sprint 2 demo work depends on live sample auth, run:

```powershell
npm --workspace prism-api run db:doctor:runtime
```

Passing result: the command exits with code `0`, confirming Prisma can reach the configured runtime database.

Resolution captured on 2026-06-20: the runtime blocker was a paused Supabase database plus stale local DB URLs. After resume, `apps/api/.env` uses the Supabase session-pooler host on port `5432` for `SUPABASE_DB_URL`, `DATABASE_URL`, `DIRECT_URL`, and `PRISMA_DATABASE_URL`, with `ALLOW_POOLER_FOR_PRISMA=1` because the free-tier project does not have the paid IPv4 direct connection string. `npm --workspace prism-api run db:doctor:runtime` and `npm --workspace prism-api run db:doctor` must pass before authenticated browser/API verification is used as release evidence.

Blocked result rule: record the exact failing environment variable, connection target, and remediation command in this document before relying on authenticated local demos. Do not bypass this by adding localStorage-only auth or role-app mock users.

## Scoped Contract Backlog

These contracts should be completed or hardened before heavy redesign branches depend on them:

| Contract | Owner | Needed for |
| --- | --- | --- |
| Client Action Center read model | C/D | Available through `PrismClientActionCenter` and `/api/client/action-center`; dashboard action cards now consume it with local-mode and derived-action fallback. Next work is richer approval/file-matrix actions. |
| PMCM Command Inbox read model | B/D | Available through `PrismPmcmCommandInbox` and `/api/pmcm/command-inbox`; event shell command actions now consume it. Next work is health-score enrichment and deeper selected-event adoption. |
| Selected Event Workspace read model | B/D | Available through `PrismPmcmEventWorkspace` and `/api/pmcm/events/:eventId/workspace`; selected-event sections now load it through `use-pmcm-selected-event-workspace.ts` and prefer it through `event-dashboard.selectors.ts` with broad-state fallback. Live-ops/readiness refreshes now live in `use-pmcm-event-readiness.ts`, and event messages now render through `EventMessagesWorkspace`. Next work is file matrix enrichment and route decomposition. |
| Supplier Readiness Board read model | C/D | Available through `PrismSupplierReadinessBoard` and `/api/supplier/readiness-board`; supplier dashboard now displays it. Next work is PMCM-side readiness board parity and application/status depth. |
| Guest Event Pass read model | C/D | Available through `PrismGuestEventPass`, `/api/guest/events/:accessCode`, and `eventOpsClient.guest.eventPass`; next work is moderation/masterlist enrichment and QR gating only after HTTPS/sample constraints are solved. |
| File Requirements Matrix | A/C/D | Role-visible document requirements, missing/received/approved states. Sprint 2 file behavior is metadata-first. Role apps may show requirement status, owner role, visibility, due date, generated document reference, uploaded asset metadata, and validation state. Role apps must not claim real upload persistence, signed URL creation, multipart upload progress, or retry semantics until Anthony approves a storage adapter contract and focused API tests cover the behavior. |
| Notification delivery state | B/C/D | Communication queues, channel status, retry/error visibility. |
| Privacy Operations state | B/D | Consent, retention, privacy requests, redaction and legal hold. |

## Anthony Sprint 2 Contract Cutline

| Contract family | Sprint 2 state | Allowed UI behavior | Blocked UI behavior | Verification |
| --- | --- | --- | --- | --- |
| Pagination and list envelopes | Shared envelope types exist; existing endpoints can remain array-returning until a route needs paging. | Known-small queues and bounded lists. | Infinite scroll, saved views, generalized table paging. | `npm --workspace @prism/types run typecheck` |
| Filtering and sorting | Shared query-shape types exist; endpoint-specific support must be named before use. | Simple local filters for already-loaded bounded data. | Cross-resource filter payloads invented inside role apps. | `npm --workspace @prism/api-client run typecheck` |
| Normalized errors and empty states | Shared problem, field-error, retryability, and empty-reason types exist. | Route copy maps to known reasons. | App-local error-code strings that cannot be shared across PMCM, client, supplier, and guest surfaces. | API-client unit tests for normalization helper. |
| File Requirements Matrix | Metadata-first matrix remains the July contract. | Requirement status, due date, owner, visibility, and metadata upload cues. | Real uploads, signed URLs, multipart progress, generalized file manager. | Types and focused file matrix tests. |
| Upload sessions | Gated pending real storage adapter approval. | Metadata-only upload intent copy and disabled real-storage controls. | Claims of real file persistence, retry progress, or signed URL behavior. | Gate documented in readiness foundation. |
| Bulk/action responses | Shared action-result type exists. | Single-action success, denied, retryable failure, and audit-reference display. | Bulk action manager or partial-success batch UI. | Types compile and API-client tests cover action-result shape. |

## Sprint 2-4 Contract And Test Cutline

### Sprint 2 Anthony Contract Gate Closeout

- Shared bounded-list, filter/sort, normalized error, empty-state, and action-result types are present in `@prism/types`; Sprint 2 role apps must keep lists bounded unless an endpoint names those query fields explicitly.
- `packages/api-client` exposes scoped clients for PMCM command inbox, selected-event workspace, client action center, supplier readiness board, guest event pass, and file requirements. No extra Sprint 2 client helper is needed before Francis/Ethan consume those existing contracts.
- FL-024 File Requirements Matrix is metadata-only for Sprint 2 through `PrismFileRequirementsMatrix` and `/api/events/:eventId/file-requirements`; real storage, signed URLs, upload progress, retry, and bulk upload behavior remain gated.

### Sprint 2 Anthony Verification Evidence

- API runtime and Prisma database verification pass after the paused Supabase project was resumed and local `.env` was updated to the free-tier Supabase session pooler with `ALLOW_POOLER_FOR_PRISMA=1`.
- `EventAccessPolicyService` tests cover client event scope, coordinator event scope, official floorplan mutation denial, supplier internal-cost denial, and supplier privacy-operation denial.
- `EventReadModelsService` tests cover forbidden access to PMCM command inbox, client action center, supplier readiness board, and client action-center event scoping.
- File requirements tests cover client-visible metadata filtering and PMCM-only supplier review requirements for FL-024.

| Feature family | Sprint target | Contract or gate | Required test evidence |
| --- | --- | --- | --- |
| FL-006 Files and documents | Sprint 2 metadata slice, Sprint 4 storage decision | `PrismFileRequirementsMatrix`; upload sessions gated until storage adapter approval. | `@prism/types` and `@prism/api-client` checks; focused file matrix or document-vault tests only when API behavior changes. |
| FL-014 Notifications and communications | Sprint 4 visible queue/outbox state | Queue state can be shown only from existing notification records; production SendGrid/Viber adapters remain gated. | Notification service/controller tests when send/retry behavior changes. |
| FL-015 Privacy and audit | Sprint 4 minimal privacy/audit visibility | Privacy request, retention, redaction, and audit references stay PMCM-scoped; external auth remains gated. | Privacy/audit service tests and forbidden role access tests when policy changes. |
| FL-011 Floorplan eligibility | Sprint 3 PMCM ownership and client read-only boundary | PMCM official floorplan edits stay in `apps/event`; client inputs remain preferences/comments. | Client official mutation forbidden tests when floorplan API behavior changes. |
| FL-012 Guest access | Sprint 3 access-code consent/check-in slice | `PrismGuestEventPass` stays access-code scoped; QR/camera remains gated. | Guest access-code and consent tests when guest mutations change. |
| FL-007 Supplier readiness | Sprint 3 supplier readiness board depth | `PrismSupplierReadinessBoard` remains supplier-scoped; PMCM private reviews must not cross into supplier views. | Supplier access-policy and readiness-board tests when fields change. |
| FL-010 Billing | Sprint 3-4 client-safe milestone visibility and PMCM correction state | Client billing reads expose statements, milestones, due dates, and allowed actions only; PMCM correction/dispute state needs explicit contract before UI depends on it. | Billing service/controller tests when response fields or mutation rules change. |

## Missing Typed Response Shapes For Sprint 2

| Shape | Current coverage | Sprint 2 decision |
| --- | --- | --- |
| PMCM command summary | `PrismPmcmCommandInbox` exists and feeds shell command actions. | Add fields only when Francis needs them for the command surface; otherwise keep known-small command rows. |
| Selected-event summary | `PrismPmcmEventWorkspace` exists and selected-event sections prefer it. | Route sections may use existing event workspace fields; deeper health, files, or billing fields need shared type updates first. |
| Client action card | `PrismClientActionCenter` exists and feeds dashboard action cards with compatibility fallback. | Ethan can use existing card fields; richer approval/file/closeout cards require shared type changes before app use. |
| Shared status vocabulary | `PrismReadinessStatus`, lifecycle helpers, and event-ops read models exist, but no general UI-empty/error/action result vocabulary existed before this gate. | Use `PrismApiProblem`, `PrismEmptyReason`, `PrismActionResult`, and bounded list types for new Sprint 2 UI contract work. |

## Frontend Patterns Allowed Before Contract Gate Completion

Allowed before a route-specific backend contract is complete:

- Bounded queues from shared read models.
- Known-small lists loaded from existing scoped endpoints.
- Simple local filters over already-loaded bounded data.
- Metadata-only file requirement actions.
- Route-level empty states using shared empty reasons.

Blocked until Anthony's shared contracts and endpoint behavior are complete:

- Infinite scroll.
- Saved views.
- Generalized data grids.
- Real upload progress, signed URLs, or multipart retry UI.
- Bulk action managers.
- App-local normalized error taxonomies.

## Cross-App Handoff Checklist

Every PMCM-to-portal or portal-to-PMCM handoff must name these fields before app UI depends on it:

| Field | Required answer |
| --- | --- |
| Source app | `apps/event`, `apps/client`, `apps/supplier`, `apps/guest`, or `apps/api` |
| Actor role | `pmcm-admin`, `client`, `supplier`, `guest`, `coordinator`, or `system` |
| Target app | `apps/event`, `apps/client`, `apps/supplier`, `apps/guest`, or `apps/api` |
| Event scope | Event ID, access code, supplier ID, coordinator ID, or client session scope |
| Allowed fields | Exact shared contract fields the target may read |
| Forbidden fields | PMCM-only, private supplier, finance, audit, or internal coordination fields that must not cross the boundary |
| Audit event | Audit category and action reference created by the handoff |
| Notification event | Outbox or notification reference created by the handoff, or `none` when the handoff is read-only |
| Empty state | Shared empty reason shown when the handoff has no work |
| Error state | Shared problem code or retryability state shown when the handoff fails |
| Verification command | The exact test, typecheck, route check, or browser check proving the boundary |

### Sprint 2 Handoff Rows

| Flow | Source app | Target app | Contract | Allowed fields | Forbidden fields | Audit or notification expectation | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PMCM command inbox to client next action | `apps/event` | `apps/client` | `PrismPmcmCommandInbox` plus `PrismClientActionCenter` | Event ID, client-visible status, next action label, due date, requirement key | PMCM notes, supplier private review, internal cost, audit log body | PMCM action records an audit reference; client read remains scoped to own event | API-client typecheck and focused read-shape test |
| Client file requirement status to PMCM | `apps/client` | `apps/event` | `PrismFileRequirementsMatrix` | Requirement key, status, due date, owner role, visible roles, uploaded asset reference when metadata exists | Storage path, PMCM validation notes not visible to client, other client event data | Metadata change is auditable; notification remains gated unless outbox behavior is already present | File matrix service test or documented storage gate |
| Client conforme and onboarding status to PMCM | `apps/client` | `apps/event` | `PrismClientActionCenter` plus lifecycle helpers | Inquiry status, conforme status, portal access state, reminder due state | Internal invitation token, PMCM-only decline notes, unrelated inquiry history | Reminder send or portal activation creates audit reference when command exists | Lifecycle contract test and command-inbox read-shape test |

## Legacy Removal Queue

| Legacy | Current action | Final removal condition |
| --- | --- | --- |
| App-local event audit docs | Removed from active guidance. | Useful rows are represented in `07`, `12`, `13`, or this doc. |
| Broad sample aggregate | Fenced as compatibility-only. | No normal app screen or API client path depends on it. |
| PMCM workspace typed as sample state | Replaced with explicit `PrismPmcmDashboardWorkspace`. | Future PMCM command contracts split into command inbox, event workspace, and operations views. |
| PMCM command work derived only in UI | Added `PrismPmcmCommandInbox` and `/api/pmcm/command-inbox`; shell command actions now consume it. | Deeper PMCM actions move into route-scoped handlers instead of the monolithic dashboard component. |
| Selected event resources derived only in UI | Added `PrismPmcmEventWorkspace` and `/api/pmcm/events/:eventId/workspace`; selected-event fetch lifecycle now lives in a feature hook, while resource selection lives in the event-dashboard selector and prefers the scoped workspace with broad-state fallback. | Remove fallback filtering after selected-event routes are decomposed and event-scoped resources cover every tab. |
| Client dashboard state typed as sample state | Narrowed to `PrismClientWorkspace`; local sample data remains a compatibility fallback behind the client API adapter. | Client portal reads only API-backed scoped workspaces. |
| Client action work derived only in UI | Added `PrismClientActionCenter` and `/api/client/action-center`; dashboard action cards now consume it with compatibility fallback. | Client dashboard replacement removes fallback derivation once file-matrix, approval, and closeout actions are fully represented. |
| Supplier readiness work derived only in UI | Added `PrismSupplierReadinessBoard` and `/api/supplier/readiness-board`; supplier dashboard now displays it. | Supplier dashboard redesign consumes quote, assignment, contract, readiness, and event-day status from one supplier-scoped board across all sections. |
| Guest pass shape duplicated in UI | Replaced with shared `PrismGuestEventPass` and API-client route helper. | Guest redesign consumes the shared pass contract and keeps check-in/feedback mutations access-code scoped. |
| Client local sample state | Fenced behind client API adapter. | Local fallback is removed after client portal reads only API-backed scoped workspaces in all supported modes. |
| Mock client auth keys | Marked legacy and migrated by the shared reader when explicitly allowed. | Client session uses the same platform session contract as other apps. |
| Literal session storage keys and copied localStorage mechanics | Replaced with shared constants and `readPrismSession`/`savePrismSession`/`clearPrismSession`. | External auth/session provider replaces localStorage behind the shared contract. |
| `EventOpsService` broad orchestration | Keep extracting service boundaries and app-side feature hooks/components. | Event ops facade delegates domain behavior and PMCM screens consume focused feature hooks/selectors/components for public entry, selected-event workspace, live-ops/readiness, approval requests, admin approvals, floorplans, briefing, supplier quote planning, event messages, loading state, dashboard skeleton states, route-to-shell metadata, and action orchestration instead of broad page-owned workflow logic. |
| PARE/mock adapter defaults | Keep dev/test-only. | Live/test adapter modes are explicit and verified. |
| Generated temp logs | Ignore `.tmp/`. | Dev scripts write only to ignored local output paths. |

## Remediation Execution Gates

The plan remediation branch makes the July work executable at system level. These gates decide whether a sprint task can start, merge, or move to the post-July queue.

| Gate | Applies to | DRI | Rule | Evidence |
| --- | --- | --- | --- | --- |
| Owner clarity gate | Every sprint task and ledger overlay row | Maxine for UX, Francis for PMCM, Ethan for portals, Anthony for platform/docs | Every executable row has one DRI. Support owners can review or provide dependencies but cannot be listed as co-DRIs for completion. | Agile calendar owner task row names one DRI and one evidence line. |
| Contract dependency gate | New response fields, filters, pagination, upload states, errors, or action results | Anthony | UI cannot depend on a field or behavior until it exists in `@prism/types`, `@prism/api-client`, and focused tests, or the task is explicitly bounded/local. | Typecheck/API-client tests or a documented gate in this file. |
| App-boundary gate | PMCM, client, supplier, guest, coordinator surfaces | Anthony | Role apps do not import across app boundaries, do not use broad sample state as the normal path, and do not expose forbidden role data. | `npm run check:boundaries`, focused forbidden-role tests, route checks. |
| Metadata-only file gate | FL-006 and FL-024 file/document UI | Anthony | July UI may show requirement metadata but must not claim real storage, signed URLs, upload progress, retry, multipart, or bulk behavior. | File-matrix tests and visible UI copy/gate. |
| External dependency gate | AI, QR/camera, production notifications, external auth, paid direct DB/network behavior, real storage | Anthony | External dependencies remain gated unless a sprint explicitly approves credentials, environment, adapter, tests, and fallback behavior. | Ledger overlay row lists gate/post-July or approved implementation evidence. |
| Demo evidence gate | Sprint 4 release readiness | Anthony | A demo route is not ready unless its owner records command output, route/screenshot evidence, and known gates. | Sprint closeout notes plus screenshot list. |

### Remediation Branch Scope

This branch updates the planning system, not app behavior. It may change `docs/prism-v4/11-feature-ledger.md`, `docs/prism-v4/12-redesign-inventory.md`, and this readiness foundation. Code or UI changes belong on owner execution branches after this remediation plan is accepted.

## Merge Gate For Redesign Branches

Before a redesign branch is ready to merge:

```bash
npm run check:boundaries
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
git diff --check
```

Feature branches that touch a running app should also run that app's local typecheck/build or a targeted test suite. Do not claim completion from boundary checks alone.

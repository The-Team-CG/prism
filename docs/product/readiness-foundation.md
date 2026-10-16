---
type: "Readiness Contract"
title: "P.R.I.S.M redesign readiness foundation"
description: "Durable gates for development fixtures, sessions, app ownership, shared contracts, external dependencies, and safe redesign work."
tags: [readiness, contracts, roles, compatibility, governance]
status: canonical
updated: "2026-10-16"
authority: normative
owner: "D (Anthony)"
audience: [agents, engineers, QA, reviewers]
scope: "contracts, fixture seeding, sessions, database runtime, external dependencies, and readiness gates"
last_verified: "2026-10-16; selected portal storage and workflow implementation; provider activation remains separate"
sources:
  - id: constitution
    resource: "docs/constitution.md"
    title: "Prism constitution"
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism agent and ownership rules"
  - id: contracts
    resource: "packages/types/src"
    title: "Shared contract source"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture"
---
# P.R.I.S.M redesign readiness foundation

## At a glance

- **Purpose:** Define the gates that must be satisfied before a feature can claim reliable readiness.
- **Authority:** Normative cross-cutting readiness contract for product and architecture work.
- **Owner:** D (Anthony).
- **Scope:** Shared contracts, local fixture seeding, session keys, database runtime, dependencies, and evidence.
- **Use when:** Starting a redesign slice, enabling an external integration, or deciding whether a demo path is safe to extend.
- **Change when:** A readiness gate, dependency policy, authentication/runtime assumption, or evidence requirement changes.
- **Verify with:** Contract builds, boundary checks, database/runtime checks, role tests, and affected route evidence.

This document defines durable platform rules for redesign and new feature work.
It does not replace the feature ledger or architecture docs. It states
fixture-seed limits, session conventions, owner boundaries, contract gates, and
legacy-removal conditions so any contributor can apply them without
undocumented context.

## Correctness gates

- Do not fabricate approved commercial evidence during onboarding. Proposal review requires an issued version; missing production issuance remains an explicit W12 blocker.
- Closeout must read authoritative deliverable, payment, issue and client-feedback evidence. Missing logistics completion cannot pass through an unrelated approved layout; PMCM must record an override reason.
- Privacy execution may mark only a supported, successfully committed operation complete. Full native-account/file erasure, access and correction workflows remain gated.
- Sensitive HTTP routes derive identity from signed sessions. Display names, body/query roles and expired tokens grant no authority. Native password/TOTP behavior remains in place.
- Live AI and unknown modes fail before network/SDK effects, including direct agent entry points. Mock mode does not establish provider approval or zero-retention compliance.
- The [authority/lifecycle policy](event-authority-and-lifecycle-policy.md) records accepted rules; its downstream implementation limits remain explicit.

The feature ledger and accepted product policies hold current implementation
status and remaining blockers. Local database and HTTP acceptance, browser
walkthroughs, staging evaluation, provider privacy review, and production
approval are separate evidence gates; source or unit-test completion alone
does not satisfy them.

## Purpose

Redesign and new surfaces should not start from ambiguous product truth, broad demo state, copied session behavior, or stale docs. This foundation makes four things true:

1. Each owner knows which app and system goal they own.
2. New work uses scoped API/view contracts; no whole-system sample aggregate is exposed.
3. Development fixtures are inserted through a guarded database seed command, not runtime routes or browser-local state.
4. Outdated docs do not compete with the current bundle (`AGENTS.md`, `docs/constitution.md`, and the semantic architecture/product documents).

## Current Foundation Decisions

| Area | Decision | Why it matters |
| --- | --- | --- |
| Product truth | `AGENTS.md`, `README.md`, and the current semantic docs under `docs/` are the active sources. | Do not design against removed audits, story logs, or retired planning files. |
| App ownership | Keep role-specific apps: client, event, supplier, guest, and shared API. | Prevents redesign work from rebuilding an all-role client shell. |
| Development fixtures | The app exposes no sample HTTP routes or browser-local sample state. A guarded CLI seeds an empty loopback `prism_sample_disposable` database. | Portals use scoped HTTP APIs; fixture seeding is separate from API startup. |
| Sessions | Storage key names and browser storage helpers live in `@prism/types`. Built-in API auth/RBAC remains until external auth is approved. | Role apps must not invent app-local localStorage conventions or copied JSON parse/cleanup logic. |
| Shared contracts | `@prism/types` and `@prism/api-client` are the contract surfaces to grow; PMCM has dashboard, command inbox, and selected-event workspace contracts; client has workspace plus action-center contracts; supplier has workspace plus readiness-board contracts; guest has an event-pass contract. | Keeps app redesign from importing across role app boundaries or thinking in sample aggregates. |
| Boundaries | `npm run check:boundaries` is the architectural guard before merge. | Catches cross-app imports, broad aggregate reads, and new magic storage keys. |
| Stale docs | App-local event audit docs are removed from active guidance. | Current truth lives in the semantic documentation bundle, not old snapshots. |

## Owner Boundary Rules

| Owner | Person | System goal | Must use | Must not do |
| --- | --- | --- | --- | --- |
| Owner A | Maxine | Make all role surfaces feel like one coherent PMCM operating system while preserving role-specific workflows. | `packages/ui`, design tokens, route inventory, status language, shared shell patterns. | Put workflow logic into `packages/ui` or create visual patterns that contradict app boundaries. |
| Owner B | Francis | Make PMCM/coordinator work executable from inquiry through event day and archive. | `apps/event`, PMCM/coordinator scoped API calls, event workspace route inventory. | Move PMCM-only command behavior into `apps/client` or expose internal state externally. |
| Owner C | Ethan | Make external portals narrow, safe, mobile-ready action surfaces. | `apps/client`, `apps/supplier`, `apps/guest`, public and external portal contracts. | Let external portals read PMCM-only state, mutate official floorplans directly, or depend on a broad aggregate. |
| Owner D | Anthony | Make platform behavior trustworthy through contracts, permissions, audit, notifications, file/lifecycle services, tests, and docs. | `apps/api`, `packages/types`, `packages/api-client`, bounded-context/kernel boundaries, scoped controllers. | Reintroduce whole-system aggregate routes or recreate a centralized backend/portal god facade as the default path for new surfaces. |

## Development Fixture Rule

Seeded local accounts and workflow data remain available for local verification.
They are loaded only through:

```bash
npm --workspace prism-api run db:seed:fixtures -- --confirm-disposable-db prism_sample_disposable
```

The command rejects production, non-loopback targets, a different database
name, and populated fixture tables. It writes directly through Prisma and does
not start an API listener or delete existing rows. Use scoped role APIs for
application behavior; there is no sample state contract, route, or browser
storage key to build against.

| Former path | Current path |
| --- | --- |
| `/api/sample/state` and `/api/sample/reset` | Removed; use role-scoped API controllers and read models. |
| `PrismSampleState` as screen state | Removed; use role-specific read models and view models. |
| Client browser-local sample state | Removed; client repositories use the API-backed scoped workspace and workflow routes. |
| Local development accounts and events | Explicit fixture seed into a new empty disposable database. |
| App-local session keys and storage helpers | Shared constants plus `readPrismSession`, `savePrismSession`, and `clearPrismSession` from `@prism/types`; later external auth/session provider. |

## Session Rule

Until external auth is approved, the system uses built-in API auth/RBAC backed by seeded local test accounts. New work should still treat session behavior as a platform contract:

- Import storage keys and browser storage helpers from `@prism/types`.
- Use `readPrismSession`, `savePrismSession`, and `clearPrismSession` for role app browser-session reads, writes, corrupt-session cleanup, and any allowed legacy-key migration.
- Do not add new literal `prism:*session` strings inside role apps.
- Do not add new app-local JSON parse/remove wrappers for role sessions.
- Do not add new client mock-auth callers.
- Keep role checks app-specific: client users stay in `apps/client`, supplier users stay in `apps/supplier`, guest code access stays in `apps/guest`, and PMCM/coordinator users stay in `apps/event`.
- Treat sign-in as database-backed API behavior, not a browser-only mock. If sign-in fails because the configured Prisma database is unavailable, the API should return the explicit service-unavailable message that points to `npm --workspace prism-api run db:doctor:runtime`; do not redesign around localStorage bypasses or copied mock users.

## Local Database Runtime Gate

Platform trust owns the local API database readiness gate for authenticated browser and API verification. Before demos or release evidence depend on seeded test accounts, run:

```powershell
npm --workspace prism-api run db:doctor:runtime
```

Passing result: the command exits with code `0`, confirming Prisma can reach the configured runtime database.

**Local free-tier Supabase note:** when paid IPv4 direct database access is unavailable, `apps/api/.env` may use the Supabase session-pooler host on port `5432` for `SUPABASE_DB_URL`, `DATABASE_URL`, `DIRECT_URL`, and `PRISMA_DATABASE_URL`, with `ALLOW_POOLER_FOR_PRISMA=1`. Both `npm --workspace prism-api run db:doctor:runtime` and `npm --workspace prism-api run db:doctor` must pass before authenticated browser/API verification is used as release evidence.

Blocked result rule: record the exact failing environment variable, connection target, and remediation command in this document (or the PR) before relying on authenticated local demos. Do not bypass this by adding localStorage-only auth or role-app mock users.

## Scoped Contract Backlog

These contracts should be completed or hardened before heavy redesign branches depend on them:

| Contract | Owner | Needed for |
| --- | --- | --- |
| Client Action Center read model | C/D | Available through `PrismClientActionCenter` and `/api/client/action-center`; dashboard action cards consume it with derived-action fallback. Next work is richer approval/file-matrix actions. |
| PMCM Command Inbox read model | B/D | Available through `PrismPmcmCommandInbox` and `/api/pmcm/command-inbox`; event shell command actions now consume it. Next work is health-score enrichment and deeper selected-event adoption. |
| Selected Event Workspace read model | B/D | Available through `PrismPmcmEventWorkspace` and `/api/pmcm/events/:eventId/workspace`; selected-event sections now load it through `use-pmcm-selected-event-workspace.ts` and prefer it through `event-dashboard.selectors.ts` with broad-state fallback. Live-ops/readiness refreshes now live in `use-pmcm-event-readiness.ts`, and event messages now render through `EventMessagesWorkspace`. Next work is file matrix enrichment and route decomposition. |
| Supplier Readiness Board read model | C/D | Available through `PrismSupplierReadinessBoard` and `/api/supplier/readiness-board`; supplier dashboard now displays it. Next work is PMCM-side readiness board parity and application/status depth. |
| Guest Event Pass read model | C/D | Available through `PrismGuestEventPass`, `/api/guest/events/:accessCode`, and `eventOpsClient.guest.eventPass`; next work is moderation/masterlist enrichment and QR gating only after HTTPS/device/masterlist constraints are solved. |
| File Requirements Matrix | A/C/D | Role-visible document requirements, missing/received/approved states. Requirements retain owner, visibility, due date, generated source, and validation state. Configured storage now verifies actual bytes before an attachment satisfies a requirement. See [client and supplier workflows](client-supplier-workflows.md). Production bucket activation, malware scanning, retention, multipart, and bulk uploads require separate evidence. |
| Notification delivery state | B/C/D | Communication queues, channel status, retry/error visibility. |
| Privacy Operations state | B/D | Consent, retention, privacy requests, redaction and legal hold. |

## Platform Contract Cutline

| Contract family | Current state | Allowed UI behavior | Blocked UI behavior | Verification |
| --- | --- | --- | --- | --- |
| Pagination and list envelopes | Shared envelope types exist; existing endpoints can remain array-returning until a route needs paging. | Known-small queues and bounded lists. | Infinite scroll, saved views, generalized table paging. | `npm --workspace @prism/types run typecheck` |
| Filtering and sorting | Shared query-shape types exist; endpoint-specific support must be named before use. | Simple local filters for already-loaded bounded data. | Cross-resource filter payloads invented inside role apps. | `npm --workspace @prism/api-client run typecheck` |
| Normalized errors and empty states | Shared problem, field-error, retryability, and empty-reason types exist. | Route copy maps to known reasons. | App-local error-code strings that cannot be shared across PMCM, client, supplier, and guest surfaces. | API-client unit tests for normalization helper. |
| File Requirements Matrix | Role-filtered requirements with confirmed storage objects. | Requirement status, due date, owner, visibility, and verified attachments. | Generalized file manager, multipart and bulk uploads. | File matrix, storage, and forbidden-role tests. |
| Upload sessions | Explicitly configured local or private Supabase storage. | Request, transfer, byte/hash/content confirmation, authorized download, and retry of an immutable object. | Production activation without configured credentials and operational checks; multipart or bulk claims. | Storage adapter and authorization tests plus provider activation checks. |
| Bulk/action responses | Shared action-result type exists. | Single-action success, denied, retryable failure, and audit-reference display. | Bulk action manager or partial-success batch UI. | Types compile and API-client tests cover action-result shape. |

## Contract And Test Gates

### Shared contract baseline

- Shared bounded-list, filter/sort, normalized error, empty-state, and action-result types are present in `@prism/types`; role apps must keep lists bounded unless an endpoint names those query fields explicitly.
- `packages/api-client` exposes scoped clients for PMCM command inbox, selected-event workspace, client action center, supplier readiness board, guest event pass, and file requirements. Role apps should consume those existing contracts before inventing parallel helpers.
- FL-024 exposes role-filtered requirements through `PrismFileRequirementsMatrix` and `/api/events/:eventId/file-requirements`. Real attachments use the storage capability and must be confirmed before they count; provider activation and bulk upload remain separate gates.

### Required verification evidence

- API runtime and Prisma database verification pass with a valid local `.env` (see Local Database Runtime Gate).
- `EventAccessPolicyService` tests cover client event scope, coordinator event scope, official floorplan mutation denial, supplier internal-cost denial, and supplier privacy-operation denial.
- `EventReadModelsService` tests cover forbidden access to PMCM command inbox, client action center, supplier readiness board, and client action-center event scoping.
- File requirements tests cover client-visible metadata filtering and PMCM-only supplier review requirements for FL-024.

| Feature family | Target | Contract or gate | Required test evidence |
| --- | --- | --- | --- |
| FL-006 Files and documents | Verified attachment slice; provider activation separate | `PrismFileRequirementsMatrix` plus scoped immutable storage objects; see the portal workflow contract. | `@prism/types` and `@prism/api-client` checks; focused file matrix or document-vault tests only when API behavior changes. |
| FL-014 Notifications and communications | Visible queue/outbox state later | Queue state can be shown only from existing notification records; production SendGrid/Viber adapters remain gated. | Notification service/controller tests when send/retry behavior changes. |
| FL-015 Privacy and audit | Minimal privacy/audit visibility | Privacy request, retention, redaction, and audit references stay PMCM-scoped; external auth remains gated. | Privacy/audit service tests and forbidden role access tests when policy changes. |
| FL-011 Floorplan eligibility | PMCM ownership and client read-only boundary | PMCM official floorplan edits stay in `apps/event`; client inputs remain preferences/comments. | Client official mutation forbidden tests when floorplan API behavior changes. |
| FL-012 Guest access | Access-code consent/check-in slice | `PrismGuestEventPass` stays access-code scoped; QR/camera remains gated. | Guest access-code and consent tests when guest mutations change. |
| FL-007 Supplier readiness | Supplier readiness board depth | `PrismSupplierReadinessBoard` remains supplier-scoped; PMCM private reviews must not cross into supplier views. | Supplier access-policy and readiness-board tests when fields change. |
| FL-010 Billing | Client-safe milestone visibility and PMCM correction state | Client billing reads expose statements, milestones, due dates, and allowed actions only; PMCM correction/dispute state needs explicit contract before UI depends on it. | Billing service/controller tests when response fields or mutation rules change. |

## Shared Response Shapes

| Shape | Current coverage | Decision |
| --- | --- | --- |
| PMCM command summary | `PrismPmcmCommandInbox` exists and feeds shell command actions. | Add fields only when the command surface needs them; otherwise keep known-small command rows. |
| Selected-event summary | `PrismPmcmEventWorkspace` exists and selected-event sections prefer it. | Route sections may use existing event workspace fields; deeper health, files, or billing fields need shared type updates first. |
| Client action card | `PrismClientActionCenter` exists and feeds dashboard action cards with compatibility fallback. | Use existing card fields; richer approval/file/closeout cards require shared type changes before app use. |
| Shared status vocabulary | `PrismReadinessStatus`, lifecycle helpers, and event-ops read models exist, plus shared UI empty/error/action result vocabulary. | Use `PrismApiProblem`, `PrismEmptyReason`, `PrismActionResult`, and bounded list types for new UI contract work. |

## Frontend Patterns Before Contract Completion

Allowed before a route-specific backend contract is complete:

- Bounded queues from shared read models.
- Known-small lists loaded from existing scoped endpoints.
- Simple local filters over already-loaded bounded data.
- Role-filtered file requirements and verified storage attachment actions.
- Route-level empty states using shared empty reasons.

Blocked until shared contracts and endpoint behavior are complete:

- Infinite scroll.
- Saved views.
- Generalized data grids.
- Real upload progress, signed URLs, or multipart retry UI.
- Bulk action managers.
- App-local normalized error taxonomies.

## Cross-App Boundary Checklist

Every PMCM-to-portal or portal-to-PMCM data flow must name these fields before app UI depends on it:

| Field | Required answer |
| --- | --- |
| Source app | `apps/event`, `apps/client`, `apps/supplier`, `apps/guest`, or `apps/api` |
| Actor role | `pmcm-admin`, `client`, `supplier`, `guest`, `coordinator`, or `system` |
| Target app | `apps/event`, `apps/client`, `apps/supplier`, `apps/guest`, or `apps/api` |
| Event scope | Event ID, access code, supplier ID, coordinator ID, or client session scope |
| Allowed fields | Exact shared contract fields the target may read |
| Forbidden fields | PMCM-only, private supplier, finance, audit, or internal coordination fields that must not cross the boundary |
| Audit event | Audit category and action reference created by the flow |
| Notification event | Outbox or notification reference created by the flow, or `none` when the flow is read-only |
| Empty state | Shared empty reason shown when the flow has no work |
| Error state | Shared problem code or retryability state shown when the flow fails |
| Verification command | The exact test, typecheck, route check, or browser check proving the boundary |

### Established boundary rows

| Flow | Source app | Target app | Contract | Allowed fields | Forbidden fields | Audit or notification expectation | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PMCM command inbox to client next action | `apps/event` | `apps/client` | `PrismPmcmCommandInbox` plus `PrismClientActionCenter` | Event ID, client-visible status, next action label, due date, requirement key | PMCM notes, supplier private review, internal cost, audit log body | PMCM action records an audit reference; client read remains scoped to own event | API-client typecheck and focused read-shape test |
| Client file requirement status to PMCM | `apps/client` | `apps/event` | `PrismFileRequirementsMatrix` | Requirement key, status, due date, owner role, visible roles, uploaded asset reference when metadata exists | Storage path, PMCM validation notes not visible to client, other client event data | Metadata change is auditable; notification remains gated unless outbox behavior is already present | File matrix service test or documented storage gate |
| Client conforme and onboarding status to PMCM | `apps/client` | `apps/event` | `PrismClientActionCenter` plus lifecycle helpers | Inquiry status, conforme status, portal access state, reminder due state | Internal invitation token, PMCM-only decline notes, unrelated inquiry history | Reminder send or portal activation creates audit reference when command exists | Lifecycle contract test and command-inbox read-shape test |

## Legacy Removal Queue

| Legacy | Current action | Final removal condition |
| --- | --- | --- |
| App-local event audit docs | Removed from active guidance. | Useful rows are represented in `../constitution.md`, `feature-ledger.md`, `redesign-inventory.md`, or this doc. |
| Broad sample aggregate | Removed from the API, API client, and client portal. | Do not reintroduce a whole-system state route or browser-local state. |
| PMCM workspace typed as sample state | Replaced with explicit `PrismPmcmDashboardWorkspace`. | Future PMCM command contracts split into command inbox, event workspace, and operations views. |
| PMCM command work derived only in UI | Added `PrismPmcmCommandInbox` and `/api/pmcm/command-inbox`; shell command actions now consume it. | Deeper PMCM actions move into route-scoped handlers instead of the monolithic dashboard component. |
| Selected event resources derived only in UI | Added `PrismPmcmEventWorkspace` and `/api/pmcm/events/:eventId/workspace`; selected-event fetch lifecycle now lives in a feature hook, while resource selection lives in the event-dashboard selector and prefers the scoped workspace with broad-state fallback. | Remove fallback filtering after selected-event routes are decomposed and event-scoped resources cover every tab. |
| Client dashboard state typed as sample state | Narrowed to `PrismClientWorkspace`; the local sample fallback has been removed. | Client portal reads API-backed scoped workspaces. |
| Client action work derived only in UI | Added `PrismClientActionCenter` and `/api/client/action-center`; dashboard action cards now consume it with compatibility fallback. | Client dashboard replacement removes fallback derivation once file-matrix, approval, and closeout actions are fully represented. |
| Supplier readiness work derived only in UI | Added `PrismSupplierReadinessBoard` and `/api/supplier/readiness-board`; supplier dashboard now displays it. | Supplier dashboard redesign consumes quote, assignment, contract, readiness, and event-day status from one supplier-scoped board across all sections. |
| Guest pass shape duplicated in UI | Replaced with shared `PrismGuestEventPass` and API-client route helper. | Guest redesign consumes the shared pass contract and keeps check-in/feedback mutations access-code scoped. |
| Client local sample state | Removed, including its mock state, storage key, and compatibility adapter. | Local account and event fixtures remain available only through the explicit database seed command. |
| Mock client auth keys | Marked legacy and migrated by the shared reader when explicitly allowed. | Client session uses the same platform session contract as other apps. |
| Literal session storage keys and copied localStorage mechanics | Replaced with shared constants and `readPrismSession`/`savePrismSession`/`clearPrismSession`. | External auth/session provider replaces localStorage behind the shared contract. |
| Legacy backend/portal god facades | Backend workflows now live in DDD-shaped contexts; the remaining package-level FE `createEventOpsClient` transport is compatibility-only and must not grow. | Keep new backend work under `apps/api/src/modules/*` or `src/kernel/*`; keep portal I/O in feature `data/` and replace the compatibility transport opportunistically when a consumer is already being changed. |
| PARE/mock adapter defaults | Keep dev/test-only. | Live/test adapter modes are explicit and verified. |
| Generated temp logs | Ignore `.tmp/`. | Dev scripts write only to ignored local output paths. |

## Execution Gates

These gates decide whether a task can start, merge, or move to a later queue.

| Gate | Applies to | DRI | Rule | Evidence |
| --- | --- | --- | --- | --- |
| Owner clarity gate | Every task and ledger overlay row | Maxine for UX, Francis for PMCM, Ethan for portals, Anthony for platform/docs | Every executable row has one DRI. Support owners can review or provide dependencies but cannot be listed as co-DRIs for completion. | Task or ledger row names one DRI and one evidence line. |
| Contract dependency gate | New response fields, filters, pagination, upload states, errors, or action results | Anthony | UI cannot depend on a field or behavior until it exists in `@prism/types`, `@prism/api-client`, and focused tests, or the task is explicitly bounded/local. | Typecheck/API-client tests or a documented gate in this file. |
| App-boundary gate | PMCM, client, supplier, guest, coordinator surfaces | Anthony | Role apps do not import across app boundaries, do not reintroduce a broad aggregate path, and do not expose forbidden role data. | `npm run check:boundaries`, focused forbidden-role tests, route checks. |
| Verified file gate | FL-006 and FL-024 file/document UI | Anthony | An attachment counts only after provider bytes pass size, hash, content, role, and event checks. Production provider activation, scanning, retention, multipart, and bulk behavior require their own evidence. | File-matrix and storage tests, role-path checks, and [storage runbook](../runbooks/portal-storage.md). |
| External dependency gate | AI, QR/camera, production notifications, external auth, paid direct DB/network behavior, real storage | Anthony | External dependencies remain gated unless credentials, environment, adapter, tests, and fallback behavior are explicitly approved. | Ledger row lists gate/deferred or approved implementation evidence. |
| Demo evidence gate | Release readiness for demo routes | Anthony | A demo route is not ready unless its owner records command output, route/screenshot evidence, and known gates. | PR or release notes plus screenshot list. |

Docs-only changes may update [`feature-ledger.md`](feature-ledger.md),
[`redesign-inventory.md`](redesign-inventory.md), and this readiness foundation.
Code or UI changes belong on feature branches that follow these gates.

## Merge Gate For Redesign Branches

Before a redesign branch is ready to merge:

```bash
npm run check:boundaries
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
git diff --check
```

Feature branches that touch a running app should also run that app's local typecheck/build or a targeted test suite. Do not claim completion from boundary checks alone.

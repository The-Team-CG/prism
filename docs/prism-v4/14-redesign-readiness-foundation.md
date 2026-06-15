# P.R.I.S.M Redesign Readiness Foundation

Last updated: 2026-06-15

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

| Owner | System goal | Must use | Must not do |
| --- | --- | --- | --- |
| Owner A | Make all role surfaces feel like one coherent PMCM operating system while preserving role-specific workflows. | `packages/ui`, design tokens, route inventory, status language, shared shell patterns. | Put workflow logic into `packages/ui` or create visual patterns that contradict app boundaries. |
| Owner B | Make PMCM/coordinator work executable from inquiry through event day and archive. | `apps/event`, PMCM/coordinator scoped API calls, event workspace route inventory. | Move PMCM-only command behavior into `apps/client` or expose internal state externally. |
| Owner C | Make external portals narrow, safe, mobile-ready action surfaces. | `apps/client`, `apps/supplier`, `apps/guest`, public and external portal contracts. | Let external portals read PMCM-only state, mutate official floorplans directly, or depend on broad sample state. |
| Owner D | Make platform behavior trustworthy through contracts, permissions, audit, notifications, file/lifecycle services, tests, and docs. | `apps/api`, `packages/types`, `packages/api-client`, boundary checks, scoped controllers. | Expand `EventOpsService` or `/api/sample/state` as the default path for new surfaces. |

## Sample-State Rule

Sample state means either:

- API compatibility aggregate: `GET /api/sample/state`, `POST /api/sample/reset`, and `POST /api/sample/seed`.
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

## Scoped Contract Backlog

These contracts should be completed or hardened before heavy redesign branches depend on them:

| Contract | Owner | Needed for |
| --- | --- | --- |
| Client Action Center read model | C/D | Available through `PrismClientActionCenter` and `/api/client/action-center`; dashboard action cards now consume it with local-mode and derived-action fallback. Next work is richer approval/file-matrix actions. |
| PMCM Command Inbox read model | B/D | Available through `PrismPmcmCommandInbox` and `/api/pmcm/command-inbox`; event shell command actions now consume it. Next work is health-score enrichment and deeper selected-event adoption. |
| Selected Event Workspace read model | B/D | Available through `PrismPmcmEventWorkspace` and `/api/pmcm/events/:eventId/workspace`; selected-event sections now load it through `use-pmcm-selected-event-workspace.ts` and prefer it through `event-dashboard.selectors.ts` with broad-state fallback. Live-ops/readiness refreshes now live in `use-pmcm-event-readiness.ts`, and event messages now render through `EventMessagesWorkspace`. Next work is file matrix enrichment and route decomposition. |
| Supplier Readiness Board read model | C/D | Available through `PrismSupplierReadinessBoard` and `/api/supplier/readiness-board`; supplier dashboard now displays it. Next work is PMCM-side readiness board parity and application/status depth. |
| Guest Event Pass read model | C/D | Available through `PrismGuestEventPass`, `/api/guest/events/:accessCode`, and `eventOpsClient.guest.eventPass`; next work is moderation/masterlist enrichment and QR gating only after HTTPS/sample constraints are solved. |
| File Requirements Matrix | A/C/D | Role-visible document requirements, missing/received/approved states. |
| Notification delivery state | B/C/D | Communication queues, channel status, retry/error visibility. |
| Privacy Operations state | B/D | Consent, retention, privacy requests, redaction and legal hold. |

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

## Merge Gate For Redesign Branches

Before a redesign branch is ready to merge:

```bash
npm run check:boundaries
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
git diff --check
```

Feature branches that touch a running app should also run that app's local typecheck/build or a targeted test suite. Do not claim completion from boundary checks alone.

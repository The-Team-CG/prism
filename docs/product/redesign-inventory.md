---
type: "Product Redesign Inventory"
title: "P.R.I.S.M whole-app redesign inventory"
description: "Current portal and API surface inventory classified by redesign severity, owner goal, and readiness gate."
tags: [product, redesign, inventory, ownership, frontend, backend]
status: active
updated: "2026-09-01"
authority: informative
owner: "A (Maxine), D (Anthony)"
audience: [design, frontend-engineers, product, reviewers]
scope: "portal routes, API/package surfaces, redesign severity, owners, and closure evidence"
last_verified: "581e676"
sources:
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism owner goals and app boundaries"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture"
  - id: roadmap
    resource: "docs/roadmap/architecture-priority-risk-matrix.md"
    title: "Architecture priority and risk matrix"
---
# P.R.I.S.M whole-app redesign inventory

## At a glance

- **Purpose:** Inventory route and surface-level redesign work without changing product ownership.
- **Authority:** Informative active inventory; architecture ADRs and the feature ledger remain authoritative.
- **Owner:** A (Maxine), D (Anthony).
- **Scope:** Client, event, supplier, guest, API, and shared-package surfaces.
- **Use when:** Selecting a frontend or cross-surface redesign slice and its evidence.
- **Change when:** A route, surface, severity, owner, dependency, or completion condition changes.
- **Verify with:** Route inventories, URL checks, touched-app checks, role-path evidence, and boundary checks.

This inventory classifies current app surfaces by redesign severity so owners
can work in parallel without turning P.R.I.S.M back into an all-role shell.
Owner labels refer to the system goals in `AGENTS.md`: Owner A is Maxine, Owner
B is Francis, Owner C is Ethan, and Owner D is Anthony.

Severity scale:

| Severity | Meaning |
| --- | --- |
| S0 | Preserve. Only fix bugs, accessibility, or consistency issues. |
| S1 | Light polish. Keep route and workflow, improve layout/copy/states. |
| S2 | Workflow redesign. Route stays, but page needs stronger IA, action model, or data boundaries. |
| S3 | Structural redesign. Split, merge, or replace the workflow surface. |
| Gate | Do not deepen until prerequisite is complete. |

## App-Level Summary

| App | Product role | Current route shape | Redesign priority | Primary owner | Owner system goal for this area | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/client` | Public inquiry plus signed-in client portal | Landing, inquiry, sign-in/sign-up, dashboard, event sections, billing/files/messages/calendar/approvals | S2 | Owner C (Ethan) | Make the client portal a narrow, safe action center for client-owned work. | Client Action Center is now consumed by the dashboard actions; continue tighter event-scoped reads and clearer public-to-signed-in boundary. |
| `apps/event` | PMCM admin and coordinator command app | Large dashboard with many filtered subroutes plus selected event workspace | S3 | Owner B (Francis) | Make PMCM and coordinator operations executable from command surfaces. | Event Command Inbox is now consumed by shell actions; selected event sections now prefer `PrismPmcmEventWorkspace`; event messages now have a route-owned workspace component. Continue workspace IA, staffing/live-ops redesign, and route consolidation. |
| `apps/supplier` | Supplier portal | Landing, sign-in, dashboard | S2 | Owner C (Ethan) | Make supplier work limited to quote, assignment, contract, readiness, and event-day status. | Supplier Readiness Board is now visible on the dashboard; continue supplier application/status depth while preserving supplier-scoped data. |
| `apps/guest` | Lightweight guest portal | Landing, sign-in, open code, dashboard | S1/Gate | Owner C (Ethan) | Make guest access low-friction, consented, and event-code scoped. | Use the shared Guest Event Pass contract. Keep lightweight. Gate QR/camera and media upload until HTTPS, consent, upload, and moderation are ready. |
| `apps/api` | Shared NestJS API | One Nest source tree with DDD-shaped contexts under `apps/api/src/modules/*`, kernel primitives under `src/kernel/*`, and `/sample/*` compatibility under `src/compatibility/sample` | S2 | Owner D (Anthony) | Make data, permissions, audit, files, lifecycle, notifications, and contracts trustworthy. | Backend context consolidation is implemented: eight context roots, seven kernel concerns, one compatibility leaf, public indices, and executable boundary checks. Continue contract consolidation, table ownership, focused ports, and modular-monolith guardrails in `../architecture/current-architecture.md`. |
| `packages/ui` | Shared presentation system | App shell, public shell, primitives, blocks, client/public blocks | S1 | Owner A (Maxine) | Make shared presentation patterns coherent without absorbing workflow logic. | Keep presentation-only. Continue component consolidation through actual app needs. |
| `packages/types` | Shared contracts | Lifecycle and event-ops types | S2 | Owner D (Anthony) | Make shared contracts the source of truth for role-safe app/API integration. | Expand route/feature contracts before large app redesign. |
| `packages/api-client` | Shared request helpers | Event-ops client and HTTP helper | S1 | Owner D (Anthony) | Make app data access typed, scoped, and migration-safe. | Keep stable, add typed clients when app surfaces stop using broad state. |

## Owner System Goal Summary

| Owner | Person | Applies to | System goal |
| --- | --- | --- | --- |
| Owner A | Maxine | `packages/ui`, design system, IA, page templates, status language | Make all role surfaces feel like one coherent PMCM operating system while preserving role-specific workflows. |
| Owner B | Francis | `apps/event`, PMCM command, coordinator role views, live operations, closure | Make PMCM/coordinator work executable from inquiry through event day and archive. |
| Owner C | Ethan | `apps/client`, `apps/supplier`, `apps/guest`, public flows | Make external portals narrow, safe, mobile-ready action surfaces. |
| Owner D | Anthony | `apps/api`, Prisma, `packages/types`, `packages/api-client`, verification/docs | Make platform behavior trustworthy through contracts, permissions, audit, notifications, file/lifecycle services, tests, and docs. |

## Client Portal Route Inventory

| Surface | Routes | Severity | Redesign direction | Must preserve |
| --- | --- | --- | --- | --- |
| Public landing | `/` | S1 | Make PMCM-specific, inquiry-first, no dashboard shortcuts. | Public surface only; no signed-in dashboard entry except sign-in. |
| Inquiry | `/inquiry` | S2 | Improve privacy consent, referral/log-on-behalf separation, spatial preference clarity, submit feedback. | Public cannot spoof PMCM fields. |
| Auth | `/sign-in`, `/sign-up` | S1 | Keep quiet and direct; explain access requires accepted inquiry and conforme. | No public self-service event creation. |
| Dashboard home | `/dashboard` | S3 | Replace generic dashboard with Client Action Center. | Signed-in only; event data scoped to client. |
| Client events | `/dashboard/events`, status filters, `/dashboard/events/[eventId]`, `/dashboard/events/[eventId]/[section]` | S2 | Event workspace with overview, briefing/proposal, floorplan, billing, documents, activity. | Official floorplans read-only except formal approval/comment actions. |
| Billing | `/dashboard/billing`, `/dashboard/billing/[billingView]` | S2 | Surface milestones, statements, due dates, receipts, disputes as client actions. | Client cannot edit payment records. |
| Files | `/dashboard/files`, `/dashboard/files/[fileView]` | S3 | Replace broad file hub with File Requirements Matrix. | Client sees only allowed event files. |
| Messages | `/dashboard/messages`, `/dashboard/messages/[messageView]` | S2 | Role-scoped communication with notification state. | No PMCM private notes or internal supplier/coordinator messages. |
| Calendar | `/dashboard/calendar`, `/dashboard/calendar/[calendarView]` | S1 | Keep as client-facing milestone/calendar view. | No internal PMCM task calendar. |
| Approvals | `/dashboard/approvals`, `/dashboard/approvals/[approvalView]` | S2 | Combine proposal, floorplan, conformes, addendum, and closeout acknowledgments. | Primary contact authority rules. |
| Request | `/dashboard/request` | S2 | Treat as new request/inquiry path for returning clients. | Event creation still PMCM-gated. |

## PMCM And Coordinator App Route Inventory

| Surface | Routes | Severity | Redesign direction | Must preserve |
| --- | --- | --- | --- | --- |
| Public entry/auth | `/`, `/sign-in` | S1 | Keep as PMCM/coordinator entry; no marketing hero. Root entry is isolated in `EventCommandLanding`. | Signed-in surfaces only after auth. |
| Command dashboard | `/dashboard`, `/dashboard/[dashboardView]` | S3 | Replace with Event Command Inbox, health score, and focused work queues. Legacy loading states are isolated in `event-dashboard-skeleton.tsx`; route-to-shell metadata lives in `event-dashboard.routing.ts`. | PMCM-only operational visibility. |
| Inquiries | `/dashboard/inquiries` | S2 | PMCM intake queue with accept/pend/decline, referrals, duplicates, conforme path. | Public inquiry role separation. |
| Events list | `/dashboard/events`, status/by-client/by-type filters | S2 | Event portfolio with lifecycle state, health, owner, risk, next action. | No client portal behavior inside PMCM route. |
| Selected event | `/dashboard/events/[eventId]`, overview/briefing/billing/floorplans/suppliers/coordinators/live-ops/closure/activity | S3 | Make selected event workspace the primary PMCM operating surface. | PMCM owns official floorplans and internal cost/supplier/coordinator details. |
| Clients | `/dashboard/clients`, active/past/prospects/archived, `/dashboard/clients/[clientId]` | S2 | Client relationship view tied to inquiries/events/history. | Client private portal data remains scoped. |
| Suppliers/vendors | `/dashboard/suppliers`, `/dashboard/suppliers/[supplierView]`, `/dashboard/vendors` | S2 | Supplier Network Operations with applications, quotes, readiness, reliability. | Supplier private reviews PMCM-only. |
| Team/tasks | `/dashboard/team`, `/dashboard/team/[teamView]`, `/dashboard/tasks`, `/dashboard/tasks/[taskView]` | S3 | Merge into staffing heatmap, run sheet, live ops, and command inbox. | Coordinator role visibility remains restricted. |
| Finance | `/dashboard/finance`, `/dashboard/finance/[financeView]` | S2 | Commercial workflow and billing operations view. | CE and internal costs PMCM-only. |
| Files | `/dashboard/files`, `/dashboard/files/[fileView]` | S3 | File Requirements Matrix and document operations. | Role-specific visibility and upload validation. |
| Messages | `/dashboard/messages`, `/dashboard/messages/[messageView]` | S2 | Communication queue with templates, channel state, audit; renderer now starts at `EventMessagesWorkspace`. | No direct external sends without queue/adapters. |
| Calendar | `/dashboard/calendar`, `/dashboard/calendar/[calendarView]` | S2 | Operational schedule and staffing view. | Avoid duplicating event workspace. |
| Audit/settings | `/dashboard/audit`, `/dashboard/settings`, `/dashboard/settings/[settingView]` | S2 | Privacy operations, audit, feature toggles, templates, account settings. | PMCM-only; audit append-only. |

## Supplier Portal Route Inventory

| Surface | Routes | Severity | Redesign direction | Must preserve |
| --- | --- | --- | --- | --- |
| Supplier landing | `/` | S1 | Public supplier entry with application/status path. | No dashboard link without sign-in/application token. |
| Supplier sign-in | `/sign-in` | S1 | Keep direct and scoped to supplier identity. | No PMCM data. |
| Supplier dashboard | `/dashboard` | S2 | Quote, assignment, readiness, contract, event-day status, and application state. | Supplier sees only assigned/application-scoped records. |

## Guest Portal Route Inventory

| Surface | Routes | Severity | Redesign direction | Must preserve |
| --- | --- | --- | --- | --- |
| Guest landing | `/` | S0/S1 | Keep lightweight. Route users to code entry. | No account-heavy flow. |
| Guest sign-in | `/sign-in` | S1 | Keep fallback only if needed by seeded/sample access. | No broad event browsing. |
| Open code | `/open` | S1 | Make event code entry and consent clear. | Event-code scoped access. |
| Guest dashboard | `/dashboard` | S1/Gate | Check-in, event info, feedback. Gate QR/media upload. | Consent required; no cross-event data. |

## API And Package Inventory

| Area | Current files | Severity | Redesign direction | Owner |
| --- | --- | --- | --- | --- |
| Backend bounded contexts | `apps/api/src/modules/<context>/` | S2 | Keep write ownership inside the owning context; compose cross-domain reads only in `modules/read-models`; expose only public indices, serializable contracts, or focused ports. | D |
| Backend kernel/compatibility | `apps/api/src/kernel/<concern>/`, `apps/api/src/compatibility/sample/` | S2 | Keep database, event-core, access/session primitives, health, and shared helpers out of business contexts; keep sample aggregation behind `/sample/*`. | D |
| Shared UI | `packages/ui/src/*` | S1 | Keep presentation-only; add app-specific blocks only after route inventory demands them. | A |
| Shared contracts | `packages/types/src/*` | S2 | PMCM command inbox, selected-event workspace, client action-center, supplier readiness-board, guest event pass, and file matrix contracts exist. File UI may use `PrismFileRequirementsMatrix` for metadata status and visibility; upload-session, signed URL, retry, progress, and bulk upload UI are blocked until the storage adapter contract is approved and tested. | D |
| API client | `packages/api-client/src/*` | S1 | PMCM command inbox, selected-event workspace, client action-center, and supplier readiness-board helpers now exist; keep removing broad state usage gradually. | D |

## System Completion Gap Map

This map connects the app/package inventory to remaining product work. Update it when a feature family moves to delivered, thin delivered, gated, or deferred.

| Area | Complete enough today | Remaining work | DRI | Support | Verification |
| --- | --- | --- | --- | --- | --- |
| `apps/event` PMCM command | Command inbox and selected-event workspace contracts exist; root entry and several workspace components are extracted. | Make command inbox the working center, deepen one selected-event area, record which finance/files/closure/live-ops tabs remain compatibility-owned. | Francis | Maxine, Anthony | `@prism/event` typecheck; route checks for `/dashboard`, `/dashboard/events`, selected event route; screenshot. |
| `apps/event` coordinator/live ops | Live-ops/readiness hooks and coordinator-related data exist in partial form. | Pick one coordinator/staffing/live-ops slice or gate it; do not attempt heatmap, run sheet, and replacement depth together. | Francis | Anthony | Focused API/read-model tests if behavior changes; PMCM route check. |
| `apps/client` public/auth | Public inquiry and sign-in routes exist; client session helpers are shared. | Verify public pages cannot jump to dashboard; clarify accepted inquiry/conforme requirement in copy/states. | Ethan | Anthony, Maxine | Route checks for `/`, `/inquiry`, `/sign-in`, `/dashboard`. |
| `apps/client` dashboard/action center | `PrismClientActionCenter` feeds dashboard actions with fallback. | Make next-action hierarchy first, remove or label broad fallback, add file/billing/floorplan/closeout cards only from existing contracts. | Ethan | Maxine, Anthony | `@prism/client` typecheck; client action-center route screenshot; official floorplan read-only evidence. |
| `apps/supplier` dashboard | Supplier readiness board is visible and supplier-scoped contracts exist. | Redesign top section around quote, assignment, readiness, contract metadata, event-day status, and application/status messaging. | Ethan | Francis, Anthony, Maxine | `@prism/supplier` typecheck; supplier readiness tests; mobile screenshot. |
| `apps/guest` access and dashboard | Guest event pass contract exists and open-code flow is available. | Clarify code entry, consent, check-in, walk-in flag, moderated feedback, invalid code, and QR/media gates. | Ethan | Anthony, Maxine | `@prism/guest` typecheck; guest workflow tests; mobile screenshot. |
| `apps/api` capability modules | Scoped read models, policy tests, file matrix, auth/runtime DB guidance, and many workflow services exist. | Add tests only for touched slices; reject new normal `/api/sample/state` dependencies and any recreation of a centralized god hub. | Anthony | Francis, Ethan | Focused API tests; `prism-api` typecheck; boundary checks; DB doctors. |
| `packages/types` | Shared role read models, lifecycle helpers, session helpers, action/result/error/list/file-matrix contracts exist. | Add fields only when an app surface depends on them; avoid unused speculative types. | Anthony | Francis, Ethan, Maxine | `@prism/types` typecheck/test. |
| `packages/api-client` | Scoped helpers exist for PMCM, client, supplier, guest, billing, event file requirements, and normalized API problems. | Add endpoint helpers before app code depends on new routes; keep sample aggregate compatibility-only. | Anthony | Francis, Ethan | `@prism/api-client` typecheck/test. |
| `packages/ui` | Shared shell/public/client blocks exist. | Classify reusable primitives and keep workflow logic out; apply shell rules to first PMCM and portal surfaces. | Maxine | Francis, Ethan | UX brief; visual QA checklist; app typechecks. |
| Docs/evidence | Living product, architecture, roadmap, and readiness docs. | Keep ledger, inventory, readiness, and architecture docs aligned after each merge; add screenshots and command evidence when claiming demo readiness. | Anthony | Maxine, Francis, Ethan | `git diff --check`; constitution and directory indexes; clean branch status. |

## Redesign Sequencing

1. Maxine and Anthony lock shell patterns, route inventory, typed contracts, sample-state boundaries, session/storage conventions, and the owner system goal for each branch.
2. Francis starts PMCM command dashboard and selected event workspace restructuring against the PMCM/coordinator operability goal.
3. Ethan starts client action center and supplier readiness workflow against the external portal safety/action goal.
4. Anthony verifies API role boundaries before app work merges.
5. Maxine reviews visual/system consistency across all role apps.

## Inventory Acceptance

- Every current app has an owner and redesign severity.
- Every owner has a system goal and each active redesign branch states which goal it advances.
- Public routes remain public-only.
- Signed-in dashboards remain signed-in-only.
- The PMCM app is not collapsed into the client app.
- The client cannot mutate official floorplans.
- Supplier, coordinator, and guest routes do not expose PMCM-only data.
- The old standalone UI modernization plan is retired; future redesign work follows living docs (`AGENTS.md`, the constitution, product docs, and architecture ADRs).
- Redesign branches follow `readiness-foundation.md` and do not add new broad sample-state, app-local session-key, or cross-role import coupling.

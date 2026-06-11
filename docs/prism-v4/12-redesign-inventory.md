# P.R.I.S.M Whole-App Redesign Inventory

Last updated: 2026-06-11

This is the Phase 0 redesign inventory for the whole-app capability maturity plan. It classifies current app surfaces by redesign severity so four owners can work in parallel without turning P.R.I.S.M back into an all-role shell.

Severity scale:

| Severity | Meaning |
| --- | --- |
| S0 | Preserve. Only fix bugs, accessibility, or consistency issues. |
| S1 | Light polish. Keep route and workflow, improve layout/copy/states. |
| S2 | Workflow redesign. Route stays, but page needs stronger IA, action model, or data boundaries. |
| S3 | Structural redesign. Split, merge, or replace the workflow surface. |
| Gate | Do not deepen until prerequisite is complete. |

## App-Level Summary

| App | Product role | Current route shape | Redesign priority | Primary owner | Notes |
| --- | --- | --- | --- | --- | --- |
| `apps/client` | Public inquiry plus signed-in client portal | Landing, inquiry, sign-in/sign-up, dashboard, event sections, billing/files/messages/calendar/approvals | S2 | Owner C | Needs Client Action Center, tighter event-scoped reads, and clearer public-to-signed-in boundary. |
| `apps/event` | PMCM admin and coordinator command app | Large dashboard with many filtered subroutes plus selected event workspace | S3 | Owner B | Needs Event Command Inbox, event workspace IA, staffing/live-ops redesign, and route consolidation. |
| `apps/supplier` | Supplier portal | Landing, sign-in, dashboard | S2 | Owner C | Needs supplier application/status and Supplier Readiness Board while preserving supplier-scoped data. |
| `apps/guest` | Lightweight guest portal | Landing, sign-in, open code, dashboard | S1/Gate | Owner C | Keep lightweight. Gate QR/camera and media upload until HTTPS, consent, upload, and moderation are ready. |
| `apps/api` | Shared NestJS API | Event-ops controllers/services plus plans/templates/publishing/health modules | S2 | Owner D | Needs contract consolidation, service extraction, permission matrix, and adapter boundaries. |
| `packages/ui` | Shared presentation system | App shell, public shell, primitives, blocks, client/public blocks | S1 | Owner A | Keep presentation-only. Continue component consolidation through actual app needs. |
| `packages/types` | Shared contracts | Lifecycle and event-ops types | S2 | Owner D | Expand route/feature contracts before large app redesign. |
| `packages/api-client` | Shared request helpers | Event-ops client and HTTP helper | S1 | Owner D | Keep stable, add typed clients when app surfaces stop using broad state. |

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
| Public entry/auth | `/`, `/sign-in` | S1 | Keep as PMCM/coordinator entry; no marketing hero. | Signed-in surfaces only after auth. |
| Command dashboard | `/dashboard`, `/dashboard/[dashboardView]` | S3 | Replace with Event Command Inbox, health score, and focused work queues. | PMCM-only operational visibility. |
| Inquiries | `/dashboard/inquiries` | S2 | PMCM intake queue with accept/pend/decline, referrals, duplicates, conforme path. | Public inquiry role separation. |
| Events list | `/dashboard/events`, status/by-client/by-type filters | S2 | Event portfolio with lifecycle state, health, owner, risk, next action. | No client portal behavior inside PMCM route. |
| Selected event | `/dashboard/events/[eventId]`, overview/briefing/billing/floorplans/suppliers/coordinators/live-ops/closure/activity | S3 | Make selected event workspace the primary PMCM operating surface. | PMCM owns official floorplans and internal cost/supplier/coordinator details. |
| Clients | `/dashboard/clients`, active/past/prospects/archived, `/dashboard/clients/[clientId]` | S2 | Client relationship view tied to inquiries/events/history. | Client private portal data remains scoped. |
| Suppliers/vendors | `/dashboard/suppliers`, `/dashboard/suppliers/[supplierView]`, `/dashboard/vendors` | S2 | Supplier Network Operations with applications, quotes, readiness, reliability. | Supplier private reviews PMCM-only. |
| Team/tasks | `/dashboard/team`, `/dashboard/team/[teamView]`, `/dashboard/tasks`, `/dashboard/tasks/[taskView]` | S3 | Merge into staffing heatmap, run sheet, live ops, and command inbox. | Coordinator role visibility remains restricted. |
| Finance | `/dashboard/finance`, `/dashboard/finance/[financeView]` | S2 | Commercial workflow and billing operations view. | CE and internal costs PMCM-only. |
| Files | `/dashboard/files`, `/dashboard/files/[fileView]` | S3 | File Requirements Matrix and document operations. | Role-specific visibility and upload validation. |
| Messages | `/dashboard/messages`, `/dashboard/messages/[messageView]` | S2 | Communication queue with templates, channel state, audit. | No direct external sends without queue/adapters. |
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
| Guest sign-in | `/sign-in` | S1 | Keep fallback only if needed by seeded/demo access. | No broad event browsing. |
| Open code | `/open` | S1 | Make event code entry and consent clear. | Event-code scoped access. |
| Guest dashboard | `/dashboard` | S1/Gate | Check-in, event info, feedback. Gate QR/media upload. | Consent required; no cross-event data. |

## API And Package Inventory

| Area | Current files | Severity | Redesign direction | Owner |
| --- | --- | --- | --- | --- |
| Event-ops API | `apps/api/libs/modules/event-ops/src/controllers/*`, `services/*` | S2 | Continue extracting service ownership by inquiry, onboarding, billing, floorplan, supplier, coordinator, privacy, live ops, AI. | D |
| Plans/templates/publishing modules | `apps/api/libs/modules/plans`, `templates`, `publishing` | S1/S2 | Keep if active; verify they map to real product workflows or fold into templates/document operations. | D |
| Shared UI | `packages/ui/src/*` | S1 | Keep presentation-only; add app-specific blocks only after route inventory demands them. | A |
| Shared contracts | `packages/types/src/*` | S2 | Add DTO/feature contracts before route redesigns depend on them. | D |
| API client | `packages/api-client/src/*` | S1 | Keep typed helpers; remove broad state usage gradually. | D |

## Redesign Sequencing

1. Owner A and Owner D lock shell patterns, route inventory, and typed contracts.
2. Owner B starts PMCM command dashboard and selected event workspace restructuring.
3. Owner C starts client action center and supplier readiness workflow.
4. Owner D verifies API role boundaries before app work merges.
5. Owner A reviews visual/system consistency across all role apps.

## Inventory Acceptance

- Every current app has an owner and redesign severity.
- Public routes remain public-only.
- Signed-in dashboards remain signed-in-only.
- The PMCM app is not collapsed into the client app.
- The client cannot mutate official floorplans.
- Supplier, coordinator, and guest routes do not expose PMCM-only data.
- The old standalone UI modernization plan is retired because the active maturity plan owns future redesign work.

# Controller Ownership Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HTTP controller ownership from the `event-ops` compatibility module into owning capability modules one controller family at a time, while keeping public route paths and DTO behavior stable.

**Architecture:** Capability modules should register controllers that call their owned services directly. `event-ops` may keep compatibility re-exports and facade delegates only while unmoved controllers still depend on them. This phase started with the public guest controller because `guest-ops` already owns guest access-code reads, check-ins, feedback writes, and payload mapping. The next slice moves supplier quote-token routes because `commercial-ops` already owns supplier quote request lookup, submission, revision, and supplier-facing quote decisions.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for the redesign contract foundation. |
| Feature-ledger row | Guest portal/live attendance, role-scoped public guest payloads, and supplier commercial quote submission/revision. |
| Route/app/actor | `GET /guest/events/:accessCode`, `POST /guest/events/:accessCode/check-ins`, `POST /guest/events/:accessCode/feedback`; actor is public guest via access code. `GET /quote-requests/:token`, `POST /quote-requests/:token/quote`, and `PATCH /quote-requests/:token/quote`; actor is supplier via quote token. |
| Contract touched | Controller ownership only; route paths and DTO fields remain stable; supplier quote DTO now has a commercial-owned copy matching the legacy DTO. |
| Fallback state | Old `event-ops/src/controllers/guest.controller.ts` and `event-ops/src/controllers/quote-requests.controller.ts` paths remain compatibility re-exports but are no longer registered by `EVENT_OPS_CONTROLLERS`. |
| Route-smoke evidence | Guest and quote-request controller route metadata/delegation tests, event-ops controller route registry test, guest/commercial workflow tests, event-ops suite, build, and boundary check. |

## Controller Ownership Map

| Controller family | Target owner | Status |
| --- | --- | --- |
| `guest.controller.ts` | `guest-ops` | Moved in this slice. |
| `inquiries.controller.ts` | `inquiry-onboarding` | Pending. |
| `quote-requests.controller.ts` | `commercial-ops` | Moved in commercial slice. |
| `billing.controller.ts` | `finance-ops` or `event-read-models` for billing reads | Pending. |
| `supplier-workspace.controller.ts`, `suppliers.controller.ts` | `supplier-ops` | Pending. |
| `coordinator-workspace.controller.ts` | `staffing-ops` / later live-ops split | Pending. |
| `pmcm-dashboard.controller.ts`, dashboard reads | `event-read-models` | Pending. |
| `events.controller.ts` | Split across event-core, floorplan, compliance-ops, closure-ops, event-read-models | Pending. |
| `audit-privacy.controller.ts` | `trust-ops` | Pending. |
| `notifications.controller.ts` | `notification-ops` | Pending. |
| `auth.controller.ts` | identity/auth module | Pending. |
| `ai.controller.ts` | future ai-governance module | Pending. |
| `sample.controller.ts` | sample/demo compatibility module or final removal | Pending. |

## Tasks

- [x] Create guest-owned DTOs for guest check-in, feedback, and upload metadata.
- [x] Create `guest-ops` controller that calls `GuestWorkflowService` directly.
- [x] Register `OpsGuestController` in `GuestOpsModule` and export it from the guest barrel.
- [x] Remove guest controller registration from `EVENT_OPS_CONTROLLERS`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add guest controller route/delegation smoke tests.
- [x] Update event-ops route registry test to cover only event-ops-owned controllers.
- [x] Create commercial-owned supplier quote DTO and supplier-facing quote mappers.
- [x] Create `commercial-ops` quote-request controller that calls `CommercialWorkflowService` directly.
- [x] Register `OpsQuoteRequestsController` in `CommercialOpsModule` and export it from the commercial barrel.
- [x] Remove quote-request controller registration from `EVENT_OPS_CONTROLLERS`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add quote-request controller route/delegation smoke tests.
- [ ] Move the remaining controller families one module at a time.
- [ ] When all controllers are moved, mark the master Phase 13 checklist complete and proceed to Phase 14 facade retirement.

## Self-Review

- Spec coverage: Guest and supplier quote-token controller families moved without changing public route paths or response mapping.
- Boundary clarity: `guest-ops` and `commercial-ops` controllers import only local DTOs/mappers/services; they do not import `event-ops` internals.
- Remaining risk: Most controllers still live in `event-ops`; this is an incremental Phase 13 checkpoint, not full Phase 13 completion.

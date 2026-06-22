# Controller Ownership Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HTTP controller ownership from the `event-ops` compatibility module into owning capability modules one controller family at a time, while keeping public route paths and DTO behavior stable.

**Architecture:** Capability modules should register controllers that call their owned services directly. `event-ops` may keep compatibility re-exports and facade delegates only while unmoved controllers still depend on them. This phase started with the public guest controller because `guest-ops` already owns guest access-code reads, check-ins, feedback writes, and payload mapping. The next slices moved supplier quote-token routes because `commercial-ops` already owns supplier quote request lookup, submission, revision, and supplier-facing quote decisions, then moved inquiry routes because `inquiry-onboarding` owns inquiry creation, PMCM inquiry listing, status decisions, reminders, and conforme upload workflow, then moved billing reads because `event-read-models` owns billing workspace composition while `finance-ops` owns billing formatting and finance commands.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for the redesign contract foundation. |
| Feature-ledger row | Guest portal/live attendance, role-scoped public guest payloads, supplier commercial quote submission/revision, public/PMCM inquiry onboarding, and billing workspace read models. |
| Route/app/actor | `GET /guest/events/:accessCode`, `POST /guest/events/:accessCode/check-ins`, `POST /guest/events/:accessCode/feedback`; actor is public guest via access code. `GET /quote-requests/:token`, `POST /quote-requests/:token/quote`, and `PATCH /quote-requests/:token/quote`; actor is supplier via quote token. `GET /inquiries`, `POST /inquiries`, `POST /inquiries/log-on-behalf`, `PATCH /inquiries/:inquiryId/status`, `POST /inquiries/:inquiryId/conforme-reminders`, and `POST /inquiries/:inquiryId/conforme`; actors are public client and PMCM/system. `GET /billing`; actors are PMCM/system/client through billing read-model scope. |
| Contract touched | Controller ownership only; route paths and DTO fields remain stable; supplier quote DTO now has a commercial-owned copy matching the legacy DTO; inquiry DTOs now have inquiry-onboarding-owned copies matching the legacy DTOs; billing read model actor DTO now has an event-read-model-owned copy matching the legacy actor query shape. |
| Fallback state | Old `event-ops/src/controllers/guest.controller.ts`, `event-ops/src/controllers/quote-requests.controller.ts`, `event-ops/src/controllers/inquiries.controller.ts`, and `event-ops/src/controllers/billing.controller.ts` paths remain compatibility re-exports but are no longer registered by `EVENT_OPS_CONTROLLERS`. |
| Route-smoke evidence | Guest, quote-request, inquiry, and billing controller route metadata/delegation tests, event-ops controller route registry test, guest/commercial/inquiry workflow tests, event-ops suite, build, and boundary check. |

## Controller Ownership Map

| Controller family | Target owner | Status |
| --- | --- | --- |
| `guest.controller.ts` | `guest-ops` | Moved in this slice. |
| `inquiries.controller.ts` | `inquiry-onboarding` | Moved in inquiry slice. |
| `quote-requests.controller.ts` | `commercial-ops` | Moved in commercial slice. |
| `billing.controller.ts` | `event-read-models` for billing reads | Moved in billing read-model slice. |
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
- [x] Create inquiry-onboarding-owned inquiry DTOs and inquiry/document mappers.
- [x] Create `inquiry-onboarding` inquiries controller that calls `InquiryWorkflowService` directly.
- [x] Register `OpsInquiriesController` in `InquiryOnboardingModule` and export it from the inquiry barrel.
- [x] Remove inquiries controller registration from `EVENT_OPS_CONTROLLERS`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add inquiries controller route/delegation smoke tests.
- [x] Create event-read-model-owned billing controller DTO and event mapper.
- [x] Create `event-read-models` billing controller that calls `EventReadModelsService.billing` directly and composes finance mappers from `finance-ops`.
- [x] Register `OpsBillingController` in `EventReadModelsModule`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add billing controller route/delegation smoke tests.
- [ ] Move the remaining controller families one module at a time.
- [ ] When all controllers are moved, mark the master Phase 13 checklist complete and proceed to Phase 14 facade retirement.

## Self-Review

- Spec coverage: Guest, supplier quote-token, inquiry, and billing controller families moved without changing public route paths or response mapping.
- Boundary clarity: `guest-ops`, `commercial-ops`, `inquiry-onboarding`, and `event-read-models` controllers import only local DTOs/mappers/services and public access-control; they do not import `event-ops` internals.
- Remaining risk: Most controllers still live in `event-ops`; this is an incremental Phase 13 checkpoint, not full Phase 13 completion.

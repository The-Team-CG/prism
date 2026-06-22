# Controller Ownership Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HTTP controller ownership from the `event-ops` compatibility module into owning capability modules one controller family at a time, while keeping public route paths and DTO behavior stable.

**Architecture:** Capability modules should register controllers that call their owned services directly. `event-ops` may keep compatibility re-exports and facade delegates only while unmoved controllers still depend on them. This phase started with the public guest controller because `guest-ops` already owns guest access-code reads, check-ins, feedback writes, and payload mapping. The next slices moved supplier quote-token routes because `commercial-ops` already owns supplier quote request lookup, submission, revision, and supplier-facing quote decisions, then moved inquiry routes because `inquiry-onboarding` owns inquiry creation, PMCM inquiry listing, status decisions, reminders, and conforme upload workflow, then moved billing reads because `event-read-models` owns billing workspace composition while `finance-ops` owns billing formatting and finance commands, then moved notification acknowledgement because `notification-ops` owns notification outbox state, then moved client workspace reads because `event-read-models` owns client workspace and action-center composition, and then moved the PMCM command-inbox read because `event-read-models` owns PMCM command-inbox composition.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for the redesign contract foundation. |
| Feature-ledger row | Guest portal/live attendance, role-scoped public guest payloads, supplier commercial quote submission/revision, public/PMCM inquiry onboarding, billing workspace read models, notification acknowledgement state, client workspace/action-center read models, PMCM command-inbox read model, coordinator directory reads, onboarding read models, and trust/privacy operations. |
| Route/app/actor | `GET /guest/events/:accessCode`, `POST /guest/events/:accessCode/check-ins`, `POST /guest/events/:accessCode/feedback`; actor is public guest via access code. `GET /quote-requests/:token`, `POST /quote-requests/:token/quote`, and `PATCH /quote-requests/:token/quote`; actor is supplier via quote token. `GET /inquiries`, `POST /inquiries`, `POST /inquiries/log-on-behalf`, `PATCH /inquiries/:inquiryId/status`, `POST /inquiries/:inquiryId/conforme-reminders`, and `POST /inquiries/:inquiryId/conforme`; actors are public client and PMCM/system. `GET /billing`; actors are PMCM/system/client through billing read-model scope. `POST /notifications/:notificationId/acknowledge`; actor scope is existing notification acknowledgement behavior. `GET /client/workspace` and `GET /client/action-center`; actors are client-scoped through read-model policy. `GET /coordinators`; actors are PMCM/system/coordinator through staffing role policy. `GET /pmcm/command-inbox`; actors are PMCM/system/coordinator through PMCM read-model policy. `GET /onboarding`; actors are PMCM/system through inquiry-onboarding role policy. `/audit/*` and `/privacy/*`; actors are PMCM/system through trust route policy. |
| Contract touched | Controller ownership only; route paths and DTO fields remain stable; supplier quote DTO now has a commercial-owned copy matching the legacy DTO; inquiry DTOs now have inquiry-onboarding-owned copies matching the legacy DTOs; billing read model actor DTO now has an event-read-model-owned copy matching the legacy actor query shape; notification acknowledgement response mapper now lives in notification-ops; client workspace DTO and mappers now live in event-read-models; PMCM command-inbox actor DTO now reuses the event-read-model actor query shape; coordinator directory DTO now lives in staffing-ops; onboarding now reuses inquiry-owned actor DTO and mappers; audit/privacy DTOs now live in trust-ops. |
| Fallback state | Old `event-ops/src/controllers/guest.controller.ts`, `event-ops/src/controllers/quote-requests.controller.ts`, `event-ops/src/controllers/inquiries.controller.ts`, `event-ops/src/controllers/billing.controller.ts`, `event-ops/src/controllers/notifications.controller.ts`, the client export from `event-ops/src/controllers/client-workspace.controller.ts`, the coordinator directory export from `event-ops/src/controllers/coordinator-workspace.controller.ts`, the onboarding export from `event-ops/src/controllers/client-workspace.controller.ts`, and the audit/privacy export from `event-ops/src/controllers/audit-privacy.controller.ts` remain compatibility re-exports but are no longer registered by `EVENT_OPS_CONTROLLERS`. |
| Route-smoke evidence | Guest, quote-request, inquiry, billing, notification, client, PMCM command-inbox, coordinator, onboarding, and audit/privacy controller route metadata/delegation tests, event-ops controller route registry test, guest/commercial/inquiry workflow tests, event-ops suite, build, and boundary check. |

## Controller Ownership Map

| Controller family | Target owner | Status |
| --- | --- | --- |
| `guest.controller.ts` | `guest-ops` | Moved in this slice. |
| `inquiries.controller.ts` | `inquiry-onboarding` | Moved in inquiry slice. |
| `quote-requests.controller.ts` | `commercial-ops` | Moved in commercial slice. |
| `billing.controller.ts` | `event-read-models` for billing reads | Moved in billing read-model slice. |
| `client-workspace.controller.ts` / `OpsClientController` | `event-read-models` for client workspace/action-center reads | Moved in client read-model slice. |
| `client-workspace.controller.ts` / `OpsOnboardingController` | `inquiry-onboarding` for onboarding reads | Moved in onboarding read slice. |
| `supplier-workspace.controller.ts`, `suppliers.controller.ts` | `supplier-ops` | Pending. |
| `coordinator-workspace.controller.ts` / `OpsCoordinatorsController` | `staffing-ops` for coordinator directory reads | Moved in staffing read slice. |
| `coordinator-workspace.controller.ts` / `OpsCoordinatorWorkspaceController` | `staffing-ops` / later live-ops split | Pending. |
| `pmcm-dashboard.controller.ts` / `command-inbox` | `event-read-models` | Moved in PMCM command-inbox read slice. |
| `pmcm-dashboard.controller.ts` / dashboard + event workspace | `event-read-models` | Pending. |
| `events.controller.ts` | Split across event-core, floorplan, compliance-ops, closure-ops, event-read-models | Pending. |
| `audit-privacy.controller.ts` | `trust-ops` | Moved in trust route slice. |
| `notifications.controller.ts` | `notification-ops` | Moved in notification slice. |
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
- [x] Create notification-ops-owned notification response mapper.
- [x] Create `notification-ops` notifications controller that calls `NotificationOutboxService.acknowledge` directly.
- [x] Register `OpsNotificationsController` in `NotificationOpsModule`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add notifications controller route/delegation smoke tests.
- [x] Create event-read-model-owned client workspace/action-center controller and client mappers.
- [x] Register `OpsClientController` in `EventReadModelsModule`; keep the old event-ops controller file as onboarding plus client compatibility export.
- [x] Remove client controller registration from `EVENT_OPS_CONTROLLERS`.
- [x] Add client controller route/delegation smoke tests.
- [x] Create staffing-owned coordinator directory controller and actor DTO.
- [x] Register `OpsCoordinatorsController` in `StaffingOpsModule`; keep the old event-ops controller file as coordinator workspace plus coordinator-directory compatibility export.
- [x] Remove coordinator directory controller registration from `EVENT_OPS_CONTROLLERS`.
- [x] Add coordinator directory route/delegation smoke tests.
- [x] Create event-read-model-owned PMCM command-inbox controller that calls `EventReadModelsService.pmcmCommandInbox` directly.
- [x] Register `OpsPmcmCommandInboxController` in `EventReadModelsModule`; keep dashboard and event workspace in the old PMCM compatibility controller.
- [x] Remove the duplicate command-inbox handler from `event-ops` PMCM controller while preserving `/pmcm/dashboard` and `/pmcm/events/:eventId/workspace`.
- [x] Add PMCM command-inbox route/delegation smoke tests.
- [ ] Move the remaining controller families one module at a time.
- [ ] When all controllers are moved, mark the master Phase 13 checklist complete and proceed to Phase 14 facade retirement.

## Self-Review

- Spec coverage: Guest, supplier quote-token, inquiry, billing, notification, client read, PMCM command-inbox, coordinator directory, onboarding read, and audit/privacy controller families moved without changing public route paths or response mapping.
- Boundary clarity: `guest-ops`, `commercial-ops`, `inquiry-onboarding`, `event-read-models`, `notification-ops`, `staffing-ops`, and `trust-ops` controllers import only local DTOs/mappers/services and public access-control; they do not import `event-ops` internals.
- Remaining risk: Most controllers still live in `event-ops`; this is an incremental Phase 13 checkpoint, not full Phase 13 completion.

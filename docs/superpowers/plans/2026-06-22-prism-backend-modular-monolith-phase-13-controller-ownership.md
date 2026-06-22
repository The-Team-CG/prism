# Controller Ownership Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HTTP controller ownership from the `event-ops` compatibility module into owning capability modules one controller family at a time, while keeping public route paths and DTO behavior stable.

**Architecture:** Capability modules should register controllers that call their owned services directly. `event-ops` may keep compatibility re-exports and facade delegates only while unmoved controllers still depend on them. This phase started with the public guest controller because `guest-ops` already owns guest access-code reads, check-ins, feedback writes, and payload mapping. The next slices moved supplier quote-token routes because `commercial-ops` already owns supplier quote request lookup, submission, revision, and supplier-facing quote decisions, then moved inquiry routes because `inquiry-onboarding` owns inquiry creation, PMCM inquiry listing, status decisions, reminders, and conforme upload workflow, then moved billing reads because `event-read-models` owns billing workspace composition while `finance-ops` owns billing formatting and finance commands, then moved notification acknowledgement because `notification-ops` owns notification outbox state, then moved client workspace reads because `event-read-models` owns client workspace and action-center composition, then moved the PMCM command-inbox read because `event-read-models` owns PMCM command-inbox composition, then moved local sample auth routes because `identity-ops` owns login, account approval, and login-history behavior, then moved the AI governance dry-run route because `ai-governance` owns AI sanitation, ZDR gating, and approval-record creation, then moved supplier directory reads because `supplier-ops` now owns `SuppliersService` and the supplier directory provider token, then moved supplier write routes because `supplier-ops` owns `SupplierProfileCommandsService` for supplier profile commands, then moved PMCM dashboard/event-workspace reads because `event-read-models` owns PMCM read-model composition, then moved compliance rule routes because `compliance-ops` owns compliance rule reads/writes, then moved coordinator workspace reads because `staffing-ops` owns coordinator identity, assignment lookup, and workspace read composition, then moved event-scoped compliance execution because `compliance-ops` owns compliance check generation/resolution and check mapping, then moved event list/detail reads because `event-read-models` owns actor-visible event query budgets and event response mapping, and then moved event floorplan routes because `floorplan` owns official floorplan commands, client layout preferences, snapshots, and draft mapping.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for the redesign contract foundation. |
| Feature-ledger row | Guest portal/live attendance, role-scoped public guest payloads, supplier commercial quote submission/revision, public/PMCM inquiry onboarding, billing workspace read models, notification acknowledgement state, client workspace/action-center read models, PMCM command-inbox read model, coordinator directory reads, onboarding read models, trust/privacy operations, local sample auth/account approval, AI governance dry-run, supplier directory reads, supplier write commands, PMCM dashboard/event-workspace read models, compliance rule management, coordinator workspace reads, event-scoped compliance checks, and actor-visible event list/detail reads, and official/client floorplan workflows. |
| Route/app/actor | `GET /guest/events/:accessCode`, `POST /guest/events/:accessCode/check-ins`, `POST /guest/events/:accessCode/feedback`; actor is public guest via access code. `GET /quote-requests/:token`, `POST /quote-requests/:token/quote`, and `PATCH /quote-requests/:token/quote`; actor is supplier via quote token. `GET /inquiries`, `POST /inquiries`, `POST /inquiries/log-on-behalf`, `PATCH /inquiries/:inquiryId/status`, `POST /inquiries/:inquiryId/conforme-reminders`, and `POST /inquiries/:inquiryId/conforme`; actors are public client and PMCM/system. `GET /billing`; actors are PMCM/system/client through billing read-model scope. `POST /notifications/:notificationId/acknowledge`; actor scope is existing notification acknowledgement behavior. `GET /client/workspace` and `GET /client/action-center`; actors are client-scoped through read-model policy. `GET /coordinators`; actors are PMCM/system/coordinator through staffing role policy. `GET /pmcm/command-inbox`; actors are PMCM/system/coordinator through PMCM read-model policy. `GET /onboarding`; actors are PMCM/system through inquiry-onboarding role policy. `/audit/*` and `/privacy/*`; actors are PMCM/system through trust route policy. `/auth/*`; actors follow existing local sample auth and approval behavior. `POST /ai/governance/dry-run`; actors follow existing AI governance dry-run behavior. `GET /suppliers/categories`, `GET /suppliers`, `POST /suppliers`, `PATCH /suppliers/:supplierId`, `PATCH /suppliers/:supplierId/tier`, `POST /suppliers/:supplierId/reviews`, and `POST /suppliers/:supplierId/certifications`; actors follow existing supplier category/directory and supplier command role policy. `GET /pmcm/dashboard` and `GET /pmcm/events/:eventId/workspace`; actors are PMCM/system through PMCM read-model policy. `GET /compliance/rules`, `POST /compliance/rules`, and `PATCH /compliance/rules/:ruleId`; actors are PMCM/system through compliance policy. `GET /coordinator/workspace`; actor is coordinator through staffing role policy. `POST /events/:eventId/compliance` and `PATCH /events/:eventId/compliance/:checkId`; behavior remains existing event-scoped compliance execution/resolution. `GET /events` and `GET /events/:eventId`; actors use the existing event visibility policy through event-read-models. `POST /events/:eventId/floorplans`, `POST /events/:eventId/floorplan-preferences`, `POST /events/:eventId/floorplans/:draftId/submit`, `POST /events/:eventId/floorplans/:draftId/approve`, and `GET /events/:eventId/floorplans/:draftId/snapshot`; actors use existing floorplan route policy. |
| Contract touched | Controller ownership only; route paths and DTO fields remain stable; supplier quote DTO now has a commercial-owned copy matching the legacy DTO; inquiry DTOs now have inquiry-onboarding-owned copies matching the legacy DTOs; billing read model actor DTO now has an event-read-model-owned copy matching the legacy actor query shape; notification acknowledgement response mapper now lives in notification-ops; client workspace DTO and mappers now live in event-read-models; PMCM command-inbox actor DTO now reuses the event-read-model actor query shape; coordinator directory DTO now lives in staffing-ops; onboarding now reuses inquiry-owned actor DTO and mappers; audit/privacy DTOs now live in trust-ops; auth DTOs now live in identity-ops; AI governance DTOs now live in ai-governance; supplier directory and command DTOs now live in supplier-ops; PMCM dashboard mappers/controller now live in event-read-models; compliance rule DTOs/controller/mappers now live in compliance-ops; coordinator workspace read service/controller now live in staffing-ops; event-scoped compliance DTOs/controller/check mapper now live in compliance-ops; event list/detail controller and read-model methods now live in event-read-models; event floorplan controller and DTOs now live in floorplan. |
| Fallback state | Old `event-ops/src/controllers/guest.controller.ts`, `event-ops/src/controllers/quote-requests.controller.ts`, `event-ops/src/controllers/inquiries.controller.ts`, `event-ops/src/controllers/billing.controller.ts`, `event-ops/src/controllers/notifications.controller.ts`, the client export from `event-ops/src/controllers/client-workspace.controller.ts`, the coordinator directory export from `event-ops/src/controllers/coordinator-workspace.controller.ts`, the onboarding export from `event-ops/src/controllers/client-workspace.controller.ts`, the audit/privacy export from `event-ops/src/controllers/audit-privacy.controller.ts`, the auth export from `event-ops/src/controllers/auth.controller.ts`, the AI governance service export from `event-ops/src/services/ai-governance.service.ts`, the supplier service export from `event-ops/src/services/suppliers.service.ts`, the supplier controller export from `event-ops/src/controllers/suppliers.controller.ts`, the PMCM dashboard controller export from `event-ops/src/controllers/pmcm-dashboard.controller.ts`, the compliance rule controller export from `event-ops/src/controllers/events.controller.ts`, the event-scoped compliance route ownership now lives in `compliance-ops`, event list/detail route ownership now lives in `event-read-models`, event floorplan route ownership now lives in `floorplan`, and the coordinator workspace read export from `event-ops/src/controllers/coordinator-workspace.controller.ts` remain compatibility re-exports but are no longer registered by `EVENT_OPS_CONTROLLERS`. |
| Route-smoke evidence | Guest, quote-request, inquiry, billing, notification, client, PMCM command-inbox, coordinator, onboarding, audit/privacy, auth, AI governance, supplier directory, supplier command, PMCM dashboard, compliance rule, coordinator workspace, event-scoped compliance, event list/detail, and event floorplan route metadata/delegation tests, event-ops controller route registry test, guest/commercial/inquiry workflow tests, event-ops suite, build, and boundary check. |

## Controller Ownership Map

| Controller family | Target owner | Status |
| --- | --- | --- |
| `guest.controller.ts` | `guest-ops` | Moved in this slice. |
| `inquiries.controller.ts` | `inquiry-onboarding` | Moved in inquiry slice. |
| `quote-requests.controller.ts` | `commercial-ops` | Moved in commercial slice. |
| `billing.controller.ts` | `event-read-models` for billing reads | Moved in billing read-model slice. |
| `client-workspace.controller.ts` / `OpsClientController` | `event-read-models` for client workspace/action-center reads | Moved in client read-model slice. |
| `client-workspace.controller.ts` / `OpsOnboardingController` | `inquiry-onboarding` for onboarding reads | Moved in onboarding read slice. |
| `suppliers.controller.ts` / directory reads | `supplier-ops` | Moved in supplier directory read slice. |
| `suppliers.controller.ts` / supplier writes | `supplier-ops` | Moved in supplier command route slice. |
| `supplier-workspace.controller.ts` | `supplier-ops` | Pending. |
| `coordinator-workspace.controller.ts` / `OpsCoordinatorsController` | `staffing-ops` for coordinator directory reads | Moved in staffing read slice. |
| coordinator-workspace.controller.ts / workspace read | staffing-ops | Moved in coordinator workspace read slice. |
| coordinator-workspace.controller.ts / role view | staffing-ops / later live-ops split | Pending. |
| `pmcm-dashboard.controller.ts` / `command-inbox` | `event-read-models` | Moved in PMCM command-inbox read slice. |
| `pmcm-dashboard.controller.ts` / dashboard + event workspace | `event-read-models` | Moved in PMCM dashboard read-model slice. |
| `events.controller.ts` / event-scoped routes | Split across event-core, floorplan, compliance-ops, closure-ops, event-read-models | Partially moved; list/detail reads live in event-read-models, floorplan routes live in floorplan, and compliance execution/resolution lives in compliance-ops. |
| `events.controller.ts` / event list/detail reads | `event-read-models` | Moved in event read-model route slice. |
| `events.controller.ts` / floorplan routes | `floorplan` | Moved in event floorplan route slice. |
| `events.controller.ts` / compliance execution routes | `compliance-ops` | Moved in event-scoped compliance slice. |
| `events.controller.ts` / `OpsComplianceController` compliance rule routes | `compliance-ops` | Moved in compliance rule route slice. |
| `audit-privacy.controller.ts` | `trust-ops` | Moved in trust route slice. |
| `notifications.controller.ts` | `notification-ops` | Moved in notification slice. |
| `auth.controller.ts` | `identity-ops` | Moved in local auth slice. |
| `ai.controller.ts` / `governance/dry-run` | `ai-governance` | Moved in AI governance dry-run slice. |
| `ai.controller.ts` / PARE routes | supplier/PARE ownership split | Pending. |
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
- [x] Create `identity-ops` module for local sample auth, account approval, login history, and password hashing helpers.
- [x] Move `AuthOperationsService` and `AuthSecurityService` to `identity-ops`; keep old event-ops service paths as compatibility re-exports.
- [x] Create identity-owned auth controller that calls `AuthOperationsService` directly and keeps `/auth/*` paths stable.
- [x] Register `IdentityOpsModule` and remove auth controller registration from `EVENT_OPS_CONTROLLERS`.
- [x] Add auth controller route/delegation smoke tests.
- [x] Create `ai-governance` module for AI payload sanitation, ZDR gating, audit rows, and approval records.
- [x] Move `AiGovernanceService` to `ai-governance`; keep the old event-ops service path as a compatibility re-export.
- [x] Create AI-governance-owned dry-run controller that calls `AiGovernanceService` directly and keeps `/ai/governance/dry-run` stable.
- [x] Register `AiGovernanceModule`; keep `/ai/pare/*` in the old AI compatibility controller until supplier/PARE ownership is split.
- [x] Add AI governance route/delegation smoke tests.
- [x] Move `SuppliersService` to `supplier-ops`; keep the old event-ops service path as a compatibility re-export.
- [x] Register `SUPPLIER_DIRECTORY` from `SupplierOpsModule` so supplier workflow code consumes the owning module provider.
- [x] Create supplier-ops-owned supplier directory controller for `GET /suppliers/categories` and `GET /suppliers`.
- [x] Remove supplier directory read handlers from the old `event-ops` supplier controller while preserving supplier write routes there.
- [x] Add supplier directory route/delegation smoke tests.
- [x] Create supplier-ops-owned supplier command controller for supplier create/update/tier/review/certification routes.
- [x] Remove supplier write controller registration from `EVENT_OPS_CONTROLLERS`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add supplier command route/delegation smoke tests.
- [x] Create event-read-model-owned PMCM dashboard/workspace controller that calls `EventReadModelsService` directly with event-read-model-owned PMCM mappers.
- [x] Remove PMCM dashboard/workspace controller registration from `EVENT_OPS_CONTROLLERS`; keep the old event-ops controller file as a compatibility re-export.
- [x] Add PMCM dashboard/workspace route/delegation smoke tests.
- [x] Create compliance-ops-owned compliance rule controller for `/compliance/rules` routes.
- [x] Remove compliance rule controller registration from `EVENT_OPS_CONTROLLERS`; keep event-scoped compliance routes in `events.controller.ts` until their owning slice moves.
- [x] Add compliance rule route/delegation smoke tests.
- [x] Create staffing-owned coordinator workspace read service/controller for GET /coordinator/workspace.
- [x] Remove coordinator workspace read handler from the old event-ops coordinator controller while preserving role-view there.
- [x] Add coordinator workspace route/delegation smoke tests.
- [x] Create compliance-ops-owned event-scoped compliance controller for `POST /events/:eventId/compliance` and `PATCH /events/:eventId/compliance/:checkId`.
- [x] Remove event-scoped compliance handlers from the old `events.controller.ts`.
- [x] Add event-scoped compliance route/delegation smoke tests.
- [x] Create event-read-model-owned event list/detail controller for `GET /events` and `GET /events/:eventId`.
- [x] Remove event list/detail handlers from the old `events.controller.ts` while preserving remaining event-scoped route groups there.
- [x] Add event list/detail route/delegation and read-model service smoke tests.
- [x] Create floorplan-owned event floorplan controller/DTOs for official drafts, client preferences, submit/approve, and snapshots.
- [x] Remove floorplan handlers from the old `events.controller.ts` while preserving remaining event-scoped route groups there.
- [x] Add event floorplan route/delegation smoke tests.
- [ ] Move the remaining controller families one module at a time.
- [ ] When all controllers are moved, mark the master Phase 13 checklist complete and proceed to Phase 14 facade retirement.

## Self-Review

- Spec coverage: Guest, supplier quote-token, inquiry, billing, notification, client read, PMCM command-inbox, coordinator directory, onboarding read, audit/privacy, auth, AI governance dry-run, supplier directory read, supplier command, PMCM dashboard/event-workspace, compliance rule, coordinator workspace read, event-scoped compliance, event list/detail, and event floorplan controller slices moved without changing public route paths or response mapping.
- Boundary clarity: `guest-ops`, `commercial-ops`, `inquiry-onboarding`, `event-read-models`, `notification-ops`, `staffing-ops`, `trust-ops`, `identity-ops`, `ai-governance`, and `supplier-ops` controllers import only local DTOs/mappers/services, ports, and public access-control; they do not import `event-ops` internals.
- Remaining risk: Several controller families still live in `event-ops`; this is an incremental Phase 13 checkpoint, not full Phase 13 completion.

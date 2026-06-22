# P.R.I.S.M Current State Snapshot

Date: 2026-06-20
Branch context: `plan/remediation-calendar-system`
Status: Current-state evidence snapshot for planning and July completion work

This file records the current system state as of June 20, 2026. It is intentionally dated. Update or supersede it when a later review changes the implementation truth.

## Current System Summary

P.R.I.S.M currently has a role-specific monorepo architecture with one shared NestJS API and four role apps. The system can support the defense/demo story in bounded form: public inquiry, PMCM command, accepted inquiry/conforme gate, client action center, supplier readiness, guest access/check-in, event operations, privacy/audit, and closure/readiness evidence. The system is not yet complete in the production sense because several families remain partial, gated, or explicitly post-July.

## Current Runtime Inventory

| Runtime | Current state |
| --- | --- |
| `apps/api` | Shared NestJS API on port `4000`; event-ops module owns most workflows and Prisma access. |
| `apps/client` | Client portal on port `3001`; public inquiry and signed-in client dashboard/action center. |
| `apps/event` | PMCM/coordinator event command app on port `3004`; command inbox and selected event workspace exist, but broad dashboard sections still need decomposition. |
| `apps/supplier` | Supplier portal on port `3002`; quote, assignment, readiness, contract metadata, status, and readiness board exist. |
| `apps/guest` | Guest portal on port `3003`; access-code entry, pass, check-in, walk-in flag, feedback. |
| `packages/types` | Shared role, session, lifecycle, action, and contract types. |
| `packages/api-client` | Shared request helpers. |
| `packages/ui` | Shared presentation components. |
| `packages/tokens` | Shared theme tokens. |

## Current Feature State By Family

| Feature family | Current state on 2026-06-20 | Current completion posture |
| --- | --- | --- |
| FL-001 Inquiry intake and triage | Public inquiry and PMCM intake exist with duplicate/referral/log-on-behalf metadata in partial form. | Thin/finish for July. |
| FL-002 Onboarding and conforme gate | Gate exists and remains a core boundary. Reminder/template maturity is still simple. | Finish thin slice. |
| FL-003 PMCM command dashboard | Command inbox and selected-event contracts exist; broad dashboard behavior remains. | Finish command slice and decompose one more selected-event surface. |
| FL-004 Client portal after conforme | Client action center exists with fallback derivation. | Finish thin slice and label/remove fallback where possible. |
| FL-005 Proposal, briefing, commercial workflow | Proposal/billing source pieces exist; adapters and AI drafts are gated. | Gate/thin. |
| FL-006 Documents and file operations | File Requirements Matrix metadata and visibility tests exist. | Thin; real storage gated. |
| FL-007 Supplier network operations | Supplier directory, quotes, assignment, readiness, contract metadata, readiness board exist. Applications/PARE/reliability depth remain incomplete. | Thin. |
| FL-008 Coordinator and staffing operations | Coordinator desk, live ops, replacement pieces exist. Staffing heatmap and availability depth incomplete. | Gate or one thin slice. |
| FL-009 Compliance, risk, and change control | Rule-backed compliance and override audit exist. Unified risk/change workflow incomplete. | Gate/thin. |
| FL-010 Billing and payments | Billing source, statements, milestones, and payment records exist in partial form. | Thin. |
| FL-011 Floorplan and spatial workflow | PMCM official ownership and client read-only official snapshot boundary exist. | Finish boundary; table eligibility remains thin. |
| FL-012 Guest and lightweight access | Access-code, guest pass, check-in, walk-in, attendance, feedback exist. | Thin; QR gated. |
| FL-013 Closure, archive, and learning loop | Close gates, archive guard, insights, and lifecycle transition table exist. | Thin. |
| FL-014 Notifications and communications | Queue/retry/acknowledgement model exists. | Gate production adapters; thin queue evidence. |
| FL-015 Security, privacy, and audit | Sample auth/RBAC, privacy requests, retention reads, soft redaction, audit integrity, login/security records exist. | Finish evidence; gate external auth. |
| FL-016 Shared design system and shell | Shared UI/tokens exist; app-local UI copies remain. | Finish shell foundation and route-review evidence. |
| FL-017 Event Command Inbox | Shared PMCM command inbox contract exists and feeds dashboard rows. | Finish. |
| FL-018 Event Health Score | Readiness/health cues exist, but formula and evidence surface are not complete. | Thin or post-July. |
| FL-019 Decision Log | Audit records exist; unified decision log surface incomplete. | Thin or post-July. |
| FL-020 Client Action Center | Shared action center exists and feeds client dashboard cards. | Finish. |
| FL-021 PMCM Handoff Brief | Source pieces exist in selected-event workspace; unified brief incomplete. | Thin or post-July. |
| FL-022 Supplier Readiness Board | Supplier dashboard displays readiness board. | Thin. |
| FL-023 Coordinator Staffing Heatmap | Assignment/replacement pieces exist; heatmap incomplete. | Gate unless selected. |
| FL-024 File Requirements Matrix | Shared metadata contract and role-filtered endpoint exist. | Thin; storage gated. |
| FL-025 Risk and Change Register | Compliance/override pieces exist; register incomplete. | Gate unless selected. |
| FL-026 Event Day Run Sheet | Live-ops pieces exist; unified run sheet incomplete. | Thin or post-July. |
| FL-027 Privacy Operations Console | Privacy operations exist; full console depth incomplete. | Gate deeper scope. |
| FL-028 Workflow Template Builder | Not July build scope. | Post-July. |

## Current Completion Confidence

| Gate | Current state |
| --- | --- |
| Catalog traceability | Passing as of the latest audit: 137 catalog IDs accounted for across ledger, calendar, and completion review. |
| Feature-family coverage | Passing as of the latest audit: FL-001 through FL-028 appear in the ledger, calendar, and completion review. |
| Role boundaries | Documented and partially tested. Must remain a required verification gate for any route or contract change. |
| Route evidence | Not complete. Sprint 4 still needs route evidence packet for public inquiry, PMCM command, selected event, client action center, supplier readiness, guest check-in, and closure/readiness. |
| External dependency decisions | Not complete. Storage, notifications, auth, QR/camera, and live AI are gated unless approved with tests and fallback behavior. |
| UX route review | Not complete. Maxine still needs route-review evidence on touched surfaces. |
| Doc synchronization | Current docs have been synchronized for the completion calendar/review; future changes must keep index, README, cleanup checklist, AGENTS, and manifest aligned. |

## Current External Dependency State

| Dependency | Current state | July rule |
| --- | --- | --- |
| Database | Prisma-backed Postgres path exists. As of the 2026-06-22 branch update, the shared Supabase target has the domain-schema migration applied and verified through live schema, naming, index, migration-status, and redacted performance-report audits. Free-tier Supabase session-pooler support is a runtime workaround when direct IPv4 is unavailable. | Keep documented runtime guard; do not put secrets in docs. Re-run `db:perf:report` after representative app traffic before claiming event-ops workload rankings. |
| File storage | Metadata matrix exists. No production object storage claim. | Gate real storage. |
| Notifications | Queue exists. No production adapter claim. | Gate SendGrid/Viber or equivalent adapters. |
| External auth | Sample auth/RBAC exists. | Gate provider integration. |
| QR/camera | Guest access-code flow exists. | Gate QR/camera until HTTPS/device/masterlist constraints pass. |
| Live AI | Governance, sanitizer, audit, approval, and PARE foundation exist. | Gate live provider calls and autonomous actions. |

## Current Risks

| Risk | Why it matters | Current mitigation |
| --- | --- | --- |
| Partial features read as complete | Visible UI can hide missing contracts, failure states, or role boundaries. | Completion review requires delivered/thin/gated/deferred/post-July outcome per FL row. |
| Broad dashboard behavior | Large PMCM dashboard ownership increases regression risk. | Sprint 3 asks Francis to decompose exactly one more selected-event surface and record remaining compatibility tabs. |
| Portal fallback drift | Client/supplier/guest flows can remain broad-state dependent if not tracked. | Sprint 3-4 asks Anthony to record every fallback as kept, removed, or post-July. |
| External dependency overclaiming | Storage, notifications, auth, QR, and AI can create false production-readiness claims. | All remain gated unless explicit approval, tests, fallback, and owner decision exist. |
| UX inconsistency | Shared shell work is not enough unless real routes follow it. | Maxine route-review log is required before July closeout. |

## Current Must-Do Before July 31

| Priority | Task | DRI |
| --- | --- | --- |
| P0 | Build final feature outcome matrix for FL-001 through FL-028. | Anthony |
| P0 | Create route evidence packet for the complete lifecycle demo path. | Anthony |
| P0 | Record every compatibility fallback still used by PMCM/client/supplier/guest routes. | Anthony |
| P0 | Pick exactly one PMCM depth slice for Sprint 3 and gate non-selected slices. | Francis |
| P0 | Make supplier and guest route evidence mandatory before client polish expands. | Ethan |
| P1 | Add UX route-review log for touched PMCM/client/supplier/guest routes. | Maxine |
| P1 | Add storage/notification/auth/QR/AI dependency decisions to Sprint 4 closeout. | Anthony |
| P1 | Add post-July queue grouped by PMCM, client, supplier, guest, platform, and UX. | Anthony |

## Current Definition Of Done

A July feature slice is not done only because UI exists. It is done only when it has:

1. Actor and route evidence.
2. Scoped API/type contract or explicit compatibility note.
3. Permission-boundary proof.
4. Failure/empty/loading state decision.
5. Audit/notification decision where relevant.
6. External dependency gate decision where relevant.
7. Updated ledger/calendar/review docs.

## Current Do-Not-Claim List

As of June 20, do not claim these as complete:

- Production external auth.
- Real file storage.
- Production notification adapters.
- QR/camera guest check-in.
- Live AI provider calls.
- Autonomous PARE emergency response.
- Full supplier application status center.
- Full coordinator staffing heatmap.
- Full risk/change register.
- Full decision log.
- Full event health formula.
- Full workflow template builder.

## Post-Snapshot DB Update: 2026-06-22

The database schema separation and query-optimization implementation has been deployed to the shared Supabase target after a JSON backup export. The implementation adds Prisma multi-schema mappings, schema/table rename migrations, normalized index and constraint naming, FK/hot-path index SQL, database audit scripts, static query discipline checks, selected N+1 fixes, function-name cleanup, cursor page-limit contracts, and transaction-scope comments.

Verified in the 2026-06-22 review: Prisma validation, offline migration diff, static query audit, API typecheck, `@prism/types` tests, `@prism/api-client` tests, the event-ops test suite, role boundary check, live schema audit, live naming audit, live FK-index audit, live migration status, and redacted live performance report. Re-run the performance report after representative app traffic because the current top rows are mostly migration/admin/catalog queries.
## Post-Snapshot Backend Architecture Guardrail: 2026-06-22

The active backend modular-monolith implementation plan now exists at `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`. The current runtime state is still that `event-ops` owns most workflow services and Prisma access. The new plan does not claim extraction is complete; it defines the guarded path for moving from the current hub to capability modules.

Phase 0 guardrails are active in the boundary checker. Future backend work must not add new top-level business service files under `apps/api/libs/modules/event-ops/src/services`, must not let new capability modules import `event-ops` compatibility internals, must not import another capability module's private `src/services` path, and must keep `event-read-models` read-only. Raw read-model SQL is allowed only in approved query-builder files with an explicit query budget.

Phase 2 is implemented as a representative runtime slice: command/transaction context primitives live in `apps/api/libs/core/shared-kernel`, audit/outbox/access/workflow tokens and adapters live under `event-ops/src/ports`, and coordinator assignment plus acknowledgement run as `same_tx` commands with transaction-scoped audit/outbox side effects. At that point `event-ops` remained the compatibility facade and no capability modules had been extracted yet; later post-snapshot notes below record the Phase 3 and Phase 4 movement.

The July 31 execution boundary remains: backend work before July should prioritize guardrails, dependency-injection foundation, transaction/side-effect ports, role-boundary evidence, and stable app contracts. Larger capability extraction is post-July by default unless a child plan ties the extraction to a feature-ledger row and route evidence.

## Post-Snapshot Backend Infrastructure Modules: 2026-06-22

Phase 3 extracted the first cross-cutting backend modules without changing public route paths. `event-core`, `trust-ops`, `notification-ops`, and `access-control` now provide workflow command execution, audit/privacy, outbox writing, and access policy through public module exports and provider tokens. Capability workflows such as closure and remaining read models remain in `event-ops` until their own child plans execute. Supplier, finance, file, inquiry-onboarding, commercial, floorplan, and guest slices are covered by the Phase 4 through Phase 9 notes below.
## Post-Snapshot Supplier-Ops Slice: 2026-06-22

Phase 4 extracted the first supplier vertical slice without changing public route paths. `SupplierNetworkWorkflowService`, `SuppliersService`, the `SUPPLIER_DIRECTORY` provider, `SupplierProfileCommandsService`, and the supplier directory/read-write controllers now live under `apps/api/libs/modules/supplier-ops`. The old `event-ops` service path remains a compatibility re-export, and `EventOpsModule` still binds supplier-owned ports to existing PARE, live-operations, and document-vault services for the remaining supplier workflow dependencies.

Current limitation: `SupplierOpsModule` now owns supplier directory reads and supplier profile write routes, but it is not the final supplier runtime owner yet. Full independence still requires supplier workspace/readiness read-model ports, PARE automation ownership, live-operations logging ownership, and tighter file-operation denial tests. Boundary evidence is stronger than before because `supplier-ops` has no import back to `event-ops`.

## Post-Snapshot Finance-Ops Slice: 2026-06-22

Phase 5 extracted finance command ownership without changing public route paths. `BillingOperationsService` and focused payment replay tests now live under `apps/api/libs/modules/finance-ops`. `FinanceOpsModule` imports the public cross-cutting modules and exports the billing provider; the old `event-ops` service path remains a compatibility re-export for facade tests. Phase 13 later moved the event-scoped billing source, statement, and payment command routes into `finance-ops`.

Current limitation: billing read-model composition, client-safe billing payload hardening, disputes, waivers, corrections, additional billing, and payment status/event-health readers remain future child-plan work. The implemented guard prevents duplicate payment rows and duplicate audit rows when a payment record request is retried with the same non-empty reference number, amount, date, and method.

## Post-Snapshot File-Ops Slice: 2026-06-22

Phase 6 extracted file requirement and upload metadata ownership without changing public route paths. `FileRequirementsMatrixService` and `DocumentVaultService` now live under `apps/api/libs/modules/file-ops`, and `FileOpsModule` exports the runtime services plus `FILE_REQUIREMENT_READER`, `FILE_REQUIREMENT_COMMANDS`, and `SIGNED_UPLOAD_URL_FACTORY`. The old `event-ops` service paths remain compatibility re-exports, and `EventOpsModule` imports `FileOpsModule` so closure gates, supplier contract metadata validation, and guest feedback metadata validation keep their existing behavior. Phase 13 later moved the event file requirements route into `file-ops`.

Current limitation: real object storage is still disabled. `MetadataOnlySignedUploadUrlFactory` throws `ServiceUnavailableException`, and storage adapter rollout, upload sessions, progress/retry, bulk upload, download/delete audit, supplier/guest-specific file denial tests, and read-model extraction remain future child-plan work.

## Post-Snapshot Inquiry-Onboarding Slice: 2026-06-22

Phase 7A extracted public inquiry, conforme gate, and client briefing command ownership without changing public route paths. `InquiriesService`, `InquiryWorkflowService`, and `ClientOnboardingWorkflowService` now live under `apps/api/libs/modules/inquiry-onboarding`. `InquiryOnboardingModule` exports the runtime services plus `INQUIRY_COMMANDS` and `CLIENT_ONBOARDING_COMMANDS`; the old `event-ops` service paths remain compatibility re-exports for the route facade and adjacent event-ops services.

Current limitation: `EventOpsService.listOnboarding` remains in `event-ops` because it is a cross-domain PMCM read across inquiries, events, and documents. Controller ownership, commercial workflow extraction, compliance workflow extraction, API client generation, and additional unauthenticated route-smoke hardening remain future child-plan work.

## Post-Snapshot Commercial-Ops Slice: 2026-06-22

Phase 7B extracted supplier quote request, supplier quote submission/revision, quote selection, and token-scoped quote-request read behavior without changing public route paths. `CommercialWorkflowService` now lives under `apps/api/libs/modules/commercial-ops`, and `CommercialOpsModule` exports the runtime service plus `COMMERCIAL_WORKFLOW_COMMANDS`, `PROPOSAL_READER`, and `QUOTE_SUPPLIER_RESOLVER`. PMCM commercial decision facade methods now accept optional actor query context and deny supplier/guest actors before quote request, quote detail, or quote selection writes run.

Current limitation: this is the implemented quote/commercial workflow slice, not full proposal document generation. Briefing reader ownership, proposal document generation, API client generation, and proposal-document route smoke remain future child-plan work; event-scoped quote request/create/select controller ownership now moved in Phase 13.

## Post-Snapshot Compliance-Ops Slice: 2026-06-22

Phase 7C extracted compliance rule listing, compliance rule create/update, compliance check generation, and compliance resolution behavior without changing public route paths. `ComplianceWorkflowService` now lives under `apps/api/libs/modules/compliance-ops`, and `ComplianceOpsModule` exports the runtime service plus `COMPLIANCE_COMMANDS` and `COMPLIANCE_READER`.

Audit storage remains in `trust-ops`; compliance-ops imports public trust, access-control, and event-core providers. Controller ownership, role-scoped read-model extraction, and compliance payload field allowlists remain future child-plan work.

## Post-Snapshot Floorplan Slice: 2026-06-22

Phase 8 extracted PMCM official floorplan draft, submit, approve, snapshot read, and client layout preference behavior without changing public route paths. `FloorPlanWorkflowService` now lives under `apps/api/libs/modules/floorplan`, and `FloorplanModule` exports the runtime service plus `FLOORPLAN_COMMANDS` and `FLOORPLAN_READER`.

The AGENTS floorplan rule remains enforced in `EventOpsService` compatibility methods: PMCM/system actors mutate official floorplans, clients submit preferences only for readable events, and readable clients can fetch submitted/approved official snapshots read-only. Existing canvas/editor persistence remains on `floorPlan`, `floorPlanObject`, and `opsFloorPlanDraft`.

## Post-Snapshot Guest-Ops Slice: 2026-06-22

Phase 9 extracted guest access-code resolution, guest check-in writes, guest feedback writes, attendance reads, and guest payload mapping without changing public guest route paths. `GuestWorkflowService` now lives under `apps/api/libs/modules/guest-ops`, and `GuestOpsModule` exports the runtime service plus `GUEST_COMMANDS` and `GUEST_READER`.

`EventOpsService` remains the compatibility facade for `/guest/events/:accessCode`, privacy inventory, defense readiness, and live-ops attendance surfaces, but those guest reads now delegate through the guest service instead of direct guest Prisma reads. `EventReadModelsService.pmcmEventWorkspace` consumes `GUEST_READER` for PMCM-scoped attendance and feedback payloads. The Phase 9 regression suite covers access-code payloads, consent-gated check-in/feedback commands, guest payload mapping, and the forbidden-role rule that guest actors cannot read PMCM planning/readiness payloads.

Current limitation: QR/camera check-in remains gated, and full guest-masterlist/RSVP import behavior is not claimed. Controller ownership and complete guest read-model extraction remain future child-plan work.

## Post-Snapshot Staffing-Ops Slice: 2026-06-22

Phase 10 extracted coordinator directory reads, coordinator assignment writes, coordinator acknowledgement writes, event assignment reads, and coordinator actor assignment resolution without changing public route paths. `CoordinatorsService` now lives under `apps/api/libs/modules/staffing-ops`, and `StaffingOpsModule` exports the runtime service plus `STAFFING_COMMANDS` and `STAFFING_READER`.

`EventOpsService` remains the compatibility facade for coordinator directory, assignment, acknowledgement, and coordinator workspace surfaces, but those reads and writes now delegate through the staffing service instead of direct event-ops coordinator ownership. The Phase 10 regression suite covers conflict-gated coordinator assignment, same-transaction audit/outbox side effects, acknowledgement, internal staffing reads, and the forbidden-role rule that client, supplier, and guest actors cannot access internal staffing directory payloads.

Current limitation: event-day tasks, urgent issues, coordinator attendance, coordinator replacement, event-day logs, and status feed behavior remain in live operations pending a later live-ops owner extraction. Event-scoped coordinator assignment and acknowledgement controller ownership moved to staffing-ops in Phase 13. Full coordinator staffing heatmap behavior remains on the do-not-claim list.
## Post-Snapshot Event-Read-Models Slice: 2026-06-22

Phase 11 extracted role-scoped PMCM, client, supplier, and billing read-model composition without changing public route paths. `EventReadModelsService` now lives under `apps/api/libs/modules/event-read-models`, and `EventReadModelsModule` exports the runtime service plus PMCM/client/supplier/billing read-model tokens.

The moved service uses `EventReadModelQueries` for bounded read-only Prisma access with query-budget comments, consumes public access-control policy, owns mapper factories under `event-read-models/src/mappers`, and delegates guest attendance/feedback and selected-event staffing reads through public reader ports. `EventOpsService` remains the compatibility facade for the existing controllers and route methods, while the old event-ops read-model service path remains a re-export for compatibility tests.

Current limitation: read-model controller ownership remains in `event-ops` until Phase 13. Read-model query budgets are documented, statically guarded, and covered by focused PMCM dashboard query-budget regression tests; deeper runtime database telemetry remains a later observability enhancement.

## Post-Snapshot Closure-Ops Slice: 2026-06-22

Phase 12 extracted archive command ownership, post-event document completion, event-insight reads/writes, and close-gate readiness into `apps/api/libs/modules/closure-ops`. `ClosureOpsModule` exports the runtime service plus `CLOSURE_COMMANDS` and `CLOSURE_READINESS_READER`; Phase 13 later moved the closure/archive event routes into `closure-ops`.

`EventLifecycleService` now lives in `event-core`, keeping lifecycle/archive invariants narrow and public. Archive commands resolve actor context and require PMCM/system scope before writes; the event-ops facade preserves current route compatibility until Phase 13 controller ownership work.

Current limitation: richer closure-readiness composition can later consume more specific supplier, finance, file, compliance, floorplan, guest, and staffing reader ports as those ports mature.

## Post-Snapshot Controller Ownership Slice: 2026-06-22

Phase 13 has started with the public guest controller, supplier quote-token routes, inquiry routes, billing workspace reads, notification acknowledgement, client workspace reads, coordinator directory reads, onboarding reads, audit/privacy routes, PMCM command-inbox, auth routes, AI governance dry-run, supplier directory reads, supplier write routes, and PMCM dashboard/event-workspace reads, compliance rule routes, coordinator workspace reads, event-scoped compliance execution/resolution routes, event list/detail reads, event floorplan routes, event billing command routes, event closure/archive routes, and event file requirements route. `OpsGuestController` is now registered from `apps/api/libs/modules/guest-ops`, uses local guest DTOs, and calls `GuestWorkflowService` directly for guest event lookup, check-in, and feedback routes. `OpsQuoteRequestsController` is now registered from `apps/api/libs/modules/commercial-ops`, uses commercial-owned supplier quote DTOs/mappers, and calls `CommercialWorkflowService` directly for quote request lookup, supplier quote submission, and supplier quote revision. `OpsEventCommercialController` is also registered from `apps/api/libs/modules/commercial-ops`, uses commercial-owned event quote command DTOs, and calls `CommercialWorkflowService` directly for PMCM quote request creation, manual quote detail capture, and supplier quote selection with PMCM/system route policy. `OpsInquiriesController` and `OpsEventBriefingController` are now registered from `apps/api/libs/modules/inquiry-onboarding`, use inquiry-owned DTOs/mappers, and call inquiry/onboarding services directly for public inquiry creation, PMCM log-on-behalf/listing/status, conforme reminder, signed conforme upload, and event briefing submission routes. `OpsBillingController` is now registered from `apps/api/libs/modules/event-read-models`, uses an event-read-model-owned actor query DTO/event mapper, and calls `EventReadModelsService.billing` directly while composing billing source, statement, milestone, and payment record mappers from `finance-ops`. `OpsNotificationsController` is now registered from `apps/api/libs/modules/notification-ops`, uses a notification-owned response mapper, and calls `NotificationOutboxService.acknowledge` directly. `OpsClientController` is now registered from `apps/api/libs/modules/event-read-models`, uses event-read-model-owned client DTO/mappers, and calls `EventReadModelsService.clientWorkspace` and `clientActionCenter` directly. `OpsCoordinatorsController`, `OpsCoordinatorWorkspaceController`, and `OpsEventCoordinatorAssignmentsController` are now registered from `apps/api/libs/modules/staffing-ops`, use staffing-owned DTOs where applicable, and call staffing-owned coordinator directory/workspace/assignment services directly. `OpsOnboardingController` is now registered from `apps/api/libs/modules/inquiry-onboarding`, uses inquiry-owned actor/event/document mappers, and calls `InquiryWorkflowService.listOnboarding` directly. `OpsAuditController` and `OpsPrivacyController` are now registered from `apps/api/libs/modules/trust-ops`, use trust-owned DTOs/route policy, and call `AuditService` and `PrivacyOperationsService` directly. `OpsComplianceController` and `OpsEventComplianceController` are now registered from `apps/api/libs/modules/compliance-ops`, use compliance-owned DTOs/mappers, and call `ComplianceWorkflowService` directly for `/compliance/rules` and `/events/:eventId/compliance` execution/resolution routes. `OpsEventFloorplansController` is now registered from `apps/api/libs/modules/floorplan`, uses floorplan-owned DTOs, and calls `FloorPlanWorkflowService` directly for official floorplan drafts, client preferences, submit/approve, and snapshots. `OpsEventBillingController` is now registered from `apps/api/libs/modules/finance-ops`, uses finance-owned DTOs, and calls `BillingOperationsService` directly for billing sources, billing statements, payment status updates, payment records, and statement delivery with PMCM/system route policy. `OpsEventClosureController` is now registered from `apps/api/libs/modules/closure-ops`, uses closure-owned DTOs/mappers, and calls `EventClosureService` directly for close gates, post-event documents, archive, and event insights. `OpsEventFileRequirementsController` is now registered from `apps/api/libs/modules/file-ops`, uses a file-owned actor DTO, and calls `FileRequirementsMatrixService` directly while preserving event-read policy and role-visible filtering. `OpsPmcmCommandInboxController`, `OpsPmcmDashboardController`, and `OpsEventReadsController` are now registered from `apps/api/libs/modules/event-read-models`, reuse event-read-model actor DTOs/mappers, and call `EventReadModelsService` directly for PMCM command-inbox, dashboard, event-workspace, and event list/detail reads. `OpsAuthController` is now registered from `apps/api/libs/modules/identity-ops`, uses identity-owned auth DTOs, and calls `AuthOperationsService` directly; old auth service/controller paths remain compatibility re-exports. `OpsAiGovernanceController` is now registered from `apps/api/libs/modules/ai-governance`, uses AI-governance-owned dry-run DTOs, and calls `AiGovernanceService` directly for `/ai/governance/dry-run`; old AI governance service paths remain compatibility re-exports while `/ai/pare/*` stays in `event-ops`. `OpsSupplierDirectoryController`, `OpsSuppliersController`, and `OpsSupplierWorkspaceCommandsController` are now registered from `apps/api/libs/modules/supplier-ops`, use supplier-owned actor/command DTOs, and call supplier-owned services directly for `/suppliers/categories`, `/suppliers`, supplier profile write routes, and supplier assignment/readiness/contract command routes; old supplier service/controller paths remain compatibility re-exports while supplier workspace reads and event-status stay in `event-ops`. The old `event-ops/src/controllers/guest.controller.ts`, `event-ops/src/controllers/quote-requests.controller.ts`, `event-ops/src/controllers/inquiries.controller.ts`, `event-ops/src/controllers/billing.controller.ts`, `event-ops/src/controllers/notifications.controller.ts`, the client export from `event-ops/src/controllers/client-workspace.controller.ts`, the coordinator directory export from `event-ops/src/controllers/coordinator-workspace.controller.ts`, the onboarding export from `event-ops/src/controllers/client-workspace.controller.ts`, the audit/privacy export from `event-ops/src/controllers/audit-privacy.controller.ts`, and the auth export from `event-ops/src/controllers/auth.controller.ts` remain compatibility re-exports but are no longer part of `EVENT_OPS_CONTROLLERS`.

Current limitation: this is an incremental controller-family migration only. Quote-request withdrawal, supplier workspace reads, supplier event-status, coordinator role-view, coordinator attendance/replacement, remaining event command/live routes, AI PARE, and sample controllers still need route ownership migration before Phase 13 can be marked complete.

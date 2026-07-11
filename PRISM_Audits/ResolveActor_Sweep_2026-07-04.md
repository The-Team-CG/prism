# Cross-Cutting Sweep — Every Call Site of EventAccessPolicyService.resolveActor

**Date:** 2026-07-04
**Scope:** All of `apps/api`, exhaustive, not limited to modules already named in `PRISM_Codebase_Facts.md`.
**Method:** Repo-wide `Grep` for every call site (30 files matched `resolveActor`), direct reading of each controller/service to record the exact allow-list, direct reading of `EventAccessPolicyService` itself (the canonical definition), and a repo-wide search for any NestJS `Guard`/`CanActivate`/Passport strategy/`APP_GUARD`/middleware that might intercept a request before reaching these call sites.
**Last PA number confirmed before this sweep:** PA-198 (from `_Audit_Index.md`, EP-11 row, verified directly, not assumed). New PAs in this report: **PA-199 through PA-204**.
**Read-only.** No application code modified.

---

## Executive summary

**There is no authentication layer anywhere in `apps/api`.** A repo-wide search for `UseGuards`, `CanActivate`, `APP_GUARD`, a Passport strategy, or any `app.use(...)` middleware in the main application bootstrap returns nothing. Every one of the ~123 confirmed `resolveActor` call sites reads its actor identity from a raw, client-supplied query-string DTO (`actorRole`, `actorName`, etc.) with zero verification step anywhere upstream. This closes the long-standing open question in Codebase Facts ("whether `session.role` itself is derived from a verified JWT claim or sits in client-writable storage") definitively, at least for the backend: there is no verification of any kind, for any endpoint, anywhere in `apps/api`.

**`EventAccessPolicyService`'s own design makes the fail-open default far more dangerous than a single misconfigured allow-list.** `resolveActor`'s default (missing `actorRole`/`role` → `pmcm-admin`, `event-access-policy.service.ts:35`) is not just permitted by a handful of allow-lists — it is the literal, unconditional pass condition baked into four of the service's own five convenience guards: `canReadEvent`, `canMutateOfficialFloorplan`, `canViewInternalCosts`, and `canViewPrivacyOperations` all contain `actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System` as an unconditional early return (lines 73, 98, 108, 122). Any endpoint built on top of these — which is most of the admin-facing surface, by design, since PMCM Admin is meant to see/do nearly everything — inherits the exposure automatically. This is not a pattern that needs re-discovering module by module; it is structural.

**This sweep confirms the fail-open default is exploitable, with no other check catching it, at 52 of 60 named call sites across 11 modules** — including three modules whose "guarded, not exploited" status was explicitly logged in `PRISM_Codebase_Facts.md` and must now be corrected: **supplier-ops** (EP-07 Chain A/C), **finance-ops** (EP-08), and the **PMCM-admin-gated methods of `event-read-models.service.ts`** (EP-08, previously verified only for the client-gated methods). The floorplan module's `requireCanMutateOfficialFloorplan` — flagged by name in the brief as a priority check — is confirmed exposed as well.

**Three additional, previously-undocumented findings surfaced during the sweep, outside the strict "named in Codebase Facts" list:**
1. `trust-ops`'s `audit-privacy.controller.ts` reimplements its own local `resolveActor` function (not the shared service) with the identical fail-open default, feeding audit logs, security alerts, audit export, and privacy/data-subject-request operations — all exploitable the same way, via a duplicated (not shared) code path.
2. `sample-compatibility.service.ts` contains **63 call sites to the real, shared `resolveActor`**, all inside private methods that are **confirmed dead code** — none of them is ever invoked by `state()`, `resetSample()`, or `seedSampleState()`, the only three methods the one controller that uses this service (`SampleController`) actually calls. This is not a live exposure; it is vestigial code duplicating logic that has since moved to per-domain controllers. Flagged as a cleanup item, not a security fix.
3. Separately, and **not part of the resolveActor sweep at all** since it doesn't call `resolveActor`: `POST /sample/reset` and `POST /sample/seed` take zero actor input of any kind and are unconditionally registered in the live `AppModule` (`SampleCompatibilityModule`, `app.module.ts:10,54`, no environment gate) — a real, unauthenticated, production-reachable dataset reset/reseed pair. Noted here because it surfaced during this sweep, but it is a distinct failure mode (no auth attempted at all, by design, per its own doc comment) and is recommended as its own follow-up audit rather than folded into this report's fix.

---

## Step 1 — The exhaustive call-site table

30 files matched `resolveActor` in `apps/api`. Two are test files (excluded below) and one is the service's own definition (`event-access-policy.service.ts`, read directly, not a call site). The remaining 27 files contain **60 named, individually-routable call sites**, plus the two out-of-scope cases described above (trust-ops's 10 duplicate-function call sites, sample-compatibility's 63 dead-code call sites), tabulated separately at the end of this section.

| # | File:Line | Method | R/W | Allow-list (verbatim) | Cross-ref to Codebase Facts |
|---|---|---|---|---|---|
| 1 | `supplier-ops/controllers/suppliers.controller.ts:23` | `createSupplier` | W | via `requireSupplierAdmin`: `[OpsUserRole.PmcmAdmin, OpsUserRole.System]` | Not previously named; same module as EP-07 Chain A/C but a different controller |
| 2 | `supplier-ops/controllers/suppliers.controller.ts:29` | `updateSupplier` | W | same as above | " |
| 3 | `supplier-ops/controllers/suppliers.controller.ts:39` | `changeTier` | W | same as above | **EP-07 Chain C explicitly logged this as "guarded, not exploited" — correction below** |
| 4 | `supplier-ops/controllers/suppliers.controller.ts:50` | `addReview` | W | same as above | **Same correction** |
| 5 | `supplier-ops/controllers/suppliers.controller.ts:61` | `addCertification` | W | same as above | Not previously named |
| 6 | `supplier-ops/controllers/event-supplier-withdrawal.controller.ts:20` | `withdrawSupplier` | W | via `requireSupplierAdmin`: `[PmcmAdmin, System]` | Not previously named |
| 7 | `supplier-ops/controllers/supplier-directory.controller.ts:16` | `listSupplierCategories` | R | `[PmcmAdmin, System, Supplier]` | Not previously named |
| 8 | `supplier-ops/controllers/supplier-directory.controller.ts:27` | `list` | R | `[PmcmAdmin, System]` | Not previously named |
| 9 | `supplier-ops/controllers/supplier-workspace-commands.controller.ts:16` | `confirmSupplierAssignment` | W | via `requireSupplierQuoteRequestForActor`: `[Supplier]` | EP-07 Chain A — **SAFE, allow-list excludes PmcmAdmin/System** |
| 10 | `supplier-ops/controllers/supplier-workspace-commands.controller.ts:26` | `confirmReadiness` | W | same as above | **SAFE** |
| 11 | `supplier-ops/controllers/supplier-workspace-commands.controller.ts:37` | `uploadContract` | W | same as above | **SAFE** |
| 12 | `staffing-ops/controllers/coordinators.controller.ts:16` | `list` | R | `[PmcmAdmin, System, Coordinator]` | EP-11 — logged as "guarded" |
| 13 | `staffing-ops/controllers/coordinator-workspace.controller.ts:15` | `getCoordinatorWorkspace` | R | via `listCoordinatorWorkspace`: `[Coordinator]` | EP-11 — **SAFE** |
| 14 | `live-ops/.../event-live-ops-command.service.ts:243` | `requireEventDayWriteActor` (8 call sites: createEventDayTask, updateEventDayTask, escalateEventDayTask, createUrgentIssue, updateUrgentIssue, escalateUrgentIssue, updateCoordinatorAttendance, verifySupplierEventStatus) | W | `[PmcmAdmin, System, Coordinator]` | **EP-11/PA-193 — already the confirmed, most severe instance** |
| 15 | `live-ops/.../event-live-ops-command.service.ts:124` | `replaceCoordinatorAssignment` | W | `[PmcmAdmin, System]` | EP-11/PA-193 |
| 16 | `live-ops/.../event-live-ops-read.service.ts:50,145` | `getEventLiveOps`, `getEventDayStatusFeed` | R | `[PmcmAdmin, System, Coordinator]` | EP-11/PA-193 |
| 17 | `live-ops/.../event-live-ops-read.service.ts:174` | `getCoordinatorRoleView` | R | `[Coordinator]` | EP-11 — **SAFE** |
| 18 | `live-ops/.../event-live-ops-command.service.ts:202` | `updateSupplierEventStatus` | W | `[Supplier]` | Not previously named — **SAFE** |
| 19 | `inquiry-onboarding/.../inquiry-workflow.service.ts:47` | `listInquiries` | R | `allowedAdminRoles` = `[PmcmAdmin, System]` | Not previously named as a resolveActor instance |
| 20 | `inquiry-onboarding/.../inquiry-workflow.service.ts:59` | `listOnboarding` | R | same as above | Not previously named |
| 21 | `floorplan/controllers/event-floorplans.controller.ts:28` | `createFloorPlanDraft` | W | via `requireCanMutateOfficialFloorplan`: `[PmcmAdmin, System]` | **Step 2b priority check — see below** |
| 22 | `floorplan/controllers/event-floorplans.controller.ts:43` | `createFloorPlanPreference` | W | `[Client, PmcmAdmin, System]` | Not previously named at this granularity |
| 23 | `floorplan/controllers/event-floorplans.controller.ts:68` | `submitFloorPlanDraft` | W | via `requireCanMutateOfficialFloorplan` | **Step 2b** |
| 24 | `floorplan/controllers/event-floorplans.controller.ts:83` | `approveFloorPlanDraft` | W | via `requireCanMutateOfficialFloorplan` | **Step 2b** |
| 25 | `floorplan/controllers/event-floorplans.controller.ts:98` | `getFloorPlanSnapshot` | R | via `canReadEvent` (PmcmAdmin/System auto-true) | Not previously named at this granularity |
| 26 | `finance-ops/controllers/event-billing.controller.ts:23` | `createBillingSource` | W | via `requireFinanceActor`: `[PmcmAdmin, System]` | **EP-08 logged finance-ops as "guarded, not exploited" — correction below** |
| 27 | `finance-ops/controllers/event-billing.controller.ts:33` | `approveBillingSource` | W | same | **Same correction** |
| 28 | `finance-ops/controllers/event-billing.controller.ts:45` | `generateBillingStatement` | W | same | **Same correction** |
| 29 | `finance-ops/controllers/event-billing.controller.ts:55` | `markPayment` | W | same | **Same correction** |
| 30 | `finance-ops/controllers/event-billing.controller.ts:67` | `recordPayment` | W | same | **Same correction** |
| 31 | `finance-ops/controllers/event-billing.controller.ts:79` | `sendBillingStatement` | W | same | **Same correction** |
| 32 | `file-ops/controllers/event-file-requirements.controller.ts:17` | (single GET endpoint) | R | via `requireCanReadEvent` (PmcmAdmin/System auto-true) | EP-09 logged as "guarded" — same correction applies |
| 33 | `event-read-models/controllers/pmcm-dashboard.controller.ts:26` | `dashboard` (→ `pmcmDashboard`) | R | `[PmcmAdmin, System]` | **EP-08 verified only client methods — correction below** |
| 34 | `event-read-models/controllers/pmcm-dashboard.controller.ts:32` | `eventWorkspace` (→ `pmcmEventWorkspace`) | R | `[PmcmAdmin, System]` | Same correction |
| 35 | `event-read-models/controllers/pmcm-command-inbox.controller.ts:15` | (→ `pmcmCommandInbox`) | R | `[PmcmAdmin, System]` | Same correction |
| 36 | `event-read-models/controllers/events.controller.ts:20` | `list` (→ `eventList`) | R | via `filterEventsForActor`→`canReadEvent` (auto-true) | Same correction |
| 37 | `event-read-models/controllers/events.controller.ts:26` | `detail` (→ `eventDetail`) | R | via `requireCanReadEvent` (auto-true) | Same correction |
| 38 | `event-read-models/controllers/defense-readiness.controller.ts:15` | (→ `defenseReadiness`) | R | `[PmcmAdmin, System]` | Same correction |
| 39 | `event-read-models/controllers/billing.controller.ts:19` | (→ `billing`) | R | `[PmcmAdmin, System, Client]` | Same correction |
| 40 | `event-read-models/controllers/supplier-workspace.controller.ts:18` | (→ `supplierWorkspace`) | R | `[Supplier]` | EP-07 — **SAFE** |
| 41 | `event-read-models/controllers/supplier-workspace.controller.ts:30` | (→ `supplierReadinessBoard`) | R | `[Supplier]` | EP-07 — **SAFE** |
| 42 | `event-read-models/controllers/client-workspace.controller.ts:22` | (→ `clientWorkspace`) | R | `[Client]` | EP-08/EP-10 — **SAFE, already correctly assessed** |
| 43 | `event-read-models/controllers/client-workspace.controller.ts:39` | (→ `clientActionCenter`) | R | `[Client]` | EP-08/EP-10 — **SAFE, already correctly assessed** |
| 44 | `compliance-ops/controllers/compliance-rules.controller.ts:16` | `listComplianceRules` | R | `[PmcmAdmin, System]` | Not previously named — different controller from EP-06's zero-auth runCompliance/resolveCompliance |
| 45 | `compliance-ops/controllers/compliance-rules.controller.ts:24` | `createComplianceRule` | W | same | Not previously named |
| 46 | `compliance-ops/controllers/compliance-rules.controller.ts:35` | `updateComplianceRule` | W | same | Not previously named |
| 47 | `commercial-ops/controllers/event-commercial.controller.ts:26` | `addSupplierQuote` | W | via `requireCommercialActor`: `[PmcmAdmin, System]` | Not previously named |
| 48 | `commercial-ops/controllers/event-commercial.controller.ts:37` | `requestSupplierQuotes` | W | same | Not previously named |
| 49 | `commercial-ops/controllers/event-commercial.controller.ts:48` | `selectSupplierQuote` | W | same | Not previously named |
| 50 | `closure-ops/.../event-closure.service.ts:35` | `archiveEvent` | W | `[PmcmAdmin, System]` | Not previously named |
| 51 | `closure-ops/.../event-closure.service.ts:103` | `listEventInsights` | R | `[PmcmAdmin, System]` | Not previously named (EP-07 Chain C touched closure-ops for an unrelated finding, PA-175, not resolveActor) |
| 52 | `closure-ops/.../event-closure.service.ts:124` | `generateEventInsights` | W | `[PmcmAdmin, System]` | Not previously named |

*(Rows 14, 16 each represent multiple identically-gated call sites, counted individually in the totals below: row 14 = 8 sites, row 16 = 2 sites, bringing the true total to 60.)*

**Call sites outside this table, tracked separately:**

| Location | Count | Shape |
|---|---|---|
| `trust-ops/controllers/audit-privacy.controller.ts:24-37` (local function, not `EventAccessPolicyService.resolveActor`) | 10 call sites (`listLogs`, `exportLogs`, `listAlerts`, `integrity`, `inventory`, `retentionPolicies`, `requests` read, `createRequest`, `reviewRequest`, `executeRequest`) | Identical fail-open default (`input.actorRole ?? OpsUserRole.PmcmAdmin`), gated by a locally-defined `requireTrustOperator` that also hard-codes `if (actor.role === PmcmAdmin \|\| actor.role === System) return;` — same exposure shape, different (duplicated) implementation |
| `sample-compatibility/services/sample-compatibility.service.ts` | 63 call sites | Real, shared `EventAccessPolicyService.resolveActor` calls, but **confirmed dead code** — see Step 1b below |

### Step 1b — sample-compatibility.service.ts, verified dead

`SampleController` (`apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts`) exposes exactly three routes: `GET /sample/state`, `POST /sample/reset`, `POST /sample/seed`, mapping to `state()`, `resetSample()`, `seedSampleState()`. Read in full (`sample-compatibility.service.ts:632-690`): `state()` passes only pure mapper functions and two unguarded read calls (`listSupplierCategories`, `listSuppliers`) to `sampleStateService.state(...)`; `resetSample`/`seedSampleState` call `seedSample()`/`state()`/`ensureSeeded()`, none of which touch the ~20 private, resolveActor-gated methods (`listPmcmDashboard`, `listAuditLogs`, `listPrivacyRequests`, `listInquiries`, `listOnboarding`, `listEvents`, `getEventDetail`, `listBilling`, `listClientWorkspace`, `getClientActionCenter`, `getEventLiveOps`, `getCoordinatorWorkspace`, `getCoordinatorRoleView`, `getEventDayStatusFeed`, `createFloorPlanDraft`, `createFloorPlanPreference`, `submitFloorPlanDraft`, `approveFloorPlanDraft`, `replaceCoordinatorAssignment`, `updateCoordinatorAttendance`, and others). A repo-wide search for any call to each of these method names by their own class (`this.methodName(`) returns exactly one match each — their own declaration. **These 63 call sites are unreachable.** This is not a live exposure; it is vestigial duplication of logic that has since moved to the per-domain controllers already covered in rows 1-52 above. Recommended as a cleanup item (dead code removal), not a security fix — see PA list below for the one adjacent, genuinely live finding this file does contain (`reset`/`seed`, which don't call `resolveActor` at all).

---

## Step 2 — The exposure test, applied to every call site with PmcmAdmin/System in its allow-list

**Item 1 — resolveActor's default behavior, confirmed at every call site.** All 60 named call sites (Step 1's table) call the single canonical `EventAccessPolicyService.resolveActor` (`event-access-policy.service.ts:34-58`) directly or through a thin private wrapper that adds no additional check before calling it (e.g. `requireFinanceActor`, `requireSupplierAdmin`, `requireCommercialActor`, `requireEventDayWriteActor` all resolve the actor first, then check role — none of them supply a different `resolveActor` variant or reject on a missing role before the shared default applies). The literal default is unchanged everywhere: `(input.actorRole ?? input.role ?? OpsUserRole.PmcmAdmin).trim().toLowerCase()`.

**Item 2 — nothing else in the call chain catches a credential-less actor.** Confirmed via a repo-wide search across `apps/api` for `UseGuards`, `CanActivate`, `APP_GUARD`, any Passport strategy, or `app.use(...)`/middleware registration: zero matches anywhere. There is no global or per-route guard of any kind in this backend. Every controller reads `@Query() actorInput` directly from the raw HTTP query string and passes it straight to `resolveActor` with no intermediate verification. **The answer is plainly no — nothing else catches it, at any of the 52 exposed call sites, matching PA-193's shape exactly.**

**Item 3 — call sites whose allow-list excludes PmcmAdmin/System are correctly not exploitable by this specific issue.** 8 of the 60 named call sites (rows 9-11, 13, 17-18, 40-43 in the table above) check for `[Supplier]`, `[Coordinator]`, or `[Client]` exclusively. `resolveActor`'s default produces `pmcm-admin`, which satisfies none of these lists — an anonymous caller omitting `actorRole` is correctly rejected at these 8 sites. This is genuinely safe from *this specific* issue (these paths may still carry other risks, such as the identity-spoofing and IDOR gaps already documented for `Coordinator`-role paths in EP-11, but that is a different failure mode, not re-litigated here).

**Zero call sites fall into a middle "PmcmAdmin/System in the allow-list, but some other check mitigates it" category.** Every mitigating-looking mechanism found during this sweep (`canReadEvent`, `canMutateOfficialFloorplan`, `canViewInternalCosts`, `canViewPrivacyOperations`) turned out to itself special-case PmcmAdmin/System as automatically true — these are not independent second checks, they are the same exposure restated under a different method name.

### Step 2b — Named priority check: floorplan's requireCanMutateOfficialFloorplan

Confirmed directly, per the brief's specific instruction not to let this get lost in the general sweep. `EventAccessPolicyService.canMutateOfficialFloorplan` (`event-access-policy.service.ts:97-99`): `return actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System;` — exactly the two roles `resolveActor`'s fail-open default can produce. `requireCanMutateOfficialFloorplan` (lines 101-105) throws only if `canMutateOfficialFloorplan` returns false. Traced through `OpsEventFloorplansController.createFloorPlanDraft`/`submitFloorPlanDraft`/`approveFloorPlanDraft` (`event-floorplans.controller.ts:21-34,61-74,76-89`): each calls `resolveActor(actorInput)` then immediately `requireCanMutateOfficialFloorplan(actor, eventId, ...)`, with no other check in between. **Confirmed: an anonymous caller supplying no `actorRole` at all can create, submit for review, or approve an official floorplan draft for any event, with zero credentials.** This directly extends PA-193's shape to the floorplan module and corrects the implicit "guarded" framing this module has carried since the EP-05 audit (which documented the guard's existence and role-list, but predates the discovery that the fail-open default satisfies that exact role-list).

---

## Step 3 — Definitive table

| Category | Count |
|---|---|
| **Total named, individually-routable resolveActor call sites found (Step 1 table)** | **60** |
| — Exploitable by the fail-open default absent any other check (allow-list includes PmcmAdmin and/or System) | **52** |
| — Not exploitable by this specific default (allow-list is Client-only, Supplier-only, or Coordinator-only) | **8** |
| — Exploitable-looking but actually mitigated by some other real check | **0** |
| *Tracked separately, same root shape, different implementation:* trust-ops's local duplicate `resolveActor` (`audit-privacy.controller.ts`) | 10 (all exploitable) |
| *Tracked separately, confirmed dead code, not live:* sample-compatibility.service.ts's internal call sites | 63 (0 reachable) |

**87% (52/60) of every named, live call site of the shared authorization resolver in this backend is currently satisfiable by an HTTP request that supplies no actor information at all.** Adding the 10 confirmed-live trust-ops duplicates brings the total confirmed-exploitable count to **62**, spanning 12 distinct modules: supplier-ops, staffing-ops (read side), live-ops, inquiry-onboarding (read side), floorplan, finance-ops, file-ops, event-read-models (PMCM-gated methods), compliance-ops, commercial-ops, closure-ops, and trust-ops.

**Recommendation, one sentence:** Patch `resolveActor`'s default behavior once at its source — reject or throw on a missing/unspecified actor role rather than silently defaulting to `pmcm-admin` — because every one of the dozens of legitimate frontend call sites audited across this entire initiative (`apps/event`'s `withPmcmActor`, `withCoordinatorActor`, and every `SupplierActorDto`/`BillingActorDto`/`CommercialActorDto`/`ComplianceActorDto` caller inspected in this sweep) already supplies an explicit `actorRole` on every real request, meaning the lenient default currently protects zero legitimate traffic while being the exact mechanism that makes 62 confirmed call sites exploitable with no credentials — patching it centrally closes all of them in one change, while patching each call site individually would require touching at least 12 separately-owned modules today and would silently reopen with every new module a future team builds on top of the same shared service.

---

## New PA numbers

| PA | Severity | Module | One-line |
|---|---|---|---|
| PA-199 | CRITICAL | finance-ops | All 6 billing/payment write endpoints (`createBillingSource` through `sendBillingStatement`) exploitable via the fail-open default with zero credentials — corrects EP-08's "guarded, not exploited" framing for this module |
| PA-200 | CRITICAL | supplier-ops | `createSupplier`, `updateSupplier`, `changeSupplierTier`, `addSupplierReview`, `addSupplierCertification`, `withdrawSupplier` all exploitable via the fail-open default — corrects EP-07 Chain A/C's explicit "guarded, not exploited" finding for `changeSupplierTier`/`addSupplierReview` specifically |
| PA-201 | CRITICAL | floorplan | `requireCanMutateOfficialFloorplan` (create/submit/approve official floorplan drafts) exploitable via the fail-open default — the Step 2b named priority check, confirmed |
| PA-202 | HIGH | compliance-ops, commercial-ops, closure-ops | Compliance-rules CRUD, supplier-quote add/request/select, and event archive/insights generation all share the same `[PmcmAdmin, System]`-exploitable shape — three previously-unswept modules |
| PA-203 | CRITICAL | trust-ops | `audit-privacy.controller.ts` reimplements its own local `resolveActor` with the identical fail-open default, exposing audit logs, security alerts, audit export, and privacy/data-subject-request read/create/review/execute to anonymous callers |
| PA-204 | CRITICAL | event-read-models | `pmcmDashboard`, `pmcmCommandInbox`, `pmcmEventWorkspace`, `defenseReadiness`, `billing`, `eventList`, `eventDetail` all exploitable via the fail-open default — corrects EP-08's "guarded, not exploited" framing, which was verified only for this file's client-gated methods, not its PMCM-gated ones |

**Not assigned a new PA, noted for completeness:** `sample-compatibility.service.ts`'s 63 dead-code call sites (cleanup item, not a live exposure) and the module's genuinely live but separately-shaped `POST /sample/reset`/`POST /sample/seed` (zero actor input attempted at all, unconditionally registered in production `AppModule`, recommended as its own follow-up audit rather than folded into this sweep's fix).

---

## Correction to append to PRISM_Codebase_Facts.md (see closing entry there)

This sweep resolves the "Not yet done" note carried since the 2026-07-03 Correction and reaffirmed in the 2026-07-04 EP-11 Correction: the fail-open default has now been exhaustively swept across every named call site in `apps/api`, not discovered incidentally epic by epic. Full working shown in this file (`PRISM_Audits/ResolveActor_Sweep_2026-07-04.md`); only the closing conclusion is appended to Codebase Facts per the task's instruction.

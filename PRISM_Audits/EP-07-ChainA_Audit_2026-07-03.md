# EP-07 Chain A Audit — Supplier Directory, Quote Requests, Confirmations, Readiness, On-Site Status

**Date:** 2026-07-03
**Scope:** EP-07-S01 through EP-07-S05
**Branch:** `feature/ep-02-s05-coordinator-directory` (no prior commits on this branch belong to EP-07; consistent with the EP-04/EP-05/EP-06 audits produced earlier in this same session on the same branch — this is a read-only audit output, not a feature branch deliverable, so no new branch was created. Flagging per process instructions.)
**Method:** Direct code reading (controllers → services → ports → Prisma schema → frontend) for every AC, plus one dispatched `ecc:silent-failure-hunter` subagent pass over the backend surface. No application code was modified.
**Last PA number confirmed before this audit:** PA-161 (from `_Audit_Index.md`, EP-06 row). New PAs in this report: **PA-162 through PA-168**.

---

## Executive summary

This chain is **less broken than EP-01/EP-05/EP-06 on raw functionality** — most of S01, S02, S03, and S05's core mechanics are genuinely implemented, IDOR-checked, and role-gated correctly. But two things stand out:

1. **A new, more severe variant of "missing auth" was found**: `OpsSupplierPareController` (`@Controller('ai')`, routes `/ai/pare/*`) has **no actor resolution and no role check at all** — not even the fail-open default. Any caller can trigger a real supplier withdrawal, view pending AI/PARE approvals, and approve/reject them by self-asserting a name in a query string. This is worse than the previously-documented `resolveActor` fail-open pattern (PA-134/PA-137/PA-151-161) because there the actor is at least resolved and checked against an allow-list; here there is no check of any kind.
2. **EP-07-S04 is not 0% as tracked.** A working `confirmSupplierReadiness` command, IDOR-protected endpoint, and full supplier-facing UI (readiness board + confirm button + notes) already exist. This is the third time in this audit initiative (after EP-05-S01/S02) that a "To Do / 0%" tracker entry turned out to be substantially built.

Everywhere else, the pattern from EP-05/EP-06 (`resolveActor` defaulting an unspecified role to `pmcm-admin`) is present but **defanged** in this chain: every reachable supplier-ops/commercial-ops/live-ops endpoint that matters calls `requireActorRole` with an explicit allow-list immediately after `resolveActor`, so the fail-open default rarely gets a chance to matter here. This is the **third confirmed instance of the same root cause** (after EP-05 `plans.service.ts`, EP-06 `compliance-workflow.service.ts`) but in this chain it is consistently guarded rather than exploited — logged as confirmation, not a new finding.

| Story | Tracker claim | Audit finding | Real completion estimate |
|---|---|---|---|
| EP-07-S01 Supplier Directory | Done, 100%, C1 | Accurate — all ACs verified in code | **~95%** |
| EP-07-S02 Quote Requests | Done, 100%, C1 | One real AC failure (revision cap not enforced) | **~80%** |
| EP-07-S03 Supplier Quote Confirmation | Done, 100%, C1 | IDOR check passes; adjacent AI/PARE controller has zero auth (CRITICAL) | **~70%** (blocked from higher by PA-162) |
| EP-07-S04 Pre-Event Readiness Confirmation | To Do, 0%, C3 | Substantially built; several AC pieces genuinely missing | **~40%** |
| EP-07-S05 Supplier On-Site Status | Done, 100%, C3 | All core ACs pass, including full click-path to the live-ops dashboard; one dead-code duplication risk | **~85%** |

---

## EP-07-S01 — Supplier Directory

**Tracker:** Done, 100%, C1

| AC | Verdict | Evidence |
|---|---|---|
| Directory accessible to PMCM Admin from apps/event | PASS | `event-suppliers-tab.tsx` → `supplier-quote-planner.tsx`; sidebar `section === "suppliers"` in [EventDashboardClient.tsx:2290-2302](apps/event/src/app/dashboard/EventDashboardClient.tsx#L2290-L2302) renders `SupplierDirectory` |
| Exactly the 8 confirmed categories | PASS | Seeded in [sample-compatibility.service.ts:246-268](apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts#L246-L268): Production, Technicals, Digital Registration, Documentation, Food and Beverages, Talents, Logistics, Program and Manpower |
| Tier 1/2 + Pending First Event | PASS | `SupplierTier` enum values `tier_1`/`tier_2`/`pending_first_event`, rendered and filterable in [supplier-directory.tsx](apps/event/src/app/components/pmcm/supplier-directory.tsx) |
| BNI Member flag | PASS | `bniMember` boolean, toggle wired through `onToggleBni` → `updateSupplier` |
| Reliability notes stored/retrievable | PASS | `OpsSupplierReliabilityNote` model, mapped in [suppliers.service.ts:291-297](apps/api/libs/modules/supplier-ops/src/services/suppliers.service.ts#L291-L297) |
| Certifications attachable | PASS | `addSupplierCertification` command + `OpsSupplierCertification` model |
| Aggregate rating visible to PMCM Admin only (traced via actual read path, not just UI) | **PASS** | `mapSupplier()` includes `aggregateRating` ([suppliers.service.ts:248-274](apps/api/libs/modules/supplier-ops/src/services/suppliers.service.ts#L248-L274)), but the **only** endpoint that returns it — `GET /suppliers` — requires `[PmcmAdmin, System]` in [supplier-directory.controller.ts:25-34](apps/api/libs/modules/supplier-ops/src/controllers/supplier-directory.controller.ts#L25-L34). The supplier-facing read path (`supplierWorkspace`) calls `sanitizeSupplierForSupplier()` which explicitly strips `reviews, reliabilityNotes, performanceNotes, aggregateRating, lastEventDate, pastEvents` ([event-read-models.service.ts:942-946](apps/api/libs/modules/event-read-models/src/services/event-read-models.service.ts#L942-L946)). No leak path found. |
| BNI flag persists after toggle | PASS | Persisted via Prisma `update`, re-read on next `list()` |
| Filterable/searchable by category and tier | PASS | [supplier-directory.tsx:88-97](apps/event/src/app/components/pmcm/supplier-directory.tsx#L88-L97) — search by name/contact/email, filter by category, tier, and rating band |
| Non-PMCM actors denied at API level | PASS | `GET /suppliers` (list) → PmcmAdmin/System only; mutations (`create/update/tier/review/certification`) route through `SupplierProfileCommandsService` whose `validatePermission` calls `requireSupplierAdmin` (PmcmAdmin/System) inside `WorkflowCommandService.execute()`, confirmed to run **before** `write()` ([workflow-command.service.ts:28](apps/api/libs/modules/event-core/src/services/workflow-command.service.ts#L28)) |

**No new PA for S01.** This story is close to what the tracker claims — the first "Done" story in this audit initiative to survive re-verification essentially intact.

---

## EP-07-S02 — Quote Requests

**Tracker:** Done, 100%, C1

| AC | Verdict | Evidence |
|---|---|---|
| Sendable per category to Tier 1 and Tier 2 independently | PASS | `requestSupplierQuotes` accepts explicit `supplierIds`, defaults to Tier 1 only if omitted ([commercial-workflow.service.ts:58-116](apps/api/libs/modules/commercial-ops/src/services/commercial-workflow.service.ts#L58-L116)) |
| Includes event details, service scope, deadline | PASS | `message`, `category`, `dueDate` set on creation |
| Supplier notified on request | PASS | `notificationOutboxService.queue()` (email + viber) in `sideEffects` |
| **One revision allowed before deadline, second blocked server-side** | **FAIL — PA-163** | `saveSupplierQuoteByToken()` ([commercial-workflow.service.ts:367-420](apps/api/libs/modules/commercial-ops/src/services/commercial-workflow.service.ts#L367-L420)) only blocks edits once the **request** is `selected/closed/expired` or the **quote** is `selected/locked`. It unconditionally does `revisionNumber: quote.revisionNumber + 1` with no ceiling check. A supplier can call `PATCH /quote-requests/:token/quote` any number of times before the deadline/selection — there is no "second revision blocked" behavior anywhere in this method. |
| Quote locked (no supplier edits) after PMCM selects | PASS — verified via actual state transition | `selectSupplierQuote` sets `status: Selected, lockedAt` ([commercial-workflow.service.ts:294-365](apps/api/libs/modules/commercial-ops/src/services/commercial-workflow.service.ts#L294-L365)); `saveSupplierQuoteByToken`'s `validateState` throws `BadRequestException('Supplier quote is already locked')` if status is `Selected`/`Locked` — this is enforced in the write path, not just described in a comment |
| PMCM views all received quotes for a category side by side | PASS | [supplier-quote-planner.tsx:129-217](apps/event/src/app/components/pmcm/supplier-quote-planner.tsx#L129-L217) — grid of quote cards per category with amount, inclusions, payment terms, outside-acceptable-range flag |
| Quote data not exposed to client/guest/coordinator | PASS | `event-read-models.service.ts` explicitly hardcodes `supplierQuotes: []` in the client-workspace and coordinator-workspace read models (lines 320, 341); only `pmcmDashboard`/`pmcmEventWorkspace` (PmcmAdmin/System-gated) populate real quote data |

**New finding — PA-163 (HIGH):** Quote revision limit is not enforced server-side. `apps/api/libs/modules/commercial-ops/src/services/commercial-workflow.service.ts:367-420` (`saveSupplierQuoteByToken`). A supplier can revise a submitted quote an unlimited number of times up until the request is closed/selected/expired, contradicting the AC that only one revision is allowed with a clear-message block on the second attempt. Fix: track a revision cap (likely 1) alongside `revisionNumber` and throw `BadRequestException` once exceeded.

---

## EP-07-S03 — Supplier Quote Confirmation (apps/supplier)

**Tracker:** Done, 100%, C1

| AC | Verdict | Evidence |
|---|---|---|
| Supplier can view full quote request details in apps/supplier | PASS | `RequestsPage` in [dashboard/page.tsx:309-422](apps/supplier/src/app/dashboard/page.tsx#L309-L422), backed by `supplierWorkspace` |
| Explicit confirm-before-assignment; no path to mark assigned without a confirmation record | PASS | `confirmSupplierAssignment` is the only place `assignmentStatus: 'confirmed'` is set ([supplier-network-workflow.service.ts:75-107](apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts#L75-L107)); no other code path sets this value |
| Confirmation triggers status update visible to PMCM | PASS | Audit log entry + `assignmentStatus` surfaced through `mapSupplierQuoteRequest` in `pmcmEventWorkspace` |
| **CRITICAL — supplier can only view/act on own quote requests (IDOR)** | **PASS** — this is the single most important check in this story, and it holds | `requireSupplierQuoteRequestForActor()` ([supplier-network-workflow.service.ts:386-396](apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts#L386-L396)) resolves the caller's own supplier record by `supplierId`/`email`/`name` match, then explicitly checks `request.supplierId !== supplier.id` → `ForbiddenException` + audit log of the forbidden attempt. Used by `confirmSupplierAssignment`, `confirmSupplierReadiness`, `uploadSupplierContract`. The live-ops equivalent (`updateSupplierEventStatus`) has its own identical IDOR guard at [event-live-ops-command.service.ts:273-288](apps/api/libs/modules/live-ops/src/services/event-live-ops-command.service.ts#L273-L288). No bypass path found. |
| **CRITICAL — no raw AI output shown to supplier (FR-AI-04b)** | PASS for the literal AC, but see PA-162 below | `apps/supplier/src/lib/prism-api.ts` never calls any `/ai/*` route; `mapSupplierQuoteForSupplier()` strips `acceptableMin/acceptableMax/outsideAcceptableRange`; `SupplierPareApprovalRecord` shape only exposes `budgetAnalysis.selectedCandidate.supplierName` + `mode`, not free-text model reasoning. No path from `ai-governance`/PARE output to any apps/supplier-reachable route. |
| Supplier cannot access client/coordinator/PMCM internal cost data | PASS | Same stripping as above; `acceptableMin/acceptableMax` (the internal budget band) never reaches the supplier-facing mapper |

**New finding — PA-162 (CRITICAL):** `OpsSupplierPareController` (`apps/api/libs/modules/supplier-ops/src/controllers/supplier-pare.controller.ts`) exposes four routes under `@Controller('ai')` with **zero actor resolution and zero role check** — no `resolveActor`, no `requireActorRole`, nothing:

- `POST /ai/pare/trigger/:requestId` — despite being labeled a "manual PARE trigger," this actually calls `withdrawSupplier(requestId, 'Manual PARE trigger via API', ...)`, which sets a live supplier assignment's `assignmentStatus` to `withdrawn` ([supplier-pare.controller.ts:9-17](apps/api/libs/modules/supplier-ops/src/controllers/supplier-pare.controller.ts#L9-L17)). Any caller — including an unauthenticated one, since no global auth guard exists anywhere in `apps/api` (confirmed via repo-wide grep for `AuthGuard`/`APP_GUARD`/`UseGuards` — zero matches) — can withdraw any supplier's assignment on any event.
- `GET /ai/pare/pending` — returns all pending AI/PARE approval records for any/all events to any caller.
- `PATCH /ai/pare/:approvalRecordId/approve` and `.../reject` — approve or reject a PARE recommendation with an arbitrary self-asserted `approvedBy`/`rejectedBy` value taken directly from a query string parameter.

This is the same "scope creep ahead of PARE/EP-12-S02" pattern the audit brief asked to check for — confirmed present, and worse than anticipated: it's not "raw AI output leaking to the supplier app" (that specific path is clean), it's a **complete authorization bypass on a real, state-changing AI-automation control surface**, reachable by anyone with the API's base URL. This is distinct from the known `resolveActor` fail-open pattern (PA-134/137/151-161) — there, an actor is at least resolved and checked; here, no check of any kind exists. Recommend gating this controller to `[PmcmAdmin, System]` immediately, and treating `pareManualTrigger`'s naming/behavior mismatch (silent-failure-hunter finding #6) as a related but separate defect — an authorized PMCM Admin using this endpoint expecting "just get me a recommendation" would unknowingly withdraw a confirmed supplier.

---

## EP-07-S04 — Pre-Event Readiness Confirmation at 7 Days

**Tracker:** To Do, 0%, C3 — **this is the negative control; 0% is NOT accurate.**

Given the EP-05-S01/S02 precedent (both showed 0% while substantially built), a full search was run rather than trusting the tracker. Result: **substantially partial, closer to 40% than 0%.**

**What exists:**
- `confirmSupplierReadiness(requestId, input, actor)` — real command, IDOR-protected via the same `requireSupplierQuoteRequestForActor` guard as S03, sets `readinessStatus: 'confirmed'`, `readinessConfirmedAt`, `readinessNotes` ([supplier-network-workflow.service.ts:175-212](apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts#L175-L212)).
- Real endpoint: `PATCH /supplier/quote-requests/:requestId/readiness/confirm` ([supplier-workspace-commands.controller.ts:20-28](apps/api/libs/modules/supplier-ops/src/controllers/supplier-workspace-commands.controller.ts#L20-L28)).
- Real supplier-facing UI: "2. Readiness & contract" step in `BookingsPage` ([dashboard/page.tsx:507-530](apps/supplier/src/app/dashboard/page.tsx#L507-L530)) — a "Confirm readiness" button with a notes field, wired to `prismApi.confirmReadiness`.
- A `supplierReadinessBoard` endpoint (`GET /supplier/readiness-board`) and matching UI panel exist, but this is **supplier-scoped** (requires `[OpsUserRole.Supplier]`, shows only the calling supplier's own items) — not a PMCM view.

**What's missing (confirmed by search, not assumed):**
- **Auto-trigger at exactly 7 days**: no cron/scheduler/timer logic found anywhere referencing readiness (grep for "7.day"/"sevenDay" across `apps/api/libs` found nothing relevant to readiness triggering). Readiness confirmation today is purely supplier-initiated, whenever they choose to click the button — there is no system-driven prompt at the 7-day mark.
- **True one-tap yes/no**: the UI only offers "Confirm readiness" (a single affirmative action) plus a free-text note. There is no "no / not ready" path — a supplier who is not ready has no button to press; they simply don't click confirm. This is a partial implementation of the "yes/no" requirement (PA-77 already settled the design; the *build* is incomplete against that design).
- **Consolidated PMCM view**: no PMCM-facing readiness board exists anywhere in `apps/event`. `usePmcmEventReadiness` ([use-pmcm-event-readiness.ts](apps/event/src/features/event-dashboard/use-pmcm-event-readiness.ts)) loads `defenseReadiness` (a different, EP-06 feature, already flagged as such in the EP-06 audit), `liveOps`, and `statusFeed` — none of these are a per-supplier readiness confirmation rollup. The only readiness board that exists is supplier-scoped, described above.
- **48-hour unresponsive flag**: no matching logic found anywhere in the reviewed modules.
- **Feed into EP-06-S02**: no code path connects `readinessStatus` to the compliance engine reviewed in the EP-06 audit; EP-06-S02's compliance engine does no automated validation at all per that prior audit, so there is nothing on the receiving end regardless.

**New finding — PA-164 (MEDIUM-HIGH, tracker accuracy):** EP-07-S04 tracked as "To Do, 0%" is inaccurate in the same direction as EP-05-S01/S02 — a working confirm-readiness command, IDOR-protected endpoint, and supplier-facing UI already exist. However, unlike a pure tracker-inflation case, the *missing* pieces (auto-trigger, true yes/no, PMCM consolidated view, unresponsive flag, EP-06-S02 feed) are also real and substantial, so this should not be moved to "Done" — it should move to **In Progress, ~40%**.

---

## EP-07-S05 — Supplier On-Site Status (apps/supplier)

**Tracker:** Done, 100%, C3

| AC | Verdict | Evidence |
|---|---|---|
| Exactly 3 status buttons: Arrived, Set Up and Ready, Done and Leaving | PASS | `SupplierEventStatusDto.status` validated with `@IsIn(['arrived', 'set_up_ready', 'done_leaving'])` ([live-ops.dto.ts:182-193](apps/api/libs/modules/live-ops/src/dto/live-ops.dto.ts#L182-L193)); frontend `EVENT_STATUS_ACTIONS` array has exactly these 3 entries ([dashboard/page.tsx:87-91](apps/supplier/src/app/dashboard/page.tsx#L87-L91)) |
| Optional photo upload, genuinely optional | PASS | `photo?: UploadMetadataDto` is `@IsOptional() @IsObject()`; write path (`statusPhotoFileName: input.photo?.fileName?.trim() || null`) tolerates its absence with no silent default substitution |
| Each update timestamped with supplier identity | PASS | `eventDayStatusAt: new Date()` + audit log carries `actor.name`/`actor.role` |
| **CRITICAL — click-path trace: "Arrived" click → PMCM live-ops dashboard** | **PASS, fully traced** | `updateEventStatus` button ([dashboard/page.tsx:540-549](apps/supplier/src/app/dashboard/page.tsx#L540-L549)) → `prismApi.updateEventStatus` → `PATCH /supplier/quote-requests/:requestId/event-status` ([supplier-live-ops.controller.ts:9-16](apps/api/libs/modules/live-ops/src/controllers/supplier-live-ops.controller.ts#L9-L16)) → `updateSupplierEventStatus` (IDOR-checked) → `prisma.opsSupplierQuoteRequest.update({eventDayStatus})` → surfaced in `getEventLiveOps`'s `supplierStatuses` ([event-live-ops-read.service.ts:89-105](apps/api/libs/modules/live-ops/src/services/event-live-ops-read.service.ts#L89-L105)) → rendered by `SupplierRow` in `LiveOperationsWorkspace` ([live-operations-workspace.tsx:402-423](apps/event/src/app/components/pmcm/live-operations-workspace.tsx#L402-L423)) with live status label and Verify/Dispute buttons. **This specific sub-feature of EP-12-S01 (supplier setup panel) is fully built and wired**, despite EP-12-S01 overall being tracked at 50% — the gap, if any, is elsewhere in that story, not on this AC. |
| **Two verification levels (Self-Reported / Verified); PA-76 open on who performs Verified** | **RESOLVED with code evidence** | `verifySupplierEventStatus` in `event-live-ops-command.service.ts` (the reachable implementation, wired via `EventLiveOpsController` at `PATCH /events/:eventId/supplier-status/:requestId/verify`) calls `requireEventDayWriteActor`, which allows `[PmcmAdmin, System, Coordinator]`. So: Verified-level logic **does exist**, and there **is** a valid actor path (PMCM Admin or Coordinator, via the "Verify on site" / "Dispute setup" buttons in `LiveOperationsWorkspace`). PA-76 as a design question is answered by this evidence; it should be closed as "Verified performed by PMCM Admin or Coordinator via the live-ops dashboard," not left open. |
| Supplier can only update own status (IDOR) | PASS | `requireSupplierQuoteRequestForActor` in `event-live-ops-command.service.ts:273-288`, identical pattern to S03 |
| Client, coordinator, guest denied | PASS | `updateSupplierEventStatus` (self-report) requires `[Supplier]` only; `verifySupplierEventStatus` requires `[PmcmAdmin, System, Coordinator]` — Client and Guest are correctly excluded from both directions |

**New finding — PA-165 (MEDIUM):** `SupplierNetworkWorkflowService` (`supplier-ops` module) contains its own `updateSupplierEventStatus` and `verifySupplierEventStatus` methods ([supplier-network-workflow.service.ts:214-323](apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts#L214-L323)) that duplicate the live-ops versions. No controller in the reviewed set calls these supplier-ops versions — they appear to be dead code, reachable only from unit tests. Critically, the supplier-ops `verifySupplierEventStatus` has **no `validatePermission` call at all** (only `validateState`), unlike its live-ops sibling. This is not currently exploitable (unreachable), but is a latent authorization-bypass risk: if a future change wires this method to a controller (or the `SupplierCommands` port is used directly by another module), the guard would be silently missing. Recommend deleting the dead duplicate in favor of the live-ops implementation, or adding the same `requireEventDayWriteActor`-equivalent guard if it must stay.

---

## Cross-cutting: `resolveActor` fail-open pattern in supplier-ops/commercial-ops/live-ops

Checked every controller/service touched by S01–S05 for whether it calls `EventAccessPolicyService.resolveActor` (`event-access-policy.service.ts:34-58`, which defaults an actor with no role to `PmcmAdmin`) and whether an explicit `requireActorRole`/equivalent check follows.

**Result: every reachable endpoint in this chain calls `resolveActor` and then immediately follows with an explicit `requireActorRole` (or `requireSupplierQuoteRequestForActor`, which itself calls `requireActorRole`) against a specific allow-list.** This is the **third confirmed instance of the same `resolveActor` default-to-PmcmAdmin design** (after `plans.service.ts` in EP-05 and `compliance-workflow.service.ts` in EP-06), documented here as confirmation of the existing root cause, not a new finding — but unlike those two prior instances, no exploitable gap was found in this chain's use of it, because the explicit role check always runs afterward.

The one genuine gap in this chain (`OpsSupplierPareController`, PA-162) is a **different and more severe defect**: it doesn't rely on or get caught by the fail-open default at all — it skips actor resolution entirely.

---

## Silent-failure findings (via `ecc:silent-failure-hunter` subagent, EP-07 backend surface)

Full subagent report incorporated as PA-166 through PA-168 below.

**New finding — PA-166 (MEDIUM):** Write-then-unguarded-sideEffects pattern across `confirmSupplierAssignment`, `confirmSupplierReadiness`, `updateSupplierEventStatus`, `uploadSupplierContract`, `verifySupplierEventStatus` (`supplier-network-workflow.service.ts`), `requestSupplierQuotes`, `addSupplierQuote`, `selectSupplierQuote`, `saveSupplierQuoteByToken` (`commercial-workflow.service.ts`), and both live-ops command methods. `WorkflowCommandService.execute()` runs `write()` then `sideEffects()` sequentially outside a transaction; an unwrapped `auditService.audit()`/`notificationOutboxService.queue()` failure in `sideEffects` throws after the DB write already committed, so the caller sees a 500 for a mutation that actually succeeded. In `requestSupplierQuotes` specifically, a retry is then blocked by the duplicate-active-request guard in `validateState`, producing an admin-facing dead end with no self-service recovery. Note the same file already wraps equivalent calls in try/catch for `withdrawSupplier` and `auditPareDecision` with an explicit "audit failure shouldn't roll back state" comment — the fix pattern is known internally but applied inconsistently.

**New finding — PA-167 (LOW-MEDIUM):** `suppliers.service.ts:118-134` (`updateSupplier`) converts any Prisma error via `.catch(() => { throw new NotFoundException('Supplier not found'); })`, masking transient infrastructure failures (connection drop, timeout, FK violation) as a hard-coded "not found," misleading both callers and any future debugging.

**New finding — PA-168 (LOW):** `triggerPareForWithdrawnSupplier` (fire-and-forget after `withdrawSupplier`) only logs on failure with no admin-visible signal; a failed PARE trigger is indistinguishable from "no recommendation was needed" in `GET /ai/pare/pending`. Worth confirming with product intent rather than treating as a pure bug, but flagged since no dashboard/notification surfaces this failure mode today.

---

## Summary of new PA numbers

| PA | Severity | Story | One-line |
|---|---|---|---|
| PA-162 | CRITICAL | S03 (adjacent) | `/ai/pare/*` controller has zero auth; can trigger real supplier withdrawal, view/approve/reject PARE records as anyone |
| PA-163 | HIGH | S02 | Quote revision count not capped server-side; unlimited revisions possible |
| PA-164 | MEDIUM-HIGH | S04 | Tracker shows 0%/To Do; readiness-confirm command + IDOR endpoint + supplier UI already built, ~40% real |
| PA-165 | MEDIUM | S05 (latent) | Dead-code duplicate of event-day status methods in supplier-ops lacks the role guard its live-ops sibling has |
| PA-166 | MEDIUM | S02/S03/S05 | Write-then-unguarded-sideEffects across multiple workflow methods; transient audit/notification failure surfaces as a false 500 |
| PA-167 | LOW-MEDIUM | S01 | `updateSupplier` masks all Prisma errors as "Supplier not found" |
| PA-168 | LOW | S03 (adjacent) | Fire-and-forget PARE trigger failure has no admin-visible signal |

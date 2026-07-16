# EP-07 Chain C Audit — Internal Supplier Review, Supplier Tier Assessment and Manual Adjustment

**Date:** 2026-07-03
**Scope:** EP-07-S07, EP-07-S08 — final chain of EP-07; all 10 EP-07 stories are now re-verified across Chains A, B, and C.
**Branch:** `feature/ep-02-s05-coordinator-directory` (same branch used for Chains A/B and EP-04 through EP-06; no prior commits on this branch belong to this chain either. Read-only audit output, no new branch created.)
**Method:** Direct code reading (controllers → services → ports → Prisma schema → frontend) for every AC, a dispatched `ecc:silent-failure-hunter` subagent pass, and a manual trace of the S07 → S08 → S01 data flow as one continuous path. No application code was modified.
**Last PA number confirmed before this audit:** PA-168 (from `_Audit_Index.md`, EP-07 Chain A row; Chain B raised none). New PAs in this report: **PA-169 through PA-175**.

---

## Executive summary

**S07's headline finding is architectural, not a code bug**: the codebase has no concept of an "EA" role. `OpsUserRole` (`apps/api/libs/modules/event-core/src/ops.constants.ts:1-9`) defines exactly `PmcmAdmin, Client, Coordinator, Supplier, Guest, System, Unknown` — no `EA` value exists anywhere in the role model. The only place the string "EA" appears in the entire codebase is a hardcoded sample-data label (`reviewedBy: 'EA'` in a seeded review record, `sample-compatibility.service.ts:2063`) — a free-text label, not a permission. **The AC "only Ms. Mys and EA can access, no other actor" cannot be satisfied by the current codebase as literally written**, because every gate that exists is PmcmAdmin-broad: any credential holder with the `pmcm-admin` role passes it, whether or not they are Ms. Mys or a defined EA. This is stated plainly per the audit brief's instruction, not softened.

**S08 follows the now-familiar pattern from Chain A's S04**: tracked "To Do, 0%," but the `changeSupplierTier` command identified as the known entry point is fully built, fully wired to a real UI, produces a real audit-trail write, correctly omits any supplier notification, and correctly reflects on the S01 directory record via the dashboard's `refresh()` call after every action. It was never built as a dedicated "S08 feature" — it's S01's own tier-management UI, already audited in Chain A — but it substantively satisfies most of S08's own AC list.

**The S07 → S08 → S01 flow is a single continuous data path and was traced end to end**: a review submitted via `supplier-directory.tsx`'s "Private PMCM Review" form writes to `OpsSupplierReview` → is included in `mapSupplier()`'s `reviews` array and rolled into `aggregateRating` → is displayed back on the same supplier's detail panel as a single blended star rating. The path does not break, but it also doesn't fully deliver what S08 asks for: the UI renders only the aggregate number, never the individual review history (see S08 findings below).

**Unexpected but confirmed connection to EP-14-S01**: contrary to a plausible assumption that S07 review data goes nowhere beyond the PMCM supplier panel, `apps/api/libs/modules/closure-ops/src/services/event-closure.service.ts:223-227` explicitly reads `OpsSupplierReview` records for an event and writes their `rating`, `notes`, and `reviewedBy` into `OpsEventInsight.supplierNotes` (a JSON field) as part of event-closure insight generation. This **is** a real, working connection from S07 to the Event Insights Card's backing data — not a dangling reference. It is properly access-gated (see cross-cutting section).

| Story | Tracker claim | Audit finding | Real completion estimate |
|---|---|---|---|
| EP-07-S07 Internal Supplier Review | Done, 100%, C1 | Core mechanism works but gated to PmcmAdmin broadly, not "Ms. Mys and EA" specifically; category-dimension ratings entirely missing; PA-71 is this story's own stated FAIL trigger and is still open | **~65%** |
| EP-07-S08 Supplier Tier Assessment and Manual Adjustment | To Do, 0%, C3 | Tier-change command/UI/audit-trail/click-path already exist via reused S01 infrastructure; missing a dedicated accumulated-ratings history view | **~70%** |

---

## EP-07-S07 — Internal Supplier Review

**Tracker:** Done, 100%, C1

### CRITICAL architecture question — answered first, per the brief's instruction

**No distinct "EA" role exists in code.** `OpsUserRole` has no `EA` member. Every access check in the supplier-review path (`SupplierProfileCommandsService.requireSupplierAdmin`, `apps/api/libs/modules/supplier-ops/src/services/supplier-profile-commands.service.ts:151-158`, confirmed in Chain A) restricts to `[OpsUserRole.PmcmAdmin, OpsUserRole.System]` — the same broad PmcmAdmin gate used for every other supplier mutation, not a narrower Ms.-Mys-or-EA-specific check. **As written, this AC is not achievable with the current role model**: any actor holding a `pmcm-admin` credential — not just Ms. Mys, not just a defined EA — passes this gate. This is not a bug to fix in this code path alone; it's a role-model gap that would need a new distinct role (or a narrower allow-list keyed to specific admin identities) to actually satisfy the AC as written.

| AC | Verdict | Evidence |
|---|---|---|
| Access restricted to Ms. Mys and EA only | **FAIL, architecturally unachievable today** | See above. Gated to PmcmAdmin broadly via `requireSupplierAdmin`, not to Ms. Mys or EA specifically. PA-169. |
| Overall star rating (1-5) captured | PASS | `CreateSupplierReviewDto.rating` (`supplier.dto.ts`, `@IsInt() @Min(1)`), frontend dropdown `[5,4,3,2,1]` in `supplier-directory.tsx:365-367` |
| **Category-specific dimension ratings per supplier** | **FAIL** | Searched the entire `supplier-ops` module and the review DTO/form for any dimension/quality/reliability/communication/price-specific rating field — none exists. `CreateSupplierReviewDto` has exactly `eventId?`, `rating`, `notes`, `reviewedBy?` — one overall number, no breakdown. The frontend review form (`supplier-directory.tsx:363-372`) has one star-rating dropdown and one free-text notes field, nothing else. PA-170. |
| Private notes field stored and visible only to Ms. Mys/EA | PARTIAL — stored correctly, access question same as above | `notes` stored on `OpsSupplierReview`; access-gated to PmcmAdmin broadly, same caveat as the top-line access question |
| **CRITICAL — review ratings not visible to supplier, other suppliers, clients, coordinators, or guests under any circumstance** | **PASS, traced through every read path found** | `sanitizeSupplierForSupplier()` (`event-read-models.service.ts:942-946`) explicitly strips `reviews, reliabilityNotes, performanceNotes, aggregateRating, lastEventDate, pastEvents` before returning supplier data via `supplierWorkspace` and `supplierReadinessBoard` (both supplier-role-only endpoints). Client-workspace and coordinator-workspace read models in the same file never reference `reviews`/`aggregateRating` at all — confirmed by grep, these fields appear nowhere outside the PMCM-gated `mapSupplier()` path and the sanitize-strip. Also traced the newly-discovered `OpsEventInsight.supplierNotes` path (which embeds review `rating`/`notes`/`reviewedBy`): its read/write endpoints (`GET/POST /:eventId/insights*`, `closure-ops`) both call `requireActorRole([PmcmAdmin, System])` before touching the data — no leak found there either. |
| Reviewed-by identity accurately reflects the acting admin | **FAIL, separate finding** | `supplier-directory.tsx:143` — `submitReview()` hardcodes `reviewedBy: "Ms. Mys"` regardless of which actual PmcmAdmin-credentialed user clicks the button. This means the stored attribution cannot be trusted to say who actually wrote a given private review — consistent with the already-known hardcoded-actor-identity pattern (PA-142, EP-04's audit: "conforme-upload audit entry hardcodes actor... same defect class as the EP-01 cross-cutting hardcoded-actor finding"), but a distinct instance specific to this flow. This undermines the practical effect of the "only Ms. Mys and EA" intent even further: even if role-gating were narrowed correctly, the review record's own metadata would still lie about who wrote it. PA-171. |
| Feeds EP-07-S08 (tier decisions) | PASS, see S08 section | `aggregateRating`/`reviews` are available to whatever reads `mapSupplier()`, which is what S08's tier-change UI operates alongside (same supplier detail panel) |
| Feeds Event Insights Card (EP-14-S01) | **PASS, confirmed connected** — contrary to a plausible assumption of no connection | `event-closure.service.ts:223-227` maps `supplierReviews` into `OpsEventInsight.supplierNotes` on every insight generation/regeneration. This is real, working code, not a stub. Properly access-gated (see above). |

**GOVERNANCE FINDING — not a code check, documented as instructed:** PA-71 (EA role full name and login type unconfirmed) is confirmed still open in the live tracker per the audit brief. This story's own stated FAIL trigger explicitly includes "PA-71 is unresolved at Done call." Regardless of what the code review above shows, **the Done status is invalid on the story's own stated terms** — this is worth stating plainly rather than only inferring it from the architecture finding.

**Completion estimate: ~65%.** The mechanically-working parts (rating capture, notes storage, PmcmAdmin gating, and the privacy strip on every supplier/client/coordinator read path) are solid and genuinely well-built. But: the dimension-rating AC is entirely unimplemented, the access-control AC is unachievable as written given the current role model, the reviewedBy attribution is fabricated by the frontend, and the story's own governance condition (PA-71) is unmet. That combination does not support "Done."

---

## EP-07-S08 — Supplier Tier Assessment and Manual Adjustment

**Tracker:** To Do, 0%, C3 — **do not accept without a search, per the brief; searched, and it is NOT 0%.**

Traced the known entry point first, as instructed: `SupplierProfileCommandsService.changeSupplierTier` (`supplier-profile-commands.service.ts:72-95`) → `SuppliersService.changeSupplierTier` (`suppliers.service.ts:140-153`).

| AC | Verdict | Evidence |
|---|---|---|
| PMCM Admin can view accumulated post-event review ratings per supplier across multiple events | **PARTIAL** | `mapSupplier()` computes `aggregateRating` as the mean of all `reviews[].rating` across every linked event (`suppliers.service.ts:249-253`), and this single blended number **is** rendered in the UI as "Internal Rating" via `RatingStars` (`supplier-directory.tsx:403-406`). But the underlying `reviews` array — which carries each individual review's `rating`, `notes`, `eventName`, `createdAt` — is returned by the API and then **never rendered anywhere in `supplier-directory.tsx`** (confirmed by grep: `selectedSupplier.reviews` has zero references in the component; only `reliabilityNotes`, a different field, is rendered as a list). A PMCM Admin can see the blended average but cannot see the review history broken out by event. PA-173. |
| PMCM Admin can manually upgrade/downgrade tier (Tier 1/Tier 2) | PASS | "Tier Change" panel (`supplier-directory.tsx:347-360`): dropdown for `tier_1`/`tier_2`/`pending_first_event`, required reason textarea, `submitTierChange()` → `onChangeTier` → `prismApi.changeSupplierTier(supplierId, { tier, reason })` → `PATCH /suppliers/:supplierId/tier`, gated PmcmAdmin/System via `requireSupplierAdmin` inside `WorkflowCommandService.execute()` (confirmed running before write, Chain A) |
| **Tier change recorded with timestamp, acting admin identity, and rationale in the audit trail — confirm real write, not a comment** | **PASS, confirmed as a real write** | `supplier-profile-commands.service.ts:77-92`, `sideEffects` calls `auditService.audit(undefined, actor.name, ..., { actorRole, actorEmail, category: Suppliers, actionType: Update, affectedType: 'supplier', metadata: { oldTier, newTier: input.tier, reason: input.reason } })` — this is a real `AuditService.audit()` call writing to `OpsAuditLog`, not a `console.log` or a comment. `input.reason` is required (`ChangeSupplierTierDto.reason` is non-optional, and `SuppliersService.changeSupplierTier` throws `BadRequestException` if the trimmed reason is empty). |
| **Tier change reflected immediately on the S01 directory record — real click-path check** | **PASS, traced through the actual refresh mechanism** | The frontend's `run()` helper (`EventDashboardClient.tsx:1564-1579`), which wraps every PMCM action including `onChangeTier`, calls `await action()` then unconditionally `await refresh()` immediately after. `refresh()` re-fetches the full PMCM dashboard payload (including the `suppliers` list from `SuppliersService.listSuppliers()`), so the same `supplier-directory.tsx` view a user is looking at re-renders with the updated tier without a page reload. This is a real, verified click-path, not an assumption. |
| Supplier not notified of internal tier assessment/decision | **PASS, confirmed absent** | Grepped the entire `supplier-ops` module for any `notify`/`NotificationChannel`/notification-outbox reference inside `changeSupplierTier`'s call chain — zero matches. `sideEffects` for this command contains only the audit-log call, nothing else. |
| Client, coordinator, guest cannot access tier assessment data | PASS | Same gate as every other supplier mutation/read audited in Chain A: `list()` (GET, aggregate/tier visible) requires `[PmcmAdmin, System]`; `changeTier` (mutation) requires the same via `requireSupplierAdmin`. No separate, looser endpoint found for tier data. |

**Completion estimate: ~70%.** This was never built as a dedicated feature, but the shared infrastructure from S01 already satisfies five of six AC items with real, working, audit-logged, correctly-gated code. The one genuine gap is the "view accumulated ratings" AC, which is only half-delivered (aggregate yes, history no).

---

## Cross-cutting: S07 → S08 → S01 flow, traced as one path

1. Review submitted (S07): `supplier-directory.tsx` "Private PMCM Review" form → `onAddReview` → `prismApi.addSupplierReview` → `POST /suppliers/:supplierId/reviews` → `SupplierProfileCommandsService.addSupplierReview` (gated) → `SuppliersService.addSupplierReview` → `OpsSupplierReview` row created.
2. Read back in the same panel: `mapSupplier()` recomputes `aggregateRating` from all `reviews` on next fetch → displayed as "Internal Rating" stars.
3. Tier decision (S08): PMCM Admin, looking at that same aggregate number (or their own out-of-band judgment — there's no gating that requires having read the reviews first, which is expected, this is a human decision point, not a code path), uses the adjacent "Tier Change" panel → `changeSupplierTier` → `OpsSupplier.tier` updated.
4. Directory reflection (S01): `run()`'s `refresh()` re-fetches suppliers → `supplier-directory.tsx` shows the new tier immediately.

**The path does not break at any step.** The one soft spot is between steps 2 and 3: the "accumulated ratings" a PMCM Admin can actually see is a single blended number, not the individual review trail S08's AC implies they should be able to review before making a tier call. This is documented above as PA-173 rather than as a broken link — the link exists, it's just thinner than the AC describes.

---

## Cross-cutting: resolveActor sweep

The module implementing S07/S08 (`supplier-ops`: `suppliers.controller.ts`, `supplier-directory.controller.ts`, `supplier-profile-commands.service.ts`) is the **same module already swept in Chain A** — not a new module. Re-confirmed here specifically for the `changeSupplierTier` and `addSupplierReview` command paths: both call `resolveActor` then are gated by `requireSupplierAdmin` (which itself calls `requireActorRole`) inside `validatePermission`, confirmed to run before `write()`. This is consistent with Chain A's finding for this same module — not a new instance of the pattern, a continuation of the already-documented one. No new resolveActor correction is needed in `PRISM_Codebase_Facts.md` beyond noting this consistency (see below).

**Incidental adjacent finding, out of this chain's scope:** while tracing the S07-to-EP-14-S01 connection through `event-closure.controller.ts`, found that `PATCH /:eventId/post-event-documents/:documentId/complete` and `GET /:eventId/close-gates` call **no** `resolveActor` and have **no** role check at all — unlike `archiveEvent` and the `insights` routes in the same controller, which are correctly gated. This is closure-ops/EP-14 territory, not EP-07, and is flagged here only because it was found while performing the required trace, the same way Chain A's PA-162 was found while checking an adjacent AI-governance angle for S03. Logged as PA-175 for whoever picks up an EP-14 audit; not otherwise pursued in this chain.

---

## Summary of new PA numbers

| PA | Severity | Story | One-line |
|---|---|---|---|
| PA-169 | CRITICAL | S07 | No distinct "EA" role exists in `OpsUserRole`; "Ms. Mys and EA only" AC is architecturally unachievable with the current role model, everything gates to PmcmAdmin broadly |
| PA-170 | HIGH | S07 | Review form captures only a single overall star rating; category-specific dimension ratings do not exist anywhere in the schema, DTO, or UI |
| PA-171 | MEDIUM | S07 | `reviewedBy` is hardcoded to `"Ms. Mys"` in the frontend regardless of the actual acting admin — consistent with the known hardcoded-actor pattern (PA-142), new instance |
| PA-172 | MEDIUM | S07/S08 | `changeSupplierTier`/`addSupplierReview` sideEffects run an unguarded `auditService.audit()` after an already-committed write, same category as Chain A's PA-166, extending its scope to two more methods; a retried `addSupplierReview` after a transient audit failure creates a duplicate review row (no idempotency key) |
| PA-173 | MEDIUM | S08 | No review-history list UI; PMCM Admin sees only the blended aggregate rating, never the individual per-event review breakdown the API already returns |
| PA-174 | MEDIUM-HIGH | S08 | Tracker shows 0%/To Do; tier-change command, UI, audit trail, and directory click-path already substantially exist via reused S01 infrastructure, real completion closer to 70% |
| PA-175 | MEDIUM (out-of-chain) | EP-14/closure-ops, adjacent | `completePostEventDocument` and `closeGates` in `event-closure.controller.ts` have zero actor resolution/role check, found incidentally while tracing S07→EP-14-S01; flagged for a future EP-14 audit, not pursued further here |

---

## EP-07 rollup — all 10 stories, final real percentages, three chains

| Story | Tracker claim | Real completion (this audit initiative) | Chain |
|---|---|---|---|
| S01 Supplier Directory | Done, 100%, C1 | ~95%, accurate | A |
| S02 Quote Requests | Done, 100%, C1 | ~80% (revision cap unenforced, PA-163) | A |
| S03 Supplier Quote Confirmation | Done, 100%, C1 | ~70% (IDOR holds; adjacent /ai/pare/* zero-auth, PA-162 CRITICAL) | A |
| S04 Pre-Event Readiness Confirmation | To Do, 0%, C3 | ~40% (substantially built, several pieces genuinely missing, PA-164) | A |
| S05 Supplier On-Site Status | Done, 100%, C3 | ~85% (PA-76 reachability confirmed but stays OPEN pending intended-workflow sign-off) | A |
| S06 Public Supplier Registration | To Do, 0%, C2 | 0%, confirmed genuinely absent | B |
| S07 Internal Supplier Review | Done, 100%, C1 | ~65% (EA role unachievable, dimension ratings missing, PA-71 unresolved) | C |
| S08 Supplier Tier Assessment and Manual Adjustment | To Do, 0%, C3 | ~70% (built via reused S01 infrastructure, one real gap) | C |
| S09 Supplier Applications Inbox | To Do, 0%, C3 | 0%, confirmed genuinely absent | B |
| S10 Prospective Supplier Application Status Page | To Do, 0%, C4 | 0%, confirmed genuinely absent | B |

Pattern across all three chains: of the seven "0%" tracker entries checked in this initiative (EP-05-S01, EP-05-S02, EP-07-S04, S06, S08, S09, S10), only three (S06, S09, S10) turned out to be genuinely 0%. Of the five "Done/100%" entries checked (EP-07-S01, S02, S03, S05, S07), only S01 was fully accurate.

# EP-13 Chain B Audit — Guest Experience and Digital Registration (S04–S07)

**Date:** 2026-07-04
**Scope:** EP-13-S04 (Guest Post-Event Feedback), EP-13-S05 (Digital Registration Platform/Headcount Import), EP-13-S06 (Guest Event Info via QR/LED Wall), EP-13-S07 (Guest Game Participation via QR)
**This closes EP-13 as a fully audited epic** — combined with Chain A (S01–S03, `EP-13_ChainA_Audit_2026-07-04.md`), all 7 stories have now been audited.
**Last confirmed PA before this audit:** PA-216 (`_Audit_Index.md`, EP-13 Chain A row, verified directly). New PAs in this report: **PA-217 through PA-220** (PA-220 added as a same-day addendum — AC1's "after event closes" gap was described in prose under the AC1 verdict below but was missed at PA-numbering time; added here to restore the initiative's own convention of numbering confirmed absences on operationally significant AC items, same convention as PA-194/PA-214).

---

## Executive summary

| Story | Tracker claim | Real completion | One-line reason |
|---|---|---|---|
| EP-13-S04 Guest Post-Event Feedback | To Do, 0% | **~30%** | **Not a clean-slate absence, as the known lead predicted.** `submitFeedbackByAccessCode` is real, tested, and reachable from `apps/guest`'s dashboard for rating+comment. But the moderation queue (AC3/AC5), the client-permission gate (AC4), and the media-upload half of AC2 are all either half-built with no surface or entirely unrepresented in code. |
| EP-13-S05 Digital Registration Platform/Headcount Import | To Do, 0% | **0%, confirmed genuine** | Zero code anywhere — no platform-detail model, no sub-ticket linkage, no headcount-import path. A clean negative control, same category as EP-07 Chain B and EP-12-S05/S06 — nothing exists to raise a PA against. |
| EP-13-S06 Guest Event Info via QR/LED Wall | To Do, 0% | **0%, confirmed genuine** | No code exists, but this is architecturally expected at this stage — see the PA-63/66 scope analysis below. Not a fifth Blocked story hiding under a To Do label; it's a genuinely different (and simpler) mechanism than S03/S07. |
| EP-13-S07 Guest Game Participation via QR | Blocked, 0% | **0%, confirmed genuine** | Same zero-QR-code finding as Chain A's S03. PA-63/PA-66 reconfirmed still open. EP-12-S05 (the dependency) reconfirmed still genuinely 0% — no drift since EP-12's own audit. |

**The known lead was correct and changes S04's read relative to a naive 0% tracker check:** `submitFeedbackByAccessCode` (`guest-workflow.service.ts:124-178`) is fully implemented, shares the exact audit-side-effect pattern already logged as PA-215 in Chain A, and is genuinely reachable end-to-end from the guest dashboard for the rating+comment path. The story is meaningfully further along than "To Do, 0%" suggests — but far short of "Done" on the moderation and permission-gate ACs that give the feature its actual purpose.

**Standing check result (silent-swallow catch / unguarded post-commit side effect):** **No third instance of either shape found in this chain.** Both PA-186/PA-216 (masked fallback) and PA-187/PA-215 (unguarded post-commit side effect) remain at exactly **2 confirmed instances each** after a dedicated Agent-dispatched check against S04's code and every feedback/moderation-adjacent read path in `apps/event`/`apps/guest`. **No escalation to a dedicated sweep is warranted at this time** — see Cross-Cutting Check 1 for the full trace.

---

## STORY 1: EP-13-S04 — Guest post-event feedback

**Files checked:** `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.ts:124-178` (`submitFeedbackByAccessCode`, read in full), `apps/api/libs/modules/guest-ops/src/dto/guest.dto.ts` (`GuestFeedbackDto`), `apps/api/prisma/schema.prisma:936-955` (`OpsGuestFeedback`), `apps/guest/src/app/dashboard/page.tsx:128-154` (`submitFeedback()`), `apps/api/libs/modules/file-ops/src/services/document-vault.service.ts` (`validateUploadMetadata`, full method + test file), `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.ts:778-833` (`pmcmEventWorkspace`), plus repo-wide searches for any moderation-action endpoint and any `apps/event` reference to `guestFeedback`/`moderationStatus`.

| AC | Verdict | Evidence |
|---|---|---|
| 1. Feedback form accessible after event closes, no account required | **PARTIAL** | The form itself requires no account (`apps/guest`'s localStorage-backed pass, same as S02) — confirmed. But **"after event closes" is not enforced anywhere**: `submitFeedbackByAccessCode`'s `validateState` (`guest-workflow.service.ts:132-145`) checks `guestName`, `privacyConsentAccepted`, and `rating` bounds only — no check against `event.eventDate` or any event-status field. A guest can submit feedback before the event has even happened. |
| 2. Star rating (1-5), text review, optional media upload (video max 60s, New-EX2) | **PARTIAL — rating/text real, media upload unreachable, duration cap absent** | Rating (`@IsInt() @Min(1)` plus an explicit 1-5 range check in the service) and comment are real, tested, and wired end-to-end. Media upload has real *backend* support — `GuestFeedbackDto.photo`/`video` (`guest.dto.ts:58-64`) and `validateUploadMetadata` (size + MIME/extension match) — but **`apps/guest/src/app/dashboard/page.tsx`'s `submitFeedback()` never sends `photo` or `video` at all** (confirmed: repo-wide search for `photo`/`video`/`Photo`/`Video` in `apps/guest/src/app` returns zero matches outside decorative icons). The optional-media path is entirely unreachable from the only guest-facing app that exists. Separately, `validateUploadMetadata` (`document-vault.service.ts:38-53`) checks file extension/MIME match and byte size only — **no video-duration check exists anywhere, client or server** — the 60-second cap from New-EX2 is unenforced even if the media-upload UI existed. |
| 3. All submissions route to a moderated review queue, never auto-published | **PARTIAL — the data field is real, the queue has no surface** | `OpsGuestFeedback.moderationStatus` defaults to `'pending_review'` at the Prisma schema level (`schema.prisma:947`) and is set explicitly at creation (`guest-workflow.service.ts:161`) — this half is genuinely real. But nothing ever *changes* `moderationStatus` (see AC5) and nothing ever *displays* it to PMCM (see AC5) — "never auto-published" holds today only because there is no publish path of any kind, not because a moderation gate is actively enforcing it. |
| 4. Client permission explicitly required before PMCM shares feedback publicly | **FAIL, confirmed absent** | `OpsGuestFeedback`'s full schema (`schema.prisma:936-955`) has no client-approval/permission field of any kind, and no service-layer check references one. This AC exists purely as a policy statement with zero code representation. |
| 5. PMCM Admin can view all feedback in a moderated queue and approve/reject/hold | **FAIL, confirmed absent on both halves** | **View half:** `event-read-models.service.ts`'s `pmcmEventWorkspace` (`:801-831`) does include `guestFeedback: guestFeedback.map(...)` in its return payload — the data is technically retrievable — but a repo-wide search for `guestFeedback` or `moderationStatus` anywhere in `apps/event` returns **zero matches**. No component renders this data; it is dead weight in an API response with no consumer. **Action half:** a repo-wide search for any approve/reject/hold/update-feedback endpoint anywhere in `apps/api` returns zero matches — there is no way, anywhere in the codebase, for any actor to ever change a feedback record's `moderationStatus` away from `'pending_review'`. |
| 6. Feedback records not accessible to supplier, coordinator, or other guest actors | **PASS** | `getCoordinatorRoleView`/`getEventLiveOps` (`event-live-ops-read.service.ts`) never include `guestFeedback` in their return shape (confirmed by direct read — only `guestAttendanceCount`/`guestCheckIns` are present). Supplier-facing endpoints (`supplierWorkspace`/`supplierReadinessBoard`) don't reference guest data at all. The guest-facing route (`guest.controller.ts`) never returns other guests' feedback. |

**"Backend real, no UI wired to it" check, as specifically requested:** confirmed present on both halves of this story — the media-upload backend capability (AC2) and the entire moderation-queue view (AC5) are both real, dead code from a user's perspective, matching the pattern already seen elsewhere this initiative (e.g. EP-09-S01's read-only dashboard, EP-11's tier-panel reuse).

**New finding: PA-217 (HIGH).** No PMCM-facing moderation queue UI exists anywhere in `apps/event`, and no approve/reject/hold (or any) moderation-status-update endpoint exists anywhere in `apps/api` — despite guest feedback (including its `moderationStatus`) already being returned in `pmcmEventWorkspace`'s payload. Feedback submitted today enters a queue that can be seen by nobody and acted on by nothing; it is permanently `pending_review`.

**New finding: PA-218 (MEDIUM).** Guest feedback's optional media upload has real, tested backend validation (size + MIME/extension) but is entirely unreachable — `apps/guest`'s feedback form never offers or sends a photo/video field. Independently, the New-EX2 60-second video-duration cap is not enforced anywhere in the codebase — `validateUploadMetadata` checks size and MIME type only, with no duration check at either layer, so even if the frontend were wired up today, an arbitrarily long video would be accepted.

**New finding: PA-219 (MEDIUM).** "Client permission explicitly required before PMCM shares any feedback publicly" has zero code representation anywhere — no field on `OpsGuestFeedback`, no service-layer check, nothing. This is currently a policy statement with no enforcement mechanism, compounding PA-217 (there is also no "share publicly" action to gate in the first place, so the two gaps currently mask each other).

---

## STORY 2: EP-13-S05 — Digital registration platform details and headcount import

**Owner note, as instructed:** this is one of Francis's own stories.

**Searches performed:** repo-wide (not module-scoped) grep for `XPERTO`, `platformName`, `headcountImport`, `reconciledAttendance`, `digitalRegistration`/`DigitalRegistration` (zero matches anywhere in code — the term "XPERTO" appears nowhere at all); repo-wide grep for `ticket sale`, `ticketSale`, `checkout`, `payment gateway`, `stripe`, `paypal` (zero matches in `apps/api`, confirming the invariant separately from EP-08's finance-ops audit); `apps/api/prisma/schema.prisma` full-text review for any platform/sub-ticket/headcount-import model.

| AC | Verdict | Evidence |
|---|---|---|
| 1. Platform details per event (name, contact, setup confirmation) | **FAIL, confirmed absent** | No model, DTO, service, or controller references any platform concept anywhere. |
| 2. Sub-ticket linkage to supplier category record | **FAIL, confirmed absent — and the underlying "sub-ticket" concept doesn't exist as a data model at all** | Per the existing Codebase Facts note (SB-14), "sub-ticket" exists only as a Phase 2 planning-doc concept — no Prisma model, table, or in-code representation of a sub-ticket exists anywhere in `apps/api`, for this story or any other. There is nothing for S05 to link to even if the platform-details half were built. |
| 3. Import final headcount from external platform, stored as reconciled attendance | **FAIL, confirmed absent** | No import mechanism, no "reconciled" field on `OpsEvent` or `OpsGuestCheckIn`, no distinct headcount-import concept anywhere. |
| 4. PRISM does not handle ticket sales or payment processing in this flow | **PASS — invariant confirmed to hold, not just "feature absent"** | A repo-wide (not `finance-ops`-scoped) search for ticket-sale/checkout/payment-gateway terms returns zero matches. The invariant holds trivially today because the entire feature surface it would apply to doesn't exist yet — but it is explicitly confirmed clean, not merely assumed clean by the feature's absence. |
| 5. Scoped to 200-250+ pax events using XPERTO or client-chosen platform | **N/A** | No scoping logic exists because no feature exists. |
| 6. Visibility: PMCM view/edit, client view-only reconciled headcount, supplier/guest denied | **N/A** | Nothing to test access against. |

**Real completion: 0%, confirmed genuine.** Consistent with this initiative's established convention for a clean negative control (EP-07 Chain B; EP-12-S05/S06) — **no new PA raised**, since there is nothing built to log a defect against, and the one hard invariant (AC4) is independently confirmed to hold rather than merely trivially true.

---

## STORY 3: EP-13-S06 — Guest event info page via QR on LED wall

**Searches performed:** same QR-library/camera-API sweep as Chain A's S03 (zero matches for `getUserMedia`, `jsQR`, `html5-qrcode`, `zxing`, `QrScanner`, `BarcodeDetector`, and zero QR-scanning package-lock entries); repo-wide search for any QR-code *generation* utility (`qrcode`, `QRCode`, `generateQr`, `qr-code`) in `apps/api` — zero matches; direct read of `handoffs_archive/AC_Tracker_Cadence_Review_Guide.md` for how the tracker itself scopes PA-63/PA-66.

| AC | Verdict | Evidence |
|---|---|---|
| 1. QR code generated per event, links to guest-accessible page, displayable on LED wall | **FAIL, confirmed absent** | No QR-generation code exists anywhere (see shared-utility check below). |
| 2. Guest scans with own camera, no app/account | **N/A** | Nothing to scan yet. |
| 3. HTTPS-only | **N/A** | No page exists yet. |
| 4. Event info displayed without authentication | **N/A** | No page exists yet. |
| 5. No internal PMCM/coordinator/supplier/billing data exposed | **N/A** | No page exists yet. |

**PA-63/PA-66 scope question, resolved by reading the tracker's own words rather than assuming either answer, as instructed:** every mention of PA-63/PA-66 in `AC_Tracker_Cadence_Review_Guide.md` (lines 122, 146, 153, 173, 241, 254-255) names **only EP-13-S03 and EP-13-S07** as blocked by them. Line 138 goes further and explicitly lists S06 in the *unblocked* C3 work plan: *"EP-13-S01, EP-13-S02, EP-13-S04, EP-13-S05, EP-13-S06 (Guest stories excluding Blocked QR stories)"* — the tracker itself groups S06 with the non-blocked stories, not the QR-gated pair. This is architecturally justified, not an oversight: PA-63/PA-66's stated question is *"whether guest self-scan via own phone falls under the same QR/camera gate as coordinator check-in"* (Chain A's framing) — a question about **in-app camera-access code** needed to actively scan and process a code (S03's check-in scan, S07's game-participation scan). S06's mechanism is the opposite direction: a **static QR image encoding a URL**, opened by the guest's own phone's native camera/OS-level QR reader, which simply hands off to the browser — no in-app scanning or camera-permission code is ever needed on PRISM's side for S06. The tracker's exclusion of S06 from the PA-63/66 gate is correct given what those PAs actually gate.

**Shared-utility check (also relevant to S07 and EP-12-S05):** no QR-code *generation* utility exists anywhere in the repo today. If S06 were built, it would need its own (trivial) QR-image-generation dependency; this could reasonably be shared with S07 and EP-12-S05's game-QR needs if all three were planned together, but nothing has been built yet for any of them, so no duplication has actually occurred — this is a forward-looking build recommendation, not a defect to log a PA against.

**Real completion: 0%, confirmed genuine — no new PA.** Same negative-control category as S05.

---

## STORY 4: EP-13-S07 — Guest game participation via QR

**Searches performed:** identical QR/camera-API sweep as S06 and Chain A's S03 (zero matches, confirmed again for this chain); `apps/api/prisma/schema.prisma` full-text review for `GameSession`/`OpsGame`/any game-response model (zero matches); direct read of `AC_Tracker_Cadence_Review_Guide.md` for current PA-63/PA-66 status; re-confirmation of EP-12-S05's status against its own audit file.

| AC | Verdict | Evidence |
|---|---|---|
| 1. Guest accesses game page via EP-12-S05's QR code, no app/account | **FAIL, confirmed absent** | No game-participation page, no QR code to generate it from (EP-12-S05 doesn't exist — see below). |
| 2. HTTPS-served | **N/A** | No page exists. |
| 3. Participate in active game template (Live Poll, Word Cloud, Ice Breaker Quiz, Raffle Draw, Open Q&A) | **N/A** | No game templates of any kind exist in the schema or code. |
| 4. Responses recorded per session, stored for PMCM review | **N/A** | No response model exists. |
| 5. No internal event/other-guest/PMCM data exposed | **N/A** | Nothing exists to expose data through. |

**PA-63/PA-66 status, reconfirmed directly rather than assumed unchanged since Chain A:** identical result — still listed as open/unresolved in `AC_Tracker_Cadence_Review_Guide.md` (same lines as cited for S06 above), with the same "still unresolved at July 10" escalation note. No drift since Chain A's check earlier in this same session.

**EP-12-S05 dependency status, reconfirmed rather than assumed:** a repo-wide schema/code search for any game-session, poll, word-cloud, quiz, or raffle model returns zero matches — consistent with EP-12's own audit finding ("EP-12-S05 Engagement Games... confirmed genuinely 0%"). **No drift found; the dependency's status is unchanged.**

**Real completion: 0%, confirmed genuine — no new PA.** Tracker's "Blocked, 0%" is accurate on both the QR-gate axis (PA-63/66 still open) and the dependency axis (EP-12-S05 still 0%) — a clean, doubly-confirmed Blocked story, consistent with Chain A's S03.

---

## Cross-cutting checks

**1. Standing check — silent-swallow catch and unguarded post-commit side effect, dispatched via Agent, no third instance found.** The dispatched `ecc:silent-failure-hunter` agent, followed up with direct verification, checked: (a) `apps/guest/src/app/dashboard/page.tsx`'s `submitFeedback()` — confirmed it correctly calls `setError(...)` on failure, not a silent swallow; (b) `apps/guest`'s shared `apiFetch` helper — its `.catch(() => ({}))` (dashboard/page.tsx:57 equivalent) is a safe-JSON-parse guard for the response body, not a failure-masking fallback, since a non-`ok` response still throws immediately afterward; (c) `pmcmEventWorkspace`'s inclusion of `guestFeedback` — confirmed zero frontend consumer exists in `apps/event` at all, so there is no fetch/catch to inspect (this is PA-217's absence-of-UI finding, not a silent-failure finding — a different failure category entirely); (d) no other feedback/moderation/event-day promise chain anywhere in `apps/guest` or `apps/event` ends in an empty catch or an indistinguishable-from-zero fallback. **Conclusion: both PA-186/PA-216 and PA-187/PA-215 remain at exactly 2 confirmed instances each. No escalation to a dedicated sweep is warranted at this time** — but per the standing check's own framing, a third instance of either shape found in a future audit chain should trigger that escalation.

**2. resolveActor cross-reference.** S04's would-be moderation queue has no endpoint to trace — nothing exists to check for a fail-open gap (see PA-217). S05 has no code. The one resolveActor-relevant surface actually touched by this chain is `pmcmEventWorkspace`, already fully covered under **PA-204** (event-read-models' PMCM-gated methods, confirmed exploitable via the fail-open default) from the 2026-07-04 sweep — its inclusion of `guestFeedback` extends that existing exposure's blast radius to feedback content and moderation status, not a new gap.

**3. Hardcoded-actor-identity check.** No instance found or applicable — S04 has no moderation-action endpoint to misattribute an actor on, and S05 has no code at all. Consistent with Chain A's S01 finding: the absence of a write surface removes the opportunity for this particular defect.

**4. Shared-utility check (QR generation).** Confirmed: no QR-generation utility exists anywhere in `apps/api` or `apps/guest` today. S06, S07, and EP-12-S05 would each need to build this from scratch if implemented today — flagged as a forward-looking build recommendation (build one shared utility rather than three), not a defect, since none of the three has actually duplicated the work yet.

**5. Ticket/payment invariant.** Confirmed to hold via a repo-wide (not finance-ops-scoped) search, independent of S05's feature-absence — see S05 AC4 above.

---

## New PA numbers, summary table

| PA | Severity | Story | One-line |
|---|---|---|---|
| PA-217 | HIGH | EP-13-S04 | No PMCM-facing moderation queue UI or moderation-action endpoint exists anywhere — submitted feedback is permanently `pending_review`, visible to nobody, actionable by nothing |
| PA-218 | MEDIUM | EP-13-S04 | Guest feedback's optional media upload is unreachable from the only guest-facing app (backend validates it, frontend never sends it); separately, the New-EX2 60-second video-duration cap is unenforced at any layer |
| PA-219 | MEDIUM | EP-13-S04 | "Client permission before public feedback sharing" has zero code representation anywhere — a policy statement with no enforcement mechanism |
| PA-220 | LOW-MEDIUM | EP-13-S04 | No check against `event.eventDate` or event status exists anywhere in `submitFeedbackByAccessCode`; feedback is submittable before the event has occurred, contradicting AC1's explicit "after event closes" requirement |

**Not raised as new PAs:** EP-13-S05, S06, and S07's confirmed-genuine 0% status — consistent with this initiative's established convention for clean negative controls (EP-07 Chain B; EP-12-S05/S06), there is nothing built to log a defect against. PA-204's existing exposure is confirmed to extend to guest feedback content, not treated as a new leak.

---

## Epic closure statement

**EP-13 is now fully audited.** Chain A (2026-07-04) covered S01-S03; this report covers S04-S07. All 7 stories have real-completion estimates independent of tracker claims:

| Story | Tracker | Real | 
|---|---|---|
| S01 Coordinator Masterlist | To Do, 0% | ~15% |
| S02 Guest Name/Headcount Check-In | In Progress, 50% | ~55% |
| S03 Guest QR Check-In | Blocked, 0% | 0%, confirmed genuine |
| S04 Guest Post-Event Feedback | To Do, 0% | ~30% |
| S05 Digital Registration Platform | To Do, 0% | 0%, confirmed genuine |
| S06 Guest Event Info via QR | To Do, 0% | 0%, confirmed genuine |
| S07 Guest Game Participation via QR | Blocked, 0% | 0%, confirmed genuine |

Total new PAs across both chains: **PA-211 through PA-220** (10 new findings, PA-220 added as a same-day addendum). Per the session cap convention established in EP-12's audit, this closes the epic-by-epic sweep through EP-13; the next session should start fresh at EP-14.

---

## Skills applied

- `superpowers:verification-before-completion` — every AC verdict backed by a direct file:line read; the "no third instance" conclusion for the standing check was independently followed up (not accepted solely on the dispatched agent's word) by re-reading the guest dashboard's `apiFetch` helper's catch behavior.
- `ecc:silent-failure-hunter` — dispatched via Agent against all four stories, with the standing check for both named shapes explicitly included in the dispatch instructions; returned a clean "no third instance" result under 200 words as requested, without padding.
- `ecc:security-review` (weighted on S04's moderation queue and S05's platform/headcount boundary) — folded into the resolveActor cross-reference above; no new gap beyond PA-217's absence-of-surface finding, since neither boundary has anything built yet to secure incorrectly.
- `ecc:click-path-audit` — traced S04's guest-submit path (`/dashboard` feedback form → `POST /feedback` → Prisma commit → `pmcmEventWorkspace` payload) to its dead end (no `apps/event` consumer, confirmed by direct search); S07's QR-to-game-participation path has no click path to trace, since no code exists at either end.
- `ecc:test-coverage` — `apps/guest` reconfirmed to still have no test runner configured, unchanged since Chain A's check earlier this session; `apps/api`'s `guest-ops`/`file-ops` modules retain solid backend test coverage for the code that does exist (`guest-workflow.service.test.ts`, `document-vault.service.test.ts`).

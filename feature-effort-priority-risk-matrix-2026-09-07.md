---
type: "Planning Matrix"
title: "P.R.I.S.M feature effort, priority and risk matrix"
description: "Proposed remaining-work estimates and sequencing derived from the feature catalog review."
tags: [features, planning, effort, priority, risk]
status: snapshot
authority: informative
owner: "D (Anthony) — platform trust review"
audience: [product, engineering, design, reviewers]
scope: "137 catalog IDs, shared remediation work and 28 current ledger families"
updated: "2026-09-08"
last_verified: "02b6896f56b58476dba0bc736cdf9cb11222c033"
sources:
  - resource: "feature-catalog-review-2026-09-07.md"
    title: "Feature catalog implementation review"
  - resource: "docs/roadmap/architecture-priority-risk-matrix.md"
    title: "Existing priority, impact and fix-risk conventions"
  - resource: "docs/product/feature-ledger.md"
    title: "Normative feature decisions and owner goals"
  - resource: "docs/product/readiness-foundation.md"
    title: "Storage, notification, auth and live AI gates"
---

# P.R.I.S.M feature effort, priority and risk matrix

## At a glance

- **Purpose:** Reconcile the catalog work plan with the implemented P0 corrections.
- **Authority:** Informative planning snapshot; the living feature ledger owns product decisions.
- **Owner:** D coordinates; each work row names its operational owner goal.
- **Scope:** 137 catalog IDs and 52 tracked packages: **nine P0 packages completed within their bounded scope, 43 packages remaining** (24 P1, 11 P2, eight P3).
- **Use/change:** Plan remaining implementation using current catalog gaps, satisfied prerequisites and explicit external gates.
- **Verification gate:** The historical P0 review recorded V01 as open; the current P1 integration boundary scan passes. PostgreSQL/Docker-backed migration and concurrency acceptance remain unavailable and are tracked separately from package implementation.
- **Catalog status:** 13 implemented, 77 partial, 47 not implemented; 73 have an overlapping current blocker.
- **Verify with:** The [updated catalog review](feature-catalog-review-2026-09-07.md) and [P0 acceptance evidence](docs/roadmap/p0-correctness-readiness.md).

This refresh assesses implementation commit `02b6896f56b58476dba0bc736cdf9cb11222c033` in [draft PR #40](https://github.com/The-Team-CG/prism/pull/40), relative to baseline staging `3d01c6c`. It is branch implementation evidence, not a claim that staging or production has these changes. W01–W07 and W09 deliver corrections; W08 records accepted policy. Complete proposal, closeout, privacy and AI workflows remain gated by downstream packages.

## 2026-09-08 P1 implementation update

The P1 integration branch `codex/p1-implementation-2026-09-08` now includes the W15, W25, W26 and W51 deliveries in addition to the earlier P1 slices. The status below is package-level engineering evidence; **Implemented local slice** means the repository behavior is present and tested, while provider, policy, database and browser gates can still keep the catalog feature **Partial**.

| Package | Effort | Priority / risk | Current package status | Remaining gap or blocker |
| --- | --- | --- | --- | --- |
| W10 storage | XL | High / High | Implemented local slice | Production provider, identity, bucket policy and provider-backed acceptance remain open. |
| W11 delivery | XL | High / High | Partial | Provider approval, credentials, adapter, receipts and live email/Viber acceptance. |
| W12 proposal/CE | XL | High / High | Implemented local slice | W10 storage, approved proposal policy and W43 export depth. |
| W13 onboarding/documents | XL | High / High | Implemented local slice | W10 bytes, W11 invitations and W41 bid onboarding. |
| W14 billing | XL | High / High | Implemented local slice | Production document storage, billing-policy confirmation and W11 reminders. |
| W15 supplier application/status | L | Medium / High | Integrated local slice | Public application status now uses a redacted email-matched lookup; promotion foundations remain tied to W40 assessment and PMCM review. |
| W16 supplier selection/readiness | XXL | High / High | Implemented local slice | Client-owned supplier tickets, escalation semantics, W10 bytes and W11 delivery. |
| W17 communication threads | L | High / Medium | Implemented local slice | External delivery remains W11-gated. |
| W18 staffing | XL | High / High | Implemented local slice | W10/W11 provider work and W45 recommendations. |
| W19 guest masterlist | XL | High / High | Implemented local slice | Raw-file storage (W10) and QR entry (W35). |
| W20 coordinator/operator tools | XXL | High / High | Implemented local slice | W16 ingress depth, W11 delivery and W27 wrap-up depth. |
| W21 live operations | XL | High / High | Implemented local slice | W10/W11 and W45/W47 dependent capabilities. |
| W22 registration coordination | M | Medium / Medium | Implemented local slice | Disposable PostgreSQL and external-platform runtime acceptance. |
| W23 feedback/moderation | L | High / High | Implemented local slice | W10 media bytes, W35 QR and W49 intelligence. |
| W24 compliance/risk | XL | High / High | Implemented local slice | Owner confirmation of provisional rule inventory and DB acceptance. |
| W25 cancellation/postponement | XXL | High / High | Implemented local slice | W14 settlement, W16 supplier acceptance, W10/W11 providers and full rescheduling UI. |
| W26 freeze/addenda | XL | High / High | Integrated | W10/W11 provider effects, optional W43 e-signature and PostgreSQL migration/concurrency acceptance. |
| W27 wrap-up/archive/insights | XXL | High / High | Implemented local slice | W10/W11/W14/W40 depth and W49 AI scope remain partial. |
| W28 authentication/recovery | L | High / High | Implemented local slice | Provider-backed reset delivery; external IdP remains out of scope. |
| W29 privacy/retention | XXL | High / High | Blocked / not implemented | Approved rights, retention and legal-hold policy plus W10 file lifecycle. |
| W30 audit/tamper resistance | L | High / High | Implemented local slice | Full mutation coverage, immutable storage/retention integration and DB acceptance. |
| W40 supplier reviews | L | High / High | Implemented local slice | Deeper assessment policy and promotion acceptance remain partial. |
| W50 source reconciliation | S | Medium / Low | Documentation slice delivered | Original 37 behavior definitions and acceptance text are still missing. |
| W51 action center/UX | L | Medium / Medium | Integrated | Browser, mobile, keyboard traversal and screen-reader acceptance require the running stack. |

This update records implementation progress without relabeling provider- or policy-gated behavior as complete. The integration branch currently has green static/unit gates, while PostgreSQL/Docker and browser runtime evidence remain unavailable in this environment.

Completed P0 rows retain their original priority, estimate and fix risk as historical planning/review information. Their effort is **excluded from remaining-work totals**. Downstream estimates are retained without re-estimating the whole program; they already excluded prerequisite effort.

- [How to read the matrix](#how-to-read-the-matrix)
- [Priority versus effort](#priority-versus-effort)
- [Impact versus fix risk](#impact-versus-fix-risk)
- [Work matrix](#work-matrix)
- [What to start with](#what-to-start-with)
- [Every catalog ID mapped to work](#every-catalog-id-mapped-to-work)
- [Current ledger mapping](#current-ledger-mapping)
- [Validation and limits](#validation-and-limits)

## How to read the matrix

Priority follows the repository roadmap convention. It expresses sequencing and prerequisites, not a claim that an incident is occurring.

| Priority | Use |
| --- | --- |
| **P0 — safety or prerequisite** | Correct misleading financial/state evidence, enforce access, resolve authority decisions, or establish a guard before relying on the affected workflow. Live AI containment is a gate before live enablement, even while the feature stays deferred. |
| **P1 — core operations next** | Complete the inquiry → proposal/conforme → planning → event day → closeout path and the services it needs. Large P1 work still needs decomposition before scheduling. |
| **P2 — planned completion/maturity** | Improve the richer catalog workflows once the core chain is trustworthy. Some small pieces can be taken opportunistically without promoting the whole package. |
| **P3 — defer/gated expansion** | Extended games, broad integrations, live AI programs and reusable workflow-template authoring. Keep current manual/mock fallbacks until a deliberate scope decision and prerequisites exist. |

For open packages, effort means **remaining combined person-days for a developer/team familiar with this repository**, not elapsed days or one estimate per feature. It includes scoped design, contracts, API/portal wiring, migrations where needed, regression checks, review and documentation. Prerequisite packages are estimated separately and are not charged again to downstream rows. Product/provider approval waits, unavailable credentials, deployment access and team contention are excluded.

| Band | Rough remaining effort | Planning interpretation |
| --- | --- | --- |
| XS | 0.5–1 person-day | Small local change; no whole package below is currently this small. |
| S | 2–3 person-days | Bounded decision/inventory or small implementation. |
| M | 4–7 person-days | Focused feature correction or modest workflow slice. |
| L | 8–15 person-days | Several coordinated contract/service/UI/test changes. |
| XL | 16–30 person-days | Substantial feature family or provider integration; split into reviewable deliveries. |
| XXL | More than 30 person-days | Broad program; upper bound is not credible before design/decomposition. |

**Confidence is Medium or Low, not a statistical confidence interval.** Medium means the current code and missing step are relatively bounded. Low means product details, external adapters, data quality or program breadth can substantially change the estimate. For W08 and W50, the band covers decision preparation/inventory work once inputs are available; waiting for answers/source material is not estimated. No total calendar deadline or whole-catalog cost is inferred.

| Risk field | High | Medium | Low |
| --- | --- | --- | --- |
| **Impact if unresolved** | Can misstate money/approval/closure, expose or mishandle data, or prevent a core event operation. | Causes planning gaps, delays or material limitations with a bounded fallback. | Mainly an optional expansion or convenience gap. |
| **Fix risk** | Changes permissions, lifecycle/data invariants, concurrent writes, several roles or external effects. | Changes a bounded workflow or presentation/data integration with contained effects. | Mainly documentation/decisions with limited runtime change. |

These are qualitative engineering assessments. Fix risk is not a measured probability; low fix risk does not make an optional item urgent. High fix risk means tighter scope, rollback planning and stronger acceptance evidence.

Owner goals remain **A Maxine — coherent UX; B Francis — executable PMCM/coordinator operations; C Ethan — narrow, safe external portals; D Anthony — trusted contracts, permissions and platform behavior**. Each work package has one proposed DRI; support is listed separately. This planning assignment does not replace the ledger’s ownership overlay.

## Priority versus effort

The cells count **remaining work packages**, not catalog features or days. The nine completed P0 packages are excluded; their original bands remain in the completed-work register.

| Priority | S | M | L | XL | XXL | Packages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 0 | 0 | 0 | 0 | 0 | **0** |
| P1 | 1 | 1 | 7 | 10 | 5 | **24** |
| P2 | 0 | 1 | 4 | 4 | 2 | **11** |
| P3 | 0 | 0 | 0 | 3 | 5 | **8** |
| **Remaining total** | **1** | **2** | **11** | **17** | **12** | **43** |

**W01 billing correctness is complete.** W10 storage and W11 delivery are the next shared investments, both XL and subject to provider/access gates. W22 registration-platform validation is a bounded M follow-up; broader supplier, coordinator and closeout packages still need decomposition.

## Impact versus fix risk

The grid counts the same 43 remaining packages. Completed P0 fixes retain their original review risk in the register below, but are no longer counted as unresolved work.

| Impact if unresolved ↓ / Fix risk → | Low | Medium | High |
| --- | ---: | ---: | ---: |
| High | 0 | 1 | 22 |
| Medium | 1 | 4 | 11 |
| Low | 0 | 2 | 2 |

| Remaining exposure | Package(s) | Verification that matters |
| --- | --- | --- |
| Proposal decisions lack a production issuer | [W12](#w12), [W14](#w14) | Real issued proposal version, approved source and complete client review/billing journey. |
| File bytes and external delivery remain unavailable | [W10](#w10), [W11](#w11) | Stored/retrieved bytes, recipient authorization, real delivery receipts and failure handling. |
| Closeout lacks authoritative logistics and actual event end | [W27](#w27), [W23](#w23) | Persisted logistics evidence, actual end, timed feedback across archive and expiry. |
| Full privacy rights and live AI remain gated | [W29](#w29), [W44](#w44), [W45](#w45) | Supported native-account/file/retention scope and approved provider governance before external AI calls. |

## Work matrix

**Completion prerequisites** are package dependencies and any external decision/input. They are conditions for accepting the stated scope; they do not prohibit independent design or preparation while a dependency is being resolved. A package marked P1/P2 can still have a P0 prerequisite. P1–P3 scope and exit criteria describe remaining work. Links marked complete are satisfied prerequisites at the assessed implementation commit, not active blockers.

Evidence codes link back to the implementation review: **K** = correctness finding, **B** = blocker, **E** = inspected evidence group. Estimates are attached to the W rows only; repeated references in the catalog/ledger lookup add no effort.

### Completed P0 register

| Work / proposed DRI | Effort and confidence | Impact / fix risk | Completion prerequisites | Delivered scope and residual dependency |
| --- | --- | --- | --- | --- |
| <a id="w01"></a>**W01 — Correct billing source and payment totals**<br>DRI B; support C, D | **Original estimate: M: 4–7 days**<br>Medium confidence | **High / Medium** | Satisfied for bounded P0 scope | **Complete.** Implemented: removed fabricated billing and reconciled payment totals. Full CE/proposal sources and documents remain W12/W14. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w02"></a>**W02 — Guard and persist proposal decisions**<br>DRI D; support B, C | **Original estimate: L: 8–15 days**<br>Medium confidence | **High / High** | Satisfied for bounded P0 scope | **Complete.** Implemented: verified client/lifecycle/issued-version guards, retained reasons and atomic bound retries. Production proposal issuance remains blocked on W12. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w03"></a>**W03 — Correct staffing conflicts and coverage**<br>DRI B; support D | **Original estimate: L: 8–15 days**<br>Medium confidence | **High / High** | Satisfied for bounded P0 scope | **Complete.** Implemented: inactive assignments excluded; booking and replacement share a coordinator/day lock, verified with real PostgreSQL races. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w04"></a>**W04 — Guard supplier transitions and review retries**<br>DRI C; support B, D | **Original estimate: L: 8–15 days**<br>Medium confidence | **High / High** | Satisfied for bounded P0 scope | **Complete.** Implemented: guarded application/assignment states and transactional payload-bound review retries. Confirmed cancellation preserved. Conversion/readiness/assessment remain W15/W16/W40. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w05"></a>**W05 — Prevent false closeout success**<br>DRI B; support D | **Original estimate: L: 8–15 days**<br>Medium confidence | **High / High** | Satisfied for bounded P0 scope | **Complete.** Implemented: explicit five gates and atomic archive/audit/notification intent. Logistics stays missing pending W27; reasoned PMCM override is explicit. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w06"></a>**W06 — Stop false privacy completion and incomplete redaction**<br>DRI D; support B | **Original estimate: L: 8–15 days**<br>Medium confidence | **High / High** | Satisfied for bounded P0 scope | **Complete.** Implemented within supported operational scope: atomic identity redaction; unsupported rights/native-account erasure stays approved. Full fulfillment remains W29/W10. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w07"></a>**W07 — Verify sensitive routes and session policy**<br>DRI D; support B, C | **Original estimate: L: 8–15 days**<br>Medium confidence | **High / High** | Satisfied for bounded P0 scope | **Complete.** Implemented: signed sessions, stable actor/event ownership and existing expiry; built API sweep passed 361 checks across 113 guarded routes. Recovery/per-role TTL remains W28. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w08"></a>**W08 — Resolve authority and lifecycle decisions**<br>DRI B; support A, C, D | **Original estimate: S: 2–3 days**<br>Low confidence | **High / Low** | Satisfied for bounded P0 scope | **Complete.** Decided and documented: PMCM official layouts; designated attendance operator; actual-end/wrap-up rules; seven-day feedback including archive; catalog categories with Private mapped to Individual. Downstream engineering remains W18/W20/W23/W27/W31/W34. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |
| <a id="w09"></a>**W09 — Enforce the live AI off-switch/preflight**<br>DRI D; support B | **Original estimate: M: 4–7 days**<br>Medium confidence | **High / Medium** | Satisfied for bounded P0 scope | **Complete.** Implemented: live/unknown AI modes denied before external calls; matching durable decisions required. Approved provider/governance and live PARE remain W44/W45. [Acceptance](docs/roadmap/p0-correctness-readiness.md) |

### P1 work

| Work / proposed DRI | Effort and confidence | Impact / fix risk | Completion prerequisites | Remaining scope and exit criterion |
| --- | --- | --- | --- | --- |
| <a id="w10"></a>**W10 — Implement real object storage and upload validation**<br>DRI D; support B, C | **XL: 16–30 days**<br>Low confidence | **High / High** | [W07 — complete](#w07); **Gate:** Approved storage choice/access | Provide one scoped storage adapter, byte validation, signed upload/download and deletion path. Portal-specific document journeys are W13; provider lead time is excluded. [B01](feature-catalog-review-2026-09-07.md#b01), [E03](feature-catalog-review-2026-09-07.md#e03) |
| <a id="w11"></a>**W11 — Deliver email/Viber and schedule notifications**<br>DRI D; support B, C | **XL: 16–30 days**<br>Low confidence | **High / High** | [W07 — complete](#w07); **Gate:** Provider approval, credentials and delivery access | Implement queue delivery, retries/receipts, recipient scoping, core invitation/assignment/milestone triggers and preferences. Thread persistence is W17. [B02](feature-catalog-review-2026-09-07.md#b02), [E22](feature-catalog-review-2026-09-07.md#e22) |
| <a id="w12"></a>**W12 — Complete the CE and proposal lifecycle**<br>DRI B; support C, D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W01 — complete](#w01), [W02 — complete](#w02), [W10](#w10); **Gate:** Approved proposal/version and briefing rules | Build category CE, budget alignment and reuse, complete briefing, and produce issued reviewable proposal versions with configurable revision policy. OAuth exports are W43. [E08](feature-catalog-review-2026-09-07.md#e08), [E10](feature-catalog-review-2026-09-07.md#e10), [E11](feature-catalog-review-2026-09-07.md#e11) |
| <a id="w13"></a>**W13 — Complete onboarding and role document journeys**<br>DRI D; support B, C | **XL: 16–30 days**<br>Low confidence | **High / High** | [W01 — complete](#w01), [W07 — complete](#w07), [W10](#w10), [W11](#w11) | Wire accepted inquiry/signed file to portal access; complete invitation/history, file requirements, uploads/downloads and role visibility. Bid onboarding also needs W41. [E01](feature-catalog-review-2026-09-07.md#e01), [E02](feature-catalog-review-2026-09-07.md#e02), [E03](feature-catalog-review-2026-09-07.md#e03), [E04](feature-catalog-review-2026-09-07.md#e04) |
| <a id="w14"></a>**W14 — Complete billing and payment operations**<br>DRI B; support C, D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W01 — complete](#w01), [W10](#w10), [W11](#w11), [W12](#w12) | Finish source-linked PDFs, payment-term policy/reminders, formal corrections/disputes, urgent-issue additional bills and reasoned waivers. Do not re-estimate W01's fixes here. [E10](feature-catalog-review-2026-09-07.md#e10) |
| <a id="w15"></a>**W15 — Complete supplier application conversion and status**<br>DRI C; support B, D | **L: 8–15 days**<br>Medium confidence | **Medium / High** | [W04 — complete](#w04), [W10](#w10), [W11](#w11), [W40](#w40) | Create one supplier on approval, retain pending-first-event status, publish safe applicant status and supplier-profile parity; promotion consumes completed assessment. [E09](feature-catalog-review-2026-09-07.md#e09) |
| <a id="w16"></a>**W16 — Complete supplier selection, readiness and ingress**<br>DRI C; support B, D | **XXL: >30 days; decompose**<br>Low confidence | **High / High** | [W04 — complete](#w04), [W10](#w10), [W11](#w11), [W17](#w17), [W24](#w24) | Finish capacity/date selection policy, quote/round context, enforced gaps, assignment/readiness notifications, client-owned suppliers, ingress scheduling and verified status/photo flow. [E08](feature-catalog-review-2026-09-07.md#e08), [E09](feature-catalog-review-2026-09-07.md#e09), [E13](feature-catalog-review-2026-09-07.md#e13) |
| <a id="w17"></a>**W17 — Persist role-scoped communication threads**<br>DRI C; support B, D | **L: 8–15 days**<br>Medium confidence | **High / Medium** | [W07 — complete](#w07), [W11](#w11) | Replace browser-only/empty threads with persisted PMCM/client/supplier messages and authorized recipients; use W11 for external delivery. [E22](feature-catalog-review-2026-09-07.md#e22) |
| <a id="w18"></a>**W18 — Complete staffing availability and acknowledgment**<br>DRI B; support D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W03 — complete](#w03), [W11](#w11) | Finish date/role/skills capacity, required coverage, withdrawal/replacement notes and acknowledgment reminders. AI emergency recommendations stay dependent on W45. [E12](feature-catalog-review-2026-09-07.md#e12), [E13](feature-catalog-review-2026-09-07.md#e13) |
| <a id="w19"></a>**W19 — Build the guest masterlist and walk-in policy**<br>DRI C; support B, D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W07 — complete](#w07), [W10](#w10) | Add authoritative import/reconciliation, client policy/eligibility and registration-staff search/check-in/verification. QR remains separately costed in W35. [E14](feature-catalog-review-2026-09-07.md#e14) |
| <a id="w20"></a>**W20 — Complete specialist coordinator and operator tools**<br>DRI B; support A, C, D | **XXL: >30 days; decompose**<br>Low confidence | **High / High** | [W08 — complete](#w08), [W11](#w11), [W16](#w16), [W17](#w17), [W18](#w18), [W19](#w19), [W21](#w21) | Provide role-specific briefing/tasks, assigned-event history, designation/attendance permissions, ingress checks and reassignment approvals; wrap-up also consumes W27. [E12](feature-catalog-review-2026-09-07.md#e12), [E13](feature-catalog-review-2026-09-07.md#e13) |
| <a id="w21"></a>**W21 — Complete live command, EOD and event run sheets**<br>DRI B; support A, D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W07 — complete](#w07), [W11](#w11), [W17](#w17) | Replace fixed/sample timing with persisted multi-day schedules, handoff/run sheets, EOD reports/replies, refreshed operational status and timers. [E04](feature-catalog-review-2026-09-07.md#e04), [E13](feature-catalog-review-2026-09-07.md#e13) |
| <a id="w22"></a>**W22 — Validate external registration-platform coordination**<br>DRI B; support D | **M: 4–7 days**<br>Medium confidence | **Medium / Medium** | [W07 — complete](#w07) | Enforce assigned supplier, valid setup/live/closed transitions and event-end headcount import. Keep ticket payments outside Prism. [K09](feature-catalog-review-2026-09-07.md#k09), [E15](feature-catalog-review-2026-09-07.md#e15) |
| <a id="w23"></a>**W23 — Complete feedback windows and moderation**<br>DRI C; support B, D | **L: 8–15 days**<br>Medium confidence | **High / High** | [W07 — complete](#w07), [W08 — complete](#w08), [W10](#w10) | Allow feedback within the agreed post-event window; persist media and moderation/consent decisions. QR entry uses W35, not a duplicated scanner. [K07](feature-catalog-review-2026-09-07.md#k07), [E14](feature-catalog-review-2026-09-07.md#e14) |
| <a id="w24"></a>**W24 — Complete deterministic compliance and risk assessment**<br>DRI B; support D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W08 — complete](#w08); **Gate:** Accepted rule definitions and risk criteria | Evaluate actual conditions, schedule reruns and persist phase risks/mitigations and overrides. AI advisory is W46; exact rule inventory needs owner confirmation. [E05](feature-catalog-review-2026-09-07.md#e05) |
| <a id="w25"></a>**W25 — Implement cancellation and postponement**<br>DRI B; support C, D | **XXL: >30 days; decompose**<br>Low confidence | **High / High** | [W08 — complete](#w08), [W10](#w10), [W11](#w11), [W14](#w14), [W16](#w16), [W18](#w18) | Handle confirmed cancel/postpone/date-TBC decisions, deposits/fees, assignment and supplier impacts, rescheduling and retained history. [E02](feature-catalog-review-2026-09-07.md#e02), [E10](feature-catalog-review-2026-09-07.md#e10), [E12](feature-catalog-review-2026-09-07.md#e12), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w26"></a>**W26 — Implement freeze, addenda and scope-change impacts**<br>DRI B; support C, D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W08 — complete](#w08), [W10](#w10), [W12](#w12), [W14](#w14), [W24](#w24) | Enforce freeze exceptions and signed addendum versions; compare contract/quote changes and update approved financial/supplier obligations. Scan fallback precedes optional e-sign W43. [E02](feature-catalog-review-2026-09-07.md#e02), [E09](feature-catalog-review-2026-09-07.md#e09), [E10](feature-catalog-review-2026-09-07.md#e10) |
| <a id="w27"></a>**W27 — Complete wrap-up, deliverables, archive and insights**<br>DRI B; support A, C, D | **XXL: >30 days; decompose**<br>Low confidence | **High / High** | [W05 — complete](#w05), [W08 — complete](#w08), [W10](#w10), [W11](#w11), [W14](#w14), [W23](#w23), [W40](#w40) | Build timed full/quick wrap-up, required-item/client acknowledgment, logistics/issues/feedback close evidence, complete archive retrieval and eight-dimension deterministic insights. [E03](feature-catalog-review-2026-09-07.md#e03), [E16](feature-catalog-review-2026-09-07.md#e16) |
| <a id="w28"></a>**W28 — Complete native authentication and recovery**<br>DRI D; support C | **L: 8–15 days**<br>Medium confidence | **High / High** | [W07 — complete](#w07), [W11](#w11) | Deliver secure single-use/expiring password reset and role session policy with existing native TOTP. No external IdP migration is included. [E18](feature-catalog-review-2026-09-07.md#e18), [B04](feature-catalog-review-2026-09-07.md#b04) |
| <a id="w29"></a>**W29 — Complete privacy rights and retention operations**<br>DRI D; support B, C | **XXL: >30 days; decompose**<br>Low confidence | **High / High** | [W06 — complete](#w06), [W07 — complete](#w07), [W10](#w10); **Gate:** Approved retention/hold and rights policy | Implement actual subject export/correction/deletion, all consent/notice paths, retention/holds and operator evidence. Estimate excludes external policy approval time. [E19](feature-catalog-review-2026-09-07.md#e19) |
| <a id="w30"></a>**W30 — Complete audit coverage and tamper resistance**<br>DRI D; support B, C | **L: 8–15 days**<br>Medium confidence | **High / High** | [W02 — complete](#w02), [W04 — complete](#w04), [W06 — complete](#w06), [W07 — complete](#w07) | Cover remaining workflow decisions and audit gaps; enforce integrity/append-only write boundaries and verify denial of unauthorized mutation. Earlier fixes own their local audit changes. [E19](feature-catalog-review-2026-09-07.md#e19) |
| <a id="w40"></a>**W40 — Complete supplier reviews and reliability notes**<br>DRI B; support C, D | **L: 8–15 days**<br>Medium confidence | **High / High** | [W04 — complete](#w04), [W08 — complete](#w08) | Complete event-scoped private assessment prompts/dimensions, historical notes and eligible review timing; provide the assessment outcome needed by W15 promotion. [E09](feature-catalog-review-2026-09-07.md#e09), [E16](feature-catalog-review-2026-09-07.md#e16) |
| <a id="w50"></a>**W50 — Reconcile the unlisted behaviors and source IDs**<br>DRI B; support D | **S: 2–3 days**<br>Low confidence | **Medium / Low** | No package dependency; **Gate:** Original behavior acceptance text | **Partial — the ID reconciliation is done; the behavior definitions are blocked.** Delivered: the numbering delta is now auditable. The preserved tables hold `FR-1`–`FR-97` with seven unused numbers (`FR-57`, `FR-71`–`FR-74`, `FR-85`, `FR-86`) = 90 numbered IDs, plus 10 `FR-AI-*`, against the manuscript's claimed 127; the 37 `New-*` IDs are reviewer-assigned identifiers for un-numbered described features and are **not** the system behaviors. Blocked: no behavior table, ID scheme or acceptance text exists in the repository or its Git history — `docs/reference/prism-v4/complete-feature-catalog.md` line 54 records only the arithmetic. Unblocked only by supplying the original V4 manuscript behavior section; no engineering work substitutes for it. [Source reconciliation](feature-catalog-review-2026-09-07.md#source-reconciliation), [E23](feature-catalog-review-2026-09-07.md#e23), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w51"></a>**W51 — Finish action-center and shared UX acceptance**<br>DRI A; support B, C, D | **L: 8–15 days**<br>Medium confidence | **Medium / Medium** | [W01 — complete](#w01), [W02 — complete](#w02), [W13](#w13), [W14](#w14), [W21](#w21) | Complete actor-specific next actions, deterministic health/handoff presentation and role-shell/mobile/keyboard acceptance on real data. Existing implemented features receive regression checks, not rebuild estimates. [E04](feature-catalog-review-2026-09-07.md#e04), [E13](feature-catalog-review-2026-09-07.md#e13), [E23](feature-catalog-review-2026-09-07.md#e23) |

### P2 work

| Work / proposed DRI | Effort and confidence | Impact / fix risk | Completion prerequisites | Remaining scope and exit criterion |
| --- | --- | --- | --- | --- |
| <a id="w31"></a>**W31 — Finish inquiry convenience and context capture**<br>DRI B; support C, D | **L: 8–15 days**<br>Medium confidence | **Medium / Medium** | [W08 — complete](#w08), [W10](#w10), [W11](#w11), [W13](#w13) | Add Pending Full Details, structured pre-conforme notes/attachments, public spatial fields, resumable draft/edit policy and agreed client-type vocabulary. [E01](feature-catalog-review-2026-09-07.md#e01), [E02](feature-catalog-review-2026-09-07.md#e02), [E03](feature-catalog-review-2026-09-07.md#e03) |
| <a id="w32"></a>**W32 — Implement organization merge and reactivation**<br>DRI B; support C, D | **XL: 16–30 days**<br>Low confidence | **Medium / High** | [W07 — complete](#w07), [W11](#w11), [W13](#w13), [W30](#w30) | Add canonical organization/account relationships, safe merge audit, parallel inquiry alerts and dormant-client history. Existing events must retain ownership. [E01](feature-catalog-review-2026-09-07.md#e01), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w33"></a>**W33 — Complete venue, styling budget and moodboard journeys**<br>DRI B; support A, C, D | **XXL: >30 days; decompose**<br>Low confidence | **Medium / High** | [W08 — complete](#w08), [W10](#w10), [W12](#w12) | Add venue candidates/ocular gate, formal styling-budget confirmation and moodboard revisions/client approval with budget-expectation checks. AI themes remain W46. [E02](feature-catalog-review-2026-09-07.md#e02), [E06](feature-catalog-review-2026-09-07.md#e06), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w34"></a>**W34 — Complete floorplan approval, venues, presets and seating**<br>DRI B; support A, C, D | **XL: 16–30 days**<br>Low confidence | **Medium / High** | [W08 — complete](#w08), [W19](#w19), [W33](#w33) | Preserve official editor; add separate client decisions/annotations, faithful venue reuse, presets, eligible masterlist/table assignment and printable seating. [E06](feature-catalog-review-2026-09-07.md#e06), [E07](feature-catalog-review-2026-09-07.md#e07) |
| <a id="w35"></a>**W35 — Add scoped QR flows and an isolated guest demo**<br>DRI C; support A, D | **L: 8–15 days**<br>Low confidence | **Medium / High** | [W07 — complete](#w07), [W19](#w19), [W23](#w23); **Gate:** HTTPS and camera/device acceptance | Add shared QR token/generation/scanning/fallback for guest paths; isolate promotional sample from live data. Masterlist and moderation remain owned by W19/W23. [E14](feature-catalog-review-2026-09-07.md#e14), [E21](feature-catalog-review-2026-09-07.md#e21), [B06](feature-catalog-review-2026-09-07.md#b06) |
| <a id="w36"></a>**W36 — Add module controls and notification preferences**<br>DRI D; support A, B, C | **L: 8–15 days**<br>Medium confidence | **Medium / High** | [W07 — complete](#w07), [W11](#w11), [W21](#w21) | Persist/authorize per-event module controls and limited client view; add bilingual templates and client language selection without exposing hidden capabilities. [E04](feature-catalog-review-2026-09-07.md#e04), [E22](feature-catalog-review-2026-09-07.md#e22) |
| <a id="w38"></a>**W38 — Add event comparison and testimonials**<br>DRI B; support A, C, D | **L: 8–15 days**<br>Low confidence | **Low / Medium** | [W10](#w10), [W11](#w11), [W12](#w12), [W23](#w23), [W27](#w27) | Compare authoritative closed-event metrics; capture consented testimonials and reuse approved entries in proposals. [E16](feature-catalog-review-2026-09-07.md#e16), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w39"></a>**W39 — Add ancillary PMCM document and logistics records**<br>DRI B; support C, D | **XL: 16–30 days**<br>Low confidence | **Medium / Medium** | [W10](#w10), [W11](#w11), [W13](#w13), [W14](#w14) | Add accreditation checklist/SLA, outsourced creative deliverables and logistics bookings with supplementary charges and printable/shareable briefs. [E03](feature-catalog-review-2026-09-07.md#e03), [E10](feature-catalog-review-2026-09-07.md#e10), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w41"></a>**W41 — Implement pre-conforme and confidential bid workspaces**<br>DRI B; support C, D | **XXL: >30 days; decompose**<br>Low confidence | **Medium / High** | [W07 — complete](#w07), [W10](#w10), [W12](#w12), [W13](#w13), [W16](#w16) | Add TOR/proposal/CE bid lifecycle, outcome tracking, confidential scoped requests and controlled win-to-event/onboarding conversion. [E08](feature-catalog-review-2026-09-07.md#e08), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w42"></a>**W42 — Add budget-based CE package options**<br>DRI B; support C, D | **M: 4–7 days**<br>Medium confidence | **Low / Medium** | [W12](#w12) | Support one/two-option packages with accepted budget-dependent rules and comparison, using the completed CE model. [E10](feature-catalog-review-2026-09-07.md#e10), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w48"></a>**W48 — Build probabilistic supplier reliability**<br>DRI B; support D | **XL: 16–30 days**<br>Low confidence | **Medium / High** | [W16](#w16), [W18](#w18), [W27](#w27), [W40](#w40); **Gate:** Sufficient validated historical observations | Define Bayesian scoring/calibration and confidence bands from timing, complaints, responses and mismatch data. No Claude or ZDR dependency is assumed. [E09](feature-catalog-review-2026-09-07.md#e09), [E20](feature-catalog-review-2026-09-07.md#e20) |

### P3 work

| Work / proposed DRI | Effort and confidence | Impact / fix risk | Completion prerequisites | Remaining scope and exit criterion |
| --- | --- | --- | --- | --- |
| <a id="w37"></a>**W37 — Build guest engagement games**<br>DRI C; support A, B, D | **XXL: >30 days; decompose**<br>Low confidence | **Low / High** | [W07 — complete](#w07), [W19](#w19), [W35](#w35); **Gate:** Explicit extended-scope decision | Build game templates and event-session polls/word clouds/quizzes/raffles/Q&A, with moderation and role controls. Requires design decomposition before a fixed estimate. [E14](feature-catalog-review-2026-09-07.md#e14), [E24](feature-catalog-review-2026-09-07.md#e24) |
| <a id="w43"></a>**W43 — Integrate proposal exports, meetings and signing**<br>DRI B; support C, D | **XXL: >30 days; decompose**<br>Low confidence | **Medium / High** | [W07 — complete](#w07), [W10](#w10), [W11](#w11), [W12](#w12), [W13](#w13); **Gate:** Provider choice, OAuth scopes and accounts | Implement Canva/PPT, Word template rendering, Zoom/calendar and optional e-sign paths as separate adapters. Keep usable manual/scan fallbacks; no provider waiting is estimated. [B05](feature-catalog-review-2026-09-07.md#b05), [E03](feature-catalog-review-2026-09-07.md#e03) |
| <a id="w44"></a>**W44 — Complete governed live AI infrastructure**<br>DRI D; support B | **XL: 16–30 days**<br>Low confidence | **High / High** | [W07 — complete](#w07), [W09 — complete](#w09), [W10](#w10), [W30](#w30); **Gate:** Approved AI provider agreement/settings | Enforce per-call sanitization, durable audit, provider/ZDR proof, failure denial and human-approved effects. W09 containment remains required even while this is deferred. [B03](feature-catalog-review-2026-09-07.md#b03), [E20](feature-catalog-review-2026-09-07.md#e20) |
| <a id="w45"></a>**W45 — Complete live PARE and emergency replacement**<br>DRI B; support C, D | **XL: 16–30 days**<br>Low confidence | **High / High** | [W11](#w11), [W16](#w16), [W18](#w18), [W40](#w40), [W44](#w44); **Gate:** Approved live AI and validated failure/approval scenarios | Complete supplier/coordinator emergency triggers, reviewed candidates and controlled assignment/message effects with retries and durable decisions. [E20](feature-catalog-review-2026-09-07.md#e20) |
| <a id="w46"></a>**W46 — Add AI triage, proposal/theme/compliance/message drafts**<br>DRI B; support C, D | **XXL: >30 days; decompose**<br>Low confidence | **Medium / High** | [W11](#w11), [W12](#w12), [W13](#w13), [W24](#w24), [W33](#w33), [W44](#w44); **Gate:** Approved live AI and evaluated task datasets | Implement each draft/advisory trigger and PMCM review flow separately, including overview-only FR-10+ compliance advisory. No automatic acceptance or sending. [E20](feature-catalog-review-2026-09-07.md#e20) |
| <a id="w47"></a>**W47 — Add the operations assistant and event-day copilot**<br>DRI B; support C, D | **XXL: >30 days; decompose**<br>Low confidence | **High / High** | [W07 — complete](#w07), [W21](#w21), [W44](#w44); **Gate:** Approved live AI, scoped retrieval and evaluated advisory quality | Build event-scoped assistant retrieval and 60-second advisory monitoring; require human approval before operational effects. [E13](feature-catalog-review-2026-09-07.md#e13), [E20](feature-catalog-review-2026-09-07.md#e20) |
| <a id="w49"></a>**W49 — Add post-event AI intelligence**<br>DRI B; support D | **XL: 16–30 days**<br>Low confidence | **Medium / High** | [W23](#w23), [W27](#w27), [W40](#w40), [W44](#w44); **Gate:** Approved live AI and evaluated closed-event examples | Generate the requested causal learning report and reviewable recommendations from complete event evidence, beyond deterministic insight cards. [E16](feature-catalog-review-2026-09-07.md#e16), [E20](feature-catalog-review-2026-09-07.md#e20) |
| <a id="w52"></a>**W52 — Build reusable workflow templates**<br>DRI A; support B, D | **XXL: >30 days; decompose**<br>Low confidence | **Low / High** | [W13](#w13), [W16](#w16), [W18](#w18), [W24](#w24), [W26](#w26); **Gate:** Explicit FL-028 scope decision | Only after workflow contracts stabilize: author/apply/version reusable event templates. Keep the ledger's deferred decision until deliberately changed. [E23](feature-catalog-review-2026-09-07.md#e23) |

## What to start with

| Planning step | Scope | Why this order |
| --- | --- | --- |
| Review and integrate the completed corrections | W01–W09 | Draft PR #40 contains the tested changes; human second-owner review and release acceptance remain distinct from implementation completion. |
| Establish shared production capabilities | [W10](#w10), [W11](#w11) | Storage and delivery unblock many remaining role journeys; confirm provider/access inputs before claiming execution readiness. |
| Supply the missing commercial source | [W12](#w12) → [W13](#w13), [W14](#w14) | Create real issued proposal versions, then verify source-linked documents, onboarding and billing. |
| Deliver bounded policy and validation follow-ups | [W22](#w22), [W31](#w31) | Session assurance and client-category decisions are complete. Implement remaining platform state validation and Private-to-Individual form migration. |
| Complete event operations and closure | [W18](#w18), [W20](#w20), [W23](#w23), [W27](#w27) | Build the accepted operator/window policies, authoritative event end and logistics evidence with their named dependencies. |

**Small pieces inside larger packages:** FR-52’s Pending Full Details status and FR-51’s vocabulary mapping are reasonable small follow-ups within W31 after the relevant policy decision; they do not justify labeling the entire inquiry-context program low effort. W22’s registration-platform validation is another bounded M package after session assurance. These are parts of the listed scope, not extra estimates.

## Every catalog ID mapped to work

Each of the 137 unique IDs appears once below. “Primary work” is the home for its remaining implementation. The linked work row supplies the effort, impact, fix risk and DRI; additional packages identify a shared blocker or another required part of the catalog promise. **Finishing the primary package alone does not complete an ID when dependencies/additional packages remain.** Read the full description and gap in the original review for feature acceptance.

Priorities in this lookup are inherited from the primary package. For example, a P1 proposal feature can require the P0 W02 fix first. The final column uses current blocker references from the updated review. W01–W09 references are marked complete. Resolved findings remain available in the review history, but are not listed as active blockers here.

| Catalog ID / capability | Reviewed state | Primary work | Priority | Additional packages / current blocker |
| --- | --- | --- | --- | --- |
| FR-93 — Partial Payment Recording | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-88 — Coordinator Double Booking Detection | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-37 — Event Assignment Confirmation | Partial | [W16](#w16) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| New-SEC3 — Secure File Upload Validation | Partial | [W10](#w10) | P1 | [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-25 — Dual Notification System | Partial | [W11](#w11) | P1 | [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-34 — Notification of Task and Milestone Updates | Partial | [W11](#w11) | P1 | [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-46 — P.R.I.S.M Public Inquiry Page | Partial | [W11](#w11) | P1 | [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-19 — Cost Estimation Builder | Partial | [W12](#w12) | P1 | [W01 — complete](#w01); No named blocker |
| FR-58 — Event Briefing Form | Partial | [W12](#w12) | P1 | No named blocker |
| FR-60 — Proposal Submission and Review Workflow | Partial | [W12](#w12) | P1 | [W02 — complete](#w02); [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-02 — Client Onboarding Tracker | Partial | [W13](#w13) | P1 | [W11](#w11), [W41](#w41); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-03 — Conforme and MOA Document Storage | Partial | [W13](#w13) | P1 | [W01 — complete](#w01), [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-04 — Per-Event File Hub | Partial | [W13](#w13) | P1 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-26 — Client Portal Access Gated by Signed Conforme | Partial | [W13](#w13) | P1 | [W07 — complete](#w07), [W10](#w10), [W28](#w28); [B01](feature-catalog-review-2026-09-07.md#b01), [B04](feature-catalog-review-2026-09-07.md#b04) |
| FR-32 — Document Submission Portal | Partial | [W13](#w13) | P1 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-33 — Per-Event File Hub Access | Partial | [W13](#w13) | P1 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-38 — Contract and Terms of Service Upload | Partial | [W13](#w13) | P1 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-20 — Billing Statement Generation | Partial | [W14](#w14) | P1 | [W01 — complete](#w01), [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-21 — Post-Event Additional Billing Statement | Not implemented | [W14](#w14) | P1 | No named blocker |
| FR-69 — Flexible Payment Terms Configuration | Partial | [W14](#w14) | P1 | No named blocker |
| FR-92 — Payment Milestone Tracker | Partial | [W14](#w14) | P1 | [W01 — complete](#w01), [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-94 — Billing Statement to Proposal Link | Partial | [W14](#w14) | P1 | [W01 — complete](#w01); No named blocker |
| New-P5 — Additional Billing Waiver | Not implemented | [W14](#w14) | P1 | No named blocker |
| FR-35 — Supplier Profile with Category Tagging and Tier Designation | Partial | [W15](#w15) | P1 | No named blocker |
| New-S2 — Supplier Applications Inbox | Partial | [W15](#w15) | P1 | [W04 — complete](#w04); [K05](feature-catalog-review-2026-09-07.md#k05) |
| New-S3 — Pending First Event Status | Partial | [W15](#w15) | P1 | [W04 — complete](#w04); [K05](feature-catalog-review-2026-09-07.md#k05) |
| New-SUP4 — Supplier Application Status Tracking | Not implemented | [W15](#w15) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-16 — Supplier Selection Policy Layer | Not implemented | [W16](#w16) | P1 | No named blocker |
| FR-17 — Supplier Quote Request and Comparison | Partial | [W16](#w16) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-18 — Supplier Competitive Bidding Module | Partial | [W16](#w16) | P1 | No named blocker |
| FR-36 — Quote Submission | Partial | [W16](#w16) | P1 | No named blocker |
| FR-63 — Supplier Gap Warning | Partial | [W16](#w16) | P1 | No named blocker |
| FR-65 — Client-Owned Supplier Sub-Ticket | Not implemented | [W16](#w16) | P1 | No named blocker |
| FR-75 — Supplier Formal Assignment Notification | Partial | [W16](#w16) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-76 — Supplier Unresponsive Escalation with Viber Deep Link | Not implemented | [W16](#w16) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-78 — Ingress and Egress Schedule View | Not implemented | [W16](#w16) | P1 | No named blocker |
| New-SUP1 — Supplier Event Day Status Updates | Partial | [W16](#w16) | P1 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| New-SUP2 — Pre-Event Readiness Confirmation | Partial | [W16](#w16) | P1 | [W11](#w11), [W17](#w17); [B02](feature-catalog-review-2026-09-07.md#b02), [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-64 — Supplier Communication Thread Access | Partial | [W17](#w17) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-13 — Coordinator Assignment with Role Tagging and Skills Tags | Partial | [W18](#w18) | P1 | [W03 — complete](#w03), [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-89 — Coordinator Withdrawal and Replacement | Partial | [W18](#w18) | P1 | [W03 — complete](#w03), [W09 — complete](#w09), [W44](#w44), [W45](#w45); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-90 — Coordinator Assignment Acknowledgment | Partial | [W18](#w18) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-91 — Coordinator Availability and Staffing View | Partial | [W18](#w18) | P1 | [W03 — complete](#w03); No named blocker |
| FR-39 — Digital Registration and Masterlist | Partial | [W19](#w19) | P1 | [W35](#w35); [B06](feature-catalog-review-2026-09-07.md#b06), [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-95 — Lightweight Digital Registration Module | Partial | [W19](#w19) | P1 | [W35](#w35); [B06](feature-catalog-review-2026-09-07.md#b06), [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-CL1 — Walk-In Policy Setting | Not implemented | [W19](#w19) | P1 | No named blocker |
| New-CO3 — Registration Staff View | Partial | [W19](#w19) | P1 | [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-C1 — Coordinator Role-Specific Portal Views | Partial | [W20](#w20) | P1 | [W08 — complete](#w08); No named blocker |
| New-C2 — Event Day System Operator Role Tag | Partial | [W20](#w20) | P1 | [W08 — complete](#w08); No named blocker |
| New-C3 — Coordinator Late Arrival and No Show Flag | Partial | [W20](#w20) | P1 | [W08 — complete](#w08); No named blocker |
| New-C4 — Task Reassignment with Ms. Mys Notification | Not implemented | [W20](#w20) | P1 | [W08 — complete](#w08), [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| New-CO1 — Coordinator Portal Homepage | Partial | [W20](#w20) | P1 | No named blocker |
| New-CO2 — Floor Director and Stage Director View | Partial | [W20](#w20) | P1 | [W10](#w10), [W11](#w11); [B01](feature-catalog-review-2026-09-07.md#b01), [B02](feature-catalog-review-2026-09-07.md#b02) |
| New-CO4 — Ingress and Egress Assistant View | Partial | [W20](#w20) | P1 | [W10](#w10), [W16](#w16); [B01](feature-catalog-review-2026-09-07.md#b01), [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-CO5 — Event Day System Operator View | Partial | [W20](#w20) | P1 | [W08 — complete](#w08), [W27](#w27); No named blocker |
| FR-05 — Live Operations Dashboard | Partial | [W21](#w21) | P1 | No named blocker |
| FR-12 — EOD Report Inbox Per Event | Not implemented | [W21](#w21) | P1 | No named blocker |
| New-GU1 — Ticket-Based Event Registration Coordination | Partial | [W22](#w22) | P1 | [K09](feature-catalog-review-2026-09-07.md#k09) |
| FR-41 — Post-Event Experience Upload with Moderation | Partial | [W23](#w23) | P1 | [W10](#w10), [W35](#w35); [B01](feature-catalog-review-2026-09-07.md#b01), [B06](feature-catalog-review-2026-09-07.md#b06), [K07](feature-catalog-review-2026-09-07.md#k07) |
| New-EX2 — Post-Event Guest Feedback Page | Partial | [W23](#w23) | P1 | [W10](#w10), [W35](#w35); [B01](feature-catalog-review-2026-09-07.md#b01), [B06](feature-catalog-review-2026-09-07.md#b06), [K07](feature-catalog-review-2026-09-07.md#k07) |
| FR-06 — Event Proposal Compliance Engine | Partial | [W24](#w24) | P1 | [W46](#w46); No named blocker |
| FR-07 — Risk Management Assessment | Not implemented | [W24](#w24) | P1 | No named blocker |
| FR-96 — Event Cancellation Workflow | Not implemented | [W25](#w25) | P1 | No named blocker |
| FR-97 — Event Postponement Workflow | Not implemented | [W25](#w25) | P1 | No named blocker |
| FR-77 — Supplier Contract Mismatch Warning | Not implemented | [W26](#w26) | P1 | [W43](#w43); [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-SY3 — Change Freeze Deadline | Not implemented | [W26](#w26) | P1 | No named blocker |
| New-SY4 — Addendum Conforme Workflow | Not implemented | [W26](#w26) | P1 | [W10](#w10), [W43](#w43); [B01](feature-catalog-review-2026-09-07.md#b01), [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-22 — Post-Event Documentation Submission Tracker | Partial | [W27](#w27) | P1 | [W05 — complete](#w05), [W10](#w10), [W11](#w11); [B01](feature-catalog-review-2026-09-07.md#b01), [B02](feature-catalog-review-2026-09-07.md#b02), [K06](feature-catalog-review-2026-09-07.md#k06) |
| FR-23 — Event Archive with Search | Partial | [W27](#w27) | P1 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| New-P2 — Event Insights Card | Partial | [W27](#w27) | P1 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| New-SY1 — Post-Event Wrap-Up Screen | Not implemented | [W27](#w27) | P1 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| New-SY2 — One-Screen Close | Partial | [W27](#w27) | P1 | [W05 — complete](#w05), [W08 — complete](#w08); No named blocker |
| New-SEC1 — Role-Based Authentication and Session Management | Partial | [W28](#w28) | P1 | [W07 — complete](#w07), [W11](#w11); [B04](feature-catalog-review-2026-09-07.md#b04), [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-56 — Data Anonymization Tool | Partial | [W29](#w29) | P1 | [W06 — complete](#w06); [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-SEC2 — Data Privacy Compliance Module | Partial | [W29](#w29) | P1 | [W06 — complete](#w06); No named blocker |
| New-SEC4 — Comprehensive Audit Trail and Activity Log | Partial | [W30](#w30) | P1 | [W02 — complete](#w02), [W04 — complete](#w04); No named blocker |
| FR-79 — Supplier Reliability Notes | Partial | [W40](#w40) | P1 | No named blocker |
| New-S4 — Supplier Performance Assessment | Partial | [W40](#w40) | P1 | [W04 — complete](#w04); [K05](feature-catalog-review-2026-09-07.md#k05) |
| New-S5 — PMCM Internal Supplier Review | Partial | [W40](#w40) | P1 | [W04 — complete](#w04), [W08 — complete](#w08); [K05](feature-catalog-review-2026-09-07.md#k05) |
| FR-27 — Event Progress Visibility | Partial | [W51](#w51) | P1 | [W01 — complete](#w01), [W02 — complete](#w02); No named blocker |
| FR-47 — Lightweight Spatial Preference Form | Not implemented | [W31](#w31) | P2 | No named blocker |
| FR-50 — Abandoned Inquiry Draft Save with Edit Window | Not implemented | [W31](#w31) | P2 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-51 — Client Type Field | Partial | [W31](#w31) | P2 | [W08 — complete](#w08); No named blocker |
| FR-52 — Send Inquiry Link and Log on Behalf Tool | Partial | [W31](#w31) | P2 | No named blocker |
| FR-53 — Pre-Conforme Context Notes Log | Not implemented | [W31](#w31) | P2 | No named blocker |
| FR-54 — Pre-Conforme Document Attachment | Not implemented | [W31](#w31) | P2 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01) |
| FR-44 — Organization Merge Tool | Not implemented | [W32](#w32) | P2 | No named blocker |
| FR-09 — Venue Styling Moodboard Upload and Client Approval Workflow | Not implemented | [W33](#w33) | P2 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01), [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-10 — Venue Scouting Module | Not implemented | [W33](#w33) | P2 | No named blocker |
| FR-30 — Venue Styling Moodboard Viewing and Formal Approval | Not implemented | [W33](#w33) | P2 | [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-31 — Budget Confirmation Module for Venue Styling | Not implemented | [W33](#w33) | P2 | No named blocker |
| FR-66 — Venue Ocular Task Trigger | Not implemented | [W33](#w33) | P2 | No named blocker |
| FR-08 — Floor Plan Upload and Client Approval Workflow | Partial | [W34](#w34) | P2 | [W08 — complete](#w08); No named blocker |
| FR-29 — Official Floor Plan Viewing and Formal Approval | Partial | [W34](#w34) | P2 | [W08 — complete](#w08); No named blocker |
| FR-81 — Venue Library | Partial | [W34](#w34) | P2 | No named blocker |
| FR-82 — Quick Setup Presets | Partial | [W34](#w34) | P2 | No named blocker |
| FR-83 — Client Floor Plan Annotation and Approval | Partial | [W34](#w34) | P2 | [W08 — complete](#w08); No named blocker |
| FR-84 — Table Assignment List | Partial | [W34](#w34) | P2 | [W19](#w19); [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-42 — Guest Pass Promotional Sample | Partial | [W35](#w35) | P2 | No named blocker |
| FR-24 — Toggle System | Not implemented | [W36](#w36) | P2 | No named blocker |
| FR-55 — Bilingual Notification Email Templates | Not implemented | [W36](#w36) | P2 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02) |
| New-CL2 — Event Day Limited View | Partial | [W36](#w36) | P2 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02), [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-P1 — Event Comparison View | Not implemented | [W38](#w38) | P2 | [W27](#w27); [B07](feature-catalog-review-2026-09-07.md#b07) |
| New-P3 — Client Testimonial Feature | Not implemented | [W38](#w38) | P2 | [W11](#w11), [W43](#w43); [B02](feature-catalog-review-2026-09-07.md#b02), [B05](feature-catalog-review-2026-09-07.md#b05) |
| FR-70 — Accreditation Document Tracker | Not implemented | [W39](#w39) | P2 | No named blocker |
| FR-87 — Outsourced Creative Designer Sub-Ticket | Not implemented | [W39](#w39) | P2 | No named blocker |
| New-P4 — Logistics Booking Record | Not implemented | [W39](#w39) | P2 | [W14](#w14); [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-43 — Bid Workspace | Not implemented | [W41](#w41) | P2 | [W10](#w10), [W12](#w12); [B01](feature-catalog-review-2026-09-07.md#b01), [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-49 — Confidential Bid Quote Request | Partial | [W41](#w41) | P2 | No named blocker |
| FR-62 — Tiered Package Options in CE Builder | Not implemented | [W42](#w42) | P2 | [W12](#w12); [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-AI-06 — Probabilistic Supplier Reliability Scoring Model | Not implemented | [W48](#w48) | P2 | No named blocker |
| FR-40 — In-Event Engagement Feature with Game Builder | Not implemented | [W37](#w37) | P3 | [W35](#w35); [B06](feature-catalog-review-2026-09-07.md#b06) |
| FR-59 — Canva and PowerPoint Proposal Integration | Not implemented | [W43](#w43) | P3 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01), [B05](feature-catalog-review-2026-09-07.md#b05) |
| FR-61 — Presentation Meeting Scheduler with Zoom Integration | Not implemented | [W43](#w43) | P3 | [W11](#w11); [B02](feature-catalog-review-2026-09-07.md#b02), [B05](feature-catalog-review-2026-09-07.md#b05) |
| FR-67 — Document Template Pre-Fill System | Not implemented | [W43](#w43) | P3 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01), [B05](feature-catalog-review-2026-09-07.md#b05) |
| FR-68 — Dual Signing Path | Partial | [W43](#w43) | P3 | [W10](#w10); [B01](feature-catalog-review-2026-09-07.md#b01), [B05](feature-catalog-review-2026-09-07.md#b05) |
| FR-AI-ZDR — Zero Data Retention AI Governance Layer | Partial | [W44](#w44) | P3 | [W09 — complete](#w09); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-AI-04 — P.R.I.S.M Agentic Response Engine (PARE) — Multi-Agent Emergency Response | Partial | [W45](#w45) | P3 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-AI-04b — PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Partial | [W45](#w45) | P3 | [W09 — complete](#w09), [W11](#w11), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03), [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-11 — AI Theme and Moodboard Suggestion Engine | Not implemented | [W46](#w46) | P3 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-AI-01 — Intelligent Inquiry Triage Agent | Not implemented | [W46](#w46) | P3 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-AI-03 — AI Proposal Drafting Assistant | Not implemented | [W46](#w46) | P3 | [W09 — complete](#w09), [W12](#w12), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03), [B07](feature-catalog-review-2026-09-07.md#b07) |
| FR-AI-09 — Client Communication Intelligence Assistant | Not implemented | [W46](#w46) | P3 | [W09 — complete](#w09), [W11](#w11), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03), [B02](feature-catalog-review-2026-09-07.md#b02) |
| FR-AI-05 — P.R.I.S.M Operations Assistant (POA) — Caged Claude Chatbot | Not implemented | [W47](#w47) | P3 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-AI-07 — Real-Time Event Day Copilot | Not implemented | [W47](#w47) | P3 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-AI-08 — Post-Event Intelligence Layer (PEIL) | Partial | [W49](#w49) | P3 | [W09 — complete](#w09), [W44](#w44); [B03](feature-catalog-review-2026-09-07.md#b03) |
| FR-01 — Inquiry Intake Log | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-14 — Supplier Directory with Category Tagging | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-15 — Tier 1 and Tier 2 Supplier Designation | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-28 — Client Draft Floor Plan Submission | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-45 — Referral Details Field | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-48 — Referral Source Dropdown | Implemented | [R00 — retain](#r00) | Retain | — |
| FR-80 — Floor Plan Builder with Draggable Element Library | Implemented | [R00 — retain](#r00) | Retain | — |
| New-CO6 — Usher and General Coordinator View | Implemented | [R00 — retain](#r00) | Retain | — |
| New-EX1 — Supplier Registration Page (Public-Facing) | Implemented | [R00 — retain](#r00) | Retain | — |
| New-S1 — Supplier Registration Page | Implemented | [R00 — retain](#r00) | Retain | — |
| New-SUP3 — Supplier Registration Page | Implemented | [R00 — retain](#r00) | Retain | — |

<a id="r00"></a>
### R00 — retain implemented capabilities

No new implementation effort is assigned to the 13 implemented IDs. Keep their existing behavior and include proportionate regression/role-path checks when dependent packages change. This does not claim they need zero maintenance or have passed live production acceptance.

FR-01, FR-45, FR-14, FR-15, New-S1, FR-93, FR-80, FR-88, FR-28, New-SUP3, New-CO6, FR-48, New-EX1. The three supplier-signup IDs refer to one implementation.

### Unassessed and overview-only scope

The **37 system behaviors remain unassessed and unestimated** because the preserved source lists only their count. [W50](#w50) covers recovering/reconciling their definitions, not implementing 37 invented requirements. Its estimate cannot be added as their delivery effort.

The AI overview-only **FR-10+** compliance advisory maps to [W24](#w24), [W44](#w44), [W46](#w46); it is outside the 137-ID detailed-table count. The overview's **FR-15** theme engine maps to detailed-table **FR-11 / W46**; detailed-table **FR-15 supplier tiering remains retained**. These inconsistencies are kept explicit rather than repaired by changing the preserved catalog.

## Current ledger mapping

The 28 ledger families/candidates are covered as follows. They overlap catalog IDs and each other; their rows are navigation into the same 52 work packages, not another effort subtotal. This preserves implemented bounded slices (for example Command Inbox and metadata File Requirements Matrix) while identifying their remaining acceptance or dependent work.

| Ledger family | Related packages / acceptance (completed prerequisites labeled) |
| --- | --- |
| FL-001 — Inquiry operations | [W08 — complete](#w08), [W11](#w11), [W13](#w13), [W31](#w31), [W32](#w32), [W41](#w41), [W46](#w46) |
| FL-002 — Conforme and onboarding | [W01 — complete](#w01), [W10](#w10), [W11](#w11), [W13](#w13) |
| FL-003 — PMCM command dashboard | [W21](#w21), [W51](#w51) |
| FL-004 — Client action center | [W01 — complete](#w01), [W02 — complete](#w02), [W13](#w13), [W14](#w14), [W51](#w51) |
| FL-005 — Proposal and CE | [W02 — complete](#w02), [W12](#w12), [W42](#w42), [W43](#w43), [W46](#w46) |
| FL-006 — Document operations | [W10](#w10), [W13](#w13), [W39](#w39) |
| FL-007 — Supplier network | [W04 — complete](#w04), [W15](#w15), [W16](#w16), [W17](#w17), [W40](#w40), [W41](#w41), [W45](#w45), [W48](#w48) |
| FL-008 — Coordinator operations | [W03 — complete](#w03), [W08 — complete](#w08), [W18](#w18), [W20](#w20), [W21](#w21), [W45](#w45) |
| FL-009 — Compliance, risk and change | [W08 — complete](#w08), [W24](#w24), [W25](#w25), [W26](#w26), [W46](#w46) |
| FL-010 — Billing and payments | [W01 — complete](#w01), [W12](#w12), [W14](#w14) |
| FL-011 — Floorplan workflow | [W08 — complete](#w08), [W19](#w19), [W33](#w33), [W34](#w34) |
| FL-012 — Guest access | [W19](#w19), [W22](#w22), [W23](#w23), [W35](#w35), [W37](#w37) |
| FL-013 — Closure/archive/learning | [W05 — complete](#w05), [W23](#w23), [W27](#w27), [W38](#w38), [W39](#w39), [W49](#w49) |
| FL-014 — Notifications/communications | [W11](#w11), [W17](#w17), [W36](#w36), [W46](#w46), [W47](#w47) |
| FL-015 — Security/privacy/audit | [W06 — complete](#w06), [W07 — complete](#w07), [W09 — complete](#w09), [W10](#w10), [W28](#w28), [W29](#w29), [W30](#w30), [W44](#w44) |
| FL-016 — Shared design system/shell | [W51](#w51) |
| FL-017 — Event Command Inbox | [W21](#w21), [W51](#w51) |
| FL-018 — Event Health Score | [W21](#w21), [W27](#w27), [W51](#w51) |
| FL-019 — Decision Log | [W02 — complete](#w02), [W04 — complete](#w04), [W26](#w26), [W30](#w30) |
| FL-020 — Client Action Center | [W01 — complete](#w01), [W02 — complete](#w02), [W13](#w13), [W14](#w14), [W51](#w51) |
| FL-021 — PMCM Handoff Brief | [W20](#w20), [W21](#w21), [W51](#w51) |
| FL-022 — Supplier Readiness Board | [W16](#w16) |
| FL-023 — Coordinator Staffing Heatmap | [W03 — complete](#w03), [W18](#w18) |
| FL-024 — File Requirements Matrix | [W05 — complete](#w05), [W10](#w10), [W13](#w13) |
| FL-025 — Risk and Change Register | [W24](#w24), [W26](#w26) |
| FL-026 — Event Day Run Sheet | [W20](#w20), [W21](#w21) |
| FL-027 — Privacy Operations Console | [W06 — complete](#w06), [W29](#w29) |
| FL-028 — Workflow Template Builder | [W52](#w52) |

FL-028 remains deferred. Mapping it to W52 supplies a planning placeholder and rough size category; it does not authorize building it. Similarly, completed bounded slices receive residual acceptance or integration work only.

## Validation and limits

The fresh repository boundary scan **failed** on `apps/api/src/modules/read-models/application/services/supplier-ownership.database.test.ts` because the read-model mutation rule also matches its database fixture writes. All 11 checker tests passed. This report records V01 without changing source or silently weakening the boundary rule; the earlier blanket boundary-pass claim is superseded.

This documentation refresh reconciles the baseline catalog against implementation commit `02b6896`. The catalog review records the exact feature-state and blocker changes. P0 completion does not automatically promote every associated catalog ID. The original 52-package inventory is retained, with nine completed packages excluded from the 43-package remaining-effort and risk grids.

Validation checks all 140 catalog occurrences, 137 unique IDs, one lookup entry per ID, 52 unique packages, nine completed P0 rows, 43 remaining rows, valid local file/anchor references and matching catalog/lookup states. Work-package prerequisites remain acyclic. Estimates are planning judgments, not measured agent runtime or a delivery schedule.

The [P0 readiness report](docs/roadmap/p0-correctness-readiness.md) records prior execution of 698 application/package tests, 361 actual HTTP checks, typechecks, build, boundaries, complexity and database checks. Those results belong to the implementation commit; application tests were not rerun for this documentation-only reconciliation. Browser journeys, staging deployment, external providers and production acceptance are not established by those local results. The 37 unlisted behaviors remain unassessed and unestimated.

Sources: [updated catalog review](feature-catalog-review-2026-09-07.md), [feature ledger](docs/product/feature-ledger.md), [architecture priority/risk convention](docs/roadmap/architecture-priority-risk-matrix.md), [readiness gates](docs/product/readiness-foundation.md).

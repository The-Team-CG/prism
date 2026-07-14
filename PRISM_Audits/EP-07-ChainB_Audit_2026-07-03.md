# EP-07 Chain B Audit — Public Supplier Registration, Applications Inbox, Application Status Page

**Date:** 2026-07-03
**Scope:** EP-07-S06, EP-07-S09, EP-07-S10
**Branch:** `feature/ep-02-s05-coordinator-directory` (same branch used for Chain A and EP-04 through EP-06; no prior commits on this branch belong to this chain either — consistent with those audits being read-only outputs, not feature-branch deliverables. No new branch created.)
**Method:** Exhaustive Grep/Glob sweep across `apps/api`, `apps/event`, `apps/client`, `apps/guest`, `apps/supplier`, the full Prisma schema model list, `apps/api/prisma/migrations/`, and `git log --all` for every plausible naming variant, followed by an independent confirmatory pass via a dispatched `ecc:silent-failure-hunter` subagent using its own search terms. No application code was modified.
**Last PA number confirmed before this audit:** PA-168 (from `_Audit_Index.md`, EP-07 Chain A row). **No new PA numbers are raised by this audit** — there is no implemented code to find a defect in. See reasoning below.

---

## Executive summary

**This is the first negative control in this audit initiative that turns out to be genuinely accurate.** EP-05-S01, EP-05-S02, and EP-07-S04 all showed "0%" while being substantially built. EP-07-S06, EP-07-S09, and EP-07-S10 show "0%" and **are, in fact, 0%** — no route, no controller, no Prisma model, no frontend component, no migration ever created and dropped, and no commit in the entire git history references a supplier registration/application intake flow. This was verified two ways: my own direct search, and an independent subagent search using different terms and additional sources (migration directory listing, full `git log --all` grep). Both came back empty.

This means the three per-story checklists below are necessarily short — there is no code to trace a PASS/FAIL/PARTIAL verdict against per AC line. Instead, each section documents exactly what was searched and confirms the absence, per the instruction not to accept a 0% claim without an actual search.

**Click-path consequence:** the cross-cutting instruction to trace the S06 → S09 → S10 journey as one continuous flow is answered trivially: there is no journey to trace, because none of its three pieces exist. This is not "one piece is missing so the chain is broken" — all three are simultaneously absent, so there is no partial connection to describe either.

**PA-74 naming confusion, resolved for this codebase:** `New-SUP3` (`docs/prism-v4/features/supplier.md`) and `New-EX1` (`docs/prism-v4/features/external-public.md`) are the same feature — a public supplier registration page — documented twice under different IDs, and `New-SUP4` is the status-tracking page (S10). Confirmed: **this naming duplication produced no code duplication**, because no code was ever written under either name. PA-74 remains open as a documentation/numbering question, but it can be closed on the "did this cause two competing implementations" sub-question — it did not, since there is only one (nonexistent) implementation.

| Story | Tracker claim | Audit finding | Real completion estimate |
|---|---|---|---|
| EP-07-S06 Public Supplier Registration | To Do, 0%, C2 | Confirmed accurate — no implementation found anywhere | **0%** |
| EP-07-S09 Supplier Applications Inbox | To Do, 0%, C3 | Confirmed accurate — no implementation found anywhere | **0%** |
| EP-07-S10 Prospective Supplier Application Status Page | To Do, 0%, C4 | Confirmed accurate — no implementation found anywhere | **0%** |

---

## EP-07-S06 — Public Supplier Registration

**Tracker:** To Do, 0%, C2 — **confirmed accurate.**

Searched for: `SupplierApplication`, `supplier-application`, `supplier registration`, `SupplierRegistration`, `prospective`, `apply`/`Apply` (in public-facing component directories), `recruit`, `onboard supplier`/`supplier onboard`, `New-SUP3`, `New-EX1`, `vendor application`, across `apps/api/libs/**`, `apps/event/src/**`, `apps/supplier/src/**`, `apps/client/**`, `apps/guest/**`. Also read `apps/supplier/src/app/page.tsx` (the supplier portal's public marketing/landing page) in full — it is exclusively a sign-in gate for already-onboarded suppliers ("Supplier sign in" CTA repeated 6 times), with no apply/register link or form anywhere on the page.

Also checked the Prisma schema (`apps/api/prisma/schema.prisma`) model list directly — the only supplier-related models are `OpsSupplier`, `OpsSupplierQuoteRequest`, `OpsSupplierQuote`, `OpsSupplierCategory`, `OpsSupplierReview`, `OpsSupplierReliabilityNote`, `OpsSupplierCertification`. All of these assume a supplier record already exists (created via the PMCM-admin-only `POST /suppliers` endpoint audited in Chain A); none represents an inbound public application awaiting review.

**All AC items: cannot PASS, FAIL, or PARTIAL in the normal sense — there is no code to evaluate.** Specifically confirmed absent:
- No public, unauthenticated form component anywhere in `apps/event` or `apps/supplier`.
- No capture of name/contact/email/category/description/BNI-toggle for an inbound applicant.
- No write path into any table `S09` could read from, because no such table exists.
- No confirmation-email trigger for this flow (the only confirmation-email logic that exists is for the client inquiry flow, `inquiry-onboarding` module, which is a different feature — `FR-46`, not this one).
- No auto-approval risk to check, because there is no submission path to auto-approve.
- No duplicate-submission handling of any kind, blocked or otherwise.
- No rate limiting to check, because there is no endpoint to rate-limit.

**Completion estimate: 0%.** No PA raised — there is nothing to attribute a defect to.

---

## EP-07-S09 — Supplier Applications Inbox

**Tracker:** To Do, 0%, C3 — **confirmed accurate.**

Searched for: `Applications Inbox`, `Request Proposal`, `Schedule Meeting`, `Decline` (in a supplier-application context, not the existing quote-decline flows already audited in Chain A), any PMCM dashboard nav item or route referencing "applications", across the same directory set as S06. Also greped `EventDashboardClient.tsx` directly for `applications`/`Applications` — zero matches; the sidebar has no such section (confirmed against the full nav list already mapped in the Chain A audit's event-dashboard-client-structure memory).

Also confirmed via the confirmatory subagent's independent pass: `git log --all -i --grep` for supplier-related commits (40+ reviewed) shows only work on existing-supplier operations (directory, quotes/billing, PARE emergency replacement, portal, withdrawal, verification) — nothing about an inbound-application inbox, and no evidence of reverted/removed work in this area.

**All AC items: absent, not evaluable.** Specifically confirmed:
- No PMCM-facing inbox route or component.
- No three-action set (Request Proposal / Schedule Meeting / Decline) anywhere in the codebase.
- No write path setting a supplier's tier to `pending_first_event` from an approval flow — the `SupplierTier.PendingFirstEvent` enum value exists and is used (confirmed in Chain A: it's the default tier set by the PMCM-admin `createSupplier` command), but nothing in the codebase writes to it *from an applications-inbox approval*, because no such inbox exists. This is worth flagging precisely per the prompt's framing: the destination status has real schema support, but there is no source flow feeding it — the gap is entirely upstream (no inbox exists to approve from), not in the tier enum itself.
- No decline-notification or decline-record logic for this flow.
- No audit-log entries for this flow (there is nothing to audit).
- No API-level access question to evaluate — there is no endpoint to check role restrictions on.

**Completion estimate: 0%.** No PA raised.

---

## EP-07-S10 — Prospective Supplier Application Status Page

**Tracker:** To Do, 0%, C4 — **confirmed accurate.**

Searched for: a public no-login status page, the five specific status labels (`Under Review`, `Proposal Requested`, `Meeting Scheduled`, `Approved`, `Declined`), any token-based or ID-based lookup route resembling the pattern used by the S02 quote-request magic-link tokens (`accessToken` on `OpsSupplierQuoteRequest`, audited in Chain A) that might have been reused here. None found.

**The CRITICAL IDOR check the brief asked for (how does the page identify which applicant to show) cannot be performed, because the page itself does not exist.** This is worth stating plainly rather than leaving implicit: there is no route, so there is no ID/token scheme to evaluate for guessability, and no response shape to check for over-exposure of other applicants' data, internal PMCM notes, or supplier directory data. If and when this story is built, it should reuse the same `randomUUID()` opaque-token pattern already used correctly for supplier quote-request magic links (`commercial-workflow.service.ts`, confirmed safe in Chain A) rather than a sequential or guessable application ID — flagging this as a forward-looking design note, not a current defect.

**Completion estimate: 0%.** No PA raised.

---

## Cross-cutting: resolveActor sweep

**Not applicable — moot.** The instruction was to check whether whatever module implements S06/S09/S10 calls `EventAccessPolicyService.resolveActor` and whether an explicit role check follows. Since no module implements any of these three stories, there is no `resolveActor` call site to evaluate. This is different from Chain A's cross-cutting finding (where the pattern was present and guarded) — here there is nothing to be guarded or unguarded in the first place. Documented for completeness, not as a finding.

## Cross-cutting: end-to-end journey connectivity

The brief asked to confirm whether the S06 → S09 → S10 journey is connected end to end, or whether one piece exists in isolation (e.g., a status page with nothing to display). The actual answer is a degenerate case of that question: **none of the three pieces exist**, so there is no partial connectivity to describe, no orphaned piece, and no dangling reference. This should not be read as "less bad" than a partially-built chain — it's simply a different failure mode (nothing built, vs. Chain A's S04 where pieces existed but didn't connect to each other).

---

## PA-76 correction (Chain A, EP-07-S05) — supersedes the note in `EP-07-ChainA_Audit_2026-07-03.md`

Per explicit instruction, the following corrected tracker note replaces the PA-76 note drafted in the Chain A report:

> AUDIT 2026-07-03: Verified-level logic exists and is reachable by PmcmAdmin, System, or Coordinator via the live-ops dashboard (Verify/Dispute buttons in LiveOperationsWorkspace), this is not a missing feature, code evidence confirms the mechanism exists and functions. PA-76 remains OPEN: technical reachability is not the same as a confirmed intended workflow. Ms. Mys must still confirm whether all three roles should be able to perform Verified status, or whether it should be restricted (for example, on-site coordinators only).

The Chain A report's original PA-76 note ("should be closed as...") is superseded — it overstated the resolution. Reachability was confirmed; the design question of *who should be allowed to* was not, and remains Ms. Mys's call.

---

## Summary of new PA numbers

**None.** This chain audit confirms three accurate 0% tracker entries with no code to attribute a defect to. The only tracker action needed is a Notes update confirming the 0% is correct (see draft notes below) — these stories should stay at 0%/To Do, not move.

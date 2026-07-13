# Ethan (Owner C) -- P.R.I.S.M. Tracker TODO

> **Primary Scope:** `apps/client` (port 3001), `apps/supplier` (port 3002), `apps/guest` (port 3003), public flows
> **Generated from:** `PRISM_AC_Tracker.xlsx` -- Tracker, Cadence Review Guide, and Owner Tasks sheets
> **Date:** July 13, 2026

---

## C1 Stories (June 15--20, 2026) -- CLOSED

| Story | Description | Status | Notes |
|-------|-------------|--------|-------|
| EP-01-S01 | Public inquiry form for prospective clients | **Done** | FR-01, FR-46, FR-51. PA-62 OPEN (sixth referral source pending Ms. Mys). |
| EP-07-S03 | Supplier review and confirm availability/quote | **Done** | FR-37. No raw AI output to suppliers -- critical role boundary. |
| EP-07-S05 | Supplier on-site arrival and setup status update | **Done** | New-SUP1. PA-76 OPEN -- Ms. Mys must confirm who performs Verified level. |

---

## C2 Stories (June 22 -- July 3, 2026) -- ACTIVE

| Story | Description | Status | Priority | Dependencies | Notes |
|-------|-------------|--------|----------|--------------|-------|
| EP-05-S02 | Client venue and layout preferences submission | **To Do** | Must | EP-04-S01, EP-05-S01 | FL-018; client submits preferences only -- cannot mutate official state. Carry from C2 into C3 if needed. |
| EP-05-S03 | Client view approved floor plan + revision comments | **To Do** | Must | EP-05-S01 | FR-29, FR-83; read-only official snapshot. Primary contact only can submit comments. Carry from C2 into C3 if needed. |
| EP-10-S01 | Client action center (pending tasks, event status) | **In Progress** | Must | EP-04-S01 | FL-020; PrismClientActionCenter exists. Fallback derivation still present -- must be removed. Maxine reviews per FL-020. |
| EP-10-S03 | Client ocular visit request | **To Do** | Should | EP-04-S01 | FR-66; PA-59 OPEN on PMCM override path mechanism. Ask Ms. Mys. |

---

## C3 Stories (July 6--17, 2026) -- UPCOMING (Feature Freeze at Close)

> **11 stories this cadence.** Two stories potentially declared post-July (EP-13-S03, EP-13-S07) depending on PA-63 and PA-66 resolution.
> **Key deadline:** EP-13-S02 Done by **July 10**. EP-13-S04 Done by **July 14**. PA-63/PA-66 resolved by **July 6** or EP-13-S03 and EP-13-S07 declared post-July by **July 10**.

### Carry-Over from C2 (if needed)

| Story | Description | Status | Priority | Dependencies | Notes |
|-------|-------------|--------|----------|--------------|-------|
| EP-05-S02 | Client venue and layout preferences submission | **To Do** | Must | EP-04-S01, EP-05-S01 | See C2 row above. |
| EP-05-S03 | Client view approved floor plan + revision comments | **To Do** | Must | EP-05-S01 | See C2 row above. |

### C3 Dedicated Stories

| Story | Description | Status | Priority | Dependencies | Notes |
|-------|-------------|--------|----------|--------------|-------|
| EP-10-S02 | Client event timeline and milestone progress view | **To Do** | Should | EP-04-S01 | FR-27; FL-004 thin slice; New-CL2 toggle by PMCM per event. |
| EP-12-S03 | Supplier withdrawal from event | **Done** | Must | EP-06-S03 | supplier-ops; OpsEventSupplierWithdrawalController; requireSupplierAdmin policy. |
| EP-13-S02 | Guest check-in (name-based + headcount-only) | **In Progress** | Must | EP-04-S01 | FR-39, FR-95; Partial per File 9. Remaining: headcount-only mode, walk-in policy enforcement, real-time count feed. **Deadline: July 10.** |
| EP-13-S03 | Guest QR code check-in via own phone browser | **Blocked** | Should | EP-13-S02 | FR-39, FR-95; HTTPS required. **BLOCKED: PA-63 and PA-66 OPEN.** If unresolved by July 10, declare post-July. |
| EP-13-S04 | Guest post-event feedback (star rating + media) | **To Do** | Should | EP-04-S01 | FR-41, New-EX2; video max 60s; PMCM moderated queue; client permission required. **Deadline: July 14.** |
| EP-13-S05 | Digital registration platform details + headcount import | **To Do** | Must | EP-04-S01 | New-GU1; scoped to 200--250+ pax using XPERTO. Co-owned with Anthony. PRISM never processes ticket sales. |
| EP-13-S06 | Guest event info web page via QR on LED wall | **To Do** | Could | None | FR-40; no account required; HTTPS; Phase 2 scope. |
| EP-13-S07 | Guest game participation via QR code | **Blocked** | Could | EP-12-S05 | FR-40; apps/guest; Phase 2 scope. **BLOCKED: same QR gate as EP-13-S03 (PA-63, PA-66).** Also gated on EP-12-S05 (game must exist). If PA-63/PA-66 unresolved by July 10, declare post-July. |

---

## C4 Stories (July 20--31, 2026) -- STABILIZATION & EVIDENCE ONLY (Hard Stop July 31)

| Story | Description | Status | Priority | Dependencies | Notes |
|-------|-------------|--------|----------|--------------|-------|
| EP-07-S10 | Prospective supplier application status page | **To Do** | Should | EP-07-S09 | New-SUP4; five statuses: Under Review, Proposal Requested, Meeting Scheduled, Approved, Declined. No full portal login required. **Deadline: July 25.** |

> **C4 Owner Task:** EP-07-S10 done by July 25. All C3 carry-over stories either Done or formally declared post-July. Final portal review and UAT prep support.

---

## Red Flags Affecting Ethan

- **PA-63 / PA-66 unresolved by July 10:** EP-13-S03 and EP-13-S07 must be formally declared post-July immediately. Two of your 11 C3 stories.
- **Any Must story not In Progress by July 10:** Escalate to full team immediately. Feature freeze at July 17 leaves no buffer.
- **EP-13-S02 not Done by July 10:** Blocks downstream guest experience stories.
- **EP-13-S04 not Done by July 14:** Compresses timeline before feature freeze.

---

## PA Resolutions Affecting Ethan

| PA | Story | Deadline | Status | Action |
|----|-------|----------|--------|--------|
| PA-59 | EP-10-S03 | Before In Review | Open | Francis + Ms. Mys must confirm PMCM override path mechanism for ocular visit. Ask Ms. Mys. |
| PA-63 | EP-13-S03, EP-13-S07 | C3 start (July 6) | Open | Team confirms whether guest self-scan with own phone falls under same QR/camera gate as coordinator check-in. |
| PA-66 | EP-13-S03, EP-13-S07 | C3 start (July 6) | Open | Team confirms whether browser-based QR scanning (guest own phone) is blocked by same gate. Resolved in same discussion as PA-63. |
| PA-74 | EP-07-S06 | Before Phase 4 | Open | Canonical FR number and name for New-SUP3/New-EX1/New-S1. |
| PA-76 | EP-07-S05 | Before Done | Open | Ms. Mys must confirm who performs Verified status level and through which surface. |

---

## Summary

| Cadence | Done | In Progress | To Do | Blocked | Total |
|---------|------|-------------|-------|---------|-------|
| C1 | 3 | 0 | 0 | 0 | 3 |
| C2 | 0 | 1 | 3 | 0 | 4 |
| C3 | 1 | 1 | 5 | 2 | 9* |
| C4 | 0 | 0 | 1 | 0 | 1 |
| **Total** | **4** | **2** | **9** | **2** | **17** |

*Excludes C2 carry-over stories (EP-05-S02, EP-05-S03) counted under C2.*

**Completed:** 4 / 17 stories (24%)
**In Progress:** 2 stories
**At Risk (Blocked):** 2 stories (EP-13-S03, EP-13-S07 -- both on PA-63/PA-66)

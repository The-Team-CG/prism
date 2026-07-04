# REQ-03: Unfinished Portal Features — July Completion Path (Ethan's Surfaces)

**Source:** Agile calendar line 297, REQ-03 feature ledger
**Rule:** Each task has exactly one DRI. Support is requested explicitly, not assumed.
**Owner:** Ethan (portal surfaces)
**Date:** 2026-06-20

---

## Ethan's DRI Tasks

| FL | Feature | Label | Current state | July path requirement |
|---|---|---|---|---|
| FL-001 | Public Inquiry Page | [W] | Live/partial — public form exists, privacy consent present | Public inquiry remains live; Ethan owns the portal entry point. |
| FL-018 | Supplier Quote Form | [W] | Live/partial — supplier can view requests, submit/revise quotes | Quote submission and revision must work end-to-end. |
| FL-019 | Supplier Assignment Confirmation | [W] | Partial — booking section exists, confirmation step present | Three-step handoff step 1 must be functional and scoped. |
| FL-021 | Supplier Readiness Confirmation | [W] | Partial — readiness step exists in bookings | Three-step handoff step 2 must write scoped readiness state. |
| FL-022 | Event Day Status Buttons | [W] | Live/partial — Arrived/Set Up/Done buttons in bookings | Three-step handoff step 3 must be mobile-first. |
| FL-023 | Coordinator Role View | [W] | Partial — role views exist in apps/event | Role-safe views must surface assigned tasks and attendance. |
| FL-024 | Guest Check-In | [W] | Partial — name check-in works, consent present | 3-mode (name/walk-in/QR-gated) must work for name + walk-in. |
| FL-025 | Guest Pass Promotional Demo | [G] | Planned — no implementation | Design spec ready; no frontend obligation until client portal is live. |

---

## 1. FL-001 — Public Inquiry Page

**Current state:** Public inquiry form exists in `apps/client` with privacy consent, duplicate detection, referral fields. PMCM intake queue exists.

**Unfinished for July:**
- Public inquiry is the portal entry point and must remain live and stable
- No new UI work needed if current form passes review
- Verify public → signed-in boundary holds (no dashboard links from public pages)

**July completion:** Accept as existing. Verify, don't rebuild.

**DRI:** Ethan
**Support if needed:** Anthony (API contract verification)
**Dependencies:** None

---

## 2. FL-018 — Supplier Quote Form

**Current state:** Suppliers can view quote requests and submit/revise quotes via the dashboard "requests" and "quotations" sections. Quote submission posts amount, terms, inclusions.

**Unfinished for July:**
- Quote submission and revision must work end-to-end against scoped API
- Supplier confirmation that their quote was received (success state)
- Empty state when no requests exist
- Error handling for failed submission

**July completion:** Working slice. Supplier can submit and revise quotes. PMCM sees result in quote planner.

**DRI:** Ethan
**Support if needed:** Anthony (API contract), Maxine (empty/error state copy)
**Dependencies:** Scoped `POST /api/supplier/quote-requests/:id/submit` and revise endpoint

---

## 3. FL-019 — Supplier Assignment Confirmation

**Current state:** Assignment confirmation step exists in the bookings section (three-step handoff step 1). Supplier clicks to confirm they accept the award.

**Unfinished for July:**
- Confirmation must write audited event state visible to PMCM
- Clear success/error states
- Loading skeleton during submission
- Scoped API contract (no broad sample state writes)

**July completion:** Working slice. Supplier can confirm assignment. PMCM sees state change in readiness board.

**DRI:** Ethan
**Support if needed:** Anthony (scoped API contract)
**Dependencies:** Supplier readiness board API (`PrismSupplierReadinessBoard`)

---

## 4. FL-021 — Supplier Readiness Confirmation

**Current state:** Readiness confirmation step exists in bookings (three-step handoff step 2). Supplier can add notes, upload contract filename, confirm readiness.

**Unfinished for July:**
- Readiness state must write to scoped API, not local fallback
- File upload is metadata-only until upload contract lands
- Clear empty state when no assignment is active
- Status badge reflects DES-01 language (Pending, Confirmed, etc.)

**July completion:** Working slice. Supplier can confirm readiness. PMCM sees readiness state.

**DRI:** Ethan
**Support if needed:** Anthony (API contract), Maxine (state language)
**Dependencies:** Supplier readiness board API

---

## 5. FL-022 — Event Day Status Buttons (Supplier)

**Current state:** Arrived / Set Up / Done buttons exist in bookings section. Supplier clicks to update event-day status.

**Unfinished for July:**
- Mobile-first layout — current implementation assumes desktop
- Large action buttons per DES-01 spec (prominent CTA sizing)
- Status must write to scoped API visible to PMCM live-ops
- Empty state when no active event-day assignment

**July completion:** Working slice, mobile-first. Supplier can update event-day status. PMCM sees result in live-ops dashboard.

**DRI:** Ethan
**Support if needed:** Anthony (API contract), Maxine (mobile layout review)
**Dependencies:** Live-ops API contract, mobile layout pass

---

## 6. FL-023 — Coordinator Role View

**Current state:** Coordinator role views exist in `apps/event` with role-safe access to assigned tasks, attendance marking, urgent issue reporting.

**Unfinished for July:**
- Role views must be clearly role-scoped (floor/stage, registration, ingress/egress, operator, usher)
- Attendance marking (present/late/absent/replaced) must write audited state
- Task completion must update PMCM live-ops
- No access to finance, private supplier reviews, or PMCM audit logs

**July completion:** Working slice. Coordinator can mark attendance, complete tasks, report issues. PMCM sees updates in live-ops and command inbox.

**DRI:** Ethan
**Support if needed:** Anthony (role-safe API contracts), Francis (event app coordination)
**Dependencies:** Coordinator workspace API, role-scoped contracts

---

## 7. FL-024 — Guest Check-In (3-mode)

**Current state:** Name-based check-in with consent and walk-in flagging works in guest dashboard. QR scanning is gated (needs HTTPS, camera permissions, masterlist).

**Unfinished for July:**
- 3-mode UI: name lookup, walk-in flagging, QR (gated placeholders)
- Check-in records must be visible to PMCM (attendance count)
- Feedback submission must enter moderation queue
- Empty state when no event session active
- Single CTA per mode (DES-01 spec)
- No nav on check-in surface (DES-01 spec: no nav for guest)

**July completion:** Working slice (name + walk-in). QR remains gated with placeholder. PMCM sees attendance and feedback in moderation.

**DRI:** Ethan
**Support if needed:** Anthony (API contract), Maxine (single-CTA UX pattern)
**Dependencies:** Guest event pass API, moderation queue API. QR: HTTPS + camera permissions.

---

## 8. FL-025 — Guest Pass Promotional Demo [G]

**Current state:** Planned only. No implementation.

**July completion:** Documented gate. Design spec ready but not implemented. Frontend obligation deferred until client portal is live.

**DRI:** Ethan
**Support if needed:** Maxine (design spec)
**Dependencies:** Client portal live first (FL-011, FL-020 — Francis)

---

## July Completion Summary

| FL | Feature | DRI | July outcome | Sprint target | Blockers |
|---|---|---|---|---|---|
| FL-001 | Public Inquiry Page | Ethan | Accept as existing (verify, don't rebuild) | Sprint 1-2 | None |
| FL-018 | Supplier Quote Form | Ethan | Working slice: submit/revise quotes | Sprint 2-3 | Scoped API contract |
| FL-019 | Supplier Assignment Confirmation | Ethan | Working slice: confirm assignment | Sprint 2-3 | Readiness board API |
| FL-021 | Supplier Readiness Confirmation | Ethan | Working slice: confirm readiness | Sprint 3 | Readiness board API |
| FL-022 | Event Day Status Buttons | Ethan | Working slice: mobile-first status | Sprint 3 | Live-ops API, mobile pass |
| FL-023 | Coordinator Role View | Ethan | Working slice: attendance, tasks, issues | Sprint 3 | Role-safe API contracts |
| FL-024 | Guest Check-In (3-mode) | Ethan | Working slice: name + walk-in; QR gated | Sprint 3 | QR: HTTPS/camera gate |
| FL-025 | Guest Pass Promotional Demo | Ethan | Documented gate; no implementation | — | Client portal live first |

### Support That Must Be Explicitly Requested

Ethan should request support from:
- **Anthony** — scoped API contracts for supplier, guest, and coordinator endpoints before Sprint 3 UI work
- **Maxine** — empty/error state copy, state language badges, mobile layout review for FL-022
- **Francis** — coordination on FL-023 coordinator views that live in `apps/event`

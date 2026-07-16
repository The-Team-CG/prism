# REQ-02: Portal → PMCM Event State Handoffs (Ethan's Surfaces)

**Source:** Agile calendar T04A — cross-app handoff contracts
**Labels:** [W] Working Slice | [G] Documented Gate | [P] Post-July
**Owner:** Ethan (supplier, guest, coordinator portals) + Anthony (API contracts)
**Date:** 2026-06-20

---

## Scope

Only surfaces labelled for Ethan in the REQ-02 feature ledger:
- FL-018 Supplier Quote Form [W]
- FL-019 Supplier Assignment Confirmation [W]
- FL-021 Supplier Readiness Confirmation [W]
- FL-022 Event Day Status Buttons [W] (mobile-first)
- FL-023 Coordinator Role View [W]
- FL-024 Guest Check-In (3-mode) [W]
- FL-025 Guest Pass Promotional Demo [G] (gated: needs client portal live first)

---

## Principle

Every portal action that changes event state must be visible in the PMCM event workspace without the PMCM app reading from a portal database or duplicating portal UI. Data flows through scoped API contracts only. No portal can mutate PMCM-only fields.

---

## 1. Supplier Portal → PMCM

| Action | FL | Source route | API contract | Label | PMCM surface | Notes |
|---|---|---|---|---|---|---|
| Quote submission | FL-018 | `/dashboard` → requests | `POST /api/supplier/quote-requests/:id/submit` | [W] | Quote planner / comparison | Supplier submits amount, terms, inclusions. PMCM sees in quote planner. |
| Quote revision | FL-018 | `/dashboard` → quotations | `POST /api/supplier/quote-requests/:id/revise` | [W] | Quote planner | Supplier revises before lock. PMCM sees version history. |
| Assignment confirmation | FL-019 | `/dashboard` → bookings | `POST /api/supplier/assignments/:id/confirm` | [W] | Readiness board | Three-step handoff step 1. Supplier confirms they accept the award. |
| Readiness confirmation | FL-021 | `/dashboard` → bookings | `POST /api/supplier/assignments/:id/readiness` | [W] | Readiness board | Three-step handoff step 2. Supplier confirms they are ready. |
| Event-day status (Arrived / Set Up / Done) | FL-022 | `/dashboard` → bookings | `POST /api/supplier/assignments/:id/event-status` | [W] | Live-ops dashboard | Three-step handoff step 3. Mobile-first buttons. PMCM sees real-time status. |
| Contract file upload | FL-018 | `/dashboard` → files | `POST /api/supplier/assignments/:id/contract` | [W] | File hub | Metadata-only until upload contract lands. PMCM sees contract reference. |

### Supplier Handoff Rules

- Supplier sees only assigned/application-scoped records. No cross-supplier data leakage.
- PMCM private reviews, tier data, and internal notes never exposed through supplier contracts.
- The three-step handoff (confirm → readiness → event-day) is the canonical supplier-to-PMCM flow. Each step writes audited event state.
- PMCM sees status changes through readiness board and live-ops panels.

---

## 2. Guest Portal → PMCM

| Action | FL | Source route | API contract | Label | PMCM surface | Notes |
|---|---|---|---|---|---|---|
| Event code access | FL-024 | `/open` | `GET /api/guest/events/:accessCode` | [W] | Event workspace | Validates code, returns event pass. PMCM sees access log. |
| Name-based check-in | FL-024 | `/dashboard` → check-in | `POST /api/guest/events/:code/check-ins` | [W] | Live-ops attendance | Writes check-in with consent. PMCM sees attendance count + list. |
| Walk-in flagging | FL-024 | `/dashboard` → check-in | `POST /api/guest/events/:code/check-ins?walkIn=true` | [W] | Live-ops attendance | Same endpoint, walk-in flag. PMCM sees flagged entries. |
| Feedback submission | FL-024 | `/dashboard` → feedback | `POST /api/guest/events/:code/feedback` | [W] | Moderation queue | Consent-required. PMCM moderates before publish. |
| Promotional demo opt-in | FL-025 | `/open` or `/dashboard` | — | [G] | Promo/gate | Gated: needs client portal live first. Design spec ready, no impl. |
| QR check-in | FL-024 | `/dashboard` → check-in | — | [G] | Live-ops attendance | Gated: needs HTTPS + camera permissions + masterlist contract. |

### Guest Handoff Rules

- Guest access is event-code scoped. No cross-event data visibility.
- Consent required for all personal-data writes (check-in, feedback).
- Feedback enters moderation state; PMCM must moderate before publication.
- QR scanning and promotional demo gated until prerequisites met.

---

## 3. Coordinator → PMCM

| Action | FL | Source route | API contract | Label | PMCM surface | Notes |
|---|---|---|---|---|---|---|
| Attendance marking | FL-023 | Coordinator view | `POST /api/coordinators/events/:eventId/attendance` | [W] | Staffing / live-ops | Present / late / absent / replaced. |
| Task completion | FL-023 | Coordinator view | `POST /api/coordinators/events/:eventId/tasks/:taskId/complete` | [W] | Live-ops queue | PMCM sees task state. |
| Urgent issue report | FL-023 | Coordinator view | `POST /api/coordinators/events/:eventId/issues` | [W] | Command inbox | Escalated issue visible to PMCM. |

### Coordinator Handoff Rules

- Role-safe views: each coordinator role sees only assigned tasks.
- No coordinator can read finance, private supplier reviews, PMCM audit logs, or compliance overrides.
- Urgent issues create escalation records in PMCM command inbox.

---

## 4. Ethan's Handoff Summary

| Source app | Actions | Flows into PMCM via | PMCM surface(s) |
|---|---|---|---|
| `apps/supplier` | Quote submit/revise, assignment confirm, readiness, event-day status, contract upload | `POST /api/supplier/*` | Quote planner, readiness board, live-ops, file hub |
| `apps/guest` | Code access, check-in, walk-in, feedback | `POST /api/guest/*` | Event workspace attendance, moderation queue |
| `apps/event` (coordinator views) | Attendance, task completion, urgent issues | `POST /api/coordinators/*` | Live-ops dashboard, command inbox |

### Non-Negotiables

1. No broad `POST /api/sample/state` path for normal portal writes. Every action uses a scoped contract.
2. No portal can overwrite PMCM-only fields. API contracts enforce field-level write permissions.
3. No PMCM surface depends on a portal being online. Event state is authoritative in the API.
4. Every handoff is audited: the API writes an audit record for each state-changing portal action.
5. Gated features ([G]) have design specs ready but no frontend obligation until the dependency is resolved.
6. Post-July features ([P]) have no design or implementation obligation in Sprint 2-4.

### Sprint 2 Cut Line (Ethan's must-work actions)

| Action | Must work by July 3? | Notes |
|---|---|---|
| Supplier quote submit/revise | Yes | FL-018 [W] |
| Supplier assignment confirmation | Yes | FL-019 [W] |
| Supplier readiness confirmation | Yes | FL-021 [W] |
| Supplier event-day status | Yes | FL-022 [W], mobile-first |
| Guest check-in (name-based) | Yes | FL-024 [W], no QR |
| Guest feedback submission | Yes | FL-024 [W], consent-gated |
| Coordinator attendance marking | Yes | FL-023 [W] |
| Coordinator task completion | Yes | FL-023 [W] |
| Coordinator urgent issue report | Yes | FL-023 [W] |
| Guest QR check-in | No | FL-024 [G] |
| Guest promotional demo | No | FL-025 [G] |

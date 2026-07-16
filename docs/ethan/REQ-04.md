# REQ-04: Sprint 3 Portal Surfaces (Ethan)

**Source:** Agile calendar lines 428–437, REQ-03 feature ledger, DES-01 nav/state rules
**Owner:** Ethan
**Date:** 2026-06-20

---

## Ethan's Sprint 3 Surfaces

| Priority | Surface | FL | Current state | Sprint 3 target | Depends on |
|---|---|---|---|---|---|
| 1 | Supplier Readiness Board | FL-021, FL-022 | Partial — readiness step + event-day buttons inside bookings section | Redesign supplier dashboard top section around readiness. Extract readiness + event-day status as a first-class surface. Mobile-first. | Anthony: scoped readiness API. Maxine: mobile layout review. |
| 2 | Guest Access / Check-In | FL-024 | Partial — name check-in works, consent present, QR gated | Redesign `/open` and `/dashboard` around event-code entry, consent, check-in, and moderated feedback. No QR. | Anthony: guest API contracts. Maxine: single-CTA pattern. |
| 3 | Coordinator Role View | FL-023 | Partial — role views exist in `apps/event` | Role-safe attendance, task completion, urgent issues. No finance/supplier/audit data. | Anthony: role-safe contracts. Francis: event app coordination. |
| 4 | Client Event Summary Polish | — | Existing event workspace tabs work | Polish pass on documents/billing/floorplan summary only after supplier + guest flows are stable. Keep official floorplans read-only. | Supplier + guest surfaces done first. |

---

## 1. Supplier Readiness Board

**Current implementation:** Readiness confirmation and event-day status buttons live inside the `bookings` SPA sub-section of the supplier dashboard at `/dashboard`. They are not a dedicated route or surface.

**DES-01 rules that apply:**
- Shell: `public-shell` for readiness view (PDF spec from REQ-01), or `dashboard-shell` if kept signed-in
- Nav: Bottom tab nav — supplier is mobile-first, 3–4 tabs max
- Status language: Pending, Awaiting Your Action, In Progress, Confirmed, Completed, Cancelled
- Large action buttons for event-day status: Arrived / Set Up / Done
- Empty state: "No active assignments. [View Quote Requests]"
- Skeleton screens for loading
- No tables with >5 columns on mobile
- No unlabeled icon-only buttons

### Sprint 3 scope

| Do | Don't |
|---|---|
| Redesign supplier dashboard top section around readiness | Rebuild quote flow (Sprint 2 work) |
| Extract readiness + event-day status as first-class surface | Add real file upload (gate) |
| Mobile-first layout with bottom tab nav | Add supplier application/status tracking (post-July unless scoped as MVP) |
| Status badges using DES-01 language | Add pagination/filter contracts (bounded until Anthony's gate passes) |
| Scaffold the three-step handoff flow (confirm → readiness → event-day) | |
| Empty/error/loading states on every screen | |

### Cross-app handoff (from REQ-02)

| Action | Contract | PMCM sees in |
|---|---|---|
| Readiness confirmation | `POST /api/supplier/assignments/:id/readiness` | Readiness board |
| Event-day status | `POST /api/supplier/assignments/:id/event-status` | Live-ops dashboard |

---

## 2. Guest Access / Check-In

**Current implementation:** Code entry at `/open` (two-step flow: name + code → validate → redirect). Check-in and feedback are scroll-to sections on the `/dashboard` page. Uses `PrismDashboardShell` with full sidebar nav.

**DES-01 rules that apply:**
- Shell: `public-shell` — link-based, no login
- Nav: **No nav at all** — guest surfaces are link-based, single-task pages
- Single CTA per mode: name lookup, walk-in flagging, QR (gated placeholder)
- Status language: Pending, Confirmed, Completed
- Empty state: "No active event session. [Enter Event Code]"
- Skeleton screens for loading
- No modals that open from inside other modals
- No horizontal scroll on mobile

### Sprint 3 scope

| Do | Don't |
|---|---|
| Redesign `/open` as focused code-entry surface | Implement QR scanning (gate: HTTPS/camera) |
| Redesign check-in as nav-free single-CTA surface | Add media upload (gate) |
| Keep `/dashboard` for event info + feedback only, or merge into check-in | Add promotional demo (gate: FL-025) |
| 3-mode UI: name lookup, walk-in flagging, QR placeholder | Add masterlist reconciliation (post-July) |
| Feedback → moderation queue | |
| Empty/error/loading states on every screen | |

### Cross-app handoff (from REQ-02)

| Action | Contract | PMCM sees in |
|---|---|---|
| Code access | `GET /api/guest/events/:accessCode` | Event workspace access log |
| Name check-in | `POST /api/guest/events/:code/check-ins` | Live-ops attendance |
| Walk-in flagging | `POST /api/guest/events/:code/check-ins?walkIn=true` | Live-ops attendance |
| Feedback | `POST /api/guest/events/:code/feedback` | Moderation queue |

---

## 3. Coordinator Role View

**Current implementation:** Role views exist in `apps/event` with role-safe access. Attendance, task completion, urgent issue reporting are wired.

**DES-01 rules that apply:**
- Shell: `app-shell` — signed-in internal
- Nav: Bottom tab nav — coordinator is mobile-first, 3–4 tabs max
- Status language: Pending, In Progress, Confirmed, Completed, Escalated
- Empty state per role view
- No color as sole status indicator
- No unlabeled icon-only buttons

### Sprint 3 scope

| Do | Don't |
|---|---|
| Verify each role view is scoped (floor/stage, registration, ingress/egress, operator, usher) | Expose finance, supplier reviews, audit logs |
| Surface assigned tasks with status badges | Add AI copilot (gate: post-July) |
| Attendance marking (present/late/absent/replaced) | Add staffing heatmap (post-July unless data ready) |
| Urgent issue reporting with escalation | |
| Empty/error/loading states per role | |

### Cross-app handoff (from REQ-02)

| Action | Contract | PMCM sees in |
|---|---|---|
| Attendance | `POST /api/coordinators/events/:eventId/attendance` | Staffing / live-ops |
| Task complete | `POST /api/coordinators/events/:eventId/tasks/:taskId/complete` | Live-ops queue |
| Issue report | `POST /api/coordinators/events/:eventId/issues` | Command inbox |

---

## 4. Client Event Summary Polish (Secondary)

**Current implementation:** Event workspace tabs exist in `apps/client` for documents, billing, and floorplan. They read scoped data but are not redesigned.

**DES-01 rules that apply:**
- Shell: `app-shell` — signed-in internal
- Nav: Top header + section nav (Client portal pattern)
- Official floorplans read-only
- File Requirements Matrix visibility

### Sprint 3 scope

| Do | Don't |
|---|---|
| Add DES-01 status language to documents/billing/floorplan sections | Rebuild event workspace from scratch |
| Polish empty/error/loading states | Add real file upload (gate) |
| Use File Requirements Matrix contract where available | Mutate official floorplans |
| Keep sidebar for now (full shell replacement is Sprint 3+ per DES-01 Option 3) | |

**Only start after** supplier readiness + guest check-in + coordinator views are stable.

---

## Sprint 3 Sequencing

```
Week 1 (July 6–10)          Week 2 (July 11–17)
┌────────────────────┐      ┌────────────────────┐
│ Supplier Readiness  │ ──→  │ Guest Access/       │
│ Board (extract +    │      │ Check-In (redesign  │
│ mobile-first)       │      │ /open + /dashboard) │
└────────────────────┘      └────────────────────┘
         │                           │
         ▼                           ▼
┌────────────────────┐      ┌────────────────────┐
│ Coordinator Views  │      │ Client Summary      │
│ (role-safe polish) │      │ Polish (if time)    │
└────────────────────┘      └────────────────────┘
```

Supplier readiness and coordinator views can run partially in parallel since they touch different apps. Guest check-in follows once supplier flow is stable. Client polish is last and only if time permits.

## Verification

```bash
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/supplier run typecheck
npm --workspace @prism/guest run typecheck
npm --workspace @prism/client run typecheck
npm --workspace @prism/event run typecheck
npm run check:boundaries
```

Manual checks:
- Supplier sees only assigned/application-scoped records
- Guest access is event-code scoped, no cross-event reads
- Coordinator views expose no finance, supplier reviews, or audit logs
- Client official floorplans remain read-only
- All surfaces use DES-01 status language, skeleton screens, empty states
- No banned visual patterns on any Sprint 3 surface

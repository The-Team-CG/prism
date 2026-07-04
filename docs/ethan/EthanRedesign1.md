# EthanRedesign1 — Implementation Plan

**Owner:** Ethan (Owner C) — External portals: narrow, safe, mobile-ready action surfaces.
**Date:** 2026-06-22
**Source documents:**
- `docs/ethan/DES-01.md` — Sprint 2 Client Action Center options analysis
- `docs/ethan/REQ-01.md` — Redesign inventory review (Supplier Readiness + Guest Check-In)
- `docs/ethan/REQ-02.md` — Portal → PMCM event state handoff contracts
- `docs/ethan/REQ-03.md` — Unfinished portal features, July completion path
- `docs/ethan/REQ-04.md` — Sprint 3 portal surfaces
- `docs/ethan/MS-01.md` — Portal acceptance gates

---

## 1. Ownership Boundaries

Per REQ-01 ownership handoff, Ethan owns **Supplier + Guest + Coordinator** surfaces. Client surfaces (including the Client Action Center from DES-01 Option 1) belong to Francis.

| Surface | App | Owner | Sprint |
|---|---|---|---|
| Supplier Quote Form (FL-018) | `apps/supplier` | Ethan | 2 |
| Supplier Assignment Confirmation (FL-019) | `apps/supplier` | Ethan | 2 |
| Supplier Readiness Board (FL-021) | `apps/supplier` | Ethan | 3 |
| Event Day Status Buttons (FL-022) | `apps/supplier` | Ethan | 3 |
| Coordinator Role View (FL-023) | `apps/event` | Ethan | 3 |
| Guest Check-In (FL-024) | `apps/guest` | Ethan | 3 |
| Guest Pass Promo Demo (FL-025) | `apps/guest` | Ethan | Gated |
| Public Inquiry Page (FL-001) | `apps/client` | Ethan | Accept as-is |
| Client Event Summary Polish | `apps/client` | Ethan | 3 (if time) |

---

## 2. Design Direction (per DES-01)

DES-01 recommended **Option 1 (Dashboard Home → Client Action Center)** for the client portal. Since client surfaces now belong to Francis, Ethan adopts the **DES-01 patterns and rules** for his own surfaces:

**Shell assignments:**
- **Supplier readiness view:** `public-shell` (mobile-first, bottom tab nav, 3–4 tabs max)
- **Guest check-in:** `public-shell` (link-based, no login, no nav at all — single-task pages)
- **Coordinator views:** `app-shell` (signed-in internal, bottom tab nav, 3–4 tabs max)

**State language (all surfaces):** Pending, Awaiting Your Action, In Progress, Confirmed, Completed, Cancelled, Locked, Escalated

**Loading states:** Skeleton screens on all content areas. Spinners on CTA buttons only.

**Empty states:** Every list/table/data region must show a message + single suggested action. Never a blank box.

**Error states:** Show what went wrong + what the user can do next. Never raw error codes.

**Banned patterns (all surfaces):**
- No active underline in nav
- No decorative eyebrow pills, rounded outline labels, or uppercase badges
- No profile/avatar block in sidebars when top bar already has account menu
- No tables with >5 columns on mobile
- No nested modals
- No inline editing on list rows
- No unlabeled icon-only buttons
- No color as sole status indicator
- No horizontal scroll on mobile

---

## 3. Sprint 2 (July 3 Cut Line) — Must-Work Actions

Per REQ-02 and REQ-03, these actions must be functional by July 3:

| Priority | Surface | FL | July outcome | Dependencies |
|---|---|---|---|---|
| 1 | Supplier Quote Form | FL-018 | Submit/revise quotes end-to-end. Success state after submission. Empty state when no requests. Error handling for failures. | Anthony: scoped `POST /api/supplier/quote-requests/:id/submit` and revise endpoint |
| 2 | Supplier Assignment Confirmation | FL-019 | Three-step handoff step 1 works. Audited event state visible to PMCM. Loading skeleton. | Anthony: scoped API contract, readiness board API |
| 3 | Supplier Readiness Confirmation | FL-021 | Three-step handoff step 2 works. Writes scoped readiness state. File upload is metadata-only. Status badges use DES-01 language. | Anthony: readiness board API |
| 4 | Event Day Status Buttons | FL-022 | Three-step handoff step 3 works. Arrived / Set Up / Done buttons. Mobile-first layout. Large CTA sizing. | Anthony: live-ops API, Maxine: mobile layout review |
| 5 | Guest Check-In (name-based) | FL-024 | Name-based check-in with consent. Walk-in flagging. Feedback → moderation queue. | Anthony: guest API contracts |
| 6 | Coordinator Role View | FL-023 | Role-scoped views. Attendance marking (present/late/absent/replaced). Task completion. Urgent issue reporting. | Anthony: role-safe contracts, Francis: event app coordination |
| 7 | Public Inquiry Page | FL-001 | Accept as existing. Verify public → signed-in boundary holds. | None |

**Sprint 2 implementation order:**
1. Supplier quote submit/revise (FL-018)
2. Supplier assignment confirmation (FL-019)
3. Guest name-based check-in + feedback (FL-024)
4. Coordinator attendance + tasks + issues (FL-023)
5. Supplier readiness (FL-021) + event-day status (FL-022)

**Sprint 2 Don'ts:**
- Don't implement QR scanning (gated: HTTPS, camera permissions, masterlist contract)
- Don't implement promotional demo (gated: client portal live first)
- Don't extract readiness to a dedicated route (that's Sprint 3)
- Don't add real file upload (metadata-only until upload contract lands)
- Don't rebuild the entire dashboard shell

---

## 4. Sprint 3 (July 6–17) — Surface Extraction & Mobile-First

Per REQ-04, Sprint 3 focuses on extracting readiness, check-in, and coordinator views as first-class DES-01 surfaces.

**Sequencing:**

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

### 4.1 Supplier Readiness Board

**Current:** Readiness + event-day status buttons inside `bookings` SPA sub-section. Not a dedicated route.

**Target:**
- Redesign supplier dashboard top section around readiness
- Extract readiness + event-day status as first-class surface
- Mobile-first layout with bottom tab nav
- Scaffold three-step handoff: confirm → readiness → event-day
- Status badges with DES-01 language
- Empty state: "No active assignments. [View Quote Requests]"
- Skeleton screens for loading

**Do not:** Rebuild quote flow (Sprint 2), add real file upload (gate), add pagination/filter contracts

**API contracts:**
- `POST /api/supplier/assignments/:id/readiness` → Readiness board
- `POST /api/supplier/assignments/:id/event-status` → Live-ops dashboard

### 4.2 Guest Access / Check-In

**Current:** Code entry at `/open` (name + code → validate → redirect). Check-in/feedback are scroll-to sections on `/dashboard`. Uses `PrismDashboardShell` with sidebar.

**Target:**
- Redesign `/open` as focused code-entry surface
- Redesign check-in as nav-free, single-CTA surface
- Merge `/dashboard` into check-in or keep for event info only
- 3-mode UI: name lookup, walk-in flagging, QR placeholder (gated)
- Feedback → moderation queue
- No nav at all — single-task pages per `public-shell`
- Empty state: "No active event session. [Enter Event Code]"

**Do not:** Implement QR scanning (gate), add media upload (gate), add promotional demo (gate: FL-025)

**API contracts:**
- `GET /api/guest/events/:accessCode` → Event workspace access log
- `POST /api/guest/events/:code/check-ins` → Live-ops attendance
- `POST /api/guest/events/:code/check-ins?walkIn=true` → Live-ops attendance
- `POST /api/guest/events/:code/feedback` → Moderation queue

### 4.3 Coordinator Role View

**Current:** Role views exist in `apps/event`. Attendance, tasks, issues are wired.

**Target:**
- Verify each role is scoped (floor/stage, registration, ingress/egress, operator, usher)
- Surface assigned tasks with status badges
- Attendance marking (present/late/absent/replaced)
- Urgent issue reporting with escalation
- Role-safe: no finance, supplier reviews, or audit logs
- Bottom tab nav, mobile-first

**Do not:** Expose finance/supplier/audit data, add AI copilot (gate: post-July), add staffing heatmap

**API contracts:**
- `POST /api/coordinators/events/:eventId/attendance` → Staffing / live-ops
- `POST /api/coordinators/events/:eventId/tasks/:taskId/complete` → Live-ops queue
- `POST /api/coordinators/events/:eventId/issues` → Command inbox

### 4.4 Client Event Summary Polish (Secondary)

**When:** Only after supplier + guest + coordinator surfaces are stable.

**Scope:**
- Add DES-01 status language to documents/billing/floorplan sections
- Polish empty/error/loading states
- Use File Requirements Matrix contract where available
- Keep sidebar (shell replacement is Sprint 3+ per DES-01 Option 3)
- Official floorplans remain read-only

**Do not:** Rebuild event workspace, add real file upload (gate), mutate official floorplans

---

## 5. Cross-Cutting Concerns

### 5.1 Shell Migration

Both current implementations (supplier dashboard, guest dashboard) use `PrismDashboardShell`. The PDF spec calls for `public-shell` (no nav or minimal nav):

| Surface | Current shell | Target shell | Sprint |
|---|---|---|---|
| Supplier readiness | `PrismDashboardShell` | `public-shell` (bottom tab nav) | 3 |
| Guest check-in | `PrismDashboardShell` | `public-shell` (no nav) | 3 |
| Coordinator views | `app-shell` | `app-shell` (bottom tab nav) | 3 |

### 5.2 Missing Route Infrastructure

Per REQ-01 C2, neither `apps/supplier` nor `apps/guest` has `loading.tsx`, `error.tsx`, or `not-found.tsx` files. These must be added as a first pass before Sprint 3 extraction work.

### 5.3 Typed Contracts

Per REQ-01 C3, both apps reach directly into API endpoints without typed route contracts from `packages/types`. Ethan must coordinate with Anthony (Owner D) on typed contracts for:
- Supplier readiness board
- Guest event pass
- Coordinator role-safe endpoints

### 5.4 Cross-App Handoff Rules (from REQ-02)

1. No broad `POST /api/sample/state` for normal portal writes. Every action uses a scoped contract.
2. No portal can overwrite PMCM-only fields. API contracts enforce field-level write permissions.
3. No PMCM surface depends on a portal being online. Event state is authoritative in the API.
4. Every handoff is audited: the API writes an audit record for each state-changing portal action.
5. Gated features ([G]) have design specs ready but no frontend obligation until the dependency is resolved.

---

## 6. Dependencies

| Dependency | Owner | Needed for | Timeline |
|---|---|---|---|
| Scoped supplier API contracts | Anthony (Owner D) | FL-018, FL-019, FL-021, FL-022 | Sprint 2 start |
| Scoped guest API contracts | Anthony (Owner D) | FL-024 | Sprint 2 start |
| Role-safe coordinator contracts | Anthony (Owner D) | FL-023 | Sprint 3 start |
| Empty/error state copy, state language | Maxine (Owner A) | All surfaces | Sprint 2–3 |
| Mobile layout review (FL-022) | Maxine (Owner A) | Supplier event-day buttons | Sprint 3 |
| Event app coordination for coordinator views | Francis (Owner B) | FL-023 | Sprint 3 |
| HTTPS + camera permissions (QR gate) | Infrastructure | FL-024 QR mode | Post-July |
| Client portal live (promo demo gate) | Francis | FL-025 | Post-July |

---

## 7. Verification & Acceptance

### Per-Surface Verification

Every portal surface must pass MS-01 boundary checks before marking Sprint-complete:

| Check | How to test |
|---|---|
| Assigned-scope only (supplier) | Log in as supplier A; confirm no data from supplier B |
| No cross-supplier data | Check quote detail — must reject if not owned |
| No PMCM private data | Inspect API response bodies for `internal`, `private`, `rating`, `audit` fields |
| Event-code scoped (guest) | Enter code for event A; confirm no references to event B |
| No cross-event navigation (guest) | No "switch event" UI; only "Leave" → `/open` |
| Consent required (guest) | Check-in/feedback fails without `consent: true` |
| Feedback moderated | POST response includes moderation-pending status |
| No account persistence (guest) | Close browser, reopen — redirect to `/open` |
| Conforme-gated | No dashboard access without signed conforme |
| Approval authority enforced | Non-primary-contact user cannot submit approvals |
| Read-only official floorplans | No canvas/editor UI in client portal for official layouts |

### Common Acceptance Gates

| Gate | Enforcement |
|---|---|
| No broad sample state | `npm run check:boundaries` must pass |
| No magic storage keys | Session keys import from `@prism/types`, not literal `prism:*` |
| No cross-app imports | Portal apps must not import from other portal apps |
| DES-01 state language | Status badges use only approved language |
| DES-01 loading states | Skeleton screens on content; spinners on CTA buttons only |
| DES-01 empty states | Every region shows message + single action |
| DES-01 error states | Shows what went wrong + what to do next |
| DES-01 banned patterns | No violations on any Sprint surface |

### Verification Commands

```bash
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/supplier run typecheck
npm --workspace @prism/guest run typecheck
npm --workspace @prism/client run typecheck
npm --workspace @prism/event run typecheck
npm run check:boundaries
node --test scripts\check-prism-boundaries.test.mjs
```

Plus manual forbidden-access tests for each portal using sample accounts of the wrong role.

---

## 8. Summary Roadmap

| Sprint | Focus | Deliverables |
|---|---|---|
| Sprint 2 (June 22–July 3) | Working slices | FL-018 (quote), FL-019 (assignment), FL-024 (name check-in), FL-023 (coordinator basics), FL-021/FL-022 (readiness + status) |
| Sprint 3 (July 6–17) | Extraction + mobile-first | Supplier Readiness Board (dedicated route, mobile-first), Guest Check-In (nav-free, single-CTA), Coordinator views (role-safe polish), Client polish (if time) |
| Post-July | Gated features | QR check-in (HTTPS/camera gate), Promo demo (client portal gate), Real file upload (upload contract gate) |

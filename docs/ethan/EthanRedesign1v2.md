# EthanRedesign1v2 — Implementation Plan

**Owner:** Ethan (Owner C) — External portals: narrow, safe, mobile-ready action surfaces.
**Date:** 2026-07-04
**Supersedes:** `docs/ethan/EthanRedesign1.md` (2026-06-22)
**Source documents:**
- `docs/ethan/DES-01.md` — Sprint 2 Client Action Center options analysis
- `docs/ethan/DES-04.md` — Sprint 2 UX brief: shell patterns, density rules, page titles, action hierarchy, state language
- `docs/ethan/REQ-01.md` — Redesign inventory review (Supplier Readiness + Guest Check-In)
- `docs/ethan/REQ-02.md` — Portal → PMCM event state handoff contracts
- `docs/ethan/REQ-03.md` — Unfinished portal features, July completion path
- `docs/ethan/REQ-04.md` — Sprint 3 portal surfaces
- `docs/ethan/MS-01.md` — Portal acceptance gates
- `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md` — Whole-system completion sprint calendar (T08, T11, T12, T23, T17)
- `docs/superpowers/plans/2026-06-20-prism-system-completion-review.md` — Confidence gate audit and P0 supplier/guest evidence gate

---

## 1. Ownership Boundaries

Ethan owns all external portal surfaces: **Client, Supplier, Guest, and Coordinator** surfaces. Per the governing documents — the feature ledger (FL-004, FL-020), the agile calendar (T08), and the redesign inventory — the Client Action Center and client portal belong to Ethan, not Francis. The REQ-01 PDF reassignment discussion was not adopted in the authoritative plans.

| Surface | App | Sprint | Notes |
|---|---|---|---|
| Client Action Center (FL-020) | `apps/client` | 2 | Replace generic dashboard with next-action hierarchy. |
| Client Event Summary Polish | `apps/client` | 3 (if time) | Only after supplier + guest evidence gates pass per completion review P0. |
| Supplier Quote Form (FL-018) | `apps/supplier` | 2 | |
| Supplier Assignment Confirmation (FL-019) | `apps/supplier` | 2 | |
| Supplier Readiness Board (FL-022) | `apps/supplier` | 3 | |
| Event Day Status Buttons (FL-022) | `apps/supplier` | 3 | |
| Coordinator Role View (FL-023) | `apps/event` | 3 | |
| Guest Check-In (FL-012) | `apps/guest` | 2 | |
| Guest Pass Promo Demo (FL-025) | `apps/guest` | Gated | |
| Public Inquiry Page (FL-001) | `apps/client` | Accept as-is | |

---

## 2. Design Direction (per DES-01 and DES-04)

### Shell Assignments (per DES-04 Section 1)

| Surface | DES-04 shell | Nav pattern | Notes |
|---|---|---|---|
| Client dashboard / Action Center | Client Portal | Top nav, minimal | No sidebar; client never sees internal structure. |
| Supplier readiness view | Public-shell | Top nav, minimal | Mobile-first; event day view hides nav entirely. |
| Guest check-in | Public-shell | No nav | Link-based, no login, single-task pages. |
| Coordinator views | App-shell | Top nav, minimal | Mobile-first; event day view hides nav entirely. |

### Density Rules (per DES-04 Section 2)

- **Client Portal (lean):** Cards are default for list data. Max 10 items before pagination. Tables only in payment milestones and document submission. No metric tiles.
- **Supplier Portal (lean, mobile-first):** Event day = full screen status buttons only. Pre-event = single-column card list. No tables.
- **Coordinator Portal (lean, mobile-first):** Role-specific task list with toggle actions. Urgent Issue button always visible. No tables except guest masterlist for Registration Staff.

### Page Title Rules (per DES-04 Section 3)

Every authenticated page has exactly one `<PageTitle>`. Format: `[Section Name] · [Context Name]`. No subtitle below the H1 unless it is a status badge. Breadcrumb only on PMCM Admin pages 3+ levels deep.

### Action Hierarchy (per DES-04 Section 4)

Every page has at most **one primary action** (filled button, brand color). Secondary actions use outlined buttons. Tertiary is text/ghost. Destructive actions are red/danger with confirmation + typed reason. The only permitted FAB is Urgent Issue on coordinator/EVTAPP event-day views.

### State Language (per DES-04 Section 5)

Use only the approved DES-04 state strings:
- **Loading:** `Loading [content type]…`
- **Empty:** `No [content type] yet.` + next action instruction
- **Empty (filtered):** `No results for "[filter value]".` + try different filters
- **Error (system):** `Something went wrong.` + refresh/contact admin
- **Error (validation):** `[Field name] is required.` inline below field
- **No permission:** `You don't have access to this section.` + contact PMCM Admin
- **Success:** Bottom-center toast, auto-dismiss 4s, no exclamation marks

### Banned Patterns (all surfaces, per DES-04 and AGENTS.md)
- No active underline in nav
- No decorative eyebrow pills, rounded outline labels, or uppercase badges
- No profile/avatar block in sidebars when top bar already has account menu
- No tables with >5 columns on mobile
- No nested modals
- No inline editing on list rows
- No unlabeled icon-only buttons
- No color as sole status indicator
- No horizontal scroll on mobile
- No FABs except Urgent Issue on coordinator/EVTAPP views

---

## 3. Sprint 2 (June 22–July 3 Cut Line) — Must-Work Actions

Per the agile calendar (T08, T11, T12) and the completion review P0 gate, Sprint 2 priorities are reordered. The Client Action Center (T08) is the primary Sprint 2 deliverable, per the owner capacity rule (one primary build surface per sprint). Supplier and guest slices are secondary Sprint 2 surfaces that must not block the Client Action Center.

| Priority | Surface | FL | July outcome | Dependencies |
|---|---|---|---|---|
| 1 | Client Action Center | FL-020 | Replace generic dashboard with next-action hierarchy. Remove or label broad fallback. Public/signed-in boundary verified. Official floorplans read-only. | Anthony: scoped API contracts |
| 2 | Supplier Quote Form | FL-018 | Submit/revise quotes end-to-end. Success state after submission. Empty state when no requests. Error handling for failures. | Anthony: `POST /api/supplier/quote-requests/:id/submit` and revise endpoint |
| 3 | Supplier Assignment Confirmation | FL-019 | Three-step handoff step 1 works. Audited event state visible to PMCM. Loading skeleton. | Anthony: scoped API contract, readiness board API |
| 4 | Guest Check-In (name-based) | FL-012 | Name-based check-in with consent. Walk-in flagging. Feedback → moderation queue. No QR scanning (gated). | Anthony: guest API contracts |
| 5 | Supplier Readiness Confirmation | FL-021 | Three-step handoff step 2 works. Writes scoped readiness state. File upload is metadata-only. Status badges use DES-04 language. | Anthony: readiness board API |
| 6 | Event Day Status Buttons | FL-022 | Three-step handoff step 3 works. Arrived / Set Up / Done buttons. Mobile-first layout. Large CTA sizing. | Anthony: live-ops API, Maxine: mobile layout review |
| 7 | Coordinator Role View | FL-023 | Role-scoped views. Attendance marking (present/late/absent/replaced). Task completion. Urgent issue reporting. | Anthony: role-safe contracts, Francis: event app coordination |
| 8 | Public Inquiry Page | FL-001 | Accept as existing. Verify public → signed-in boundary holds. | None |

**Sprint 2 Don'ts:**
- Don't implement QR scanning (gated: HTTPS, camera permissions, masterlist contract)
- Don't implement promotional demo (gated: client portal live first)
- Don't extract readiness to a dedicated route (that's Sprint 3)
- Don't add real file upload (metadata-only until upload contract lands)
- Don't rebuild the entire dashboard shell
- Don't add broad sample-state reads or new literal `prism:*` storage keys (per operating rules)
- Don't build generalized data grids, infinite scroll, complex filters, or upload managers (per UI-enabling API contract gate)

---

## 4. Sprint 3 (July 6–17) — Surface Extraction & Mobile-First

Per REQ-04 and the agile calendar (T11, T12), Sprint 3 focuses on extracting readiness, check-in, and coordinator views as first-class DES-04 surfaces.

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
- Status badges with DES-04 language
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
- Redesign check-in as nav-free, single-CTA surface (per DES-04 public-shell, no nav)
- Merge `/dashboard` into check-in or keep for event info only
- 3-mode UI: name lookup, walk-in flagging, QR placeholder (gated)
- Feedback → moderation queue
- No nav at all — single-task pages per public-shell
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
- Urgent issue reporting with escalation (the only permitted FAB)
- Role-safe: no finance, supplier reviews, or audit logs
- Bottom tab nav, mobile-first

**Do not:** Expose finance/supplier/audit data, add AI copilot (gate: post-July), add staffing heatmap

**API contracts:**
- `POST /api/coordinators/events/:eventId/attendance` → Staffing / live-ops
- `POST /api/coordinators/events/:eventId/tasks/:taskId/complete` → Live-ops queue
- `POST /api/coordinators/events/:eventId/issues` → Command inbox

### 4.4 Client Event Summary Polish (Secondary)

**When:** Only after supplier + guest route evidence gates pass (per system completion review P0).

**Scope:**
- Add DES-04 status language to documents/billing/floorplan sections
- Polish empty/error/loading states
- Use File Requirements Matrix contract where available
- Keep sidebar (shell replacement is Sprint 3+ per DES-01 Option 3)
- Official floorplans remain read-only

**Do not:** Rebuild event workspace, add real file upload (gate), mutate official floorplans

---

## 5. Cross-Cutting Concerns

### 5.1 Shell Migration

Both current implementations (supplier dashboard, guest dashboard) use `PrismDashboardShell`. The DES-04 spec calls for different shell patterns:

| Surface | Current shell | DES-04 target shell | Sprint |
|---|---|---|---|
| Client Action Center | `PrismDashboardShell` | Client Portal (top nav, minimal) | 2–3 |
| Supplier readiness | `PrismDashboardShell` | Public-shell (top nav, minimal) | 3 |
| Guest check-in | `PrismDashboardShell` | Public-shell (no nav) | 3 |
| Coordinator views | App-shell | App-shell (top nav, minimal) | 3 |

### 5.2 Owner Capacity Rule (per Agile Calendar)

Each owner may carry one primary build surface per sprint plus one review/support lane. Sprint 2 primary: Client Action Center. Sprint 3: Supplier Readiness Board or Guest Check-In (chosen at Sprint 3 start). Do not split focus across two full builds in the same sprint.

### 5.3 UI-Enabling API Contract Gate (per Agile Calendar)

Frontend implementation must stay inside bounded work queues, dashboard panels, known-small arrays, simple client-side filters, and metadata-style upload flows. Do not build generalized data grids, infinite scroll, complex saved filters, upload managers, retrying multipart flows, or bulk action consoles until the matching contracts are complete.

### 5.4 Missing Route Infrastructure

Per REQ-01 C2, neither `apps/supplier` nor `apps/guest` has `loading.tsx`, `error.tsx`, or `not-found.tsx` files. These must be added as a first pass before Sprint 3 extraction work. `apps/client` should also be verified.

### 5.5 Typed Contracts

Per REQ-01 C3, portal apps reach directly into API endpoints without typed route contracts from `packages/types`. Ethan must coordinate with Anthony (Owner D) on typed contracts for:
- Client Action Center
- Supplier readiness board
- Guest event pass
- Coordinator role-safe endpoints

### 5.6 Cross-App Handoff Rules (from REQ-02)

1. No broad `POST /api/sample/state` for normal portal writes. Every action uses a scoped contract.
2. No portal can overwrite PMCM-only fields. API contracts enforce field-level write permissions.
3. No PMCM surface depends on a portal being online. Event state is authoritative in the API.
4. Every handoff is audited: the API writes an audit record for each state-changing portal action.
5. Gated features ([G]) have design specs ready but no frontend obligation until the dependency is resolved.

---

## 6. Dependencies

| Dependency | Owner | Needed for | Timeline |
|---|---|---|---|
| Scoped client API contracts | Anthony (Owner D) | FL-020 | Sprint 2 start |
| Scoped supplier API contracts | Anthony (Owner D) | FL-018, FL-019, FL-021, FL-022 | Sprint 2 start |
| Scoped guest API contracts | Anthony (Owner D) | FL-012 | Sprint 2 start |
| Role-safe coordinator contracts | Anthony (Owner D) | FL-023 | Sprint 3 start |
| Empty/error state copy, state language | Maxine (Owner A) | All surfaces | Sprint 2–3 |
| Mobile layout review (FL-022) | Maxine (Owner A) | Supplier event-day buttons | Sprint 3 |
| Event app coordination for coordinator views | Francis (Owner B) | FL-023 | Sprint 3 |
| HTTPS + camera permissions (QR gate) | Infrastructure | FL-012 QR mode | Post-July |
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
| DES-04 state language | Status badges use only approved language from DES-04 Section 5 |
| DES-04 loading states | Skeleton screens on content; spinners on CTA buttons only |
| DES-04 empty states | Every region shows message + single action |
| DES-04 error states | Shows what went wrong + what to do next |
| DES-04 density rules | Tables vs cards per portal type; no violations on mobile |
| DES-04 page title rules | Every page has `[Section] · [Context]` H1 |
| DES-04 action hierarchy | At most one primary action per page |
| DES-04 banned patterns | No violations on any Sprint surface |

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

### Evidence Rule (per Agile Calendar)

A task is not complete unless its evidence names at least one of: typecheck, focused test, boundary check, route smoke check, screenshot, or documentation gate. "Reviewed" without evidence does not close a task.

---

## 8. Summary Roadmap

| Sprint | Focus | Deliverables |
|---|---|---|
| Sprint 2 (June 22–July 3) | First-slice delivery | FL-020 (Client Action Center), FL-018 (quote), FL-019 (assignment), FL-012 (name check-in), FL-023 (coordinator basics), FL-021/FL-022 (readiness + status) |
| Sprint 3 (July 6–17) | Extraction + mobile-first | Supplier Readiness Board (dedicated route, mobile-first), Guest Check-In (nav-free, single-CTA), Coordinator views (role-safe polish), Client polish (if time, after supplier/guest evidence gate passes) |
| Post-July | Gated features | QR check-in (HTTPS/camera gate), Promo demo (client portal gate), Real file upload (upload contract gate) |

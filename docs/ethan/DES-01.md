# DES-01: Sprint 2 Client Action Center — Options Analysis

**Source:** DES-01 design spec (shell types, nav rules, state language, loading/empty/error states, banned patterns)
**Reference:** Agile calendar `T08` / `FL-020` — "Ship the Client Action Center thin slice"
**Owner:** Ethan
**Date:** 2026-06-20

---

## The Assignment

> Choose one thin Sprint 2 portal surface: client action center shell with safe event status and next actions.

Per the agile calendar (line 358–365), Sprint 2 Ethan deliverables are:

- Prioritize `PrismClientActionCenter` action cards over broad workspace-derived cards
- Implement FL-020 with conforme, briefing/proposal, file, billing, floorplan preference, and next-action status cards where contracts exist
- Keep file behavior metadata-first until upload contracts are ready
- Redesign the top section around one primary job: *"what needs my attention next"*
- Official floorplans remain read-only; client input is preferences/comments only
- Verify `/`, `/inquiry`, `/sign-in`, `/dashboard` public-to-signed-in boundary

DES-01 rules that apply:
- **Shell**: Client uses `app-shell` (signed-in internal)
- **Nav**: Top header + section nav (not sidebar — sidebar is PMCM-only)
- **State language**: Pending, Awaiting Your Action, In Progress, Confirmed, Completed, Cancelled, Locked, Escalated
- **No active underline** in nav
- **No decorative eyebrow pills, rounded outline labels, or uppercase badges**
- **Skeleton screens** for loading (spinners only on CTA buttons)
- **Empty state** always has message + single suggested action
- **No unlabeled icon-only buttons**, **no color as sole status indicator**

---

## Option 1: Dashboard Home → Client Action Center (Recommended)

**Scope:** Replace the `/dashboard` home page with a focused Client Action Center surface. The rest of the dashboard (events, billing, files, etc.) stays as-is for Sprint 2.

### What changes

| Current | Target |
|---|---|
| Hero with greeting + 3 generic stat cards | "What needs my attention next" — priority-ranked action cards from `PrismClientActionCenter` |
| Event card grid (max 3) + recent notifications | Action queue with status badges, due dates, event context |
| Derived action fallback | Contract-first actions; remove fallback derivation |
| `PrismDashboardShell` with sidebar nav | `app-shell` with top header + section nav per DES-01 |
| `NoticeBanner` inline | DES-01 compliant banners locked/error states |

### What stays the same

- All `/dashboard/events/*`, `/dashboard/billing/*`, `/dashboard/files/*`, etc. routes
- Event workspace tabs (overview, briefing, billing, documents, floorplan, messages)
- Editor shell for floorplan editing

### Effort: Medium

- New `<ClientActionCenterShell>` component wrapping `PrismAppShell` with top nav
- Refactor `renderHomePage()` into action-queue-first layout
- Add status badges using DES-01 language
- Add loading/empty/error states per spec
- Likely ~1 week for one developer

### Risks

- `Dashboard.tsx` is 2680 lines — extracting the home section cleanly requires careful boundaries
- The sidebar currently holds event filtering/context that top nav must absorb
- Action center contract may not yet cover all action kinds for every event state

---

## Option 2: Event Workspace Summary Action Center

**Scope:** Redesign the event overview tab (`/dashboard/events/[eventId]/overview`) as an action center for a single event.

### What changes

| Current | Target |
|---|---|
| Lifecycle steps strip + stats row | Event-level action queue: "what needs your attention on this event" |
| Event details card + floorplan checkpoint + payment card | Action cards from `PrismClientActionCenter` filtered to this eventId |
| Event-level section nav tab bar | Top header + section nav per DES-01 |

### Effort: Medium-Low

- Refactor `ClientOverviewTab` (already a separate component in `dashboard-tabs.tsx`)
- Works within the existing `PrismDashboardShell` — no shell change needed
- No routing changes — just component replacement

### Risks

- Doesn't fulfill the Sprint 2 goal of "client action center shell" — it's event-scoped, not portal-scoped
- The "next actions" concept is strongest at the portal level (across all events), not per-event
- Could feel like incremental improvement rather than a redesign slice

---

## Option 3: Full Shell Replacement (app-shell + Top Header Nav)

**Scope:** Replace `PrismDashboardShell` with a DES-01 compliant client shell:
- Top header with account menu (already exists in top bar)
- Section nav instead of sidebar
- Client Action Center as the default landing
- Remove the sidebar entirely from `apps/client`

### What changes

| Current | Target |
|---|---|
| `PrismDashboardShell` with sidebar | `app-shell` with top header + horizontal section nav |
| Sidebar holds all nav items | Nav items move to top bar sections: Dashboard | Events | Billing | Files | Calendar | Approvals |
| Mobile: sidebar drawer | Mobile: section scroll or bottom tabs |
| All pages render inside sidebar layout | All pages render inside top-nav layout |

### Effort: High

- New shell component or significant `PrismAppShell` refactor
- Every `/dashboard/*` page needs to re-render under the new shell
- Navigation constants (`CLIENT_SIDEBAR_ITEMS`, route maps) need rewriting
- Likely 2+ weeks — exceeds Sprint 2 capacity

### Risks

- Too large for Sprint 2 — this is Sprint 3 or 4 work
- Touches every client route, increasing regression surface
- The sidebar currently carries role/event context that needs a new home
- DES-01 says "sidebar nav for PMCM Admin only" but the current client app is deeply sidebar-dependent

---

## Option 4: Action Card Data-Layer Refactoring (Sprint 2 Foundation)

**Scope:** No UI changes. Refactor how action cards are sourced so Sprint 3 UI work has clean data.

### What changes

| Current | Target |
|---|---|
| Dual-sourced: contract actions + derived fallback | Contract-only actions; remove all local derivation |
| `PrismClientActionCenter` has 6 action kinds | Fill missing action kinds (closure, feedback) in the contract |
| Action mapping uses `actionCenterItemToDashboardAction()` | Typed, safe mapping with DES-01 status language |
| Local mock fallback `localClientActionCenter()` | Kill mock; use only API data or explicit empty state |

### Effort: Low-Medium

- Pure TypeScript — no UI changes
- Update `packages/types` and `packages/api-client` if action kinds are missing
- Coordinate with Anthony for contract updates

### Risks

- No visible demo for Sprint 2 review
- If contracts aren't ready (Owner D dependency), effort stalls
- Doesn't directly deliver the "shell" part of the requirement

---

## Option 5: Mobile-First Action Surface (Parallel Track)

**Scope:** Build a mobile-first version of the Client Action Center that works alongside the desktop dashboard. Target tablet/mobile breakpoints.

### What changes

- Single-column action card layout
- Bottom action bar instead of sidebar (DES-01 says "bottom tab nav for Supplier and Coordinator" but Client uses top header + section nav)
- Large CTAs per DES-01 banned-pattern compliance
- Responsive skeleton screens

### Effort: Medium

- Mostly CSS + responsive grid work
- Can run in parallel with Option 1
- Tests DES-01 mobile constraints early

### Risks

- Client portal is currently desktop-first; mobile pass may reveal layout assumptions baked into `PrismDashboardShell`
- Banned patterns (no horizontal scroll, no >5 column tables) need audit
- May be premature if shell direction (Option 1 / Option 3) isn't settled

---

## Recommendation

| Priority | Option | Why |
|---|---|---|
| **1st** | **Option 1: Dashboard Home → Client Action Center** | Directly fulfills the Sprint 2 goal: "thin slice" + "what needs my attention next" + "shell with safe event status". Delivers a visible demo surface. |
| **2nd** | **Option 4: Data-Layer Refactoring** | Prerequisite for Option 1 to work cleanly. Coordinate with Anthony in Sprint 1 to ensure `PrismClientActionCenter` covers all action kinds before Sprint 2 UI work starts. |
| **3rd** | **Option 5: Mobile-First (parallel)** | Start after Option 1 home page is stable. Validates DES-01 mobile constraints on the new surface. |
| **Later (Sprint 3+)** | **Option 3: Full Shell Replacement** | Too large for Sprint 2. Extract when Event Workspace sections and billing/files/approvals also need the new shell. |

### Sprint 2 Cut Line

**Do** (in order):
1. Coordinate with Anthony: ensure `PrismClientActionCenter` contract covers all 6+ action kinds with DES-01 status language
2. Extract `renderHomePage()` from `Dashboard.tsx` into standalone `<ClientActionCenter>` component
3. Build new `app-shell` top-header + section nav layout (but only for the home route; keep sidebar for other routes to limit scope)
4. Add skeleton/empty/error states per DES-01 spec
5. Wire action cards from contract; remove derived fallback for Sprint 2 kinds
6. Status badges use DES-01 language: Pending, Awaiting Your Action, In Progress, Confirmed, etc.

**Don't**:
- Don't rebuild every dashboard route in Sprint 2
- Don't remove the sidebar from events/billing/files routes yet
- Don't add QR, upload, or camera flows
- Don't use banned patterns: no unlabeled icons, no color-only status, no nested modals, no inline list editing, no horizontal scroll on mobile
- Don't add decorative eyebrow pills or uppercase badges

### Verification

After implementation, run:

```bash
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/client run typecheck
```

Plus manual checks:
- `/dashboard` shows action cards prioritized by severity, not derived fallback
- Public routes (`/`, `/inquiry`, `/sign-in`) don't redirect to `/dashboard` without auth
- Status badges use DES-01 language strings
- Empty states show message + single action
- Loading uses skeleton screens (not spinners on content areas)
- No banned visual patterns present on the redesigned surface

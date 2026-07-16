# REQ-01: Redesign Inventory Review — Ethan's Surfaces

**Source:** REQ-01 PDF (Supplier Readiness View + Guest Check-In requirements)
**Reference:** `docs/prism-v4/12-redesign-inventory.md`
**Owner:** Ethan (Owner C) — External portals: narrow, safe, mobile-ready action surfaces.
**Date:** 2026-06-20

---

## Ownership Boundary Note

The redesign inventory assigns `apps/client` to Ethan (line 21, severity S2). The REQ-01 PDF reassigns Client surfaces to Francis, leaving Ethan with **Supplier + Guest only**. This has been surfaced to the team. The review below scopes to Ethan's PDF-assigned areas.

---

## 1. Supplier Readiness View

### PDF Requirement

| Aspect | Specification |
|---|---|
| Shell | public-shell, mobile-first |
| Primary user | Assigned supplier |
| Primary job | Confirm readiness, check deliverables, update event-day status |
| Key components | status badge, large action buttons (Arrived / Set Up / Done), empty state |

### Current Redesign Inventory State

| App | Severity | Redesign direction | Route |
|---|---|---|---|
| `apps/supplier` | S2 | Make supplier work limited to quote, assignment, contract, readiness, and event-day status | `/dashboard` |

### Current Implementation (apps/supplier)

- **Shell**: `PrismDashboardShell` (signed-in dashboard shell) — **conflicts with PDF's "public-shell" directive**
- **Readiness flow**: Lives inside `/dashboard` under the `bookings` section (SPA state-switched, not a dedicated route)
- **Three-step handoff**: (1) Confirm assignment → (2) Readiness notes + contract filename + confirm readiness → (3) Event-day status (Arrived / Set up and ready / Done and leaving)
- **Supports**: The three status buttons already match the PDF's "Arrived / Set Up / Done" spec
- **Status badge**: UI component exists at `src/app/components/ui/status-badge.tsx` — available
- **Empty state**: UI component exists at `src/app/components/ui/empty-state.tsx` — available
- **Mobile-first**: Not verified; current layout assumes dashboard shell with sidebar

### Gaps & Observations

| # | Gap | Severity |
|---|---|---|
| G1 | **Shell mismatch**: PDF specifies `public-shell`, current uses `PrismDashboardShell` (signed-in). This is the largest architectural question — does readiness need a dedicated public-shell route independent of the full dashboard? | High |
| G2 | **Readiness is buried**: The readiness flow is a sub-section within `bookings`, not a first-class surface. PDF expects a dedicated Readiness View. | Medium |
| G3 | **Mobile-first not confirmed**: Layout needs audit/responsive pass. | Medium |
| G4 | **Route isolation**: No dedicated `/readiness` or `/dashboard/readiness` route. Currently SPA-state-switched with no deep-linkable URL. | Low-Medium |
| G5 | **Large action buttons**: Current buttons are standard size; PDF wants prominent CTA sizing. | Low |

### Actions Required

1. Decide: Keep readiness inside the dashboard shell (S2-compatible) or extract to a public-shell route (PDF directive). Recommend a dedicated `/dashboard/readiness` route gated by assignment, with a mobile-first layout using `PublicShell`.
2. Add route-level loading/error boundaries (`loading.tsx`, `error.tsx`) — currently absent for the entire app.
3. Surface readiness as a first-class dashboard navigation item, not a bookings sub-section.
4. Audit and enforce mobile-first responsive layout.
5. Ensure event-day status buttons use prominent sizing consistent with the PDF spec.

---

## 2. Guest Check-In

### PDF Requirement

| Aspect | Specification |
|---|---|
| Shell | public-shell, link-based, no login |
| Primary user | Event guest |
| Primary job | Check in digitally — QR scan, name lookup, or manual entry |
| Key components | minimal UI, single CTA per mode, no nav |

### Current Redesign Inventory State

| App | Severity | Redesign direction | Routes |
|---|---|---|---|
| `apps/guest` | S1/Gate | Make guest access low-friction, consented, and event-code scoped. Gate QR/camera and media upload until HTTPS, consent, upload, and moderation are ready. | `/`, `/open`, `/sign-in` (redirect), `/dashboard` |

### Current Implementation (apps/guest)

- **Shell**: `PrismDashboardShell` after code entry — **conflicts with PDF's "public-shell, no nav" directive**
- **Code entry**: `/open` route — two-step flow (name + event code → validate → redirect to dashboard) — matches "link-based, no login"
- **Check-in**: Scroll-to section `#guest-check-in` on the dashboard page — name-based with consent checkbox and walk-in flagging
- **QR scan**: Not implemented — correctly gated per inventory (requires HTTPS, consent, upload, moderation)
- **Navigation**: Dashboard includes full sidebar nav — **conflicts with PDF's "no nav"**

### Gaps & Observations

| # | Gap | Severity |
|---|---|---|
| G6 | **Shell mismatch again**: PDF specifies `public-shell` and "no nav", current uses `PrismDashboardShell` with full sidebar. Guest check-in should be a single-purpose, nav-free surface. | High |
| G7 | **Check-in is a dashboard section, not a focused route**: Currently a scroll anchor on the dashboard page. PDF expects a dedicated check-in surface. | Medium |
| G8 | **Single CTA per mode**: PDF wants one clear action per mode. Current check-in has a single "Record name check-in" button, which aligns, but the surrounding dashboard adds distraction. | Low |
| G9 | **QR scan**: Correctly gated, but no placeholder or mode switching UI ready for when it becomes available. | Low (gate) |
| G10 | **Name lookup vs manual entry**: Only name-based check-in exists. "Manual entry" (entering guest details freeform) not clearly separated as a distinct mode. | Low |

### Actions Required

1. Decide: Restructure guest check-in as a dedicated route (e.g., `/check-in` or `/dashboard/check-in`) using `PublicShell` with no sidebar navigation. The `/dashboard` route can remain for event info/feedback.
2. Keep `/open` as the public link-based code-entry surface — this is working well.
3. Strip sidebar nav from the check-in view; render only the CTA and consent flow.
4. Add route-level loading/error boundaries (`loading.tsx`, `error.tsx`) — currently absent.
5. Design mode switching for when QR scan is un-gated (name lookup vs QR scan vs manual entry), with single CTA per mode.
6. Consider whether the guest dashboard should become the check-in surface itself (simplest path) or remain a multi-section dashboard with check-in as a focused sub-route.

---

## 3. Cross-Cutting Issues (Both Surfaces)

| # | Issue | Surfaces Affected |
|---|---|---|
| C1 | **Public shell vs dashboard shell**: Both PDF specs call for `public-shell` (or "no nav"), but both current implementations use `PrismDashboardShell`. This is the single biggest divergence between the PDF spec and the current codebase. | Supplier, Guest |
| C2 | **Missing loading/error boundaries**: Neither `apps/supplier` nor `apps/guest` has `loading.tsx`, `error.tsx`, or `not-found.tsx` files. Every route inventory pass should add these. | Supplier, Guest |
| C3 | **No route-level data contracts**: Both apps reach directly into API endpoints without typed route contracts from `packages/types`. Should align with Owner D's contract work. | Supplier, Guest |
| C4 | **Client ownership handoff**: If Francis takes Client, Ethan loses his only dashboard-heavy surface. Supplier and Guest are both relatively thin — Ethan's scope becomes narrower than the original inventory planned. Team should confirm this is intentional. | Scope |

---

## 4. Recommendations

1. **Accept the public-shell direction** for both Supplier Readiness View and Guest Check-In. It aligns with Ethan's system goal ("make external portals narrow, safe, mobile-ready action surfaces"). The current `PrismDashboardShell` is heavier than needed for both.

2. **Extract Supplier Readiness** to a dedicated `/dashboard/readiness` route (still signed-in, but using a focused layout) with mobile-first responsive design.

3. **Extract Guest Check-In** to a dedicated `/dashboard/check-in` route (post-code-entry, but nav-free, single-CTA surface). Keep `/dashboard` for event info/feedback but simplify it.

4. **Add route infrastructure** (loading, error, not-found boundaries) to both apps as a first pass.

5. **Defer QR scan** until the gates are lifted (HTTPS, consent, upload, moderation) — consistent with inventory.

6. **Coordinate with Owner D (Anthony)** on typed contracts for supplier readiness board and guest event pass before implementing route changes.

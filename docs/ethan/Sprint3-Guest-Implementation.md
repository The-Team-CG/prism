# Sprint 3 — Guest Check-In (EP-13-S02) & Feedback (EP-13-S04)

**Owner:** Ethan (Owner C)
**Date:** 2026-07-14
**Branch:** `ethan/c1-c2`
**Source docs:** `EthanRedesign1v2.md`, `DES-04.md`, `11-feature-ledger.md`, `2026-06-15-prism-redesign-agile-calendar.md`

---

## 1. Scope

### EP-13-S02 — Guest Check-In (name-based + headcount-only)
- **Feature refs:** FR-39, FR-95
- **Status:** In Progress (deadline July 10 — passed)
- **Remaining work:** headcount-only mode, walk-in policy enforcement, real-time attendance count, shell migration

### EP-13-S04 — Guest Post-Event Feedback (star rating + media)
- **Feature refs:** FR-41, New-EX2
- **Status:** To Do (deadline July 14)
- **Remaining work:** photo upload, video upload (max 60s), shell migration, DES-04 compliance

### Out of scope (gated)
| Feature | Gate |
|---------|------|
| QR code check-in (EP-13-S03) | PA-63/PA-66 — HTTPS/camera; declare post-July |
| Guest game (EP-13-S07) | Same QR gate + EP-12-S05 |
| Media upload to object storage | Storage adapter contract — metadata-only for now |
| Promotional demo (FL-025) | Client portal live first |

---

## 2. Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Shell: `PrismDashboardShell` → `PrismPublicShell`** | DES-04 public-shell, no nav. `PrismPublicShell` exists in `@prism/ui` — provides nav-free single-task layout with aside slot for event pass card. |
| **Headcount-only mode: `checkInMode: "headcount"`** | FR-39 Mode 3. API already accepts `checkInMode` string. Send `guestName: "Walk-in guest"` since `GuestCheckInDto.guestName` is required. No schema changes. |
| **Real-time count: 20s polling** | `GET /api/guest/events/:accessCode` returns `attendanceCount`. Simple `setInterval` + `refreshEvent()`. No WebSocket needed for thin slice. |
| **Media upload: metadata only** | `GuestFeedbackDto` already supports optional `photo`/`video` metadata fields. Add file selection UI + client-side validation. Actual storage adapter is gated. |
| **Video validation: client-side duration check** | Hidden `<video>` element reads `duration` on `loadedmetadata`. Reject if > 60s per FR-41. |
| **Success states: inline banners (no toast)** | Guest app has no toast infrastructure. `PrismNoticeBanner` continues as success display. Toast integration is post-July. |

---

## 3. File Changes

### Primary: `apps/guest/src/app/dashboard/page.tsx` (major refactor)

**Remove:**
- `PrismDashboardShell` + all nav/mobile/command/header props
- `RolePageHeader`, `PrismMetricTile`, `PrismStatusTimeline`
- Scroll-based nav (`scrollToCheckIn`, etc.)

**Add:**
- `PrismPublicShell` wrapper — aside gets event pass card (name, date, QR placeholder, code)
- Page title: `Guest Registration · ${eventName}` (DES-04 format)
- **Check-in mode toggle:** "Name-based" / "Headcount-only"
- **Headcount-only flow:** no name input, simplified consent, single CTA
- **Attendance polling:** `useEffect` + `setInterval(refreshEvent, 20000)` — display "X guests checked in" inline
- **Photo upload:** `<input type="file" accept="image/jpeg,image/png,application/pdf" />` — store File, send metadata on submit
- **Video upload:** `<input type="file" accept="video/mp4" />` — duration check via hidden `<video>`, reject > 60s
- **File preview/remove UI** for selected media
- **DES-04 state language** throughout (loading, empty, error, success strings)
- **"Leave event"** as text link at bottom

**Resulting structure:**
```
PrismPublicShell
├── aside: Event pass card (event name, date, code, QR placeholder)
├── H1: "Guest Registration · [Event Name]"
├── Attendance count (inline text)
├── Section: Check-in
│   ├── Mode toggle (name-based / headcount-only)
│   ├── [Name-based] Name display, walk-in checkbox, consent, CTA
│   ├── [Headcount-only] Consent, single CTA
│   └── Success state
├── Section: Event details
│   └── 6-field info grid (existing)
├── Section: Feedback
│   ├── Star rating, comment textarea
│   ├── Photo upload input
│   ├── Video upload input + duration validation
│   ├── Consent checkbox, submit CTA
│   └── Success state
└── "Leave event" text link
```

### Minor: `apps/guest/src/app/open/page.tsx`
- Verify DES-04 empty state: "No active event session. Enter Event Code."
- Verify error language on invalid code

### Already exist (verify only): `dashboard/loading.tsx`, `error.tsx`, `not-found.tsx`

### No changes: `prism-api.ts` (dead code, leave as-is)

---

## 4. Execution Phases

| Phase | Description | Stories |
|-------|-------------|---------|
| **1** | Shell migration + page structure removal | EP-13-S02 |
| **2** | Headcount-only mode toggle + flow | EP-13-S02 |
| **3** | Real-time attendance polling | EP-13-S02 |
| **4** | Photo + video upload on feedback form | EP-13-S04 |
| **5** | DES-04 compliance pass (state language, banned patterns, action hierarchy) | Both |

---

## 5. API Contracts (no backend changes needed)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/guest/events/:accessCode` | Event pass + attendance count (polled every 20s) |
| `POST /api/guest/events/:accessCode/check-ins` | Name-based (`checkInMode: "name_search"`) or headcount (`checkInMode: "headcount"`) |
| `POST /api/guest/events/:accessCode/feedback` | Rating + comment + optional `photo`/`video` metadata |

---

## 6. Verification

- `npm --workspace @prism/guest run typecheck` — clean
- `npm run check:boundaries` — pass
- Manual: valid/invalid code, name-based check-in, headcount check-in, walk-in flag, feedback submit, photo metadata, video >60s rejection, attendance count polling, mobile layout, DES-04 state language, banned pattern check

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| `PrismPublicShell` two-column grid constrains scroll content | Use `children` slot for scrollable content below hero; test mobile overflow |
| `guestName: "Walk-in guest"` rejected by API validation | Test against live API; `GuestCheckInDto.guestName` is `@IsString()` required |
| Video duration check unreliable in browser | Fallback: allow submission, let server reject |
| Polling stale after rapid check-ins | Acceptable for thin slice; post-July: SSE/WebSocket |

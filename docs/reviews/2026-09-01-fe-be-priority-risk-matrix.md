# FE/BE Architecture — Priority & Risk Matrix

**Date:** 2026-09-01
**Companion to:** [`2026-09-01-fe-be-architecture-alignment.md`](./2026-09-01-fe-be-architecture-alignment.md)
**Branch:** `codex/architecture-alignment-fe-be`
**Purpose:** sequence every finding from the alignment review by priority and
risk so work can be picked up as scoped, independently-shippable slices.
**Update (2026-09-01, same day):** incorporated §4 of the alignment report —
a cross-repo comparison against `alphaci-enterprise-fe`/`-be` (same author,
same skills). That comparison provided working proof for `F4a` (route groups)
and `B1` (domain layer), and added two new findings — `F5` (one-line barrel
`page.tsx`) and `F6` (scope layouts to the route group, not globally) — which
changes the FE sequencing below: `F4a` moves to P0 and `F6` is promoted to P1
as the real prerequisite for `F4c` paying off.

## How to read this

- **Impact** — cost of *not* fixing it (drift, incidents, extraction cost).
- **Fix risk** — chance the fix itself breaks something (URLs, behavior, data).
- **Effort** — rough size as a standalone PR.
- **Priority** — P0 (do first / blocking), P1 (do soon), P2 (opportunistic),
  P3 (defer / informational only).
- **Verification** — the minimum check required before calling it done, per
  `AGENTS.md`'s "narrow → wide" rule and the `verification-before-completion`
  discipline.

---

## Priority 0 — do first (small, safe, unblocks nothing else but should not wait)

| # | Item | Impact | Fix risk | Effort | Verification |
| --- | --- | --- | --- | --- | --- |
| B4 | Move `opsEvent` Prisma lookups out of `file-ops` and `floorplan` controllers into their existing services (`FileRequirementsMatrixService`, `FloorPlanWorkflowService`) | Medium — 2 of 41 controllers violate presentation/persistence separation; blocks clean extraction later | **Low** — mechanical move, same query, same return shape, both services already exist | XS (~30–60 min) | `npm run typecheck` (apps/api) + existing controller/service tests for both modules + `check-boundaries.mjs` |
| FE-cleanup | Delete (or relocate) `apps/client/src/app/App.tsx` | Low — dead file outside App Router convention; confusing to new contributors | **Low** — confirmed zero importers anywhere in `apps/client/src` | XS (~10 min) | grep confirms no remaining references + `npm run build` (apps/client) |
| F4a | Introduce route groups `(portal)/dashboard`, `(auth)/sign-in`+`sign-up` in all 4 apps — organization only, invisible in URL. **Promoted from P2**: `alphaci-enterprise-fe` runs this exact pattern in production today (`(access)`, `(platform)`, `(public)`) — it is proven, not speculative | Medium — makes the top-level route intent legible; currently auth and portal routes sit as unrelated siblings | **Low** — Next.js route groups are purely organizational, no URL change by definition; sibling repo is the working reference to copy from | S per app (~1–2 hrs each × 4 apps) | `npm run build` per app + manual click-through of sign-in → dashboard flow + confirm URLs identical via `smoke:ui` if stack is up |
| F5 | Simplify shim `page.tsx` files to the one-line barrel re-export convention: `export { XView as default } from "@/features/.../x";` (matches `alphaci-enterprise-fe` exactly, and the skill's own 80% example) instead of `export default function Page() { return <XView />; }` | Low — pure style/ceremony reduction, no behavior change | **Very low** — mechanical, one line per file, TypeScript catches any export-name mismatch immediately | XS (~10 min per already-correct page; fold into F4a/F4c as those are touched rather than a standalone sweep) | `npm run typecheck` for the touched app |

**Why P0:** all four are isolated or purely organizational, already have
passing tests or a proven external reference to copy from, and reduce
confusion for anyone touching those areas next. F4a and F5 do not require new
design — the shape already exists and works in `alphaci-enterprise-fe`.

---

## Priority 1 — do soon (real debt, contained blast radius, no design ambiguity)

| # | Item | Impact | Fix risk | Effort | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Consolidate duplicated selectors: `event-workspace/shell/model` ↔ `event-dashboard/shell/model` ↔ `command-inbox/list/model` into one canonical home | Medium — active boundary-checker violation; every future selector change risks touching 3 files instead of 1 | **Medium** — used by the 941-line mega-VM (F3) and by `event-workspace` tests; needs careful re-export cleanup, not a rename | S–M (~half day) | None (do before F3, since F3's split is easier once selectors have one home) | `check-boundaries.mjs --paths features/event-dashboard,features/event-workspace,features/command-inbox` shows 0 findings + existing selector `.test.ts` files still pass + manual smoke of dashboard, workspace, command-inbox screens |
| B1 | Add a thin `domain/` layer for `live-ops` (start here, not `supplier-ops`) — status-transition guards for `UrgentIssueStatus`, `LiveOpsEscalationLevel`, `LiveOpsSlaStatus` extracted from `event-core/ops.constants.ts` and inline service `if`-checks | High (strategic) — this module was already touched twice recently (PR #28, #29) and is the most state-machine-heavy path in the API; every future rule change currently means finding scattered `if`s | **Medium** — pure refactor if done as "extract, don't rewrite" (per `extract-module.md` anti-pattern: don't extract and rewrite simultaneously); risk is behavior drift if transition rules are subtly rephrased | M (~1 day) | None, but do before any new live-ops feature work so the new work lands on the improved shape | `npm run test:api` (live-ops suite) unchanged pass/fail count + new domain-layer unit tests for each transition guard + `check-boundaries.mjs` |
| Merge | Merge `events`, `plans`, `templates`, `publishing` (4 Nest library modules, same-commit origin, 0 current FE callers) into one `floorplan-authoring` module (or fold into existing `floorplan`) | Medium — 4 modules doing 1 job inflates the "24 modules" cognitive load and the `nest-cli.json`/`app.module.ts` surface for no ownership benefit | **Low–Medium** — no active FE caller was found, but must confirm via API logs / any external consumer before deleting routes, not just static grep | M (~1 day, mostly module-registration + import-path churn) | Confirm zero external consumers first (see "before you start" below) | `npm run build && npm run typecheck` (apps/api) + `prisma:validate` (no schema change expected) + full `test:api` suite green + `check-boundaries.mjs` |
| F6 | Scope dashboard layout composition to the route group/section that needs it (e.g. an `(portal)` shell layout for chrome shared by all sections, plus a per-section layout only where a section needs its own gate/header — following `alphaci-enterprise-fe`'s `(platform)/admin/layout.tsx` pattern of a scoped `<AdminGate>`), instead of one global `dashboard/layout.tsx` doing pathname-detection for every section via the 941-line VM | High — this is the actual structural prerequisite for F4c to pay off; without it, giving each section a real `page.tsx` (F4c) still leaves one monolithic layout doing all the section-switching work underneath | **Medium** — must not regress any section's current chrome/behavior; do after F1 (selectors) and alongside F3 (VM split), test each section's layout individually as it's carved out | M (~1 day, incremental per section as F4c proceeds — not a single big-bang PR) | Do after F1; pairs with F3 and directly enables F4c | Per-section manual QA as each layout is scoped out + existing `event-dashboard-shell-architecture.test.ts` + `check-boundaries.mjs` |

**Why P1, not P0:** each has real design decisions (where exactly do the
selectors live? which module absorbs the other three?) that benefit from a
quick confirm before writing code, and touch more than one file/test.

**Before you start the module merge:** grep alone found 0 FE callers for
`/api/templates`, `/api/plans`, `/api/publish`, `/api/layout-events` — but
that only proves no *static* caller in the 4 apps' `lib/prism-api.ts`. Check
for: (a) any external/Postman/QA scripts, (b) any seed/fixture scripts under
`apps/api/scripts` that hit these routes, (c) `docs/prism-v4/01-complete-feature-catalog.md`
for whether these are documented as shipped-and-used features, before treating
them as safe to fold together.

---

## Priority 2 — opportunistic (real, but larger design surface or lower urgency)

| # | Item | Impact | Fix risk | Effort | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| F4b | Collapse literal enum-mirror folders into one dynamic segment where a closed value set already exists in code (e.g. `event` app's `clients/active|prospects|past|archived` → `clients/[clientView]` reusing the existing `CLIENT_LIST_ROUTE_ITEMS` map; `client` app's `events/upcoming|cancelled|completed|draft-requests|in-planning` → one dynamic segment) | Medium — removes ~10+ duplicate no-op shim files per app; makes adding a new filter a data change, not a new folder | **Medium** — must preserve every existing URL exactly (hard rule per `AGENTS.md`); do one filter family at a time with a redirect/alias check, not all at once | M (~half day per app, do incrementally) | Do after F1 (cleaner selector ownership makes this safer) | Route-by-route manual URL check (old path still resolves, same content) + `check-boundaries.mjs` + no change to `event-dashboard-routing.ts`'s public route-item exports |
| F4c | For the `event` app specifically: let real `page.tsx` files render their matching feature view directly (per `feature-composition.md` and the one-line `export { X as default }` convention from F5) instead of `return null` + pathname-sniffing in `EventDashboardShellView`/the 941-line VM | High (structural) — this is the actual fix for "top app routes not optimized"; today the App Router's own matching is fully bypassed. `alphaci-enterprise-fe` proves the target shape works (every page there is a 1-line feature-view export) | **High** — this is the riskiest item in the whole matrix: it touches the rendering path for every dashboard screen in the largest, most-used portal | L (multi-day, must be done **one section at a time**, e.g. just `audit`, verify, then `calendar`, verify...) | **Do only after F1, F3, and F6** (selectors consolidated, mega-VM split by concern, layouts already scoped per section) — attempting this first multiplies the blast radius | Per-section: visual regression / manual QA of that one section + `check-boundaries.mjs --paths features/event-dashboard` + confirm `EventDashboardRouteView` shim count decreasing section by section, not all at once |
| F3 | Split the 941-line `use-event-dashboard-shell-view-model.ts` by concern (nav/icon config vs. routing vs. dashboard data selection) | Low–Medium — no rule violation, but this file is the single largest source of merge-conflict risk and blocks F4c from being low-risk | **Medium** — large file, but splitting by already-distinct concern (imports are already grouped that way) is mechanical if selectors are consolidated first (F1) | M (~1 day) | Do after F1, before F4c | Existing `event-dashboard-shell-architecture.test.ts` still passes + `npm run test` for touched feature + manual smoke of dashboard shell |
| B2 | Document owned/read-only Prisma tables per module (one paragraph per module, in-module README or `.module.ts` comment) | Medium (documentation debt, compounds over time) — currently no module states which Prisma models it's allowed to touch beyond its own | **Very low** — pure documentation, no code change | S (~1–2 hrs for all 24 modules, can be split module-by-module) | None | Peer review only — no automated check exists for this today; could seed a future `check-boundaries`-style script |
| B1b | Extend the same `domain/` treatment (B1) to `supplier-ops` (`SupplierQuoteRequestStatus`, `SupplierQuoteStatus`, `SupplierVerificationStatus`, `SupplierTier` transitions) | High (strategic) — `supplier-ops` is the single largest module (29 files) with real invariants and zero domain code | **Medium** — same shape/risk as B1, larger surface (largest module) | L (~1–2 days) | Do after B1 (live-ops) proves the pattern | Same shape as B1: `test:api` (supplier-ops suite) + new domain unit tests + `check-boundaries.mjs` |

**Correction (2026-09-01, during plan execution):** the B1b row above assumed
`SupplierQuoteRequestStatus`, `SupplierQuoteStatus`, `SupplierVerificationStatus`,
and `SupplierTier` transitions all live in `supplier-ops`. Execution found
this was only true for `SupplierVerificationStatus` (supplier setup
verification, correctly scoped in `supplier-ops`). The quote-request and
quote lifecycle transitions (`SupplierQuoteRequestStatus`,
`SupplierQuoteStatus`) actually live in
`commercial-ops/src/services/commercial-workflow.service.ts`, not
`supplier-ops`. The domain-layer extraction for those two enums was done
against `commercial-ops` instead (3 policy functions:
`isSupplierQuoteRequestClosed`, `isSupplierQuoteLocked`,
`resolveExpiredQuoteRequestStatus`), verified with 12 new unit tests, the
full 350-test backend suite, typecheck, and a clean boundary check. Any
follow-up work on `SupplierTier` transitions, or on
`SupplierVerificationStatus` inside `supplier-ops` itself, remains
open and unstarted — it was not part of what B1b's premise actually pointed at.

---

## Priority 3 — defer / informational only (no action needed now)

| # | Item | Why deferred |
| --- | --- | --- |
| F2 | `event-ops` facade fan-in (6 domains importing one thin I/O barrel) | Not a rule violation today (barrel-only imports, boundary checker passes). Correct move is passive: stop adding a 7th consumer, migrate opportunistically when those domains are next touched for other reasons. No standalone PR justified. |
| B3 | `sample-compatibility` importing 18/24 modules | Confirmed intentional and correctly scoped behind its own `/sample/*` route prefix per `AGENTS.md`. Not a finding — informational only, kept here so it isn't miscounted as an anti-pattern later. |
| Platform relabel | Visually separating `health`/`event-session` from business modules (e.g. a `platform/` grouping in `nest-cli.json`) | Nice-to-have organizational clarity, zero functional impact, no urgency. Bundle into the P1 module-merge PR if convenient, otherwise skip. |

---

## Suggested execution order (respecting dependencies above)

```text
1. B4    — fix 2 controllers' Prisma access           (P0, standalone)
2. FE-cleanup — delete apps/client/src/app/App.tsx    (P0, standalone)
3. F4a   — route groups (portal)/(auth) in all 4 apps   (P0, standalone, proven pattern — do early for a quick safe win)
4. F5    — one-line barrel page.tsx convention           (P0, fold into F4a's per-app pass)
5. F1    — consolidate event-dashboard/workspace/command-inbox selectors (P1)
6. B1    — live-ops domain layer                         (P1, standalone)
7. Merge — events+plans+templates+publishing              (P1, confirm no external caller first)
8. F6    — scope dashboard layouts per route group/section (P1, needs F1 done, pairs with F3)
9. F3    — split the 941-line mega-VM                     (P2, needs F1 done, pairs with F6)
10. F4b  — collapse literal filter folders into [param]   (P2, needs F1 done, do one family at a time)
11. F4c  — real per-section pages in event app             (P2, needs F1+F3+F6 done, do one section at a time)
12. B1b  — commercial-ops quote-request domain layer (actual module; see correction) (P2, needs B1 pattern proven)
13. B2   — document owned/read-only tables per module      (P2, anytime, no dependency)
```

Note: F4a and F5 do not block or get blocked by anything else in this list —
they are listed early because `alphaci-enterprise-fe` proves them out, not
because anything downstream depends on them. F6 is the key addition from the
cross-repo comparison: without scoping layouts per route group first, F4c
(splitting the shim pages) would not actually remove the pathname-sniffing
problem — it would just move it.

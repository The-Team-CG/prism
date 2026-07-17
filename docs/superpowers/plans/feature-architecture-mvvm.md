# Feature architecture MVVM migration

**Branch:** `refactor/feature-architecture-mvvm` (off `staging`)  
**Mode:** phased full migration — one vertical per PR into this branch (or stacked PRs into `staging`)  
**Skill:** `feature-architecture` (Next.js App Router MVVM)  
**Status:** inventory only — no bulk moves yet

## Goals

Bring each portal to:

```text
page → View → ViewModel → Use case → data (repository) → @prism/api-client / prism-api
```

with slices under `apps/<portal>/src/features/<domain>/<action>/`:

| Layer | Role |
| --- | --- |
| `model/` | Types + pure rules (no React/Next) |
| `data/` | I/O only; wrap existing `lib/prism-api` |
| `use-cases/` | Application actions |
| `view-models/` | State, commands, `status` / user-safe `error` |
| `views/` | JSX bound to ViewModel |
| `index.ts` | Public barrel only |

## Non-goals

- API / Nest / Prisma rewrites (already modular under `apps/api/libs/modules/*`)
- Cross-app shared feature packages (share contracts via `@prism/types` only)
- Visual redesign, wizardization of simple forms
- Empty `views/steps/` “for later”
- Big-bang single PR of all portals

## Detected conventions (all portals)

```text
src root:        src
Alias:           @/*
HTTP:            src/lib/prism-api.ts → @prism/api-client → apps/api
UI kit:          packages/ui + app/components/ui (domain-free only)
Features root:   src/features/ (partial on client + event; absent on supplier/guest)
Tests:           vitest (event, api packages; portal coverage uneven)
Default shape:   form-list; wizard only when multi-step is product-required
```

## Current state (baseline)

| Portal | ~TS/TSX | Pages | Features today | Fat hotspots |
| --- | ---: | ---: | --- | --- |
| `event` | 127 | 50 | `event-dashboard/*` (hooks + selectors) | `EventDashboardClient.tsx` (~121KB), `app/page.tsx`, PMCM workspaces |
| `client` | 110 | 24 | `client-dashboard/*` | `Dashboard.tsx` (~114KB), tabs, landing/inquiry |
| `supplier` | 26 | 3 | none | `dashboard/page.tsx` (~62KB) |
| `guest` | 28 | 5 | none | `dashboard/page.tsx`, `open/`, `info/` |

**Pattern debt:** many `app/dashboard/**/page.tsx` files are stubs (`return null`) while a single fat client shell owns routing/views. Migration must **extract verticals out of the shell**, not only wrap stubs.

**Existing features (keep, then deepen into full slices):**

- `apps/client/src/features/client-dashboard/` — types, nav, selectors, `useClientDashboardState`
- `apps/event/src/features/event-dashboard/` — routing, selectors, inbox/readiness/workspace hooks

## Target slice naming

Prefer **domain + action**, not god-dashboard folders long-term:

| Today | Target direction |
| --- | --- |
| `features/client-dashboard/*` | Split into `client-workspace`, `client-events`, `client-billing`, `inquiry`, … |
| `features/event-dashboard/*` | Split into `command-inbox`, `event-workspace`, `coordinators`, `floorplan`, … |

During early PRs it is OK to nest under current names if that reduces churn; later PRs rename for domain clarity.

## Migration waves (PR sequence)

Each wave = **one vertical** (one user journey or route cluster). Merge to this branch (or PR to `staging` with `feat(fe):` / `refactor(fe):`). **Stop after each wave** unless continuing intentionally.

### Wave 0 — Guardrails (this doc)

- [x] Branch from `staging`
- [x] Inventory + sequencing
- [ ] Optional: add portal-level boundary script note in PR template / AGENTS cross-link (only if team wants)

### Wave 1 — Smallest full-slice wins (prove pattern)

| # | Portal | Vertical | Routes / entry | Approx source |
| ---: | --- | --- | --- | --- |
| 1.1 | guest | access open | `app/open` | `open/page.tsx` |
| 1.2 | guest | event info QR | `app/info/[accessCode]` | `info/[accessCode]/page.tsx` |
| 1.3 | guest | check-in / feedback shell | `app/dashboard` | `dashboard/page.tsx` |
| 1.4 | client | public inquiry | `app/inquiry` | `PublicInquiryPage.tsx` |
| 1.5 | client | sign-in / sign-up | `app/sign-in`, `sign-up` | local pages |

**Done when:** each has `features/<domain>/<action>/{model,data,use-cases,view-models,views,index}` and thin `page.tsx`.

### Wave 2 — Supplier portal (whole app is small)

| # | Vertical | Notes |
| ---: | --- | --- |
| 2.1 | supplier landing / home | `app/page.tsx` |
| 2.2 | supplier dashboard | Extract from fat `dashboard/page.tsx` into list/detail actions |
| 2.3 | supplier sign-in | Thin auth shell |

### Wave 3 — Client dashboard shell → domain slices

Order by coupling / size:

| # | Vertical | Pull from |
| ---: | --- | --- |
| 3.1 | client session + workspace load | `use-client-dashboard-state.ts` → full MVVM `data/` |
| 3.2 | dashboard home / overview | `Dashboard.tsx` route `home` |
| 3.3 | events list + event detail sections | `dashboard/events/**` |
| 3.4 | approvals | `dashboard/approvals/**` |
| 3.5 | billing | `dashboard/billing/**` |
| 3.6 | files / messages / calendar / request | remaining tabs |
| 3.7 | landing marketing | `MainLandingPage.tsx` (static/presentational OK) |
| 3.8 | floorplan editor chrome (client prefs only) | `components/editor/*` — keep canvas internals; feature owns prefs submit, not PMCM official edit |

### Wave 4 — Event (PMCM) command surfaces

| # | Vertical | Pull from |
| ---: | --- | --- |
| 4.1 | command inbox | hooks + `event-command-inbox` / cockpit components |
| 4.2 | selected event workspace shell | `use-pmcm-selected-event-workspace`, readiness |
| 4.3 | coordinators directory / assignment | `coordinator-view.tsx`, event coordinators routes |
| 4.4 | suppliers directory / quotes | `supplier-directory`, `supplier-quote-planner` |
| 4.5 | live ops | `live-operations-workspace.tsx` |
| 4.6 | finance / billing workspace | `financial-workspace.tsx` |
| 4.7 | floorplans (PMCM official) | editor + floorplan routes — canvas stays; feature owns ops |
| 4.8 | inquiries / clients lists | dashboard clients + inquiries |
| 4.9 | audit / settings / team / tasks / files / messages | remaining shells |
| 4.10 | retire fat `EventDashboardClient.tsx` | only after slices own all routes |

### Wave 5 — Cleanup

- [ ] Delete dead stubs and unused `app/components` after re-exports removed
- [ ] Ensure no deep cross-feature imports (barrels only)
- [ ] `packages/ui` remains domain-free
- [ ] Align AGENTS.md example paths if naming stabilized
- [ ] Archive this plan when migration complete

## Per-vertical mechanical checklist

From skill playbook `migrate-vertical`:

1. Pick **one** vertical  
2. Detect conventions (above)  
3. Inventory files (skill script or manual list)  
4. Map old path → `features/<domain>/<action>/<layer>/`  
5. Scaffold if helpful:  
   `node ~/.grok/skills/feature-architecture/scripts/scaffold-feature.mjs <domain> <action> --cwd apps/<portal> --detect --with-page`  
6. Move order: **model → data → use-cases → view-models → views → thin page**  
7. Retarget tests; no new HTTP in views/pages  
8. `npm run typecheck` (touched workspaces) + portal tests if any  
9. `npm run check:boundaries`  
10. **Stop** — open PR for that vertical  

## Shared contracts

- New shared request/response shapes → Zod + `z.infer` in `@prism/types`  
- Rebuild types package when contracts change  
- Portal `data/` maps DTO → view model types; do not leak Prisma models  

## Risk controls

| Risk | Mitigation |
| --- | --- |
| Mega-PR unreviewable | One vertical / PR; max ~one fat component extraction |
| Behavior regressions | Prefer move + thin wrappers first; no product behavior change in pure structure PRs |
| Stub routes hide real UI | Always inventory the fat shell that renders the route |
| Cross-portal copy/paste | Copy patterns, not code; share only types + api-client |
| WIP on other concerns | Do not mix API session fixes into FE structure PRs |

## Suggested first implementation PR (after plan merge)

**1.1 Guest open** — smallest public path, clear I/O, proves full folder shape end-to-end.

```text
apps/guest/src/features/guest-access/open/
  model/
  data/
  use-cases/
  view-models/
  views/
  index.ts
apps/guest/src/app/open/page.tsx  → thin compose
```

## Branch workflow

```text
staging  ←── PR: wave vertical (refactor/feature-architecture-…-guest-open)
   │
   └── refactor/feature-architecture-mvvm  (optional integration branch)
            └── short-lived branches per vertical
```

Prefer **vertical branches → PR to `staging`** once the pattern is proven; keep this branch as integration only if multiple people work in parallel.

## Out of scope reminders (skill)

Backend/SQL, deploy, pure performance, design-system overhaul — do not force feature slices onto those tasks.

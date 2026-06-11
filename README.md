# P.R.I.S.M

P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It is split into role-specific portals backed by one shared API.

## Canonical Docs

| Document | Purpose |
| --- | --- |
| `docs/prism-v4/01-complete-feature-catalog.md` | Baseline Version 4 feature catalog and official manuscript/defense counts. |
| `docs/prism-v4/04-implementation-plan.md` | Build plan, app/API/database mapping, and acceptance criteria by feature. |
| `docs/prism-v4/05-prism-defense-demo-guide.md` | Seeded defense story and feature demo matrix. |
| `docs/prism-v4/07-implemented-feature-revisions.md` | Current implemented/partial features, revision gaps, and how to revise them. |
| `docs/prism-v4/08-revision-phase-plan.md` | Historical phase roadmap for revision-first implementation and cleanup. |
| `docs/prism-v4/10-product-evolution-and-redesign-governance.md` | Rules for adding, revising, merging, deferring, or retiring features during redesign. |
| `docs/prism-v4/11-feature-ledger.md` | Active feature-family decisions, ownership, phase placement, and verification requirements. |
| `docs/prism-v4/12-redesign-inventory.md` | Whole-app route inventory with redesign severity and role boundaries. |
| `docs/prism-v4/13-docs-cleanup-checklist.md` | Documentation hygiene rules, retired artifacts, and verification commands. |
| `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` | Active whole-app redesign and capability maturity plan. |

## Monorepo Layout

- `apps/client`: client-facing portal on port `3001`.
- `apps/supplier`: supplier portal on port `3002`.
- `apps/guest`: guest portal on port `3003`.
- `apps/event`: PMCM admin and coordinator event command app on port `3004`.
- `apps/api`: shared NestJS API and Prisma-backed data layer on port `4000`.
- `packages/ui`: shared shadcn-style command shell and UI primitives.
- `packages/tokens`: shared Prism tokens and Tailwind theme values.
- `packages/api-client`: shared API client helpers.
- `packages/types`: shared role, action, and lifecycle types.

## Run Locally

From `c:\Codes\prism`, use the root wrappers:

```bash
start-prism.cmd
```

This starts the API and all four portals with logs under `.local-dev\logs`.

To stop the local stack:

```bash
stop-prism.cmd
```

Individual app defaults:

| App | URL |
| --- | --- |
| API | `http://localhost:4000` |
| Client portal | `http://localhost:3001` |
| Supplier portal | `http://localhost:3002` |
| Guest portal | `http://localhost:3003` |
| Event command | `http://localhost:3004` |

## Product Boundaries

- Public pages are landing and inquiry only.
- Dashboards are signed-in surfaces.
- Event creation and portal access are gated by accepted inquiry plus signed conforme.
- Clients submit layout preferences from confirmed events; PMCM owns official floorplan editing in `apps/event`.
- Shared contracts belong in `packages/types`.
- Shared request wrappers belong in `packages/api-client`.
- Shared presentation primitives belong in `packages/ui`.
- Role apps must not import each other's internals.

Check import boundaries before merging architectural refactors:

```bash
npm run check:boundaries
```

## Backend Architecture

`apps/api` remains one shared NestJS API for the Prism. Event operations live under `libs/modules/event-ops` with service seams for audit, suppliers, and coordinators, while controllers keep the public API shape stable.

Useful API commands:

```bash
cd apps/api
npm run test:event-ops
npm run typecheck
npm run build
npm run prisma:validate
```

Useful event portal command:

```bash
cd apps/event
npm run build
```

Root workspace gates:

```bash
npm run typecheck
npm run build
```

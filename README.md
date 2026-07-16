# P.R.I.S.M

P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It is split into role-specific portals backed by one shared API.

## Canonical Docs

Full map: [`docs/README.md`](docs/README.md). Agents: [`AGENTS.md`](AGENTS.md).

| Document | Purpose |
| --- | --- |
| `docs/prism-v4/15-system-architecture.md` | Role-app / API / package architecture, boundaries, stop rules |
| `docs/prism-v4/11-feature-ledger.md` | Feature-family decisions and verification |
| `docs/prism-v4/10-product-evolution-and-redesign-governance.md` | Add / revise / merge / defer / retire rules |
| `docs/prism-v4/14-redesign-readiness-foundation.md` | Sample-state fencing, session keys, owner boundaries |
| `docs/prism-v4/07-implemented-feature-revisions.md` | Implementation reality and gaps |
| `docs/prism-v4/12-redesign-inventory.md` | Route inventory and redesign severity |
| `docs/prism-v4/16-actual-system.md` | Actors, lifecycle, workflows |
| `docs/prism-v4/18-future-state.md` | Target state |
| `docs/prism-v4/01-complete-feature-catalog.md` | Baseline catalog / manuscript counts (not a hard ceiling) |
| `docs/portal-accounts.md` | Sample sign-in accounts |
| `docs/docker-dev-testing-guide.md` | Docker detail |

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

**Normal (fast) — local Node hot reload:**

```bat
start-prism.cmd
stop-prism.cmd
```

**Docker (slower image build) — separate commands:**

```bat
start-prism-docker.cmd
stop-prism-docker.cmd
```

| App | URL |
| --- | --- |
| API | `http://localhost:4000` |
| Client portal | `http://localhost:3001` |
| Supplier portal | `http://localhost:3002` |
| Guest portal | `http://localhost:3003` |
| Event command | `http://localhost:3004` |

Sample sign-in accounts: [`docs/portal-accounts.md`](docs/portal-accounts.md).

### Local options (`start-prism.cmd`)

```bat
start-prism.cmd              rem npm run dev for API + 4 portals
start-prism.cmd -Prod        rem full build then npm run start
start-prism.cmd -Install     rem force npm install first
start-prism.cmd -SkipBuild   rem with -Prod, skip monorepo build
stop-prism.cmd               rem stop local Node only
stop-prism.cmd -All          rem stop local Node + Docker
```

Logs: `.local-dev\logs`. Requires `apps/api/.env` with database URLs.

### Docker options (`start-prism-docker.cmd`)

```bat
start-prism-docker.cmd              rem compose.local.yml build + start
start-prism-docker.cmd -Dev         rem compose.dev.yml hot reload
start-prism-docker.cmd -Foreground  rem attach logs
stop-prism-docker.cmd               rem docker compose down
stop-prism-docker.cmd -Volumes      rem also remove volumes
```

API containers read `.env.docker` (auto-synced from `apps/api/.env` when empty). Do not commit `.env.docker`.

More Docker detail: [`docs/docker-dev-testing-guide.md`](docs/docker-dev-testing-guide.md).

## Product Boundaries

- Public pages are landing and inquiry only.
- Dashboards are signed-in surfaces.
- Event creation and portal access are gated by accepted inquiry plus signed conforme.
- Clients submit layout preferences from confirmed events; PMCM owns official floorplan editing in `apps/event`.
- Shared contracts belong in `packages/types`.
- Shared request wrappers belong in `packages/api-client`.
- Shared presentation primitives belong in `packages/ui`.
- Role apps must not import each other's internals.
- `/api/sample/state` and local sample state are compatibility-only for seed/demo/reset paths; new app work should use scoped APIs.
- Session and sample storage keys belong in `@prism/types`; role apps should not add new literal `prism:*` storage keys.
- Redesign work should name the owner system goal it advances: Owner A (Maxine) for product/UX coherence, Owner B (Francis) for PMCM/coordinator operability, Owner C (Ethan) for safe external portals, and Owner D (Anthony) for platform trust.

Check import boundaries before merging architectural refactors:

```bash
npm run check:boundaries
```

## Backend Architecture

`apps/api` is one shared NestJS modular monolith. Capability modules under `libs/modules/<capability>/` own writes (inquiry, commercial, supplier, finance, floorplan, guest, live-ops, sample-compatibility, and others). `event-read-models` composes role-scoped reads only. See [`docs/prism-v4/15-system-architecture.md`](docs/prism-v4/15-system-architecture.md).

Useful API commands:

```bash
cd apps/api
npm run test
npm run test:sample-compatibility
npm run typecheck
npm run build
npm run prisma:validate
```

Database domain checks:

```bash
cd apps/api
npm run db:verify:offline
npm run db:audit:queries
npm run db:audit:schemas
npm run db:audit:naming
npm run db:audit:indexes
npm run db:perf:report
```

`db:verify:offline` and `db:audit:queries` are safe local checks. Live schema, naming, and index audits need a reachable migrated database. `db:perf:report` reads `pg_stat_statements` with credential redaction.

Useful event portal command:

```bash
cd apps/event
npm run build
```

Root workspace gates:

```bash
npm run typecheck
npm run build
npm run check:boundaries
```

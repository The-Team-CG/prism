# P.R.I.S.M

P.R.I.S.M is an internal event-operations system for PMCM teams. Four role-specific
portals use one NestJS API and PostgreSQL database.

## Run locally

Requires Node.js 24 or later, npm 11.6.2, and Docker Desktop's Linux engine.
Startup prepares a lean local Supabase database and Studio, waits for readiness,
and applies checked-in Prisma migrations before launching apps. It generates
ignored development environments without reading hosted database credentials.
Normal stop/start preserves local data. Fresh local data contains no production
users/events; fixtures are never inserted automatically.

On Windows, run from the repository root:

```bat
start-prism.cmd
start-prism.cmd -DatabaseOnly         rem database and migrations only
start-prism-docker.cmd -Dev           rem Docker hot reload with Compose Watch
start-prism-docker.cmd                rem built local images
```

Stop Node and local Supabase with `stop-prism.cmd`; use
`stop-prism-docker.cmd` for Docker. Data is retained. See the
[Docker runbook](docs/runbooks/docker-dev-testing.md) for rebuilds, worktrees,
and data lifetime. Deployed environments use one `DATABASE_URL`; `DIRECT_URL`
is an optional migration connection override.

The first start installs locked dependencies when needed, generates the Prisma
client, builds shared types, and starts the API and portals in development mode.

On other platforms, run `npm run db:local:start`, select `.local-dev/api.env`
through `PRISM_ENV_FILE`, then start each workspace in its own terminal:

```bash
npm run dev:api
npm run dev:client
npm run dev:supplier
npm run dev:guest
npm run dev:event
```

| Surface | Primary-checkout URL |
| --- | --- |
| API | `http://localhost:4000` |
| Client portal | `http://localhost:3001` |
| Supplier portal | `http://localhost:3002` |
| Guest portal | `http://localhost:3003` |
| Event command | `http://localhost:3004` |
| Supabase Studio | `http://127.0.0.1:54323` |

Linked worktrees may use different ports; run `npm run ports` to see them. Local
fixture accounts are in the [portal accounts runbook](docs/runbooks/portal-accounts.md).

For repeatable accounts and UAT data on an existing database, use the standalone
[fixture commands](docs/runbooks/environments-and-fixtures.md). They require an
explicit private env file and run without starting or building the API.

## Verify changes

```bash
npm run typecheck
npm run test:api
npm run check:boundaries
npm run test:boundaries
```

For engineering conventions, read [AGENTS.md](AGENTS.md). For architecture, product
decisions, and operating procedures, start at the [documentation index](docs/index.md).

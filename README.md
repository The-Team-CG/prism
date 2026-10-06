# P.R.I.S.M

P.R.I.S.M is an internal event-operations system for PMCM teams. Four role-specific
portals use one NestJS API and PostgreSQL database.

## Run locally

Requires Node.js 24 or later and npm 11.6.2, as pinned in `package.json`.
Configure `apps/api/.env` from `apps/api/.env.example` with a development
database. Read the [database migration runbook](docs/runbooks/database-migrations.md)
before applying its checked-in migrations with
`npm --workspace prism-api run db:setup`. The launcher does not apply migrations.

On Windows, run from the repository root:

```bat
start-prism.cmd
```

When finished, stop the local services with `stop-prism.cmd`.

The first start installs locked dependencies when needed, generates the Prisma
client, builds shared types, and starts the API and portals in development mode.

On other platforms, start each workspace in its own terminal from the repository
root:

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

Linked worktrees may use different ports; run `npm run ports` to see them. Local
fixture accounts are in the [portal accounts runbook](docs/runbooks/portal-accounts.md).

## Verify changes

```bash
npm run typecheck
npm run test:api
npm run check:boundaries
npm run test:boundaries
```

For engineering conventions, read [AGENTS.md](AGENTS.md). For architecture, product
decisions, and operating procedures, start at the [documentation index](docs/index.md).

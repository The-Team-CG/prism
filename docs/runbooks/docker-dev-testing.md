---
type: "Playbook"
title: "P.R.I.S.M local Supabase and Docker development"
description: "Isolated local database startup, Docker modes, source syncing, and persistent development data."
tags: [runbook, docker, supabase, development]
status: canonical
updated: "2026-10-29"
authority: operational
audience: [developers, QA, agents]
scope: "local Prism Node/Docker startup and database isolation"
last_verified: "2026-10-29; launcher switches, local-supabase lifecycle and generated env, compose files, and Supabase config reviewed; stack not started"
sources:
  - id: startup
    resource: "start-prism.ps1"
    title: "Development startup wrapper"
  - id: local-database
    resource: "scripts/local-supabase.mjs"
    title: "Local Supabase lifecycle"
  - id: containers
    resource: "Dockerfile"
    title: "Scoped builds and runtime images"
---
# Local Supabase and Docker development

## At a glance

- **Purpose:** Start Prism on a persistent local database without hosted credentials.
- **Prerequisites:** Node 24, npm, Docker Desktop with its Linux engine.
- **Database:** Supabase CLI 2.115.0 (root dev dependency), Postgres 17, Studio, metadata, gateway and REST dependencies. This CLI rejects Postgres 16; the repository's migration CI still replays PostgreSQL 16. Supabase Auth, Realtime, functions, analytics, SMTP and pooler are disabled. Storage is disabled unless `PRISM_LOCAL_SUPABASE_STORAGE=1` is set before startup; the wrapper then starts Supabase Storage, creates a private bucket, and points the API's `supabase` storage adapter at it.
- **Schema:** Prisma migrations in `apps/api/prisma/migrations`; Supabase application migrations and automatic seeding are disabled.
- **Verification:** Launch the selected mode, check API/portal HTTP readiness, and confirm source reload and database persistence when changing startup behavior.

## Start and stop

```powershell
npm install
.\start-prism.cmd                       # Node dev servers + local Supabase
.\start-prism.cmd -DatabaseOnly         # database + migrations only
.\start-prism-docker.cmd -Dev           # container dev servers + Compose Watch
.\start-prism-docker.cmd                # built local images
.\start-prism-docker.cmd -Dev -Foreground
.\stop-prism.cmd                       # Node apps and Supabase; preserve DB data
.\stop-prism-docker.cmd                # Compose apps and Supabase; preserve DB data
.\stop-prism.cmd -All                  # Docker stacks and Node apps
```

The same lifecycle is available without launching apps through
`npm run db:local:start`, `db:local:status`, and `db:local:stop`.
Set `PRISM_LOCAL_MAILPIT=1` before startup to capture local mail in a
checkout-specific Mailpit inbox instead of the API log (see the
[browser acceptance guide](../../scripts/e2e/browser/README.md#local-test-inbox-for-manual-development)).

The first start downloads images. Every start verifies the local target, waits
for database readiness, applies pending Prisma migrations, and launches the
apps only after success. A readiness timeout exits with failure.

The primary checkout exposes portals on 3001–3004 and API on 4000. Supabase
uses database port 54322 and Studio at `http://127.0.0.1:54323`.
`start-prism.cmd -Prod` builds and starts the Node apps while still using the
local database; it does not select a production database.

The Supabase CLI publishes its ports on the Docker host; these are local
infrastructure endpoints with development credentials, not an internet-facing
hosting setup. No CLI login, project link or hosted push is part of startup.

## One database URL

`DATABASE_URL` is sufficient for the API, Prisma and database scripts.
`DIRECT_URL` is an optional migration-only override. `SUPABASE_DB_URL` and
`PRISMA_DATABASE_URL` remain fallback aliases for existing installations;
`DATABASE_URL` wins over those aliases.

Development wrappers generate these ignored files:

- `.local-dev/api.env`: host connection, local API/portal URLs, local flags, CORS, mock AI and local session secret.
- `.local-dev/docker.env`: container connection via `host.docker.internal`.
- `.local-dev/database.json`: project ID, ports and Studio URL; no database password.
- `.local-dev/supabase/supabase/config.toml`: checkout-specific infrastructure.

They do not read `apps/api/.env` or `.env.docker`. API and Prisma respect
`PRISM_ENV_FILE`. Local mode validates host, port and database name and rejects
remote migration/shadow overrides before opening a connection.

To run a database command in a separate PowerShell terminal:

```powershell
$env:PRISM_ENV_FILE = (Resolve-Path .local-dev/api.env).Path
npm --workspace prism-api run db:doctor
npm --workspace prism-api run db:status
```

A fresh local database contains migrated schema, not production users/events.
Startup does not insert fixtures. The existing fixture CLI remains guarded to
an empty loopback database named `prism_sample_disposable`; see
[portal accounts](portal-accounts.md). Do not run that command against the
Supabase `postgres` database or change its safety acknowledgement casually.

## Docker development

All five dev services reuse `prism-dev:local`. Linux dependencies live in the
image, so rebuilding after package/lock changes replaces dependencies without
stale node_modules volumes. Compose Watch syncs source/config changes. After
dependency manifests, lockfile or Dockerfile changes, rerun
`start-prism-docker.cmd -Dev` to rebuild the shared image once and recreate all
consumers. Automatic rebuild triggers are omitted to avoid concurrent builds
of the same tag. Watch ignores `.env`, Windows dependencies,
compiled output and caches. Containers watch Linux files without forced polling.

Shared types are built in the image and watched in each consuming container;
containers own their compiled output independently. Each portal retains its
own `.next` cache volume. API compilation output is container-local.

Detached startup launches a hidden Compose Watch process with a saved process
creation identity. Stop removes only the matching owned watcher. Logs:
`.local-dev/compose-watch.log`. Foreground startup uses `up --watch` directly.

Built images use scoped Turbo dependency builds. Portal images use standalone
Next output plus their own static/public assets. API images carry compiled API
output, generated Prisma dependencies and shared types; its dependency install
includes only API runtime workspaces. The shared dev image omits npm's download
cache. Builds run serially without cache mounts because parallel builds have
crashed Docker Desktop.

```powershell
docker compose -f compose.dev.yml logs -f api
docker compose -f compose.dev.yml ps
docker compose -f compose.local.yml logs -f
```

Direct Compose commands require the generated database environment and a running
local Supabase first. Use `start-prism.cmd -DatabaseOnly` to prepare it.

## Data and cache lifetime

Normal stop uses `supabase stop` without `--no-backup`; schema and data survive.
Supabase resources belong to its checkout-specific CLI project and are separate
from the Compose app projects. `stop-prism-docker.cmd -Volumes` removes app
caches only. It does not delete Supabase database data.

A reset or `supabase stop --no-backup` is destructive and requires explicit
approval. Cache trouble is not a reason to reset the database.

## Worktrees and troubleshooting

Each checkout gets its own Supabase project, data, and port block; see
[parallel worktrees](parallel-worktrees.md#isolated-local-supabase). A replaced
initial baseline selects a separate database after backing up the current
project; normal forward migrations retain data. Docker app mode remains
restricted to the primary checkout.

- Docker unavailable: start Docker Desktop's Linux engine; the wrapper waits for it.
- Migration failure: apps are not launched; inspect the local migration error.
- DB target rejection: use the generated env file; remove unintended CLI overrides.
- Hot reload absent: inspect the Compose Watch log or use `-Dev -Foreground`.
- Stale package exports: rebuild `@prism/types`; dependency edits require an image rebuild.
- Port in use: stop the owning stack. Preserve foreign processes and other Supabase projects.

## Validation

Use API health and actual portal responses after startup; a Compose config or
successful image build alone does not prove the stack can run. API runtime
images include the checked-in migration SQL for the exact-ledger startup gate.
When changing migrations, also use the repository's PostgreSQL 16 replay gate;
the pinned local Supabase stack runs PostgreSQL 17.

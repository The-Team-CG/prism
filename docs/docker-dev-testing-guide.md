# Docker Dev Testing Guide

This guide explains how to run P.R.I.S.M with Docker for local testing. It assumes you are new to Docker and want clear commands you can copy into a terminal.

## What Docker Does Here

Docker lets you run the whole system in containers instead of installing and starting every app manually.

P.R.I.S.M has five local services:

| Service | What it is | URL |
| --- | --- | --- |
| API | Shared NestJS backend | `http://localhost:4000` |
| Client portal | Client-facing app | `http://localhost:3001` |
| Supplier portal | Supplier-facing app | `http://localhost:3002` |
| Guest portal | Guest-facing app | `http://localhost:3003` |
| Event command | PMCM/admin event app | `http://localhost:3004` |

The repo has two Docker Compose files:

| File | Use it when | Behavior |
| --- | --- | --- |
| `compose.local.yml` | You want a production-style local test | Builds the apps, then runs optimized production servers. Changes in code do not hot reload. |
| `compose.dev.yml` | You are actively editing code | Runs dev servers with hot reload and mounts your local files into the containers. |

Most day-to-day development should use `compose.dev.yml`.

## Before You Start

Install Docker Desktop first.

On Windows:

1. Install Docker Desktop.
2. Use the WSL 2 backend if Docker asks.
3. Start Docker Desktop before running any commands.
4. Open PowerShell in the repo root: `C:\Codes\prism`.

Check Docker is working:

```powershell
docker --version
docker compose version
```

If either command fails, Docker Desktop is not installed, not running, or not on your PATH.

## Environment File

The API container reads `.env.docker`.

Create it from the example:

```powershell
Copy-Item .env.docker.example .env.docker
```

macOS/Linux equivalent:

```bash
cp .env.docker.example .env.docker
```

Then edit `.env.docker` and fill in the database values.

Important notes:

- Do not commit `.env.docker`.
- For Supabase, keep `DB_SSL=true`.
- If using the Supabase pooler on a free tier, keep `ALLOW_POOLER_FOR_PRISMA=1`.
- If the database is paused, the API may fail until Supabase is resumed.
- If you do not have a real database URL yet, the containers can build, but API runtime/database tests may fail.

The example file has these keys:

```dotenv
SUPABASE_DB_URL=
DATABASE_URL=
PRISMA_DATABASE_URL=
DIRECT_URL=
DB_SSL=true
ALLOW_POOLER_FOR_PRISMA=1
PARE_MODE=mock
```

For local testing, the database URL values usually point to the same local or Supabase database connection unless you are intentionally testing separate runtime/direct connections.

## Option 1: Dev Mode With Hot Reload

Use this when you are editing code and want the app to update while containers are running.

Start the full dev stack:

```powershell
docker compose -f compose.dev.yml up --build
```

What this does:

- Builds the Docker image using the `dev` target in `Dockerfile`.
- Starts the API in watch mode.
- Starts all four Next.js apps in dev mode.
- Mounts your repo into `/app` inside each container.
- Keeps Linux `node_modules` in Docker volumes so Windows `node_modules` do not conflict with container dependencies.

After startup, open:

- Event command: `http://localhost:3004`
- Client portal: `http://localhost:3001`
- Supplier portal: `http://localhost:3002`
- Guest portal: `http://localhost:3003`
- API health: `http://localhost:4000/health`

Stop the stack:

```powershell
Ctrl+C
```

Or, from another terminal:

```powershell
docker compose -f compose.dev.yml down
```

### Run Dev Mode In The Background

```powershell
docker compose -f compose.dev.yml up --build -d
```

View logs:

```powershell
docker compose -f compose.dev.yml logs -f
```

View logs for one service:

```powershell
docker compose -f compose.dev.yml logs -f api
docker compose -f compose.dev.yml logs -f event
```

Stop background containers:

```powershell
docker compose -f compose.dev.yml down
```

## Option 2: Production-Style Local Mode

Use this when you want to test the built system closer to how it runs after a production build.

Start the production-style local stack:

```powershell
docker compose -f compose.local.yml up --build
```

What this does:

- Builds the repo with `npm run build` inside Docker.
- Starts the API from compiled NestJS output.
- Starts each Next.js app with `next start`.
- Does not hot reload code changes.

Use this before calling something ready for review if you want a stronger local runtime check.

Stop it:

```powershell
docker compose -f compose.local.yml down
```

## Hot Reload Explained

Hot reload means you can edit code on your machine and the running app updates without rebuilding the full Docker image.

In this repo, hot reload is provided by `compose.dev.yml`.

Examples:

- Edit a React component in `apps/event`.
- Save the file.
- The event app container detects the change.
- Refresh `http://localhost:3004` if the browser does not update automatically.

When hot reload may not be enough:

- You changed `package.json` or `package-lock.json`.
- You added a new dependency.
- You changed Dockerfile or compose files.
- You changed generated Prisma/client behavior and need a clean rebuild.

In those cases, rebuild:

```powershell
docker compose -f compose.dev.yml up --build
```

If it still behaves strangely, reset Docker volumes as shown below.

## Useful Docker Commands

See running containers:

```powershell
docker ps
```

See all containers, including stopped ones:

```powershell
docker ps -a
```

Build without starting:

```powershell
docker compose -f compose.dev.yml build
```

Start only the API and event command app in dev mode:

```powershell
docker compose -f compose.dev.yml up --build api event
```

Run a command inside the API container:

```powershell
docker compose -f compose.dev.yml exec api npm --workspace prism-api run typecheck
```

Run API tests inside the API container:

```powershell
docker compose -f compose.dev.yml exec api npm --workspace prism-api run test
```

Run a shell inside the API container:

```powershell
docker compose -f compose.dev.yml exec api sh
```

## Clean Rebuilds

Use a normal rebuild first:

```powershell
docker compose -f compose.dev.yml down
docker compose -f compose.dev.yml up --build
```

If dependencies or caches are broken, remove Docker volumes too:

```powershell
docker compose -f compose.dev.yml down -v
docker compose -f compose.dev.yml up --build
```

Be careful with `down -v`:

- It deletes Docker named volumes for this compose project.
- In this repo, those volumes mainly hold container `node_modules`, `.next`, and API `dist` output.
- It does not delete your source code.
- It may make the next startup slower because dependencies must be recreated.

For a full no-cache rebuild:

```powershell
docker compose -f compose.dev.yml build --no-cache
docker compose -f compose.dev.yml up
```

## Common Problems

### Docker says the port is already allocated

Example: port `3004` or `4000` is already in use.

Fix:

1. Stop other local Prism scripts or dev servers.
2. Check running containers:

```powershell
docker ps
```

3. Stop the current Docker stack:

```powershell
docker compose -f compose.dev.yml down
```

If a non-Docker process owns the port, stop that process before starting Docker again.

### API starts but web apps cannot call it

Check:

- API health: `http://localhost:4000/health`
- `.env.docker` exists.
- Database URL values are filled in.
- Supabase project is not paused.
- `DB_SSL=true` for Supabase.

View API logs:

```powershell
docker compose -f compose.dev.yml logs -f api
```

### Changes do not show in the browser

Try:

1. Refresh the browser.
2. Check the service logs.
3. Restart the dev stack.

```powershell
docker compose -f compose.dev.yml down
docker compose -f compose.dev.yml up --build
```

If a dependency changed, use `down -v` and rebuild.

### Build is slow the first time

This is expected.

The first build downloads Node packages and builds app caches. Later builds should be faster because Docker reuses layers and named volumes.

### `node_modules` looks confusing

This is normal for the dev Docker setup.

`compose.dev.yml` uses named Docker volumes for container `node_modules`. That means:

- The container gets Linux-compatible dependencies.
- Your Windows files stay mounted for editing.
- You should not manually copy local Windows `node_modules` into the container.

## Which Mode Should I Use?

Use this quick rule:

| Goal | Command |
| --- | --- |
| I am editing code | `docker compose -f compose.dev.yml up --build` |
| I want hot reload | `docker compose -f compose.dev.yml up --build` |
| I want a production-style local test | `docker compose -f compose.local.yml up --build` |
| I changed dependencies | `docker compose -f compose.dev.yml down -v`, then `docker compose -f compose.dev.yml up --build` |
| I only need API and event command | `docker compose -f compose.dev.yml up --build api event` |

## Quick Start

For most local development:

```powershell
Copy-Item .env.docker.example .env.docker
# Edit .env.docker and fill database values.
docker compose -f compose.dev.yml up --build
```

Then open:

```text
http://localhost:3004
```

For production-style testing:

```powershell
docker compose -f compose.local.yml up --build
```
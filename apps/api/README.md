# prism-api

NestJS backend for p.r.i.s.m, implemented as a modular monolith.

## Why modular monolith first

- One deployable artifact and one runtime to keep early deployment simple.
- Clear bounded contexts to avoid accidental coupling between features.
- Straightforward extraction path to microservices when scaling requires it.

## Current module boundaries

- `templates`: template lifecycle and base-layout creation.
- `events`: event lifecycle and template instantiation.
- `plans`: editable floor-plan read/write operations.
- `publish`: publishing and snapshot retrieval.
- `shared`: infrastructure-only concerns (`DatabaseService`, pg pool).

## Extraction-ready conventions

- Controllers depend on module-local application services.
- Cross-cutting infrastructure lives in `libs/shared`.
- Domain logic is not centralized in a single global service.
- Module contracts are method-level and easy to move behind transport adapters later.

## Run locally

```bash
npm install
npm run db:setup
npm run dev
```

API default URL: `http://localhost:4000`
Health endpoint: `http://localhost:4000/health`

## Database

- Backed by Supabase Postgres with Prisma schema + migrations.
- Prisma datamodel is in `prisma/schema.prisma`.
- Migration files are in `prisma/migrations`.
- IDs are stored as `text` to support route-friendly plan IDs (for example `sample-plan`).
- Floor plan objects are also stored in `floor_plan_objects` with `object_data` JSONB and `svg_markup` text.
- `floor_plans.objects` is kept as a compatibility cache for existing flows.
- Set DB URLs in `.env`:
  - `SUPABASE_DB_URL`/`DATABASE_URL` for runtime connections.
  - `DIRECT_URL` (or `PRISMA_DATABASE_URL`) for Prisma CLI migration commands.
- Use `npm run db:status` to verify migration state.
- Use `npm run db:verify` for a non-destructive verification pass (connectivity, migration status, schema+migrations consistency).
- Use `npm run db:setup` to apply pending migrations.
- Use `npm run db:reset` to rebuild schema from migrations in dev/test (destructive; gated).

### Non-destructive migration verification

Checklist (safe, read-only on the database):

```bash
npm run db:doctor
npm run db:status
npm run db:verify:offline
```

Notes:

- `npm run db:doctor` defaults to a strict Prisma/migrations mode and refuses Supabase pooler/pgbouncer URLs unless `ALLOW_POOLER_FOR_PRISMA=1` is set. Configure `DIRECT_URL` (or `PRISMA_DATABASE_URL`) to the direct host for Prisma CLI.
- `npm run db:verify:offline` does not connect to the database; it checks that `prisma/schema.prisma` matches the migration history in `prisma/migrations`.
- `prisma migrate dev` (used by `npm run db:migrate`) typically requires a `SHADOW_DATABASE_URL` pointing at a database where Prisma can create and drop shadow objects; Supabase hosted databases usually do not allow this.
- For drift checks against a live database (still non-destructive), run `prisma migrate diff` manually and review the SQL output before applying anything.

### Destructive commands (dev/test only)

`npm run db:reset` runs `prisma migrate reset --force` and will drop data. It is gated behind `PRISM_API_DB_RESET_I_UNDERSTAND=1`.

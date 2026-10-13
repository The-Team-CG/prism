---
type: "Runbook"
title: "Vercel services deployment"
description: "Build and route the API and four role portals as one Vercel project."
tags: [deployment, vercel, services]
status: active
updated: "2026-10-14"
authority: operational
owner: "D (Anthony)"
audience: [maintainers, engineers]
scope: "single-project Vercel services deployment"
last_verified: "2026-10-14"
sources:
  - resource: "vercel.json"
    title: "Service and public routing configuration"
  - resource: "packages/api-client/src/http.ts"
    title: "Runtime API URL resolution"
  - resource: "https://vercel.com/docs/services"
    title: "Vercel services documentation"
---
# Vercel services deployment

## At a glance

- Purpose: Run the existing Nest API and four Next portals in one Vercel project.
- Authority: Operational configuration under the repository's role and context rules.
- Owner: D (Anthony), platform trust and deployment.
- Scope: Builds, public routing, runtime bindings and verification.
- Use when: Preparing or testing the single-project deployment.
- Change when: Service names, portal mounts, callers or runtime requirements change.
- Verify with: Transport tests, portal typechecks, boundary checks, services builds and `vercel dev -L`.

## Proposed public routes

The configuration is prepared for review. Confirm these names and mounts before
connecting a deployment:

| Service | Root | Public paths | Caller binding |
| --- | --- | --- | --- |
| api | apps/api | /api and descendants; /health | none |
| client | apps/client | remaining paths, including / | api through PRISM_API_URL |
| event | apps/event | /event and descendants | api through PRISM_API_URL |
| guest | apps/guest | /guest and descendants | api through PRISM_API_URL |
| supplier | apps/supplier | /supplier and descendants | api through PRISM_API_URL |

All five services receive public traffic. Signed-in portal routes still require
the existing application sessions and API authorization. Bindings do not grant
an actor session or bypass RBAC. The root Dockerfile is a multi-stage builder
for these apps, so it is not declared as a sixth `app` service.

Vercel preserves the incoming path. Nest already owns `/api`; `/health` is
excluded from that global prefix. Next uses a build-time `basePath` for the
three prefixed portals when `PRISM_VERCEL_SERVICES=1`. Native anchors use the shared
`portalHref` helper; Next links and router navigation apply `basePath` themselves.
Ordinary local Node and Docker development retain their existing root routes.
Turborepo includes `PRISM_VERCEL_SERVICES` in the build cache key to separate these outputs.

## API calls and bindings

Each portal declares its own binding to `api`. Vercel injects `PRISM_API_URL` at
function runtime. Never set it manually, rename it to a `NEXT_PUBLIC_*`
variable, or use it from middleware or a build script. The transport reads it
when a request executes, including when the client was constructed earlier.

Browsers call the public same-origin `/api` URL. The Next service configuration
supplies empty `NEXT_PUBLIC_API_URL` and `/api` as
`NEXT_PUBLIC_PRISM_API_BASE_URL`, overriding standalone local URL settings.
Server calls use the internal binding and retain `/api` and bearer tokens.
There are no API-to-portal or portal-to-portal HTTP calls requiring bindings.
An explicit per-request `baseUrl` remains an override.

## Project and environment setup

Use one Vercel project with the repository root as its Root Directory. The
service roots come from `vercel.json`. Use Node 24 and npm workspaces. The Services build/dev wrapper enables that flag automatically. Existing
standalone Vercel projects do not enable it. Each
service builds its workspace and dependencies from the repository root;
installation generates Prisma and builds `@prism/types` through existing hooks.
Do not put build or install fields at the top level of `vercel.json`.

Configure real deployment inputs through Vercel environment settings:

- `DATABASE_URL`: the target PostgreSQL runtime connection. `DIRECT_URL` is an
  optional migration-only override. Run migrations as a separate, controlled
  database operation, never as a portal build side effect.
- `PRISM_SESSION_SECRET`: a strong deployment signing secret. Use
  `NODE_ENV=production`; do not enable the local session-secret fallback.
- `CORS_ORIGIN`: comma-separated public origins, including preview and custom
  domains that will call the API. Use exact origins without portal path suffixes.
- Configure AI and external delivery providers only for intended capabilities.
  Retain the mock AI profile until live use is explicitly configured.
- Password-reset delivery uses the existing single `PRISM_PORTAL_RESET_URL`.
  Include the portal prefix in that URL when relevant. Per-role reset delivery
  remains a separate capability decision.

Vercel environment variables are shared across the project's services. Keep
secrets server-only and out of `NEXT_PUBLIC_*`. Do not upload local Supabase
credentials as production settings.

## Background work and storage limitations

The API currently starts interval-based compliance, conforme, wrap-up, payment
risk, coordinator reminder and supplier ingress workers. Notification and PARE
outbox services also poll with timers and run an initial sweep on bootstrap.
Vercel functions do not guarantee a continuously running process. Those workers
need durable scheduled execution before this target can replace the existing
full operational deployment. HTTP readiness does not verify reminder or outbox
delivery. Their existing disable flags do not disable the two outbox workers.

Choose the scheduling arrangement before production cutover. Keeping a dedicated
worker runtime or adding authenticated scheduled functions are possible follow-up
designs. Neither is configured by this change. Do not claim operational parity
or rely on request-driven function lifetimes for scheduled work.

The local filesystem storage adapter is not durable deployment storage. Use an
external production object-storage adapter when uploads are enabled; otherwise
keep the existing upload configuration gates.

The existing GitHub Actions deployment workflow still targets a Render API and
four separate Vercel projects. This single-project configuration is an additional
deployment target and does not migrate provider credentials, project IDs or the
promotion workflow. Confirm workflow migration separately before cutover.

## Local verification

Run from the repository root with a CLI that supports Services:

```sh
npx vercel dev -L --listen 3100
```

The Services wrapper sets `PRISM_VERCEL_SERVICES=1`. Select an explicit prepared local database with
an absolute `PRISM_ENV_FILE` path. The Services dev commands bypass the ordinary
checkout port wrappers so Vercel can allocate service ports and inject bindings.
Do not manually supply `PRISM_API_URL`.

Check `/`, `/event`, `/guest`, `/supplier`, their sign-in/access links, their
prefixed Next assets, `/health`, a browser API read and an authenticated mutation
with the intended role. Verify forbidden roles remain forbidden. Build with
`PRISM_VERCEL_SERVICES=1` so the deployed prefixes are exercised. Passing local tests does not
prove a cloud deployment, database migration or durable worker execution.

## Verification evidence

The Services-mode monorepo build and monorepo typecheck passed. Shared API
transport tests passed 33/33; client, event, supplier and guest suites passed
61/61, 230/230, 26/26 and 13/13. The boundary scan and 53 boundary tooling tests
passed. Built portal landing pages and one prefixed Next asset per portal
returned HTTP 200, with role-prefixed native links. Runbook metadata,
relative links and diff whitespace checks passed.

Vercel CLI 64.0.1 detected all five services during `vercel dev -L`, but
dependency synchronization stalled. Full local service routing, live API
bindings, authenticated cloud behavior and cloud deployment remain unverified.
Temporary verification servers were stopped. No project was linked or deployed.

## References

- [Services](https://vercel.com/docs/services)
- [Routing](https://vercel.com/docs/services/routing)
- [Bindings](https://vercel.com/docs/services/bindings)
- [NestJS](https://vercel.com/docs/frameworks/backend/nestjs)

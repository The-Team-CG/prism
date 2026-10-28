---
type: "Decision"
title: "Retire the broad sample runtime; keep local fixture seeding"
description: "Remove whole-system sample APIs and browser-local demo state while retaining guarded, seed-only development data."
tags: [architecture, decision, fixtures, api, compatibility]
status: canonical
updated: "2026-10-28"
authority: normative
audience: [agents, engineers, backend-engineers, frontend-engineers, reviewers]
scope: "API runtime surfaces, portal fallback state, and local development fixture setup"
last_verified: "2026-09-30; focused checks in PR"
decision_date: "2026-09-30"
sources:
  - id: api-composition
    resource: "apps/api/src/app.module.ts"
    title: "API HTTP module composition"
  - id: local-fixtures
    resource: "apps/api/src/fixtures"
    title: "Guarded local fixture seeding"
  - id: fixture-cli
    resource: "apps/api/scripts/seed-local-fixtures.mjs"
    title: "Direct database fixture seed command"
---
# ADR-0007: Retire the broad sample runtime; keep local fixture seeding

## At a glance

- **Decision:** Remove the sample runtime mode and keep its development data only as local fixtures inserted by an explicit seed command.
- **Applies to:** API routes, API-client contracts, browser state, and developer database setup.
- **Use when:** Adding development fixture data or changing local seed behavior.
- **Change when:** The setup target, database guard, or role-scoped workflow ownership changes.
- **Verify with:** Seed guard behavior tests, touched portal/API checks, boundary scan, and API typecheck/build.

**Decision status:** Accepted
**Scope:** Runtime compatibility state and local development fixture seeding

## Context

The former compatibility layer combined a broad state read, a database reset
route, API-client wrappers, and a client-side local mode. That duplicated
role-scoped API workflows, made a shared non-production route a high-risk data
surface, and let local browser state conceal API failures. The role-scoped API
controllers now provide the supported portal flows.

## Decision

- Remove the broad sample state/reset controllers, guards, and compatibility
  service from the Nest HTTP application.
- Remove the associated API-client methods and shared whole-system sample
  state contract.
- Remove client browser-local demo state and its fallback branches. Portals use
  the existing role-scoped APIs.
- Keep the development account/event/workflow data under
  `apps/api/src/fixtures/` as seed-only tooling. The fixture module is loaded
  by the CLI and is never imported into `AppModule`.
- Provision fixtures only with
  `npm --workspace prism-api run db:seed:fixtures -- --confirm-disposable-db prism_sample_disposable`.
  The command rejects production, non-loopback hosts, a different database
  name, and populated seed tables. It inserts records and contains no delete or
  reset operation.
- API startup never seeds data. Recreate and migrate an empty disposable local
  database before reseeding.
- Run payment-risk evaluation from the commercial scheduler rather than from a
  compatibility state read. Each milestone's conditional status transition
  and audit write share a transaction; duplicate scheduler runs do not create
  duplicate transition audits. Set `PRISM_DISABLE_PAYMENT_RISK_JOB=1` to turn
  off the scheduler for a deployment.
- Keep stable fixture record IDs where current tests and runbooks depend on
  them; these are data identifiers, not a runtime sample mode.

## Rejected alternatives

- Retaining the aggregate behind authentication was rejected because the
  scoped controllers already cover product workflows and the aggregate still
  creates a second, wide API contract.
- Keeping a browser-local fallback was rejected because it can hide failures
  in the supported API path.
- Seeding automatically at startup was rejected because it makes application
  startup mutate data and can target an unintended non-production database.
- Reusing fixture seed code inside a business context was rejected because
  setup spans multiple contexts and has no product write authority.

## Consequences

- Local portal walkthroughs require an explicitly seeded disposable database
  and the same scoped APIs used by normal application behavior.
- `GET /api/sample/state` and `POST /api/sample/reset` are absent routes.
- Fixture setup has no promise of compatibility with arbitrary or populated
  local databases.
- Historical migration content, changelog entries, and fixture IDs may still
  contain the word `sample`; they do not restore the removed runtime feature.

## Verification

Run the API fixture-seed guard tests, API typecheck/build and focused API tests,
the affected portal typechecks/tests, `npm run check:boundaries`, and the
package contract tests when contracts change. Do not run the seed command
against a live or shared database as a substitute for these offline checks.

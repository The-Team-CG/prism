# Anthony Sprint 2 Contract Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Anthony's Sprint 2 contract, verification, database-runtime, and FL-024 file-matrix gates without expanding product scope beyond metadata-only file behavior.

**Architecture:** Treat existing shared contracts as the source of truth, add only missing regression coverage, and document gates where Sprint 2 UI must stay bounded. Keep `apps/api/.env` local and uncommitted; the free-tier Supabase session pooler is allowed locally with `ALLOW_POOLER_FOR_PRISMA=1` because paid IPv4 direct database access is unavailable.

**Tech Stack:** TypeScript, NestJS API, Prisma/Postgres, Vitest, Node test runner, shared `@prism/types`, shared `@prism/api-client`, PowerShell on Windows.

---

## Files

- Modify: `packages/types/src/event-ops.test.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`
- Modify: `apps/api/libs/modules/event-ops/src/services/event-access-policy.service.test.ts`
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.test.ts`
- Modify: `docs/prism-v4/07-implemented-feature-revisions.md`
- Modify: `docs/prism-v4/12-redesign-inventory.md`
- Modify: `docs/prism-v4/14-redesign-readiness-foundation.md`
- Modify: `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`
- Local only, do not commit: `apps/api/.env`

## Task 1: Confirm Shared UI Contract Gate

- [x] Verify `PrismCursorPage`, `PrismListQuery`, `PrismApiProblem`, `PrismEmptyReason`, and `PrismActionResult` exist in `packages/types/src/event-ops.ts`.
- [x] Verify API-client problem normalization exists through `normalizePrismApiProblem` and `PrismApiError.problem`.
- [x] Add a type-level test assertion for `PrismFileRequirementsMatrix` in `packages/types/src/event-ops.test.ts`.

## Task 2: Close FL-024 Metadata-Only Matrix Gate

- [x] Verify `PrismFileRequirementsMatrix` and `eventOpsClient.events.fileRequirements(...)` exist.
- [x] Keep real uploads, signed URLs, multipart progress, retry, and bulk upload behavior gated.
- [x] Add API service coverage proving PMCM actors see PMCM-only `supplier_reviews` requirements while the existing client test keeps that requirement hidden from clients.

## Task 3: Harden Role Boundaries

- [x] Add `EventAccessPolicyService` tests for client event scope, coordinator event scope, official floorplan mutation denial, supplier internal-cost denial, and supplier privacy-operation denial.
- [x] Add `EventReadModelsService` tests for forbidden access to PMCM command inbox, client action center, supplier readiness board, and client action-center event scoping.

## Task 4: Local DB Runtime Gate

- [x] Update ignored `apps/api/.env` so `SUPABASE_DB_URL`, `DATABASE_URL`, `DIRECT_URL`, and `PRISMA_DATABASE_URL` use the free-tier Supabase session pooler on port `5432`.
- [x] Set `ALLOW_POOLER_FOR_PRISMA=1` locally because paid IPv4 direct DB access is unavailable.
- [x] Verify `npm --workspace prism-api run db:doctor:runtime` passes.
- [x] Verify `npm --workspace prism-api run db:doctor` passes.

## Task 5: Docs And Sprint Calendar

- [x] Mark Anthony Sprint 2 shared contract, file matrix, test, verification, and docs checklist items complete.
- [x] Update `docs/prism-v4/14-redesign-readiness-foundation.md` with Sprint 2 contract gate closeout and DB runtime evidence.
- [x] Update `docs/prism-v4/07-implemented-feature-revisions.md` and `docs/prism-v4/12-redesign-inventory.md` with FL-024 and role-boundary evidence.

## Task 6: Verification

Run the following before commit:

```powershell
npm --workspace @prism/types run typecheck
npm --workspace @prism/types run test
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/api-client run test
npm --workspace prism-api run typecheck
npm --workspace prism-api run test -- libs/modules/event-ops/src/event-ops.service.test.ts libs/modules/event-ops/src/services/event-access-policy.service.test.ts libs/modules/event-ops/src/services/event-read-models.service.test.ts
npm run check:boundaries
node --test scripts\check-prism-boundaries.test.mjs
git diff --check
npm --workspace prism-api run db:doctor:runtime
npm --workspace prism-api run db:doctor
```

Expected:

- Types and API-client checks pass.
- Focused API suites pass.
- Boundary checks pass.
- `git diff --check` exits `0`.
- Both DB doctor commands pass with redacted pooler targets.

## Self-Review

- Spec coverage: This plan maps to every Anthony Sprint 2 checklist item, including the no-op decision for already-present shared types and API-client helpers.
- Placeholder scan: No placeholders remain; DB secrets stay only in ignored `.env`.
- Type consistency: `PrismFileRequirementsMatrix`, `PrismActionResult`, `PrismApiProblem`, and route/client names match existing code.

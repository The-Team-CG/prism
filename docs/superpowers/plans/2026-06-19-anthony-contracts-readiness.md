# Anthony Contract Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Anthony's Owner D contract gate explicit enough that Sprint 2 PMCM and client surfaces can proceed without inventing app-local data, error, list, upload, or action-result behavior.

**Architecture:** Treat `docs/prism-v4/14-redesign-readiness-foundation.md` as the handoff contract and `packages/types` plus `packages/api-client` as the executable contract surface. Start with verification and documentation, then add only the shared types and API-client helpers that unlock Sprint 2 UI safely. Do not expand `/api/sample/state` or move workflow ownership into role apps.

**Tech Stack:** TypeScript, NestJS API in `apps/api`, shared contracts in `packages/types`, shared HTTP client in `packages/api-client`, Vitest, Node test runner, PowerShell on Windows.

---

## Owner Goal

Anthony owns Owner D: make platform behavior trustworthy through correct data, permissions, audit, files, notifications, lifecycle, tests, and docs.

Current branch:

```powershell
git status --short --branch
```

Expected:

```text
## anthony/contracts-readiness
```

## Files

- Modify: `docs/prism-v4/14-redesign-readiness-foundation.md`
- Modify: `docs/prism-v4/07-implemented-feature-revisions.md`
- Modify: `docs/prism-v4/12-redesign-inventory.md`
- Modify: `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`
- Modify: `packages/types/src/event-ops.ts`
- Modify: `packages/types/src/event-ops.test.ts`
- Modify: `packages/api-client/src/http.ts`
- Modify: `packages/api-client/src/event-ops-client.test.ts`
- Optional API tests only if endpoint behavior changes: `apps/api/libs/modules/event-ops/src/event-ops.dto.test.ts`
- Optional API tests only if role policy changes: `apps/api/libs/modules/event-ops/src/services/event-access-policy.service.test.ts`

## Contract Decisions

Use these decisions while executing the plan:

| Area | Sprint 2 decision |
| --- | --- |
| Pagination | Add shared envelope types now. Do not retrofit every list endpoint in this branch. |
| Filtering and sorting | Add shared query-shape types now. Keep current UI lists bounded unless an endpoint already supports the fields. |
| Normalized errors | Add `PrismApiProblem`, field errors, empty reasons, and API-client normalization helper. |
| File requirements | Keep metadata-first File Requirements Matrix. Do not add real storage or signed URLs in this branch. |
| Upload sessions | Document as gated unless storage adapter scope is approved. |
| Bulk/action responses | Add `PrismActionResult` type now. Do not add bulk managers to role apps in this branch. |

### Task 1: Baseline Verification

**Files:**
- Read: `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`
- Read: `docs/prism-v4/14-redesign-readiness-foundation.md`
- Read: `packages/types/src/event-ops.ts`
- Read: `packages/api-client/src/http.ts`

- [ ] **Step 1: Confirm branch and clean tree**

Run:

```powershell
git status --short --branch
```

Expected:

```text
## anthony/contracts-readiness
```

If files are already modified, inspect them before editing:

```powershell
git diff -- docs/prism-v4/14-redesign-readiness-foundation.md packages/types/src/event-ops.ts packages/api-client/src/http.ts
```

- [ ] **Step 2: Run architecture boundary checks**

Run:

```powershell
npm run check:boundaries
```

Expected:

```text
Prism boundary check passed
```

Run:

```powershell
node --test scripts\check-prism-boundaries.test.mjs
```

Expected: Node test runner exits with code `0`.

- [ ] **Step 3: Run current shared contract checks**

Run:

```powershell
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 4: Run database runtime doctor and capture the exact state**

Run:

```powershell
npm --workspace prism-api run db:doctor:runtime
```

Expected when the local database is configured: command exits with code `0`.

Expected when the local database is not configured: command exits nonzero and prints the exact environment variable or connection correction. Copy the exact failing command and error into Task 2's database gate section.

- [ ] **Step 5: Commit the baseline notes if any docs changed during evidence capture**

Run:

```powershell
git add docs/prism-v4/14-redesign-readiness-foundation.md
git commit -m "docs: capture Anthony contract readiness baseline"
```

Expected: commit succeeds. Skip this step when no files changed.

### Task 2: Update The Readiness Foundation

**Files:**
- Modify: `docs/prism-v4/14-redesign-readiness-foundation.md`

- [ ] **Step 1: Add the local database runtime gate**

Insert this section after `## Session Rule`:

```markdown
## Local Database Runtime Gate

Anthony owns the local API database readiness gate for authenticated browser and API verification. Before Sprint 2 demo work depends on live sample auth, run:

```powershell
npm --workspace prism-api run db:doctor:runtime
```

Passing result: the command exits with code `0`, confirming Prisma can reach the configured runtime database.

Blocked result: record the exact failing environment variable, connection target, and remediation command in this document before relying on authenticated local demos. Do not bypass this by adding localStorage-only auth or role-app mock users.
```

- [ ] **Step 2: Add the Anthony Sprint 2 contract cutline**

Insert this section after `## Scoped Contract Backlog`:

```markdown
## Anthony Sprint 2 Contract Cutline

| Contract family | Sprint 2 state | Allowed UI behavior | Blocked UI behavior | Verification |
| --- | --- | --- | --- | --- |
| Pagination and list envelopes | Shared envelope types exist; existing endpoints can remain array-returning until a route needs paging. | Known-small queues and bounded lists. | Infinite scroll, saved views, generalized table paging. | `npm --workspace @prism/types run typecheck` |
| Filtering and sorting | Shared query-shape types exist; endpoint-specific support must be named before use. | Simple local filters for already-loaded bounded data. | Cross-resource filter payloads invented inside role apps. | `npm --workspace @prism/api-client run typecheck` |
| Normalized errors and empty states | Shared problem, field-error, retryability, and empty-reason types exist. | Route copy maps to known reasons. | App-local error-code strings that cannot be shared across PMCM, client, supplier, and guest surfaces. | API-client unit tests for normalization helper. |
| File Requirements Matrix | Metadata-first matrix remains the July contract. | Requirement status, due date, owner, visibility, and metadata upload cues. | Real uploads, signed URLs, multipart progress, generalized file manager. | Types and focused file matrix tests. |
| Upload sessions | Gated pending real storage adapter approval. | Metadata-only upload intent copy and disabled real-storage controls. | Claims of real file persistence, retry progress, or signed URL behavior. | Gate documented in readiness foundation. |
| Bulk/action responses | Shared action-result type exists. | Single-action success, denied, retryable failure, and audit-reference display. | Bulk action manager or partial-success batch UI. | Types compile and API-client tests cover action-result shape. |
```

- [ ] **Step 3: Add the frontend pattern allowance**

Insert this section after the contract cutline:

```markdown
## Frontend Patterns Allowed Before Contract Gate Completion

Allowed before a route-specific backend contract is complete:

- Bounded queues from shared read models.
- Known-small lists loaded from existing scoped endpoints.
- Simple local filters over already-loaded bounded data.
- Metadata-only file requirement actions.
- Route-level empty states using shared empty reasons.

Blocked until Anthony's shared contracts and endpoint behavior are complete:

- Infinite scroll.
- Saved views.
- Generalized data grids.
- Real upload progress, signed URLs, or multipart retry UI.
- Bulk action managers.
- App-local normalized error taxonomies.
```

- [ ] **Step 4: Verify the doc has no ambiguous placeholder language**

Run:

```powershell
rg -n "TBD|TODO|later|appropriate|etc\\." docs/prism-v4/14-redesign-readiness-foundation.md
```

Expected: no matches for newly added Anthony sections. Existing historical text can remain only when it is not part of the new contract gate.

### Task 3: Add The Cross-App Handoff Checklist

**Files:**
- Modify: `docs/prism-v4/14-redesign-readiness-foundation.md`
- Modify: `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`

- [ ] **Step 1: Add the reusable checklist to the readiness foundation**

Insert this section before `## Legacy Removal Queue`:

```markdown
## Cross-App Handoff Checklist

Every PMCM-to-portal or portal-to-PMCM handoff must name these fields before app UI depends on it:

| Field | Required answer |
| --- | --- |
| Source app | `apps/event`, `apps/client`, `apps/supplier`, `apps/guest`, or `apps/api` |
| Actor role | `pmcm-admin`, `client`, `supplier`, `guest`, `coordinator`, or `system` |
| Target app | `apps/event`, `apps/client`, `apps/supplier`, `apps/guest`, or `apps/api` |
| Event scope | Event ID, access code, supplier ID, coordinator ID, or client session scope |
| Allowed fields | Exact shared contract fields the target may read |
| Forbidden fields | PMCM-only, private supplier, finance, audit, or internal coordination fields that must not cross the boundary |
| Audit event | Audit category and action reference created by the handoff |
| Notification event | Outbox or notification reference created by the handoff, or `none` when the handoff is read-only |
| Empty state | Shared empty reason shown when the handoff has no work |
| Error state | Shared problem code or retryability state shown when the handoff fails |
| Verification command | The exact test, typecheck, route check, or browser check proving the boundary |
```

- [ ] **Step 2: Add Sprint 2 handoff rows**

Append this table below the checklist:

```markdown
### Sprint 2 Handoff Rows

| Flow | Source app | Target app | Contract | Allowed fields | Forbidden fields | Audit or notification expectation | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PMCM command inbox to client next action | `apps/event` | `apps/client` | `PrismPmcmCommandInbox` plus `PrismClientActionCenter` | Event ID, client-visible status, next action label, due date, requirement key | PMCM notes, supplier private review, internal cost, audit log body | PMCM action records an audit reference; client read remains scoped to own event | API-client typecheck and focused read-shape test |
| Client file requirement status to PMCM | `apps/client` | `apps/event` | `PrismFileRequirementsMatrix` | Requirement key, status, due date, owner role, visible roles, uploaded asset reference when metadata exists | Storage path, PMCM validation notes not visible to client, other client event data | Metadata change is auditable; notification remains gated unless outbox behavior is already present | File matrix service test or documented storage gate |
| Client conforme and onboarding status to PMCM | `apps/client` | `apps/event` | `PrismClientActionCenter` plus lifecycle helpers | Inquiry status, conforme status, portal access state, reminder due state | Internal invitation token, PMCM-only decline notes, unrelated inquiry history | Reminder send or portal activation creates audit reference when command exists | Lifecycle contract test and command-inbox read-shape test |
```

- [ ] **Step 3: Link the checklist from the sprint calendar**

In `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`, update Anthony's Sprint 1 checklist item:

```markdown
- [ ] Define the first cross-app handoff contract checklist in `docs/prism-v4/14-redesign-readiness-foundation.md`: source app, actor role, target app, event ID/access scope, fields allowed, fields forbidden, audit event, notification event, empty/error states, and verification command.
```

- [ ] **Step 4: Commit the handoff docs**

Run:

```powershell
git add docs/prism-v4/14-redesign-readiness-foundation.md docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md
git commit -m "docs: define Anthony cross-app handoff gate"
```

Expected: commit succeeds after review.

### Task 4: Add Shared Contract Gate Types

**Files:**
- Modify: `packages/types/src/event-ops.ts`
- Modify: `packages/types/src/event-ops.test.ts`

- [ ] **Step 1: Add the shared contract types**

In `packages/types/src/event-ops.ts`, add this block after `PrismEventOpsActorContext`:

```typescript
export interface PrismPageRequest {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PrismCursorPage<TItem> {
  items: TItem[];
  page?: number;
  limit: number;
  total?: number;
  nextCursor?: string | null;
  hasMore: boolean;
}

export type PrismSortDirection = "asc" | "desc";

export interface PrismSortClause<TField extends string = string> {
  field: TField;
  direction: PrismSortDirection;
}

export type PrismFilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "in"
  | "before"
  | "after"
  | "between";

export interface PrismFilterClause<TField extends string = string> {
  field: TField;
  operator: PrismFilterOperator;
  value: string | number | boolean | Array<string | number | boolean>;
}

export interface PrismListQuery<TField extends string = string> extends PrismPageRequest {
  filters?: PrismFilterClause<TField>[];
  sort?: PrismSortClause<TField>[];
}

export interface PrismFieldError {
  field: string;
  message: string;
  code?: string;
}

export type PrismEmptyReason =
  | "no_data"
  | "not_ready"
  | "permission_denied"
  | "not_configured"
  | "blocked_by_gate"
  | "filtered_out";

export interface PrismApiProblem {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  emptyReason?: PrismEmptyReason;
  fieldErrors?: PrismFieldError[];
  auditReference?: string;
}

export type PrismActionResultStatus = "success" | "partial_success" | "denied" | "retryable_failure" | "failed";

export interface PrismActionResult<TData = unknown> {
  status: PrismActionResultStatus;
  message: string;
  data?: TData;
  problem?: PrismApiProblem;
  auditReference?: string;
  notificationReference?: string;
}
```

- [ ] **Step 2: Add the contract type test**

In `packages/types/src/event-ops.test.ts`, add these imports from `./index`:

```typescript
  type PrismActionResult,
  type PrismApiProblem,
  type PrismCursorPage,
  type PrismListQuery,
```

Then add this test inside `describe("event-ops shared read model types", () => { ... })`:

```typescript
  it("publishes the Sprint 2 UI contract gate types", () => {
    const query: PrismListQuery<"severity" | "eventDate"> = {
      limit: 25,
      cursor: "cursor_1",
      filters: [
        {
          field: "severity",
          operator: "equals",
          value: "blocked",
        },
      ],
      sort: [
        {
          field: "eventDate",
          direction: "asc",
        },
      ],
    };

    const page: PrismCursorPage<{ id: string }> = {
      items: [{ id: "item_1" }],
      limit: query.limit ?? 25,
      nextCursor: null,
      hasMore: false,
    };

    const problem: PrismApiProblem = {
      code: "blocked_by_gate",
      message: "Real uploads are gated until storage is approved.",
      status: 409,
      retryable: false,
      emptyReason: "blocked_by_gate",
      fieldErrors: [{ field: "file", message: "Storage adapter is not configured." }],
    };

    const result: PrismActionResult = {
      status: "denied",
      message: problem.message,
      problem,
      auditReference: "audit_1",
    };

    expect(page.items[0]?.id).toBe("item_1");
    expect(result.problem?.emptyReason).toBe("blocked_by_gate");
  });
```

- [ ] **Step 3: Run type package checks**

Run:

```powershell
npm --workspace @prism/types run typecheck
npm --workspace @prism/types run test
```

Expected: both commands exit with code `0`.

- [ ] **Step 4: Commit shared types**

Run:

```powershell
git add packages/types/src/event-ops.ts packages/types/src/event-ops.test.ts
git commit -m "feat: add Prism UI contract gate types"
```

Expected: commit succeeds.

### Task 5: Normalize API Client Errors

**Files:**
- Modify: `packages/api-client/src/http.ts`
- Modify: `packages/api-client/src/event-ops-client.test.ts`

- [ ] **Step 1: Import the shared problem type**

At the top of `packages/api-client/src/http.ts`, add:

```typescript
import type { PrismApiProblem } from "@prism/types";
```

- [ ] **Step 2: Add a normalized problem helper**

In `packages/api-client/src/http.ts`, add this helper before `export class PrismApiError`:

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizePrismApiProblem(status: number, body: unknown): PrismApiProblem {
  if (isRecord(body) && typeof body.code === "string" && typeof body.message === "string") {
    return {
      code: body.code,
      message: body.message,
      status,
      retryable: typeof body.retryable === "boolean" ? body.retryable : status >= 500,
      emptyReason: typeof body.emptyReason === "string" ? body.emptyReason : undefined,
      fieldErrors: Array.isArray(body.fieldErrors)
        ? body.fieldErrors.filter(isRecord).map((fieldError) => ({
            field: typeof fieldError.field === "string" ? fieldError.field : "unknown",
            message: typeof fieldError.message === "string" ? fieldError.message : "Invalid field value.",
            code: typeof fieldError.code === "string" ? fieldError.code : undefined,
          }))
        : undefined,
      auditReference: typeof body.auditReference === "string" ? body.auditReference : undefined,
    };
  }

  return {
    code: status >= 500 ? "api_unavailable" : "api_error",
    message: typeof body === "string" ? body : `P.R.I.S.M API request failed: ${status}`,
    status,
    retryable: status >= 500,
  };
}
```

- [ ] **Step 3: Store the normalized problem on API errors**

Change `PrismApiError` to:

```typescript
export class PrismApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly problem: PrismApiProblem;

  constructor(status: number, body: unknown) {
    const problem = normalizePrismApiProblem(status, body);
    super(problem.message);
    this.name = "PrismApiError";
    this.status = status;
    this.body = body;
    this.problem = problem;
  }
}
```

- [ ] **Step 4: Add API-client tests**

In `packages/api-client/src/event-ops-client.test.ts`, import the helper and error:

```typescript
import { PrismApiError, normalizePrismApiProblem } from "./http";
```

Add this test:

```typescript
it("normalizes API problem responses for role app empty and error states", () => {
  const problem = normalizePrismApiProblem(409, {
    code: "blocked_by_gate",
    message: "Upload sessions are gated.",
    retryable: false,
    emptyReason: "blocked_by_gate",
    fieldErrors: [{ field: "file", message: "Storage adapter is not configured." }],
    auditReference: "audit_1",
  });

  expect(problem).toEqual({
    code: "blocked_by_gate",
    message: "Upload sessions are gated.",
    status: 409,
    retryable: false,
    emptyReason: "blocked_by_gate",
    fieldErrors: [{ field: "file", message: "Storage adapter is not configured.", code: undefined }],
    auditReference: "audit_1",
  });

  const error = new PrismApiError(503, "Database unavailable");
  expect(error.problem).toEqual({
    code: "api_unavailable",
    message: "Database unavailable",
    status: 503,
    retryable: true,
  });
});
```

- [ ] **Step 5: Run API-client checks**

Run:

```powershell
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/api-client run test
```

Expected: both commands exit with code `0`.

- [ ] **Step 6: Commit API-client normalization**

Run:

```powershell
git add packages/api-client/src/http.ts packages/api-client/src/event-ops-client.test.ts
git commit -m "feat: normalize Prism API client problems"
```

Expected: commit succeeds.

### Task 6: Lock The File Matrix And Upload Gate

**Files:**
- Modify: `docs/prism-v4/14-redesign-readiness-foundation.md`
- Modify: `docs/prism-v4/07-implemented-feature-revisions.md`
- Modify: `docs/prism-v4/12-redesign-inventory.md`
- Test when behavior changes: `apps/api/libs/modules/event-ops/src/services/document-vault.service.test.ts`
- Test when behavior changes: `apps/api/libs/modules/event-ops/src/services/file-requirements-matrix.service.ts`

- [ ] **Step 1: Document the Sprint 2 file matrix rule**

In `docs/prism-v4/14-redesign-readiness-foundation.md`, add this paragraph under the File Requirements Matrix backlog row:

```markdown
Sprint 2 file behavior is metadata-first. Role apps may show requirement status, owner role, visibility, due date, generated document reference, uploaded asset metadata, and validation state. Role apps must not claim real upload persistence, signed URL creation, multipart upload progress, or retry semantics until Anthony approves a storage adapter contract and focused API tests cover the behavior.
```

- [ ] **Step 2: Update implemented-feature revisions**

In `docs/prism-v4/07-implemented-feature-revisions.md`, add a Sprint 2 note under the document/file operations section:

```markdown
- Anthony Sprint 2 contract note: File Requirements Matrix remains the shared metadata contract for PMCM/client/supplier file visibility. Real storage, signed URLs, upload progress, and retry behavior are gated until a storage adapter contract and tests exist.
```

- [ ] **Step 3: Update redesign inventory**

In `docs/prism-v4/12-redesign-inventory.md`, update the `apps/api`, `packages/types`, or file operations row with:

```markdown
Anthony gate: file UI can use `PrismFileRequirementsMatrix` for status and visibility, but upload-session, signed URL, and retry UI are blocked until the storage adapter contract is approved and tested.
```

- [ ] **Step 4: Run API tests only when behavior changed**

Run this when `document-vault.service.ts`, `file-requirements-matrix.service.ts`, or controllers are edited:

```powershell
npm --workspace prism-api run test:event-ops -- document-vault.service.test.ts
```

Expected: command exits with code `0`. If the test runner does not support the final filename argument in this workspace, run:

```powershell
npm --workspace prism-api run test:event-ops
```

Expected: command exits with code `0`.

- [ ] **Step 5: Commit file matrix gate docs**

Run:

```powershell
git add docs/prism-v4/14-redesign-readiness-foundation.md docs/prism-v4/07-implemented-feature-revisions.md docs/prism-v4/12-redesign-inventory.md
git commit -m "docs: lock Sprint 2 file matrix gate"
```

Expected: commit succeeds.

### Task 7: Final Verification And Calendar Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`

- [ ] **Step 1: Mark completed Anthony Sprint 1 checklist items**

In `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`, mark only items with evidence as complete:

```markdown
- [x] Verify `npm run check:boundaries` and `node --test scripts\check-prism-boundaries.test.mjs` still pass after the calendar doc is added.
- [x] Document the local database blocker and exact recovery command in `docs/prism-v4/14-redesign-readiness-foundation.md`: `npm --workspace prism-api run db:doctor:runtime`.
- [x] Define the first cross-app handoff contract checklist: source app, actor role, target app, event ID/access scope, fields allowed, fields forbidden, audit event, notification event, empty/error states, and verification command.
- [x] Finalize the UI-enabling API contract gate: pagination/result envelopes, filtering/sorting, upload sessions/file rules, normalized errors, empty-state reasons, and bulk/action responses.
- [x] Mark which frontend patterns are allowed before the gate passes: bounded queues, known-small lists, simple local filters, metadata upload flows, and no generalized grid/upload/bulk manager.
- [x] Define the Sprint 2 verification baseline: `npm --workspace @prism/types run typecheck`, `npm --workspace @prism/api-client run typecheck`, app typecheck for touched apps, API focused tests for touched controllers/services, `git diff --check`.
```

Leave these unchecked until their evidence exists:

```markdown
- [ ] Translate incomplete feature rows from `docs/prism-v4/11-feature-ledger.md` into the Sprint 2-4 contract/test cutline, especially files, notifications, privacy, floorplan eligibility, guest access, supplier readiness, and billing.
- [ ] Identify missing typed response shapes needed by Sprint 2: PMCM command summary, selected-event summary, client action card, shared status vocabulary.
```

- [ ] **Step 2: Run the full Anthony verification baseline**

Run:

```powershell
npm run check:boundaries
node --test scripts\check-prism-boundaries.test.mjs
npm --workspace @prism/types run typecheck
npm --workspace @prism/types run test
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/api-client run test
git diff --check
```

Expected: every command exits with code `0`.

- [ ] **Step 3: Run API verification if API files changed**

Run this only if files under `apps/api` changed:

```powershell
npm --workspace prism-api run typecheck
npm --workspace prism-api run test:event-ops
```

Expected: both commands exit with code `0`.

- [ ] **Step 4: Commit final calendar closeout**

Run:

```powershell
git add docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md
git commit -m "docs: close Anthony Sprint 1 contract readiness"
```

Expected: commit succeeds when calendar items were updated.

- [ ] **Step 5: Final status check**

Run:

```powershell
git status --short --branch
```

Expected:

```text
## anthony/contracts-readiness
```

The working tree should be clean after the final commit.

## Self-Review

- Spec coverage: The plan covers Anthony's Sprint 1 checklist, Sprint 2 contract gate, local DB runtime gate, handoff checklist, shared contract types, normalized errors, file/upload gate, and verification baseline.
- Placeholder scan: The plan contains no `TBD` or unresolved implementation markers in executable steps.
- Type consistency: Shared type names are defined in `packages/types/src/event-ops.ts`, exported through the existing `packages/types/src/index.ts`, and consumed by `packages/api-client/src/http.ts`.

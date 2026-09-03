# PMCM Supplier Review Closure Slice

Status: design approved in chat on 2026-09-04; written specification pending user review

## Goal

Advance catalog row `New-S5` from partial toward an honest `have` by making the existing PMCM supplier review capability part of the event closure path. A PMCM user must be able to see assigned suppliers that still need a post-event review, enter a private star rating, rate applicable category dimensions, and save private notes tied to the selected event.

This is a thin slice of supplier performance assessment. It does not claim to deliver the broader supplier-program or insights program.

## Current evidence

- The commercial module already persists `OpsSupplierReview` records with optional `eventId`, overall rating, private notes, reviewer, idempotency key, and category dimension ratings.
- `SupplierProfileCommandsService.addSupplierReview` already enforces PMCM/System authorization, event scope, audit logging, and delegates persistence to `SuppliersService`.
- The PMCM supplier directory already has a controlled review form for overall and category ratings.
- The event closure workspace already loads the selected event, quote requests, suppliers, close gates, and insights through the dashboard view model, but it does not surface review work for assigned suppliers.
- The current row remains partial because the working role path does not connect closure to an event-scoped review prompt. The review record and directory form alone are not enough evidence for a closure workflow.

## Scope

### In scope

1. Move the supplier-review write contract to the shared Zod contract surface.
2. Reuse the existing PMCM review command and audit path.
3. Add a closure-scoped PMCM review prompt for confirmed supplier assignments.
4. Reuse one review form implementation in the supplier directory and closure prompt.
5. Add focused tests and update delivery evidence.

### Out of scope

- Object storage, signed URLs, document vault, or supplier photo/video uploads.
- Production email/Viber notification adapters.
- External identity provider, two-factor authentication, or lockout behavior.
- QR/camera check-in.
- Live AI, ZDR, or PARE runtime packs.
- Automatic supplier tier changes, a full supplier performance program, or a public supplier status page.
- Making reviews an archive gate. A missing review is advisory and must not block archiving.
- Exposing private reviews, performance notes, reviewer identity, or dimension ratings to client, supplier, or guest portals.

## Design

### Shared contract

Add `createSupplierReviewSchema` and its `z.infer` type to `packages/types/src/schemas/event-ops-inputs.ts`, and export it through the schema/package indexes. The schema is the single write contract:

- `eventId`: optional trimmed string;
- `rating`: required integer from 1 through 5;
- `notes`: required non-empty string;
- `reviewedBy`: optional trimmed string, retained for the existing system fallback;
- `dimensionRatings`: optional array of `{ dimensionId, rating }`, with a non-empty dimension ID and an integer rating from 1 through 5;
- `idempotencyKey`: optional trimmed string.

Remove the duplicate local review input aliases and the API-only `CreateSupplierReviewDto`. `OpsSuppliersController.addReview` will validate the body with `zodBody(createSupplierReviewSchema)` and pass the inferred type through the commercial contracts. The existing service-side category-dimension ownership check remains in place; the shared schema validates shape and range, while the domain service validates that a dimension belongs to the supplier category.

### API and authorization

Keep the existing route `POST /suppliers/:supplierId/reviews` and the commercial bounded-context ownership. The controller remains behind `EventSessionGuard`, resolves the verified actor with `EventAccessPolicyService`, and delegates to `SupplierProfileCommandsService`.

The command continues to:

- require a PMCM/System actor;
- use `input.eventId` for event-scoped permission checks and workflow execution;
- set the effective reviewer from the verified actor;
- write the review through the existing supplier service;
- emit the existing PMCM audit record.

No new controller, cross-context import, persistence model, notification, or public read surface is needed.

### Closure data path

Extend `EventWorkspaceClosureTab` and `Phase4Workspace` with the already-loaded `supplierCategories`, `suppliers`, `quoteRequests`, reviewer name, and `onAddReview` command callback from the event dashboard view model. The callback remains the existing thin portal adapter; it injects the selected event ID before calling the API. Because the dashboard runner intentionally swallows command errors, the supplier-review adapter will return an explicit `boolean` success value; the directory and closure prompt reset or mark a review complete only when that value is `true`, while the existing error channel remains responsible for user-visible failures.

Add a pure supplier-review rule module under `apps/event/src/features/suppliers/reviews/model/`. It will derive review subjects as follows:

1. Keep quote requests whose `assignmentStatus` is exactly `confirmed` and that have a `supplierId`.
2. Deduplicate supplier IDs while preserving the first confirmed request's category context.
3. Resolve each ID against the PMCM supplier directory.
4. Mark a subject complete when that supplier already has a review whose `eventId` equals the selected event ID.
5. Do not prompt for merely requested, declined, withdrawn, or otherwise unconfirmed suppliers.

This rule is deliberately conservative: it avoids implying that a supplier performed at an event when the assignment was not confirmed, and it does not infer completion from a review belonging to another event.

### Shared review UI

Extract the current controlled `SupplierReviewPanel` from `supplier-directory-sections.tsx` into the supplier-review feature and export it from that feature's public index. The directory and closure prompt will use the same form component and the same required-notes behavior. The form will continue to support:

- overall rating;
- category-specific dimension ratings;
- private PMCM notes;
- a generated idempotency key for retry-safe submission.

Add a `SupplierReviewPromptList` view in the supplier-review feature. It will show a PMCM-only closure card containing:

- the selected event name;
- assigned supplier name and category;
- a due/completed count;
- one reusable review form per due subject;
- a clear empty state when the event has no confirmed supplier assignments;
- a completed state after a successful submission.

The prompt is rendered inside `Phase4Workspace` before the insights section. It is visible while the event is in the closure workflow, including before archive, and it is not part of `PrismCloseGates`. Form state and submission completion are local to the prompt view; API errors continue through the existing dashboard command error/busy channel and must leave the draft available for retry.

The component will not be added to `apps/client`, `apps/supplier`, or `apps/guest`, and it will not use client-visible event mappers.

## Verification

Add or update tests for:

- shared schema acceptance and rejection of invalid overall/dimension ratings and missing notes;
- controller body validation metadata and existing event-session guard;
- PMCM/System authorization, event scope, audit invocation, and forbidden-role behavior for the command;
- review-subject derivation for confirmed, duplicate, unconfirmed, and already-reviewed assignments;
- closure prompt rendering of due/completed/empty states and successful completion behavior;
- unchanged private-data boundaries for non-PMCM portals.

Run verification in this order after implementation:

1. `npm --workspace @prism/types run test` and `npm --workspace @prism/types run build`;
2. focused commercial API and event feature tests;
3. touched package typechecks;
4. `npm run check:boundaries`;
5. the repository's broader typecheck/test commands that remain runnable in the worktree.

Record unavailable checks separately if they require a running database or portal stack.

## Delivery evidence and rescore rule

Add an `[Unreleased]` entry to the root `CHANGELOG.md` describing the event-scoped PMCM supplier review closure slice. Add a dated evidence note to `docs/log.md` if the catalog/ledger overlay is updated. Do not rewrite active ledger decision rows.

After tests pass, rescore only `New-S5` in the external feature-catalog canvas when that Cursor-owned file is writable and the update can be verified. If the external canvas remains outside the writable workspace, do not claim it was updated; record the implementation evidence and the rescore limitation in the handoff. Keep unrelated partial/missing rows and all known blocker statuses unchanged.

## Acceptance criteria

`New-S5` can be treated as `have` only if all of the following are true:

- a PMCM user can reach the review prompt from the selected event's closure workspace;
- only confirmed supplier assignments produce review subjects;
- the form persists an event-linked overall rating, optional dimension ratings, and private notes through the shared Zod contract;
- forbidden roles cannot mutate the review route and private data does not enter client/supplier/guest surfaces;
- retrying the same submission is safe through the existing idempotency path;
- focused tests, touched typechecks, and boundary checks pass;
- `CHANGELOG.md` and the verified catalog evidence are updated;
- no storage, notification, identity, QR, AI, or other known blocker is represented as delivered.

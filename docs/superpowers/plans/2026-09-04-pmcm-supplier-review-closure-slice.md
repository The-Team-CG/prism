# PMCM Supplier Review Closure Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make catalog row 'New-S5' an honest thin slice by surfacing event-scoped PMCM supplier reviews in the closure workspace and persisting them through the canonical shared contract.

**Architecture:** Keep the existing commercial 'POST /suppliers/:supplierId/reviews' command, authorization, audit, and Prisma persistence. Add a shared Zod contract, a pure event-side selector for confirmed supplier assignments, and a reusable supplier review form rendered from the Phase 4 closure workspace. The dashboard adapter will return an explicit success boolean because its existing runner catches errors; failed submissions remain editable and do not appear complete.

**Tech Stack:** TypeScript, NestJS, Prisma, Zod 4, Next.js App Router, React 19, Vitest, Testing Library, npm workspaces.

## Global Constraints

- Work only in C:/Users/anton/Codes/The-Team-CG/prism/.worktrees/feat-p0-p1-catalog-slices on branch feat/p0-p1-catalog-slices; do not edit the parent staging checkout.
- Preserve all unrelated uncommitted Cursor changes already present in the worktree.
- Shared write contracts are Zod schema plus z.infer in @prism/types only; do not add parallel app-local DTOs or as any.
- Frontend flow remains page → View → ViewModel → use-case → data → @prism/api-client; no HTTP or business rules in JSX pages.
- Keep supplier command work under the commercial bounded context and use the existing event-session, role, event-scope, audit, and idempotency paths.
- Only confirmed supplier assignments produce review prompts; reviews are advisory and never become an archive gate.
- Private review notes, ratings, reviewer identity, and dimension ratings remain PMCM-only.
- Do not implement storage, production notification, external IdP/2FA, QR, live AI, PARE runtime packs, automatic tier changes, or a public supplier status page.
- Update root CHANGELOG.md for the delivery; do not rewrite active ledger decision rows.
- Do not commit or push unless the user explicitly requests it.

---

## File map

### Create

- apps/event/src/features/suppliers/reviews/model/supplier-review-rules.ts — pure selection of confirmed assigned suppliers and event-review completion state.
- apps/event/src/features/suppliers/reviews/model/supplier-review-rules.test.ts — selector tests for confirmed, duplicate, unconfirmed, missing, and already-reviewed assignments.
- apps/event/src/features/suppliers/reviews/views/supplier-review-panel.tsx — reusable controlled PMCM review form extracted from the directory feature.
- apps/event/src/features/suppliers/reviews/views/supplier-review-prompt-list.tsx — closure-scoped due/completed supplier review cards.
- apps/event/src/features/suppliers/reviews/views/supplier-review-prompt-list.test.tsx — jsdom rendering and successful-submission tests.
- apps/event/src/features/suppliers/reviews/index.ts — public feature exports.

### Modify

- packages/types/src/schemas/event-ops-inputs.ts — add the canonical supplier review schema and inferred type.
- packages/types/src/schemas/event-ops-inputs.test.ts — validate supplier review payload boundaries.
- packages/types/src/schemas/index.ts — export the schema and type.
- packages/types/src/event-ops.ts — remove the duplicate internal supplier review input alias.
- apps/api/src/modules/commercial/api/suppliers/supplier.dto.ts — remove the review-specific class-validator DTO and nested DTO.
- apps/api/src/modules/commercial/api/suppliers/suppliers.controller.ts — bind review bodies through zodBody(createSupplierReviewSchema).
- apps/api/src/modules/commercial/api/suppliers/suppliers.controller.test.ts — verify the shared body pipe remains behind EventSessionGuard.
- apps/api/src/modules/commercial/contracts/supplier-directory.port.ts — use and re-export the shared review input type.
- apps/api/src/modules/commercial/contracts/supplier-commands.port.ts — consume the canonical review input type.
- apps/api/src/modules/commercial/application/suppliers/suppliers.service.ts — consume the canonical review input type without changing persistence behavior.
- apps/api/src/modules/commercial/application/suppliers/supplier-profile-commands.service.ts — consume the canonical review input type and extend forbidden-role coverage.
- apps/api/src/modules/commercial/application/suppliers/supplier-network-workflow.service.ts — preserve the public commercial workflow signature over the shared type.
- apps/event/src/lib/prism-api.ts — remove the app-local review input alias and import the shared type.
- apps/event/src/features/suppliers/directory/views/supplier-directory-sections.tsx — import the extracted review form and remove the duplicate function.
- apps/event/src/features/suppliers/directory/views/supplier-directory.tsx — accept the boolean success result and reset the form only after success.
- apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts — add a narrow success-returning command runner for review submission.
- apps/event/src/features/event-dashboard/shell/views/sections/event-workspace-tabs.tsx — pass current event supplier data and the review callback into closure.
- apps/event/src/features/closure/phase4/views/phase4-workspace.tsx — render the supplier review prompt list before insights.
- CHANGELOG.md — document the delivered closure slice.
- docs/log.md — add dated catalog evidence only if the delivery overlay is updated there.

All other existing changed files in this worktree remain outside this plan unless a typecheck proves an import-only adjustment is required.

## Task 1: Canonicalize the supplier review write contract

**Files:**

- Modify: packages/types/src/schemas/event-ops-inputs.test.ts
- Modify: packages/types/src/schemas/event-ops-inputs.ts
- Modify: packages/types/src/schemas/index.ts
- Modify: packages/types/src/event-ops.ts
- Modify: apps/event/src/lib/prism-api.ts
- Modify: apps/api/src/modules/commercial/contracts/supplier-directory.port.ts
- Modify: apps/api/src/modules/commercial/contracts/supplier-commands.port.ts
- Modify: apps/api/src/modules/commercial/application/suppliers/suppliers.service.ts
- Modify: apps/api/src/modules/commercial/application/suppliers/supplier-profile-commands.service.ts
- Modify: apps/api/src/modules/commercial/application/suppliers/supplier-network-workflow.service.ts

**Interfaces:**

- Produces createSupplierReviewSchema and CreateSupplierReviewInput from @prism/types.
- Preserves the existing review method shape: addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actor: ResolvedEventOpsActor).

- [ ] **Step 1: Write the failing shared-contract test.**

Add createSupplierReviewSchema to the test import list and append this case to describe('event-ops write schemas', ...):

~~~ts
  it("validates PMCM supplier review ratings, notes, and dimensions", () => {
    const parsed = createSupplierReviewSchema.parse({
      eventId: "evt_close_1",
      rating: 5,
      notes: "Delivered on time and handled the stage reset well.",
      reviewedBy: "Maxine",
      dimensionRatings: [{ dimensionId: "dim_reliability", rating: 5 }],
      idempotencyKey: "review-draft-1",
    });

    expect(parsed.eventId).toBe("evt_close_1");
    expect(parsed.dimensionRatings?.[0].rating).toBe(5);
    expect(createSupplierReviewSchema.safeParse({ rating: 0, notes: "Too low" }).success).toBe(false);
    expect(createSupplierReviewSchema.safeParse({ rating: 6, notes: "Too high" }).success).toBe(false);
    expect(createSupplierReviewSchema.safeParse({ rating: 5, notes: "" }).success).toBe(false);
    expect(
      createSupplierReviewSchema.safeParse({
        rating: 5,
        notes: "Good",
        dimensionRatings: [{ dimensionId: "dim_reliability", rating: 6 }],
      }).success,
    ).toBe(false);
  });
~~~

- [ ] **Step 2: Run the test and verify it fails for the missing export.**

Run:

~~~bash
npm --workspace @prism/types exec vitest run src/schemas/event-ops-inputs.test.ts
~~~

Expected: FAIL because createSupplierReviewSchema is not exported yet.

- [ ] **Step 3: Add the minimal canonical schema and remove duplicate review aliases.**

Add this block under the supplier schemas in packages/types/src/schemas/event-ops-inputs.ts:

~~~ts
export const createSupplierReviewSchema = z.object({
  eventId: optionalTrimmedStringSchema,
  rating: z.number().int().min(1).max(5),
  notes: nonEmptyStringSchema,
  reviewedBy: optionalTrimmedStringSchema,
  dimensionRatings: z
    .array(
      z.object({
        dimensionId: nonEmptyStringSchema,
        rating: z.number().int().min(1).max(5),
      }),
    )
    .optional(),
  idempotencyKey: optionalTrimmedStringSchema,
});
export type CreateSupplierReviewInput = z.infer<typeof createSupplierReviewSchema>;
~~~

Export both names from packages/types/src/schemas/index.ts. Delete only the duplicate CreateSupplierReviewInput aliases from packages/types/src/event-ops.ts, apps/event/src/lib/prism-api.ts, and apps/api/src/modules/commercial/application/suppliers/suppliers.service.ts. Import the type from @prism/types in those consumers. In supplier-directory.port.ts, import and re-export the shared type so existing @prism/contexts/commercial type imports remain source-compatible:

~~~ts
import type { CreateSupplierReviewInput } from '@prism/types';
export type { CreateSupplierReviewInput } from '@prism/types';
~~~

Keep the other supplier input aliases unchanged. Do not alter review persistence or the compatibility service behavior.

- [ ] **Step 4: Run the contract test, build the package, and typecheck the package.**

Run:

~~~bash
npm --workspace @prism/types exec vitest run src/schemas/event-ops-inputs.test.ts
npm --workspace @prism/types run build
npm --workspace @prism/types run typecheck
~~~

Expected: all selected schema tests pass, the package emits dist, and typecheck exits 0.

## Task 2: Bind the API review route to Zod and preserve authorization

**Files:**

- Modify: apps/api/src/modules/commercial/api/suppliers/supplier.dto.ts
- Modify: apps/api/src/modules/commercial/api/suppliers/suppliers.controller.ts
- Modify: apps/api/src/modules/commercial/api/suppliers/suppliers.controller.test.ts
- Modify: apps/api/src/modules/commercial/application/suppliers/supplier-profile-commands.service.test.ts

**Interfaces:**

- Consumes createSupplierReviewSchema and CreateSupplierReviewInput from @prism/types.
- Produces the unchanged POST /suppliers/:supplierId/reviews route with a Zod body pipe, EventSessionGuard, verified actor resolution, event-scoped permission, audit, and idempotent persistence.

- [ ] **Step 1: Write the failing controller metadata test.**

Import ZodValidationPipe and add this case to apps/api/src/modules/commercial/api/suppliers/suppliers.controller.test.ts:

~~~ts
  it("binds the supplier review body to the shared Zod validation pipe", () => {
    const routeArguments = Reflect.getMetadata(
      "__routeArguments__",
      OpsSuppliersController.prototype.addReview,
    ) as Record<string, { index: number; pipes?: unknown[] }>;
    const bodyArgument = Object.values(routeArguments).find((argument) => argument.index === 1);

    expect(bodyArgument?.pipes?.[0]).toBeInstanceOf(ZodValidationPipe);
  });
~~~

Add a second service test with a client actor and a rejecting requireActorRole stub. It must assert that service.addSupplierReview(...) rejects and suppliersService.addSupplierReview is not called. Use the existing constructor setup and this exact review input:

~~~ts
{ eventId: "evt_close_1", rating: 5, notes: "Private PMCM note" }
~~~

- [ ] **Step 2: Run the new API tests and verify the controller test fails before the binding change.**

Run:

~~~bash
npm --workspace prism-api exec vitest run src/modules/commercial/api/suppliers/suppliers.controller.test.ts src/modules/commercial/application/suppliers/supplier-profile-commands.service.test.ts
~~~

Expected: the new metadata assertion fails because addReview currently uses @Body() without a pipe; the existing authorization test remains green.

- [ ] **Step 3: Replace only the review DTO with the shared Zod body contract.**

In suppliers.controller.ts, add the imports and change the method to this shape:

~~~ts
import { createSupplierReviewSchema, type CreateSupplierReviewInput, type PrismVerifiedEventActor } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';

  @Post(':supplierId/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  addReview(
    @Param('supplierId') supplierId: string,
    @Body(zodBody(createSupplierReviewSchema)) input: CreateSupplierReviewInput,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.addSupplierReview(supplierId, input, actor);
  }
~~~

Remove CreateSupplierReviewDto and SupplierReviewDimensionRatingDto from supplier.dto.ts, along with their now-unused class-transformer/class-validator imports. Keep all unrelated legacy DTOs in that file unchanged. The command service must continue to call requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId) through its existing requireSupplierAdmin helper.

- [ ] **Step 4: Run the focused API tests and typecheck.**

Run:

~~~bash
npm --workspace prism-api exec vitest run src/modules/commercial/api/suppliers/suppliers.controller.test.ts src/modules/commercial/application/suppliers/supplier-profile-commands.service.test.ts
npm --workspace prism-api run typecheck
~~~

Expected: both test files pass and the API typecheck exits 0. No database migration is expected for this task.

## Task 3: Add the pure closure review-subject selector

**Files:**

- Create: apps/event/src/features/suppliers/reviews/model/supplier-review-rules.ts
- Create: apps/event/src/features/suppliers/reviews/model/supplier-review-rules.test.ts

**Interfaces:**

- Produces SupplierReviewSubject and selectSupplierReviewSubjects(suppliers, quoteRequests, eventId).
- SupplierReviewSubject contains supplier, requestCategory, and completed.

- [ ] **Step 1: Write the failing selector tests and fixtures.**

Create a Vitest file with factories for the complete PrismSupplier and PrismSupplierQuoteRequest shapes. The tests must cover one confirmed supplier with a same-event review, a duplicate confirmed request, a second due supplier, an unconfirmed request, and a confirmed request whose supplier is absent from the directory. Assert the exact result IDs and completion flags:

~~~ts
const makeSupplier = (overrides: Partial<PrismSupplier> = {}): PrismSupplier => ({
  id: "sup_1",
  name: "Acme AV",
  categoryId: "cat_av",
  categoryName: "Audio Visual",
  categorySlug: "audio-visual",
  tier: "tier_1",
  bniMember: false,
  autoTrust: false,
  contactName: "Ada Cruz",
  email: "ada@acme.test",
  phone: "+63 900 000 0000",
  serviceInclusions: "Stage and technicals",
  performanceNotes: "",
  applicationDate: "2026-01-01",
  aggregateRating: 4,
  lastEventDate: null,
  pastEvents: [],
  reviews: [],
  reliabilityNotes: [],
  certifications: [],
  ...overrides,
});

const makeRequest = (overrides: Partial<PrismSupplierQuoteRequest> = {}): PrismSupplierQuoteRequest => ({
  id: "req_1",
  eventId: "evt_close_1",
  supplierId: "sup_1",
  supplierName: "Acme AV",
  category: "Audio Visual",
  message: "Please support the event.",
  accessToken: "token",
  confidentialBid: true,
  status: "selected",
  assignmentStatus: "confirmed",
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

expect(subjects.map((subject) => [subject.supplier.id, subject.completed])).toEqual([
  ["sup_1", true],
  ["sup_2", false],
]);
expect(unconfirmedOrMissingSubjects).toEqual([]);
~~~

- [ ] **Step 2: Run the selector test and verify it fails because the module is absent.**

Run:

~~~bash
npm --workspace @prism/event exec vitest run src/features/suppliers/reviews/model/supplier-review-rules.test.ts
~~~

Expected: FAIL with the missing module/function error.

- [ ] **Step 3: Implement the conservative pure selector.**

Create the module with this behavior:

~~~ts
import type { PrismSupplier, PrismSupplierQuoteRequest } from "@prism/types";

export type SupplierReviewSubject = {
  supplier: PrismSupplier;
  requestCategory: string;
  completed: boolean;
};

export function selectSupplierReviewSubjects(
  suppliers: PrismSupplier[],
  quoteRequests: PrismSupplierQuoteRequest[],
  eventId: string,
): SupplierReviewSubject[] {
  const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const seenSupplierIds = new Set<string>();

  return quoteRequests.flatMap((request) => {
    if (request.assignmentStatus !== "confirmed" || !request.supplierId || seenSupplierIds.has(request.supplierId)) {
      return [];
    }

    const matchedSupplier = suppliersById.get(request.supplierId);
    if (!matchedSupplier) return [];

    seenSupplierIds.add(request.supplierId);
    return [{
      supplier: matchedSupplier,
      requestCategory: request.category || matchedSupplier.categoryName,
      completed: matchedSupplier.reviews.some((review) => review.eventId === eventId),
    }];
  });
}
~~~

- [ ] **Step 4: Run the selector test again.**

Run the same Vitest command from Step 2. Expected: all selector tests pass.

## Task 4: Extract the reusable PMCM review form

**Files:**

- Create: apps/event/src/features/suppliers/reviews/views/supplier-review-panel.tsx
- Create: apps/event/src/features/suppliers/reviews/index.ts
- Modify: apps/event/src/features/suppliers/directory/views/supplier-directory-sections.tsx

**Interfaces:**

- Produces SupplierReviewPanel and SupplierReviewForm from the supplier-review feature public index.
- Consumes the existing controlled props: reviewForm, reviewDimensionRatings, dimensions, busy, onReviewForm, onReviewDimension, and onSubmitReview.

- [ ] **Step 1: Move the existing controlled panel without changing its behavior.**

Move the existing SupplierReviewForm type and SupplierReviewPanel function from supplier-directory-sections.tsx to the new feature. The destination must export this interface:

~~~ts
export type SupplierReviewForm = { rating: string; notes: string };

export type SupplierReviewPanelProps = {
  reviewForm: SupplierReviewForm;
  reviewDimensionRatings: Record<string, string>;
  dimensions: Array<{ id: string; name: string }>;
  busy: boolean;
  onReviewForm: (patch: Partial<SupplierReviewForm>) => void;
  onReviewDimension: (dimensionId: string, value: string) => void;
  onSubmitReview: () => void;
};

export function SupplierReviewPanel({
  reviewForm,
  reviewDimensionRatings,
  dimensions,
  busy,
  onReviewForm,
  onReviewDimension,
  onSubmitReview,
}: SupplierReviewPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Private PMCM Review</p>
      <select aria-label="Overall supplier rating" value={reviewForm.rating} onChange={(event) => onReviewForm({ rating: event.target.value })}>
        {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
      </select>
      <textarea aria-label="Private supplier review notes" value={reviewForm.notes} onChange={(event) => onReviewForm({ notes: event.target.value })} placeholder="Private review notes" />
      {dimensions.map((dimension) => (
        <select key={dimension.id} aria-label={dimension.name} value={reviewDimensionRatings[dimension.id] ?? ""} onChange={(event) => onReviewDimension(dimension.id, event.target.value)}>
          <option value="">Not rated</option>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      ))}
      <button type="button" disabled={busy || !reviewForm.notes.trim()} onClick={onSubmitReview}>Add review</button>
    </div>
  );
}
~~~

Preserve the existing layout classes and dimension heading from the current panel when moving the implementation. The code above fixes the controlled interface and accessible labels; the existing directory styling and form copy remain unchanged. Replace the directory's local function with the public import. Keep all other directory forms in place.

- [ ] **Step 2: Run the event typecheck after extraction.**

Run:

~~~bash
npm --workspace @prism/event run typecheck
~~~

Expected: the event app typecheck passes with the directory using the extracted panel.

## Task 5: Add and wire the closure review prompt

**Files:**

- Create: apps/event/src/features/suppliers/reviews/views/supplier-review-prompt-list.tsx
- Create: apps/event/src/features/suppliers/reviews/views/supplier-review-prompt-list.test.tsx
- Modify: apps/event/src/features/suppliers/reviews/index.ts
- Modify: apps/event/src/features/suppliers/directory/views/supplier-directory.tsx
- Modify: apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts
- Modify: apps/event/src/features/event-dashboard/shell/views/sections/event-workspace-tabs.tsx
- Modify: apps/event/src/features/closure/phase4/views/phase4-workspace.tsx

**Interfaces:**

- Produces SupplierReviewPromptList with props event, categories, suppliers, quoteRequests, reviewerName, busy, and onAddReview.
- onAddReview has signature (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>.
- Consumes selectSupplierReviewSubjects and the extracted SupplierReviewPanel.

- [ ] **Step 1: Write the failing jsdom prompt tests.**

Create supplier-review-prompt-list.test.tsx with the @vitest-environment jsdom header. Use these complete fixtures, then add the test contract below:

~~~tsx
const event = { id: "evt_close_1", eventName: "Leadership Forum" } as unknown as PrismEvent;
const category = {
  id: "cat_av",
  slug: "audio-visual",
  name: "Audio Visual",
  sortOrder: 1,
  active: true,
  reviewDimensions: [{ id: "dim_reliability", slug: "reliability", name: "Reliability", sortOrder: 1, active: true }],
} satisfies PrismSupplierCategory;
const supplier = {
  id: "sup_1",
  name: "Acme AV",
  categoryId: "cat_av",
  categoryName: "Audio Visual",
  reviews: [],
} as unknown as PrismSupplier;
const request = {
  id: "req_1",
  eventId: "evt_close_1",
  supplierId: "sup_1",
  supplierName: "Acme AV",
  category: "Audio Visual",
  message: "Support the event",
  accessToken: "token",
  confidentialBid: true,
  status: "selected",
  assignmentStatus: "confirmed",
  createdAt: "2026-06-01T00:00:00.000Z",
} satisfies PrismSupplierQuoteRequest;
const promptProps = {
  event,
  categories: [category],
  suppliers: [supplier],
  quoteRequests: [request],
  reviewerName: "Maxine",
  busy: false,
} as const;
~~~

~~~tsx
it("shows confirmed review work and marks it complete only after success", async () => {
  const onAddReview = vi.fn(async () => true);
  render(
    <SupplierReviewPromptList
      event={{ id: "evt_close_1", eventName: "Leadership Forum" } as PrismEvent}
      categories={[category]}
      suppliers={[supplier]}
      quoteRequests={[request]}
      reviewerName="Maxine"
      busy={false}
      onAddReview={onAddReview}
    />,
  );

  expect(screen.getByText("Acme AV")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Private review notes"), {
    target: { value: "Strong event-day recovery." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add review" }));

  await waitFor(() => expect(onAddReview).toHaveBeenCalledWith(
    "sup_1",
    expect.objectContaining({ rating: 4, notes: "Strong event-day recovery.", reviewedBy: "Maxine" }),
  ));
  expect(await screen.findByText("Review saved")).toBeTruthy();
});

it("leaves a failed submission due for retry", async () => {
  const onAddReview = vi.fn(async () => false);
  render(<SupplierReviewPromptList {...promptProps} onAddReview={onAddReview} />);
  fireEvent.change(screen.getByPlaceholderText("Private review notes"), { target: { value: "Retry this note." } });
  fireEvent.click(screen.getByRole("button", { name: "Add review" }));
  await waitFor(() => expect(onAddReview).toHaveBeenCalledTimes(1));
  expect(screen.getByPlaceholderText("Private review notes")).toBeTruthy();
  expect(screen.queryByText("Review saved")).toBeNull();
});
~~~

Use as unknown as only when a fixture intentionally omits unrelated read-only fields, never as any.

- [ ] **Step 2: Run the prompt tests and verify they fail because the view is absent.**

Run:

~~~bash
npm --workspace @prism/event exec vitest run src/features/suppliers/reviews/views/supplier-review-prompt-list.test.tsx
~~~

Expected: FAIL with the missing module/export error.

- [ ] **Step 3: Implement the prompt list and per-supplier controlled card.**

Call selectSupplierReviewSubjects once in SupplierReviewPromptList, show the selected event name plus due/completed counts, render a clear no-confirmed-assignment empty state, and render one SupplierReviewPromptCard for each due subject. Each card owns its draft state and idempotency key, resolves category dimensions by subject.supplier.categoryId, and assembles the shared input exactly as follows:

~~~ts
const input: CreateSupplierReviewInput = {
  rating: Number(reviewForm.rating),
  notes: reviewForm.notes,
  reviewedBy: reviewerName,
  dimensionRatings: Object.entries(reviewDimensionRatings)
    .filter(([, value]) => value)
    .map(([dimensionId, value]) => ({ dimensionId, rating: Number(value) })),
  idempotencyKey,
};
const succeeded = await onAddReview(subject.supplier.id, input);
if (succeeded) setCompleted(true);
~~~

Render Review saved only when succeeded is true. When it is false, retain the draft and form. The view must not call fetch, prismRequest, or a compatibility route.

- [ ] **Step 4: Make the dashboard review adapter return an explicit success boolean.**

Add this narrow helper beside the existing run function in use-event-dashboard-shell-view-model.ts:

~~~ts
async function runWithSuccess(actionLabel: string, action: () => Promise<unknown>) {
  setBusy(actionLabel);
  setError(null);
  try {
    await action();
    await refresh();
    await refreshSelectedEventWorkspace();
    await refreshApprovals();
    if (selectedEvent?.id) await loadLiveOps(true).catch(() => undefined);
    return true;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Action failed");
    return false;
  } finally {
    setBusy(null);
  }
}
~~~

Change only addSupplierReview to use it and return Promise<boolean>:

~~~ts
addSupplierReview: (supplierId: string, input: Parameters<typeof commands.addSupplierReview>[1]) =>
  session
    ? runWithSuccess("supplier private review", () =>
        commands.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }, session),
      )
    : Promise.resolve(false),
~~~

Update SupplierDirectory's callback type to return Promise<boolean>, await the result in submitReview, and clear the form/idempotency key only when the result is true.

- [ ] **Step 5: Wire the prompt through the existing closure composition.**

Pass these props from EventWorkspaceClosureTab into Phase4Workspace:

~~~tsx
supplierCategories={vm.supplierCategories}
suppliers={vm.suppliers}
quoteRequests={vm.quoteRequests}
reviewerName={vm.session.name}
onAddReview={vm.addSupplierReview}
~~~

Extend Phase4Workspace with matching PrismSupplierCategory[], PrismSupplier[], PrismSupplierQuoteRequest[], string, and (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean> props. Render immediately before Phase4InsightsSection:

~~~tsx
<SupplierReviewPromptList
  event={event}
  categories={supplierCategories}
  suppliers={suppliers}
  quoteRequests={quoteRequests}
  reviewerName={reviewerName}
  busy={busy}
  onAddReview={onAddReview}
/>
~~~

Keep PrismCloseGates and archiveEvent unchanged so the review is advisory.

- [ ] **Step 6: Run the event feature tests and typecheck.**

Run:

~~~bash
npm --workspace @prism/event exec vitest run src/features/suppliers/reviews/model/supplier-review-rules.test.ts src/features/suppliers/reviews/views/supplier-review-prompt-list.test.tsx
npm --workspace @prism/event run typecheck
~~~

Expected: selector and jsdom prompt tests pass; the event app typecheck exits 0. The failed-submission test must prove the form remains available for retry.

## Task 6: Record delivery evidence and perform the full verification pass

**Files:**

- Modify: CHANGELOG.md
- Modify: docs/log.md only when the catalog/ledger overlay is updated there

**Interfaces:**

- Produces documented, verifiable New-S5 evidence without changing unrelated catalog rows or claiming blocked capabilities.

- [ ] **Step 1: Add the changelog entry while preserving existing entries.**

Under the current [Unreleased] section in CHANGELOG.md, add one concise bullet with this content:

~~~md
- Added an event-scoped PMCM supplier review prompt for confirmed assignments in the closure workspace, backed by the shared Zod contract and existing audit/idempotency path.
~~~

If docs/log.md records catalog overlay evidence for this worktree, add a dated line naming New-S5, the closure route, the focused tests, and whether the external Cursor canvas was verified writable. Do not rewrite decision rows in docs/product/feature-ledger.md.

- [ ] **Step 2: Attempt the external canvas rescore only with verified write access.**

Inspect the Cursor-owned canvas path from the recovered agent transcript. If the file is writable from the current environment, change only New-S5 from partial to have after the acceptance checks pass and re-read the row to verify the saved value. If it is outside the writable workspace, leave it unchanged and record that limitation in the final handoff; do not claim a rescore occurred.

- [ ] **Step 3: Run all focused and repository-required checks.**

Run, in order:

~~~bash
npm --workspace @prism/types run test
npm --workspace @prism/types run build
npm --workspace prism-api exec vitest run src/modules/commercial/api/suppliers/suppliers.controller.test.ts src/modules/commercial/application/suppliers/supplier-profile-commands.service.test.ts
npm --workspace prism-api run typecheck
npm --workspace @prism/event run test -- --run src/features/suppliers/reviews
npm --workspace @prism/event run typecheck
npm run check:boundaries
git diff --check
~~~

Expected: every runnable command exits 0. Report any database-dependent, running-stack, or pre-existing unrelated failure separately rather than converting it into a false pass.

- [ ] **Step 4: Reinspect scope before handoff.**

Run:

~~~bash
git status --short --branch
git diff --stat
git diff --name-only
~~~

Confirm that the diff contains only the approved contract/API/closure slice, tests, and required documentation, while all earlier Cursor changes remain present. Do not commit or push in this plan execution.

## Plan self-review

- Spec coverage: shared Zod contract, API pipe, authorization/audit/idempotency preservation, confirmed-assignment selector, reusable form, closure integration, failure success-signal, privacy boundary, changelog, and external-canvas honesty are covered by Tasks 1–6.
- Placeholder scan: no unresolved placeholders or unbounded validation instructions are used; every implementation step names its file, interface, behavior, and verification command.
- Type consistency: CreateSupplierReviewInput is produced by @prism/types; onAddReview is consistently (supplierId, input) => Promise<boolean> in the dashboard VM, directory, prompt list, and Phase4 workspace; SupplierReviewSubject is produced by the selector and consumed by the prompt list.
- Scope check: no database migration, new notification adapter, external auth, QR, storage, AI, public supplier route, archive gate, commit, or push is included.

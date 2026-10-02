# Coordinator Role Catalog and Skill-Aware Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one validated coordinator role catalog and provide explainable, server-ranked skill suggestions in the PMCM assignment desk.

**Architecture:** Shared role and query contracts live in @prism/types. An Operations staffing service derives event requirements, filters active coordinators by role, same-date assignment and availability, ranks skill fit, and serves the same result to both the skill-match panel and conflict flow. The event dashboard calls that API through its feature data command; no database migration is needed.

**Tech Stack:** TypeScript, Zod 4, NestJS, Prisma, Next.js, React, Vitest, Testing Library.

**Spec:** docs/superpowers/specs/2026-10-02-coordinator-role-matching-design.md

## Global Constraints

- New coordinator-role writes use the seven canonical role names in the spec.
- Historical role values remain readable; never rewrite them silently.
- The Event Day System Operator role does not grant authority; event designation remains required.
- Skill requirements are advisory; explicitly selected skill filters require every selected skill.
- Keep same-date active-assignment and declared-unavailability checks.
- Rank by matched required-skill count descending, normalized name ascending, then stable coordinator ID ascending; cap at five after ranking.
- No Prisma schema or database migration changes.
- All shared write/query contracts live in @prism/types; portal HTTP stays in a data/command layer.
- Update root CHANGELOG.md in each implementation commit.
- Preserve unrelated work and use focused behavior tests, workspace typechecks, and check:boundaries.

---

## File map

- packages/types/src/schemas/coordinator-roles.ts — canonical role values and Zod role schema.
- packages/types/src/schemas/operations-staffing-inputs.ts — role write validation and suggestion query schema.
- packages/types/src/schemas/live-ops-inputs.ts — validation for coordinator-role fields on new live-ops writes.
- packages/types/src/schemas/index.ts — public schema exports.
- packages/types/src/event-ops/operations.ts — shared suggestion read model.
- packages/types/src/schemas/event-ops-inputs.test.ts — contract behavior tests.
- apps/api/src/modules/operations/application/staffing/coordinator-suggestion-rules.ts — deterministic role/skill matching and ranking rules.
- apps/api/src/modules/operations/application/staffing/coordinator-suggestions.service.ts — event-scoped candidate and requirement reads.
- apps/api/src/modules/operations/application/staffing/coordinator-suggestions.service.test.ts — eligibility, skill, ranking, and limit behavior tests.
- apps/api/src/modules/operations/api/staffing/coordinator-capacity.controller.ts — authenticated suggestion read route.
- apps/api/src/modules/operations/api/staffing/coordinator-capacity.controller.test.ts — route authorization behavior.
- apps/api/src/modules/operations/application/staffing/coordinator-assignment-command.service.ts — reuse the suggestion service for double-booking alternatives.
- apps/api/src/modules/operations/operations.module.ts — register the suggestion provider.
- apps/event/src/features/event-dashboard/shell/data/commands/operations-commands.ts — authenticated suggestion HTTP call.
- apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts — selected-event command callback.
- apps/event/src/features/event-dashboard/shell/views/sections/event-workspace-tabs.tsx and event-dashboard-section-views.tsx — pass the callback to both PMCM coordinator-desk entry points.
- apps/event/src/features/coordinators/desk/views/coordinator-assignment-desk.tsx — skill filter, ranked match display, and server-backed conflict suggestions.
- apps/event/src/features/coordinators/desk/views/coordinator-coverage-cards.tsx — select catalog roles for new coverage requirements.
- apps/event/src/features/coordinators/desk/model/coordinators-desk-rules.ts — remove the duplicate provisional catalog and client-side candidate ranking.
- apps/event/src/features/live-ops/workspace/views/live-ops-sections.tsx — render role options from the shared catalog.
- apps/api/src/fixtures/local-fixture-seeder.ts — use the shared role list for the complete fixture coverage catalog.
- Existing coordinator desk and live-ops behavior tests — assert role choices, skill filters, displayed match details, and conflict suggestions.
- CHANGELOG.md — one entry per implementation commit.

## Task 1: Add the shared role and suggestion query contracts

**Files:**
- Create: packages/types/src/schemas/coordinator-roles.ts
- Modify: packages/types/src/schemas/operations-staffing-inputs.ts
- Modify: packages/types/src/schemas/live-ops-inputs.ts
- Modify: packages/types/src/schemas/index.ts
- Modify: packages/types/src/event-ops/operations.ts
- Test: packages/types/src/schemas/event-ops-inputs.test.ts

**Interfaces:**
- COORDINATOR_ROLES is the readonly seven-value catalog from the spec.
- coordinatorRoleSchema is a Zod enum over COORDINATOR_ROLES.
- CoordinatorRole is inferred from coordinatorRoleSchema.
- CoordinatorSuggestionsQueryInput is inferred from coordinatorSuggestionsQuerySchema. The schema parses a canonical role and zero or more selected skill strings. Repeated skills query parameters parse as a string array; a single parameter also parses as a one-item array.
- PrismCoordinatorSuggestion has id, name, role, matchedSkills, missingSkills, matchedSkillCount, and requiredSkillCount.

- [ ] **Step 1: Add failing shared contract cases**

Add these assertions to the staffing contract describe block in packages/types/src/schemas/event-ops-inputs.test.ts:

~~~ts
expect(coordinatorRoleSchema.safeParse("Usher").success).toBe(true);
expect(coordinatorRoleSchema.safeParse("Operations Hero").success).toBe(false);
expect(createCoordinatorAssignmentSchema.safeParse({
  coordinatorId: "coord_1",
  role: "Operations Hero",
}).success).toBe(false);
expect(createCoordinatorCoverageRequirementSchema.safeParse({
  role: "Usher",
  required: 2,
  requiredSkills: ["registration"],
}).success).toBe(true);
expect(coordinatorSuggestionsQuerySchema.parse({
  role: "Usher",
  skills: ["registration", "first aid"],
})).toEqual({ role: "Usher", skills: ["registration", "first aid"] });
~~~

Import those names from @prism/types, run the focused test, and confirm it fails because the shared catalog and query contract are not exported yet.

Run: npm --workspace @prism/types run test -- src/schemas/event-ops-inputs.test.ts
Expected: FAIL on missing catalog/schema exports.

- [ ] **Step 2: Implement and export the role catalog**

Create packages/types/src/schemas/coordinator-roles.ts with the seven exact values in the approved spec, export the constant, Zod schema, and inferred type from packages/types/src/schemas/index.ts, and verify the root package barrel already exports that schemas barrel.

~~~ts
export const COORDINATOR_ROLES = [
  "General Coordinator",
  "Event Day System Operator",
  "Registration Staff",
  "Floor Director",
  "Stage Director",
  "Ingress and Egress Assistant",
  "Usher",
] as const;
export const coordinatorRoleSchema = z.enum(COORDINATOR_ROLES);
export type CoordinatorRole = z.infer<typeof coordinatorRoleSchema>;
~~~

- [ ] **Step 3: Apply the schema to role write fields**

In operations-staffing-inputs.ts, validate assignment role, replacement role fields, and coverage role with coordinatorRoleSchema. Keep assignment role optional for existing clients, but change the API fallback to choose only a coordinator tag that parses as a canonical role, otherwise try General Coordinator and reject if the coordinator is not tagged for it. In live-ops-inputs.ts, validate the new-write role fields assignedRole, toOwnerRole, ownerRole, schedule-segment ownerRole, and handoff role with the same schema. Keep all read-model role properties typed as string so historic values remain readable. Add coordinatorSuggestionsQuerySchema to operations-staffing-inputs.ts with a maximum of 20 selected skill strings.

- [ ] **Step 4: Add the suggestion read model**

In packages/types/src/event-ops/operations.ts, export PrismCoordinatorSuggestion with these exact fields:

~~~ts
export interface PrismCoordinatorSuggestion {
  id: string;
  name: string;
  role: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchedSkillCount: number;
  requiredSkillCount: number;
}
~~~

- [ ] **Step 5: Run shared contract tests and build**

Run: npm --workspace @prism/types run test -- src/schemas/event-ops-inputs.test.ts
Expected: PASS, including canonical role rejection and single/repeated skill query parsing.

Run: npm --workspace @prism/types run build
Expected: PASS and generated declarations expose the catalog, query, inferred type, and suggestion read model.

- [ ] **Step 6: Commit the contract slice**

Update CHANGELOG.md with the shared role and staffing-query contracts. Commit only the Task 1 files.

~~~text
git add CHANGELOG.md packages/types/src
git commit -m "feat(types): define coordinator role catalog"
~~~

## Task 2: Add API-ranked candidate suggestions

**Files:**
- Create: apps/api/src/modules/operations/application/staffing/coordinator-suggestion-rules.ts
- Create: apps/api/src/modules/operations/application/staffing/coordinator-suggestions.service.ts
- Create: apps/api/src/modules/operations/application/staffing/coordinator-suggestions.service.test.ts
- Create: apps/api/src/modules/operations/api/staffing/coordinator-capacity.controller.test.ts
- Modify: apps/api/src/modules/operations/api/staffing/coordinator-capacity.controller.ts
- Modify: apps/api/src/modules/operations/application/staffing/coordinator-assignment-command.service.ts
- Modify: apps/api/src/modules/operations/operations.module.ts
- Modify: CHANGELOG.md

**Interfaces:**
- CoordinatorSuggestionsService.listForEvent(eventId: string, query: CoordinatorSuggestionsQueryInput) returns Promise<PrismCoordinatorSuggestion[]>; listForConflict(event: Pick<OpsEvent, "id" | "eventDate">, role: string, excludeCoordinatorId: string, prisma: Prisma.TransactionClient | PrismaService) returns Promise<PrismCoordinatorSuggestion[]>;
- query is CoordinatorSuggestionsQueryInput from @prism/types.
- options can exclude the coordinator already involved in a conflict and can supply the active Prisma transaction client.
- GET /events/:eventId/staffing/coordinator-suggestions accepts role and repeated skills query parameters and returns at most five ranked suggestions.
- The API route permits only PmcmAdmin and System actors for the requested event.
- CoordinatorAssignmentCommandService uses the same matching service for same-role conflict alternatives.

- [ ] **Step 1: Write API behavior tests first**

Use a fake Prisma client with an event date, a coverage requirement, candidates with roleTags and skillsTags, same-day active assignments, and overlapping availability. Assert that inactive, wrong-role, same-date-assigned, and unavailable coordinators are omitted. Assert that all selected skills are required, missing required skills are returned, and candidate order is stable.

~~~ts
expect(suggestions.map((item) => item.id)).toEqual([
  "coord_best",
  "coord_tie_a",
  "coord_tie_b",
]);
expect(suggestions[0]).toMatchObject({
  matchedSkills: ["registration", "first aid"],
  missingSkills: [],
  matchedSkillCount: 2,
  requiredSkillCount: 2,
});
expect(suggestions).toHaveLength(5);
~~~

Run: npm --workspace prism-api run test -- src/modules/operations/application/staffing/coordinator-suggestions.service.test.ts
Expected: FAIL because the suggestion service does not exist.

- [ ] **Step 2: Implement pure normalization and ranking rules**

In coordinator-suggestion-rules.ts, normalize role and skill comparisons with Unicode NFC normalization, trim, collapse internal whitespace, and case-insensitive comparison. Compute the matched and missing required skill labels using the original display spelling. Filter candidates against every selected skill. Sort by matched required skill count descending, normalized name ascending, and id ascending; return the first five only after sorting. With no required skills, retain deterministic name and id order.

- [ ] **Step 3: Implement the event-scoped suggestion service**

In coordinator-suggestions.service.ts, load the event date and that event's coverage requirement for the requested canonical role. Query active coordinators, assignments on that date whose status is neither cancelled nor replaced, and availability intervals overlapping the event day. Reuse the current 500-record staffing bounds where applicable. Apply the rule helper, exclude the optional conflict coordinator, and map to PrismCoordinatorSuggestion. Throw NotFoundException for a missing event. Do not query or return coordinators outside this event-scoped staffing request.

- [ ] **Step 4: Reuse the service for assignment-conflict alternatives**

Inject CoordinatorSuggestionsService into CoordinatorAssignmentCommandService and replace its private alphabetic list-and-slice implementation with the shared server ranking call, passing the existing transaction client and excluded coordinator ID. Extend the current conflict behavior test to assert the matched/missing skill payload and post-ranking five-result limit.

- [ ] **Step 5: Add the authenticated suggestions endpoint**

In coordinator-capacity.controller.ts, add GET :eventId/staffing/coordinator-suggestions, validate query with zodQuery(coordinatorSuggestionsQuerySchema), require PmcmAdmin or System access scoped to eventId, and return CoordinatorSuggestionsService.listForEvent. Register the service in operations.module.ts. Add a controller test that permits PMCM/System for the matching event and rejects a Coordinator actor.

- [ ] **Step 6: Run API focused tests and typecheck**

Run: npm --workspace prism-api run test -- src/modules/operations/application/staffing/coordinator-suggestions.service.test.ts src/modules/operations/api/staffing/coordinator-capacity.controller.test.ts src/modules/operations/application/staffing/coordinators.service.test.ts
Expected: PASS for service ranking, eligibility, access, and the existing assignment-conflict path.

Run: npm --workspace prism-api run typecheck
Expected: PASS with the new provider wired into both API consumers.

- [ ] **Step 7: Commit the API slice**

Add one changelog entry for event-scoped ranked suggestions and commit only Task 2 API/test files plus the changelog entry.

~~~text
git add CHANGELOG.md apps/api/src/modules/operations
git commit -m "feat(operations): rank coordinator skill suggestions"
~~~

## Task 3: Wire the assignment desk to the shared suggestions

**Files:**
- Modify: apps/event/src/features/event-dashboard/shell/data/commands/operations-commands.ts
- Modify: apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts
- Modify: apps/event/src/features/event-dashboard/shell/views/sections/event-workspace-tabs.tsx
- Modify: apps/event/src/features/event-dashboard/shell/views/sections/event-dashboard-section-views.tsx
- Modify: apps/event/src/features/coordinators/desk/views/coordinator-assignment-desk.tsx
- Modify: apps/event/src/features/coordinators/desk/views/coordinator-coverage-cards.tsx
- Modify: apps/event/src/features/coordinators/desk/model/coordinators-desk-rules.ts
- Modify: apps/event/src/features/coordinators/desk/model/coordinators-desk-rules.test.ts
- Modify: apps/event/src/features/coordinators/desk/views/coordinator-assignment-desk.test.tsx
- Modify: apps/event/src/features/live-ops/workspace/views/live-ops-sections.tsx
- Modify: apps/api/src/fixtures/local-fixture-seeder.ts
- Modify: CHANGELOG.md

**Interfaces:**
- Event dashboard command loadCoordinatorSuggestions(eventId, input) calls the scoped GET route and returns PrismCoordinatorSuggestion[].
- CoordinatorAssignmentDesk receives onLoadSuggestions(role, selectedSkills).
- The desk shows matched/missing tags and match counts from the server; it does not create or re-rank a local suggestions list.
- Skill-filter choices require an explicit role and all selected tags; results use the API's five-item limit.
- Conflict-modal alternatives use the same server results, preserving the manual override action for the originally selected coordinator.

- [ ] **Step 1: Add failing desk interaction coverage**

Extend coordinator-assignment-desk.test.tsx with a successful suggestion callback returning a candidate with one matched and one missing skill. Assert the chosen role and all selected skills are sent to onLoadSuggestions and the UI shows both matched and missing labels.

~~~ts
expect(props.onLoadSuggestions).toHaveBeenCalledWith("Usher", ["registration"]);
expect(await screen.findByText("Matched: registration")).toBeTruthy();
expect(screen.getByText("Missing: first aid")).toBeTruthy();
~~~

Run: npm --workspace @prism/event run test -- src/features/coordinators/desk/views/coordinator-assignment-desk.test.tsx
Expected: FAIL because the desk has no skill suggestion callback or match panel.

- [ ] **Step 2: Add the dashboard data command**

Add listCoordinatorSuggestions to operations-commands.ts. Build a URL with URLSearchParams, append one skills parameter per selected skill, and return the shared response type. Add loadCoordinatorSuggestions to the event dashboard view model and pass it through both coordinator tab entry points.

- [ ] **Step 3: Implement the skill-match panel**

In coordinator-assignment-desk.tsx, provide a catalog role selector, derive available skill filter labels from the selected role's coordinator profiles, and let PMCM select multiple skill tags. On submit call onLoadSuggestions with the selected role and tags. Render server-returned results with matched/missing tags and counts, and assign from the returned candidate ID. Show loading, request failure, and empty-result messages as visible status text. In coordinator task and issue builders, do not copy a historical out-of-catalog role into a new ownerRole write; retain the verified ownerName attribution and omit that role field unless it validates against the catalog.

- [ ] **Step 4: Use server suggestions in the conflict panel**

When the existing local same-date conflict opens, request suggestions for the pending role with no selected-skill filter. Replace suggestAvailableSameRoleCoordinators and the local alphabetical list with the server response. Preserve the existing explicit override action and test its behavior remains unchanged.

- [ ] **Step 5: Replace duplicated role options and free-text staffing role entry**

Use COORDINATOR_ROLES in coordinators-desk-rules.ts, the coverage target select, live-ops role selectors, and the complete fixture coverage list. Keep assignment-directory grouping able to display legacy role tags, but disable new assignment actions for non-catalog roles. The coverage editor offers only catalog roles and displays a mapping prompt when the saved role is legacy. Keep read models as string fields and preserve unknown historical display values. Remove the provisional list and obsolete local suggestion helper. Extend role-rule and desk tests to confirm that an out-of-catalog legacy value remains displayable but is not available as a new role choice.

- [ ] **Step 6: Run event tests, typecheck, and boundary checks**

Run: npm --workspace @prism/event run test -- src/features/coordinators/desk/views/coordinator-assignment-desk.test.tsx src/features/coordinators/desk/model/coordinators-desk-rules.test.ts
Expected: PASS for filters, result display, conflict choices, and role selectors.

Run: npm --workspace @prism/event run typecheck
Expected: PASS for both coordinator desk entry points and the new shared response type.

Run: npm run check:boundaries
Expected: PASS; no UI-to-API private imports or app-local contracts are introduced.

- [ ] **Step 7: Commit the event portal slice**

Add one changelog entry for the assignment desk skill filter, server-ranked explanations, and shared role selectors; commit only Task 3 files.

~~~text
git add CHANGELOG.md apps/event/src/features/coordinators/desk apps/event/src/features/event-dashboard apps/event/src/features/live-ops/workspace/views/live-ops-sections.tsx apps/api/src/fixtures/local-fixture-seeder.ts
git commit -m "feat(event): add coordinator skill match filters"
~~~

## Task 4: Verify the complete slice

- [ ] **Step 1: Rebuild shared declarations and run all focused workspaces**

Run: npm --workspace @prism/types run build
Expected: PASS and downstream workspaces use fresh declarations.

Run: npm --workspace @prism/types run test
Expected: PASS for all shared contract tests.

Run: npm --workspace prism-api run test -- src/modules/operations/application/staffing src/modules/operations/api/staffing
Expected: PASS for all staffing API tests.

Run: npm --workspace prism-api run typecheck
Expected: PASS.

Run: npm --workspace @prism/event run test -- src/features/coordinators/desk src/features/event-dashboard/shell
Expected: PASS for coordinator desk and command-wiring behavior.

Run: npm --workspace @prism/event run typecheck
Expected: PASS.

- [ ] **Step 2: Verify repository boundaries and patch hygiene**

Run: npm run check:boundaries
Expected: PASS.

Run: git diff --check
Expected: no whitespace errors.

Search for the old PROVISIONAL_TASK_ROLES identifier and the client-side suggestAvailableSameRoleCoordinators helper. Expected: no remaining production references.

- [ ] **Step 3: Report the delivered slice and PR stack**

Confirm each task commit is on its own stacked PR, identify its parent PR, list exact checks and results, and state that the remaining coordinator gaps are still in their planned follow-on slices.

# Story Log: EP-02-S05, Coordinator Directory and Staffing Assignment

**Status: Complete (implementation), second-owner review pending, not self-certifiable per DoD**
**Session(s): 2026-07-12**
**Current percentage (Option C, real verified state): ~90%**

## What we set out to do

Starting point per the Task Guide and 29-story verification file: In Progress,
60% (Option C). Two failing ACs:

- **AC5/FR-89, withdrawal/replacement:** fully unimplemented. Fresh grep on
  coordinators.service.ts for withdraw/replace/Replacement returned 8 matches,
  all inside the read mapper only, zero write-method matches. Schema columns
  (replacedByAssignmentId, replacementReason, replacedAt, replacedBy) already
  existed but nothing wrote them.
- **AC8, PMCM-only access, CRITICAL:** event-coordinator-assignments.controller.ts's
  assignCoordinator (POST) and acknowledgeCoordinator (PATCH) endpoints had
  zero actor parameter, no role check at all. Confirmed unchanged since
  2026-07-02, unpatched as of the 2026-07-04 sweep (PA-193) and EP-11's own
  audit (PA-191).

PA refs going in: PA-135, PA-136, PA-191, PA-193.

## What we did

**Plan correction, before any code was written.** The original build prompt
(scoped in Claude Chat from the Task Guide and 29-story verification file)
had three factual errors, all caught by Claude Code checking the live repo
before touching anything:
- Cited branch (feature/ep-02-s05-coordinator-staffing) did not exist; real
  branch was feature/ep-02-s05-coordinator-directory, already carrying
  frontend WIP, forked before PR #8 ("Harden event auth session RBAC") merged
  into main.
- Cited "EP-04-S01 requireActorRole precedent" did not exist in the code.
  Real, already-live pattern in this exact module is EventSessionGuard +
  @VerifiedEventActor(), mirroring the sibling coordinator-workspace.controller.ts.
- Schema has no standalone "withdrawn" concept, only replacement fields plus
  an unused Cancelled status. Resolved as two operations, not one combined
  operation.

Branch strategy corrected from rebase to merge (safer given unconfirmed PR
status on the target branch). Plan finalized and confirmed before Claude Code
began writing code.

**Git housekeeping friction, real but resolved.** A stash step early in the
plan used `git stash push -u`, which swept up all untracked local files
(PRISM_ActiveSkills.md, PRISM_Audits/, Story Logs, handoffs_archive/, etc.),
not just the two files it was meant to protect. This happened twice, once in
a separate parallel Claude Code window operating on stale git state, and once
correctly scoped but still overly broad. Both times fully recovered via
`git stash pop`, no data lost. Root cause: `-u` stashes the entire working
tree's untracked files, not a targeted set. Worth correcting in any future
plan that reuses this stash pattern, scope it to named files instead.

**Implementation, once plan was confirmed on the correct branch and state:**
- Added WithdrawCoordinatorAssignmentDto and ReplaceCoordinatorAssignmentDto
  to staffing-ops.dto.ts.
- Refactored coordinators.service.ts: extracted resolveAssignmentPlan and
  buildAssignmentCreateData as private helpers, behavior-preserving, reused
  by both assignCoordinator and the new replaceCoordinator.
- Added actor param + requireActorRole gates to assignCoordinator
  ([PmcmAdmin]) and acknowledgeCoordinator ([PmcmAdmin, Coordinator], a
  documented deviation from literal "PmcmAdmin-only" since
  coordinator-view.tsx:247 calls it for self-acknowledgment, a real shipping
  flow that PmcmAdmin-only would have broken). Both decisions carry inline
  "FLAGGED SCOPING DECISION (EP-02-S05 / AC8)" comments.
- Replaced hardcoded actor identity ('pmcm_admin'/'coordinator' literals) in
  commandContext and audit entries with real actor.id/actor.name/actor.role.
- Implemented withdrawCoordinator (PmcmAdmin-only, status to Cancelled, one
  audit entry, one notification, same_tx).
- Implemented replaceCoordinator (PmcmAdmin-only, single write callback
  performing create-then-update against the same tx client, no nested
  $transaction, two audit entries, two notifications, same_tx preserved).
- Updated event-coordinator-assignments.controller.ts: @UseGuards(EventSessionGuard)
  + @VerifiedEventActor() on all four endpoints, two new routes
  (PATCH .../withdraw, PATCH .../replace).
- Fixed the fake prisma.opsCoordinatorAssignment.update in
  coordinators.service.test.ts from hardcoded assignments[1] to
  findIndex-based, as required before new tests could be trusted.
- Updated staffing-commands.port.ts's interface to match the real 4-method,
  actor-aware surface, confirmed zero consumers of the stale 2-arg signature
  before changing it. Reviewed directly by Francis before acceptance.
- Full test suites added per the plan's Testing section for both new
  operations plus role-gate regression cases.

## What worked

- `npx vitest run libs/modules/staffing-ops/src`: 4 files, 21 tests passed.
- `npx vitest run libs/modules/staffing-ops libs/modules/event-read-models`:
  12 files, 53 tests passed.
- `npm run typecheck`: 0 errors in staffing-ops.
- `npm run prisma:validate`: schema valid.
- `grep -rn "STAFFING_COMMANDS|STAFFING_READER" apps/api/libs`: 3 files, all
  accounted for, no stale 2-arg caller.
- `git status --short`: confirmed exactly the 6 intended files modified
  (staffing-ops.dto.ts, coordinators.service.ts,
  event-coordinator-assignments.controller.ts, coordinators.service.test.ts,
  event-coordinator-assignments.controller.test.ts, staffing-commands.port.ts),
  no stray edits.
- Merge of main into the branch: clean, no conflicts, confirmed by both a
  pre-flight git merge-tree check and the actual merge output.

## What didn't work

- The `-u` stash flag was too broad, twice, as described above. Fully
  recovered, no lasting damage, but consumed real session time untangling
  git state, including a false alarm caused by a separate, stale-state
  Claude Code window operating on the same repo in parallel.
- Two test coverage gaps identified during final report review, see
  Remaining gaps below, not fixed in this session, flagged rather than
  silently left out of the report.

## New PA findings

- **PA-276 (HIGH):** acknowledgeCoordinator does not verify the acknowledging
  coordinator owns assignmentId. Any authenticated Coordinator actor can
  acknowledge any assignment ID, before and after this story's change.
  Pre-existing, orthogonal to this story's scope, not fixed here.
- **PA-277 (MEDIUM, architectural):** ResolvedEventOpsActor.explicit is
  correctly computed in both resolveActor() (Boolean(input.actorRole ??
  input.role)) and resolveVerifiedActor() (always true), but no caller
  anywhere in apps/api reads it. Appears intended as a compensating signal
  for the known resolveActor fail-open pattern (PA-135/136/191/193) but is
  currently inert. This story's own code path is unaffected, it exclusively
  uses resolveVerifiedActor. Flagged for a future sweep, out of scope here.

## Remaining gaps

- withdrawCoordinator's already-Replaced rejection path is untested. The
  existing "already cancelled or replaced" test only exercises the Cancelled
  branch (withdraw called twice on the same assignment). No test transitions
  an assignment to Replaced and then attempts to withdraw it. The same gap
  exists in replaceCoordinator's own guard test, only proven against a fresh
  PendingAcknowledgement assignment, not an already-Replaced one. The guard
  logic itself (`status === Cancelled || status === Replaced`) is correctly
  implemented, just not fully proven by tests.
- EventSessionGuard itself is not exercised by the controller test suite.
  event-coordinator-assignments.controller.test.ts instantiates the
  controller directly rather than through @nestjs/testing's
  Test.createTestingModule, so Nest's guard-execution pipeline never runs.
  Session-token verification is only proven at the unit level inside
  AuthSessionService's own tests, pre-existing, untouched by this story.
  No test in this story's diff proves an unauthenticated request to any of
  the four endpoints is actually rejected end-to-end. This mirrors the same
  trade-off already made by the sibling coordinator-workspace.controller.test.ts,
  consistent with this module's existing convention, but a real coverage
  gap, not a non-issue.
- sample-compatibility.service.ts/.test.ts have 3 pre-existing typecheck
  errors on this branch, confirmed via git diff showing no session changes
  touch those files. Unrelated to this story, not addressed.
- Second-owner review has not yet happened. Per DoD, this cannot be
  self-certified as Done until that review is complete.

## Resume point, if Paused

Not applicable, story is not paused. Next actions: draft the second-owner
review request (Claude drafts, Francis sends, per standing escalation rule),
and consider whether the two test coverage gaps above warrant a small
follow-up addition before or alongside second-owner review, Francis's call.
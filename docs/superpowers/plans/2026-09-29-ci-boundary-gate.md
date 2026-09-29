# CI Boundary Gate Implementation Plan

> **For agentic workers:** Execute inline in small steps with a focused check after each change.

**Goal:** Make pull request CI run the existing repository boundary check and its focused guard tests.

**Architecture:** Keep the current boundary rules and local commands as the single source of truth. Add the existing commands to the reusable workflow inputs and document the delivered gate in the root changelog.

**Tech Stack:** GitHub Actions reusable workflow, npm scripts, Node test runner.

**Spec:** docs/superpowers/specs/2026-09-29-ci-boundary-gate-design.md

## Global Constraints

- Preserve the current boundary checker implementation and local command behavior.
- Do not raise coverage thresholds or add tests that only mirror the workflow text.
- Update CHANGELOG.md for this user-requested delivery.

---

### Task 1: Confirm current local boundary commands

**Files:**
- Read: package.json
- Read: scripts/check-prism-boundaries.mjs
- Read: scripts/check-prism-boundaries.test.mjs

**Interfaces:**
- Consumes: npm run check:boundaries; npm run test:boundaries
- Produces: the existing command names and repository check behavior that CI will invoke.

- [x] **Step 1: Run the repository boundary check**

Run: `npm run check:boundaries`
Expected: PASS with the number of tracked source files checked.

- [x] **Step 2: Run the guard behavior suite**

Run: `npm run test:boundaries`
Expected: PASS; failures identify a regression in existing guards and must be understood before changing workflow wiring.

### Task 2: Wire both existing commands into PR CI

**Files:**
- Modify: .github/workflows/ci.yml
- Modify: CHANGELOG.md

**Interfaces:**
- Consumes: root scripts `check:boundaries` and `test:boundaries`.
- Produces: reusable CI inputs that execute `npm run check:boundaries` in typecheck_command and `npm run test:boundaries` in test_command.

- [x] **Step 1: Add the repository check to typecheck_command**

Append `npm run check:boundaries` before `npm run typecheck` in the reusable typecheck command. Keep every current check in its existing order.

- [x] **Step 2: Add the guard suite to test_command**

Append `npm run test:boundaries` after the existing test command sequence. Preserve the API and portal test commands.

- [x] **Step 3: Record the gate in the Unreleased changelog**

Add one concise bullet under `### Added` saying pull request CI now runs both the boundary scan and boundary guard suite.

### Task 3: Verify the workflow change

**Files:**
- Verify: .github/workflows/ci.yml
- Verify: CHANGELOG.md

**Interfaces:**
- Consumes: the modified reusable workflow input strings.
- Produces: verified local commands and a clean diff.

- [x] **Step 1: Re-run both boundary commands**

Run: `npm run check:boundaries` and `npm run test:boundaries`.
Expected: both PASS.

- [x] **Step 2: Check whitespace and scope**

Run: `git diff --check`.
Expected: no whitespace errors; only the planned workflow and changelog changes plus this temporary plan are modified.

- [x] **Step 3: Commit the isolated gate**

Run: `git add .github/workflows/ci.yml CHANGELOG.md docs/superpowers/plans/2026-09-29-ci-boundary-gate.md; git commit -m "ci: enforce repository boundaries"`.
Expected: one conventional commit containing the CI gate.

## Self-review

- Spec coverage: both commands run in PR CI; checker implementation stays unchanged; changelog is updated.
- No new tests or scope expansion are introduced.
- The downstream packages and role boundaries are unaffected.


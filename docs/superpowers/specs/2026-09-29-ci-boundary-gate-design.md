# CI Boundary Enforcement Design

**Status:** Proposed for implementation
**Date:** 2026-09-29
**Base:** staging at 944f8e90
**Owner:** D (Anthony)

## Problem

The repository has a local static boundary checker, but pull request CI does not run it. Cross-app imports, private context imports, duplicated shared contracts, and other forbidden dependencies can therefore enter through a green PR even though the repository already has a local check.

## Goal

Run the existing boundary checker and its behavior-oriented tests in the required pull request CI pipeline.

## Design

Add npm run check:boundaries to the reusable CI typecheck command and npm run test:boundaries to the CI test command in .github/workflows/ci.yml. Keep the checker implementation and its local interface unchanged. The pipeline should fail on the same boundary violations developers can already find locally.

Do not use this change to broaden coverage thresholds or count UI files that do not yet have meaningful behavior tests. Add view-level behavior tests with the workflow refactors that make those paths independently testable.

## Alternatives considered

- Add only a test of the boundary-checker script: insufficient because it would not run the actual repository check on a PR.
- Add both existing commands to CI: selected; this enforces the rule and tests the guard itself.
- Rewrite the boundary checker as part of this change: rejected because its scope and behavior are separate from making the existing gate run.

## Acceptance

- CI executes both commands for staging and prod pull requests.
- A locally failing boundary check fails the same required CI job.
- Existing boundary tests pass.
- Changelog records the CI enforcement change.


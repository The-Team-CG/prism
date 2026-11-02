---
type: "Playbook"
title: "Developer checks and CI"
description: "Run Prism's native typechecks, architecture lint, push checks, and isolated CI jobs."
tags: [runbook, ci, tooling, testing]
status: canonical
updated: "2026-11-02"
authority: operational
audience: [developers, agents]
scope: "Local developer feedback and GitHub-hosted validation across all workspaces"
last_verified: "2026-11-02; compiler diagnostics, task selection, required-check decisions, source lint and focused Nest/SDK behavior checked locally; hosted timing requires a workflow run"
sources:
  - id: task-plan
    resource: "scripts/ci/task-plan.mjs"
    title: "Dependency-aware task selection"
  - id: compiler
    resource: "scripts/typescript.mjs"
    title: "Explicit compiler selection"
  - id: ci
    resource: ".github/workflows/ci.yml"
    title: "GitHub validation jobs"
  - id: browser
    resource: "scripts/e2e/browser/README.md"
    title: "Disposable browser acceptance"
---
# Developer checks and CI

## At a glance

- **Purpose:** Catch mistakes locally and run independent CI work concurrently.
- **Authority:** Operational guide for repository checks and compiler ownership.
- **Scope:** All role apps, shared packages, API tooling, and GitHub-hosted jobs.
- **Use when:** Preparing a push, changing the toolchain, or diagnosing selected/skipped tasks.
- **Change when:** Compiler wrappers, CI selection, required checks, or hook behavior changes.
- **Verify with:** `npm run test:ci:guards`, focused workspace checks, and the actual workflows.

## Local checks

```bash
npm run typecheck              # TypeScript 7 CLI, all workspaces
npm run lint                   # Oxlint and the five Prism architecture rules
npm run test:ci                # workspace suites and existing coverage thresholds
npm run test:ci:guards         # Git selection, required results, hooks, compiler diagnostics
npm run check:boundaries       # independent repository-wide boundary scanner
npm run hooks:install          # install the tracked pre-push hook
npm run check:push             # check the committed HEAD against staging
```

`npm install` also installs the pre-push hook through `prepare`. Existing custom
`core.hooksPath` settings are preserved; integrate `.githooks/pre-push` there or
run `check:push` manually. CI skips hook installation.

The hook receives Git's actual pushed refs. It checks committed changes and the
complete affected workspace projects, including dependents. A new branch uses
staging ancestry when available. Missing history falls back to the full graph.
Deleted refs need no source checks. A pushed commit must be checked out, and
dirty selected/dependency inputs must be committed or set aside before checking.
Unrelated dirty workspace changes remain allowed. CI repeats the checks because
Git hooks can be bypassed. No repository-wide formatting rewrite is required.

## Compiler ownership

`typescript` stays on version 6 for Nest builds, shared declaration generation,
AST checks, the Next editor plugin, and existing watch/Docker tools. The separate
`@typescript/native` npm alias provides the version 7 CLI. Workspace `typecheck`
scripts use `scripts/typescript.mjs`, which resolves the exact package binary
instead of trusting whichever `tsc` npm linked into `.bin`.

```bash
node scripts/typescript.mjs --noEmit -p apps/api/tsconfig.json
node scripts/typescript.mjs --compiler=legacy --noEmit -p apps/api/tsconfig.json
node scripts/typescript.mjs --compiler=bun --noEmit -p apps/api/tsconfig.json
npm run benchmark:typecheck -- --runs=5 --project=apps/api
```

Bun is an optional checker comparison; npm remains the package manager and Node
remains the runtime. Shared declarations still use the legacy compiler. The
benchmark rotates compiler order, disables incremental state, rejects failed
checks, and writes raw observations to ignored `.local-dev/typecheck-benchmark.json`.
Omit `--project` to compare every workspace. Measure without other heavy work,
and compare median/range and matching diagnostics before selecting a checker.
Local timings do not establish a hosted CI speedup.

Nest runtime packages and their peer consumers must resolve one compatible
major. Root Nest core/common overrides keep config and throttler on the API's
version 12 class identities. An HTTP rate-limit test verifies initialization and
429 behavior. The API explicitly supplies its Express adapter, so startup does
not depend on npm hoisting the HTTP driver beside Nest core. `reflect-metadata`
loads before Nest runtime/test decorators. API production/browser builds omit
test files; workspace typechecks still check them.

## Lint scope

Every workspace has a source lint command. Oxlint runs the same five Prism rules
plus type-aware floating-promise and await checks. The plugin and independent
boundary scanner share the existing approved public context seams. Shared Zod
schemas remain under `packages/types/src/schemas`; API adapters import them.

`eslint.config.mjs` remains available for editor integrations and architecture
behavior fixtures. It is not a second full CI lint pass. Both implementations
retain tests for valid public contracts and forbidden private imports.

## GitHub checks

`CI` runs repository checks, lint/typecheck, workspace tests, and production
builds in separate GitHub-hosted jobs. Security workflows remain independent.
The final required **Node CI** result succeeds only when every validation and
security dependency succeeds. Failure, cancellation, skipped dependencies, and
missing results fail the aggregate.

On pull requests, `scripts/ci/run-tasks.mjs` computes changed workspaces from the
actual Git merge base and includes every dependent. Manifests, root/shared inputs,
unknown paths, missing ancestry, or an empty/uncertain selection run the full
graph. Pushes run the full graph. Repository migration, persistence, invariant,
clock, complexity, boundary, and security gates always run in full.

Npm caches download data. Turbo caches task outputs, keyed by platform,
architecture, Node baseline, lockfile, job, and commit, with compatible restore
prefixes. Tool wrappers/configuration are global task inputs. Installed dependency
trees are not cached; regeneration and install lifecycle behavior remain intact.
The root manifest permits version-specific Prisma and Bun installer scripts.

Desktop and mobile browser acceptance run in separate hosted jobs with separate
PostgreSQL services, databases, Mailpit containers, and synthetic actors. Each
invocation keeps one worker because its fixture accounts/session/game data are
shared. Four portal route groups per viewport preserve full route discovery,
initial-data/error checks, access guards, and supplier pagination assertions.
Phase timings are uploaded separately from bounded failure reports. The required
**browser** aggregate needs both viewport jobs to succeed. See the
[browser acceptance guide](../../scripts/e2e/browser/README.md).

Vitest API/portal suites cap workers at two to avoid multiplying module-loading
memory. Turbo still runs workspace test suites one at a time. The API partitions
six reviewed pure-policy files into a shared-module project with global/mock/
environment/timer cleanup; every other file retains isolation. Discovery checks
prove every behavior file, including database suites, belongs to exactly one
project. The shared group passed five shuffled seeds with 33 tests per run.
`npm --workspace prism-api run test:shared -- --sequence.seed=1729` runs that group
alone. New candidates require review and shuffled/order checks before joining
`apps/api/test/shared-policy-tests.ts`. Coverage thresholds and full
scheduled/milestone checks remain in place.

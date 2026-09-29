---
type: "Engineering Workflow Review"
title: "Development efficiency report"
description: "Repository-grounded findings and recommendations for reducing development feedback time and instruction overhead without weakening critical gates."
tags: [engineering, workflow, testing, scripts, efficiency]
status: current-review
updated: "2026-09-29"
authority: informative
owner: "D (Anthony)"
audience: [engineers, reviewers, agents]
scope: "npm scripts, repository tooling, CI verification, test policy, and agent instructions"
last_verified: "2026-09-29; package manifests, CI workflow, PR template, and agent instruction inventory"
sources:
  - resource: "package.json"
    title: "Root scripts and workspace configuration"
  - resource: "apps/api/package.json"
    title: "API scripts"
  - resource: ".github/workflows/ci.yml"
    title: "Pull-request verification pipeline"
  - resource: "AGENTS.md"
    title: "Repository agent instructions"
  - resource: ".github/pull_request_template.md"
    title: "Behavior and test evidence prompt for pull requests"
  - resource: "docs/constitution.md"
    title: "Documentation and architecture rules"
---
# Development efficiency report

## At a glance

- **Purpose:** Identify practical ways to shorten the time from a code change to useful feedback.
- **Authority:** Informative review. This report does not authorize removing a safety, migration, privacy, or release gate.
- **Owner:** D (Anthony).
- **Scope:** Script discovery, local verification, CI breadth, test quality, and contributor instructions.
- **Use/change:** Revisit after collecting CI and local feedback-time measurements or after a tooling change.
- **Evidence limits:** This is a static repository inventory. No CI duration history, script invocation telemetry, or representative edit-to-feedback timings were available here.

## Inventory

| Area | Observed in this checkout | Interpretation |
| --- | --- | --- |
| npm scripts | 112 entries in 10 manifests: 36 root, 33 API, 32 across four portals, and 11 across shared packages. | Raw entry count overstates unique commands. Most portal entries are parallel lifecycle scripts; the API entries include distinct database operations and audits. |
| Helper files | 38 JavaScript-family files under `scripts/` and `apps/api/scripts/`. | This includes tests and utilities, not 38 user-facing commands. |
| Tests | 206 test/spec-related files under `apps/`, `packages/`, and `scripts/`. | File count does not establish redundancy or value. Review by behavior and runtime, not by a deletion quota. |
| Agent guidance | At the start of this review, one root `AGENTS.md` at 242 lines; `docs/constitution.md` is 186 lines. | There are not many competing `AGENTS.md` files. The likely burden is reference detail and repeated ownership guidance across canonical docs. |
| Pull-request CI | Each PR runs migration, invariant, test-clock, complexity, monorepo typecheck, migration/invariant/clock guard tests, API coverage, coverage for all four portals, build, and dependency audit. | The broad full-suite gate is the clearest candidate for measured feedback-time improvement. This checkout contains no duration data to quantify the cost. |
| Test-quality review | The repository now has a concise PR prompt for behavior evidence, alongside the behavior-first rules in `AGENTS.md`. | CI can run tests, but a person must judge whether assertions cover observable behavior and a real gap. The constitution records that GitHub Free cannot enforce required reviewers as a merge lock on this private repository; the template is a prompt and the PR review record is evidence. |

The command names `check:boundaries` and `test:boundaries` are not synonyms:
the first runs the static boundary scan; the second runs tests for several
repository guards and tooling helpers. The agent command reference now says so.

Counts above are an inventory snapshot taken before the agent-guidance update
in this delivery. Script and test counts are not performance measurements.

## Findings and recommended action

| Priority | Finding | Recommendation | Risk |
| --- | --- | --- | --- |
| P0 | Local feedback should be narrower than the PR gate. Root `build`, `typecheck`, and `test:api` are repository-wide or workspace-wide entry points. | **In place:** `AGENTS.md` directs contributors to run touched-workspace typechecks and behavior tests while editing, then broad checks at milestones and final review. | Low; keeps final gates while narrowing iteration. |
| P0 | Test count alone is a poor simplification target, and semantic test value cannot be reliably inferred by a static checker. | **In place:** `AGENTS.md` defines behavior-first review; the PR template asks for observable behavior and the genuine gap behind a separate bug-fix test. Reviewers assess the diff; CI runs relevant checks. | Low; no brittle linter or extra test suite. |
| P1 | CI repeats broad workspace coverage on every PR, even when a change is isolated. | **Open:** Measure median/p90 CI time and reruns before piloting changed-workspace verification. Use the workspace dependency graph and fall back to full verification whenever change mapping is uncertain. Keep migrations, invariants, security, and affected role/policy tests as explicit gates. | Medium; incorrect change selection could skip needed checks. |
| P1 | The names `check:boundaries` and `test:boundaries` are easy to confuse. | **In place:** `AGENTS.md` distinguishes the static boundary scan from guard/tooling tests. Consider an alias only if contributors still confuse them. | Low; an alias adds little unless confusion persists. |
| P1 | The agent guide mixes hard rules with detailed command and architecture reference material. | **Open:** Move rare recipes only after verifying that canonical docs/runbooks cover them and removing duplicates will not hide safety or contract requirements. | Medium; careless shortening can hide necessary constraints. |
| P2 | Script counts include legitimate leaf commands, compatibility entry points, and repeated workspace lifecycle scripts. | **Guardrail:** Do not delete scripts by count. Check CI, docs, package consumers, and shell usage; consolidate only proven aliases or unclear naming. Preserve diagnostic and operational commands. | Low when usage is checked; high if operational or release commands disappear. |

## Keep these critical gates

- Fail-closed authorization and provider selection, with no provider call for a blocked request.
- Provider tool/output validation, bounded retry, cancellation, audit/provenance, and no-fallback behavior.
- PARE provenance and human approval, with no notification send before approval.
- Schema validation, migration checks, data invariants, and isolated database restore evidence when schema/runtime behavior changes.
- Privacy, sanitization, and role-boundary checks for affected routes.

These gates can run at the narrowest reliable scope during development, but
the relevant checks must remain in release verification.

## Suggested rollout

1. Record two weeks of CI median/p90 time, first useful feedback time, unrelated-workspace failures, and rerun rate. Use GitHub Actions history; do not infer speed from script count.
2. Add one documented `verify:changed` entry point that selects affected workspaces and their dependents. Keep direct workspace and leaf commands available.
3. Pilot selective checks on low-risk portal-only changes. Always run shared-type consumers when `@prism/types` changes, and run database gates for schema/query changes.
4. Compare timing and missed-check incidents against the baseline. Expand only if feedback gets faster without increasing escaped regressions or avoidable rework.
5. Move rare command recipes from `AGENTS.md` into existing runbooks as a separate measured cleanup. Keep hard constraints and test policy in the agent entrypoint.

## Success measures

- Lower median and p90 time to first actionable PR feedback.
- Fewer reruns caused by unrelated workspaces or selecting the wrong script.
- No increase in regressions escaping the relevant behavior and safety checks.
- A smaller, clearer set of common commands, while uncommon leaf tools remain discoverable when needed.

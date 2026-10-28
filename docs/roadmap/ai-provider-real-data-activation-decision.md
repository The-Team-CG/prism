---
type: "Activation Decision"
title: "Real-data AI activation: declined for the current plan"
description: "Record the decision to keep production AI synthetic-only until provider privacy and staging gates are satisfied."
tags: [ai, ai-governance, activation, privacy, zdr]
status: declined
updated: "2026-10-28"
authority: normative
audience: [engineers, reviewers, operators]
scope: "Production AI use of non-synthetic Prism event data"
last_verified: "2026-09-28; production AI_LIVE_USE_CASES remains empty in the reviewed plan and no OpenRouter profile is active"
sources:
  - id: completion-plan
    resource: "docs/roadmap/ai-provider-interchangeability-completion-plan.md"
    title: "AI provider interchangeability completion plan"
  - id: provider-routing
    resource: "docs/runbooks/ai-provider-routing.md"
    title: "Current provider routing rules and activation gates"
---
# Real-data AI activation decision

## At a glance

- **Decision:** Do not activate AI on real event data in the current plan.
  Keep production `AI_LIVE_USE_CASES` empty and mock as the default route.
- **Activation boundary:** Preserve synthetic-only use until the required
  privacy and staging evidence exists.
- **Scope:** This is a decision to defer real-data activation. It does not
  approve a provider, model, endpoint, data class, spend cap, or deployment.
- **Revisit:** Record a new decision after Tasks 4, 6, and 7 have the required
  provider, privacy, staging, and review evidence.

## Context

The planned OpenRouter route has not been qualified. The approved Space Bunny
key probe retrieved authenticated model metadata and stopped before inference:
the metadata omitted `pricing.request` and did not advertise required-tool
support. No model request was sent. The planned GLM route still lacks exact
endpoint, account privacy, processor-location, logging/cache, and conformance
evidence. The existing Anthropic test route is synthetic-only and has no
verified ZDR basis.

Task 6 also lacks an approved representative staging snapshot, a staging
deployment path, and the measured multi-route pilot. The available migration
rehearsal uses fabricated PGlite data and does not represent staging. The
production live-use-case allowlist remains empty.

## Decision

Decline real-data activation for the current plan. Continue using mock by
default, keep external AI limited to explicitly enabled synthetic test cases,
and do not add a production route or non-synthetic data class.

The recorded decision is final for this activation proposal.
That authority does not represent a review of staging results or approval of
any provider route; those evidence gates remain open.

## Consequences

- Task 8's decision branch is closed as declined for this plan. Real-data
  activation remains incomplete; reopening requires a new decision after
  Tasks 4, 6, and 7 provide the required evidence.
- Task 6 staging evaluation and Task 7 governance closeout remain open.
- Task 9 live provider interchangeability remains open because there is no
  approved first live route and no second provider qualified for the same
  data scope.
- Any future activation requires a new decision record for the exact reviewed
  provider, model, endpoint, use cases, data classes, deployment, and rollback.

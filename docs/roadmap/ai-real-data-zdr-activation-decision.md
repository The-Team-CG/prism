---
type: "Activation Decision"
title: "Real-data AI activation: approved for UAT, ZDR required for production"
description: "Record the decision to let PMCM inquiry triage and proposal drafting send minimized data to a provider, with test data allowed without ZDR until go-live."
tags: [ai, ai-governance, activation, privacy, zdr]
status: accepted
updated: "2026-11-06"
authority: normative
audience: [engineers, reviewers, operators]
scope: "Non-synthetic Prism inquiry and event data sent to an external AI provider"
last_verified: "2026-11-06; gateway gates reviewed in code and unit tests; no live provider call or staging evaluation has been recorded"
sources:
  - id: provider-routing
    resource: "docs/runbooks/ai-provider-routing.md"
    title: "Provider selection, the real-data gate, and use cases"
  - id: completion-plan
    resource: "docs/roadmap/ai-provider-interchangeability-completion-plan.md"
    title: "AI provider interchangeability completion plan"
---
# Real-data AI activation decision

## At a glance

- **Decision:** PMCM-only inquiry triage (FR-AI-01) and proposal drafting
  (FR-AI-03) may send minimized inquiry and event data to an external provider.
  While every record is UAT or test data, a non-ZDR route is accepted. Production
  requires a `provider-enforced` ZDR route.
- **Supersedes:** the 2026-10-28 decision that declined real-data activation.
- **Scope:** The two use cases above. PARE (FR-AI-04) also runs live on
  UAT/test data through the same routes, with supplier and client names masked and
  PMCM approval before any message; on the fixtures-only route it still accepts
  only synthetic fixtures. The conforme reminder stays on a generic fixture.
- **Not decided here:** a spend cap, a second provider, or any use case that
  shows AI output to a client.

## Decision

The maintainer accepted on 2026-11-06 that the system holds only UAT/test data,
so Anthropic direct may run without a ZDR agreement for now. The gateway has
three route bases:

- **`provider-enforced` (OpenRouter, or Anthropic with `AI_ZDR_CONFIRMED=true`):**
  OpenRouter requests ZDR on every call, denies data collection, disables
  provider fallback and fails closed when the pinned endpoint cannot honor that.
  For Anthropic, ZDR is an operator attestation the code cannot verify.
- **`test-data-only` (Anthropic without ZDR):** accepts inquiry and event data;
  audit rows record `test_data_approved`. Production refuses it unless
  `AI_ALLOW_TEST_DATA_IN_PRODUCTION=true` is set for a UAT deployment.
- **`none` (`AI_ROUTE_PROFILE=anthropic-synthetic`):** fixtures only, never
  selected automatically.

The mock provider is removed. With no provider configured, AI calls are blocked.

## Conditions that remain in force

- Output is advisory. Triage changes no inquiry status; a proposal draft only
  fills a form until PMCM issues it.
- Applicant identity (name, email, phone, company) and client identity never
  reach the provider. Free text is sent only for fields a use case declares, and
  is redacted for emails, phone numbers, identifiers and payment cards.
- A non-ZDR route cannot serve live use cases in production without the explicit
  UAT override.
- Every run writes an audit row with the route revision, data classes and token
  use, and each use case has a daily token budget.

## Open evidence

- The OpenRouter/Fireworks route has not been qualified with a live key.
- No staging evaluation of triage or drafting quality has been recorded.
- A data-subject access export does not yet include triage advice. Erasure and
  retention already delete it.
- **Go-live trigger:** before real client data is loaded, set ZDR (or use
  OpenRouter), remove `AI_ALLOW_TEST_DATA_IN_PRODUCTION`, and confirm the
  retention items above.
- Reopen this decision if a use case begins sending data classes beyond
  `internal` and `personal`, or showing AI output to a client.

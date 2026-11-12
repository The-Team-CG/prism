---
type: "Product Policy"
title: "AI data and activation policy"
description: "Approved data scope, privacy conditions, and evidence required for Prism AI routes."
tags: [ai, ai-governance, activation, privacy, zdr]
status: canonical
updated: "2026-11-12"
authority: normative
audience: [engineers, reviewers, operators]
scope: "Inquiry and event data sent to an external AI provider, with PMCM approval and production privacy gates"
last_verified: "2026-11-12; static review of gateway configuration, use-case registration and the existing activation records; deployment settings and provider agreements not independently verified"
sources:
  - id: gateway-config
    resource: "apps/api/src/modules/platform-ops/application/ai-governance/gateway/ai-gateway.config.ts"
    title: "Route selection, use-case allowlist and production startup gates"
  - id: use-cases
    resource: "apps/api/src/modules/platform-ops/application/ai-governance/gateway/ai-use-cases.ts"
    title: "Registered data contracts and execution budgets"
  - id: routing
    resource: "docs/runbooks/ai-provider-routing.md"
    title: "Provider configuration, PARE safeguards and qualification evidence"
---
# AI data and activation policy

## At a glance

- **Purpose:** Keep approved AI data use separate from technical availability and deployment evidence.
- **Authority:** Normative product policy. Provider configuration follows the [routing runbook](../runbooks/ai-provider-routing.md).
- **Scope:** External AI routes, inquiry and event data, PMCM review, and production privacy conditions.
- **Use when:** Enabling a use case or changing a provider, model, endpoint, or data class.
- **Change when:** The maintainer approves a different data scope or privacy requirement.
- **Verify with:** Gateway contracts and tests, the exact deployed route, provider agreement evidence, and recorded operational review.

## Approved scope

PMCM inquiry triage and proposal drafting may send minimized inquiry and event
data to an external provider. PARE may use masked event context on an eligible
route. AI output remains advisory: triage does not change inquiry status, a
proposal draft stays in the form until PMCM issues it, and messages require a
human action before delivery.

The maintainer accepted non-ZDR routing for UAT/test data on 2026-11-06 and
attested an Anthropic zero-data-retention agreement on 2026-11-09. Those records
supersede the earlier real-data no-go. The attestation is not independent proof
of the agreement, a running deployment, or a qualified second provider.

The [use-case inventory](../runbooks/ai-provider-routing.md#use-cases) describes
the current registered capabilities. Registration and an API key establish
technical availability; neither establishes product acceptance or live-provider
qualification. Broader data classes or client-facing AI output require a new
reviewed policy decision.

## Route conditions

| Route basis | Allowed data and activation condition |
| --- | --- |
| `provider-enforced` | Minimized data under the reviewed use-case contract. OpenRouter requests ZDR and disables provider fallback. Anthropic requires an operator attestation backed by the organization's agreement. |
| `test-data-only` | UAT/test inquiry and event data only. A production-mode UAT deployment needs the explicit `AI_ALLOW_TEST_DATA_IN_PRODUCTION=true` override. Remove that override before loading real client data. |
| `none` | Server-verified synthetic fixtures only. The `anthropic-synthetic` profile is an explicit lockdown and is never selected automatically. |

Without a configured provider, gateway calls are blocked. There is no mock AI
provider. PARE's deterministic rules engine is a separate offline path, described
in the routing runbook.

An empty `AI_LIVE_USE_CASES` value enables all registered use cases once a
provider is configured. Operators who need a smaller scope must set an explicit
allowlist; an empty value is not an off switch.

## Conditions that remain in force

- Use cases declare their data fields and budgets. Identity fields are omitted
  or masked; declared free text is redacted for recognized personal-data patterns.
  Pattern redaction is not a guarantee that arbitrary names in prose are removed.
- Every run records route, data-policy and token evidence. PMCM approval and
  authorization stay with the owning workflow.
- Changing a model or endpoint changes the route under review. Configuration-only
  selection does not qualify that route or permit automatic provider fallback.
- Triage advice is erased with the inquiry or its retention action, but it is
  not yet included in data-subject access exports. Complete that evidence before
  treating privacy acceptance as finished.

## Qualification and go-live

Before real client data is loaded, verify the provider agreement and exact route,
remove the UAT production override, review the enabled use cases, and confirm
retention, audit and PMCM approval behavior. Record actual deployment settings
and runtime results without storing prompts, provider keys, or private records
in the documentation.

OpenRouter endpoint qualification, measured staging evaluation, and a switch
between two independently qualified providers remain evidence tasks in the
[routing runbook](../runbooks/ai-provider-routing.md#qualification-evidence).
A configured adapter or successful unit test does not close those tasks.

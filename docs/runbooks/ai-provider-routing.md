---
type: "Playbook"
title: "Local AI provider and model routing"
description: "Configure local synthetic-only AI provider routes and understand the activation limits for Prism's AI gateway."
tags: [runbook, ai, providers, routing, privacy]
status: canonical
updated: "2026-10-28"
authority: operational
audience: [developers, reviewers, agents]
scope: "Local AI provider/model selection and the current staging/real-data activation boundary"
last_verified: "2026-09-28; local route defaults and synthetic-only limits recorded; external route qualification remains open"
sources:
  - id: ai-gateway
    resource: "apps/api/src/modules/platform-ops/application/ai-governance/gateway"
    title: "AI gateway route configuration and provider adapters"
  - id: ai-decision
    resource: "docs/roadmap/ai-provider-real-data-activation-decision.md"
    title: "Real-data activation decision"
---
# Local AI provider and model routing

## At a glance

- **Purpose:** Configure local synthetic-only provider routes and preserve the current activation gates.
- **Authority:** Operational guide; staging and production activation require separate approval.
- **Scope:** Local provider/model selection and current AI data-use limits.
- **Use when:** Changing local AI provider, model, or route profile.
- **Change when:** Provider support or activation policy changes.
- **Verify with:** Gateway route configuration and the currently approved activation decision.

This runbook describes local development behavior. It does not approve staging
or production AI use.

## Select a provider and model

The API currently has two external adapters:

- Anthropic direct, configured with ANTHROPIC_API_KEY. Its default model is
  claude-sonnet-4-6.
- OpenRouter, configured with OPENROUTER_API_KEY. Its default model is
  z-ai/glm-5.3-flash, pinned to the Fireworks endpoint.

With NODE_ENV=development, one configured provider key is enough to select that
provider while AI_ROUTE_PROFILE remains mock. If both keys are present, set
AI_PROVIDER explicitly to anthropic or openrouter. With no key and no provider
selection, the deterministic mock remains selected.

Set AI_MODEL to replace the selected provider's model for all routes. Set
AI_MODEL_FAST and AI_MODEL_STRONG to choose different models for those tiers;
a tier-specific value takes precedence over AI_MODEL. Leave these empty to use
the provider's current default. The model ID is passed through to the selected
adapter, and the route revision records the exact provider and model.

Example local settings:

    NODE_ENV=development
    AI_ROUTE_PROFILE=mock
    AI_PROVIDER=openrouter
    AI_MODEL=z-ai/glm-5.3-flash
    OPENROUTER_API_KEY=your-local-key

To switch providers, change AI_PROVIDER and provide that provider's key. To
switch models, change AI_MODEL or the tier-specific setting. Restart the API
after changing environment values. API startup does not send a provider request;
a request occurs only when an enabled use case is invoked.

Only the Anthropic and OpenRouter adapters are implemented. A model must be
available to the selected provider and support the gateway's tool and structured
output contract. OpenRouter remains pinned to Fireworks and continues to request
ZDR, deny data collection, require supported parameters, and disable provider
fallback. Selecting a model that is unavailable on the pinned endpoint or
cannot satisfy the request fails closed; the gateway does not try another
provider, endpoint, or mock.

## Local data and approval limits

Local provider selection enables only pare.budget, pare.risk,
pare.message-drafts, and comms.draft by default. An explicit AI_LIVE_USE_CASES
value replaces that list. External profiles accept synthetic data only.
Gateway fixture verification and the server-owned PARE provenance chain must
succeed before a provider call. Real event and inquiry data is blocked. PARE
output remains a recommendation, and PMCM approval is required before any
notification can enter the outbox. The conforme draft provider input remains
generic and server-owned.

The Fireworks endpoint's forced-tool and ZDR eligibility, account privacy
settings, and processor/logging details have not been qualified. Request
controls fail closed if the selected endpoint cannot meet them. Do not treat
local provider/model switching as approval for real data or staging.

Staging does not infer activation from a key. Production keeps its live-use-case
allowlist empty under the current no-go decision and refuses synthetic-only
external profiles. A staged or real-data route requires its separate deployment,
privacy, review, and approval gates.

Keep credentials in the ignored local .env; never commit them. Remove the keys
and provider/model overrides, then restart the API to return to mock behavior.

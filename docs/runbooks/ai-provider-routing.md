---
type: "Playbook"
title: "AI provider and model routing"
description: "Configure Prism's live AI provider, understand which data may reach it, and switch providers or models."
tags: [runbook, ai, providers, routing, privacy]
status: canonical
updated: "2026-11-12"
authority: operational
audience: [developers, reviewers, agents]
scope: "Live AI provider/model selection, the real-data gate, and the AI use cases that depend on it"
last_verified: "2026-11-12; static review of route configuration and existing gateway tests; live-provider qualification and deployment state not verified"
sources:
  - id: ai-gateway
    resource: "apps/api/src/modules/platform-ops/application/ai-governance/gateway"
    title: "AI gateway route configuration, use-case registry, and enforcement"
  - id: ai-decision
    resource: "docs/product/ai-data-policy.md"
    title: "Current AI data and activation policy"
  - id: conforme-drafts
    resource: "apps/api/src/modules/platform-ops/application/ai-governance/conforme-comms-draft.service.ts"
    title: "Conforme draft approval, cancellation and reminder-window checks"
---
# AI provider and model routing

## At a glance

- **Purpose:** Configure the live AI provider and keep non-ZDR routes out of production.
- **Authority:** Operational guide; the [AI data policy](../product/ai-data-policy.md) owns activation conditions.
- **Scope:** Provider and model selection, the real-data gate, and the use cases that use it.
- **Use when:** Turning AI on, switching provider or model, or debugging a blocked AI call.
- **Change when:** A provider, route profile, or use case is added or its data policy changes.
- **Verify with:** `GET /health` (`aiGateway.profile`, `providerCallsEnabled`) and the gateway tests.

There is no mock provider. With no provider configured, every AI call is blocked
with `use_case_disabled`, no provider is contacted, and the health check reports
the `unconfigured` profile. Portals show the draft actions as unavailable.

## Configure a provider

Set one provider key. The gateway selects that provider; if both keys exist, set
`AI_PROVIDER` to `anthropic` or `openrouter`.

| Provider | Key | Default model | Real data |
| --- | --- | --- | --- |
| Anthropic direct | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` | Test data without ZDR; ZDR when `AI_ZDR_CONFIRMED=true` |
| OpenRouter | `OPENROUTER_API_KEY` | `z-ai/glm-5.3-flash`, pinned to Fireworks | Yes: ZDR is requested on every call |

Anthropic direct has no zero-data-retention guarantee unless your organization
has a ZDR agreement. Without `AI_ZDR_CONFIRMED=true` it runs as the
`anthropic-test-data` route: inquiry and event data reach the provider, minimized
as described below, and every audit row records `test_data_approved`. That is
acceptable for UAT or test data only. `AI_ZDR_CONFIRMED=true` is an operator
attestation the code cannot verify; set it only when the agreement exists.
OpenRouter requests ZDR, denies data collection, requires supported parameters,
and disables provider fallback; a call fails closed if the endpoint cannot honor
that.

`NODE_ENV=production` refuses any non-ZDR route at startup, so going live without
ZDR cannot happen by accident. A UAT deployment that runs in production mode and
holds only test data sets `AI_ALLOW_TEST_DATA_IN_PRODUCTION=true`. Remove it and
set ZDR (or use OpenRouter) before real client data is loaded.

For a fixtures-only lockdown, set `AI_ROUTE_PROFILE=anthropic-synthetic`. It is
never selected automatically and refuses real data.

The maintainer's recorded Anthropic ZDR attestation supports the `anthropic-zdr`
configuration. It does not establish which settings are currently deployed.
For an approved production route, set `AI_PROVIDER=anthropic`,
`AI_ZDR_CONFIRMED=true` and `ANTHROPIC_API_KEY` in the deployment secret store,
and leave `AI_ALLOW_TEST_DATA_IN_PRODUCTION` unset. Verify the deployed health
response and runtime evidence separately. Local and UAT checkouts keep their own
settings.

Example (Anthropic with a ZDR agreement):

    AI_PROVIDER=anthropic
    AI_ZDR_CONFIRMED=true
    ANTHROPIC_API_KEY=your-key

After qualifying the OpenRouter route below, set `AI_PROVIDER=openrouter` and
`OPENROUTER_API_KEY`, remove `AI_ZDR_CONFIRMED`, and restart. Recheck any explicit
`AI_ROUTE_PROFILE` and model overrides: an incompatible profile fails startup,
and changing a model does not qualify its pinned endpoint.

`AI_MODEL` replaces the model for all routes of the selected provider;
`AI_MODEL_FAST` and `AI_MODEL_STRONG` override one tier and take precedence. The
route revision in each audit row records the exact provider and model. API
startup sends no provider request; a request occurs only when a use case runs.
Keep keys in the ignored local `.env` or the deployment secret store.

`AI_LIVE_USE_CASES` is an optional allowlist. Empty means every registered use
case is live once a provider is configured; it does not disable calls. Remove
provider configuration to block gateway calls, or use an explicit allowlist to
narrow enabled use cases. Product approval and qualification remain separate
from this technical selection.

## Use cases

| Use case | Ledger | What it does | Data it sends |
| --- | --- | --- | --- |
| `inquiry.triage` | FR-AI-01 | Advises PMCM on fit, risks and questions for an inquiry. Stored as an advisory record. | Inquiry shape and wording. No name, email, phone or company. |
| `proposal.draft` | FR-AI-03 | Drafts the five catalog sections (Executive Summary, Event Concept, Service Package Summary, Investment Summary, Payment Schedule) plus title and highlights from the estimate being built. Payment amounts are computed on the server. Returned to the form, stored nowhere. | Event, budget, estimate lines and payment milestones. No client identity. |
| `comms.draft` | FR-AI-09 | Drafts a conforme reminder. | A generic fixture only. |
| `client-message.draft` | FR-AI-09 | Drafts a follow-up when a proposal waits 3 days, a balance is due within 48 hours, or an official floor plan waits 2 days for approval. PMCM edits and sends it; send re-checks that the trigger still applies. | Trigger facts only (event type, days, milestone label and amount). No client identity. |
| `compliance.advisory` | FR-10+ | Explains the open items of the latest compliance run in plain language and orders the actions. Advice only; the rule results stay the record. | Event type, phase, days to the event, and each open check's title, severity, evidence and remediation. |
| `theme.suggestions` | FR-11 | Two or three theme concepts (name, palette, moodboard description, search terms) from the briefing. Words and colors, never images. | Event type, guest count, venue type, mood text, budget range and styling budget. No client identity; the mood text is redacted for personal details. |
| `event.intelligence` | FR-AI-08 | The post-event report: what worked, what failed and why, recommended actions. Built from the insights card; returned to PMCM, stored nowhere. | Event type, guest and check-in counts, insight dimensions, risks, supplier ratings, billed and outstanding totals, client rating. No names or notes. |
| `pare.budget`, `pare.risk`, `pare.message-drafts` | FR-AI-04 | PARE supplier-replacement stages. PMCM approves before anything is sent. | Event, budget, ranked candidates and client preferences with names and ids masked (see PARE below). |

Every use case is PMCM-only and advisory. AI output is never sent, applied or
approved automatically: triage changes no inquiry status, a proposal draft only
fills the form until PMCM issues it, a conforme reminder needs PMCM approval
before it enters the notification outbox, and a client follow-up is sent only
when PMCM presses send. Approving a PARE recommendation sends the replacement
supplier a normal quote request and PARE's supplier notice, with name
placeholders filled (the supplier's own name; the client stays "our client").

## What the gateway enforces

- Free-text fields are replaced before a provider call unless the use case
  declares them in `freeTextKeys`. Declared fields still have emails, phone
  numbers, identifiers and payment-card patterns redacted. A payload that still
  matches a personal-data pattern is blocked.
- Input over 32 KB, output that is not valid JSON for the registered schema,
  or output containing a personal-data pattern is rejected.
- Each use case has a step limit, an output-token limit, a timeout and a daily
  token budget. Every run, including blocked ones, writes an audit row.
- A route whose ZDR basis is `none` (the fixtures-only lockdown) accepts only verified synthetic data.

Applicant free text (an inquiry message) is untrusted input. The triage prompt
tells the model to treat it as data, and the result is advisory with a fixed
schema, so a hostile message can at worst skew advice a person then reads.

## Conforme draft lifecycle

The draft stream sends metadata while generating and reveals content after
gateway validation. It is buffered generation, not token-by-token delivery.
PMCM can edit a pending draft before approval, or write manually before a draft
exists. Cancelling a saved draft records a rejection for that reminder window;
it does not reopen generation for the same window. Failed or aborted generation
that saved no draft can be retried. Approval rechecks eligibility and the current
reminder window before writing to the notification outbox.

## PARE

PARE recommends a replacement supplier when one withdraws. It has two modes.
The persisted mode value stays `mock` or `live` so stored records keep working.

- **`mock` (rules engine):** a deterministic engine that ranks candidates and
  writes the messages from fixed rules, without calling any model. It is the
  offline fallback when no provider is configured.
- **`live`:** the three stages (budget, risk, message drafts) run through the
  gateway. `PARE_MODE=live|mock` forces a mode. With `PARE_MODE` unset, PARE is live
  when a provider is configured and all three PARE use cases are live
  (`AI_LIVE_USE_CASES` unset or listing them), and the rules engine otherwise.
  `PARE_MODE=live` with no provider, or with a PARE use case disabled, stops the
  API at startup.

What live PARE sends depends on the route of its three use cases:

- **ZDR or test-data-only routes:** real event context goes through the gateway
  like any other use case. The model sees ranked suppliers as "Candidate 1",
  "Candidate 2" and so on (the order of the PARE candidate list), with the client,
  event and withdrawn supplier names replaced by placeholders. The read-only tools
  return the same masked view. Message drafts use `[Client name]` and
  `[Supplier name]` placeholders for PMCM to fill in. Audit rows say
  `zdr_approved` or `test_data_approved`, and the review record counts as ZDR
  confirmed only when every stage was `zdr_approved`. Production refuses the
  test-data route unless `AI_ALLOW_TEST_DATA_IN_PRODUCTION=true`; PARE adds no
  separate production gate.
- **Fixtures-only route (`anthropic-synthetic`):** PARE accepts only registered
  synthetic fixtures and keeps its server-owned provenance chain.

PMCM must approve every PARE result before any message enters the notification
outbox. At approval PARE re-checks the run. For a real-data run it requires, for
each stage in order, a completed gateway audit row for that stage and request,
on a ZDR or test-data route, whose recorded output digest equals the digest of
the output saved for review. A changed output, a missing or incomplete stage
audit or a stage from another request blocks approval.

## Limits to know

- Live PARE sends the briefing's client preferences as free text. Emails and phone
  numbers in them are redacted, but a name typed into a preference is not. PARE
  does not yet read the event's real budget: its context carries placeholder budget
  totals, so live budget feasibility rests on the quote amounts.
- Triage advice is stored in `platform_ops.ai_approval_records`. When an inquiry is
  erased by a privacy request or reaches retention, its triage advice is deleted
  and the gateway audit row keeps only its route evidence, because the audit
  row's stored input holds the applicant's free-text message. A data-subject
  access export does not yet list triage advice.
- OpenRouter's Fireworks endpoint has not been qualified against the gateway's
  forced-tool and ZDR conformance checks with a live key.
- The only provider adapters are Anthropic and OpenRouter.

## Qualification evidence

Keep these outcomes separate. An implemented adapter or passing unit test does
not prove a live route, acceptable advice, or provider interchangeability.

| Outcome | Remaining evidence |
| --- | --- |
| Exact provider route | Provider, model, pinned endpoint, account privacy controls, processor locations, tool support, schema conformance, audit, timeout and abort behavior. Qualify OpenRouter/Fireworks with a live key before claiming its route is ready. |
| Staging acceptance | Restore an approved database snapshot into an isolated rehearsal target, verify the AI audit and review/provenance schema changes, and record schema/invariant results, backup and rollback steps. Deploy the reviewed staging build with real client-data AI disabled and server-owned synthetic events only. Use the same fixed inputs per route and use case, full PARE orchestration, PMCM review, recorded failures, usage and measured latency. |
| Production activation | Exact environment, data classes and use cases, provider privacy evidence, a reviewed spend cap, PMCM approval behavior, retention/access-export evidence, and an observed rollback. |
| Provider interchangeability | Two independent providers qualified for the same data class and use case. Demonstrate a reviewed configuration-only switch, no provider fallback, complete audit evidence, and rollback without a feature or prompt change. |

The retained pilot criteria are at least 20 measured calls per route and use
case, including failed and blocked calls. All schema, provenance, privacy,
role-denial, audit, abort and approval checks must pass. Reviewed drafts must
contain no invented client/event facts, and at least 18 of 20 must be usable
with no more than minor PMCM edits. The p95 latency must stay within the use
case's timeout, and no call may exceed its output-token or daily budget. Record
mean cost and a reviewed spend cap. Agree the fixed inputs and edit rubric with
PMCM and the technical reviewer before measurement; these are acceptance
criteria, not results.

PMCM reviews every PARE recommendation and at least 20 communication drafts per
route. Record schema/tool outcomes, failures, p50/p95 latency, tokens, cost and
the exact endpoint/model. Retain technical, operational and UX acceptance
without storing raw prompts or private client data in the report.

The database rehearsal must cover both AI audit and review/provenance changes
from the selected release. Use the current owner baselines and follow-on
migrations; do not replay a retired migration ledger. Reconcile detected
constraint, index or default drift before the pilot. Follow the
[migration procedure](database-migrations.md) and verify the staging deployment
hook or equivalent release trigger from [deployment secrets](deployment-secrets.md).
Synthetic rehearsal, a restored staging database, and an observed deployment
remain separate evidence.

Keep a failed route disabled. Preserve `PARE_MODE` until a separate reviewed
change makes route profiles and the use-case allowlist the sole controls.
Changing this runbook does not retire runtime controls or activate a provider.

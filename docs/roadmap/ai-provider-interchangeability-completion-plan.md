---
type: "Execution Plan"
title: "AI provider interchangeability completion"
description: "Complete the governed AI gateway and make provider/model switching configuration-only across supported adapters, while separately qualifying staging and real-data routes."
tags: [ai, ai-governance, pare, platform-ops, provider-routing, zdr]
status: active
updated: "2026-09-28"
authority: informative
owner: "D (Anthony)"
audience: [engineers, agents, reviewers]
scope: "Completion work after the AI gateway PR 0-7 stack: provider-neutral PARE, route configuration, synthetic and live provider interchangeability, staging evidence, governance closeout, and separately approved real-data activation"
last_verified: "2026-09-28; local Task 3 migration rehearsal and Task 5 PMCM walkthrough recorded; provider/model environment selection implemented but untested; staging and live-provider gates remain open"
sources:
  - id: gateway-plan
    resource: "docs/roadmap/ai-provider-gateway-plan.md"
    title: "Approved gateway phase plan and PR 0-7 exit gates"
  - id: governance
    resource: "docs/product/evolution-governance.md"
    title: "Owner goals and AI feature review gates"
  - id: architecture
    resource: "docs/architecture/context-contracts.md"
    title: "Platform-ops and event-lifecycle ownership seams"
  - id: migrations
    resource: "docs/runbooks/database-migrations.md"
    title: "Migration verification and deployment procedure"
  - id: deploy-secrets
    resource: "docs/runbooks/deployment-secrets.md"
    title: "Staging deployment secret requirements"
---
# AI Provider Interchangeability Completion Implementation Plan

## At a glance

- **Purpose:** Complete the approved AI gateway work and prove that the same
  use case can move between qualified external providers by selecting a
  reviewed route profile, with no feature-code or prompt change.
- **Authority:** Informative execution plan. The product ledger, readiness
  foundation, architecture decisions, and provider approval record govern
  actual behavior and activation. This plan does not authorize real-data AI.
- **Owner:** D (Anthony) owns routing, provider evidence, privacy, and the live
  gate. B (Francis) owns PARE and communication rules. A (Maxine) owns PMCM
  draft usability and review evidence.
- **Scope:** Repair the current PR 0-7 stack, add one second external provider
  route after qualification, prove synthetic switching and full PARE execution,
  finish staged evaluation and governance, then qualify and separately approve
  two real-data routes for a live configuration switch.
- **Use/change:** Revisit when a provider, model, endpoint, data class, route
  policy, or acceptance threshold changes. Do not treat a passing test or this
  plan's approval as permission to enable real-data AI.
- **Verify with:** The per-task checks below, a restored database and staging
  deployment for runtime gates, route conformance on fixed synthetic fixtures,
  PMCM review, and an explicit Owner D activation record.

## Goal and completion boundary

This plan has four independently reportable outcomes:

1. **Gateway foundation complete:** the existing PR 0-7 stack is merged in
   order; mock remains default; Anthropic remains synthetic-only; the full
   PARE and draft paths pass their stated static and runtime gates. The
   original phase plan can close at this point even if a second provider is
   unavailable. Call this a foundation, not completed interchangeability.
2. **Synthetic interchangeability complete:** two external provider routes
   pass the same use-case conformance suite on synthetic inputs. A deployment
   can switch the selected route profile between them without changing PARE,
   communication-draft, or other feature code. Both routes still pass common
   sanitizer, provenance, budget, audit, abort, and approval checks. If the
   second provider cannot be qualified, this outcome remains open.
3. **First real-data activation complete:** an exact provider/model/endpoint and
   data-class allowlist are approved by D after privacy and staged evidence;
   a separate activation PR enables only those use cases. This outcome is
   distinct from approval of the implementation plan and from synthetic
   provider interchangeability. It proves one approved route can run; it does
   not establish live provider choice.
4. **Live provider interchangeability complete:** a second independent
   external provider is also qualified and approved for the same real-data
   classes and use case. A reviewed profile switch between both routes passes
   the same privacy, conformance, budget, audit, and PMCM approval gates in a
   limited live rollout, with no feature-code or prompt change. If only one
   provider can meet the data policy, this outcome remains open.

OpenRouter is registered as a local synthetic-only candidate using GLM 5.3 Flash
pinned to Fireworks. Registration and configurable model selection do not qualify
the route. Endpoint-level ZDR/tool behavior, account privacy and processor
evidence, and provider conformance remain open. Keep it synthetic-only and
fail-closed until those gates pass; do not configure an unverified fallback or
call the goal complete.
## Approved decisions and invariants

| Decision | Execution rule |
| --- | --- |
| Configuration | Environment may select one registered adapter (anthropic or openrouter) and a model ID for that provider. Unknown adapters fail startup. The endpoint, privacy controls, data class, and no-fallback behavior remain route-policy decisions; staging and real-data eligibility still require their qualification gates. |
| Granularity | AI_MODEL applies to all routes; AI_MODEL_FAST and AI_MODEL_STRONG override the matching tier. Use-case routes inherit the model for their registered tier unless a route profile defines a separate use-case route. |
| Model changes | Runtime model selection changes the exact route and its digest. It does not qualify a model: the provider and pinned endpoint must support the gateway contract and route privacy policy before staging or real-data use. OpenRouter remains pinned to the reviewed endpoint with no fallback. |
| Invalid configuration | An explicitly supplied unknown profile, route, or use-case ID fails startup, even when the live allowlist is empty. An omitted profile defaults to mock. A selected live profile with no enabled use cases starts but calls remain blocked. |
| Safety | Mock is the default. Non-ZDR routes accept only server-verified synthetic data and never run in production. No cross-provider automatic failover or live-to-mock substitution occurs. |
| PARE | PARE checks use-case identity, correlation, completed outcome, durable audit match, and approved data-policy evidence. Provider name, model, profile ID, key, and route choice remain in gateway policy or infrastructure. |
| Streaming | The current POST/SSE path emits metadata immediately and validated, buffered content only after the provider response and audit pass. Label it as validated generation, not token-by-token streaming. Progressive text is a separate reviewed product/security change. |
| Draft cancellation | Cancelling a saved draft is a terminal rejection for that reminder window. PMCM can edit a pending draft, write manually before a saved draft exists, and retry an aborted or failed generation. The UI states the terminal effect before rejection. |
| Real-data draft input | Keep the first communication draft generic: no client name, event facts, recipient, or deadline reaches the provider. Personalization requires a separate data-contract and privacy review. |
| Human action | Gateway outputs remain recommendations or drafts. PMCM approval is required before a notification enters the outbox; no route sends or assigns autonomously. |

## Current execution status (2026-09-28)

| Task | Done | Still required or blocked |
| --- | --- | --- |
| 2 — provider-neutral gateway | Provider-neutral route selection and audit evidence are implemented. Environment configuration now selects Anthropic or OpenRouter and a model globally or by fast/strong tier. | The environment selector was not tested in this continuation, per user direction. The route switch and full PARE chain still need their acceptance verification. |
| 3 — PARE provenance | The fail-closed budget/risk/draft DAG, durable provenance checks, approval rechecks, migration checks, and synthetic PGlite restore rehearsal are recorded. | Full-chain execution on a qualified external synthetic route and staging measurement remain open. Do not claim a runtime speedup before staging measurement. |
| 4 — second synthetic provider | The OpenRouter adapter and composition wiring are implemented. GLM 5.3 Flash is the default OpenRouter model, pinned to Fireworks with ZDR and data-collection denial. Anthropic and OpenRouter can be selected by configuration; mock remains the default without local provider configuration. | Endpoint-level ZDR eligibility, account privacy/processor evidence, provider conformance, and same-fixture route-switch evidence remain open. No provider inference was run for the environment-selector change. |
| 5 — PMCM draft semantics | The local PMCM walkthrough passed with the mock gateway; the draft remained pending and the outbox stayed empty. | Representative staging review is tracked under Task 6. |
| 6 — staging pilot | The synthetic migration rehearsal, frozen thresholds, and fixed fixtures are recorded. | Staging restore/evaluation, quote foreign-key/index/default drift reconciliation, deployment hook, 20 calls per route/use case, PMCM and D/B/A reviews, and sign-off remain open. |
| 7 — governance closeout | Deferred pending staging and review evidence. | Route/privacy records and governance promotion remain open; PARE_MODE has not been retired. |
| 8 — real-data decision | Owner D recorded a no-go for real-data activation in this plan; production AI_LIVE_USE_CASES stays empty. | Real-data use remains unapproved. Reopen only through a separate decision after the required provider, privacy, staging, and review evidence. |
| 9 — live provider choice | No second live-eligible provider is qualified. | Requires a separate real-data approval and a second independent live-eligible provider. |

The plan remains active. Code availability and previously recorded local
evidence do not satisfy the outstanding staging, privacy, review, or live-route
gates. Per the user's direction, no tests or provider calls were run for the
provider/model environment-selector change.

## Work sequence and ownership

| Sequence | Reviewable deliverable | Owner | Dependency |
| --- | --- | --- | --- |
| 1 | Current stack corrections and truthful PR 6 status | D, B, A | Exact heads of PR 0-7 |
| 2 | Provider-neutral route/evidence contract and configuration | D | Shared contracts from PR 1 |
| 3 | Full PARE synthetic provenance and approval proof | D, B | 2 |
| 4 | Second provider qualification and adapter | D, B | 2-3, authenticated route evidence |
| 5 | PMCM draft semantics and data policy | B, A, D | Current PR 5 |
| 6 | Staging database, deployment, and measured pilot | D, B, A | 1-5 merged and reviewed |
| 7 | Durable governance and `PARE_MODE` cutover | D, B, A | 6 |
| 8 | Separate real-data activation decision and PR | D | 4, 6-7, privacy approval |
| 9 | Second live-eligible provider and live switch proof | D, B, A | 8, independent provider qualification |

Tasks 2-5 may be developed in isolated branches after the shared contract is
reviewed. Merge serially against the actual dependency heads and rerun the
whole API and boundary suite after each rebase. Use conventional commits and
PRs; do not push or force-push `main`, and do not amend published commits.

## Priority and risk matrix

| Priority | Risk | Work | Failure prevented | Release gate |
| --- | --- | --- | --- | --- |
| P0 | Critical | Correct PR 6's completion claim and reconcile PR 0-7 evidence | Merging a draft with unrun staging and PMCM gates | No PR is marked ready without its own exit evidence |
| P0 | Critical | Remove provider-specific PARE checks and prove server-owned provenance | Unverified or provider-coupled emergency recommendations | Full PARE path and tamper cases pass before an external route is enabled |
| P0 | Critical | Fail closed on invalid profiles and unapproved data routes | Silent mock selection or real data sent to a non-ZDR endpoint | Startup and no-provider-call negative tests pass |
| P0 | High | Rehearse migrations and run the synthetic staging pilot | Correct code failing against deployed schema or runtime | Restored-database and deployed-route evidence is recorded |
| P1 | High | Qualify a second provider on the same use cases | Claiming interchangeability from one external adapter and mocks | Two-route conformance and configuration-only switch pass |
| P1 | High | Resolve PMCM draft cancellation and buffered delivery wording | Users believing cancelled reminders can be retried or content is live tokens | Role-path review and workflow tests pass |
| P1 | High | Publish route/privacy records and remove `PARE_MODE` | Conflicting activation controls or stale provider assumptions | ADR, ledger, env, and runbook agree |
| P2 | Critical on activation | Authorize and monitor real-data use separately | Synthetic test approval being treated as privacy approval | D approves exact route and data scope in a separate PR |
| P2 | High | Qualify a second live-eligible provider and switch the limited rollout | Calling the system live-interchangeable with only one data-approved provider | Two independent approved live routes pass the same scope and rollback test |

Priority orders the work; risk describes the consequence if the gate is
missed. A P2 activation task cannot be pulled forward to bypass its P0/P1
dependencies.

## Task 1: Reconcile the current PR stack

**Files:** `docs/roadmap/ai-provider-gateway-plan.md`, PR descriptions, and
the tests or files changed by Tasks 2-5 in the existing stack.

- [x] Refresh the current stack. GitHub PR #65 is phase PR 0; #66 through #71
  are phase PRs 1 through 6. Record each current base/head SHA and review each
  diff against its immediate base. Record phase PR 7 as not opened until it
  exists; refresh this snapshot after any head or base change. Preserve
  unrelated work.
- [x] Update PR 6's exit record to say **local synthetic smoke passed; staging
  pilot pending**. Its own pending-gate section and exit sentence must agree.
- [x] Keep PR 0-7 in dependency order. Do not mark a draft ready merely
  because CI, Gitleaks, and CodeQL are green; require each PR's exit evidence.
- [x] Re-run the affected workspace typechecks and tests, API build, boundary
  checks, Prisma validation, offline migration checks, and `git diff --check`.
  Run `npm run check:migrations` and `npm run check:invariants` for schema work.
- [x] Record the full event-portal suite result separately from targeted view
  tests. The isolated full suite passed; no locale-sensitive formatter failure
  reproduced.

**Exit:** A reviewer can see exactly which PR introduced each change, which
tests ran on its current head, and which runtime gates remain open.

**Completed (2026-09-26):** Current phase PR 0-6 heads, immediate bases, and
green CI are recorded in `ai-provider-gateway-plan.md`; phase PR 7 is not
opened. PR #71 remains a draft because full PARE provenance, staging, the
20-run pilot, and PMCM sign-off remain pending. The updated PR 6 exit record
and verification results are committed locally on
`codex/ai-gateway-task1-evidence`; no PR was marked ready or merged.

## Task 2: Make route selection and evidence provider-neutral

**Files:** `packages/types/src/schemas/ai-governance.ts` and its tests;
`apps/api/src/modules/platform-ops/contracts/ai-governance/ai-gateway.port.ts`;
`apps/api/src/modules/platform-ops/application/ai-governance/gateway/ai-gateway.config.ts`,
`ai-gateway.service.ts`, and their tests;
`apps/api/src/modules/platform-ops/application/ai-governance/pare/pare-ai-gateway.ts`,
`pare.service.ts`, and `pare-safety.test.ts`.

**Contract:** Route resolution is
`profile.routesByUseCase?.[useCaseId] ?? profile.routesByTier[definition.modelTier]`.
The gateway records an exact reviewed route revision with the audit result.
PARE receives a route-policy outcome such as `synthetic_verified` or
`zdr_approved`, never a provider-specific approval predicate.

- [ ] Add failing contract/config tests: use-case override wins over tier;
  tier remains the fallback; unknown explicit profile or use-case fails
  startup; omitted profile resolves mock; production rejects synthetic-only
  routes; a model/endpoint change changes the reviewed route revision.
- [ ] Extend the shared Zod profile and evidence schemas, rebuild
  `@prism/types`, then implement resolution and startup validation. Keep keys
  exclusively in provider factories. Do not add app-local DTO copies.
- [ ] Replace PARE checks for `test-anthropic`, `anthropic`, and `zdrBasis:
  none` with gateway-owned route eligibility. PARE must still reject missing,
  mismatched, incomplete, blocked, or unaudited runs.
- [ ] Add a fake second adapter in tests. Switch profiles for the same PARE
  use case without modifying its agent or service and assert identical
  policy, audit, approval, failure, and no-autonomous-send behavior.
- [ ] Run `npm --workspace @prism/types run build`, its typecheck/tests,
  `npm --workspace prism-api run typecheck`, focused gateway/PARE tests,
  `npm run check:boundaries`, and `npm run test:boundaries`.

**Exit:** Feature code contains no provider/model/profile acceptance branch;
an invalid explicit route fails before a provider call; a fake provider swap
requires configuration only.

- [x] Add route-resolution, startup-validation, route-revision, and policy
  outcome coverage. Use-case overrides take precedence over tier defaults;
  invalid configured IDs fail closed; an omitted profile remains mock.
- [x] Extend the shared Zod profile and evidence schemas and keep API keys in
  provider factories. No app-local duplicate contracts were added.
- [x] Move PARE route eligibility to gateway-owned policy outcomes while
  preserving provenance, audit, correlation, failure, and PMCM approval checks.
- [x] Exercise the same PARE use case with a fake second adapter after a
  configuration-only route switch.
- [x] Previously recorded verification passed: shared types build/typecheck and
  51 tests; focused API tests (67 passed, 2 skipped); API typecheck; boundaries
  (1,195 files); and boundary tests (52 passed).

**Completed (2026-09-28):** Shared contracts carry provider-neutral route
metadata and policy outcomes; use-case route selection falls back to the model
tier; exact route revisions are included in audit evidence. The fake-adapter
switch exercises the same PARE path without feature-code or prompt changes.
The provider/model environment selector was added after that verification and
was not tested in this continuation, per user direction.

## Task 3: Prove a server-owned PARE provenance chain

**Files:** apps/api/src/modules/platform-ops/application/ai-governance/gateway/synthetic-fixture-registry.ts
and tests; PARE context assembler, gateway and safety tests; apps/api/prisma/schema.prisma
and the trust_ops migration for the separate PMCM review payload.
**Contract:** A synthetic PARE run starts at one registered root fixture.
Before each later stage, the server assembles context from the root and
validated earlier gateway outputs. The verifier checks root identity,
correlation ID, stage order, prior completed audit IDs, and a canonical digest
of each prior output. A browser-supplied flag or copied fixture-shaped JSON
is not provenance.

- [x] Add a full-orchestration test for one synthetic emergency trigger through
  budget, risk, and message stages, including tool loops and PMCM review without
  sending.
- [x] Add negative cases for changed stage output, correlation, tool result, and
  audit outcome; each blocks the next provider call.
- [x] Persist minimized inputs and digest/route evidence in AI audit, and keep
  generated review text separate from sanitized audit JSON.
- [x] Preserve abort, lease retry, duplicate dispatch, PMCM approval rechecks,
  and legacy pending approvals. Previously recorded focused safety/provenance,
  migration, invariant, typecheck, and build checks passed.
- [x] Rehearse the migration on an isolated synthetic PGlite snapshot/restore;
  apply the pending AI migrations and confirm schema, migration state, and
  invariants. This is synthetic rehearsal evidence, not a staging restore.
**Exit:** Full synthetic PARE orchestration, not only independent stage
smokes, passes on mock and the approved synthetic external route. Mutated or
unregistered chains fail before another provider request.

## Task 4: Qualify and implement a second external route

**Files:** A focused adapter and tests under
`apps/api/src/modules/platform-ops/infrastructure/ai-governance/`;
`apps/api/src/modules/platform-ops/platform-ops.module.ts` and tests;
route profile/schema, `.env.example`, conformance fixtures, and the provider
evidence record promoted under `docs/architecture/decisions/` at closeout.

- [ ] Obtain authenticated model access and review account privacy controls,
  exact endpoint ZDR/tool support, processor locations, and logging behavior.
- [x] Implement the OpenRouter adapter and conditional composition wiring.
  The GLM 5.3 Flash candidate is pinned to Fireworks, synthetic-only, and
  configured to request ZDR, deny data collection, and disable fallback.
- [x] Add configuration-only selection for Anthropic/OpenRouter and global or
  fast/strong model IDs. The selector change remains untested per user direction.
- [ ] Complete endpoint/provider conformance and same-fixture real-adapter
  switching. No live provider call was run for this continuation.
- [ ] Run the planned API/provider verification and record cost/latency only
  after route settings are stable and the user authorizes that verification.
**Exit:** Two external providers serve the same registered use case using
only a reviewed configuration selection, with the same safety and approval
checks. This is the synthetic interchangeability proof; it is not real-data
approval or a claim that both are live-eligible.

## Task 5: Close the PMCM draft product decisions

**Files:** `apps/event/src/features/inquiries/conforme-drafts/` view, view
model, and tests; `apps/api/src/modules/platform-ops/application/ai-governance/conforme-comms-draft.service.ts`
and tests; shared contracts only if wording requires a new status.

- [ ] Keep the validated buffered SSE protocol. Show a generating/cancel
  state from metadata, then reveal content after validation; remove any copy
  that implies token-by-token delivery before that point.
- [ ] State before saved-draft cancellation that rejection is final for this
  reminder window. Keep editing of a pending AI draft and manual writing
  before a saved draft exists. Retry remains available after an unavailable
  or aborted generation that saved no draft.
- [ ] Test role denial, accepted/unsigned/five-day eligibility, stale-state
  rejection, the shared atomic reminder claim, repeated approval,
  cancellation, and no outbox write before approval. Manually walk the PMCM
  path in `apps/event` against the running API.
- [ ] Keep the initial provider input generic. If later personalization is
  requested, require a new shared input schema, field allowlist, privacy
  review, and route requalification before sending inquiry details.

**Exit:** PMCM can understand when a draft is pending, unavailable, approved,
or terminally cancelled; its recipient and outbox action remain server-owned.

## Task 6: Set acceptance thresholds and run the staging pilot

**Files:** Fixed conformance/evaluation fixtures and tests; staged deployment
configuration; `docs/roadmap/ai-provider-gateway-plan.md` results table;
database migration evidence under the deployment runbook's record location.

**Frozen thresholds before the measured pilot:** All schema, provenance,
privacy, forbidden-role, audit, abort, and no-autonomous-send checks pass;
zero invented client/event facts in reviewed drafts; at least 18 of 20 drafts
per route are usable with no more than minor PMCM edits; p95 latency remains
below each use case's configured timeout; no run exceeds its output-token or
daily budget. Record actual mean cost and a route-specific spend cap approved
by D before any non-synthetic activation. A failed or blocked call counts as
a failed sample, not as a discarded warm-up. D, B, and A sign the fixed fixture
set and edit-classification rubric before those 20 calls begin.

- [ ] Restore an approved database snapshot, rehearse both AI-related Prisma
  migrations, run schema/invariant checks, and record backup plus rollback
  steps. Static migration checks alone do not satisfy this gate.
- [ ] Configure the existing staging deployment path through its secrets
  runbook, including the required Render hook, then deploy the reviewed stack.
  Keep real-data AI disabled and use server-owned synthetic events only.
- [ ] Run at least 20 measured calls per route and use case on the same fixed
  fixtures. Include full PARE orchestration, not just three independent stage
  calls. Record schema pass rate, tool-loop completion, p50/p95 latency, token
  usage, direct-cost estimate, failures, and endpoint/model returned.
- [ ] Have B review every PARE recommendation and A/B review at least 20
  communication drafts per route for factual claims, usability, and edits.
  Record the edit classification without storing raw prompts or private
  client data in the evaluation report.
- [ ] If any threshold fails, leave the route disabled, fix the defect in a
  reviewable PR, rerun the affected matrix, and do not mark the pilot passed.

**Exit:** The results table contains measured staging evidence for both
external routes. The deployment, migration, PMCM review, and evaluation gates
are reproducible and signed by D/B/A for their areas.

## Task 7: Promote governance and retire compatibility controls

**Files:** A numbered ADR under `docs/architecture/decisions/`;
`docs/product/feature-ledger.md`, `readiness-foundation.md`, and
`actual-system.md`; relevant privacy/deployment runbooks; `docs/log.md`,
`CHANGELOG.md`, and roadmap indexes.

- [ ] Record the exact approved route revisions, provider/model/endpoint,
  data classes, ZDR basis, processors/locations, account evidence, limits,
  error policy, audit shape, PMCM approval, and the synthetic staging result.
  Preserve the historical V4 catalog as reference; correct current
  provider-specific ZDR assumptions in living governance.
- [ ] Retire `PARE_MODE` only after the reviewed profile plus use-case
  allowlist are the sole PARE activation controls and old/new configurations
  cannot disagree. Update env examples, tests, deployment secrets, and the
  runbook in the same PR.
- [ ] Update the feature ledger and readiness status from observed evidence.
  Remove completed execution plans after their durable decisions are
  promoted; Git history retains them.
- [ ] Run documentation frontmatter and relative-link audits, stale-path
  search, `git diff --check`, boundary checks/tests, and a second-owner review.

**Exit:** A maintainer can onboard or change an approved route using durable
architecture and operational records without consulting a chat or old PR.

## Task 8: Make a separate real-data activation decision

**Files:** A new activation decision record, exact route/use-case profile
change, deployment configuration, targeted tests, and release note. Do not
reuse approval of this plan or the synthetic pilot as the activation record.

- [ ] D reviews authenticated provider privacy evidence, account controls,
  processor locations, Philippine privacy review outcome, migration and
  staging evidence, cost cap, and B/A product sign-off for the proposed
  exact route revision and use cases.
- [ ] If D declines, record the route as synthetic-only and keep production
  `AI_LIVE_USE_CASES` empty. This closes the synthetic interchangeability
  outcome but leaves real-data activation incomplete.
- [ ] If D approves, create a separate PR that enables only the named
  provider/model/endpoint, environment, use cases, and data classes. Prove
  blocked routes make no provider call, PMCM approval remains required, and
  rollback disables the allowlist without changing feature code.
- [ ] Monitor the limited rollout against audit outcome, budget, latency,
  provider error, and notification metrics. Stop or roll back on a data-policy
  violation, unapproved endpoint, missing audit, autonomous send, or budget
  breach; expand only through another reviewed activation change.

**Exit:** The exact first live route and scope are authorized and observed, or
the record explicitly says real-data activation was declined. Neither result
changes the synthetic provider-interchangeability evidence.

## Task 9: Prove live provider choice for the same data scope

**Files:** A second independent provider adapter/profile if needed; its
provider evidence and activation decision records; route conformance tests;
staging and limited-rollout result tables; deployment and rollback runbook.

- [ ] Identify an independent provider route that can meet the same real-data
  class and use-case scope as Task 8. The synthetic Anthropic route does not
  count while its ZDR basis remains `none`. Apply Task 4's exact-model,
  exact-endpoint, account-privacy, tool, error, abort, and audit checks to the
  new route. A second model behind the same provider does not satisfy provider
  interchangeability, though it may separately prove model configurability.
- [ ] Run the same staging fixture and PMCM review matrix on both eligible
  routes, with the same thresholds from Task 6. Record any difference in
  output quality, usage, latency, cost, and processor locations. D must
  approve the second exact route and data scope in a separate activation PR.
- [ ] In a limited live rollout, switch only the reviewed route profile for
  the same enabled use case and data class. Verify no feature or prompt diff,
  no cross-provider fallback, complete audit and human approval, and rollback
  by disabling the allowlist or restoring the prior reviewed profile.
- [ ] If the second provider fails qualification or D declines it, keep the
  single approved live route and mark live interchangeability pending. Do not
  silently broaden the existing provider's data scope.

**Exit:** Two independent live-eligible providers can serve the same use case
and data class by a reviewed configuration switch. This is the final proof of
the full provider-choice intent in production.

## Final verification ledger

| Outcome | Evidence required | May be claimed when |
| --- | --- | --- |
| Gateway foundation | PR 0-7 merged in order; required static tests; migration rehearsal; full PARE synthetic path; staged PMCM draft review | Task 1, 3, 5, and the foundation portion of 6 pass |
| Synthetic interchangeability | Two external providers; same use case and fixture; configuration-only switch; shared conformance, audit, data, abort, budget, and approval behavior | Tasks 2-4 and the two-route staging pilot pass |
| First real-data activation | Exact route/data/use-case approval, separate PR, deployment and rollback evidence, monitored limited rollout | Task 8 approval and deployment pass |
| Live provider interchangeability | Two independent routes approved for the same real-data scope; configuration-only live switch; same safeguards and rollback | Task 9 approval and limited rollout pass |

Never collapse these four outcomes into one green CI badge. Record any unmet
row as pending, with the failing test, missing evidence, or declined approval.

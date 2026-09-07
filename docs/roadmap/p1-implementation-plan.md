---
type: "Execution Plan"
title: "P1 catalog implementation"
description: "Implement every unblocked P1 package and record precise residual scope and blockers."
status: active
authority: informative
owner: "D (Anthony)"
scope: "W10-W30, W40, W50 and W51; prerequisite verification correction V01"
updated: "2026-09-08"
last_verified: "2f4c5c62036bd0262c6c8514675b4dd3afb2d660"
---
# P1 catalog implementation

## At a glance

- **Purpose:** Execute the accepted P1 matrix without presenting blocked or partial workflows as complete.
- **Authority:** User-authorized execution of the catalog matrix; the feature ledger and accepted lifecycle policy govern product behavior.
- **Owner:** D coordinates platform trust and verification; B owns operations, C external portals, A UX.
- **Scope:** All 24 P1 packages. Existing P0 changes are the baseline, not new P1 delivery.
- **Use/change:** Track independent deliveries, integration evidence and concrete blockers; promote the final results into the catalog/readiness reports.
- **Verify with:** Exact catalog acceptance, shared contracts, affected role paths, forbidden-role/state tests, database transactions where relevant, boundaries and independent review.

## Execution design

Work starts from commit `2f4c5c6` on `codex/p1-implementation-2026-09-08`. PR #40 remains separate and unmerged; P1 integration can proceed on its reviewed implementation baseline. Do not overwrite the original dirty checkout or merge without the repository's human review requirement.

Luna agents own independent operations and commercial worktrees. Opus 5 is the user's first choice for review/advice. Its invocation failed with `unreadable_encrypted_agent_task` because the routed provider could not read the native encrypted task payload. Sol has started as the independent reviewer/adviser fallback while D supervises integration. Review never substitutes for a human second-owner GitHub review.

Use bounded-context APIs, shared Zod contracts and actor-owned portal features. Preserve P0 ownership, lifecycle, audit and concurrency guarantees. External prerequisites limit acceptance of the affected slice; they do not justify skipping local implementation that can be completed honestly. Do not simulate successful storage, delivery, privacy fulfillment or live AI. Missing exact catalog behavior definitions remain unassessed.

## Batches and ownership

| Batch | Packages | First deliverable and integration boundary |
| --- | --- | --- |
| Verification baseline — D | V01 | Move the cross-context supplier ownership integration fixture outside production read-models; retain the production mutation prohibition and execute the test through an explicit integration-test discovery path. |
| Operations — B/C | W18, W19, W20, W21, W22, W23, W27 | First complete W22 platform state/supplier/event-end validation. Then implement accepted operator, schedule, masterlist, actual-end and feedback behavior in dependency order. Coordinate schema changes centrally before generation. |
| Commercial — B/C | W12, W14, W15, W16, W17, W25, W26, W40 | First complete assessment and application conversion that current persistence can support; then build real proposal/version, billing, communication and lifecycle slices. Preserve approved financial sources and transactional transitions. |
| Platform — D | W10, W11, W13, W24, W28, W29, W30 | Inspect existing adapters/policies, implement scoped local contracts and workflows, and identify only concrete provider/access/policy gates. Do not introduce an external IdP as a shortcut. |
| Source/UX — B/A | W50, W51 | Recover stable behavior acceptance text if available; complete actor-specific actions and proportionate runtime accessibility/role-path acceptance after dependent data flows exist. |

All 24 packages start under assessment; this table is an execution allocation, not a claim of completion or a new effort estimate. Every package must finish with a delivered scope, exact acceptance evidence, remaining gap and named blocker/owner action where applicable.

## Verification and delivery sequence

1. Correct V01 and establish current workspace package builds and targeted baselines.
2. Inspect the exact catalog rows and existing code before each slice; record a concrete design and any missing policy/input.
3. Implement contracts, transactional API behavior and the correct role UI; retain idempotency, event scope and rejected-state coverage.
4. Build shared types before dependent checks. Run focused tests, touched workspace typechecks and required boundary checks; use only isolated local data for transaction/runtime acceptance.
5. Independently review each immutable batch, resolve findings and integrate into the P1 branch. Do not generate a shared Prisma client from competing worktrees.
6. Refresh all P1 work rows and affected catalog statuses with implementation evidence; keep full-feature blockers separate from verification limits. Publish reviewable feature-branch changes without merging or deploying implicitly.

## Initial known constraints

### Verified baseline and first platform slice

V01 is corrected: the cross-context integration fixture now lives under `apps/api/test/integration`, is discovered explicitly by Vitest, and passes against isolated PostgreSQL. Direct boundaries pass (1018 production files after the notification slice); 11 checker tests pass. Actual-end and supplier conversion/history persistence is additive, with null historical provenance preserved; its migration was applied only to disposable loopback PostgreSQL. The worktree has its own generated Prisma client.

W11 now has a provider-neutral delivery port, at most 100 claims per invocation, lease-token compare-and-set settlement, exponential retry scheduling, unique payload-bound idempotency and persisted provider acceptance receipts. A lifecycle runner polls every 30 seconds only when an adapter is configured, and provider calls time out after 30 seconds. Acknowledgement requires provider-accepted status and uses compare-and-set. A missing adapter retains queued status and an explicit configuration reason; it never fabricates delivery success. Real concurrent PostgreSQL tests cover duplicate queue requests, changed-content rejection, competing workers, deferred retries and expired-lease recovery. Provider approval/access, adapter implementation, delivery receipts beyond provider acceptance and full email/Viber role-path acceptance remain outstanding. This is partial W11, not a delivered external notification service.

Historical `sent` records originated under the sample adapter and are not retroactive proof of provider delivery. Legacy correlation-key retries are preserved; new notifications use a separate unique idempotency key. Provider adapters must honor the stable notification ID across retries, including recovery after uncertain acceptance.

- V01 is a reproduced test-placement boundary failure at the baseline; implementation begins by correcting it.
- Real storage and email/Viber provider choices/access, exact compliance rule inventory, privacy retention/legal-hold policy and the 37 unlisted system behaviors require verification before being called available inputs.
- P0's accepted operator, seven-day feedback across archive and catalog-category policies are decisions already made; do not ask for them again. Category migration is P2 W31 unless a P1 dependency needs a narrowly identified prerequisite.
- Existing local dependencies may be reused, but production credentials, provider actions, resets and shared-client regeneration are not baseline setup steps.

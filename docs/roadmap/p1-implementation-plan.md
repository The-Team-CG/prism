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

W13/W12 onboarding correction: briefing submissions retain earlier rows, enforce an unlocked pre-event-day lifecycle, recheck primary-client authority in the transaction, and commit briefing/event state/audit/outbox intent together. Focused service/controller coverage verifies retained history and denied lifecycle states. This is briefing history and transactional correctness, not a complete CE/proposal versioning or signed-file onboarding journey.

### Verified baseline and first platform slice

V01 is corrected: the cross-context integration fixture now lives under `apps/api/test/integration`, is discovered explicitly by Vitest, and passes against isolated PostgreSQL. Direct boundaries pass (1018 production files after the notification slice); 11 checker tests pass. Actual-end and supplier conversion/history persistence is additive, with null historical provenance preserved; its migration was applied only to disposable loopback PostgreSQL. The worktree has its own generated Prisma client.

W11 now has a provider-neutral delivery port, at most 100 claims per invocation, lease-token compare-and-set settlement, exponential retry scheduling, unique payload-bound idempotency and persisted provider acceptance receipts. A lifecycle runner polls every 30 seconds only when an adapter is configured, and provider calls time out after 30 seconds. Acknowledgement requires provider-accepted status and uses compare-and-set. A missing adapter retains queued status and an explicit configuration reason; it never fabricates delivery success. Real concurrent PostgreSQL tests cover duplicate queue requests, changed-content rejection, competing workers, deferred retries and expired-lease recovery. Provider approval/access, adapter implementation, delivery receipts beyond provider acceptance and full email/Viber role-path acceptance remain outstanding. This is partial W11, not a delivered external notification service.

W18 staffing delivery (branch `codex/p1-w18-staffing`): coordinator date/range availability and unavailable/blocked windows are persisted and checked inside assignment/replacement transactions; persisted per-event role/skill coverage reports required, assigned, acknowledged and satisfaction; coordinator acknowledgement/decline, required withdrawal notes, replacement linkage and acknowledgement history are retained; reminder intent is idempotently queued through W11. Focused API/controller/read-model tests (42 passed), shared contract tests (20 passed), API and event typechecks, Prisma validation/generation and boundaries passed. PostgreSQL acceptance is unavailable because no local database is running. Residuals are AI emergency recommendations (W45), external email/Viber delivery pending a provider adapter/configuration (W11), and object-storage work (W10).

Historical `sent` records originated under the sample adapter and are not retroactive proof of provider delivery. Legacy correlation-key retries are preserved; new notifications use a separate unique idempotency key. Provider adapters must honor the stable notification ID across retries, including recovery after uncertain acceptance.

W30's first local correction serializes audit appends through a singleton row updated in the same transaction as latest-hash lookup and insertion. New timestamps are strictly monotonic; verification follows hash links so same-millisecond historical UUID ordering cannot reorder valid history. Tied historical tails are resolved by links and ambiguous tails reject new writes. Standalone audit calls open a transaction, and caller-owned transactions retain atomic rollback. PostgreSQL tests cover eight concurrent appends, nested rollback and stale Serializable snapshot rejection. Export audit records use the verified actor and unknown device/IP metadata rather than sample values. Historical hashes are preserved; this does not repair an old broken chain or establish database-enforced append-only storage. Full mutation coverage, immutable storage/retention integration and runtime export verification remain W30 residual scope.

### Trust and identity remediation delivery (2026-09-08)

The trust/identity slice now resolves audit append tails from complete hash-link reachability, preserves genuine fork/disconnected-chain rejection, and exposes `ambiguousTail` plus candidate IDs through the PMCM/system-only integrity endpoint. Forbidden-access audit failures remain access-denying and now attempt a durable `audit_integrity_incident` record. Security alerts use the notification outbox with payload-bound idempotency keys and an approved PMCM email when one exists; absent recipients are recorded explicitly. Login history uses `unknown` metadata when request metadata is unavailable. Password recovery returns one generic response, retains still-valid tokens, limits requests by normalized email and client IP in a durable table, audits requests and consumption attempts, and keeps hashed 15-minute single-use tokens with session-version revocation. Focused tests pass (5 files, 29 tests), API typecheck, Prisma validation, and boundaries pass; the complexity gate reports only the pre-existing guest workflow offender. PostgreSQL-backed acceptance is unverified because no local database is available; provider delivery, immutable database append-only enforcement, and full production mutation coverage remain blockers.

### Guest masterlist and walk-in policy delivery (2026-09-08)

W19 delivers the guest masterlist and walk-in policy slice: shared Zod contracts define `closed`, `open`, and `threshold`; PMCM policy writes are audited and threshold checks serialize against live checked-in headcount; structured roster rows reconcile idempotently, mark withdrawals, preserve import actor/time provenance, and link roster entries to transactional check-ins; scoped registration search and verification transitions are available to PMCM and registration coordinators; event PMCM and client policy views are wired through the portal MVVM paths. Raw guest-file upload remains blocked pending W10 storage/object handling, and QR entry remains owned by W35.

### Integrated P1 baseline (2026-09-08)

W18, W19 and the trust/identity remediation are merged into `codex/p1-implementation-2026-09-08` at `764df82`. All four repository gates pass on the merged result: `@prism/types` build exit 0; Prisma client generation exit 0; `apps/api` typecheck exit 0; the full `apps/api` Vitest suite 103 files passed and 12 skipped with 511 tests passed and 37 skipped; `check-prism-boundaries` passed for 1045 files; `check-cyclomatic-complexity` reports 5999 production functions with maximum complexity at or below the cap of 10. The complexity offenders reported on the individual branches (`guest-workflow.service.ts` `validateState` and `buildTrustedResetUrl`) are both resolved in the merged result. The 12 skipped files are the PostgreSQL-backed suites: no local database is reachable at 127.0.0.1:55437 and Docker Desktop is not running, so every database-level claim in this plan — lease compare-and-set contention, expired-lease recovery, concurrent audit appends, communication replay, reset-limiter concurrency, row locks and advisory locks, and clean sequential application of the new migrations — remains unverified in this session and needs a disposable PostgreSQL run before acceptance.

- V01 is a reproduced test-placement boundary failure at the baseline; implementation begins by correcting it.
- Real storage and email/Viber provider choices/access, exact compliance rule inventory, privacy retention/legal-hold policy and the 37 unlisted system behaviors require verification before being called available inputs.
- P0's accepted operator, seven-day feedback across archive and catalog-category policies are decisions already made; do not ask for them again. Category migration is P2 W31 unless a P1 dependency needs a narrowly identified prerequisite.
- Existing local dependencies may be reused, but production credentials, provider actions, resets and shared-client regeneration are not baseline setup steps.

### W17 communication threads — delivered scope and residuals

W17 now persists event-scoped threads, active participants, messages, participant read timestamps, and audited thread creation/message actions. PMCM creates threads after server-side recipient resolution; clients and assigned suppliers can list and reply only when the shared event policy and active thread membership allow it. Supplier email resolution normalizes case on approved application conversion and performs a case-insensitive lookup. Message idempotency is unique within a thread and replay returns the original message; the API exposes newest-first message pages with an opaque cursor for loading older messages. Client, supplier, and event portals use feature data repositories and ViewModels, stable per-compose UUID keys, persisted thread lists/messages, unread counts and read acknowledgements; the event surface no longer renders audit/notification fallback threads. New email notification records remain queued W11 intent and do not claim provider delivery.

Acceptance evidence: focused API tests pass for message authorization/replay guards, mixed-case supplier participant resolution, and participant enumeration query fan-out; API and all three portal typechecks pass; `check-prism-boundaries.mjs` passes. PostgreSQL persistence/replay acceptance is unverified in this session because no local PostgreSQL is available; the updated PostgreSQL tests remain environment-gated. External email/Viber delivery and provider receipts remain blocked on the W11 provider decision, adapter implementation, credentials, and runtime acceptance. The requested `feature-effort-priority-risk-matrix-2026-09-07.md` and `feature-catalog-review-2026-09-07.md` inputs are absent from this checkout, so exact W17/E22 row traceability remains a documentation blocker owned by D.

### W23 feedback windows and moderation — delivered scope and residuals

W23 delivers shared Zod contracts, a timestamped Prisma migration, and transactional guest feedback behavior. Submissions use `actualEndedAt` as the only deadline anchor, reject before the recorded end and after the inclusive seven-day deadline with distinct user-safe reasons, and remain available across archive through a feedback-only access-code lookup. Check-in continues to resolve only unarchived events. PMCM moderation is exposed under the event portal and API with a pending queue plus approve/reject/hide decisions; negative decisions require a reason, and every decision stores actor, timestamp and an audit record. Guest privacy/marketing consent is recorded with its notice version and can be withdrawn during the same window; publishable queries require approved moderation and persisted consent. Optional photo/video metadata creates an explicit `pending_storage` attachment record with the W10 object-storage blocker; no upload or fake success is attempted.

Focused API tests cover pre-end, exact deadline, expiry, missing-end fallback, archived feedback/check-in separation, moderation, consent withdrawal and route delegation. Portal typechecks and API/shared contract checks are the acceptance evidence available in this session. PostgreSQL transaction acceptance is unverified because no local database is running. QR entry remains W35, object storage bytes remain W10 (provider, credentials and adapter are the named blockers), and post-event AI intelligence remains W49.

### W21 live operations delivery (2026-09-08)

W21 adds persisted multi-day schedule days and ordered segments, planned/actual timing with variance, explicit operator designation, audited transactional handoffs, structured EOD reports with PMCM replies, a derived per-day run sheet and server-clock timer read model. The event's existing `actualEndedAt` remains authoritative for event end. Shared Zod writes, API/event typechecks, focused deterministic timer tests, Prisma validation and client generation passed; full API, boundary and complexity gates remain required on the parent integration branch. No local PostgreSQL was available, so transaction-level database acceptance is unverified. External email/Viber delivery remains queued pending W11 provider adapter/access; AI copilot/advisory monitoring (W47), emergency replacement (W45), and attachment object storage (W10) are residual scope.

### W10 storage foundation — delivered scope and provider gate (2026-09-08)

W10 adds one provider-neutral storage adapter port under `platform-ops` for upload-location requests, upload confirmation, timed download authorization, and deletion. `platform_ops.stored_objects` is the durable metadata system of record: event and owning-record scope, usage, declared content metadata, SHA-256 checksum, uploader actor, lifecycle state, provider name/key, failure reason, idempotency key, and timestamps. Requests are idempotent by `(eventId, usage, logicalTarget)` (or the supplied idempotency key); a stored target cannot be silently rebound, and replacement after failed/deleted state receives a fresh provider object key. Server validation enforces usage-specific type, size, extension/content-type agreement, and checksum/byte-size checks on confirmation. Event access policy and supplier-private usage rules protect download, confirmation and deletion paths; no portal journey was added because W13 owns document journeys.

The single implemented adapter is `LocalFileSystemStorageAdapter`, bound only by `PRISM_STORAGE_PROVIDER=local` plus `PRISM_STORAGE_LOCAL_DIRECTORY`. It atomically writes and reads real bytes under that directory and issues adapter-resolvable, short-lived local authorization URIs for development. Without those settings, requests are durably recorded as `failed` with `Storage provider is not configured`, with no upload location or stored success. The old event-lifecycle signed-upload factory remains only as a deprecated metadata-only compatibility shim and is no longer bound; the canonical abstraction is the platform-ops storage port. Retention and legal-hold enforcement is an explicit seam owned by W29 and is not implemented here.

The provider decision required to finish W10 is: approve one production object-storage provider and its access model (S3-compatible, GCS, Supabase Storage, or another named provider), then provision a least-privilege service identity with object create/read/delete access to the production bucket/container and a separate migration/operator identity if required. The approved adapter must define the exact provider name, bucket/container, endpoint/region, credentials or workload identity, signed URL expiry limits, and server-side encryption policy. The currently implemented local adapter expects exactly `PRISM_STORAGE_PROVIDER=local` and `PRISM_STORAGE_LOCAL_DIRECTORY`; it expects no credentials. A production adapter's provider-specific bucket/container, endpoint/region, identity and encryption keys cannot be named honestly until that provider is selected. Once approved, acceptance can add provider-backed signed upload/download resolution, authorization expiry, retries/uncertain-confirm recovery, durable provider metadata, deletion failure recovery, and disposable integration tests for each usage and visibility rule. The requested `feature-effort-priority-risk-matrix-2026-09-07.md` and `feature-catalog-review-2026-09-07.md` files are absent from this checkout; the usage allowlist and limits therefore follow existing file requirements and upload metadata, and require owner confirmation against those catalog sources. PostgreSQL transaction/unique-index acceptance for this migration is unverified in this session because no local database is available; W13, W14, W23 media and W27/W29 provider-dependent portions remain blocked until this decision and access are completed.

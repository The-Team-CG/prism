# Documentation bundle update log

## 2026-09-28

- **Progress:** Completion-plan Task 4 checked current official OpenRouter metadata. The GLM 5.3 Flash listing advertises tool calling and structured outputs but spans multiple upstream providers; the reviewed profile must pin an exact endpoint and disable provider fallback. Request controls for ZDR and data-collection denial are documented, but account settings and endpoint-specific behavior remain unverified. No OpenRouter API key is configured in the local API environment, so the authenticated synthetic probe has not run and no adapter/profile was added.
- **Implemented:** Completion-plan Task 3's server-owned synthetic PARE chain. Budget, risk, and message-draft stages run in order; each stage is bound to a registered root, correlation ID, prior-output digest, registered tool-result digests, and completed durable audit. PMCM approval rechecks stage audits and the saved review-payload digest. PARE review content is stored on the approval record; the forward migration backfills existing sanitized reviews and scrubs draft text from aggregate audit JSON. Pre-chain pending approvals retain a marked legacy review path, new live PARE fails closed without a verifier, and the read-only invariant recomputes the review-payload digest from stored JSONB.
- **Verified:** Shared types build/typecheck and schema tests (8); API build/typecheck and focused PARE/gateway tests (83 passed, 2 skipped); Prisma validation and offline migration verification; migration guard (68 migrations); invariant dry-run and tests (17); boundary check (1,197 files) and boundary tests (52); `git diff --check`. The local scripted adapter tests exercise mock and the synthetic Anthropic route profile; they do not qualify a live provider. The user identified the local environment as the target for the restored-snapshot migration rehearsal, but no snapshot or local PostgreSQL listener was found; the only configured database URL is remote, and it was left untouched. Task 3 is not marked complete until that rehearsal is recorded.
- **Implemented:** Completion-plan Task 2 on `codex/ai-gateway-task2-provider-neutral`: route profiles support use-case overrides with tier fallback; startup rejects unknown explicit profiles/use cases; audit evidence records a SHA-256 route revision and provider-neutral policy outcome; PARE approval consumes that outcome rather than Anthropic identity or a provider-specific ZDR check. A fake second adapter proves configuration-only route switching for the same PARE use case. OpenRouter remains unqualified and is not registered as a runtime route.
- **Verified:** `@prism/types` build, typecheck, and 51 tests; focused API gateway/PARE/conforme tests (67 passed, 2 skipped); API typecheck; `check:boundaries` (1,195 files); `test:boundaries` (52 tests); and `git diff --check` passed. Work remains local; no PR, push, merge, live provider qualification, or activation was performed.

## 2026-09-26

- **Verified:** Refetched and reviewed GitHub PRs #65-#71 (phase PR 0-6); recorded exact base/head SHAs and confirmed Node CI, Gitleaks, and CodeQL pass on every current head. Phase PR 7 has not been opened. Local PR 6 validation passed for types, API, event portal, boundaries, Prisma, migrations, and invariants. Corrected PR 6's exit: local synthetic smoke passed; staging pilot, full PARE provenance, 20-run measurements, and PMCM review/sign-off remain pending.

## 2026-09-25

- **Recorded:** PR 6 freezes synthetic PARE and unsigned-conforme scenarios, local pass criteria, and a results table. Final single-run Anthropic smoke completed all four fixed use cases with registered PARE tool loops; exploratory failures remain visible. Full PARE provenance chaining, synthetic staging pilot, 20-run metrics, and PMCM review remain pending. OpenRouter and all real-data/production AI stay disabled.
- **Verified:** The latest attempted staging Deploy run failed at the required Render API deploy hook secret, and newer Deploy runs were skipped. PR 6 records this external staging pilot gate.

## 2026-09-24

- **Added:** Interchangeable AI provider gateway plan. Every AI use case will call one `platform-ops` gateway; Anthropic Sonnet is a synthetic-data test route and OpenRouter `z-ai/glm-5.3-flash` is a production candidate pending ZDR/tool verification. The plan records PARE coupling, fail-closed rules, streaming FR-AI-09 drafts, and the separate Owner D approval required before live AI touches real data.
- **Expanded:** PR 0–7 now have owners, file scopes, dependencies, and exit checks. After provider verification and contract freeze, four worktrees can develop the core, adapters, PARE migration, and communication draft in parallel; merges remain ordered. The audit migration moves into the gateway-core PR, and the plan covers free-text sanitization and the existing automatic conforme reminder collision.
- **Recorded:** PR 0 verifies Anthropic Sonnet 4.6 forced-tool output with synthetic data. Public OpenRouter metadata shows candidate ZDR/tool/schema endpoints, including Fireworks, but model access and account privacy evidence are unavailable. The user approved deferring OpenRouter; mock remains default and production/real-data AI stay disabled. PR 0 is complete for this approved scope.
- **Frozen:** PR 1 defines shared Zod/inferred AI use-case, routing, audit, and streaming contracts plus gateway/provider/tool ports. Provider SDK imports are confined to gateway infrastructure, with only the three existing PARE agents grandfathered until their PR 4 migration.
- **Implemented in PR 2 worktree:** mock-default gateway core, exact server-registered synthetic fixtures, Anthropic-only test route gating, centralized input minimization/output validation, bounded retries and abort/tool-loop controls, concurrency-safe daily token reservations, and nullable audit evidence. POST/SSE withholds provider text until tool results, output schema, and PII checks pass, then emits validated output deltas. New gateway audit rows map stable use-case IDs to legacy `featureName` and requested models to `modelVersion`; the migration is not deployed. OpenRouter and production/real-data AI remain disabled.
- **Recorded:** PR 5's narrow event-lifecycle reminder-window claim contract lets the platform-ops draft workflow recheck inquiry eligibility and claim the same compare-and-set reminder window as the scheduled sweep. Recipient lookup stays with the inquiry owner; approval, decision audit, and notification outbox writes remain transactional.

## 2026-09-18

- **Hardened:** Test-clock coverage now includes API compatibility/kernel and integration-test roots, with per-test analysis and explicit suite setup recognition. The API environment example documents the Prisma pooler override and the sample-state guard's session/role boundary.
- **Hardened:** Test-clock analysis now recognizes nested `it.each` callbacks and helper-returned fixtures, inherits parent-suite `beforeEach`/`beforeAll` pins, and covers `reminderDueAt`-style fixtures without letting sibling suites suppress findings.
- **Recorded:** The production complexity gate is now enforced in CI, and the database doctor follows the same explicit Prisma URL precedence as `prisma.config.ts`.

## 2026-09-17 (2)

- **Decided:** `GET /api/sample/state` requires a verified PmcmAdmin/System session. ADR-0002 previously rejected it as a product API but said nothing about authentication, so the unguarded state read was undocumented rather than deliberate. The ADR now records both the decision and why the `NODE_ENV=production` disable was insufficient on shared staging.
- **Added:** Deployment secrets runbook. Deploy has never succeeded; it fails at `check-deploy-secrets` on a missing Render hook URL, so nothing has been auto-deploying.
- **Recorded:** Test fixtures that compare a hardcoded date against a live clock are a scheduled outage. The rule is to pin the clock, never to move the date forward.

## 2026-09-17

- **Decided:** Audit-chain integrity remains fail-closed on the authentication path by default, but the posture is now explicit rather than emergent. `AUTH_AUDIT_INTEGRITY_POSTURE=degraded` is the operator escape hatch for restoring access during an integrity review, and every classification records a critical incident first, so fail-closed is never the silent branch.
- **Recorded:** The audit table has exactly one writer. Direct `opsAuditLog` creates outside `AuditService` are the defect class that produced the sign-in outage, and `immutable_hash` no longer carries a column default that makes an unhashed row representable.
- **Added:** Data-invariant declarations and a read-only verification gate, plus runbook guidance that any migration introducing a runtime-enforced invariant must add a matching declaration and be checked against a restored snapshot before deploy.

## 2026-09-12

- **Decided:** Authentication remains available when the existing audit history has a known, hash-validated two-chain tail; the authentication seam records a critical integrity incident and preserves credential, lockout, session, and authentication-alert behavior, while unavailable audit storage or incident persistence still fails closed. Live audit rows remain untouched pending operator reconciliation.

## 2026-09-11

- **Added:** Prisma migration ownership policy with normalized legacy SQL checksums, static future-migration guard, and canonical database migration runbook covering Prisma's flat execution history, owner-aware metadata, deployment preflight, and ledger/live-schema drift recovery. Existing applied migration directories remain unchanged.

## 2026-09-08

- **Updated:** Parallel-worktree runbook and launch guards with persisted Git metadata port slots, lease-backed PID/start identity ownership, reparse-root containment, example-first env seeding, ancestry-aware API cleanup, and linked-worktree Docker rejection.
- **Updated:** Stop and API launch paths now resolve current-checkout ports, stale worktree registrations are excluded from slot reconciliation, lease cleanup is identity-conditional, and portal links receive derived origins.

- **Added:** Parallel-worktree runbook covering checkout-derived dev ports, the port-guard ownership rule, and junction-safe worktree teardown.
- **Hardened:** PARE dispatch cancellation and shutdown tracking now propagate abort signals through the provider calls, restore idempotent `pare_triggered` activity audit records, and validate audit payload request IDs plus source-dispatch ownership before mapping or reviewing approvals. PostgreSQL concurrency and provider cancellation remain unverified without the integration database and live provider.

- **Recorded:** Supplier withdrawal PARE execution now uses a dedicated platform-ops dispatch outbox with same-transaction enqueue, lease-token retries, terminal configuration/missing-source outcomes, and dispatch-keyed approval idempotency. The dispatch retains event ownership while the worker reloads commercial request state by ID.
- **Recorded:** Read-model collection safety limits across visible events, PMCM
  dashboards/inboxes/workspaces, billing, client action center, supplier
  history, live ops, guest check-ins/feedback, and staffing acknowledgements.
  Stable ID tie-breakers and exact defense-readiness, attendance, feedback, and
  staffing counts preserve aggregate correctness when row windows are capped.
  No live PostgreSQL acceptance was available in this checkout.

- **Recorded:** Read-model collection safety limits across visible events, PMCM
  dashboards/inboxes/workspaces, billing, client action center, supplier
  history, live ops, guest check-ins/feedback, and staffing acknowledgements.
  Stable ID tie-breakers and exact defense-readiness, attendance, feedback, and
  staffing counts preserve aggregate correctness when row windows are capped.
  No live PostgreSQL acceptance was available in this checkout.
- **Added:** Transactional command receipts and actor- and event-scoped idempotency through `WorkflowCommandService` for commands that supply an explicit payload hash, with a durable `trust_ops.command_receipts` table and changed-content replay rejection. Existing domain-specific idempotency records remain the source of their own business invariants until callers migrate safely.
- **Added:** Root flat ESLint architecture checks for cross-portal imports, private bounded-context paths, local shared-contract redefinitions, and inline Zod usage, with deterministic fixture coverage and canonical schema/adapter exceptions.
- **Added:** Guest event watermark endpoint and conditional dashboard refresh; the guest portal now polls the event revision and fetches the full pass only when the event or attendance count changes.
- **Added:** Root build and typecheck now fail early when the gitignored `@prism/types` output is missing or older than its source; the preflight points directly to the package build command.

- **Updated:** P1 catalog implementation evidence through W15/W26/W51 integration: package-level effort/priority/risk status, partial scope, provider and policy blockers, PostgreSQL/Docker verification limits, and the remaining W29 policy gate are recorded in the catalog review and matrix.

- **Recorded:** Trust and identity remediation: full hash-reachable audit tails with durable forbidden-access integrity incidents, outbox-backed security alerts, unknown unavailable login metadata, required session-version checks, and durable email/IP password-reset throttling with reset audit events; PostgreSQL acceptance remains unavailable locally.

- **Recorded:** Briefing history retention and transactional state/actor/audit/outbox correction, with full proposal and stored-file journeys still tracked separately.

- **Corrected:** Historical audit ordering follows hash links rather than UUID ordering when timestamps tie; fixture audit rows remain in disposable PostgreSQL to avoid breaking later writers.

- **Recorded:** W30 concurrency-safe audit append evidence, verified export actor attribution and explicit historical-integrity/append-only limits.

- **Verified:** Integration-fixture relocation and partial W11 durable delivery worker, including provider gates and historical sample-delivery evidence limits.

- **Started:** User-authorized P1 implementation across all 24 packages, with Luna implementation agents and Opus-first review/advice. The Opus provider rejected the encrypted task payload; Sol is the active fallback reviewer.
- **Reconciled:** Full catalog assessment and planning matrix against P0 implementation commit `02b6896`; retained the historical baseline, refreshed feature/finding status, and excluded nine completed P0 packages from the 43 remaining packages.
- **Corrected:** Fresh verification found V01, a read-model mutation boundary violation in the supplier ownership database fixture. The latest boundary failure supersedes the earlier pass record; this documentation delivery preserves source unchanged.
- **Recorded:** P0 W01-W09 readiness with original effort/priority/risk estimates, implementation evidence and explicit proposal, logistics, privacy and live-AI blockers. Full catalog baseline counts remain historical.
- **Decided:** Event authority and lifecycle policy: PMCM official layouts, designated attendance operator, recorded-end wrap-up, reasoned archive overrides, seven-day guest feedback including archive, and catalog categories with Private mapped to Individual. Downstream engineering remains separately identified.
- **Updated:** Feature ledger, actual-system and readiness contracts to distinguish implemented corrections from complete workflows; promoted the working remediation plan into semantic living documents.
- **Registered:** Focused pure closeout and event-scope read subpaths and built API session/module verification in architecture contracts and navigation indexes.

## 2026-09-04

- **Recorded:** Overlay evidence for client proposal review (primary contact, revision cap),
  archived-event search by venue/type/month, supplier applications inbox, coordinator
  double-book suggestions, client remaining-balance billing, and supplier-gap
  hard-block copy. Catalog canvas blockers table lists storage, production
  notify, external IdP, QR, live AI, and CE builder depth as skipped (do not implement).
- **Recorded:** New-S5 now has an event-closure review path for confirmed supplier
  assignments: PMCM-only prompts, category dimensions, private notes, shared Zod
  validation, and focused API/event evidence. The external Cursor canvas is outside
  the writable worktree, so its row was not rescored or claimed as updated.

## 2026-09-03

- **Recorded:** P0/P1 catalog thin-slice evidence on the feature-ledger overlay
  without changing Active Ledger decisions: inquiry copy-link, onboarding
  invitation evidence, Command Inbox on PMCM home, labeled client action-center
  fallback, role file-requirements matrices with storage remaining gated,
  PMCM supplier readiness, client-safe billing, guest access-code check-in
  without camera QR, close-gate private-notes mapper, and privacy/audit
  request evidence. Live AI, production notification adapters, external auth,
  and object storage stay gated.

## 2026-09-02

- **Documented:** Fresh-clone bootstrap (types build, Prisma generate, paused
  Supabase, migrate deploy, `.next/dev` trap) in the README and Docker
  runbook; seeded-event table in portal accounts.
- **Governed:** Constitution now states that second-owner review cannot be
  self-certified and must appear on the GitHub reviews array. CODEOWNERS
  was removed because GitHub Free cannot enforce it on this private
  repository.
- **Recorded:** EP-11-S02 findings (PA-290, PA-287, PA-288, PA-291, PA-294,
  PA-296, PA-295, PA-284, PA-292) on the architecture priority/risk matrix as
  parked follow-up, not a sweep.
- **Governed:** CI high-severity audit now uses `scripts/npm-audit-ci.mjs`
  with a time-bounded exception for Prisma's unused `mysql2` pin
  (GHSA-3f6p-5ww8-9rcr).

## 2026-09-01

- **Created:** Adopted an OKF v0.2-style bundle landing, constitution, typed
  concept metadata, directory indexes, and update history.
- **Restructured:** Moved current architecture, product, roadmap, runbook, and
  V4 reference material into semantic directories.
- **Decided:** Added ADRs for role-app boundaries, shared contracts and sample
  compatibility, DDD-shaped modular-monolith contexts, cross-context seams and
  read models, and Next route/feature MVVM architecture.
- **Promoted:** Converted durable FE/BE findings and priority/risk items into
  architecture ADRs and roadmap records.
- **Retired:** Removed completed execution plans and dated review artifacts
  after promoting their durable content. Git history remains the archive; the
  V4 catalog remains a deliberate reference set.
- **Refined:** Removed the redundant assessment, implementation backlog, and
  compatibility pointer documents; added authority/owner/scope metadata and an
  at-a-glance section to each living concept document.
- **Aligned:** Replaced the event dashboard's central content dispatcher with
  route-owned composition, split its navigation and workspace orchestration,
  moved selectors to `pmcm-kit`, and consolidated event filter compatibility
  behind the dynamic `[eventSlug]` route.
- **Hardened:** Bounded the remaining floorplan list queries, inverted the
  kernel-to-platform audit dependency, and introduced focused audit,
  notification, authentication, document, finance, staffing, guest, and
  floorplan context ports where application code crossed broad service seams.
- **Recorded:** Added the architecture-alignment report, priority/risk status
  snapshot, persistence ownership and intentional-join register, and ADR-0006.
  Remaining legacy DTO migration, deeper domain-policy extraction, and
  microservice extraction stay evidence-driven follow-up work rather than
  unbounded cleanup.
- **Audited:** After the alignment commit, no obsolete tracked execution plans,
  dated review artifacts, redundant assessment documents, or duplicate docs
  pointers remain in the canonical bundle. Active inventories, roadmap/matrix
  records, ADRs, runbooks, and V4 reference material remain intentionally
  retained because they are still referenced or carry current authority.
- **Synchronized:** Updated the root `CHANGELOG.md` for the alignment delivery
  and corrected the redesign inventory's route and verification notes.
- **Governed:** Made the root changelog mandatory for every user-requested
  delivery, with this log reserved for documentation-bundle changes and release
  notes kept under `[Unreleased]` until versioning occurs.

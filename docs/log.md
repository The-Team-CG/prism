# Documentation bundle update log

## 2026-10-05

- **Added:** Opt-in exact Prisma migration-ledger compatibility checking at API startup, a repository-wide schema cutover hold for automated deployment, promotion, rollback, and manual environment sync, and a read-only migration preflight workflow. The preflight checks configuration and validates the database ledger as a known applied prefix, prints the desired SQL diff for review, and does not apply migrations or deploy services.
- **Implemented:** Added a DDD schema-cutover preflight that accepts only explicit loopback disposable database URLs, captures bounded read-only evidence, and performs no automatic repair. The manifest-driven JSON export now covers the owned tables and migration ledger from one snapshot, uses private file creation where supported, and refuses to replace an existing backup.
- **Documented:** Added the schema-cutover rehearsal runbook and linked it from the migration runbook.
- **Verified:** Backup, preflight, invariant, and ownership tests passed (34/34); final-layout invariant dry-run, API typecheck, offline Prisma validation/diff, and the 1,328-file boundary scan passed. No live PostgreSQL replay, populated upgrade, or alternate-database restore was run in this slice.

## 2026-10-04

- **Implemented:** Commercial additional billing validates recorded post-event state through Lifecycle and same-event urgent-issue eligibility through LiveOps; both owner readers use the caller transaction and lock the required rows until commit.
- **Recorded:** Added the canonical external-reference lifecycle register and machine-readable policy for 45 cross-domain foreign keys and 28 scalar references. The register distinguishes current eligibility from historical attribution, records current delete effects and owner recovery rules, and keeps FK removal behind behavior and migration gates.
- **Implemented:** Lifecycle addendum issuance now delegates approved billing-source and selected supplier-quote mutations to a narrow Commercial capability in the same transaction, then retains its own impact history. Corrected the stale onboarding ownership description: current briefing/conforme workflows do not create billing rows without priced-source input.
- **Corrected:** Lifecycle is now the sole production owner of `OpsDocument` metadata registration. Commercial supplier contracts and billing statements use the transaction-aware `DOCUMENT_VAULT`; billing-source evidence and client proposal review validate event, kind, and status through the owner capability. Document metadata remains retained and redaction disabled while PMCM document-retention policy is pending.

## 2026-10-03

- **Hardened:** Runtime and migration database URL precedence now share one parser; Node PostgreSQL clients verify hosted certificates, custom CA trust is explicit, non-TLS is loopback-only, and the database runbook documents the policy.
- **Corrected:** Historical coordinator event access now stays read-only in portal controls and API mutation authorization while preserving scoped reads and switching back to current events. The ledger records the boundary and regression evidence, including registration verification rechecking archive status under the event lock.

- **Promoted:** Approved coordinator role, advisory skill-matching, manual reassignment, timed follow-up and registration-scope decisions into the canonical feature ledger with PR #105–#121 traceability and scoped behavior evidence. Broader family states remain partial.
- **Retired:** Removed the completed staffing design and implementation checklist; Git history retains them. The postponement panel is explicitly recorded as retrospective evidence, with interactive handling still open.
- **Verified:** Integrated staging contracts and read-model tests; shared contracts and touched API/portal behavior tests, monorepo typecheck and migration/invariant/clock/complexity/boundary gates passed. Browser acceptance and live delivery are not asserted.

## 2026-10-02

- **Clarified:** Event insight generation composes operations staffing facts with the event-lifecycle closure command at the API composition root; read-models remains read-only.
- **Clarified:** Coordinator reliability notes are owned by operations staffing and written through its public port by live operations. The architecture inventory now separates coordinator staffing records from event-day task and issue records.

## 2026-10-01

- **Clarified:** The local fixture seed checks every Prisma model before inserting fixtures but does not wrap all checks and writes in one transaction. The portal-account runbook now requires the API and other database writers to remain stopped while seeding.

## 2026-09-30

- **Retired:** Removed the broad sample runtime routes and service, API-client surface, and client browser fallback. Kept the existing development data as an explicit guarded local seed command; no API startup seed or reset endpoint remains. Moved payment-risk evaluation into the commercial scheduler, with an atomic conditional transition and audit write.

- **Updated:** The portal-account runbook and architecture invariants now describe explicit local fixture seeding, its disposable-database guard, and the absence of runtime fixture routes, browser-local state, startup seeding, and reset controls.
- **Recorded:** The maintainability delivery establishes capability modules behind stable shared-package exports, a role-neutral floorplan editor package, feature-owned portal data access, explicit consent evidence, and a compact paged PMCM command inbox capped at page 100 with selected-event detail loaded on demand. Authenticated identity comes from the stored bearer token; local development data remains seed-only.
- **Promoted and retired:** Moved lasting ownership, package, compatibility, and dashboard-read decisions into `AGENTS.md` and `docs/architecture/current-architecture.md`; removed the completed temporary specs and implementation plans. Git history retains those working artifacts.
- **Verified:** Full production build passed across all 10 Turborepo tasks; root typecheck passed all 15 tasks. The final build also confirmed the API client source resolves in all four Next portals.
- **Verified:** Full API suite passed (788 tests; 42 skipped; 133 test files passed and 15 skipped). Workspace tests passed: types 55, API client 28, client 56, event 140, supplier 24, guest 13, and floorplan canvas 5; the inbox controller regression test passed 3/3.
- **Verified:** Boundary scan passed for 1,217 files, boundary guard suite passed 53 tests, architecture lint and `git diff --check` passed. Final review reported no remaining actionable findings.

## 2026-09-29

- **Updated:** Added `@prism/floorplan-canvas` as the shared role-neutral editor module. Client and event retain template API adapters and choose their own read-only labels and workflow permissions; official-plan ownership stays in the event app.

- **Added:** Development efficiency report and focused behavior-testing guidance in `AGENTS.md` and the pull-request template.
- **Retired:** Removed the completed gateway working plan, architecture priority/risk matrix, superseded execution plans, dated catalog snapshots, and completed supplier-review working artifacts. Durable implementation and governance state remain in the living architecture, product, and runbook documents; Git history retains the retired working artifacts.

## 2026-09-28

- **Implemented:** Local AI routing now supports selecting the implemented Anthropic or OpenRouter adapter with AI_PROVIDER and selecting a model with AI_MODEL, AI_MODEL_FAST, or AI_MODEL_STRONG. In development, one provider key auto-selects that provider; two keys require an explicit selection, and no key preserves mock behavior. Synthetic fixture, provenance, and approval gates remain active; staging and production do not auto-select a provider. Updated the provider routing runbook. No tests or provider calls were run for this change.

- **Resolved:** The initial automatic review rejected the PARE orchestration rewrite before any core changes were applied. After the user's explicit approval, the fail-closed DAG correction was implemented and verified. Current code runs independent budget/risk roots, makes drafting depend on both, preserves approval compatibility, and remains synthetic-only. The earlier review note records the state before approval.
- **Verified:** Focused AI gateway/PARE tests passed (9 files, 104 passed, 2 skipped); shared schema tests passed (8/8); types/API typechecks and package builds passed. Both root-failure directions abort and await the sibling, the draft does not start early, and v1 linear/v0 pre-chain approvals remain covered. The scripted Anthropic adapter is not a live provider call; full external-route orchestration and the Task 6 staging measurement remain open.

- **Initial review context:** The first PARE DAG proposal received an automatic-review rejection before approval of the fail-closed correction. At that point the DAG change had not yet been applied; its implementation and remaining external gates are recorded in the entries above.
- **Implemented:** PARE event-context loading now overlaps its independent selected-quote and briefing queries while retaining each query's empty-value fallback. No runtime improvement is claimed before the planned staging measurement.
- **Verified:** Focused API tests passed (26/26) for EventContextAgent, PARE provenance, and the conforme-draft service; focused Event UI tests passed (7/7). The new EventContextAgent test observes both database reads starting before either resolves. This verifies scheduling behavior, not staging latency.
- **Updated:** Current OpenRouter evidence lists GLM 5.3 Flash on Fireworks and model-level tool-choice support. Request controls can pin Fireworks, disable fallback, require parameters, and require ZDR/data-collection denial; the exact Fireworks endpoint's ZDR and forced-tool support remain unverified. The GLM route remains synthetic-only and unselected; no inference was sent.
- **Implemented:** Added the temporary manual Space Bunny Alpha key smoke. It checks explicit zero pricing and required-tool support before a single synthetic forced-tool request pinned to `stealth` with provider fallbacks disabled; it never retries and suppresses credentials and response bodies. Its preflight refused the request because metadata omitted `pricing.request` and required-tool support. This key check does not qualify the planned GLM model or any product route. No alternate model was added to the route profiles; the planned GLM model remains unchanged.
- **Verified:** The key-smoke suite passed (8/8). Running the CLI with a known placeholder returned the placeholder error before network access; the mocked test confirmed zero fetches for missing/placeholder credentials. The approved live attempt received model metadata with zero prompt/completion prices and tool parameters, but no `pricing.request` and no advertised required-tool choice; the guard refused inference. No model inference request or route qualification occurred.
- **Implemented:** Completion-plan Task 5 PMCM draft behavior. The event app waits for gateway metadata before showing generation, withholds deltas until it reloads the validated saved draft, keeps cancellation locked until the aborted stream ends, and states that cancellation is terminal for that reminder window. Added UI/view-model coverage for manual writing, pending-draft editing, metadata progression, abort/retry behavior, plus an API regression proving a rejected window cannot be generated again.
- **Verified:** Task 5 event draft tests passed (11); API draft, reminder-claim, and atomic-window tests passed (23); API and event typechecks passed. The PMCM walkthrough then passed against the temporary local PGlite API with `PARE_MODE=mock`: the eligible accepted/unsigned inquiry generated a pending draft, its subject/body were editable, and the final-cancellation warning and approval gate were visible. A temporary UI-only edit was restored. The draft was not approved; the notification outbox remained empty. No provider call or delivery occurred. This fresh synthetic database is not an approved snapshot restore.
- **Implemented:** Completion-plan Task 3's fail-closed server-owned PARE provenance DAG. Budget and risk run concurrently from the unchanged root context; the message draft waits for both validated outputs and records both parent audit IDs and output digests. Each stage is bound to a registered root, correlation ID, prior-output digest, registered tool-result digests, and completed durable audit. Either root failure aborts and awaits the sibling, preventing drafting and PMCM review. Approval rechecks all three durable audits and the saved review-payload digest. PARE review content is stored on the approval record; the forward migration backfills existing sanitized reviews and scrubs draft text from aggregate audit JSON. Pre-chain pending approvals retain a marked legacy review path, new live PARE fails closed without a verifier, and the read-only invariant recomputes the review-payload digest from stored JSONB.
- **Verified:** Shared types build/typecheck and schema tests (8); API build/typecheck and focused PARE/gateway tests (83 passed, 2 skipped); Prisma validation and offline migration verification; migration guard (68 migrations); invariant dry-run and tests (17); boundary check (1,197 files) and boundary tests (52); `git diff --check`. The local scripted adapter tests exercise mock and the synthetic Anthropic route profile; they do not qualify a live provider. The primary checkout's remote database URL remained unused and no backup file was found in the worktree. At the user's request for a local target, a synthetic pre-migration PGlite snapshot was created from 65 checked-in migrations plus three fabricated AI audits and two pending approvals; a restored copy applied migrations `20260924100000`, `20260925090000`, and `20260928090000`. The legacy conforme draft was separated, blocked payload scrubbed, PARE review preserved on its approval, migration status reached 68/68, and the live invariant gate passed 7/7. The untouched snapshot reopened with the old schema and all three AI migrations pending, verifying the restore fallback. This completes Task 3's synthetic migration rehearsal only; it is not a staging/production data restore.
- **Found during Task 6 rehearsal:** The API-backed sample PGlite database has one 2026 billing-sequence invariant violation (6/7; no data changed). The initial live schema diff on the restored target reported timestamp type mismatches in `pare_dispatches`, `registration_platforms`, and `supplier_applications`; a missing `quotes.request_id` foreign key; and historical index/default differences. The checked-in DDL confirms the timestamp columns are `TIMESTAMPTZ(6)`, so 15 Prisma declarations were aligned and validation/offline verification/API typecheck passed. The restored target catalog confirms those types; a follow-up full Prisma diff returned `P1001` against PGlite and remains unverified. The initial sandboxed Prisma generation and Nest build hit Windows `EPERM` while replacing outputs. One elevated retry of `db:generate` and API `build` passed without source or configuration changes; no further retry was made. The synthetic quotes table has no request FK and zero rows; no checked-in migration creating the constraint was found, so no corrective migration was added pending schema-provenance and staging-data review. Historical index/default differences remain open.
- **Implemented:** Completion-plan Task 2 on `codex/ai-gateway-task2-provider-neutral`: route profiles support use-case overrides with tier fallback; startup rejects unknown explicit profiles/use cases; audit evidence records a SHA-256 route revision and provider-neutral policy outcome; PARE approval consumes that outcome rather than Anthropic identity or a provider-specific ZDR check. A fake second adapter proves configuration-only route switching for the same PARE use case. OpenRouter transport and conditional wiring are implemented; its later GLM profile remains unqualified and mock remains selected by default.
- **Decision:** Owner D declined real-data AI activation for the current plan, following the recommendation to keep production synthetic-only until provider privacy and staging gates are satisfied. Production `AI_LIVE_USE_CASES` remains empty. The separate decision record is `docs/roadmap/ai-provider-real-data-activation-decision.md`; this does not close Task 6 staging, Task 7 governance, or Task 9 live interchangeability.
- **Clarified:** Task 8's no-go decision branch is complete for this plan. Real-data activation remains incomplete and requires a new decision if Tasks 4, 6, and 7 later produce the needed route, privacy, staging, and review evidence.
- **Release sequence:** Once the plan is complete and reviewed, consolidate its approved PRs into release branch `trunk`, then open the PR to `staging`. No merge, push, or deployment was made in this worktree.
- **User clarification:** GLM 5.3 Flash with ZDR is the intended OpenRouter model. Added a selectable, synthetic-only GLM profile pinned to Fireworks. The adapter requires `zdr: true`, `data_collection: "deny"`, and no provider fallback. Mock remains default; no inference or tests were run for this profile. Endpoint/account privacy evidence, conformance, staging evaluation, and real-data eligibility remain open.
- **Removed:** The temporary Space Bunny CLI probe and its dedicated test file after the approved metadata preflight stopped before inference. No Space Bunny route was registered; its blocked preflight remains as historical qualification evidence.
- **Blocked:** A proposed commercial quote-request FK/index migration was rejected by automatic approval review because existing request IDs and the declared `ON DELETE SET NULL` behavior have not been approved against representative data. No migration or database change was made; Task 6 now records the exact approval and staging-snapshot gates.
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
- **Decided:** Accepted the seven-schema DDD target and local-only foreign-key rule, and aligned the context register to distinguish target owners from transitional writers; physical schema moves remain a separate rehearsed release.
- **Enforced:** added Commercial quote-request orphan preflight and a same-domain FK that preserves submitted bid evidence by restricting deletion of referenced requests.

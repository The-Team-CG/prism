# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- W21 live operations: persisted multi-day schedule days and ordered segments with planned/actual timestamps and variance, explicit Event Day System Operator designation, transactional audited handoffs with carried outstanding items, structured per-day EOD reports and PMCM replies, derived run-sheet composition, server-clock operational timers, and an explicit no-schedule state. External notification delivery remains queued under W11's provider gate.
- Trust remediation now resolves audit tails by full hash reachability, records forbidden-access audit failures as durable integrity incidents, queues security notifications through the idempotent notification outbox only for resolved PMCM addresses, and persists a durable email/IP password-reset limiter with reset request/consumption audit events.
- W18 staffing slice: persisted coordinator availability windows and event coverage requirements, transactional availability guards, deterministic required/assigned/acknowledged coverage, coordinator acknowledgement/decline and withdrawal history, PMCM replacement flow, and idempotent acknowledgement reminder outbox intent. Reminders remain queued with the existing explicit provider configuration reason when no delivery adapter is bound.
- Briefing submissions preserve prior history, reject locked or post-planning events, and persist audit/notification intent atomically with the verified actor.
- Historical audit verification follows hash links, including same-millisecond records; ambiguous historical tails stop new appends for integrity review.
- Native password recovery contracts and single-use 15-minute hashed reset tokens with durable session-version revocation; reset delivery remains explicitly unavailable until a trusted provider is configured.
- Serialized audit appends with a transactional global lock and monotonic timestamps; audit exports record the verified actor, and unavailable device/IP metadata is explicitly unknown.
- Notification worker lifecycle scheduling when an adapter is bound, bounded provider waits, and sent-only acknowledgement; PMCM activity distinguishes provider acceptance from recipient delivery.
- Durable notification idempotency, bounded worker claims, retry backoff and provider receipt storage; absent provider configuration keeps delivery queued with an explicit reason instead of fabricating sent status.
- Additive P1 persistence for actual event end and actor, application-to-supplier conversion binding, reliability-note attribution/idempotency, and durable supplier promotion history.
- P1 execution plan covering all 24 catalog work packages, independent agent ownership, acceptance evidence and concrete blocker reporting.
- P0 correctness readiness report with effort, priority, risk, PostgreSQL/HTTP acceptance evidence and explicit remaining catalog blockers; accepted event authority, feedback-window and client-category policy.
- Coordinator portal task and urgent-issue logging with role-safe actor attribution and per-flow failure handling (EP-11-S02).
- Client primary-contact proposal approve/request-revision (cap 3) on the client proposal tab, PMCM archived-event search by venue/type/month, plus PMCM supplier-applications inbox (request proposal, schedule, decline), same-role coordinator suggestions on double-book blocks, client remaining-balance billing copy, and supplier-category gap hard-block copy on the readiness board.
- PMCM closure review prompts for confirmed supplier assignments, with category dimensions, private notes, shared Zod validation, and retry-safe success handling through the existing audit/idempotency path.
- P0/P1 catalog thin slices: public inquiry copy-link + prefill, onboarding invitation evidence, Command Inbox on PMCM home, labeled client action-center fallback, role file-requirements matrices, PMCM supplier readiness board, client-safe billing coverage, and privacy/close-gate evidence tests.
- A production cyclomatic-complexity gate (`check:complexity`, max 10) with unit tests wired into `test:boundaries`.
- Shared Zod write contracts for PMCM registration-platform create/update and post-event headcount import.
- Prisma migration for `guest_ops.registration_platforms` (EP-13-S05).
- W19 guest operations: PMCM-authoritative walk-in policy (`closed`, `open`, `threshold`) with transactional enforcement and audit history; structured, idempotent roster import/reconciliation with provenance and W10 raw-file gating; event-scoped registration search, verification and roster-linked check-in; PMCM/client policy surfaces.
- Centralized CI/CD (staging trunk, main prod), Sonar, Vercel deploy path, Dependabot, security scans
- The frontend/backend architecture-alignment report, Prisma persistence ownership register, and ADR-0006 for focused ports and composition-root adapters.
- A second sample event (`evt_sample_unassigned`) with no coordinator assignment so unassigned-event checks can run.

### Changed
- Reconciled the complete catalog review and effort/priority/risk matrix against the P0 implementation, separating completed corrections, satisfied policy prerequisites and remaining catalog gaps.
- Corrected the P0 verification report with the reproduced supplier-ownership fixture boundary failure (V01); retained it as an open review gate without changing application source.
- Client floorplan copy now separates official read-only plans from layout preferences. Guest check-in no longer implies camera QR. Event file hub Share/Download/upload stay visibly gated.
- Capped every production TypeScript/TSX function at McCabe complexity ≤ 10 (route tables, extracted section views, collectors, and shared floorplan canvas helpers).
- Split remaining client-portal production functions (overview, home, proposal, approvals, inquiry, floorplan) so each stays at McCabe complexity ≤ 10, without changing portal behavior.
- Split the duplicated client and event floorplan editors so each production function stays at McCabe complexity ≤ 10, without changing editor behavior.
- Restructured the documentation into an OKF-style bundle with semantic architecture, product, roadmap, runbook, and reference indexes.
- Made the supplier application wizard viewport-fit: the form card now grows to fill wide monitors (up to 1320px, matching the supplier landing), stays centered, and the wizard fits one screen with internally scrollable step content instead of the fixed 944px/1060px layout.
- Added the constitution and six architecture decision records for role-app boundaries, shared contracts, DDD contexts, cross-context seams, Next route/MVVM structure, and focused ports.
- Promoted durable FE/BE findings into the architecture ADRs and priority/risk matrix, reduced `CLAUDE.md` to a pointer, and removed completed plans, redundant review/backlog documents, and duplicate documentation pointers.
- Documented the delivery rule that every user-requested change updates this changelog, with documentation-bundle changes also recorded in `docs/log.md`.
- Corrected the active redesign/readiness inventory to match route-owned event composition and the flattened API source tree.
- Refactored the event dashboard into route-owned composition with focused navigation/workspace ViewModels, canonical PMCM selectors, and compatibility-preserving event filter routes.
- Hardened backend context seams with bounded floorplan queries, kernel-owned audit writing, focused cross-context ports, shared Zod writes, and verified live-ops actors.
- Documented and chained the local bootstrap path (types build, Prisma generate, Next `.next/dev` cleanup, portal port guards) and pinned Node 24 to match CI.
- Recorded the PR review rule that second-owner sign-off must appear on the GitHub reviews array.
- Split remaining API production functions above McCabe 10 into collectors, lookup tables, and field-mapping helpers so the cyclomatic-complexity gate can cover `apps/api`.
- Split remaining client, supplier, guest, and shared-package production functions above McCabe 10 into section components, lookup tables, and early-return helpers without changing behavior.
- Split remaining event-portal production functions above McCabe 10 into presentational section views and lookup-table helpers, without changing user-visible behavior.

### Removed
- The obsolete event dashboard `features/event-ops` facade, duplicate event filter route folders, and superseded API DTO files were removed after their behavior was covered by focused tests.
- The guest direct-access `/info/[accessCode]` page and its `features/guest-event/info` module were removed in favor of the authenticated `/dashboard` guest UI.
- Removed `.github/CODEOWNERS`; GitHub Free cannot enforce it on this private repository.

### Fixed
- Moved the cross-context supplier ownership database fixture into the API integration-test directory and registered test discovery, preserving the production read-model mutation boundary (V01).
- Removed fabricated approved billing at signed-conforme intake and reconciled client partial-payment totals.
- Made proposal decisions, staffing conflicts, supplier transitions/review retries, archive effects and supported privacy redaction enforce identity, lifecycle and transactional integrity.
- Required verified sessions and authoritative role/event ownership on sensitive routes, including commercial, briefing, files, trust, compliance and raw layout inventory; blocked live AI before external calls.
- Coordinator acknowledge refresh no longer clears an already-loaded role-safe desk on failure (PA-294).
- Client approvals rules import model helpers directly instead of the workspace barrel, so `test:coverage` no longer pulls views/`prism-api` into the 50% CI gate.
- Registration-platform mutations now require a verified PMCM session, stamp setup confirmation on `live`, and allow headcount import only after the platform is closed.
- Supplier apply no longer submits fallback category IDs when the live category list is empty or offline.
- Pointed `smoke:ui` source guards at the split coordinator and guest section views.
- Nest composition roots import sibling `*Module` classes from module files instead of package barrels so the API can boot across circular context graphs.
- Pinned `fast-uri` to `3.1.7` and extended the Prisma `mysql2` audit exception to `GHSA-rgwj-5xj2-c3m3` so CI can pass newly published high advisories.
- Added focused route, sidebar, loading-copy, compatibility-path, and selector coverage so the event workspace satisfies the repository's branch-coverage gate.
- Portal `dev`/`start` now clear a stale listener on the app port so `next start` cannot fail to bind while an old build keeps serving 200s.
- Documented a CI audit exception for Prisma's unused MySQL client (`mysql2` GHSA-3f6p-5ww8-9rcr) until Prisma ships a patched pin.


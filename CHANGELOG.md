# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- P0/P1 catalog thin slices: public inquiry copy-link + prefill, onboarding invitation evidence, Command Inbox on PMCM home, labeled client action-center fallback, role file-requirements matrices, PMCM supplier readiness board, client-safe billing coverage, and privacy/close-gate evidence tests.
- A production cyclomatic-complexity gate (`check:complexity`, max 10) with unit tests wired into `test:boundaries`.
- Centralized CI/CD (staging trunk, main prod), Sonar, Vercel deploy path, Dependabot, security scans
- The frontend/backend architecture-alignment report, Prisma persistence ownership register, and ADR-0006 for focused ports and composition-root adapters.
- A second sample event (`evt_sample_unassigned`) with no coordinator assignment so unassigned-event checks can run.

### Changed
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
- Coordinator acknowledge refresh no longer clears an already-loaded role-safe desk on failure (PA-294).
- Client approvals rules import model helpers directly instead of the workspace barrel, so `test:coverage` no longer pulls views/`prism-api` into the 50% CI gate.
- Pointed `smoke:ui` source guards at the split coordinator and guest section views.
- Nest composition roots import sibling `*Module` classes from module files instead of package barrels so the API can boot across circular context graphs.
- Pinned `fast-uri` to `3.1.7` and extended the Prisma `mysql2` audit exception to `GHSA-rgwj-5xj2-c3m3` so CI can pass newly published high advisories.
- Added focused route, sidebar, loading-copy, compatibility-path, and selector coverage so the event workspace satisfies the repository's branch-coverage gate.
- Portal `dev`/`start` now clear a stale listener on the app port so `next start` cannot fail to bind while an old build keeps serving 200s.
- Documented a CI audit exception for Prisma's unused MySQL client (`mysql2` GHSA-3f6p-5ww8-9rcr) until Prisma ships a patched pin.


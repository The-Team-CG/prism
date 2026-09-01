# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Centralized CI/CD (staging trunk, main prod), Sonar, Vercel deploy path, Dependabot, security scans
- The frontend/backend architecture-alignment report, Prisma persistence ownership register, and ADR-0006 for focused ports and composition-root adapters.

### Changed
- Restructured the documentation into an OKF-style bundle with semantic architecture, product, roadmap, runbook, and reference indexes.
- Added the constitution and six architecture decision records for role-app boundaries, shared contracts, DDD contexts, cross-context seams, Next route/MVVM structure, and focused ports.
- Promoted durable FE/BE findings into the architecture ADRs and priority/risk matrix, reduced `CLAUDE.md` to a pointer, and removed completed plans, redundant review/backlog documents, and duplicate documentation pointers.
- Documented the delivery rule that every user-requested change updates this changelog, with documentation-bundle changes also recorded in `docs/log.md`.
- Corrected the active redesign/readiness inventory to match route-owned event composition and the flattened API source tree.
- Refactored the event dashboard into route-owned composition with focused navigation/workspace ViewModels, canonical PMCM selectors, and compatibility-preserving event filter routes.
- Hardened backend context seams with bounded floorplan queries, kernel-owned audit writing, focused cross-context ports, shared Zod writes, and verified live-ops actors.

### Removed
- The obsolete event dashboard `features/event-ops` facade, duplicate event filter route folders, and superseded API DTO files were removed after their behavior was covered by focused tests.

### Fixed
- Added focused route, sidebar, loading-copy, compatibility-path, and selector coverage so the event workspace satisfies the repository's branch-coverage gate.


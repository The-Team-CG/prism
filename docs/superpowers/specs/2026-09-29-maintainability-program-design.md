# Prism Maintainability Refactor Program

**Status:** Proposed sequence for review
**Date:** 2026-09-29
**Base:** staging at 944f8e90

This program converts the repository assessment into separate, independently testable projects. Each project gets its own implementation plan and behavior checks. No application or API code has been changed in this design commit.

## Sequence

1. CI boundary gate: run the existing static boundary check and its tests in PR CI.
2. Shared contract and API-client modules: split large source files behind their current public package entrypoints.
3. Shared floorplan canvas: consolidate only role-neutral mechanics; keep data ownership and authorization in the client and event apps.
4. Thin portal data access: move normal feature paths to scoped feature-owned data adapters and retain compatibility behind /sample/*.
5. Hardcoded inputs and consent evidence: centralize the shared notice version, remove sample credentials from app code, and record consent only with actual evidence.
6. PMCM dashboard read model: return summary and paged actionable queue data; load selected-event detail on demand.

The order limits each project to a reviewable boundary. Package contracts precede portal migrations. The dashboard work follows the package and portal access changes so it can reuse the scoped contracts and feature data paths.

## Shared constraints

- Preserve the role apps and their ownership. PMCM remains the only owner of official floorplan authoring; the client remains read-only for approved official plans.
- Shared writes use Zod schemas and inferred types from @prism/types. API reads across contexts stay in modules/read-models.
- Keep /sample/* as a demo/compatibility surface. Do not remove seed/reset or local fixture paths without separate retirement evidence.
- Preserve product rules and legal notice wording. Do not infer consent or turn every named rule into environment configuration.
- Prefer observable behavior, role-boundary, pagination, and data-access tests. Do not add tests that only assert an implementation detail or line count.
- Add a Changelog entry for each delivered project and update canonical architecture docs when a durable package or ownership boundary changes.
- Work is local on codex/repo-maintainability until publication is explicitly requested.

## Project specs

- [CI boundary gate](2026-09-29-ci-boundary-gate-design.md)
- [Contract and API-client module boundaries](2026-09-29-contract-client-module-boundaries-design.md)
- [Shared floorplan canvas](2026-09-29-shared-floorplan-canvas-design.md)
- [Thin portal data access](2026-09-29-portal-data-access-design.md)
- [Hardcoded inputs and consent evidence](2026-09-29-hardcoded-inputs-and-consent-design.md)
- [PMCM dashboard read model](2026-09-29-pmcm-dashboard-read-model-design.md)


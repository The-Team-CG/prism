# PMCM Dashboard Read Model Design

**Status:** Proposed for implementation
**Date:** 2026-09-29
**Base:** staging at 944f8e90
**Owner:** D (Anthony), with B (Francis) for PMCM workflow acceptance

## Problem

The PMCM dashboard read model currently composes many broad collections, each bounded by fixed take caps (often 500), into a single wide PrismPmcmDashboardWorkspace. This increases database work and response size before the dashboard's active queue needs those records, while caps can silently truncate results.

## Goal

Make the PMCM command inbox return the summary and current actionable page needed for the first screen, and load selected-event detail through the existing event-scoped read model when the user selects an event.

## Design

Use or evolve the existing PMCM command-inbox and selected-event workspace contracts instead of introducing a new generic dashboard aggregate. Keep cross-context reads in modules/read-models, with owning context public readers and session-derived access scope.

The first dashboard response should contain aggregate counts and a deterministically ordered, bounded page of actionable queue items. Use cursor or page metadata for additional queue items; use count queries for totals instead of fetching rows to count them. Selected-event panels fetch their detail through the selected-event workspace path on demand. Keep the old broad dashboard shape only as a compatibility adapter while all UI call sites migrate, then remove it from normal dashboard loading.

Do not simply lower the existing take constants. Pagination must make truncation explicit and the UI must be able to reach every authorized record. Keep the client, supplier, coordinator, and guest read models unchanged unless evidence shows a direct dependency.

## Alternatives considered

- Lower every fixed cap: rejected because this still truncates results without a user-visible continuation path.
- Page every collection in the broad aggregate: rejected because the initial dashboard still reads unrelated data.
- Use the existing command inbox and event-scoped workspace, adding paged queue reads only where needed: selected; it matches the route and capability boundaries already present.

## Acceptance

- Initial PMCM dashboard returns only summary fields and its actionable queue page.
- Every pageable queue reports continuation metadata and supports stable ordering without silent truncation.
- Selecting an event loads only that event's workspace.
- Forbidden-role and event-scope checks remain covered by behavior tests.
- Synthetic fixtures demonstrate the dashboard contract and bounded response independent of live database availability.
- A repeatable local measurement compares query count and response size before and after; no improvement claim is made without measured evidence.
- Changelog records the contract and dashboard behavior changes.


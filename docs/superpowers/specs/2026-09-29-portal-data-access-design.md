# Thin Portal Data Access Design

**Status:** Proposed for implementation
**Date:** 2026-09-29
**Base:** staging at 944f8e90
**Owners:** C (Ethan) for client portal; B (Francis) for PMCM; D (Anthony) for API and contracts

## Problem

The client and event lib/prism-api.ts files combine role data access, compatibility state, local sample behavior, and domain mapping in files near one thousand lines. The normal feature data path is intended to use scoped API-client methods, but broad sample-state and legacy facade paths remain.

## Goal

Make each feature's data dependency visible at its data boundary, keep ordinary portal workflows on scoped endpoints, and retain sample behavior only for supported local/demo compatibility.

## Design

Migrate normal client and event feature reads and writes to feature-owned data adapters using @prism/api-client and @prism/types. Keep apps/client and apps/event lib/prism-api.ts thin during migration, with only role-specific client construction and narrow helpers; remove legacy facade functions only after all callers have moved.

Inventory active callers of broad sample-state reads. Migrate normal features to existing scoped endpoints where available. If a required workflow has no scoped API, add a focused read model or write capability in its owning API context, define any shared body contract in @prism/types, and add the matching @prism/api-client helper before wiring the portal. Keep cross-context reads in read-models and keep HTTP out of pages, views, and view-models.

Do not add normal feature dependencies on /api/sample/state. Preserve existing /sample/* routes, seed/reset behavior, and local demo fixtures until independent retirement criteria are met. A legacy compatibility adapter may temporarily bridge to existing code while a caller migrates; it should be removed after the final active consumer is gone.

## Alternatives considered

- Delete sample compatibility immediately: rejected because current demo and seed/reset flows are explicitly supported.
- Migrate each feature to a scoped adapter and keep compatibility behind /sample/*: selected; this removes normal-path coupling without breaking demo support.
- Replace the role facades with one new shared app-wide facade: rejected because it recreates the same centralization problem.

## Acceptance

- Every active normal portal read and write has a feature-owned data adapter.
- Normal feature paths do not depend on broad sample-state reads.
- Existing /sample/* contracts remain available for supported demo and compatibility workflows.
- Any new cross-context read is composed in read-models; any new shared write uses a Zod schema in @prism/types.
- Touched role features pass typecheck and observable behavior tests; boundary checks pass.
- Changelog records the access-boundary change.


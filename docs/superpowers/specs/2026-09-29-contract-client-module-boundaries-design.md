# Shared Contract and API Client Module Boundaries Design

**Status:** Proposed for implementation
**Date:** 2026-09-29
**Base:** staging at 944f8e90
**Owner:** D (Anthony)

## Problem

The shared read and write contracts are collected in a very large event-ops file, and the API client is collected in one large event-ops client file. Consumers commonly import from package roots, which encourages broad files to keep accumulating and makes ownership and change impact harder to see.

## Goal

Organize shared types and transport code by capability while preserving the current public package entrypoints during migration.

## Design

Split packages/types/src/event-ops.ts into focused capability modules, then re-export the public domain interfaces from the existing package root. Keep every shared write contract as a Zod schema in @prism/types with its inferred input type. Keep read models as shared interfaces unless a boundary needs runtime validation. Do not create app-local duplicates.

Split packages/api-client/src/event-ops-client.ts into transport helpers and capability clients. Keep the existing public createEventOpsClient composition during the transition so role apps can migrate feature data adapters independently. Package consumers should continue using documented root or focused package exports. Views and view-models must not call HTTP directly.

Preserve runtime routes, request shapes, auth-token behavior, and error mapping in this structural project. Any request-shape or behavior change belongs in the owning API surface project and its own behavior tests.

## Alternatives considered

- Keep both files intact and add comments: rejected because it does not reduce the change surface.
- Split modules behind stable package exports: selected; this lowers source-file coupling without forcing app migrations in the same change.
- Generate DTOs and API clients from OpenAPI: rejected because the repository has no OpenAPI/Kubb pipeline and generation is outside the requested scope.

## Acceptance

- Public imports compile without consumer changes in the extraction step.
- Package tests, build, and typecheck pass after rebuilding @prism/types.
- No new schema or shared DTO is defined outside @prism/types.
- No new app-facing API facade grows to replace the split files.
- Changelog records the source-organization change.


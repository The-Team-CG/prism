# Shared Floorplan Canvas Design

**Status:** Proposed for implementation
**Date:** 2026-09-29
**Base:** staging at 944f8e90
**Owners:** A (Maxine) for UX; D (Anthony) for package boundary; B (Francis) and C (Ethan) for role workflows

## Problem

The client and event apps each contain 24 floorplan editor files. Twenty-one files are byte-identical; EditorShell, Canvas, and TopBar differ. Keeping two copies causes mechanical fixes and interaction behavior to drift. At the same time, the apps have different authority: PMCM owns official plans and clients can submit preferences and view approved official plans read-only.

## Goal

Share the role-neutral canvas mechanics while keeping workflow, persistence, and authorization in the owning apps.

## Design

Extract reusable geometry, pointer, drawing, layer, asset, and editor-state mechanics behind a focused @prism/floorplan-canvas package boundary. It must not import either portal, read session or role data, call an API, or own draft approval/persistence. Shared inputs and outputs use existing @prism/types contracts where they represent cross-app domain data; canvas-only mechanics remain package-local. Reuse existing workspace dependencies; add no new external package.

Keep event and client data adapters, use-cases, read-only policy, official-plan ownership, and role-specific shell/top-bar composition in their current apps. Use small role-specific wrappers around the shared canvas interface for the three differing files. The shared engine must support a read-only mode, but only the owning portal decides when that mode applies.

## Alternatives considered

- Put the full editor in @prism/ui: rejected because the editor store and scene mechanics are a specialized capability, not general shell or presentation chrome.
- Create a focused canvas package with no workflow or role rules: selected; the dependency direction stays one-way from role apps to shared mechanics.
- Keep the two copies: rejected because 21 files already have identical behavior and will continue to drift.

## Acceptance

- Each exact duplicate is classified as either shared after confirming it carries no role rules or ownership, or intentionally retained with a documented reason. Shared visual and canvas mechanics have one implementation.
- Event and client editor entrypoints retain their current role behavior and data ownership.
- Client users cannot edit official layouts; PMCM can still author them.
- Observable tests cover core drawing/selection, keyboard or pointer edits, undo/redo, and read-only behavior.
- Package typecheck/build and both portal typechecks pass; boundary checks permit only the new public package import.
- The package has a focused workspace export; AGENTS.md, the boundary checker, and current-architecture.md document its narrow role and import direction.
- Changelog records the extraction.


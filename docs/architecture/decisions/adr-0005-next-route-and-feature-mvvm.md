---
type: "Decision"
title: "Next route and feature MVVM architecture"
description: "Keep Next.js App Router routes thin, preserve URLs during organization, and place screen behavior in progressive feature slices."
tags: [architecture, decision, frontend, nextjs, mvvm, routes]
status: canonical
updated: "2026-10-28"
authority: normative
audience: [agents, frontend-engineers, product-reviewers]
scope: "apps/client, apps/supplier, apps/guest, and apps/event App Router code"
last_verified: "581e676"
decision_date: "2026-09-01"
sources:
  - id: agent-rules
    resource: "AGENTS.md"
    title: "Prism frontend rules"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current frontend architecture"
  - id: portal-apps
    resource: "apps"
    title: "Prism portal applications"
  - id: feature-slices
    resource: "apps/event/src/features"
    title: "Existing frontend feature slices"
---
# ADR-0005: Next route and feature MVVM architecture

## At a glance

- **Decision:** Keep App Router routes thin and organize screen behavior as View → ViewModel → use-case → data.
- **Applies to:** Top-level app folders, route groups, feature slices, URL preservation, and screen layering.
- **Use when:** Adding a screen, moving a route, introducing a dynamic segment, or extracting a dashboard section.
- **Change when:** URL ownership, actor scope, or presentation/orchestration boundaries change.
- **Verify with:** Touched portal checks, route inventories, URL compatibility evidence, and feature-boundary checks.

**Decision status:** Accepted
**Scope:** Next.js App Router organization, route ownership, and frontend
feature layering

## Context

The portals already keep most HTTP and state orchestration outside route pages,
but the top-level `app/` trees do not consistently express authentication,
portal, and section intent. The event app also has route shims and a large
pathname-driven shell. Moving folders alone can break deep links, so structure
and URL compatibility must be separate concerns.

## Decision

New and incrementally migrated screens follow this dependency direction:

```text
app route page -> View -> ViewModel -> use-case -> data -> @prism/api-client
```

- `page.tsx` composes the route and renders the owning feature view; it does not
  contain HTTP calls or business rules.
- Views render state and commands supplied by a view-model; they do not own
  transport or policy.
- View-models coordinate screen state and user-safe status/error values; they do
  not become HTTP repositories or cross-feature god objects.
- Use cases express screen actions, and `data/` owns I/O through the shared
  client or a thin portal adapter.
- Feature slices live under `src/features/<domain>/<action>/` with only the
  layers the action actually needs. Public feature barrels are preferred over
  deep sibling imports.
- Invisible route groups such as `(auth)` and `(portal)` express layout and
  access intent without changing the URL.
- A dynamic segment such as `[filter]` or query state is adopted only after
  existing literal URLs and deep links are proven equivalent.
- Existing URLs, actor boundaries, loading/error/empty states, and visible
  behavior are preserved during structural migration.

The event dashboard route family is the first completed application of this
decision: App Router pages now pass explicit route state and compose the
owning section view as children of the shared shell runtime. The former
pathname-driven section dispatcher is gone, event-list filter URLs resolve
through one dynamic `[eventSlug]` compatibility entry, and shared PMCM
selectors live in `features/pmcm-kit/model`. The remaining portal-wide route
group migration remains separate follow-up work and is not implied by this
dashboard slice.

## Rejected alternatives

- HTTP calls in `page.tsx`, views, or view-models were rejected because they
  make presentation and orchestration hard to test and reuse.
- A single dashboard shell acting as a hidden router was rejected as the long-
  term ownership model; real route pages should own real feature views.
- A big-bang move of every portal was rejected; one route family/vertical per
  independently verified change reduces URL and permission risk.
- Cross-portal feature imports were rejected; share contracts and domain-free UI
  primitives through packages instead.

## Consequences

- Top-level app folders can become legible without changing public URLs.
- Route groups and feature slices make layout, actor ownership, and data flow
  easier to review.
- Migration requires route inventories, old/new URL checks, and manual role-path
  evidence; folder moves are not automatically safe.
- Some existing compatibility facades can remain temporarily, but new consumers
  should use feature-local `data/` adapters.
- The event dashboard retains one page-level coordinator ViewModel because its
  shell must coordinate session, selected-event workspace, navigation, and
  commands; loading, navigation, route composition, and selectors are split
  into focused seams rather than hidden behind pathname inspection.

## Verification

For a route-organization change, run the touched portal typecheck/build,
feature-boundary checks, before/after route inventory comparison, and the
affected sign-in or public flow. Confirm that pages/views/view-models contain
no direct HTTP calls and that role-forbidden data remains inaccessible.

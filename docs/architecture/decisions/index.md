# Architecture decisions

* [ADR-0001: Role-app boundaries](adr-0001-role-app-boundaries.md) - separate role applications and forbidden ownership.
* [ADR-0002: Shared contracts and sample compatibility](adr-0002-shared-contracts-and-sample-compatibility.md) - Zod contracts and API transport; sample-runtime policy superseded by ADR-0007.
* [ADR-0003: DDD-shaped modular monolith contexts](adr-0003-ddd-modular-monolith-contexts.md) - bounded contexts, kernel, and one deployable.
* [ADR-0004: Cross-context seams and read models](adr-0004-cross-context-seams-and-read-models.md) - public indices, focused ports, and read-only composition.
* [ADR-0005: Next route and feature MVVM architecture](adr-0005-next-route-and-feature-mvvm.md) - thin routes, route groups, URL preservation, and feature slices.
* [ADR-0006: Focused ports and composition-root adapters](adr-0006-focused-ports-and-composition-roots.md) - extraction-ready dependency inversion without premature services.
* [ADR-0007: Retire the broad sample runtime; keep local fixture seeding](adr-0007-retire-sample-runtime-keep-local-fixture-seeding.md) - remove aggregate routes and browser-local demo state; preserve a guarded seed-only development path.
* [ADR-0008: One PostgreSQL schema per owning domain](adr-0008-domain-owned-postgres-schemas.md) - one write owner and target schema per domain; same-domain foreign keys are allowed, cross-domain foreign keys are not.
* [ADR-0009: Privacy legal-hold scope and authority](adr-0009-privacy-legal-hold-scope-and-authority.md) - subject/event scope, PMCM-admin control, fail-closed redaction, and retained release evidence.
* [ADR-0010: Floor plan editor on Pascal](adr-0010-floorplan-editor-on-pascal.md) - pinned Pascal packages, the `prism:event-layout` plugin, scenes stored through the API, and no browser source of truth.
* [ADR-0011: Shared route contracts](adr-0011-shared-route-contracts.md) - each route written once in `@prism/types`, mounted by the API, called by role clients, with every response parsed.

ADR status is current unless an accepted successor explicitly supersedes the
record. Each record includes its source paths and verification commands.

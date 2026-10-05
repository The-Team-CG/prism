# Architecture decisions

* [ADR-0001: Role-app boundaries](adr-0001-role-app-boundaries.md) - separate role applications and forbidden ownership.
* [ADR-0002: Shared contracts and sample compatibility](adr-0002-shared-contracts-and-sample-compatibility.md) - Zod contracts and API transport; sample-runtime policy superseded by ADR-0007.
* [ADR-0003: DDD-shaped modular monolith contexts](adr-0003-ddd-modular-monolith-contexts.md) - bounded contexts, kernel, and one deployable.
* [ADR-0004: Cross-context seams and read models](adr-0004-cross-context-seams-and-read-models.md) - public indices, focused ports, and read-only composition.
* [ADR-0005: Next route and feature MVVM architecture](adr-0005-next-route-and-feature-mvvm.md) - thin routes, route groups, URL preservation, and feature slices.
* [ADR-0006: Focused ports and composition-root adapters](adr-0006-focused-ports-and-composition-roots.md) - extraction-ready dependency inversion without premature services.
* [ADR-0007: Retire the broad sample runtime; keep local fixture seeding](adr-0007-retire-sample-runtime-keep-local-fixture-seeding.md) - remove aggregate routes and browser-local demo state; preserve a guarded seed-only development path.
* [ADR-0008: One PostgreSQL schema per owning domain](adr-0008-domain-owned-postgres-schemas.md) - one table owner per write domain, one target schema per domain, and no cross-domain foreign keys.

ADR status is current unless an accepted successor explicitly supersedes the
record. Each record includes its source paths and verification commands.

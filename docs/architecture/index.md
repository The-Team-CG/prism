# Architecture

* [Current architecture](current-architecture.md) - current runtime topology, role apps, packages, backend contexts, kernel, and compatibility boundary.
* [Domain glossary](../../GLOSSARY.md) - shared language for domain ownership and cross-context seams.
* [Context contracts](context-contracts.md) - supported in-process seams, focused ports, and read-model direction.
* [Persistence ownership](persistence-ownership.md) - table owners, current and target schemas, intentional joins, and extraction notes.
* [Domain schema map](domain-schema-map.md) - before-and-after PostgreSQL schema layout, table movement totals, owner-local constraints, and the database deployment boundary.
* [External-reference lifecycle](external-reference-lifecycle.md) - current versus historical identifiers, former FK delete effects, owner validation, failures, and recovery.
* [Column authority register](column-authority-register.md) - per-column baseline facts, owner assignments, consumer candidates, sensitivity and migration dispositions.
* [Architecture decisions](decisions/) - accepted decisions that govern future changes.

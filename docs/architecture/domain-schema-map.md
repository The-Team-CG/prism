---
type: "Architecture Map"
title: "P.R.I.S.M domain schema map"
description: "Before-and-after view of the database namespace cutover to one schema per write domain."
tags: [architecture, database, postgres, ddd, schema, migration]
status: canonical
updated: "2026-10-06"
authority: normative
owner: "D (Anthony)"
audience: [engineers, reviewers, operators, agents]
scope: "PostgreSQL application schemas, model ownership, and domain foreign-key policy"
last_verified: "domain-ownership manifest plus populated synthetic PostgreSQL replay on local s11-cutover, 2026-10-06"
sources:
  - id: ownership-manifest
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Per-model owner and schema manifest"
  - id: migration
    resource: "apps/api/prisma/migrations/20261006000000_platform-ops_domain_schema_cutover/migration.sql"
    title: "Coordinated domain schema cutover"
  - id: persistence-register
    resource: "docs/architecture/persistence-ownership.md"
    title: "Persistence ownership register"
  - id: cutover-runbook
    resource: "docs/runbooks/domain-schema-cutover.md"
    title: "Cutover rehearsal and recovery gates"
---
# P.R.I.S.M domain schema map

## At a glance

The current staging layout uses ten application schemas for 93 business
tables. Several schemas mix owners, and some of those tables have foreign keys
across domains. The target puts every business table in its owning context's
schema. Same-domain foreign keys remain valid; cross-domain identifiers remain
scalar references checked through owner capabilities where a command needs
live state.

The target remains one PostgreSQL database, one Prisma client, and one API
deployment. Schema ownership is not a service boundary or a database
authorization boundary. `public._prisma_migrations` is excluded from the
business-table counts below.

## Before: current staging namespace

The labels show physical schema, total table count, and owner split. Arrows
show where each owner slice belongs in the target. Mixed legacy schemas split
across owner schemas.

```mermaid
flowchart LR
  subgraph Before["Before: staging physical schemas"]
    c_ops["compliance_ops<br/>8 tables<br/>event-lifecycle"]
    e_core["event_core<br/>11 tables<br/>10 event-lifecycle<br/>1 platform-ops"]
    f_ops["finance_ops<br/>11 tables<br/>commercial"]
    f_plan["floorplan<br/>7 tables<br/>floorplan"]
    g_ops["guest_ops<br/>6 tables<br/>operations"]
    ident["identity<br/>6 tables<br/>4 identity-access<br/>2 platform-ops"]
    p_ops["platform_ops (legacy)<br/>3 tables<br/>platform-ops"]
    staff["staffing_ops<br/>16 tables<br/>6 operations<br/>10 live-ops"]
    s_ops["supplier_ops<br/>17 tables<br/>commercial"]
    trust["trust_ops<br/>8 tables<br/>platform-ops"]
  end

  subgraph After["After: one schema per write domain"]
    lifecycle["event_lifecycle<br/>18 tables"]
    commercial["commercial<br/>28 tables"]
    operations["operations<br/>12 tables"]
    floorplan["floorplan<br/>7 tables"]
    liveops["live_ops<br/>10 tables"]
    identityaccess["identity_access<br/>4 tables"]
    platform["platform_ops<br/>14 tables"]
  end

  c_ops -->|8| lifecycle
  e_core -->|10| lifecycle
  e_core -->|1| platform
  f_ops -->|11| commercial
  f_plan -->|7 remain| floorplan
  g_ops -->|6| operations
  ident -->|4| identityaccess
  ident -->|2| platform
  p_ops -->|3 remain| platform
  staff -->|6| operations
  staff -->|10| liveops
  s_ops -->|17| commercial
  trust -->|8| platform
```

| Current physical schema | Tables | Owning domain(s) |
| --- | ---: | --- |
| `compliance_ops` | 8 | event-lifecycle |
| `event_core` | 11 | event-lifecycle (10), platform-ops (1) |
| `finance_ops` | 11 | commercial |
| `floorplan` | 7 | floorplan |
| `guest_ops` | 6 | operations |
| `identity` | 6 | identity-access (4), platform-ops (2) |
| `platform_ops` | 3 | platform-ops |
| `staffing_ops` | 16 | operations (6), live-ops (10) |
| `supplier_ops` | 17 | commercial |
| `trust_ops` | 8 | platform-ops |
| **Total** | **93** | **7 write domains** |

## After: target owner schemas

The cutover moves 83 tables and leaves ten already in their target schema. It
drops 45 cross-domain foreign keys and retains the 68 same-domain foreign
keys. No cross-domain Prisma relation or PostgreSQL foreign key remains in the
target.

| Write domain | Target schema | Tables | Columns |
| --- | --- | ---: | ---: |
| event-lifecycle | `event_lifecycle` | 18 | 280 |
| commercial | `commercial` | 28 | 319 |
| operations | `operations` | 12 | 142 |
| live-ops | `live_ops` | 10 | 122 |
| floorplan | `floorplan` | 7 | 75 |
| identity-access | `identity_access` | 4 | 42 |
| platform-ops | `platform_ops` | 14 | 201 |
| **Total** | **7 schemas** | **93** | **1,181** |

## Verification status

A disposable synthetic PostgreSQL clone was brought up through the branch's
four pending forward migrations, then the cutover SQL was applied inside an
explicit transaction. The rehearsal compared every manifest table before and
after: all 93 kept their PostgreSQL relation OID, row count, and index count.
The final catalog had the expected per-schema table totals, 68 same-schema
foreign keys, and zero cross-schema foreign keys. Old mixed-owner schemas were
removed by the migration.

The SQL replay used `psql`; `prisma migrate deploy` was not exercised because
the isolated rehearsal database did not provide Prisma-compatible login
credentials. The cutover has not been applied to staging or production. A
sanitized representative dataset, completed migration-ledger preflight,
alternate-database restore, and release-window approval remain operational
gates. See the [cutover runbook](../runbooks/domain-schema-cutover.md).

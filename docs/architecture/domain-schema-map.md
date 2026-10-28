---
type: "Architecture Map"
title: "P.R.I.S.M domain schema map"
description: "Before-and-after view of the legacy pre-production database and its seven-schema owner baseline."
tags: [architecture, database, postgres, ddd, schema, migration]
status: canonical
updated: "2026-10-28"
authority: normative
audience: [engineers, reviewers, operators, agents]
scope: "PostgreSQL application schemas, model ownership, and domain foreign-key policy"
last_verified: "2026-10-06; seven baselines replayed on disposable PostgreSQL 16; no shared database changed"
sources:
  - id: ownership-manifest
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Per-model owner and schema manifest"
  - id: migration
    resource: "apps/api/prisma/migrations/"
    title: "Seven owner-scoped schema baselines"
  - id: persistence-register
    resource: "docs/architecture/persistence-ownership.md"
    title: "Persistence ownership register"
  - id: cutover-runbook
    resource: "docs/runbooks/domain-schema-cutover.md"
    title: "Baseline adoption and recovery procedure"
---
# P.R.I.S.M domain schema map

## At a glance

The previous pre-production database layout has ten application schemas for 93
business tables. Some schemas mix owners and include cross-domain foreign keys.
The new baseline creates the final 94-table schema from the Prisma model,
including the client floorplan grant. Same-domain foreign keys remain; all
cross-domain identifiers are scalar references checked through owner
capabilities when a command needs live state.

The target remains one PostgreSQL database, one Prisma client, and one API
deployment. Schema ownership is not a service boundary or a database
authorization boundary. `public._prisma_migrations` is excluded from the
business-table counts below.

## Before: previous pre-production namespace

The labels show physical schema, total table count, and owner split. Arrows
show where each owner slice belongs in the target. Mixed legacy schemas split
across owner schemas.

```mermaid
flowchart LR
  subgraph Before["Before: previous pre-production database"]
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
    lifecycle["event_lifecycle<br/>19 tables"]
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

The baseline creates all 94 tables in their owner schemas, including the
floorplan-access grant. The target assigns 83 of the 93 legacy tables to a
different owner schema; ten already used their target schema name. This clean
baseline copies no existing rows.
The old history recorded 45 cross-domain foreign-key behaviors; the baseline
does not recreate those constraints. Its 76 foreign keys are same-domain, and
the target Prisma schema contains no cross-domain relation.

| Write domain | Target schema | Tables | Columns |
| --- | --- | ---: | ---: |
| event-lifecycle | `event_lifecycle` | 19 | 290 |
| commercial | `commercial` | 28 | 319 |
| operations | `operations` | 12 | 142 |
| live-ops | `live_ops` | 10 | 122 |
| floorplan | `floorplan` | 7 | 75 |
| identity-access | `identity_access` | 4 | 42 |
| platform-ops | `platform_ops` | 14 | 201 |
| **Total** | **7 schemas** | **94** | **1,191** |

## Operational boundary

The seven baseline migrations define the target in source control; they do not
change an existing database. A database with the old migration ledger needs a
verified backup and an approved pre-production rebuild before adopting this
history. Follow the
[baseline adoption runbook](../runbooks/domain-schema-cutover.md).

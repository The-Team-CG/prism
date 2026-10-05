---
type: "Column Authority Register"
title: "P.R.I.S.M column authority and disposition register"
description: "Per-column baseline facts, provisional domain authority, data semantics, consumer candidates, sensitivity, retention and migration disposition."
tags: [architecture, persistence, prisma, ddd, schema, data-dictionary]
status: active
updated: "2026-10-04"
authority: informative
owner: "B (Francis) and D (Anthony); C (Ethan) for shared contracts"
audience: [domain_owners, engineers, reviewers]
scope: "apps/api/prisma/schema.prisma, apps/api/prisma/migrations, and current owner-context readers/writers"
last_verified: "staging 7f64c0b; disposable PostgreSQL 16 replay; source scan at PR11 commit 2143269"
sources:
  - id: prisma-schema
    resource: "apps/api/prisma/schema.prisma"
    title: "Prism Prisma models and scalar fields"
  - id: owner-manifest
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Approved table-to-domain and target-schema assignments"
  - id: persistence-ownership
    resource: "docs/architecture/persistence-ownership.md"
    title: "Canonical persistence ownership and DDD rules"
  - id: migration-history
    resource: "apps/api/prisma/migrations/"
    title: "Append-only migration history"
---

# P.R.I.S.M column authority and disposition register

## At a glance

- **Purpose:** Make every baseline column reviewable before schema conversion, retirement or
ownership cutover.
- **Authority:** Informative inventory; owner confirmation is required before changing business
meaning or stored values.
- **Owner:** B (Francis) and D (Anthony), with C (Ethan) for shared contracts.
- **Scope:** The 91 Prisma models and 1,159 scalar columns in the staging baseline, mapped to the
approved seven write-domain schemas.
- **Use when:** Changing a column, default, nullability, JSON payload, time or money representation;
planning retention; or proposing a trim.
- **Verify with:** Reconcile the CSV with the exact schema/migrations, check owner writers and
role-safe projections, then run populated migration and behavior evidence before conversion.

## Baseline and target ownership

The register records the staging schema at commit 7f64c0baa12be39fed17d1cbffeb3477d4d74a0a. The
physical types, nullability and defaults were checked against a disposable PostgreSQL 16 database
produced by replaying all 76 migration files. No production database or production data was
inspected or changed.

The baseline has 91 tables, 1,159 scalar columns, ten populated application schemas and 112 foreign
keys. The approved DDD target assigns each table to one of seven schemas. Same-domain foreign keys
are permitted; cross-domain foreign keys are not. The 45 cross-domain references retain their scalar
ID columns and need owner capability, retention and delete-behavior gates before their database
constraints are removed.

| Write domain | Target schema | Tables | Columns |
| --- | --- | ---: | ---: |
| event-lifecycle | event_lifecycle | 18 | 279 |
| commercial | commercial | 28 | 319 |
| operations | operations | 12 | 142 |
| live-ops | live_ops | 10 | 122 |
| floorplan | floorplan | 6 | 72 |
| identity-access | identity_access | 4 | 38 |
| platform-ops | platform_ops | 13 | 187 |
| **Total** | **7 schemas** | **91** | **1,159** |

## Register contents

The companion [CSV register](column-authority-register.csv) contains one row per baseline column:

- current schema, table, physical column, Prisma field and source line;
- target write-domain owner and target schema;
- physical PostgreSQL type, nullability and default from the replayed catalog;
- semantic category, conservative source-of-authority classification and default interpretation;
- sensitivity and retention class, with no invented retention period;
- lexical production-source consumer candidates and the existing per-column review note;
- keep/change/retire disposition and linked plan tasks.

All rows currently preserve the stored column by default. The register does not authorize
speculative type conversions or populated-data rewrites. A recorded keep decision means the reviewed
evidence does not yet justify changing the stored representation; it does not claim that every
business semantic has received owner sign-off.

## Classification evidence and limits

The CSV semantic and sensitivity categories are conservative review prompts derived from physical
types, field names, table purpose and the approved owner manifest. They are not a substitute for the
owning workflow, contract or issued evidence. Numeric classification does not establish a currency
or unit. A timestamp without time zone does not reveal whether historical values mean UTC instants
or venue wall time. A text field that resembles a date is not safe to cast based on its name.

Consumer candidates were found by scanning 1,052 production source files in the API, four portals
and shared packages. The scan excludes tests, fixtures and generated files and matches exact Prisma
and SQL field names. These are lexical candidates, not type-checked consumer relationships: names
such as id, status and createdAt can refer to many models. A missing name hit is not proof that a
column is unused. Four no-hit cases were checked against their relation, default, writer and reader
paths; their evidence is recorded in the CSV.

The inventory identifies 225 timestamp-without-zone columns, 24 time/date-like text columns, 15
timestamp-with-zone columns, four DATE columns, 53 JSONB columns, three array columns and 18 integer
money candidates. These counts describe storage and name-based classifications, not approved
conversions.

## Dispositions and trim candidates

- Keep DATE values as calendar-day values and preserve existing whole-UTC-day behavior. Classify
true instants separately from venue-local schedules. Do not use implicit session-timezone casts.
- Keep current numeric and integer money representations until services, forms and issued evidence
establish units, currency, rounding and bounds. Do not treat integer values as minor units without
evidence and do not use floating-point for money.
- Keep issued, sanitized, versioned and review JSON snapshots historically readable. Add validation
and versions at new boundaries; preserve unparseable legacy evidence for explicit compatibility
handling.
- Keep normalized floorplan object rows as the live-authoring direction. Retain the aggregate
FloorPlan.objects field until publisher, template and live readers have parity, records reconcile,
and a backfill is proven. PublishedSnapshot currently stores the latest copy by event; it does not
provide revision history.
- Keep cached payment totals until query and concurrency evidence justifies a replacement; any
change must preserve transactional overpayment behavior.
- OpsEventDecision.storage_intent is the sole explicit column trim candidate from the
source-reference scan. No application property use was found outside schema/migration, but the
decision list currently returns full rows, so the field can still appear in API JSON. First
establish response compatibility and historical-value handling; any removal belongs in the
separate Task 22 migration review.
- OpsAddendumImpact.applied_at and OpsCommunicationParticipant.added_at are defaulted write
timestamps, while current projections do not select them. Keep them pending owner evidence because
they represent application/membership time. OpsCostEstimateLine.estimate_id is used through the
same-domain Prisma relation and nested estimate-line create; the text scanner does not see that
use as a scalar property.

No column is marked safe to drop solely because a lexical search found no matching property
reference. Task 22 requires owner-approved replacement, populated-data review, compatibility
evidence and a rollback/recovery path before a retirement migration.

## Open owner confirmations

Before any conversion or retirement, the relevant owners still need to confirm:

- currency, unit, rounding and valid range for monetary fields, including signed adjustments;
- instant, business-day and venue-time meaning, including historic timezone interpretation and
daylight-saving boundaries;
- each JSON field’s writer authority, payload version and legacy compatibility path;
- blank versus unknown versus SQL NULL and defaults that can imply a completed, accepted or verified
action;
- sensitivity, role projection and retention duration for personal, commercial, audit, credential
and issued evidence;
- typed consumers and external response compatibility for candidates proposed for removal.

The register records a provisional DDL disposition for every baseline column. It does not close the
broader Task 20 semantic test gate until these owner decisions and required focused tests are
complete.

## Change procedure

For each accepted change, update the owning shared contract and bounded-context writer first,
preserve authorization and retry/transaction behavior, and add a forward owner-aware migration only
when the stored data requires it. Preflight populated rows, define lock and recovery behavior, test
boundary values and historical snapshots, and compare the resulting catalog with the register.
Historical migration files remain immutable.

---
type: "Playbook"
title: "P.R.I.S.M portal accounts"
description: "Local fixture accounts, access paths, and role-boundary notes for Prism portal verification."
tags: [runbook, accounts, demo, roles]
status: canonical
updated: "2026-09-30"
authority: operational
owner: "D (Anthony)"
audience: [developers, QA, agents]
scope: "local seeded accounts and role-bound portal sign-in"
last_verified: "2026-09-02"
sources:
  - id: fixture-seed
    resource: "apps/api/src/fixtures/local-fixture-seeder.ts"
    title: "Local fixture account seed"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current application boundaries"
---
# P.R.I.S.M portal accounts

## At a glance

- **Purpose:** Provide local fixture sign-in details for each Prism portal role.
- **Authority:** Operational local-demo reference; never use these values for deployed environments.
- **Owner:** D (Anthony).
- **Scope:** Local client, supplier, guest, and PMCM/coordinator sign-in paths.
- **Use when:** Verifying role-specific local portal flows.
- **Change when:** Seeded actors, credentials, or local authentication behavior changes.
- **Verify with:** Local API/session behavior and the affected portal sign-in flow.

Development fixture accounts for every role portal. These are **local credentials only** — not production users.

Accounts exist after the explicit fixture seed runs against an empty local disposable database. Password values are stored hashed in `OpsUser`; the plain passwords below are for local sign-in.

## Portals

| Portal | App | URL | Who signs in |
| --- | --- | --- | --- |
| Client | `apps/client` | http://localhost:3001/sign-in | Approved client |
| Supplier | `apps/supplier` | http://localhost:3002/sign-in | Approved supplier |
| Guest | `apps/guest` | http://localhost:3003/open | Event access code (no password account) |
| Event command | `apps/event` | http://localhost:3004 | PMCM admin + coordinator |
| API | `apps/api` | http://localhost:4000 | Shared backend for all portals |

## Local fixture accounts

| Portal | Role | Name | Email | Password / code | Notes |
| --- | --- | --- | --- | --- | --- |
| Event command | `pmcm-admin` | Ms. Mys | `mys@pmcm.test` | `prism-admin` | Full PMCM command access |
| Event command | `coordinator` | Marco Santos | `marco@pmcm.test` | `prism-coordinator` | Role-safe coordinator workspace |
| Client | `client` | Ana Reyes | `ana@ayala.test` | `prism-client` | Ayala Tech Summit local fixture client |
| Supplier | `supplier` | XPERTO Registration | `ops@xperto.test` | `prism-supplier` | Tier 1 digital registration (primary) |
| Supplier | `supplier` | Bloom Florals | `flowers@bloom.test` | `prism-supplier` | Tier 2 floral fixture |
| Guest | guest pass | — | — | `AYALA-TECH-YALA` | Derived from sample event `Ayala Tech Summit 2026` / `evt_sample_ayala` |

### Quick copy

```text
# Event command (PMCM)
mys@pmcm.test / prism-admin

# Event command (coordinator)
marco@pmcm.test / prism-coordinator

# Client portal
ana@ayala.test / prism-client

# Supplier portal
ops@xperto.test / prism-supplier
flowers@bloom.test / prism-supplier

# Guest portal (open page)
Access code: AYALA-TECH-YALA
Guest name: any display name (e.g. Sofia Lim)
```

### Seeded events

| Event id | Name | Coordinator assignment |
| --- | --- | --- |
| `evt_sample_ayala` | Ayala Tech Summit 2026 | Marco Santos (`coord_asg_ayala_marco`, Floor Director) |
| `evt_sample_unassigned` | Coordinator Scope Check 2026 | none — use for unassigned-event 403s |

The fixture seed creates these events and accounts. API startup does not create or update fixture data.

## How to load / refresh accounts

API startup does **not** seed data. The application has no sample state or reset routes; fixture data is created by a direct database seed command.

1. Create a local PostgreSQL database named `prism_sample_disposable` and apply the Prisma migrations to it.
2. Ensure the first nonempty runtime URL in this order points to that local database: `SUPABASE_DB_URL`, `DATABASE_URL`, `PRISMA_DATABASE_URL`, then `DIRECT_URL`. Clear or replace any earlier remote URL. Set `DIRECT_URL` to the same local database for migrations, then apply them with `npm --workspace prism-api run db:setup`.
3. Run the explicit seed command from the repository root:

   ```bash
   npm --workspace prism-api run db:seed:fixtures -- --confirm-disposable-db prism_sample_disposable
   ```

   The command refuses production, remote URLs, a different database name, and populated fixture tables. It writes directly through Prisma, does not start the API server, and never deletes existing rows. Use a newly created disposable database.

After the command completes, you should be able to sign in with every account above. Running the API alone does not create these accounts.

## Portal boundaries

- **Client** only accepts `client` role sessions.
- **Event command** accepts `pmcm-admin` and `coordinator`.
- **Supplier** only accepts `supplier` role sessions.
- **Guest** does not use email/password login. Guests open an event pass with the access code shown in the PMCM selected-event workspace (and the fixture code above).

Signing into the wrong portal with a valid account from another role returns a portal-boundary message; use the URL for that role.

## Source of truth in code

| Concern | Location |
| --- | --- |
| Seeded `OpsUser` rows + passwords | `apps/api/src/fixtures/local-fixture-seeder.ts` |
| Seeded suppliers (matched by email for supplier workspace) | same file (`SEEDED_SUPPLIERS`) |
| Guest access-code derivation | `apps/api/src/modules/operations/application/guest/guest-workflow.service.ts` (`guestAccessCode`) |
| Product / ops docs | [`../index.md`](../index.md), [`../product/actual-system.md`](../product/actual-system.md) |

## Security note

These credentials are intentional development fixtures. Do not use them in production or shared environments.

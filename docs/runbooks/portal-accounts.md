---
type: "Playbook"
title: "P.R.I.S.M portal accounts"
description: "Local fixture accounts, access paths, and role-boundary notes for Prism portal verification."
tags: [runbook, accounts, demo, roles]
status: canonical
updated: "2026-11-18"
authority: operational
audience: [developers, QA, agents]
scope: "local seeded accounts and role-bound portal sign-in"
last_verified: "2026-11-18; fixture seeder accounts/passwords, guest code derivation, seed guards, portal sign-in routes and the Account page flows reviewed against code; hosted credentials unverified"
sources:
  - id: fixture-seed
    resource: "apps/api/src/fixtures/local-fixture-seeder.ts"
    title: "Local fixture account seed"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current application boundaries"
  - id: authenticator-rescan
    resource: "apps/api/src/modules/identity-access/application/auth/auth-operations.service.ts"
    title: "Development authenticator rescan authorization"
---
# P.R.I.S.M portal accounts

## At a glance

- **Purpose:** Provide local fixture sign-in details for each Prism portal role.
- **Authority:** Operational local-demo reference; never use these values for deployed environments.
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
| Event command | `apps/event` | http://localhost:3004/sign-in | PMCM admin + coordinator |
| API | `apps/api` | http://localhost:4000 | Shared backend for all portals |

These are the primary checkout's ports; a linked worktree prints its own with
`npm run ports` (see [parallel worktrees](parallel-worktrees.md)).

## Account page and sign-in security

Every portal's account menu opens **Account** (`/dashboard/account`; the coordinator portal's `?view=account`). Use it to check the
flows below on a fixture account; each one is audited and each confirmation takes the account's current password.

| Row | What to expect |
| --- | --- |
| Name, Password | A password change ends every session, so sign in again with the new one. A wrong current password is a 403, counts toward the sign-in lockout and does not sign the person out. |
| Two-step sign-in | Off by default for clients, suppliers and coordinators; on and not removable for PMCM admins. Enabling shows a QR and key for an authenticator app and turns on only after a correct code. Sign-in then asks for the six-digit code after the password. PMCM's account list shows who has it on and **Reset two-factor** works for any account. |
| Devices | Each sign-in records its browser. Any other device can be signed out on its own, or all of them at once; the menu's Sign out ends only this device. A session from before device sessions existed ends every session when it signs out. |
| Sign-ins | The last 10 sign-ins with browser and whether each worked. A banner shows only when sign-ins failed since the last visit. |
| Email | Enter the new address and the password. A link goes to the new address and a notice to the current one; the row shows the change as waiting until the link is opened (it can be sent again or withdrawn). The link opens `/confirm-email` on any portal and switches the account everywhere, ending all sessions. With `PRISM_MAIL_TRANSPORT=log` the link is written to the API log; with `mailpit` it arrives in the capture inbox. Confirming does nothing if another account took the address meanwhile. |

Clients and suppliers also see their PMCM contact and a Privacy summary on the page. Changing an email for a fixture account moves its
events and records with it, so use a disposable database for that check.

## Development authenticator rescan

After password verification, an already enrolled PMCM administrator can select
**Show authenticator QR** on the code-entry screen when both the event portal
and API run with `NODE_ENV=development`. Scan it with the authenticator app,
then enter its current six-digit code. **Hide authenticator QR** removes it
from the screen.

The QR uses the existing enrollment; it does not reset the secret, consume the
challenge or complete sign-in. `POST /api/auth/2fa/development-qr` requires the
active signed sign-in challenge and returns a non-cacheable response. Production,
test and unspecified API environments return 404. Production portal builds omit
the rescan control. First-time authenticator enrollment retains its normal QR.

## Local fixture accounts

For repeatable account creation on an existing local or UAT database, use the
[`accounts` CLI profile](environments-and-fixtures.md). It creates the six users
listed below using passwords supplied privately in the selected environment
file; it never resets existing credentials or 2FA. The guest code below belongs
to the legacy sample event, not the new UAT scenarios.

### Hosted account scope

This table documents the **legacy local seed**. It is not a verified hosted
credential inventory. Matching account emails in staging/UAT do not establish
that these passwords apply there. The name Talga does not establish a target;
check [environment identity](environments-and-fixtures.md#environment-identity).
For hosted testing, verify account role/approval and sign-in in the identified
environment, and exchange credentials privately. New CLI accounts use the private
password values you supply; existing accounts retain their current values.

| Portal | Role | Name | Email | Password / code | Notes |
| --- | --- | --- | --- | --- | --- |
| Event command | `pmcm-admin` | Ms. Mys | `mys@pmcm.test` | `prism-admin` | Full PMCM command access |
| Event command | `pmcm-admin` | PMCM Approver | `approver@pmcm.test` | `prism-admin` | Second PMCM admin; approves billing corrections requested by Ms. Mys (separation of duties) |
| Event command | `coordinator` | Marco Santos | `marco@pmcm.test` | `prism-coordinator` | Role-safe coordinator workspace |
| Client | `client` | Ana Reyes | `ana@ayala.test` | `prism-client` | Ayala Tech Summit local fixture client |
| Supplier | `supplier` | XPERTO Registration | `ops@xperto.test` | `prism-supplier` | Tier 1 digital registration (primary) |
| Supplier | `supplier` | Bloom Florals | `flowers@bloom.test` | `prism-supplier` | Tier 2 floral fixture |
| Guest | guest pass | — | — | `AYALA-TECH-YALA` | Derived from sample event `Ayala Tech Summit 2026` / `evt_sample_ayala` |

### Quick copy

```text
# Event command (PMCM)
mys@pmcm.test / prism-admin

# Event command (second PMCM admin, approves billing corrections requested by the first)
approver@pmcm.test / prism-admin

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
2. Set canonical `DATABASE_URL` to that local database. Runtime precedence is `DATABASE_URL`, `SUPABASE_DB_URL`, `PRISMA_DATABASE_URL`, then `DIRECT_URL`. A configured `DIRECT_URL` overrides migrations only; clear it or point it at the same local database, then apply migrations with `npm --workspace prism-api run db:setup`.
3. Run the explicit seed command from the repository root:

   ```bash
   npm --workspace prism-api run db:seed:fixtures -- --confirm-disposable-db prism_sample_disposable
   ```

   The command refuses production, remote URLs, a different database name, and populated fixture tables across all Prisma models. It writes directly through Prisma, does not start the API server, and never deletes existing rows. Stop the API and other database writers, and run only one seed command at a time: the empty-database check completes before fixture writes begin. Use a newly created disposable database.

After the command completes, you should be able to sign in with every account above. Running the API alone does not create these accounts. The seed only runs on an empty database; to pick up accounts added to the seeder later, create a new disposable database.

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

---
type: "Playbook"
title: "Prism environments and fixture commands"
description: "Explicit database selection, repeatable portal scenarios, and migration history inspection."
tags: [runbook, environments, fixtures, uat]
status: canonical
updated: "2026-10-28"
authority: operational
audience: [developers, QA, agents]
scope: "database selection, synthetic accounts, and portal UAT scenarios"
last_verified: "2026-10-23; local command contract; hosted identity unverified"
sources:
  - id: seed-cli
    resource: "apps/api/scripts/seed.mjs"
    title: "Standalone seed CLI"
---
# Environments and fixture commands

## At a glance

- **Purpose:** Prepare synthetic portal accounts and scenarios with an explicit CLI.
- **Use/change when:** Selecting environments or changing fixture prerequisites/commands.
- **Verify with:** Read-only dry-run/verify, migration comparison, and portal flows.

## Environment identity

Local startup generates ignored `.local-dev/api.env` and `.local-dev/docker.env`
for the checkout's Supabase database. It applies migrations and preserves data;
seeding remains separate. Ports vary by worktree.

Staging/UAT is a hosted test environment whose database and portal project IDs
must be verified from deployment configuration. **Talga** names the historical
UAT seed target; its exact provider project ID, host, and relationship to staging
are **unverified in this repository**. Do not use the name as a database selector.
Matching usernames do not establish password scope. Production is never seeded.

Use one `DATABASE_URL`; `DIRECT_URL` is migration-only. Port-5432 session poolers
are supported. Port-6543 transaction poolers are refused for transactional seeding.

## Select a private env file

For browser acceptance, run `npm run test:browser` after `npx playwright install chromium`.
The runner creates and removes its own disposable database, API/portal processes and Mailpit inbox;
normal development data is preserved. See the [browser acceptance guide](../../scripts/e2e/browser/README.md)
for ports, focused commands, artifact handling and the bounded journey coverage.

For manual email testing, set `PRISM_LOCAL_MAILPIT=1` before the ordinary local startup wrapper.
It prints the local inbox URL and generates the Mailpit transport settings without a Resend key.
Mail is captured locally with no external relay. Without the opt-in, mail stays in the API log.

The new CLI loads only the selected file for database/seed settings. Inherited
URLs cannot redirect it; no implicit `.env` is loaded. Use absolute paths because
workspace npm commands run in `apps/api`. `PRISM_ENV_FILE` is also accepted.

```dotenv
DATABASE_URL=<local PostgreSQL URL>
PRISM_SEED_ENV=local
```

For hosted UAT set `PRISM_SEED_ENV=uat`, inspect the target without connecting,
and pin the printed fingerprint as `PRISM_SEED_TARGET` in the same private file:

```powershell
npm --workspace prism-api run db:seed -- --env-file C:\secure\uat-api.env --show-target
```

Check the sanitized host/database against the intended project first. The
fingerprint includes the username to distinguish projects on shared poolers.
It pins operator-selected configuration; it cannot prove a mislabeled target
is non-production. `NODE_ENV=production` is always refused. URLs/passwords are not printed.

## Accounts then scenarios

`accounts` creates six missing users, two supplier categories, two suppliers,
and three coordinators (including a second general coordinator for handoff coverage). Existing passwords, 2FA, approval/lockout state, and edits
are preserved. New accounts are approved synthetic test actors. Missing users
need these private file values, at least 12 characters each:

```dotenv
PRISM_SEED_PASSWORD_ADMIN=<private value>
PRISM_SEED_PASSWORD_CLIENT=<private value>
PRISM_SEED_PASSWORD_COORDINATOR=<private value>
PRISM_SEED_PASSWORD_SUPPLIER=<private value>
```

The CLI uses the API's password hashing implementation and never prints values.
Dry-run/verify and reruns with existing users need no passwords. Account emails
and portal paths are in [portal accounts](portal-accounts.md). The old local
passwords apply only to the legacy local seed, not this command or hosted users.

```powershell
npm --workspace prism-api run db:seed -- --profile accounts --env-file C:\secure\uat-api.env --dry-run
npm --workspace prism-api run db:seed -- --profile accounts --env-file C:\secure\uat-api.env
npm --workspace prism-api run db:seed:verify -- --profile accounts --env-file C:\secure\uat-api.env
npm --workspace prism-api run db:seed -- --profile portal-uat --scenario-date 2026-10-24 --env-file C:\secure\uat-api.env --dry-run
npm --workspace prism-api run db:seed -- --profile portal-uat --scenario-date 2026-10-24 --env-file C:\secure\uat-api.env
npm --workspace prism-api run db:seed:verify -- --profile portal-uat --scenario-date 2026-10-24 --env-file C:\secure\uat-api.env
```

The explicit scenario date anchors the live event at midnight **Asia/Manila**.
Planning is 28 days later; feedback/closure/archive examples are earlier. Other
scheduled dates shift equally. Stable legacy ID date suffixes remain identifiers.

Dry-run/verify are read-only. Verify fails for missing rows. Apply inserts missing
rows in one transaction and serializes seed commands with an advisory lock.
Identity/link conflicts fail before writes; constraint errors roll back all inserts.
Reruns preserve tokens, statuses, dates, and tester edits. A new scenario date or
clean replay needs a new disposable database. There is no implicit reset/delete.

Scenarios cover conforme/briefing, supplier workflows, guest/coordinator operations,
live schedules, games, and privacy review. No notification outbox writes or delivery
services run. Synthetic conforme records are marked as fixtures, not legal signatures.
Verify checks presence/ownership; check sign-in, 2FA, event access, and forbidden-role
behavior separately through the selected API/portals.

## Read-only migration comparison

```powershell
$env:PRISM_ENV_FILE = 'C:\secure\uat-api.env'
npm --workspace prism-api run db:doctor -- --mode=runtime --migration-history
```

Existing doctor/Prisma wrappers retain process-over-file environment precedence.
Clear stale database URL variables first. The doctor prints its URL source and
sanitized target. The comparison reads local SQL checksums and `_prisma_migrations`.
Pending, unfinished, mismatched, or missing-local-file entries cause nonzero status.
LF/CRLF-only checksum differences are reported separately as `lineEndingOnly`;
they do not indicate changed SQL and do not block seeding across Windows/Linux.
It never repairs records and does not detect every live-schema drift condition.
The seed refuses inconsistent history; apply schema migrations separately first.

Keep the six published October 21 UAT migrations immutable. Maintain scenarios in
the CLI catalog. New seeding never enables `prism.uat_seed_enabled` or needs
`ALTER DATABASE`. The reported hosted checksum mismatch is unverified until this
comparison runs against the identified database. Follow [migration recovery](database-migrations.md)
from exact evidence; do not rewrite applied SQL or ledger checksums to silence it.

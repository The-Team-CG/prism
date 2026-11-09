---
type: "Playbook"
title: "Prism environments and fixture commands"
description: "Explicit database selection, repeatable portal scenarios, and migration history inspection."
tags: [runbook, environments, fixtures, uat]
status: canonical
updated: "2026-11-11"
authority: operational
audience: [developers, QA, agents]
scope: "database selection, synthetic accounts, and portal UAT scenarios"
last_verified: "2026-11-11; seed CLI flags, target guards, account catalog, history profile (applied, verified and re-run on a disposable local database) and db-doctor history mode reviewed; hosted identity unverified"
sources:
  - id: seed-cli
    resource: "apps/api/scripts/seed.mjs"
    title: "Standalone seed CLI"
  - id: seed-target
    resource: "apps/api/scripts/seed-target.mjs"
    title: "Seed env-file loading and target guards"
  - id: seed-accounts
    resource: "apps/api/src/fixtures/seed-accounts.mjs"
    title: "Accounts profile catalog"
---
# Environments and fixture commands

## At a glance

- **Purpose:** Prepare synthetic portal accounts and scenarios with an explicit CLI.
- **Use/change when:** Selecting environments or changing fixture prerequisites/commands.
- **Verify with:** Read-only dry-run/verify, migration comparison, and portal flows.

## Environment identity

Local startup generates the checkout's database environment and applies
migrations, preserving data; seeding remains separate. Generated files, ports,
and per-worktree isolation are described in the
[local development runbook](docker-dev-testing.md#one-database-url).

Staging/UAT is a hosted test environment whose database and portal project IDs
must be verified from deployment configuration. **Talga** is an informal name
for a UAT seed target; its provider project ID, host, and relationship to
staging are **unverified in this repository**. Do not use the name as a database
selector. Matching usernames do not establish password scope. Production is
never seeded.

Use one `DATABASE_URL`; `DIRECT_URL` is migration-only. Port-5432 session poolers
are supported. Port-6543 transaction poolers are refused for transactional seeding.

## Disposable browser and mail testing

`npm run test:browser` (after `npx playwright install chromium`) creates and
removes its own disposable database, API/portal processes and Mailpit inbox;
normal development data is preserved. `PRISM_LOCAL_MAILPIT=1` before the
ordinary startup wrapper captures local mail in Mailpit instead of the API log.
Ports, focused commands, artifacts, and coverage are in the
[browser acceptance guide](../../scripts/e2e/browser/README.md).

## Select a private env file

The seed CLI loads only the selected file for database/seed settings. Inherited
URLs cannot redirect it; no implicit `.env` is loaded. Use absolute paths because
workspace npm commands run in `apps/api`. `PRISM_ENV_FILE` is also accepted.

```dotenv
DATABASE_URL=<local PostgreSQL URL>
PRISM_SEED_ENV=local
```

For hosted UAT set `PRISM_SEED_ENV=uat`, inspect the target without connecting,
and pin the printed fingerprint as `PRISM_SEED_TARGET` in the same private file:

```powershell
npm --workspace prism-api run db:seed -- --env-file <absolute-private-file> --show-target
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
npm --workspace prism-api run db:seed -- --profile accounts --env-file <absolute-private-file> --dry-run
npm --workspace prism-api run db:seed -- --profile accounts --env-file <absolute-private-file>
npm --workspace prism-api run db:seed:verify -- --profile accounts --env-file <absolute-private-file>
npm --workspace prism-api run db:seed -- --profile portal-uat --scenario-date 2026-10-24 --env-file <absolute-private-file> --dry-run
npm --workspace prism-api run db:seed -- --profile portal-uat --scenario-date 2026-10-24 --env-file <absolute-private-file>
npm --workspace prism-api run db:seed:verify -- --profile portal-uat --scenario-date 2026-10-24 --env-file <absolute-private-file>
```

The explicit scenario date is the live event's calendar date. Times of day are **Asia/Manila**; calendar dates
(event, briefing, milestone and schedule-day dates) are stored at UTC midnight, the same as dates the app writes, so
the live event reads as today in every portal. Databases seeded before 2026-11-11 keep the earlier Manila-midnight
dates, which show one day early; reseed a new disposable database to correct them.
Planning is 28 days later; feedback/closure/archive examples are earlier. Other
scheduled dates shift equally. Stable legacy ID date suffixes remain identifiers.

Dry-run/verify are read-only. Verify fails for missing rows. Apply inserts missing
rows in one transaction and serializes seed commands with an advisory lock.
Identity/link conflicts fail before writes; constraint errors roll back all inserts.
Reruns preserve tokens, statuses, dates, and tester edits. A new scenario date or
clean replay needs a new disposable database. There is no implicit reset/delete.

### Five-year history

`history` adds five years of synthetic events on top of `accounts`, anchored to the
same `--scenario-date`: four years back and one year ahead, four events a month
(about 240 events and 4,900 rows). Each event carries the records of its stage:

| Stage (event date vs scenario date) | Records |
| --- | --- |
| Archived (more than 45 days ago) | Inquiry, signed conforme, briefing, selected quotes, cost estimate, issued proposal, sent billing statement, paid deposit and balance, coordinator attendance, check-ins, guest feedback, and for most clients a closeout survey and testimonial |
| Closing out (last 45 days) | As archived, but not archived: balances partly paid or open, testimonials pending moderation |
| Live (the scenario date) | Two events on event day, one for the client fixture account, with check-ins from the last hours |
| Planning (next 75 days) | Signed conforme, briefing, confirmed suppliers, approved proposal, billing with a paid deposit for the next 45 days, acknowledged coordinators |
| Briefing (75–200 days ahead) | Signed conforme, briefing and open quote requests |
| Inquiry (more than 200 days ahead) | Accepted, pending and new inquiries; earlier dates also include declined inquiries |

Every fifth event belongs to the client fixture account (`ana@ayala.test`), so the
client portal shows a history too. Four history suppliers (catering, lights and sound,
photo and video) join the accounts profile's two. The data is deterministic: the same
scenario date produces the same rows, and reruns insert nothing.

```powershell
npm --workspace prism-api run db:seed -- --profile history --scenario-date 2026-11-11 --env-file <absolute-private-file> --dry-run
npm --workspace prism-api run db:seed -- --profile history --scenario-date 2026-11-11 --env-file <absolute-private-file>
npm --workspace prism-api run db:seed:verify -- --profile history --scenario-date 2026-11-11 --env-file <absolute-private-file>
```

It can share a database with `portal-uat`; their records do not overlap.

Scenarios cover conforme/briefing, supplier workflows, guest/coordinator operations,
live schedules, games, and privacy review. No notification outbox writes or delivery
services run. Synthetic conforme records are marked as fixtures, not legal signatures.
Verify checks presence/ownership; check sign-in, 2FA, event access, and forbidden-role
behavior separately through the selected API/portals.

## Read-only migration comparison

```powershell
$env:PRISM_ENV_FILE = '<absolute-private-file>'
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

The six published `20261021…_uat_*` migrations are gated on the
`prism.uat_seed_enabled` database setting; keep them immutable and maintain
scenarios in the CLI catalog instead. The CLI never enables that setting or
needs `ALTER DATABASE`. For a reported checksum mismatch, run this comparison
against the identified database and follow
[migration recovery](database-migrations.md#drift-and-failed-migration-recovery)
from exact evidence; do not rewrite applied SQL or ledger checksums to silence it.

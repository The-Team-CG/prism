---
type: "Playbook"
title: "Deployment secrets and schema cutover controls"
description: "Configure and verify repository-owned deployment secrets, variables, and database schema cutover gates."
tags: [runbook, deployment, github-actions, secrets, migrations]
status: canonical
updated: "2026-10-28"
authority: operational
audience: [developers, reviewers, operators, agents]
scope: "GitHub Actions deployment configuration and repository-controlled schema cutover gates"
last_verified: "2026-10-05; repository workflow sources reviewed; external provider and deployment settings not verified"
sources:
  - id: deploy-workflow
    resource: ".github/workflows/deploy.yml"
    title: "Deployment workflow"
  - id: promotion-workflow
    resource: ".github/workflows/promote.yml"
    title: "Staging promotion workflow"
---
# Deployment secrets

## At a glance

- **Purpose:** Configure the Actions inputs required to deploy and safely hold schema-changing workflows.
- **Authority:** Operational guide for repository-owned workflow behavior.
- **Scope:** Repository/organization variables and secrets consumed by deployment workflows.
- **Use when:** Setting up or diagnosing a deployment gate.
- **Change when:** Workflow inputs or cutover controls change.
- **Verify with:** The named workflow sources and a successful deployment run; provider state is external.

This runbook covers the repository-owned inputs consumed by
`.github/workflows/deploy.yml`. The workflow deploys only after a successful
`CI` run on `staging` or `prod`; it intentionally fails closed when the
required configuration is absent. The `promote.yml` workflow has no additional
deployment secret: it runs only after a successful staging `Deploy` workflow
and inherits its promotion credentials in the shared reusable workflow.

## Required Actions configuration

Configure these in the Prism repository's GitHub Actions **Secrets** and
**Variables** settings. Organization-level values are also acceptable when
they are inherited by this repository. Do not configure a required value only
in a GitHub Environment: the caller jobs in `deploy.yml` do not declare an
`environment`, so their `${{ secrets.* }}` and `${{ vars.* }}` lookups need a
repository- or organization-visible value.

## Schema cutover controls

The automated Deploy, Promote, Rollback, and non-dry-run environment-sync paths
honor the shared repository variable `PRISM_SCHEMA_CUTOVER_HOLD`. Set it to the
exact lowercase string `true` to stop those workflow mutations. Dry-run
environment sync remains available. The hold is not a provider-side pause:
wait for active runs to finish and separately drain services and other database
writers before a schema cutover.

The read-only `Schema cutover preflight (read-only)` workflow requires the hold,
an exact compatibility mode/head, backup and drain confirmations, and the
matching trusted branch. It reads the target using the `DIRECT_URL` secret from
the selected GitHub Environment (`staging` or `production`). It checks that the
database ledger is a checksum-validated prefix of the checked-in migration
history and prints the desired SQL diff for review; it does not apply
migrations, sync provider configuration, or deploy services. Pending migration
names are expected, and the diff must be reviewed for unintended drift.

For the API startup ledger guard, define `PRISM_SCHEMA_COMPATIBILITY_MODE` and
`PRISM_SCHEMA_REQUIRED_HEAD` as repository Actions variables and include both
in `ENV_SYNC_MANIFEST_JSON` for the API service. Set the mode to `exact` and the
head to the reviewed final migration directory name before running the
preflight. The workflow verifies that the configured head matches both its
input and the checked-out migration tip. The API refuses startup if its local
migration names/checksums and the target's completed `_prisma_migrations`
history differ. This checks the migration ledger; it does not replace the live
schema diff. The API performs its startup query through the runtime database
identity, so a successful preflight with `DIRECT_URL` does not prove that the
runtime identity can read the ledger. Verify that permission in staging before
enabling exact mode; a denied query prevents API startup.

| Name | Type | Scope | Purpose |
| --- | --- | --- | --- |
| `PRISM_SCHEMA_CUTOVER_HOLD` | variable | repository | Exact lowercase `true` blocks automated deployment, promotion, rollback, and non-dry-run environment sync. |
| `PRISM_SCHEMA_COMPATIBILITY_MODE` | variable | repository + API manifest | Temporarily set to `exact` for a held schema release, then restore `disabled`; ordinary deployments use `disabled`. |
| `PRISM_SCHEMA_REQUIRED_HEAD` | variable | repository + API manifest | Exact checked-in final migration directory required by the API startup guard during the held release; clear after acceptance. |
| `DIRECT_URL` | secret | GitHub Environment `staging` or `production` | Direct database URL used by the read-only preflight; never printed. |

The repository currently has no automated migration-and-deploy workflow. After
the read-only preflight passes, the approved operator performs migration,
provider configuration, and exact-SHA deployments under the existing
maintenance procedure, verifies API and portal health, and clears the hold only
after acceptance. The normal manual environment-sync workflow rejects
non-dry-run operation while the hold is active. Do not clear the hold early to
make that workflow run. Configure environment protection and the external
provider pause/health checks separately; their current settings are not
verified by this repository change.

| Provider surface | External control to verify before cutover |
| --- | --- |
| Render `prism-api` | Check for Git-triggered deploys or direct deploy hooks outside these workflows; pause or monitor them while writers are drained. |
| Vercel `client`, `event`, `guest`, `supplier` | Check branch-connected automatic deployments and preview/production promotion; ensure no unreviewed SHA can deploy during the hold. |

### Staging path

| Name | Type | Environment | Purpose |
| --- | --- | --- | --- |
| `ENV_SYNC_STAGING` | secret | staging | Environment-sync bundle passed to `sync-environment.yml` for staging. |
| `RENDER_API_KEY` | secret | shared provider credential | Render API credential passed to the environment-sync job. |
| `VERCEL_TOKEN` | secret | shared provider credential | Vercel credential passed to environment sync and inherited by the frontend deploy jobs. |
| `RENDER_PRISM_API_STAGING_DEPLOY_HOOK_URL` | secret | staging | Render deploy hook for the `prism-api` staging service; the gate checks it and the Render deploy job calls it. |
| `ENV_SYNC_MANIFEST_JSON` | variable | shared | Manifest JSON supplied to environment sync for the selected target environment. |
| `PRISM_API_STAGING_URL` | variable | staging | Base URL of the deployed API. The workflow checks it and appends `/health` for the Render health check. Store it without a trailing slash. |
| `PRISM_VERCEL_PROJECT_ID_CLIENT` | variable | staging frontend | Vercel project ID for `apps/client`. |
| `PRISM_VERCEL_PROJECT_ID_EVENT` | variable | staging frontend | Vercel project ID for `apps/event`. |
| `PRISM_VERCEL_PROJECT_ID_GUEST` | variable | staging frontend | Vercel project ID for `apps/guest`. |
| `PRISM_VERCEL_PROJECT_ID_SUPPLIER` | variable | staging frontend | Vercel project ID for `apps/supplier`. |

### Production path

| Name | Type | Environment | Purpose |
| --- | --- | --- | --- |
| `ENV_SYNC_PRODUCTION` | secret | production | Environment-sync bundle passed to `sync-environment.yml` for production. |
| `RENDER_API_KEY` | secret | shared provider credential | Render API credential passed to the environment-sync job. |
| `VERCEL_TOKEN` | secret | shared provider credential | Vercel credential passed to environment sync and inherited by the frontend deploy jobs. |
| `RENDER_PRISM_API_PRODUCTION_DEPLOY_HOOK_URL` | secret | production | Render deploy hook for the `prism-api` production service; the gate checks it and the Render deploy job calls it. |
| `ENV_SYNC_MANIFEST_JSON` | variable | shared | Manifest JSON supplied to environment sync for the selected target environment. |
| `PRISM_API_PRODUCTION_URL` | variable | production | Base URL of the deployed API. The workflow checks it and appends `/health` for the Render health check. Store it without a trailing slash. |
| `PRISM_VERCEL_PROJECT_ID_CLIENT` | variable | production frontend | Vercel project ID for `apps/client`. |
| `PRISM_VERCEL_PROJECT_ID_EVENT` | variable | production frontend | Vercel project ID for `apps/event`. |
| `PRISM_VERCEL_PROJECT_ID_GUEST` | variable | production frontend | Vercel project ID for `apps/guest`. |
| `PRISM_VERCEL_PROJECT_ID_SUPPLIER` | variable | production frontend | Vercel project ID for `apps/supplier`. |

The four Vercel project-ID variables are named by portal rather than by
environment because the caller uses the same variable names for both branches.
If staging and production use different Vercel projects, the repository/org
variable source must resolve to the intended values for the workflow's target;
do not silently substitute a project ID from another portal.

## Why the current run fails

For a `staging` workflow-run event, `check-deploy-secrets` first requires
`RENDER_PRISM_API_STAGING_DEPLOY_HOOK_URL`, then
`PRISM_API_STAGING_URL`. When either is empty it exits non-zero, so the API and
all four frontend jobs are correctly blocked. The reported error means the
staging Render hook is absent or not visible to the repository; it is not an
application test failure and it is not safe to make this gate soft-pass.

## Verification after configuration

1. In the repository settings, confirm every staging or production name above
   exists in the correct **Actions secret** or **Actions variable** collection.
   Secret values must not be copied into workflow logs, issues, or this file.
2. Confirm each Render hook belongs to the matching `prism-api` service and
   each API URL is the corresponding public base URL. Check the resulting
   health target as `<base-url>/health` without printing credentials.
3. Produce a successful `CI` workflow-run on `staging` (or `prod`). In the
   resulting `Deploy` run, `check-deploy-secrets` must complete successfully
   and expose `staging_ready=true` or `production_ready=true`; the sync job,
   Render API deploy, and portal deploy jobs must then run rather than be
   skipped.
4. Verify the deployed API health endpoint and the root route of each portal
   from outside the runner. For staging, verify the Render service and
   `apps/client`, `apps/event`, `apps/guest`, and `apps/supplier` deployments.
5. For staging only, confirm `promote.yml` is triggered by the successful
   `Deploy` workflow and that its exact-SHA promotion completes. A failed or
   skipped `Deploy` run must not promote to production.

If `check-deploy-secrets` still reports a required name, inspect its exact
spelling and scope first. GitHub Actions secret values are intentionally not
read back for diagnosis; verify presence through the gate's successful result
and the subsequent provider deployment evidence.

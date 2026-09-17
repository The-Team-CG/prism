# Deployment secrets

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

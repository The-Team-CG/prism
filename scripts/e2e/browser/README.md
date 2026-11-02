# Browser acceptance

Run `npx playwright install chromium` once, then `npm run test:browser` from the repository root. Docker Desktop and a prepared local Supabase database server are required. The runner reads only `DATABASE_URL` from `.local-dev/api.env` (or an explicitly selected `PRISM_ENV_FILE`); `BROWSER_DATABASE_URL` can select another loopback PostgreSQL server. Hosted servers are refused.

The runner creates a new uniquely named `prism_browser_*` database, applies migrations, seeds synthetic accounts/UAT scenarios, starts the API on 4300, portals on 3301–3304, and Mailpit on 58025. Busy ports cause refusal; existing servers are never reused or stopped. The four portals use separate `.next-acceptance` output so ordinary development builds remain available. The run uses real API responses and rendered browser controls, with no business API interception or browser-local fixture state. Prerequisites are prepared through the API/guarded fixture CLI.

Desktop Chromium and mobile Chromium run each journey with separate browser sessions and no retries. Coverage: public inquiry and calendar, PMCM MFA/acceptance, client email activation/password reset/sign-in, supplier emailed quote submission, guest code/consent/check-in, signed-out dashboard guards, refusal of client credentials in PMCM/supplier workspaces, and one cross-role lifecycle journey (inquiry, conforme, proposal and billing statement, supplier quote and readiness, coordinator assignment, official plan approval, event day, closeout and archive). The [API lifecycle suite](../lifecycle/README.md) remains the broader workflow and permission layer. Route checks cover every registered page as described below; additional actions such as uploads, payments and floorplan editing gestures still need their own journeys.

The normal manual-test database is never reset. Owned test processes and the temporary inbox/database are removed after the run. Private logs, env files, synthetic MFA secrets and failure traces stay in the ignored `.local-dev/browser/<run-id>/` directory. Inspect a failed HTML report with `npx playwright show-report <report-directory>`. Traces may contain synthetic credentials and email tokens; CI uploads only failure reports/results for seven days, never environment, actor or API log files. A cancelled runner/job still needs its normal process/container teardown; do not kill unrelated Node processes.

Use `npm run test:browser -- --project=desktop` for one viewport, `--grep <title>` for a focused journey, and `--skip-build` only after a successful API build from the same source. `npm run test:browser:guards` checks environment refusal, coverage completeness, and timing records without touching a database.

The harness prints elapsed time and pass/fail status for database creation, Mailpit, migrations, each fixture seed, API compilation/readiness, fixture preparation, portal readiness, Playwright, and cleanup. The private run directory contains `timings.json` with those phase durations and total elapsed time. Timing records contain phase names, durations, and status; they exclude connection strings, credentials, process arguments, and exception details. Compare complete successful runs, including setup, before attributing a change to faster test execution.

## Registered page coverage

Run `npm run test:browser -- --grep "all registered pages"` for the route sweeps. Each viewport has four independently selectable tests: `all registered pages render: client`, `supplier`, `event`, and `guest`. For example, `npm run test:browser -- --project=desktop --grep "all registered pages render: event"` checks PMCM's complete route group. This split preserves every route and the existing cross-role journeys while allowing future shards to select whole portal groups.

Each group discovers its portal's `page.tsx` routes and expands dynamic views from the client and PMCM navigation registries. Supplier section variants are listed explicitly. An unresolved parameter or a page template without a case fails the sweep, so new routes require coverage. The completed group also requires a passing record for every expected route; a partially executed group cannot pass as complete.

Each sweep signs in real fixture actors and prepares the data needed by its portal: a new event/client, approved official layout, supplier invitation, or guest game session. It checks rendered main content, dashboard authentication, uncaught browser errors and failed API loads. Missing-link and unavailable-session states are separate cases; the lifecycle journeys exercise valid activation and conforme links. Passing route coverage establishes that pages render and load their initial data, not that every action or workflow state works.

The supplier directory check creates 26 synthetic suppliers and verifies the 25-row boundary, distinct next-page records, return to the previous page, search resetting the page, and the 50-row option. This validates that directory's controls; it does not establish that other lists are paginated.

Each group writes `page-coverage-<viewport>-<portal>.json` into the private run directory after each route. Reports contain page paths and results with supplier invitation tokens redacted. Completed reports are attached to the Playwright test; partial reports remain available after a setup or route failure.

## Local test inbox for manual development

Set `PRISM_LOCAL_MAILPIT=1` before the ordinary startup wrapper (PowerShell: `$env:PRISM_LOCAL_MAILPIT='1'; .\start-prism.cmd`). It starts a checkout-specific, loopback-bound Mailpit container and prints the inbox URL; generated Node and Docker env files select `PRISM_MAIL_TRANSPORT=mailpit` and `PRISM_MAILPIT_URL`. The API uses Mailpit's HTTP send endpoint through the existing mail transport seam. Both plain text and HTML are captured for auth and notification emails. No Resend key or external forwarding is configured, so no email-provider credits are used. Captured mail stays local and is not delivered to real recipients.

Without the opt-in, local mail still uses the API log. The local stop wrapper stops the checkout's inbox; it preserves unrelated containers. Production rejects `mailpit` and `log` transports and continues to require Resend. Mailpit is a test adapter and does not prove Resend delivery, DNS authentication or inbox placement.

## CI

`Browser acceptance` runs on affected pull requests, on demand, and daily at 03:00 Asia/Manila against staging. Desktop and mobile run in separate GitHub-hosted jobs, each provisioning its own disposable PostgreSQL/Mailpit and pinned Playwright Chromium build. Each harness invocation retains one worker: MFA/session files, fixture accounts, and mutable game state are shared within that invocation and are not safe for unrestricted worker concurrency. No hosted credentials are needed.

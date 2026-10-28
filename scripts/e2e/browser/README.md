# Browser acceptance

Run `npx playwright install chromium` once, then `npm run test:browser` from the repository root. Docker Desktop and a prepared local Supabase database server are required. The runner reads only `DATABASE_URL` from `.local-dev/api.env` (or an explicitly selected `PRISM_ENV_FILE`); `BROWSER_DATABASE_URL` can select another loopback PostgreSQL server. Hosted servers are refused.

The runner creates a new uniquely named `prism_browser_*` database, applies migrations, seeds synthetic accounts/UAT scenarios, starts the API on 4300, portals on 3301–3304, and Mailpit on 58025. Busy ports cause refusal; existing servers are never reused or stopped. The four portals use separate `.next-acceptance` output so ordinary development builds remain available. The run uses real API responses and rendered browser controls, with no business API interception or browser-local fixture state. Prerequisites are prepared through the API/guarded fixture CLI.

Desktop Chromium and mobile Chromium run each journey with separate browser sessions and no retries. Coverage: public inquiry and calendar, PMCM MFA/acceptance, client email activation/password reset/sign-in, supplier emailed quote submission, guest code/consent/check-in, and signed-out dashboard guards. The 477-check API lifecycle suite remains the broader workflow and permission layer. These browser journeys are bounded acceptance coverage, not a claim that every product screen is tested; uploads, billing, floorplan gestures and other portal actions need additional journeys.

The normal manual-test database is never reset. Owned test processes and the temporary inbox/database are removed after the run. Private logs, env files, synthetic MFA secrets and failure traces stay in the ignored `.local-dev/browser/<run-id>/` directory. Inspect a failed HTML report with `npx playwright show-report <report-directory>`. Traces may contain synthetic credentials and email tokens; CI uploads only failure reports/results for seven days, never environment, actor or API log files. A cancelled runner/job still needs its normal process/container teardown; do not kill unrelated Node processes.

Use `npm run test:browser -- --project=desktop` for one viewport, `--grep <title>` for a focused journey, and `--skip-build` only after a successful API build from the same source. `npm run test:browser:guards` checks environment refusal without touching a database.

## Local test inbox for manual development

Set `PRISM_LOCAL_MAILPIT=1` before the ordinary startup wrapper (PowerShell: `$env:PRISM_LOCAL_MAILPIT='1'; .\start-prism.cmd`). It starts a checkout-specific, loopback-bound Mailpit container and prints the inbox URL; generated Node and Docker env files select `PRISM_MAIL_TRANSPORT=mailpit` and `PRISM_MAILPIT_URL`. The API uses Mailpit's HTTP send endpoint through the existing mail transport seam. Both plain text and HTML are captured for auth and notification emails. No Resend key or external forwarding is configured, so no email-provider credits are used. Captured mail stays local and is not delivered to real recipients.

Without the opt-in, local mail still uses the API log. The local stop wrapper stops the checkout's inbox; it preserves unrelated containers. Production rejects `mailpit` and `log` transports and continues to require Resend. Mailpit is a test adapter and does not prove Resend delivery, DNS authentication or inbox placement.

## CI

`Browser acceptance` runs on affected pull requests and on demand. The daily 03:00 Asia/Manila schedule activates only after the workflow reaches the default branch; scheduled runs check out staging. CI provisions disposable PostgreSQL/Mailpit and installs the pinned Playwright Chromium build. No hosted credentials are needed.

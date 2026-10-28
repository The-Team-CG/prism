# Lifecycle API journeys

Run public inquiry, client activation and conforme, proposals and billing, supplier procurement and delivery, staffing and guest operations, floorplans and files, change control, live operations, privacy, closure and archive checks through the real API.

The suite mutates data. It accepts only a loopback API on port **4100** and a private `DATABASE_URL` targeting the loopback **prism_e2e_flow** database. That API must use the same separate disposable database in the local Supabase Postgres container. Port 4000 and the normal development database remain available for manual testing. An API port alone does not prove database isolation: inspect the selected private environment file before starting the API.

## Prerequisites

- Start local Supabase using the repository launcher.
- Create a separate disposable database and apply the checked-in Prisma migrations using the database migration runbook. Never point this suite at the default development database or hosted configuration.
- Prepare an ignored private env file, such as `.local-dev/e2e-flow.env`, with the disposable `DATABASE_URL`, `PORT=4100`, `PRISM_SEED_ENV=local`, `PRISM_MAIL_TRANSPORT=log`, and the normal API configuration. The generated local launcher's `PRISM_LOCAL_DEV=1` pins the standard `/postgres` database; the separate test API uses explicit database configuration instead of that generated development identity.
- This test environment requires `PRISM_TRUST_PROXY=true` because its simulated clients use distinct forwarded addresses to exercise journeys without sharing one rate-limit bucket. This is a test API setting; choose deployment proxy trust from the actual network topology.
- Seed the `accounts` profile with the guarded seed CLI against that explicit private env file. It must supply the four `PRISM_SEED_PASSWORD_*` values. The suite also accepts `E2E_PASSWORD_ADMIN`, `E2E_PASSWORD_CLIENT`, `E2E_PASSWORD_COORDINATOR` and `E2E_PASSWORD_SUPPLIER` overrides. No credentials belong in source control.
- Build and start the API on port 4100 with that private file. Capture its stdout in `.local-dev/e2e-flow-api.log`: activation links are read from the log transport. Keep the log and `.local-dev/e2e-flow-secrets.json` private; the latter stores synthetic actors' TOTP secrets between runs.

## Run

From the repository root in PowerShell:

```powershell
$env:E2E_API_URL = 'http://localhost:4100/api'
$env:E2E_API_LOG = Join-Path $PWD '.local-dev/e2e-flow-api.log'
$env:E2E_SECRETS_FILE = Join-Path $PWD '.local-dev/e2e-flow-secrets.json'
node --env-file=.local-dev/e2e-flow.env scripts/e2e/lifecycle/run.mjs
```

Run selected phases with `--only onboarding,commercial,suppliers,staffing-guests,floorplan-files-compliance,eventday-closure`. Each phase can run independently and creates its own synthetic events. Some destructive validation probes create additional events so a successfully accepted bad request cannot poison the main scenario. A rerun adds synthetic records; it does not reset or delete the database. Run one mutating suite at a time. Staffing dates are selected from dates not already present in the API event list so retained assignments do not collide on reruns.

Reports are written to `.local-dev/e2e-report/latest.json` and `latest.md`. Set `E2E_REPORT_DIR` to preserve a separate run. Exit codes: `0` means no failed assertions or harness errors, `1` means a failure or harness error, and `2` means the API is unavailable. Gaps and blocked checks remain visible even when the exit code is zero.

## Read results

| Result | Meaning |
| --- | --- |
| PASS | The assertion succeeded. A labelled portal-wiring check only establishes a source caller exists. |
| FAIL | Observed behavior violates an asserted contract. Review the assertion and source before treating it as a confirmed bug. |
| REVIEW | Observed behavior needs a business or API-contract decision. |
| GAP | A user path, integration or capability is unavailable or not exercised in this environment. |
| BLOCKED | A prerequisite failed or the fixtures cannot reach the required state. |
| HARNESS_ERROR | The runner itself failed, for example from an invalid object access or failed network request. |

Database errors are not retried by default. A helper call may explicitly set `retryDatabaseErrors: true` during exploration; every retry is reported and prevents a green run. A generic database 500 does not establish a serialization conflict.

These checks do not establish browser usability, mobile/keyboard accessibility or visual correctness. Portal wiring checks scan source; they are not browser acceptance. The current local run exercises filesystem storage and log mail, not hosted Supabase Storage, a session pooler, delivery providers or production runtime grants. Starting those services would still require adapter, routing and privilege verification.

The end-to-end lifecycle starts event day through the PMCM capability after signed conforme and official floorplan approval, then exercises closure and archive without changing database statuses directly. The accounts seed now includes two general coordinators for positive handoff coverage and a registration coordinator; rerun that guarded profile against the disposable database when updating an older fixture set. The suite creates actual supplier assignments and confirms readiness before arrival.

Correction checks cover concurrent approval retries, preserved original invoices/payment records, rejected overpayment corrections and refusal to resend superseded invoices. Confirmed cancellation fees create a linked approved source; the scenario explicitly issues its statement through PMCM billing. Receipt checks exercise client payment history over HTTP and inspect the download caller; the client receipt test verifies the PDF bytes. Browser acceptance and external provider delivery remain separate checks.

Persona checks verify public walk-ins through persisted check-ins and PMCM attendance totals, and read live event state through the owning client's detail/workspace while denying another client. Guest feedback consent withdrawal is exercised after both archive and submission-window expiry, including refusal of another event's code. Client event-progress rendering and flag/state gating have separate focused component/rule tests.

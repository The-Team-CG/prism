---
type: "Playbook"
title: "Operational communications"
description: "How operational notices are queued, delivered, read, acknowledged and escalated, and how to run and verify that flow."
tags: [runbook, notifications, email, viber, acknowledgment, escalation]
status: canonical
updated: "2026-11-11"
authority: operational
audience: [developers, reviewers, operators, agents]
scope: "Recipient-level delivery tracking, in-app notices, acknowledgments, provider outcomes, escalation and the checks that prove them"
last_verified: "2026-11-11; recipient inbox, acknowledgment, provider outcome and escalation behaviour covered by unit tests and PostgreSQL tests, plus a real local mail-capture round trip; no staging environment or linked Viber account exists, so no live provider delivery has been tested"
sources:
  - id: outbox
    resource: "apps/api/src/modules/platform-ops/application/notifications/notification-outbox.service.ts"
    title: "Durable outbox and delivery"
  - id: inbox
    resource: "apps/api/src/modules/platform-ops/application/notifications/notification-inbox.service.ts"
    title: "Recipient inbox, read and acknowledgment"
  - id: outcomes
    resource: "apps/api/src/modules/platform-ops/application/notifications/notification-provider-outcome.service.ts"
    title: "Provider delivery outcomes"
  - id: escalation
    resource: "apps/api/src/modules/platform-ops/application/notifications/notification-escalation.service.ts"
    title: "Overdue acknowledgment escalation"
  - id: integration-test
    resource: "apps/api/test/integration/notification-delivery.database.test.ts"
    title: "PostgreSQL delivery tests"
  - id: mail-capture-test
    resource: "apps/api/src/modules/platform-ops/infrastructure/notifications/notification-mail-capture.mailpit.test.ts"
    title: "Local mail-capture round trip"
---
# Operational communications

## At a glance

- **Purpose:** Explain how an operational notice reaches each person, how P.R.I.S.M knows what happened to it, and what to do when it did not.
- **Authority:** Operational guide. Provider setup stays in [external integrations](external-integrations.md).
- **Scope:** Email and Viber notices, the per-recipient inbox in the client, supplier and PMCM portals, acknowledgment deadlines and escalation.
- **Use when:** Running or reviewing the notice flow, answering "did they get it?", or checking a deployment before relying on it.
- **Change when:** A channel, provider status, deadline rule or escalation target changes.
- **Verify with:** The checks in [Verify it](#verify-it).

## How a notice travels

1. A workflow (billing statement sent, file requirement reminder, supplier schedule revision, and so on) writes one row to the
   notification outbox with an idempotency key and, where useful, an **action**: the event section or booking the notice is about.
   The same event cannot queue the same notice twice.
2. The delivery worker resolves the row to **recipients** (account emails) and records **one delivery per recipient** with its own
   status: `accepted`, `failed` or `skipped`. A group notice is therefore never one shared result.
3. Each portal shows a signed-in person only their own deliveries (**Notifications**: client and supplier account menus, the PMCM
   Settings page and the coordinator account menu). A notice outside the person's current event access is not listed.
4. The person can **read** it (opening it records the read) and **acknowledge receipt**. Both are tied to the exact message version
   they saw. If the notice changes after it was opened, acknowledging is refused until it is reviewed again.
5. The action becomes a link in that person's own portal. A notice names an event area (overview, briefing, proposal, floor plan,
   billing, files, scope changes or live operations) and each portal maps it to its own page: the client's event pages, the PMCM
   workspace tabs, or, for a supplier, Files or the booking. A role with no such page gets no link (suppliers have none for client
   billing, floor plans or live operations). Payment reminders, floor plan reviews, proposal comments, scope changes, briefing
   submissions, event-day escalations and file or schedule requests carry links; other notices are plain text.

Acknowledging receipt is not a business decision. Approvals, contract uploads and schedule confirmations still need their own action
in the event workspace; the inbox says so.

## What "accepted" does and does not mean

`accepted` means the provider took the message. It does not mean the person received or read it. Delivery evidence is recorded
separately on the delivery as `providerOutcome`:

| Channel | Where the outcome comes from | Outcomes |
| --- | --- | --- |
| Email (Resend) | Signed webhook events to `/api/integrations/resend/webhook` when `RESEND_WEBHOOK_SECRET` is set, and PMCM's **Refresh email outcome** on an accepted delivery (the API asks Resend for that message's status using `RESEND_API_KEY`). | `sent`, `delivered`, `delivery_delayed`, `bounced`, `complained`, `opened`, `clicked`, `failed`, `suppressed` |
| Viber | Signed callbacks to `/api/integrations/viber/webhook`, matched on the message token. | `delivered`, `seen`, `failed` |

Notes that matter when debugging:

- Viber message tokens are 64-bit numbers. They are stored and compared as digit strings, never as JavaScript numbers, because a number
  would lose precision and the callback would not match its delivery.
- A Viber callback can arrive **before** the send is recorded as accepted. The outcome is kept and applied when the delivery appears.
- Outcomes only move forward: a late `delivered` cannot overwrite `seen` or `failed`, and a late `delivered` or `sent` cannot undo an email
  `bounced`. A spam complaint outranks every earlier email outcome. Reports are stored per provider receipt, so an email event that
  arrives before the send is recorded is applied when it is.
- Resend webhooks use the Svix signature scheme (`svix-id`, `svix-timestamp`, `svix-signature`). A request without a valid signature, or
  with a timestamp more than five minutes old, is refused with 401. With no `RESEND_WEBHOOK_SECRET` the endpoint answers 503.
- A callback without a valid `X-Viber-Content-Signature` is refused with 401.
- In local development mail goes to a capture inbox (`PRISM_MAIL_TRANSPORT=log` or `mailpit`). The channel is reported as
  **captured**, not as delivered: no external provider was involved.

## Channel readiness

Each account's **Notifications** page says, per channel, whether a notice can reach that person:

- **Email:** `provider` when `PRISM_MAIL_TRANSPORT=resend` with a sender and key, `captured` for local capture, otherwise `unavailable`.
- **Viber:** `unconfigured` without `VIBER_AUTH_TOKEN` and `VIBER_BOT_URI`; `ready` for an account that linked Viber and kept it on;
  `not linked or disabled` otherwise.

Configuration alone is never shown as proof of delivery. Only the per-delivery status and provider outcome are.

## Acknowledgment deadlines and escalation

Only a PMCM administrator can require an acknowledgment, from the delivery details on the event's finance view: **Set acknowledgment
deadline** takes a future time and a reason. It is audited.

- A background sweep runs every 60 seconds. For each recipient whose deadline has passed with no acknowledgment, it marks the
  delivery escalated and queues one notice to PMCM naming the overdue recipient, linked to the event's billing tab where the delivery
  details are. The mark and the notice are written in one
  transaction, so concurrent sweeps or several API instances produce **one** escalation per deadline.
- **Second level.** A recipient still silent a window after that first escalation (`PRISM_NOTIFICATION_SECOND_ESCALATION_HOURS`,
  whole hours from 1 to 720, default 24; anything else falls back to 24) is chased once more: PMCM gets a second notice, and the
  event's assigned coordinators get one asking them to follow up with the recipient directly, linked to the event overview. The
  coordinators are the backup who can reach the recipient on the ground. A notice that belongs to no event has no coordinators, so
  only PMCM is told. It is also written in one transaction with its mark, so it happens **once** per deadline.
- At most 50 overdue deadlines are handled per level per sweep; the rest follow on the next one.
- Setting a new deadline on an unacknowledged delivery clears both escalations so it can escalate again from the start.
- Acknowledging at any point stops both levels. There is no third level: after the second chase the delivery details still show who
  has not acknowledged, and PMCM decides what to do next.
- The sweep also removes provider outcome records older than 30 days.
- Set `PRISM_DISABLE_NOTIFICATION_ESCALATION_JOB=1` to stop the sweep (for example while restoring a database). It never runs under
  `NODE_ENV=test`.

## When something did not arrive

1. Open the event's notification delivery details (PMCM). Find the recipient's delivery: `skipped` means that person's channel is off
   or not linked; `failed` shows the reason; `accepted` means the provider took it.
2. For an accepted email, **Refresh email outcome**. `bounced`, `suppressed` or `complained` mean the address needs fixing, not a retry.
3. For a failed delivery, use **Retry failed deliveries** with a reason. Recipients a provider already accepted are skipped, so a retry
   cannot send a second copy to them.
4. If a person says they never saw a notice, check their own **Notifications** list: a notice outside their current event access is not
   shown to them.

## Verify it

Run from `apps/api` unless noted. None of these send to a real provider.

```bash
npm run typecheck
npx vitest run src/modules/platform-ops
npm run prisma:validate && npm run db:verify:offline
```

The database-backed tests (independent acknowledgment per recipient, rejection of another recipient's acknowledgment, concurrent
escalation without duplicates, provider outcome ordering) need the isolated PostgreSQL. They run only against
`127.0.0.1:55437/prism_p0` and refuse any other target. CI runs them in the `postgres-migrations` job:

```bash
P0_TEST_DATABASE_URL=<isolated url> DB_SSL=false npx vitest run test/integration/notification-delivery.database.test.ts
```

One more check is local only: a queued email delivered through a real mail-capture inbox and then read and acknowledged. It needs
the isolated PostgreSQL and a Mailpit inbox on `127.0.0.1:55439`, which CI does not provide, so it lives outside the suites the CI
database runner requires and is skipped without both:

```bash
P0_TEST_DATABASE_URL=<isolated url> PRISM_COMMS_MAILPIT_URL=http://127.0.0.1:55439 DB_SSL=false \
  npx vitest run src/modules/platform-ops/infrastructure/notifications/notification-mail-capture.mailpit.test.ts
```

Portals: `npm --workspace @prism/client|@prism/supplier|@prism/event run typecheck` and the same with `test`.

## Not yet verified

- **Live provider delivery.** There is no staging environment and no linked Viber test account, so no message has been sent through
  Resend or Viber. Before relying on this in a deployment, create the environment, set `RESEND_API_KEY`, `PRISM_MAIL_FROM`,
  `VIBER_AUTH_TOKEN` and `VIBER_BOT_URI` through the host's secret store (see [deployment secrets](deployment-secrets.md)), register the
  Viber webhook, send one notice to a test address and a linked test account, and confirm the delivery, the outcome and the
  acknowledgment end to end.
- **The Resend webhook has not received a real event.** Signature checking and the outcome order are covered by tests built on Resend's
  documented Svix format. To enable it: in Resend add a webhook for the `email.*` events at
  `https://<api-host>/api/integrations/resend/webhook`, then store its signing secret as `RESEND_WEBHOOK_SECRET` in the host's secret store.
- **The backup is a default, not a confirmed policy.** The second level chases PMCM and the event's coordinators after 24 hours.
  If the business wants a different backup (a named on-call person, a longer ladder, or the window per event), that is a rule change
  in `notification-escalation.service.ts`; nothing about the current choice has been tested with real recipients.

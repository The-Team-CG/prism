---
type: "Playbook"
title: "Viber, Zoom and Canva integrations"
description: "Turn on the optional Viber, Zoom and Canva integrations, what each one needs, and how to check it works."
tags: [runbook, integrations, viber, zoom, canva, notifications]
status: canonical
updated: "2026-11-18"
authority: operational
audience: [developers, reviewers, agents]
scope: "Configuration, provider-side setup and verification for the Viber bot, Zoom meetings and Canva templates"
last_verified: "2026-11-18 notification and Workspace settings paths re-checked in the portals; 2026-11-11; configuration rules, webhook signature checks, token handling and failure states covered by unit tests; no live provider call has been made from this checkout"
sources:
  - id: viber
    resource: "apps/api/src/modules/platform-ops/application/notifications/notification-preference.service.ts"
    title: "Viber linking, webhook and delivery"
  - id: zoom
    resource: "apps/api/src/modules/commercial/application/quotes/presentation-meeting.service.ts"
    title: "Presentation meetings and Zoom creation"
  - id: canva
    resource: "apps/api/src/modules/platform-ops/application/integrations/canva-connection.service.ts"
    title: "Canva connection and template fill"
---
# Viber, Zoom and Canva integrations

## At a glance

- **Purpose:** Turn on the optional provider integrations behind FR-13, FR-25, FR-34, FR-59, FR-61, FR-64, FR-75 and New-P3.
- **Authority:** Operational guide; the feature ledger owns the product decisions.
- **Scope:** Environment variables, provider-side setup, and how to verify each integration.
- **Use when:** Setting up a deployment, rotating a provider credential, or debugging a refused integration call.
- **Change when:** A provider, variable, webhook or template field changes.
- **Verify with:** The unit tests named below and the role path in each section.

All three are off by default. Each group of variables is all-or-none and is checked at startup, so a half-set
group stops the API with the missing variable named. With a group unset, the feature reports it is not
configured: there is no fallback provider. Secrets go in the host's secret store, never in a committed file
(see [deployment secrets](deployment-secrets.md)).

## Viber (FR-25, and the Viber legs of FR-13, FR-34, FR-64, FR-75 and New-C4)

| Variable | Value |
| --- | --- |
| `VIBER_AUTH_TOKEN` | The bot's authentication token from the Viber Admin Panel. Secret. |
| `VIBER_BOT_URI` | The bot's URI (the `chatURI` in its share link). |

Provider setup: create a Viber bot (new bots are commercial and need Viber's partner approval), then register the
webhook once with `POST https://chatapi.viber.com/pa/set_webhook` and the URL
`https://<api-host>/api/integrations/viber/webhook`. Every callback must carry `X-Viber-Content-Signature`; an
unsigned or wrongly signed callback is refused with 401.

How it works:

- Each signed-in account opens **Notifications** from its navigation on every portal; the email and Viber channel
  settings are in the panel beside the list (also reachable from the Account page's Notifications row). Email always
  stays on.
- **Link Viber** creates a 15-minute, single-use code and a deep link that opens the bot. The bot callback links the
  Viber user to the account's email. Only the code's SHA-256 is stored.
- Outbox rows on the `viber` channel resolve to account emails exactly like email rows. They are sent to accounts
  that linked Viber and kept it on. A row whose recipients all use email only ends `skipped`, not `failed`. Without
  `VIBER_AUTH_TOKEN` and `VIBER_BOT_URI` every Viber row ends `skipped` ("Viber is not configured").
- A user who leaves the bot (`unsubscribed`, or Viber status 5 or 6 on send) is unlinked automatically.

Verify: `notification-preference.service.test.ts` covers linking, signature refusal, single use, unsubscribe and
delivery. On a deployment, link one account, trigger a billing statement send, and check the outbox row is `sent`.

## Zoom (FR-61, UAT 7.6)

| Variable | Value |
| --- | --- |
| `ZOOM_ACCOUNT_ID` | Server-to-Server OAuth app account ID. |
| `ZOOM_CLIENT_ID` | App client ID. |
| `ZOOM_CLIENT_SECRET` | App client secret. Secret. |
| `ZOOM_HOST_USER` | Optional. The Zoom user (email) who hosts the meetings. Empty: the app owner hosts them. |

Set all three required variables or none; a partial set stops the API at start-up with the missing names.

Provider setup, once, by a Zoom account admin:

1. Zoom web portal > User Management > Roles: the role of the person building the app needs **Server-to-Server
   OAuth app: View and Edit** under Advanced features (and View/Edit Users, which Zoom requires for meeting scopes).
2. Zoom App Marketplace > Develop > Build App > **Server-to-Server OAuth App**. Name it "P.R.I.S.M".
3. Scopes: create and delete meetings: `meeting:write:meeting:admin` and `meeting:delete:meeting:admin` (older apps
   list them as `meeting:write:admin`). Activate the app.
4. Copy the Account ID, Client ID and Client Secret into the API's environment and restart the API.

How it works: PMCM opens the event's presentation meeting, picks **Zoom, Google Meet or Microsoft Teams**, and offers
two to four times. With Zoom connected, **Create the Zoom meeting when the client books a time** is ticked by default;
without it, PMCM pastes a link (Meet and Teams are always pasted). The client picks a time in the portal. P.R.I.S.M then
creates the Zoom meeting for that slot (Asia/Manila, waiting room on, host joins first), and emails the time and join
link to the client and the PMCM admins. Both can download a calendar file. If PMCM offers new times, the replaced Zoom
meeting is deleted; if Zoom refuses, the audit log tells PMCM to delete it in Zoom. If Zoom refuses to create the meeting
(wrong secret, missing scope), the client's booking is refused with Zoom's HTTP status and nothing is saved.

Verify: `zoom-meetings.client.test.ts` covers sign-in, creation, deletion and Zoom's refusals against a fake Zoom;
`presentation-meeting.service.test.ts` covers booking, emails and reschedule; `presentation-meetings-panel.test.tsx`
covers the PMCM form with and without Zoom. On a deployment: offer two times with Zoom, book one as the client, and
check the meeting appears in the host's Zoom account and the join link is in both emails.

## Canva (FR-59, New-P3)

| Variable | Value |
| --- | --- |
| `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` | The Canva Connect integration's credentials. The secret is secret. |
| `CANVA_REDIRECT_URI` | `https://<api-host>/api/integrations/canva/callback`, also set as the integration's redirect URL. |
| `CANVA_TOKEN_KEY` | 32 random bytes in base64 (`openssl rand -base64 32`). It seals the stored Canva tokens. Secret. |
| `CANVA_PROPOSAL_TEMPLATE_ID` | Optional. The brand template behind **Open in Canva** on an issued proposal. |
| `CANVA_TESTIMONIAL_TEMPLATE_ID` | Optional. The brand template behind **Make a Canva testimonial card**. |

Canva autofill needs a Canva Enterprise team. The integration needs the scopes `design:content:write`,
`design:meta:read`, `brandtemplate:content:read` and `brandtemplate:meta:read`.

Template data fields (text fields in the brand template, named exactly):

| Template | Fields |
| --- | --- |
| Proposal | `title`, `summary`, `total`, `alternative_total`, `client_name`, `event_name`, `event_date`, `version` |
| Testimonial | `testimonial`, `rating`, `client_name`, `event_name` |

How it works:

- A PMCM admin opens **Workspace settings → Canva → Connect Canva** once for the organization (Workspace settings is
  reached from the Account page). The OAuth request uses PKCE.
  Its state is single use and expires in 10 minutes. The access and refresh tokens are stored sealed with
  AES-256-GCM and refreshed when they expire.
- **Open in Canva** fills the proposal template from the latest issued proposal.
- **Make a Canva testimonial card** works only for a testimonial PMCM approved and the client agreed to share.
- Both open the new design in Canva for PMCM to finish. Each fill is audited with the Canva design ID.

Verify: `canva-connection.service.test.ts` covers the PKCE state, sealed tokens, refresh, the template gate and the
testimonial consent rule.

## Rotating a credential

Change the variable and restart the API. Rotating `CANVA_TOKEN_KEY` makes the stored Canva tokens unreadable;
reconnect Canva from Workspace settings afterwards. Rotating the Viber token keeps every link: Viber user IDs do not change.

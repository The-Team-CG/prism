# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

**Upgrading:** apply these migrations before deploying the API: `20261116090000_commercial_supplier_payout_receipts`, `20261117090000_commercial_pmcm_payment_details`, `20261118090000_commercial_statement_payment_details_revision`, `20261119090000_event-lifecycle_event_type_and_cover`, `20261120090000_platform-ops_privacy_identity_confirmation`, `20261121090000_identity-access_user_sessions`, `20261122090000_identity-access_two_factor_pending_secret`, `20261123090000_identity-access_email_change_requests`.

### Added

- The floor plan editor prints a setup drawing alongside the colour plan: the same plan as black line work on white, for the crew setting up the room and for photocopying.
- Clients see U-shape and hollow-square tables as their joined runs on the official layout, and a review note dropped inside a U pins to the floor, not the table.
- Floor plan pieces look real: in 3D, linens, sashes and seats are Pascal's woven textures in the card's colours, each chair style is drawn as itself, round cloths fall in folds, every dining seat is laid with a charger, plate, napkin, cutlery and glasses, centrepieces repeat along long tables, and string lights, LED walls and floors, uplights, ring lights and candles glow; in 2D, tables are drawn in their linen colour with covers and bold numbers, chairs in their style's colours, every service, AV, décor and safety piece as itself, and zones as tinted areas.
- The floor plan editor is one docked frame: tools, view and the plan's menu in the top bar; Library, Guests and Layers as tabs of one left panel; the inspector docked on the right (the Plan panel and every layout check when nothing is selected); room dimensions, the selection's nearest gap and a zoom control on the plan; Library tiles drawn as the plan draws them, table shapes as drawn buttons, and cloth colours as swatches.
- In the floor plan's 2D view, round-table and seating-block chairs now face their table instead of turning their backs to it.
- The floor plan Library covers what an event venue designer lays out: crescent, presidential, sweetheart, boardroom, U-shape and hollow-square tables; ceremony rows with an aisle runner; a stage with a truss backdrop, podium and camera riser; checkered and LED dance floors; bars with stools and a back bar; cake, grazing and lechon tables; projection screens, uplights and lighting truss; photo booth, lounge set, debutante's chair, gift table, welcome sign, plants and string lights; tents, umbrellas, portable toilets, generators and power points; emergency exits, queue lines, crowd barriers, wheelchair spaces and ramps; and catering prep, green room, storage and security zones. A table's card adds Tiffany and covered chairs, sashes, overlays and runners in eleven fabric colours, and real centrepieces. Table, seating block, stage, bar and dance floor nodes gain these as optional fields with defaults, so saved scenes are unchanged.
- The editor's Print menu prints the floor plan with its symbols and a scale bar, a pull sheet that counts what the plan needs brought in (tables, chairs by style, linens, sashes, centrepieces, staging, bar, AV, décor and services), and the seating list. `pullSheet` is in `@prism/floorplan-scene`.
- The Sightlines and Guest flow lenses check the layout: pieces on top of each other or chairs that collide, seated tables closer than 1.5 m, pieces outside the room, anything in an emergency exit's clear area, aisles under 1.2 m or rows over 14 seats without one, and seats whose view of the stage is blocked. Findings are listed under the lens switch. `layoutChecks` is in `@prism/floorplan-scene`.
- Plan the room, in the Library, says how many guests the free floor holds as banquet rounds, theater, classroom or cocktail, and fills it for the event's guest count in one undoable step that passes the layout checks.
- Event pieces in the floor plan editor now look like Pascal's own furniture. In 3D they are built from Pascal procedural designs and dressed in its material library: round and banquet tables sit under a floor-length cloth in the card's linen, chairs have legs, a cushioned seat and a back in their style (brass chiavari with spindles, black banquet with a padded back, clear ghost, wooden cross-back), and new rooms get a polished concrete floor. In 2D they draw in Pascal's drafting palette: white pieces with near-black outlines, light grey chairs told apart by shape, and the linen as a light ring. Pascal's editor assets (icons, lighting, sounds and the material textures) now live in `@prism/floorplan-canvas` and are copied into the event and client portals before `dev` and `build`, so nothing loads from Pascal's hosted site.
- Pascal is the only floor plan editor. The legacy canvas, `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE` and the plan `objects`/`guests`/`suppliers`/`seats` columns are gone, and clients read official layouts from scenes. Run `npm --workspace prism-api run db:convert:floorplans -- --dry-run`, then `npm --workspace prism-api run db:convert:floorplans`, before deploying migration `20261127090000_floorplan_drop_legacy_plan_columns`, which drops the legacy columns and the unused `event_instances`, `published_snapshots` and `floor_plan_objects` tables.
- Clients draw their layout preference in the Pascal editor, and PMCM saves venue templates from it: a draft started from a venue copies the venue's room layout, and template guests and suppliers are no longer offered.
- Clients see the official layout drawn from the Pascal scene, and pin review notes on it, without loading the editor.
- The Pascal floor plan editor is now an event layout tool. Its header shows the draft, save status ("Not saved · Retry", or "Changed elsewhere · Reload", which stops autosave until the plan is reloaded), undo, and 2D/3D/Split. Below the plan, a footer counts guests against seats and how many are seated. PMCM places tables, theater and classroom blocks, a stage with steps, a dance floor, bars, AV, décor and supplier zones by clicking a Library tile and then the plan. Pieces draw as event symbols (tables show their chairs and number) and as simple 3D shapes. A table's card edits its shape, size, seats, number and dressing, and lists who sits where. The Guests panel seats the event's own guest roster at the selected table under the shared seating rule. Seating and Supplier zones lenses colour the plan, and a Layers list groups the room, with hide and lock. Small screens open view-only. Roster entries gain `rsvp` and `dietary` (migration `20261125090000_operations_guest_roster_rsvp_dietary`, apply before deploying the API). Scene saves are checked against the roster, and zones may name only suppliers booked on the event.
- PMCM can open drafts in the new Pascal-based floor plan editor when `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE=pascal`; existing layouts convert on first open, and the first save stores the converted layout. Without the flag the current editor opens as before. In both editors a submitted or approved draft now opens read-only, since the API already refused saves to it. Plans gain `scene` and `scene_format` columns (migration `20261124090000_floorplan_floor_plan_scene`, apply before deploying the API); `PUT /plans/:planId` accepts a `scene`, checks it and the seating rules, and refuses one sent with `objects`; submitted and approved snapshots carry the scene. New package `@prism/floorplan-scene`; `@prism/floorplan-canvas` gains `/editor` and `/plugin` (ADR-0010).
- Account page on every portal: name, email, password, two-step sign-in, devices, recent sign-ins and notification channels, each edited in a side panel.
- People can change their name and password, see recent sign-ins, and sign out other devices; menu sign-out now ends only the current device.
- Optional two-step sign-in (authenticator app) for clients, suppliers and coordinators; PMCM staff keep it required, and PMCM can reset it for any account.
- Self-service sign-in email change, confirmed by a link to the new address; events, records, notices and privacy requests move with the account.
- Events and bookings are cards with a cover image, countdown, stage and what is waiting; PMCM Events opens on the events that need action.
- One notification center on every portal, with acknowledgment, unread counts and channel settings.
- One Messages inbox across events, with search, paging, member management, closing, file attachments (up to 10) and read receipts for PMCM.
- One file library for clients, suppliers and PMCM, with a PMCM review queue, ZIP download, file reuse across events and valid-until dates with expiry reminders.
- Unfinished uploads are cleaned up after three days (`PRISM_DISABLE_ABANDONED_UPLOAD_CLEANUP_JOB=1` turns it off).
- PMCM payment details (bank, e-wallet and cheque accounts with QR images) that statements and the client's "How to pay" use.
- Clients see billing across events and report payments with proof; PMCM verifies them before they count.
- A PMCM Finance desk across events, with a work queue, bulk verification, client reminders, payment history, charts and a spreadsheet export.
- Branded PDF statements, statements of account and receipts.
- Suppliers see payouts per booking, confirm receipt and attach their official receipt.
- The `portal-uat` seed covers every billing state, payment details, notices and a cover per event type.
- Signed-in pages share a soft pastel background.
- Clients follow milestones, submit briefing and layout preferences, sign conformes and addenda, and track billing.
- PMCM plans events with versioned templates, schedules, handoffs and closeout records.
- PMCM finance reconciles receipts, refunds and disputes.
- Guests check in with consent, give feedback within seven days, and play event games.
- Notices record per-recipient delivery, acknowledgment and escalation ([operational communications](docs/runbooks/operational-communications.md)).

### Changed

- Privacy is one status-first screen for clients and suppliers: requests are confirmed with the account password, can be withdrawn, and include an instant "Download my data now".
- PMCM's privacy console is tabbed: Queue, Log a request, Legal holds and Retention.
- One calendar on every portal (Month, Week, Day, Agenda), with payment states and links that keep the view in the address.
- Files, billing cards, work lists and page titles look and behave the same on the client, supplier and PMCM portals.
- Portals share page and transport patterns; shared write contracts are Zod schemas in `@prism/types`.
- Cross-context writes go through owner capabilities; role-scoped reads compose in `read-models`.
- One canonical `DATABASE_URL`; local fixtures run only through guarded seed commands ([environments and fixtures](docs/runbooks/environments-and-fixtures.md)).
- Migration history starts from seven owner-scoped baselines; existing databases need a verified backup and approved rebuild to adopt it ([database migrations](docs/runbooks/database-migrations.md)).
- Legacy `Private` inquiry categories map to `Individual`.
- AI activation follows the [AI data policy](docs/product/ai-data-policy.md) and [provider routing runbook](docs/runbooks/ai-provider-routing.md).
- Documentation is consolidated and verified against the code.
- The UAT bank covers the new flows (56 modules, 242 cases); `uat/UAT-question-bank.md` is generated from `uat/uat-test-cases.gs` and checked in CI.

### Fixed

- The nightly Lifecycle E2E passes again (476 checks). It builds floor plans as Pascal scenes, turns on a PMCM payment method before issuing statements, and counts a capability as reachable from a portal when the portal calls the `@prism/api-client` method that wraps its route (`scripts/e2e/lifecycle/portal-wiring.mjs`), instead of looking for the route spelled in portal code.
- Guest portal `.tsx` tests now run.
- PMCM can share files from an event's Files page.
- "Show older notifications" stops at 200 notices, and a failed load offers Try again.
- Billing balances reflect recorded payments; signing a conforme no longer creates billing.
- Audit hashes match PostgreSQL JSONB ordering ([audit-chain repair](docs/runbooks/audit-chain-repair.md)).
- Responses enforce event access and omit private PMCM details; sensitive mutations need a verified actor.

### Security

- The CI dependency audit tolerates GHSA-fc5q-39xc-vjpf (dev-only picomatch) until 2026-12-18; every other moderate-or-higher advisory still fails.
- Privacy exports, corrections and erasure need approved, scoped requests and respect legal holds.
- File access checks event scope, visibility, content and object identity; payment evidence is PMCM-only.

### Removed

- Sample API routes and browser-local demo fallbacks.
- Unused API ports, DTOs, portal primitives, dependencies and UI exports.
- `uat/PRISM-UAT-Form.xlsx`, replaced by the Google Form.

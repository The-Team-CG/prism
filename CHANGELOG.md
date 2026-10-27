# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- CI runs on Turborepo properly. Lint, typecheck, every workspace test suite and the build go through turbo with a cached `.turbo` between runs, so unchanged workspaces are replayed instead of rerun. Pull requests run turbo tasks only for the workspaces they change and their dependents; pushes to `staging`, `prod` and `main` run everything. Lint now runs in CI for the first time, and `@prism/floorplan-canvas` tests join CI. Shared packages no longer typecheck twice, and root config changes (`tsconfig.base.json`, `eslint.config.mjs`, `.nvmrc`) invalidate the cache. New root scripts: `npm run lint`, `npm run test:ci`.

- The API now enforces the privacy notice. A signed-in account that has not acknowledged the current notice gets `403` with `code: "privacy_notice_required"` on every session-guarded route, except `GET /auth/me`, `POST /auth/logout` and `POST /auth/privacy-notice/acknowledge`. The client, supplier and event portals send such users to `/privacy`. Local fixture seed users are left unacknowledged, so they see the notice once. Owner D (Anthony).

- Signed-out visitors to dashboard pages are redirected to sign-in before the page renders, so the dashboard frame no longer flashes. The client, supplier and event portals cover `/dashboard` (and the client `/conforme` page), and the guest portal covers `/dashboard`. Sign-in now sets a navigation cookie per portal that holds only the session expiry; the API still checks every request. **Users signed in before this update must sign in once more.** Owner C (Ethan).

- Outbox notifications with email channel are now sent. Each recipient resolves when it is sent: an email address, `PMCM Admin` or `pmcm-inquiry-desk` (every approved, unlocked PMCM admin), `Coordinator` (coordinators actively assigned to the event) or `Client` (the event's inquiry email). Unknown recipients, empty role lists and non-email channels fail with a reason shown on the notification. Quote, payment and coordinator notices now address the supplier's or coordinator's email instead of a display name, and payment notices go to PMCM Admin in place of the unresolvable `Finance` label. Email uses the configured `PRISM_MAIL_TRANSPORT`, so no new deploy settings are needed. Owner D (Anthony).

- After sign-in, client, supplier and PMCM accounts that have not acknowledged the current privacy notice see it before reaching their portal. Every portal, guest included, has a public `/privacy` page, and the guest open-pass link now opens it. Client sign-up copy now says accounts are created when PMCM accepts the inquiry. Owners A (Maxine) and D (Anthony).
- Every account now sees a versioned privacy notice on first sign-in (requirement New-SEC2). Sign-in and `/auth/me` report `privacyNoticeRequired`, and `POST /auth/privacy-notice/acknowledge` records the current version. Consent forms must send the current notice version, and an outdated version is refused. The notice text is a draft for PMCM to review before launch. Deploy: run `prisma migrate deploy`. Owner D (Anthony).

- Accounts can now be created and activated. When PMCM accepts an inquiry, the client gets a single-use activation link that expires after seven days, to set a password and review and sign the conforme. The inquiry tracks the invitation as sent, opened or expired, and PMCM can re-send it from the inquiry. Signing the conforme does not send anything. An approved supplier application creates the supplier's login. PMCM admins can invite `pmcm-admin` and `coordinator` staff and re-send a pending invitation. Activation sets the first password with the password-reset rules, and an account with no password cannot sign in. Owners B (Francis) and D (Anthony).

- PMCM admins can re-send an approved supplier's login from its application, for example after a login could not be created. Invitations are refused for accounts that are not approved, and the audit trail names the person who sent them.

- **Deploy step:** `PRISM_GUEST_PORTAL_URL` is no longer read or required by the API. Remove it from the hosted API environment or leave it unset.

- Password reset emails are sent through Resend (approved 2026-10-25). Account invitations use the same transport. Outbox notifications stay gated until their recipients resolve to real addresses, and Viber and other channels remain gated. Each reset link goes to the portal for the account's role. Guests, system and unknown accounts get no link and the same generic response. The reset response no longer includes `deliveryAvailable`. The API refuses to start without `PRISM_MAIL_TRANSPORT`, which is `resend` in deployments (`log` writes mail to the API log for local development only and is refused under `NODE_ENV=production`), plus `RESEND_API_KEY` and `PRISM_MAIL_FROM` for `resend`, and the four portal origins `PRISM_CLIENT_PORTAL_URL`, `PRISM_SUPPLIER_PORTAL_URL`, `PRISM_EVENT_PORTAL_URL` and `PRISM_GUEST_PORTAL_URL`. Portal sign-in and wrong-portal links read `NEXT_PUBLIC_*_PORTAL_URL` with no localhost defaults. **Deploy steps:** (1) verify the `PRISM_MAIL_FROM` domain in Resend; (2) in the hosted API environment set `PRISM_MAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `PRISM_MAIL_FROM` and the four portal origins, and remove `PRISM_PORTAL_RESET_URL`; (3) deploy the API. No migration is required. Owner D (Anthony).

- Removed the remaining configuration fallbacks in the API. `JWT_SECRET` is no longer read anywhere: **deploy step:** rename it to `PRISM_SESSION_SECRET` (same value, at least 32 characters) in the hosted API environment before deploying, or the API refuses to start. `PRISM_SESSION_TTL_SECONDS` is now required (28800 is eight hours; per-role `PRISM_SESSION_TTL_SECONDS_<ROLE>` overrides stay optional). Approval requests must send `privacyNoticeVersion`. Password reset requests use the client address Express resolves and fail with a server error when none is available. The built-in test-mode session secrets are gone: tests supply their own. Owner D (Anthony).

- Hardened operator sign-in and account administration. Approval requests return one generic receipt for every account state and no longer reveal or reopen accounts. Sign-in checks the password before disclosing a lock and verifies unknown emails against a fixed hash. A successful sign-in clears lock counters, and password reset clears permanent lockout. PMCM admins can unlock accounts and reset two-factor enrolment, both audited. `POST /api/auth/logout` revokes every open session of the caller, including sessions on other devices, and `GET /api/auth/me` returns the current identity. Operator password hashes use one parameterised scrypt format. **Deploy requirement:** run `npm --workspace prism-api run db:migrate:password-hashes` against the target database before the API starts; the API refuses legacy and plaintext values. `PRISM_TRUST_PROXY` is now required (`false`, `true`, `loopback`, or a hop count) so rate limits key on the real client address behind a proxy; local and Docker env generation sets `false`. Owner D (Anthony).
- Auth screens in the client, supplier, guest, and event portals share a split layout with a portal-coloured brand field (`@prism/ui/auth-shell`). Password reset is a three-step flow with a live password checklist and one check-your-email message that never reveals whether an account exists. Event 2FA setup shows a QR code, an authenticator link, and a Start over action. Sign-in redirects accept only same-origin paths, an expired or rejected session is signed out and returned to sign-in, and client sign-up points to PMCM account guidance. The "Wrong portal?" links need the four `NEXT_PUBLIC_*_PORTAL_URL` variables. Owners A (Maxine), C (Ethan), and D (Anthony).

- Added the PMCM supplier workspace in Event Command: a paged directory with private supplier performance and certification details, event engagement history, reviews, and profile actions. Supplier self-service remains in the supplier portal. Owners A, B, and D.

- Added idempotent UAT seed migrations for test cases 67–198, including event workflows, supplier requests and bookings, guest registration and games, coordinator operations, and privacy review. Owner D (Anthony).
- Added a Google Forms UAT builder with role-specific module selection, ratings grids, required module comments, and one module per submission. Owner D (Anthony).
- Guest deletion now resolves one roster identity and redacts only its linked records; ambiguous or unlinked records require individual review and leave the request approved. The ledger now reflects implemented guest correction. Owner D (Anthony).
- Updated vulnerable dependencies, removed unused Next.js lint presets, and made the dependency gate reject moderate or higher alerts without advisory exceptions. Portal lint commands use the active repository ESLint configuration. Owner D (Anthony).

- Database tooling recognizes Supabase poolers by complete hostname labels, and public inquiry links handle long trailing-slash inputs without regex backtracking. Owner D (Anthony).

- Updated Vite test tooling to resolve the Windows editor-command security advisory and restore the dependency audit gate.

- Main-branch promotions now run the same build, security, migration, and behavior checks as staging and prod.
- PMCM retention policies and record review now sit alongside the paged privacy request console and legal holds.
- The feature ledger records integrated controls and remaining acceptance and policy gaps, including floorplan eligibility, addendum signing, and billing correction approval.
- Scope change requests and event risk level (FL-025). The primary client can request a scope change for their event, see its status and PMCM's client response, and withdraw it while it is still submitted. PMCM reviews it with a required impact review and, on a frozen event, a single-use approved freeze exception; rejections need an internal reason. PMCM records the authoritative event risk level beside a suggestion from open compliance risks, and lowering the level requires a reason. Both stay hidden from clients, suppliers, coordinators, and guests. Owners B (Francis), C (Ethan), and D (Anthony).
- Privacy retention is now PMCM-managed: each retention category has a persisted policy (seeded disabled) that PMCM admins can enable and tune with a reason and revision history. A scheduled sweep only queues records past retention for a review queue; it never deletes or anonymizes on its own. Operators execute or dismiss items, execution re-checks legal holds (active holds mark items held), runs atomically per item, and is audited with counts only. Owner D (Anthony).
- The PMCM privacy console moves to its own Privacy page in the event app. Requests carry a 30-day SLA deadline (set when logged, backfilled for existing requests) and show overdue state in plain text; the queue is filterable by status, type, subject, deadline, and owner, paged, and each request can be assigned to or unassigned from an approved PMCM operator (audited by id). Approved guest correction requests now update the subject name, and roster email where present, on the event's roster, check-in, and feedback rows, blocked by legal holds and refused when the corrected name collides with another guest in the same event. The audit trail links to the console instead of embedding it. Owners D (Anthony), with A (Maxine) for the console UX. The 30-day SLA default needs confirmation by D.
- PMCM manages event file requirements: the matrix merges PMCM overrides (owner, visibility, required state, due date, PMCM-only notes) and custom requirements onto derived items, and client views show required state, due date and overdue flags. Clients and suppliers never see matrix items outside a requirement’s visibility; signed conforme and billing statement downloads are refused to roles PMCM has hidden them from. Upload, download authorization, and delete are audited with metadata only. A scheduled sweep queues idempotent reminders to the owner and PMCM for overdue or rejected required files. The override table is an additive migration (`20261019120600_event-lifecycle_file_requirement_overrides`) and must apply before the API deploys. Owners D (Anthony), with A, B, and C.
- PMCM has a read-only Decision log tab per event that lists postponements, cancellations, freeze exceptions, addenda, archive and compliance overrides, risk changes, ocular and billing waivers, billing corrections, payment-terms overrides, task reassignments, and inquiry merges, newest first, with a kind filter and paging. Reasons come from each source record; audit rows only attribute the actor. Coordinator, client, supplier, guest, and unverified actors are refused and the refusal is audited. Owners B (Francis) and D (Anthony).
- Event-day teams get a time-ordered run sheet (FL-026, owner goals A, B, D): `GET /events/:eventId/run-sheet` now returns merged `entries` built from schedule segments, supplier ingress/egress windows, open task due times, and open issues, sorted by time with fixed tie-breaks, for the requested or current schedule day. PMCM opens a print-friendly sheet at `/dashboard/events/[eventSlug]/run-sheet` (linked from Live ops), with a now marker and overdue highlights. Coordinators see the same sheet on their desk, limited to their assignment: supplier windows only for the designated operator and ingress/egress roles, and no supplier, escalation, or attendance notes. The route now lives in the `read-models` context. An unknown `dayId` returns 404 instead of falling back to the first schedule day.
- The supplier readiness board now lists every assignment, grouped by event. Each item shows the ingress and egress times, whether the schedule revision is acknowledged, a late-ingress flag that uses the same grace window as the late sweep, open concerns (schedule change requests, contract corrections, event-day notes), and a setup status. Each item opens Quote requests or Bookings, the sections where that work is done. PMCM's event supplier readiness panel now reads the same server items from a new PMCM-only `GET /api/pmcm/events/:eventId/supplier-readiness`, instead of recomputing readiness in the browser, and keeps the category-gap hard block. PMCM verification notes and the verifier's name appear only in that PMCM read; they are removed from the supplier readiness board and the supplier workspace. Owners B (Francis), C (Ethan), and D (Anthony).
- Supplier-facing quote, assignment, readiness, contract, event-day status, and quote token responses no longer include PMCM verification notes or the verifier's name; the PMCM readiness read keeps them. Owners C (Ethan) and B (Francis).
- PMCM `/dashboard` now pairs the command inbox with the selected event's status summary instead of generic totals, and the inbox lists overdue or blocked event-day tasks and open urgent issues as `live_ops` work. A live-ops sweep queues one PMCM outbox notice per overdue task, keyed by task and due time so reruns never duplicate it (`PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB=1` disables it). The client dashboard opens on the action center, which shows "No pending actions" when nothing is due, asks for post-event feedback until it is submitted, and shows change request status without PMCM reasons or notes (goals A, B, C, D).
- Hardened the API: it now refuses to start without `DATABASE_URL` and a 32+ character `PRISM_SESSION_SECRET` (or `JWT_SECRET`) and lists every invalid variable; the built-in session secret now works only under `NODE_ENV=test`, and `start-prism` already generates a local secret. Public login, 2FA, password-reset, account-approval, inquiry, supplier-application, and quote-request token routes are rate-limited per client address and answer 429 with `Retry-After`. Responses carry helmet security headers. Prisma not-found and unique-conflict errors return 404 and 409 instead of 500. Unexpected 5xx errors are logged by route pattern, without request bodies, tokens, or internals in the response. SIGTERM runs shutdown hooks. CORS no longer allows the unused `localhost:3000` origin. Owner D (Anthony).
- Client layout preferences stay client-owned through submission and revision: reopened preferences resubmit through the preference workflow, pending revisions close when an official plan is approved, and preference submissions do not hide an official plan under review. PMCM retains read-only access to legacy approved layouts, and clients retain their shared snapshot access. Owner C (Ethan).
- Removed unused API ports and DTOs, unused portal UI primitives, and unused packages (MUI/emotion, motion, recharts, date-fns, react-hook-form, and related UI libraries, plus the `@prism/ui` client-blocks module and seven unused subpath exports). Smaller dependency tree and bundle surface; no behavior change for users or developers.
- PMCM official floorplan saves now reject seat assignments that break table eligibility (unknown or declined guests, non-table or hidden objects, and tables over capacity) with a user-safe 400, and the saved plan contract carries the editor's object and guest shape. Plans saved without seat assignments still save. Owner B (Francis).
- PMCM can request an addendum conforme for an issued addendum. The client acknowledges that version's immutable, hashed document first, PMCM then countersigns, and the addendum's billing line records the executed version. A signed version is never replaced; a new addendum version gets its own conforme. Owner B (Francis), support D (Anthony).
- PMCM billing corrections need a second PMCM approver: approving a correction you requested is refused (403) and the panel disables Approve on your own requests, while you can still reject (withdraw) it. Corrections record the requester's verified id; older corrections match on the requester name. Owners B (Francis) and D (Anthony).
- PMCM can execute approved privacy access/export requests: the subject's own inquiry, event, billing, supplier, guest, and account records are returned once as a JSON bundle, with per-owner audit counts and no record contents in the audit trail. Native-account erasure for client, supplier, and account subjects redacts owner surfaces and the account row atomically, revokes sessions, and is blocked by matching legal holds; staff accounts are refused. PMCM can apply an approved correction as an explicit, validated name/email patch to the subject's own client, supplier, or account records in one transaction; audit entries list changed field names only. Owner D (Anthony).
- Official floorplan drafts can start from a PMCM venue-library preset (`venueTemplateId`); the API copies the preset's layout server-side, so client-sent objects cannot replace it. The floorplan editor now refuses table assignments that break eligibility (declined or unknown guest, non-table or hidden object, no free seat) and leaves the layout unchanged. Clients remain denied from presets and official layout mutation. Owner B (Francis), with C and A.
- Approving a supplier application now records a separate audit entry when it creates the supplier directory record, and approval replays stay silent. PMCM allows only one assessment per supplier per event, enforced by a database unique index; a retry with the original idempotency key still replays. PMCM assessments must rate every active category dimension; the server rejects incomplete or foreign dimension sets, and the closure and directory assessment forms block submit until they are complete. Supplier workspace responses are covered by a test that excludes PMCM-only assessment data. Owners C (Ethan), B, and D.
- Added PMCM risk and change register controls: frozen events require an approved, event-scoped freeze exception before a cancellation or postponement is recorded, and each approval is single-use. PMCM records decisions with an explicit coordinator, supplier, and billing impact review, and can approve or reject exception requests (rejections require a reason). Clients see a client-safe status for change requests that affect their event, without internal reasons. Owners B (Francis) and D (Anthony).
- PMCM can merge a same-organization or same-email inquiry into a primary inquiry from the inquiry inbox, with a required reason, merge history on both records, and an audit entry. Merged and accepted inquiries cannot be re-merged or re-triaged. Duplicate, previous-decline, parallel-organization, and high-fit cues appear in the inquiry drawer, and PMCM notifications are queued for duplicate and deterministic high-fit inquiries. Public inquiry responses no longer echo PMCM triage fields, and the public schema no longer accepts logged-by fields. Owner B (Francis), with support from C and D.
- Added a PMCM-recorded logistics completion record (asset returns verified, audited, correction reason required on replacement). The archive close gate now reads this record instead of always reporting logistics missing, and PMCM can compare 2 to 4 archived events side by side. The wrap-up logistics row mirrors this record and is no longer editable there. Private notes and logistics notes stay out of client, supplier, and comparison payloads. Owner B (Francis), support C and D.
- PMCM finance can record and resolve billing disputes, request statement corrections and approve or reject them (rejection requires a reason), issue additional billing against an approved source, and waive it with a required reason. Additional billing must trace to an approved billing source of the same event. Clients see dispute status and amount only (no PMCM reasons or actors). Upcoming-balance and overdue-milestone reminders enqueue in the notification queue only, once per milestone. Owner B (Francis), with C and D.
- Applied the W08 event authority and lifecycle policy: guest feedback stays open until exactly seven days after the recorded actual event end, including after archive, while check-in stays closed for archived events. New inquiries use the Corporate, Government, Individual, and Non-profit categories; legacy Private values become Individual through a non-destructive data migration, and School and Other records stay readable. Only the PMCM-designated Event Day System Operator may mark another coordinator's attendance, and revoking the designation ends that authority immediately. Owners B (Francis) and D (Anthony), with support from C (Ethan).
- Added client and supplier file upload/download with verified content, scoped visibility, immutable object identity, and local/private Supabase adapters. Fixed the API response interceptor to preserve binary file streams. Owners C (Ethan) and D (Anthony).
- Added supplier contract versions and correction reviews, ingress/egress revision acknowledgments and change requests, creative task submissions and reviews, and payable milestones with actual releases and reasoned reversals. Payment status comes from recorded releases; quote locking does not mark a payment paid. Owners B (Francis), C (Ethan), and D (Anthony).
- Added client briefing submission, official-floorplan snapshot decisions and annotations, versioned venue/styling reviews, deliverable and closeout acknowledgments, client feedback, and consent-based testimonial moderation. PMCM retains official-layout ownership. Owners A (Maxine), B, C, and D.
- Added immutable conforme template prefill and client-first/PMCM countersignature evidence, with event activation only after the signed gate. Added isolated database tests for signing activation, supplier workflow history, payout concurrency, and stale floorplan decisions. Production provider activation remains separate.
- Fixed audit metadata hashing to survive PostgreSQL JSONB key ordering, including nested objects. Previously valid persisted hashes remain compatible; mismatched historical records still block writes and require integrity review. Added a rolled-back PostgreSQL regression test without rewriting audit history. Owner D.
- Added distinct event Files navigation, persistent client conforme entry, and floorplan load retry. Supplier task retries cannot duplicate an assignment, unchanged schedule publication preserves acknowledgments, and signed storage URLs must match the configured project and exact object path.
- Adapted portal persistence to staging's owner schemas and transaction-aware owner capabilities. Portal database behavior suites now run in the standard isolated PostgreSQL CI job. Updated Sharp and shell-quote to patched versions required by the dependency gate. Owner D.
- Fixed fresh-database drift from the owner-schema rebaseline: restored canonical account email constraints, initialized the audit chain lock, and aligned roster consent columns with the Prisma schema. Existing case-colliding accounts abort the migration for manual resolution. Owner D.

- Fixed supplier storage identity and current contract-review status, restored existing conforme executions on dialog reopen, and linked archived client history to consent withdrawal. Owners C and D.

### Added

- PMCM and assigned coordinators can open a selected-event handoff brief composed from scoped read models: key details, schedule, supplier readiness and ingress, staffing, open issues, file status, and recorded handoffs. The coordinator view is a strict subset with no finance, private supplier notes, audit categories, client identity, or guest access codes.
- The API and four role portals can deploy as one Vercel project, with runtime API bindings and shared-domain portal routing.
- Development launchers start persistent local Supabase, isolate API/database targets, and support scoped Docker builds and source syncing.
- Guest check-in preserves consent evidence and safely retries submissions under the New-CL1 review policy.
- Clients can track source-backed planning milestones and required next actions in their event workspace.
- PMCM can enable client-visible event-day progress, which exposes only a generic status.
- Clients can request an ocular visit; PMCM can schedule, complete, or waive it with an audit reason.
- Official floorplan writes enforce the ocular completion/waiver gate; PA-59
  governance remains open in the feature ledger.
- PMCM has a paged action inbox that loads event details after selection.
- PMCM can match coordinator suggestions to event skills, availability, and date conflicts.
- PMCM and coordinators can manage event-day schedules and operator handoffs.
- PMCM can log urgent issues and record event attendance.
- Coordinators can submit end-of-day reports for their assigned events.
- Registration staff can import and search rosters, verify guests, and check them in.
- Walk-ins follow PMCM policy and consent.
- PMCM can configure and host 12 Active (Multiplayer) and Independent (Singleplayer) game templates; guests join multiplayer sessions by PIN and play independent games from the event lobby.
- PMCM Admins retain game responses for one year after moderation or event archive; expired response content is redacted while moderation decisions remain recorded.
- Guests can submit feedback for seven days after the recorded event end, and PMCM can moderate it.
- Assigned suppliers can submit or revise quotes through expiring, revocable request links.
- PMCM can review supplier readiness for assigned suppliers.
- Supplier ingress monitoring flags late arrivals against scheduled times.
- Clients, PMCM, and assigned suppliers can exchange event-scoped messages with durable read state.
- Compliance runs retain their trigger, timestamp, result, and reasoned PMCM overrides.
- Event-file metadata records upload and confirmation state with server-side scope and content checks.
- PMCM admins can place or release privacy holds for a subject, optionally
  scoped to one event. An active hold blocks redaction.
- Development can select configured synthetic AI routes. Mock remains the default,
  and real-data AI remains disabled.
- Operators have a preproduction-only, backup- and approval-gated command to
  repair and checkpoint legacy audit chains.
- Shared game-entry contracts distinguish PIN joins for Active (Multiplayer) sessions from
  Independent (Singleplayer) event-lobby starts and reserve a separate participant-session key.
- The event-games API context authorizes host writes by verified event access and records their audit details.
- Guest game-action contracts reject client-supplied identity, score, timing,
  and moderation fields; scoring fails closed without a registered template rule.
- PMCM hosts can moderate submissions, remove participants, and assign recorded
  awards; PMCM Admin can review retained responses through a paginated event-scoped route.
- The event-games API exposes host-only participation and completion aggregates
  without returning participant-level details.
- Event-game APIs accept bounded PNG/JPEG media references; participant-session
  credentials receive scoped, short-lived reads, while general file listings hide
  these assets and generic downloads deny them.
- Organizers can configure private Would You Rather polls and This or That (Solo)
  rounds with a separate guest opt-in for anonymous aggregate results; neither mode
  creates competitive rankings.
- PMCM can manage event game drafts, host sessions, rotate one-time PINs, inspect
  aggregate analytics and leaderboards, moderate retained responses, and assign
  event-scoped points, badges, or prize records. Hosts can configure and publish
  Live Trivia, Bingo, Guess the Picture, and Spin the Wheel; game rules verify
  answers, calls, image guesses, and persisted wheel results on the server.
- Guests can play those four Active (Multiplayer) templates through the shared
  session view, while the host dashboard exposes round context and a paused-only
  trivia answer reveal.
- PMCM can select an audited lobby theme and upload an event-scoped logo; public
  game views receive allowlisted colors and signed storage URLs instead of
  arbitrary CSS or external image URLs.
- Host and participant game views refresh session state while visible, and round
  countdowns use server timestamps.
- Guests can join Active (Multiplayer) games by PIN or open an event lobby for
  available Independent (Singleplayer) games, with anonymous event-scoped access.
- Hosts can configure This or That, Family Feud, and Split the Room with server-validated votes, team assignments, score rules, and bounded response text.
- Family Feud alternatives remain unscored until a host matches them to a configured answer or records no award; the decision and board-derived points are stored together and reflected in the team score.
- Split the Room responses stay private until a host approves them; guests see approved responses only after the host pauses the round. Participant answers and votes use persistent event-scoped rate limits.
- Hosts select one server-randomized Spin the Wheel outcome for a live session; guests see the shared result and privacy-safe competitive standings, while solo choices remain participant-private.

### Changed

- Replaced 102 pre-production migration folders with seven owner-scoped schema
  baselines. Fresh databases get 94 tables, 1,191 columns, 76 same-domain
  foreign keys, and no cross-domain foreign keys. Existing databases require
  a verified backup and approved rebuild before adopting the new history.
- Cross-domain writes use owner capabilities; role-scoped reads compose through
  read models.
- Shared write contracts use Zod schemas in `@prism/types`.
- Portal HTTP calls live in feature data adapters.
- Archived events remain available for authorized history; operational writes are blocked.
- Local sample data is available only through the guarded fixture seed command.
- Contributor documentation separates release notes from structural documentation history.

### Fixed

- The Vercel services deployment serves the client landing page at `/`.
- The API starts from Vercel's bundled build: floorplan composition and billing storage injection no longer read circular imports before they finish loading.
- Client portal installs declare their UI test dependencies, so scoped deployment builds and tests no longer rely on the PMCM workspace.
- Vercel services share one complete workspace install with build tooling, located from any service directory, so builds find Turborepo and packaging keeps every service's dependencies.
- Secret scanning recognizes the immutable identity-access migration checksum as a content hash.
- API startup resolves context contract tokens and privacy module database dependencies.
- Event-game PIN issuance, joining, and rate limiting inject their clocks through the shared game clock token.
- Event-games controllers resolve the shared event-session guard and authentication providers in their module context.
- Signing a conforme no longer creates fabricated billing.
- Client billing balances now use recorded payments.
- Floorplan approval rejects a draft changed by a concurrent client revision.
- Replaying an idempotent command no longer duplicates event decisions,
  reliability notes, audit records, notifications, or event-day logs.
- Audit hashes use PostgreSQL-compatible JSONB ordering; verification continues
  to accept valid legacy chains.

### Security

- Sensitive mutations require a verified actor and event scope.
- Account approval changes revoke active sessions, and password-reset tokens are single-use.
- PMCM two-factor challenges are bound to the account session epoch.
- Public guest lookup and write endpoints are rate-limited; denial logs use
  hashed client addresses.

### Removed

- Retired broad sample API routes and browser-local demo fallbacks. Guarded local
  fixture seeding remains available.
- Removed stale Playwright CLI snapshots, a duplicate one-off TODO, and
  superseded dated review reports. Open ocular governance remains in the
  feature ledger.

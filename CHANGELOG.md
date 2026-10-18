# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Added a PMCM-recorded logistics completion record (asset returns verified, audited, correction reason required on replacement). The archive close gate now reads this record instead of always reporting logistics missing, and PMCM can compare 2 to 4 archived events side by side. The wrap-up logistics row mirrors this record and is no longer editable there. Private notes and logistics notes stay out of client, supplier, and comparison payloads. Owner B (Francis), support C and D.
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

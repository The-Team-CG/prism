# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Changed

- The schema target assigns 94 business tables and 1,191 columns to seven owner
  schemas, with 76 same-domain foreign keys and no cross-domain foreign keys.
  Applying the cutover to a shared database remains a separate operation.
- Cross-domain writes use owner capabilities; role-scoped reads compose through
  read models.
- Shared write contracts use Zod schemas in `@prism/types`.
- Portal HTTP calls live in feature data adapters.
- Archived events remain available for authorized history; operational writes are blocked.
- Local sample data is available only through the guarded fixture seed command.
- Contributor documentation separates release notes from structural documentation history.

### Fixed

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

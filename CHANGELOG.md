# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Assigned coordinators can read and reply in conversations they belong to without starting new ones. PMCM can see which members have read its messages; other roles' responses do not expose those read times.

- Chat notices include a link back to the recipient's conversation that survives sign-in. Messages offers Viber linking when configured, and the notification inbox combines channel copies while retaining each delivery's receipt checks.

- Signed-in client, supplier, PMCM/coordinator and guest-pass pages share a soft pastel mascot-and-doodle background, with opaque cards and headers keeping event work readable.

- Clients can follow event milestones, submit briefing and layout preferences, review official floorplans, sign conformes and addenda, track billing, and request an ocular visit. PMCM retains ownership of official plans and event decisions.
- PMCM can plan events with versioned task templates, previewed date changes, supplier readiness and file requirements, event-day schedules, coordinator handoffs, and archive closeout records.
- PMCM finance can reconcile external receipts, apply and reverse payments, record refunds, review billing disputes, and attach private payment evidence. Clients can view published statements with payment and refund history.
- Guests can check in with consent, submit feedback within the event’s seven-day feedback window, and play event games. PMCM controls game sessions, moderation, retention, and event-scoped access.
- Signed-in users can view and acknowledge their own notices. PMCM can inspect provider outcomes, retry failed delivery, and escalate notices that miss acknowledgment deadlines. See the [operational communications runbook](docs/runbooks/operational-communications.md).

### Changed

- Messages opens as one inbox across events for PMCM, clients and suppliers, with the event named on each conversation; an event's own Messages tab still shows only that event. People in a conversation see each other's names (never emails). On phones an open conversation fills the screen with the composer in view, and Enter starts a new line. `GET /communication/inbox` returns the signed-in account's conversations with their latest message. Each new message now notifies the other members by email and, where linked, Viber, naming the sender and conversation and quoting the start of the message; the in-portal notice opens that conversation. Without a configured Viber bot, Viber notices are now skipped instead of failing.

- Portal calendars combine softer date headers, lightly textured weekends and tinted event blocks with compact, collapsible highlights. Day opens a single-date agenda with all-day entries first, timed entries in order, daily navigation and an optional time grid on desktop and phones. Month, Week and the longer Agenda remain available; date-based schedules open on Month and timed coordinator schedules on Day. Search, filters, detail actions and Manila time stay together; phone highlights start collapsed.

- Portal audit fixes put Music in the top bar, keep mascot backgrounds quiet behind headings, and improve mobile tabs, tables and assignment cards. Client approvals and home emphasize the next action; PMCM navigation removes placeholder views and separates archives; supplier work is grouped and guest controls share the portal styling.

- The four portals use shared page and transport patterns while preserving role-specific workflows. New portal HTTP calls use `@prism/api-client` from feature data adapters; shared write contracts use Zod schemas in `@prism/types`. Signed-in screens also share a neutral visual system and role-specific navigation.
- Cross-context writes use owner capabilities, and role-scoped reads compose through `read-models`. Archived events remain available for authorized history, while operational writes are blocked.
- Local and deployment setup use one canonical `DATABASE_URL`; local fixtures run only through guarded seed commands. See the [environment and fixture runbook](docs/runbooks/environments-and-fixtures.md).
- The pre-production migration history uses seven owner-scoped schema baselines instead of 102 folders. Existing databases must not adopt the replacement history without a verified backup and approved rebuild; replacing migration history does not alter an existing database. See the [database migration runbook](docs/runbooks/database-migrations.md).
- The inquiry-category migration maps legacy `Private` values to `Individual`; `School` and `Other` remain readable. Existing UAT fixture dates may retain prior local-midnight values until reseeded.
- AI data handling and activation prerequisites are defined in the [AI data policy](docs/product/ai-data-policy.md); provider-specific qualification gates are in the [provider-routing runbook](docs/runbooks/ai-provider-routing.md).
- Consolidated the unreleased changelog into notable user and developer effects and removed duplicate delivery, test, and commit diary entries. Detailed history remains in Git.

### Fixed

- Billing balances reflect recorded payments, and signing a conforme no longer creates fabricated billing. Idempotent command replays do not duplicate event decisions, audit records, notifications, or event-day logs.
- Audit hash verification matches PostgreSQL JSONB ordering and accepts valid legacy chains. A mismatched historical chain still blocks writes and requires integrity review; see the [audit-chain repair runbook](docs/runbooks/audit-chain-repair.md) before repair.
- Public and role-scoped responses enforce event access and omit private PMCM details. Sensitive mutations require a verified actor and event scope; authentication and public entry points have rate limits and session protections.

### Security

- Privacy exports, corrections, and account erasure require approved, scoped requests. Legal holds block matching erasure, staff account erasure is refused, and audit records retain metadata rather than exported record contents.
- File access checks event scope, visibility, content, and object identity. Payment evidence is PMCM-only; signed storage URLs must match the configured project and exact object path.

### Removed

- Broad sample API routes and browser-local demo fallbacks are retired. Guarded local fixture seeding remains available.
- Unused API ports, DTOs, portal primitives, package dependencies, and UI exports were removed without changing supported user workflows.

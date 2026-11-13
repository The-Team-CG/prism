# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Assigned coordinators can read and reply in conversations they belong to without starting new ones.
- PMCM can add and remove conversation members after a conversation starts (added people get a notice and see earlier messages), and close or reopen a conversation. Closed conversations take no new messages and move to a Closed list.
- Messages refresh every 15 seconds while the tab is visible without losing the open conversation, and the Messages navigation item shows an unread count (inside an event, that event's count). PMCM can see which members have read its messages; other roles' responses do not expose those read times.

- Chat notices include a link back to the recipient's conversation that survives sign-in. Messages offers Viber linking when configured, and the notification inbox combines channel copies while retaining each delivery's receipt checks.

- Signed-in client, supplier, PMCM/coordinator and guest-pass pages share a soft pastel mascot-and-doodle background, with opaque cards and headers keeping event work readable.

- Clients can follow event milestones, submit briefing and layout preferences, review official floorplans, sign conformes and addenda, track billing, and request an ocular visit. PMCM retains ownership of official plans and event decisions.
- PMCM can approve or reject the files clients send for a file requirement, with a reason, from the requirements panel, the same way as supplier files. The client or supplier who sent the file gets a notice with the outcome and, on a rejection, the reason; the reminder sweep no longer repeats that rejection notice.
- PMCM is told when a client or supplier sends a file for a requirement, and each file waiting for review appears in the command inbox until PMCM decides. A newer upload replaces the sender's earlier unreviewed file, so only the newest one waits. Notices show their whole message instead of a cut-off preview.
- PMCM's event Files tab opens on a library: files waiting for review come first (preview, approve, reject with a reason, or approve several at once), then one searchable table of every file from the client, suppliers and PMCM with who sent it, what it was for and where its review stands. Uploads that never finished are listed separately instead of among the files.
- Supplier Files shows what PMCM still needs first (drop a file on an item to send it; contracts link to their booking), then one searchable list of every booking document, contract version and certification, with PMCM's review state, expiry warnings and an inline preview.
- Stored files can carry a "valid until" date, set by whoever sent the file or by PMCM. Client and PMCM libraries flag files expiring within 30 days or already expired (judged by Philippine calendar day, so the valid-until day itself is still valid), "Use existing" won't resend an expired document, a copy keeps its original's date, and the requirement reminder sweep tells the sender (and PMCM) once before a required file expires and once after.
- Uploads that never finished (requested or failed and untouched for three days) are removed every six hours, with their partial provider bytes, so they stop filling file lists; a later retry of the same upload still resumes. `PRISM_DISABLE_ABANDONED_UPLOAD_CLEANUP_JOB=1` turns the sweep off.
- A requirement's upload history reads an earlier upload still waiting for review as replaced once the same sender sent a newer one, including uploads made before replacements were recorded, and the command inbox lists only each supplier's newest waiting file. Supplier booking documents show their valid-until date, which the supplier can set on files they sent.
- PMCM can plan events with versioned task templates, previewed date changes, supplier readiness and file requirements, event-day schedules, coordinator handoffs, and archive closeout records.
- PMCM finance can reconcile external receipts, apply and reverse payments, record refunds, review billing disputes, and attach private payment evidence. Clients can view published statements with payment and refund history.
- Guests can check in with consent, submit feedback within the event’s seven-day feedback window, and play event games. PMCM controls game sessions, moderation, retention, and event-scoped access.
- Signed-in users can view and acknowledge their own notices. PMCM can inspect provider outcomes, retry failed delivery, and escalate notices that miss acknowledgment deadlines. See the [operational communications runbook](docs/runbooks/operational-communications.md).

### Changed

- Conversation lists page from the server (30 at a time, "Show more" or scroll to load more), search covers subjects, event names and message text, and the unread count and inbox reach every open conversation instead of the 100 most recent.

- Messages opens as one inbox across events for PMCM, clients and suppliers, with the event named on each conversation; an event's own Messages tab still shows only that event. People in a conversation see each other's names (never emails). On phones an open conversation fills the screen with the composer in view, and Enter starts a new line. `GET /communication/inbox` returns the signed-in account's conversations with their latest message. Each new message now notifies the other members by email and, where linked, Viber, naming the sender and conversation and quoting the start of the message; the in-portal notice opens that conversation. Without a configured Viber bot, Viber notices are now skipped instead of failing.
- Client Files is a file library: events on the left (upcoming first, then past for later reference) with how many documents each still needs, and for the chosen event what PMCM needs from the client with inline upload, category shelves, and one searchable, sortable table showing each file's type, who added it, when, its size and review state. Opening a file previews PDFs and images in a side panel with its requirement, PMCM's rejection reason and earlier versions; files can be dropped on a needed item or on the table, several at a time. Clients can also search across all their events, download an event's files as one ZIP (a folder per category), see which files PMCM added since their last visit, and send a copy of a file from another event for a requirement. Account-wide search is one API request, and reusing a file is copied by the server, so nothing passes back through the browser. Downloading very large sets as one ZIP asks first. Phones get an event picker and swipeable shelves.

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

# Changelog

Notable project changes are recorded here for people upgrading or contributing.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Clients and suppliers can submit their own privacy requests and track their status; PMCM still verifies and carries them out.
- File access follows one policy for lists and downloads: coordinators need a current assignment, suppliers see only their own files on selected bookings, and failed uploads are no longer shown outside PMCM.
- Addenda change billing and quote amounts only when PMCM countersigns; until then they show as pending, and PMCM can withdraw one with a reason.
- Coordinators and PMCM can mark an event-day task blocked with a required reason and unblock it; the PMCM inbox shows that reason.
- The event-day run sheet shows a guest operations block: registration platform status, expected headcount, roster verification counts, walk-in policy and registration staffing, by role.
- Supplier-owned file requirements are now tracked per supplier: each supplier sees only its own status and files, and PMCM sees who has submitted.
- CI now runs the database query audit; raw SQL, unbounded reads and per-row loops in the API state why they are safe.
- Lint now rejects conditionally called React hooks, and browser lifecycle acceptance opens the client event overview.
- PMCM blocked-task inbox items now include blocker, owner and due context and open the exact event-day task.
- Clients now see a version-specific action-center item for addenda awaiting their acknowledgment, linked to the addendum row.
- File-requirement reminder sweeps now keyset-page through every eligible event while retaining stable idempotency keys.
- Suppliers now see due and overdue file requirements for selected bookings, with links to the booking actions and uploaded files.
- PMCM scope-change approvals and rejections now queue idempotent, event-scoped client notices with only client-safe wording and responses; the client view labels withdrawal explicitly.
- PMCM supplier readiness now loads all requests in keyset pages, and the handoff brief uses the same shared readiness projection with its role-safe fields; supplier dashboard actions target the exact request or booking.
- PMCM decision logs now keyset-page every source and attribution read, include pending freeze exceptions, billing corrections and task reassignments, and show actor roles from available audit records.
- Browser lifecycle acceptance now covers a client-requested proposal revision and a supplier application through PMCM approval, quote selection, assignment confirmation and readiness.
- Suppliers can proceed through the optional certifications step before giving privacy consent on the review step, so public applications can be submitted again.
- API context imports load focused contracts and projections without pulling in unrelated controllers; shared inquiry, document, briefing and live-ops projections now have one owning implementation.
- PMCM and guest game views share background refresh mechanics. Portal caches retain reads through initial session hydration, and guest entry and check-in use one session model and privacy cleanup path.
- Client dashboard and shared-floorplan views use one snapshot-to-editor conversion; plans saved in the older canvas shape still open.
- Billing sources take payment terms other than 50/50: up to three named milestones totalling 100%, shown with a running total. A downpayment under 50% needs a repeat-client reason before the source can be created, as the API already required.
- Suppliers carry a capacity or scale rating (small, medium or large, or not rated) that PMCM sets on the supplier profile and sees in the profile drawer. It is PMCM-only. Adds a migration for one nullable column.
- Withdrawing a booked supplier now writes a reliability note on their profile by itself (event, category and reason), once per assignment, instead of relying on PMCM to add one.
- AI is live. The mock provider is gone: set `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`) and every AI use case runs against that provider; with none set, AI calls are blocked and the health check reports `unconfigured`. PMCM gets **AI triage advice** in the inquiry drawer (fit, risks, questions to ask; advice only, saved per inquiry) and **Draft wording with AI** on the proposal form (title and summary from the estimate, for PMCM to edit before issuing). New `POST /api/inquiry-triage`, `GET /api/inquiry-triage/:inquiryId` and `POST /api/proposal-drafts` are PMCM-only. Anthropic runs as a test-data route without a ZDR agreement (UAT data only; audit rows say `test_data_approved`) and as a ZDR route with `AI_ZDR_CONFIRMED=true`; OpenRouter always requests ZDR. `NODE_ENV=production` refuses a non-ZDR route unless `AI_ALLOW_TEST_DATA_IN_PRODUCTION=true`. Client identity and applicant contact details are never sent. `AI_PROVIDER=mock`, `AI_ROUTE_PROFILE=mock` and the `test-*` profile ids no longer exist. The proposal form's "Undo AI draft" restores what was typed. PARE (supplier replacement) now runs through the AI gateway on real UAT events when a provider is configured, with supplier and client names masked, and still needs PMCM approval before any message is sent; without a provider it uses its deterministic rules engine (`PARE_MODE=live|mock` forces one). Production keeps no separate PARE gate: the gateway's ZDR rule applies. The PMCM PARE card labels the two modes "AI assisted" and "Rules engine". See `docs/runbooks/ai-provider-routing.md`.
- Clients annotate the official floor plan on the plan itself: the review shows the submitted layout, a click pins a note to that spot (and to the table or element under it), saved notes show as numbered pins, and the typed object ID field is gone. Only the primary contact can annotate, as before.
- Table assignment and the seating list are for events under 200 guests (the catalog limit; every Prism event is a private client event). The editor and the API refuse new seats at 200 or more, while seats already made stay. The guest panel can print a seating list by table with the guests still without a seat.
- The venue library saves walls, doors, windows, pillars and safety equipment as permanent venue features that come back locked when a template is used, and saves the venue rules with the template. This also fixes saving a template from the editor, which the API refused because it only accepted an older object shape.
- Event scope now freezes by itself at midnight Philippine time five days before the event day: an hourly sweep freezes open, live events (audited as the system, and a manual freeze that lands first is left alone). Turn it off with `PRISM_DISABLE_AUTO_FREEZE_JOB=1`.
- The compliance panel gives a readiness report from the latest completed run: not ready while any Must-Fix is outstanding (listing each with what to do), ready with follow-ups for outstanding lower layers or open high and critical risks, otherwise ready, with counts per layer.
- Recorded risks now carry a likelihood and an impact (low, medium or high). When no severity is given, it is worked out from the two (1-2 low, 3-4 medium, 6 high, 9 critical); an explicit severity still wins. Existing and rule-raised risks stay unrated. Adds a migration for the two columns.
- The wrap-up screen has the two sections the catalog lists: supplier egress confirmation (shows which confirmed suppliers have not reported done and leaving, and needs an explanation to confirm while any are outstanding) and additional billing items draft (up to 20 items kept as a draft). Wrap-ups completed before this stay complete. The post-event deliverables panel counts down to the 24-hour wrap-up deadline and says how late it is once past.
- The PMCM Files event list shows how many of each event's file requirements are open and how many are overdue (for the 25 most recent active events), from a new PMCM-only `GET /api/pmcm/file-summaries` read.
- PMCM sees how many coordinators in the whole active pool are free on the event date (and how many are assigned to other events or marked unavailable) above the staffing summary, from `GET /api/events/:eventId/staffing/pool-availability`.
- A coordinator who withdraws from 48 hours before the event day (Philippine time) until it ends is flagged as an Emergency Change: the assignment carries `emergencyChange`, the audit entry is critical, the reliability note says it was within 48 hours, the PMCM assignments desk shows an alert listing who withdrew and from which role, and every approved PMCM admin is emailed.
- The email a supplier receives when PMCM selects their quote now names the event and date, the deliverables they quoted, their ingress and egress window in Philippine time (or says PMCM will send it), the agreed amount and the payment terms.
- Ingress and egress coordinators (and the designated Event Day System Operator) can mark a confirmed supplier Arrived, Set up and ready, and Done and leaving from the coordinator view, with an optional note and setup photo (the photo file name is recorded, as on the supplier side). It follows the supplier's own forward-only order, is recorded in the audit trail with who reported it, and is added through `PATCH /api/events/:eventId/supplier-status/:requestId/report`.
- Coordinators get a Calendar on the shared portal calendar: the day of every event they are assigned to, plus the open event's task deadlines and its other schedule days. Each item opens in a side panel with a button to My shift, Tasks or the run sheet for that event.
- The PMCM calendar shows each event's schedule days (load-in, load-out, extra days) next to the event day, and every day that has a schedule leads to its run sheet. The run sheet opens on that day and has a "Back to calendar" link. `GET /api/pmcm/calendar` items gain a `schedule_day` kind and an optional `scheduleDayId`.
- Calendars (PMCM, supplier, client): "+N more" opens a small list of that day's items instead of switching view, and clicking an item opens its details in a side panel with a button to the place it is handled. Supplier calendar entries now name the thing (the event, the quote category) instead of just "Arrive" or "Quote due".
- The event-day run sheet works in Philippine time: an early-morning supplier arrival no longer drops off the sheet, and on later days of an event it opens that day instead of the one before.
- PMCM Finance event list shows what each event owes, its next payment due date and overdue milestones, and Messages shows unread messages per event. The PMCM calendar now shows quote deadlines, payment due dates, ocular visits and supplier arrivals and departures alongside event days, and clicking an item opens the event section where it is handled.
- The client, PMCM and supplier calendars share one calendar with Month, Week, Day and Agenda views (switch from the view menu or with M, W, D and A), a live time line, and "+N more" that opens the day. The supplier calendar places arrivals, departures and deliverables at their times.
- The API gains two PMCM-only reads: `GET /api/pmcm/event-summaries` (what each event owes, its next payment due date, overdue milestones, and the signed-in admin's unread messages) and `GET /api/pmcm/calendar?from=&to=` (event days, quote deadlines, payment due dates, ocular visits and supplier arrivals and departures in a window of up to 800 days).
- PMCM Finance, Files and Messages event lists show each event's stage and put events still being run before finished ones, Settings drops the policy cards that looked like controls but did nothing, and the Calendar subtitle says what it shows.
- PMCM phone layouts: the Closure summary and Audit tiles sit two across, the Privacy filters open from a Filters button, and the coordinator Tasks sections show a chevron instead of a stray marker above each title.
- Portal fixes: the phone menu closes after you pick a destination in every portal, the PMCM Suppliers page keeps its title off the screen edge, tab strips wrap instead of clipping their labels, ended events list only billing and closure work on the Overview, and the run sheet shows a readable date and capitalised statuses. Billing source and scope freeze say what they are waiting for, the supplier Bookings page drops its duplicate progress strip, and a few copy fixes ("1 result", the supplier Files message, the emergency supplier replacement panel).
- Supplier portal: quote deadlines now stay open through the end of the Manila due date and show the same date on every screen, and open requests are migrated to match. Today splits work into "Your turn" and "Waiting on PMCM", event dates appear on Today, Requests and Bookings, and sidebar counts agree (Today is Requests plus Bookings). Requests lists only live bids, soonest first, and locked quotes read as a record on both the portal and the emailed link. Bookings opens one step at a time, Files links to the booking that needs a contract, and Payments shows a selected quote's amount before its schedule is published.
- Supplier calendar is a month view with event days, deadlines, arrivals, departures, deliverables and payments. The month view now lives in `@prism/ui` and also serves the client and PMCM calendars.
- Suppliers can start a conversation with PMCM about a booked event; it always goes to the PMCM admins. Confidential bids keep the event name and client masked on the supplier dashboard and quote link until that supplier is selected; the event date is visible during bidding so suppliers can price and check availability.

- A declined inquiry emails the client once with a polite note; "Date Unavailable" and "Outside Service Scope" are explained, other reasons are not disclosed, and the PMCM decline dialog shows who will be emailed.
- PMCM's note when scheduling an ocular visit is saved on the visit (replacing any earlier note) and shown to the client under the scheduled date and time.
- PMCM supplier names in the directory and the Team & roles "Available only" checkbox have click targets of at least 24 px, meeting WCAG 2.2 target size.
- PMCM can decline an inquiry without a reason (a given reason is still recorded in the audit log), schedule an ocular visit without a client request, and the event-date compliance check now reads "Event date is upcoming" with links to Closure or a postponement.
- PMCM Ctrl K finds events and clients from the Inbox too (records load when the palette opens), matches typed words as plain substrings, and each page's browser tab names that page, including Suppliers and My shift after a coordinator is redirected from a PMCM URL.
- PMCM and coordinator Ctrl K search finds events, clients, inquiries, each event's sections and the coordinator's own tasks and issues, with "Report an issue" and "Mark attendance" actions; the coordinator run sheet reads through a coordinator-scoped schedule, PMCM URLs send coordinators home before any PMCM data loads, and Team shows each coordinator's next or last booking with Invite staff moved from Audit.
- PMCM copy, dates and access: inquiry and proposal dates, peso amounts with a confirm before a proposal is issued, plain operator wording across Inquiries, Suppliers, Privacy and Audit, shared segmented filters, labelled live-ops controls and sentence-case document titles.
- PMCM navigation: dead sub-views and aliases redirect to their section, each page names its section in the breadcrumb, header and document title, the client dossier has a view tab strip, and the Tasks and Inbox pages no longer show empty-event prompts.
- PMCM event workspace reflects time and status first: past events lead with "close it out" and hide event-day entry, Team & roles tiles read as staffed or not staffed after the date, overview status comes before the ocular waiver, scope-change and billing-adjustment forms open from buttons (no default cancellation), games and the run sheet show their status before their forms.
- PMCM closure and floorplans: snapshot history loads and fails plainly, official floorplans wait on the ocular visit, compliance shows the newest result per rule, review gaps appear after Add review, and closure tabs run 1–5 with Deliverables before Archive.
- PMCM supplier, billing and staffing status agree with the data: one assigned-supplier count across badges and tabs, readiness banners name only categories without a selected supplier, overdue milestones show days late, statements without a billing source say so, and coordinator acknowledgement is shown per role.
- Coordinators get a clearer event-day portal: readable view links (old section links still open), PMCM paths redirect home, self-attendance marks only from the day before through the day after the event, and "Report an issue" is one tap away on every view.
- The API starts and builds again after the NestJS 12 upgrade: its runtime `.cjs` helpers are copied to the right `dist` path. Local fixture seeding works on freshly migrated databases again.
- Run workspace coverage suites on independent CI runners, reuse exact dependency and browser caches with bounded retention, and validate complete browser journeys against production builds with repeatable timing comparisons.
- Validate independent CI jobs and desktop/mobile browser journeys in parallel on GitHub-hosted runners, with complete required-check aggregation and dependency-aware task selection. Local pushes check affected projects using native typechecks and shared architecture lint.
- Upgrade NestJS 12, Vitest 5, Anthropic SDK 1, Lucide 1 and development tooling; retain compatible TypeScript 6 build APIs alongside TypeScript 7 checks and align Node types with Node 24. Preserve rate limiting, provider retry ownership, shared contracts and coverage thresholds.
- Refresh compatible portal, API and development dependencies, including Next.js 16.4, React 19.3, Prisma 7.10 and Zod 4.6, while retaining existing major-version compatibility. Development tooling requires Node 24.15+ on the Node 24 line, or Node 26+.
- PMCM event and billing read models retain client proposal approval status, keeping the lifecycle stage and event-day start action consistent after approval.
- Browser acceptance follows accessible inquiry search, coordinator availability filters, billing and closure tabs, and event-day date gates, keeping the intake-to-archive checks aligned with the portal.

- Portal pages load faster against the hosted database. Measured in production builds against an ~81 ms database round trip:
  - PMCM event overview: 10 requests and 3.7 s → 5 requests and 2.4 s.
  - PMCM events list: 2.0 s → 1.6 s. Inquiries: 1.7 s → 1.3 s.
  - Coordinator home: 3 requests and 2.5 s → 2 requests and 1.6 s.
  - Client event overview: 2.4 s → 1.9 s. Client home: 2.0 s → 1.8 s.
  - The whole-system `/pmcm/dashboard` (959 KB over the wire) is replaced by `/pmcm/reference` (19 KB).

  What changed:
  - API responses are compressed, and CORS preflights are cached for 2 hours.
  - Idle database connections stay open for 5 minutes, so the next click no longer pays a ~1.7 s reconnect.
  - Event readiness and the PMCM event workspace each read in one parallel wave. Readiness drops from 44 queries to 17.
  - PMCM event tabs request only the data they show.
  - Event pages use a new `GET /pmcm/reference` (event switcher, inquiries, directories, rules) instead of the whole-system dashboard. The dashboard no longer carries system-wide audit and notification logs.
  - The coordinator role view looks up the assignment once. The coordinator home loads its role view alongside the workspace from `GET /coordinator/focus-role-view`, which picks the next upcoming assigned event with the same shared rule as the portal (`selectCoordinatorFocusEventId`, Philippine calendar date).
  - Each PMCM page downloads only its own section: list pages ship about 260 KB of gzipped JavaScript instead of 417 KB. Pages import their section and route view directly (a shell test guards this), the coordinator desk and conforme upload load on demand, and the shell imports feature modules instead of whole feature barrels.
  - After a PMCM command, the portal reads, the selected event workspace and live ops refresh at once instead of one after another, and the duplicate approvals reload is gone.
  - New `@prism/portal-query` gives each portal one data cache (`defineResource`, `useResource`, `usePrefetch`, `useInvalidate`). The client event overview uses it to start its change requests and addenda alongside the workspace, and the event portal's dashboard layout now holds its cache across navigation. Supplier dashboard sections share one workspace read, so moving between them no longer reloads it.

- Planning starts when the client approves the proposal, and the API's archive, event-day and readiness checks use the same shared stage rule as the portals. Workspace-wide compliance rules are managed in PMCM Settings instead of one event's Closure tab. The Compliance step lists open checks as compact rows grouped by phase, with evidence behind Details and settled checks collapsed, and its history is a one-line run summary plus a risks list. Date-and-time pickers with nothing chosen open on the current month.
- Every portal shows the same lifecycle stage for an event, from `derivePrismLifecycleStage` in `@prism/types`: PMCM Overview, the PMCM events list, and the client Overview and Planning tabs no longer disagree (for example "Ready for event day" next to "briefing" and "Stage 4: Planning"). The separate client progress percentage is replaced by "2 of 5 checkpoints done". PMCM's "Event day is here" banner appears only from the day before the event.
- Event tabs follow the event's stage. PMCM's event menu is grouped into Prepare, Event day & after, and Back to; the Closure count stays hidden until the event day. The guest pass leads with event details and says when check-in opens, and shows check-in only on the event day.
- Long PMCM screens are shorter. Closure is split into numbered steps (Wrap up, Feedback & reviews, Compliance, Archive), and resolved compliance checks and workspace-wide rule authoring are collapsed. Inquiries open on "Awaiting review", with undecided inquiries first and two-line rows. Events are grouped by month, 25 at a time, and the always-empty Venue column is gone. Repeated Inbox items collapse into one expandable row (for example "6 × Payment milestone overdue"). Team & roles leads with assigning coordinators, and the four planning tools are under a collapsed "Staffing tools".
- Navigation repeats less. Event menus in PMCM and the client portal no longer print the event name again under the switcher. The client sidebar drops "Shared floorplans" (layouts live under each event's Floor plan). Clients with one event no longer see Approvals, Messages, Files and Billing entries that only forwarded into that event. Coordinators pick their event in the sidebar, and the portal opens on their next upcoming event instead of an empty "Choose an event" screen.
- Supplier bookings show the next step, the event, the ingress or due time, and "N of 4 steps done" on each row without expanding it.
- Raw values and decoration are cleaned up: client dates and floor-plan update times are formatted, internal readiness text ("Must-Fix item open") and compliance codes ("Evaluation: not_satisfied · DERIVED") are no longer shown, empty addendum cards are hidden, coloured eyebrow labels use the muted label style, and outlined status pills become a dot and label.

- Clients can review an issued proposal before a billing statement exists, see it in their action list, and wait for a newer issued version after requesting revision. Proposal loading failures are reported instead of appearing as an unprepared proposal.
- Client closeout links lead to delivered items awaiting acknowledgement, rather than Messages or unfinished PMCM records. Wrap-up acknowledgement no longer waits on a completion state that itself needs acknowledgement; separately recorded PMCM acknowledgements are shown without offering a rejected duplicate action. Change requests under review are identified as PMCM's next action.
- Supplier readiness and contract controls explain and enforce the existing assignment-confirmation prerequisite. Creative deliverables can use a saved progress note after returning to the booking.

- Client event menus link directly to briefing and guest access, and keep Closeout & feedback available after the actual event end, including after feedback is submitted. Archived event menus offer the read-only closeout instead of planning links that cannot load the archived event. Guest landing and pass screens now link to game PIN entry, which also offers a way back to the guest portal.

- The ocular (site) visit now appears on the event Overview in both portals until it is completed or waived: PMCM schedules, completes or waives it there, and clients request it there. Before, PMCM could only reach it from a Tasks page missing from the sidebar, and clients from a page no menu linked to.
- The client's event lifecycle moves to Planning once the client approves the proposal, instead of staying on "Briefing & proposal" until an official floorplan is approved. Step names read normally ("Briefing & proposal" rather than "briefing proposal").
- PMCM can start an official floorplan from a **Blank layout** in the event's Floorplans tab, using the briefing's venue and guest count. Before, a plan could only start from a saved template, so a new system with no templates had no way to create one.
- Issuing a proposal no longer fails with an unexpected API error on hosted Supabase Storage. Files the API generates itself, such as proposal PDFs, are now uploaded to the private bucket before being verified; before, the adapter only read back an object that was never written.
- The client briefing's start and end times use a branded time picker matching the date pickers (15-minute steps, "6:30 PM" labels); end times can't be earlier than the start time.
- The client portal tabs share the PMCM inbox's list style: a row of key figures, then aligned rows with a colour bar only on what needs the client, a due phrase in Philippine time and one action. Home shows what needs you, what's with PMCM, the next event and the next payment. The calendar has month navigation and links each date to its event. Shared floorplans now opens inside the portal, and the billing schedule shows receipts on each payment.
- The PMCM Clients directory lists clients with new inquiries first. Each row shows the next event, inquiries to review and the balance due, and the whole row opens the client.
- The PMCM Team roster is searchable by name, role or skill. Each coordinator shows role tags, their email and their next booking, and the booking links to that event's coordinators. Inactive coordinators are marked; active ones no longer repeat an "Active" badge.
- The PMCM audit trail shows compact one-line entries, 15 per page. Back-to-back repeats such as scheduled compliance runs fold into one row with a count. Audit IDs and IP addresses move into the row tooltip.
- Client emails explain the next step. The acceptance email now goes out after the account invitation and points to the separate "Set up your P.R.I.S.M account" email (with a Spam or Promotions hint), or says to sign in if the client already has an account. "Inquiry received" names the event. Notification subjects use the message headline instead of "P.R.I.S.M update", with a simple layout and footer.
- Dark ink buttons and badges in the signed-in portals are readable again, for example Record actual end, Run compliance, Replace coordinator, the supplier directory actions and BNI tags. They use a new `text-ink-foreground` token instead of the sidebar text colour, which turned dark when the sidebar became light.
- Client and supplier Messages now use the same chat layout as PMCM: a conversation list with search, previews, unread counts and the latest conversation open first, chat bubbles, and an auto-growing composer. The shared `ChatWorkspace` lives in `@prism/ui/chat`; each portal still loads and sends its own messages, and only PMCM starts conversations. An unused PMCM "Event Threads" panel was removed.
- PMCM Registration: the guest roster loads straight away and filters as you type, with attendance chips, walk-in verification tags, "Checked in 2:14 PM" times and a proper empty state. Guest import opens from an Import guests button, with a drag-and-drop file area. Event privacy and walk-in rules are now one "Guest admission" card of labelled choices with a single Save.
- PMCM date-and-time fields use a branded picker matching the date picker, with a calendar beside a scrollable list of times, instead of the browser's native control. These cover task and issue due times, event-day schedules, game windows, supplier ingress and egress, ocular visits and the actual event end. Supplier availability and recorded payment dates use the shared date picker. `DateTimePicker` in `@prism/ui` keeps the `datetime-local` value format.
- PMCM event workspace redesign:
  - Messages works like a chat app: a conversation list with previews, unread counts and search; chat bubbles grouped by sender with day separators; an auto-growing composer (Enter to send); and a "New conversation" flow that picks people from the event.
  - Overview leads with the event-day banner, a single row of event facts, next steps from the readiness check, a readiness meter, and a linked card for each work area. It replaces the stat boxes and the column of eight buttons.
  - Planning, Files, Suppliers, Team, Live operations, Billing, Closure, and Registration & games each show one section at a time through a segmented switcher kept in the URL (`?part=`), instead of a stack of collapsible panels. Registration and Games share one page.
- The PMCM Inbox opens with a summary of urgent items, items needing action, inquiries to review, approvals and active events. Items show in one list grouped by priority or by event, each with an area icon, a colour bar for priority, the event and client, and a due phrase such as "Overdue 2 days". The whole row opens the item.
- Moving from a PMCM page such as Events to Home, Suppliers or the command inbox no longer briefly crashes with "Loaded event dashboard content requires an authenticated workspace".
- The PMCM sidebar's Privacy item opens the privacy console; before, it did nothing and left the current page, usually Audit, on screen.
- Account administration filters by role, searches accounts and pages 8 at a time. Each account shows its sign-in, pending or locked state, and staff invitations open from an Invite staff button.

- PMCM inquiry intake uses one Review action per row, groups contact and source details together, and keeps secondary filters under More filters with an active-filter count; accepted inquiries retain their conforme and invitation follow-up beside the status.

- Supplier directory searches keep text entered while a next-page navigation finishes, then reset to the first page of the matching results.

- The supplier quote-request dialog scrolls long supplier lists within the viewport, keeping Cancel and Send Requests reachable on phones.

- Browser acceptance now discovers every portal page and exercises registered desktop/mobile routes with real API fixtures, reports browser and data-loading failures, and checks supplier pagination across a 25-row boundary.

- PMCM sign-in offers an on-demand authenticator QR rescan in development; production rejects rescans, and a valid six-digit code is still required.

- Removed the "Wrong portal?" link row from client, supplier, PMCM and guest access screens.

- PMCM authenticator codes use six focused digit boxes inspired by AlphaCI, with keyboard editing, full-code paste and mobile autofill; verification shows one visible prompt and a single clear action without the extra "Start over" button.

- Client inquiry validation uses styled inline messages instead of browser popups, with an accessible consent prompt before submission.

- Client inquiry contact fields stay aligned across columns when an optional label wraps onto a second line.

- Client inquiry city suggestions stay aligned below the venue field in a styled, scrollable dropdown, with keyboard selection and custom venue entry.

- Hosted database checks recognize six proven historical UAT seed versions without rewriting migration SQL or database ledger rows; unknown changes still block startup and cutover checks.

- Portal UI and UX pass from the October 2026 screen audit (design tokens unchanged): the supplier application works on phones, PMCM Closure no longer crashes on checks without evidence (the read model now returns full compliance records), the PMCM calendar uses real month grids, and every portal shows dates in Philippine time with readable role and status names.
- Navigation and event choosers are real links that open in a new tab. Client Home groups actions by event and separates current blockers from later requirements; the client floorplan page and PMCM floorplan tab lead with the official plan, and the editor opens fitted to the plan with "Fit plan" and "Find selected" controls.
- Client documents are one checklist linking each requirement to its upload (requirements now include `uploadedObjectId`). PMCM roster import takes a spreadsheet with readable headers, adjustable column matching and a preview. The guest pass shows the venue and start time once the client has approved PMCM's proposal.
- Sign-in, invitation and supplier help screens link to PMCM when `NEXT_PUBLIC_PMCM_SUPPORT_EMAIL` or `NEXT_PUBLIC_PMCM_SUPPORT_PHONE` is set at build time; otherwise they keep the plain instruction.
- Documentation cleanup: removed six completed or superseded documents (plus the legacy column register CSV) and brought the remaining architecture, product and runbook docs in line with the current code; see `docs/log.md`.

- Added desktop/mobile browser acceptance journeys (including a full inquiry-to-archive lifecycle that clears every close gate without an override) and an opt-in local Mailpit inbox for testing activation, reset and notification emails without email-provider credits.
- Inquiry review drawers now show refreshed status after PMCM accepts or pends a request.
- Supplier quote emails now use the configured supplier portal origin. PMCM can start event day from the event overview once the existing lifecycle prerequisites are met, and creates billing sources from the Billing tab instead of Closure.
- PMCM closure now shows a recorded actual event end and offers correction instead of asking to record it again. Coordinator task and issue selects are labelled by their field name alone.
- Date pickers keep focus in the field while typing on touch devices and close once a complete date is entered; the client conforme hash wraps on narrow screens instead of pushing the page sideways.

- Added an isolated nightly and on-demand lifecycle CI journey with disposable PostgreSQL, generated actor credentials, report artifacts, and failure on unresolved coverage or rule decisions.

- Local development can now run Supabase Storage, so the API uses the same storage adapter as production: start with `PRISM_LOCAL_SUPABASE_STORAGE=1` and the launcher enables the service, creates a private `prism-documents` bucket and writes the storage settings into the generated env files. The default start is unchanged. When Auth is disabled, the launcher reads the checkout Storage container's generated service key without exposing it in console output.
- Enforced send-before-client visibility and approved-proposal billing caps; proposal and quote retries preserve version limits. Client floorplan revision requests now move the workflow atomically through the shared decision endpoint, replacing the legacy review route. Supplier progress is forward-only, with reasoned PMCM corrections and released-bid protections.

- CI now fails a pull request that edits or deletes a migration already on the base branch, because a database that applied the old file would fail its migration ledger check. A listed exception with a reason is the escape hatch. `npm run db:audit:schemas` now checks the final schema layout, so it passes on a correctly migrated database instead of reporting retired schema names.

- Saving to the platform no longer fails with "A database request failed" when two audited writes overlap. The API now runs the transaction again after a short wait, and answers 503 with a Retry-After header, not a 500, if it still cannot get through. In the full lifecycle suite this removed all six failures; the database still logged 37 conflicts and none reached a user.

- Persona lifecycle checks now verify persisted public walk-ins, reconciled PMCM attendance and client-scoped live event state instead of passing on prerequisite checks alone.

- Lifecycle test helpers use cryptographic randomness for synthetic client identities, simulated client addresses and retry jitter; exploratory database retries remain explicit and prevent a green report.

- Completed lifecycle portal paths for supplier quote links and bid rounds, PMCM operator revocation and deliverable completion, guest consent withdrawal, client disputes and payment receipts. Billing corrections retain original invoices and payment evidence, transfer paid credit once, and preserve approved payment terms; confirmed cancellation fees create an approved billing source for PMCM issuance. PMCM can configure event-type file requirements, bind verified uploads, send reminders, and inspect floorplan revision history.

- Fixed payment recording and supplier registration database errors, hid unsubmitted PMCM floorplan drafts and internal storage fields from clients, made billing approval and staffing retries safe, and rejected invalid commercial amounts and quote tokens. PMCM can explicitly start event day after signed conforme and floorplan approval. New proposal versions reset client review and only issue with a stored PDF.

- Added repeatable lifecycle API checks for client, PMCM, supplier, coordinator and guest work, with separate reports for failures, unavailable paths, blocked prerequisites and business rules needing review. Runs target an isolated local database and preserve the normal development data.

- Generating a billing statement no longer fails with a database error: the yearly statement-number lock used a query form that returns an unreadable result, so every attempt returned a server error. Proposal issuance stores its PDF within the issuing transaction, so a failed upload cannot leave an issued version without its client copy. Once the client approves a proposal, PMCM can no longer replace it with a new version; the panel explains this and points to the change register for scope changes. The event-games response retention sweep and two account and supplier lookups no longer fail with database errors.

- PMCM can now issue a commercial proposal from an event: build the cost estimate, then issue it as a numbered version with one action. Issuing creates the proposal document the client reviews, with a one-page PDF copy that appears in the client's files, so the client proposal page now shows the proposal title, summary and total (never the estimate lines) and unlocks Approve and Request revision. Product documents no longer list logistics completion, the seven-day guest feedback window or billing-after-conforme as unfinished work; they were already in place.

- Client and PMCM date fields now share a Prism-themed calendar picker, and the inquiry no longer repeats the event name while typing. Inquiry choices use clearer selectable tiles; choosing "Other" asks what it is and sends that to PMCM; mobile numbers accept digits only; venue suggests common cities; the chosen date is spelled out; and the live brief card and picture credits are gone.

- Documentation and acceptance tracking now follow one primary maintainer without former developer assignments. Tracker review separates literal criteria, stronger current designs, unresolved business rules and delivery evidence.

- Portal work now explains the next action and handoff: clients distinguish their actions from items with PMCM, suppliers open the exact request or booking, coordinators see the next task for their role, and guests see a clear check-in receipt and refresh warning. Event choices include readable dates, PMCM list filters survive browser navigation, inbox timestamps distinguish due dates from added dates, file pages separate uploads from requirements, and billing labels identify recorded payments and scheduled balances. Completed events no longer acquire new briefing/layout preparation prompts; briefing and floorplan prompts no longer treat the event date as a deadline, and acknowledged coordinators no longer appear unconfirmed. Status indicators use restrained text and dots, and inquiry details use an accessible dialog.

- Client event choices for documents, messages, billing, and approvals now open event-specific URLs, so the chosen event and section survive reload and browser navigation.

- Clients choose an event before opening its files, billing or messages. Messages show the available conversations and keep each draft while switching; retries retain the same request key. The file page no longer invents sizes or folder activity, and older folder links open the unified file page.

- The guest pass puts check-in and event details first and offers feedback when the event's seven-day feedback window is open. Unavailable media upload controls have been removed.

- PMCM event work starts with an overview, while planning, supplier, finance and live-operation controls are grouped by their task. Coordinators can choose an assigned event and open separate shift, task, issue, run-sheet and assignment views; their selection survives reload and navigation. Client proposal reviews load again because event authorization reads the inquiry email from the actual event model.

- Clients can see actions across their events on Home, open a compact event list and switch between event workspaces without losing their place. Supplier sections now have shareable URLs, with quote requests, quote history and bookings organized around the work to complete. Client change requests and addenda also load for clients whose ownership comes from their inquiry.

- The PMCM desk is reorganised. The sidebar lists Inbox, Inquiries, Clients, Events and Calendar, then Suppliers and Team, then Audit, Privacy and Settings under Administration. Dashboard and Command Inbox, which showed the same queue, are one Inbox. Opening an event turns the sidebar into that event's workspace, with an event switcher that keeps the current section and an explicit way back to All events. Events is a searchable register with All, Upcoming, In progress, Completed and Cancelled views, and the archive search moved there. Inquiries is one table with a next step for each inquiry, and its onboarding and conforme follow-up lists became views of that queue. Clients is a directory and a client dossier with the client's events, inquiries and balance. A contact's events and inquiries now stay in one client record because events join the inquiry they came from. Floorplan templates load again: the shared template store called `/templates` instead of `/api/templates`, which put a "Cannot GET /templates" error on every event screen.

- Fixed four portal screens that showed the wrong thing. The PMCM Dashboard and Command Inbox no longer stay on the loading screen. Supplier Messages loads the threads for a named event instead of answering "Event not found", and asks which event when the supplier has several. Client Billing and Approvals no longer quietly show the first event: with several events they ask which one, then name it. The client calendar shows only recorded dates (event dates, payment due dates, scheduled site visits and layout approvals) and no longer invents layout and planning deadlines.

- The client inquiry page is redesigned. The form is on the first screen at every width, and it asks about the event first, then venue and budget, then contact details, then shows a review. Short option lists are one-tap choices instead of dropdowns. A live inquiry brief beside the form fills in as the client answers, and the review step groups the answers with one Edit link per step. Continue is never disabled: it names the answers still missing. A failed send says PMCM could not be reached and keeps the answers. The page also lists what happens after sending (review, client account and conforme, planning).

- Every portal uses one shared shell from `@prism/ui` (`PrismPortalShell` for client, supplier and event; `PrismGuestShell` for the guest pass), built on shadcn's sidebar. It collapses to icons, becomes a sheet on phones, shows breadcrumbs, and marks the active page in the portal's colour. The non-working bell, the always-on online dot and the search box that searched nothing are replaced by a Ctrl+K page search and an account menu with only real actions. The old custom shell (about 1,300 lines) is removed.

- CI runs on Turborepo properly. Lint, typecheck, every workspace test suite and the build go through turbo with a cached `.turbo` between runs, so unchanged workspaces are replayed instead of rerun. Pull requests run turbo tasks only for the workspaces they change and their dependents; pushes to `staging`, `prod` and `main` run everything. Lint now runs in CI for the first time, and `@prism/floorplan-canvas` tests join CI. Shared packages no longer typecheck twice, and root config changes (`tsconfig.base.json`, `eslint.config.mjs`, `.nvmrc`) invalidate the cache. New root scripts: `npm run lint`, `npm run test:ci`, and `npm run dev`, which starts the API, the four portals and `@prism/types` in watch mode through turbo. The `prebuild`/`pretypecheck` stale-types checks are gone, because turbo builds `@prism/types` first.

- All four portals now use one design-token set from `@prism/tokens` (`fonts.css`, `theme.css`, `typography.css`). Portal `globals.css` files only import it, and the client portal's separate grey palette is gone, so every portal shows the same warm brand surfaces. Components use token utilities in place of hex values, `--prism-*` shorthands and raw Tailwind status colours: `primary`, `primary-soft`, `ink`, `surface`, `success`, `attention`, `danger`, `info` (each with a `-soft` fill), `brand-orange` and `brand-blue`, plus `text-2xs` and `text-3xs` for small labels. Attention and info text now meet 4.5:1 contrast. Undefined `--prism-warning`, `--prism-signal-soft` and `--prism-primary` references now render, and supplier dialog animations work. Restyle the product by editing the primitives at the top of `packages/tokens/src/theme.css`.

- The API now enforces the privacy notice. A signed-in account that has not acknowledged the current notice gets `403` with `code: "privacy_notice_required"` on every session-guarded route, except `GET /auth/me`, `POST /auth/logout` and `POST /auth/privacy-notice/acknowledge`. The client, supplier and event portals send such users to `/privacy`. Local fixture seed users are left unacknowledged, so they see the notice once.

- Signed-out visitors to dashboard pages are redirected to sign-in before the page renders, so the dashboard frame no longer flashes. The client, supplier and event portals cover `/dashboard` (and the client `/conforme` page), and the guest portal covers `/dashboard`. Sign-in now sets a navigation cookie per portal that holds only the session expiry; the API still checks every request. **Users signed in before this update must sign in once more.**

- Outbox notifications with email channel are now sent. Each recipient resolves when it is sent: an email address, `PMCM Admin` or `pmcm-inquiry-desk` (every approved, unlocked PMCM admin), `Coordinator` (coordinators actively assigned to the event) or `Client` (the event's inquiry email). Unknown recipients, empty role lists and non-email channels fail with a reason shown on the notification. Quote, payment and coordinator notices now address the supplier's or coordinator's email instead of a display name, and payment notices go to PMCM Admin in place of the unresolvable `Finance` label. Email uses the configured `PRISM_MAIL_TRANSPORT`, so no new deploy settings are needed.

- After sign-in, client, supplier and PMCM accounts that have not acknowledged the current privacy notice see it before reaching their portal. Every portal, guest included, has a public `/privacy` page, and the guest open-pass link now opens it. Client sign-up copy now says accounts are created when PMCM accepts the inquiry.
- Every account now sees a versioned privacy notice on first sign-in (requirement New-SEC2). Sign-in and `/auth/me` report `privacyNoticeRequired`, and `POST /auth/privacy-notice/acknowledge` records the current version. Consent forms must send the current notice version, and an outdated version is refused. The notice text is a draft for PMCM to review before launch. Deploy: run `prisma migrate deploy`.

- Accounts can now be created and activated. When PMCM accepts an inquiry, the client gets a single-use activation link that expires after seven days, to set a password and review and sign the conforme. The inquiry tracks the invitation as sent, opened or expired, and PMCM can re-send it from the inquiry. Signing the conforme does not send anything. An approved supplier application creates the supplier's login. PMCM admins can invite `pmcm-admin` and `coordinator` staff and re-send a pending invitation. Activation sets the first password with the password-reset rules, and an account with no password cannot sign in.

- PMCM admins can re-send an approved supplier's login from its application, for example after a login could not be created. Invitations are refused for accounts that are not approved, and the audit trail names the person who sent them.

- **Deploy step:** `PRISM_GUEST_PORTAL_URL` is no longer read or required by the API. Remove it from the hosted API environment or leave it unset.

- Password reset emails are sent through Resend (approved 2026-10-25). Account invitations use the same transport. Outbox notifications stay gated until their recipients resolve to real addresses, and Viber and other channels remain gated. Each reset link goes to the portal for the account's role. Guests, system and unknown accounts get no link and the same generic response. The reset response no longer includes `deliveryAvailable`. The API refuses to start without `PRISM_MAIL_TRANSPORT`, which is `resend` in deployments (`log` writes mail to the API log for local development only and is refused under `NODE_ENV=production`), plus `RESEND_API_KEY` and `PRISM_MAIL_FROM` for `resend`, and the four portal origins `PRISM_CLIENT_PORTAL_URL`, `PRISM_SUPPLIER_PORTAL_URL`, `PRISM_EVENT_PORTAL_URL` and `PRISM_GUEST_PORTAL_URL`. Portal sign-in and wrong-portal links read `NEXT_PUBLIC_*_PORTAL_URL` with no localhost defaults. **Deploy steps:** (1) verify the `PRISM_MAIL_FROM` domain in Resend; (2) in the hosted API environment set `PRISM_MAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `PRISM_MAIL_FROM` and the four portal origins, and remove `PRISM_PORTAL_RESET_URL`; (3) deploy the API. No migration is required.

- Removed the remaining configuration fallbacks in the API. `JWT_SECRET` is no longer read anywhere: **deploy step:** rename it to `PRISM_SESSION_SECRET` (same value, at least 32 characters) in the hosted API environment before deploying, or the API refuses to start. `PRISM_SESSION_TTL_SECONDS` is now required (28800 is eight hours; per-role `PRISM_SESSION_TTL_SECONDS_<ROLE>` overrides stay optional). Approval requests must send `privacyNoticeVersion`. Password reset requests use the client address Express resolves and fail with a server error when none is available. The built-in test-mode session secrets are gone: tests supply their own.

- Hardened operator sign-in and account administration. Approval requests return one generic receipt for every account state and no longer reveal or reopen accounts. Sign-in checks the password before disclosing a lock and verifies unknown emails against a fixed hash. A successful sign-in clears lock counters, and password reset clears permanent lockout. PMCM admins can unlock accounts and reset two-factor enrolment, both audited. `POST /api/auth/logout` revokes every open session of the caller, including sessions on other devices, and `GET /api/auth/me` returns the current identity. Operator password hashes use one parameterised scrypt format. **Deploy requirement:** run `npm --workspace prism-api run db:migrate:password-hashes` against the target database before the API starts; the API refuses legacy and plaintext values. `PRISM_TRUST_PROXY` is now required (`false`, `true`, `loopback`, or a hop count) so rate limits key on the real client address behind a proxy; local and Docker env generation sets `false`.
- Auth screens in the client, supplier, guest, and event portals share a split layout with a portal-coloured brand field (`@prism/ui/auth-shell`). Password reset is a three-step flow with a live password checklist and one check-your-email message that never reveals whether an account exists. Event 2FA setup shows a QR code, an authenticator link, and a Start over action. Sign-in redirects accept only same-origin paths, an expired or rejected session is signed out and returned to sign-in, and client sign-up points to PMCM account guidance. The "Wrong portal?" links need the four `NEXT_PUBLIC_*_PORTAL_URL` variables.

- Added standalone, repeatable account and portal UAT seed commands with explicit database selection, read-only previews/verification, preservation of tester changes, and migration-history diagnostics. Clarified environment/account guidance and agent task navigation.

- Added the PMCM supplier workspace in Event Command: a paged directory with private supplier performance and certification details, event engagement history, reviews, and profile actions. Supplier self-service remains in the supplier portal.

- Added idempotent UAT seed migrations for test cases 67–198, including event workflows, supplier requests and bookings, guest registration and games, coordinator operations, and privacy review.
- Added a Google Forms UAT builder with role-specific module selection, ratings grids, required module comments, and one module per submission.
- Guest deletion now resolves one roster identity and redacts only its linked records; ambiguous or unlinked records require individual review and leave the request approved. The ledger now reflects implemented guest correction.
- Updated vulnerable dependencies, removed unused Next.js lint presets, and made the dependency gate reject moderate or higher alerts without advisory exceptions. Portal lint commands use the active repository ESLint configuration.

- Database tooling recognizes Supabase poolers by complete hostname labels, and public inquiry links handle long trailing-slash inputs without regex backtracking.

- Updated Vite test tooling to resolve the Windows editor-command security advisory and restore the dependency audit gate.

- Main-branch promotions now run the same build, security, migration, and behavior checks as staging and prod.
- PMCM retention policies and record review now sit alongside the paged privacy request console and legal holds.
- The feature ledger records integrated controls and remaining acceptance and policy gaps, including floorplan eligibility, addendum signing, and billing correction approval.
- Scope change requests and event risk level (FL-025). The primary client can request a scope change for their event, see its status and PMCM's client response, and withdraw it while it is still submitted. PMCM reviews it with a required impact review and, on a frozen event, a single-use approved freeze exception; rejections need an internal reason. PMCM records the authoritative event risk level beside a suggestion from open compliance risks, and lowering the level requires a reason. Both stay hidden from clients, suppliers, coordinators, and guests.
- Privacy retention is now PMCM-managed: each retention category has a persisted policy (seeded disabled) that PMCM admins can enable and tune with a reason and revision history. A scheduled sweep only queues records past retention for a review queue; it never deletes or anonymizes on its own. Operators execute or dismiss items, execution re-checks legal holds (active holds mark items held), runs atomically per item, and is audited with counts only.
- The PMCM privacy console moves to its own Privacy page in the event app. Requests carry a 30-day SLA deadline (set when logged, backfilled for existing requests) and show overdue state in plain text; the queue is filterable by status, type, subject, deadline, and owner, paged, and each request can be assigned to or unassigned from an approved PMCM operator (audited by id). Approved guest correction requests now update the subject name, and roster email where present, on the event's roster, check-in, and feedback rows, blocked by legal holds and refused when the corrected name collides with another guest in the same event. The audit trail links to the console instead of embedding it. The 30-day SLA default needs confirmation by D.
- PMCM manages event file requirements: the matrix merges PMCM overrides (owner, visibility, required state, due date, PMCM-only notes) and custom requirements onto derived items, and client views show required state, due date and overdue flags. Clients and suppliers never see matrix items outside a requirement’s visibility; signed conforme and billing statement downloads are refused to roles PMCM has hidden them from. Upload, download authorization, and delete are audited with metadata only. A scheduled sweep queues idempotent reminders to the owner and PMCM for overdue or rejected required files. The override table is an additive migration (`20261019120600_event-lifecycle_file_requirement_overrides`) and must apply before the API deploys.
- PMCM has a read-only Decision log tab per event that lists postponements, cancellations, freeze exceptions, addenda, archive and compliance overrides, risk changes, ocular and billing waivers, billing corrections, payment-terms overrides, task reassignments, and inquiry merges, newest first, with a kind filter and paging. Reasons come from each source record; audit rows only attribute the actor. Coordinator, client, supplier, guest, and unverified actors are refused and the refusal is audited.
- Event-day teams get a time-ordered run sheet (FL-026): `GET /events/:eventId/run-sheet` now returns merged `entries` built from schedule segments, supplier ingress/egress windows, open task due times, and open issues, sorted by time with fixed tie-breaks, for the requested or current schedule day. PMCM opens a print-friendly sheet at `/dashboard/events/[eventSlug]/run-sheet` (linked from Live ops), with a now marker and overdue highlights. Coordinators see the same sheet on their desk, limited to their assignment: supplier windows only for the designated operator and ingress/egress roles, and no supplier, escalation, or attendance notes. The route now lives in the `read-models` context. An unknown `dayId` returns 404 instead of falling back to the first schedule day.
- The supplier readiness board now lists every assignment, grouped by event. Each item shows the ingress and egress times, whether the schedule revision is acknowledged, a late-ingress flag that uses the same grace window as the late sweep, open concerns (schedule change requests, contract corrections, event-day notes), and a setup status. Each item opens Quote requests or Bookings, the sections where that work is done. PMCM's event supplier readiness panel now reads the same server items from a new PMCM-only `GET /api/pmcm/events/:eventId/supplier-readiness`, instead of recomputing readiness in the browser, and keeps the category-gap hard block. PMCM verification notes and the verifier's name appear only in that PMCM read; they are removed from the supplier readiness board and the supplier workspace.
- Supplier-facing quote, assignment, readiness, contract, event-day status, and quote token responses no longer include PMCM verification notes or the verifier's name; the PMCM readiness read keeps them.
- PMCM `/dashboard` now pairs the command inbox with the selected event's status summary instead of generic totals, and the inbox lists overdue or blocked event-day tasks and open urgent issues as `live_ops` work. A live-ops sweep queues one PMCM outbox notice per overdue task, keyed by task and due time so reruns never duplicate it (`PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB=1` disables it). The client dashboard opens on the action center, which shows "No pending actions" when nothing is due, asks for post-event feedback until it is submitted, and shows change request status without PMCM reasons or notes (goals A, B, C, D).
- Hardened the API: it now refuses to start without `DATABASE_URL` and a 32+ character `PRISM_SESSION_SECRET` (or `JWT_SECRET`) and lists every invalid variable; the built-in session secret now works only under `NODE_ENV=test`, and `start-prism` already generates a local secret. Public login, 2FA, password-reset, account-approval, inquiry, supplier-application, and quote-request token routes are rate-limited per client address and answer 429 with `Retry-After`. Responses carry helmet security headers. Prisma not-found and unique-conflict errors return 404 and 409 instead of 500. Unexpected 5xx errors are logged by route pattern, without request bodies, tokens, or internals in the response. SIGTERM runs shutdown hooks. CORS no longer allows the unused `localhost:3000` origin.
- Client layout preferences stay client-owned through submission and revision: reopened preferences resubmit through the preference workflow, pending revisions close when an official plan is approved, and preference submissions do not hide an official plan under review. PMCM retains read-only access to legacy approved layouts, and clients retain their shared snapshot access.
- Removed unused API ports and DTOs, unused portal UI primitives, and unused packages (MUI/emotion, motion, recharts, date-fns, react-hook-form, and related UI libraries, plus the `@prism/ui` client-blocks module and seven unused subpath exports). Smaller dependency tree and bundle surface; no behavior change for users or developers.
- PMCM official floorplan saves now reject seat assignments that break table eligibility (unknown or declined guests, non-table or hidden objects, and tables over capacity) with a user-safe 400, and the saved plan contract carries the editor's object and guest shape. Plans saved without seat assignments still save.
- PMCM can request an addendum conforme for an issued addendum. The client acknowledges that version's immutable, hashed document first, PMCM then countersigns, and the addendum's billing line records the executed version. A signed version is never replaced; a new addendum version gets its own conforme.
- PMCM billing corrections need a second PMCM approver: approving a correction you requested is refused (403) and the panel disables Approve on your own requests, while you can still reject (withdraw) it. Corrections record the requester's verified id; older corrections match on the requester name.
- PMCM can execute approved privacy access/export requests: the subject's own inquiry, event, billing, supplier, guest, and account records are returned once as a JSON bundle, with per-owner audit counts and no record contents in the audit trail. Native-account erasure for client, supplier, and account subjects redacts owner surfaces and the account row atomically, revokes sessions, and is blocked by matching legal holds; staff accounts are refused. PMCM can apply an approved correction as an explicit, validated name/email patch to the subject's own client, supplier, or account records in one transaction; audit entries list changed field names only.
- Official floorplan drafts can start from a PMCM venue-library preset (`venueTemplateId`); the API copies the preset's layout server-side, so client-sent objects cannot replace it. The floorplan editor now refuses table assignments that break eligibility (declined or unknown guest, non-table or hidden object, no free seat) and leaves the layout unchanged. Clients remain denied from presets and official layout mutation.
- Approving a supplier application now records a separate audit entry when it creates the supplier directory record, and approval replays stay silent. PMCM allows only one assessment per supplier per event, enforced by a database unique index; a retry with the original idempotency key still replays. PMCM assessments must rate every active category dimension; the server rejects incomplete or foreign dimension sets, and the closure and directory assessment forms block submit until they are complete. Supplier workspace responses are covered by a test that excludes PMCM-only assessment data.
- Added PMCM risk and change register controls: frozen events require an approved, event-scoped freeze exception before a cancellation or postponement is recorded, and each approval is single-use. PMCM records decisions with an explicit coordinator, supplier, and billing impact review, and can approve or reject exception requests (rejections require a reason). Clients see a client-safe status for change requests that affect their event, without internal reasons.
- PMCM can merge a same-organization or same-email inquiry into a primary inquiry from the inquiry inbox, with a required reason, merge history on both records, and an audit entry. Merged and accepted inquiries cannot be re-merged or re-triaged. Duplicate, previous-decline, parallel-organization, and high-fit cues appear in the inquiry drawer, and PMCM notifications are queued for duplicate and deterministic high-fit inquiries. Public inquiry responses no longer echo PMCM triage fields, and the public schema no longer accepts logged-by fields.
- Added a PMCM-recorded logistics completion record (asset returns verified, audited, correction reason required on replacement). The archive close gate now reads this record instead of always reporting logistics missing, and PMCM can compare 2 to 4 archived events side by side. The wrap-up logistics row mirrors this record and is no longer editable there. Private notes and logistics notes stay out of client, supplier, and comparison payloads.
- PMCM finance can record and resolve billing disputes, request statement corrections and approve or reject them (rejection requires a reason), issue additional billing against an approved source, and waive it with a required reason. Additional billing must trace to an approved billing source of the same event. Clients see dispute status and amount only (no PMCM reasons or actors). Upcoming-balance and overdue-milestone reminders enqueue in the notification queue only, once per milestone.
- Applied the W08 event authority and lifecycle policy: guest feedback stays open until exactly seven days after the recorded actual event end, including after archive, while check-in stays closed for archived events. New inquiries use the Corporate, Government, Individual, and Non-profit categories; legacy Private values become Individual through a non-destructive data migration, and School and Other records stay readable. Only the PMCM-designated Event Day System Operator may mark another coordinator's attendance, and revoking the designation ends that authority immediately.
- Added client and supplier file upload/download with verified content, scoped visibility, immutable object identity, and local/private Supabase adapters. Fixed the API response interceptor to preserve binary file streams.
- Added supplier contract versions and correction reviews, ingress/egress revision acknowledgments and change requests, creative task submissions and reviews, and payable milestones with actual releases and reasoned reversals. Payment status comes from recorded releases; quote locking does not mark a payment paid.
- Added client briefing submission, official-floorplan snapshot decisions and annotations, versioned venue/styling reviews, deliverable and closeout acknowledgments, client feedback, and consent-based testimonial moderation. PMCM retains official-layout ownership.
- Added immutable conforme template prefill and client-first/PMCM countersignature evidence, with event activation only after the signed gate. Added isolated database tests for signing activation, supplier workflow history, payout concurrency, and stale floorplan decisions. Production provider activation remains separate.
- Fixed audit metadata hashing to survive PostgreSQL JSONB key ordering, including nested objects. Previously valid persisted hashes remain compatible; mismatched historical records still block writes and require integrity review. Added a rolled-back PostgreSQL regression test without rewriting audit history.
- Added distinct event Files navigation, persistent client conforme entry, and floorplan load retry. Supplier task retries cannot duplicate an assignment, unchanged schedule publication preserves acknowledgments, and signed storage URLs must match the configured project and exact object path.
- Adapted portal persistence to staging's owner schemas and transaction-aware owner capabilities. Portal database behavior suites now run in the standard isolated PostgreSQL CI job. Updated Sharp and shell-quote to patched versions required by the dependency gate.
- Fixed fresh-database drift from the owner-schema rebaseline: restored canonical account email constraints, initialized the audit chain lock, and aligned roster consent columns with the Prisma schema. Existing case-colliding accounts abort the migration for manual resolution.

- Fixed supplier storage identity and current contract-review status, restored existing conforme executions on dialog reopen, and linked archived client history to consent withdrawal.

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

# Story Log: EP-01-S04, Referral Source Dropdown

**Status: Paused**
**Session(s): 2026-07-11**

## What we set out to do
Verified starting point 30% (Option C). Failing ACs: dropdown UI does not
exist on either the public or on-behalf form; only 5 of 6 required values
exist (PA-62, open); field is optional at the backend rather than required;
on-behalf flow overwrites the value regardless of user choice.

This session's scope was narrowed to the public-form half only (part 1 of
2), per an explicit split decision: the on-behalf form's dropdown depends on
EP-01-S02's unmerged, paused branch, so that half is deferred until S02
merges rather than branching S04 off S02's still-blocked work.

## What we did
Branch `feature/ep-01-s04-referral-source-dropdown` created off a freshly
pulled `origin/main` (not the stale local `main` the plan was originally
drafted against), after a mandatory re-verification gate caught that
discrepancy before any code was touched.

Implemented per the approved plan:
1. `PublicInquiryPage.tsx` — added a required "Referral Source" dropdown, 6
   options including an explicitly flagged unconfirmed "Phone Inquiry"
   value, changed the default from hardcoded `"Website"` to empty/required,
   wired into the step-0 `canContinue()` gate.
2. `inquiry.dto.ts` — `source` made required (`@IsOptional()` removed,
   `source?:` → `source!:`), `'Phone Inquiry'` added to the allow-list,
   flagged unconfirmed in a code comment.
3. `inquiries.service.ts` — one-line comment clarifying the `?? 'Website'`
   fallback is now only reachable by direct service callers, not the public
   HTTP path.
4. `event-ops.ts` — widened `PrismInquiry.source` literal union to include
   `"Phone Inquiry"`, flagged unconfirmed.
5. New `inquiry.dto.test.ts` — 3 tests (accept `'Phone Inquiry'`, reject
   omitted, reject unlisted value).
6. Corrected stale `channel`/line-number evidence in the build-prompt plan
   document once a fresh session's independent re-verification found it
   didn't match the actual branch content (traced to that evidence having
   been captured before the branch was correctly re-based on pulled
   `origin/main`).

Process note: one Claude Code session in this story's build chain made an
unverifiable, and on direct check false, claim about a scheduled-wakeup
message's origin. That session was not trusted further; a fresh session
picked up from the approved plan file and independently re-ran all
verification gates before any edit. A second, later scheduled-wakeup claim
in a different session was checked against the actual tool-call record and
held up as genuine. Both were investigated as this initiative's standing
rule requires, not accepted on assertion.

## What worked
All automated verification passed with real command output: `apps/api`
typecheck clean; full test suite 68 files / 241 tests passed (including the
3 new `source` DTO tests); `apps/api` build clean; `apps/client` typecheck
and build clean, `/inquiry` route present; root monorepo typecheck clean
across 9 packages.

Manual round-trip, step 1 only: browser-confirmed live against the running
client container. Dropdown renders in the correct position with all 6
options in the correct order (including "Phone Inquiry"); Continue is
correctly blocked while the field is empty; selecting a value correctly
advances the step.

## What didn't work
Manual round-trip steps 2 through 5 (submit and confirm DB persistence,
admin-drawer render, curl 400 checks, duplicate-detection survival) are
blocked. `apps/api` cannot boot, neither `nest start --watch` nor the built
production dist, in Docker or on host. Root cause, confirmed by direct
inspection: `packages/types`'s `exports` field points at raw
`./src/index.ts`, which does `export * from "./event-ops"` with no file
extension; Node 22's native ESM loader requires an explicit extension on
relative specifiers, so resolution fails before any app code runs.

Confirmed pre-existing and unrelated to this story's diff: `git status`
shows only `event-ops.ts`'s content changed, the `index.ts` import statement
itself is untouched, and the crash occurs at import-resolution time, before
any changed line is ever reached. Automated typecheck/vitest/build all
passed because none of them execute the app through Node's native runtime
loader, the gap only surfaces when something actually tries to run
`apps/api`.

Escalated to Anthony directly (message sent 2026-07-11), asking whether
`apps/api` boots for him currently and how, and whether the just-merged
auth/RBAC hardening PR touched `packages/types` or its build/export config.
Awaiting response.

No inquiry records were created in the shared dev database (step 1 testing
only advanced to "Event Details," never reached submit), so no cleanup was
required this session.

## New PA findings
None new specific to EP-01-S04's own ACs.

Candidate for a new PA, not yet numbered, pending Anthony's response and
Francis's decision: `apps/api` fails to boot entirely (dev-watch and built
dist alike) due to an ESM extensionless-import resolution bug in
`packages/types`. If confirmed as a genuine, currently-live blocker rather
than something specific to this branch or environment, this is a
shared-infrastructure issue in the same family as S02's migration-checksum
blocker, worth logging and tracking separately rather than folding into
this story.

## Remaining gaps
- Manual round-trip steps 2-5, blocked on `apps/api` booting.
- On-behalf form dropdown wiring, deferred until S02 merges (separate
  follow-up, not part of this session's scope).
- 6th referral source value ("Phone Inquiry") remains unconfirmed by Ms.
  Mys. PA-62 stays open until she confirms.
- Second-owner review not started, DoD not met.

## Resume point, if Paused
Once Anthony responds on `apps/api` boot status:
1. If a workaround exists (different run command, Node flag, build step),
   apply it, get `apps/api` running, then proceed to step 2 below.
2. If confirmed as a genuine shared bug, decide with Francis whether to log
   a new PA number for it and whether it blocks other in-flight stories
   too, separately from this story's own completion.
3. Run manual round-trip steps 2-5 against the shared dev database: submit
   a "Phone Inquiry" record and confirm it persists verbatim; open the
   admin detail drawer and confirm `source` renders with no code change;
   curl `POST /inquiries` with `source` omitted and with an invalid value,
   confirm both return 400; submit a duplicate-email "Phone Inquiry" record
   and confirm `source` survives the duplicate-detection path unchanged.
4. Delete any records created during that verification pass from the
   shared database and confirm deletion with a follow-up query.
5. Once Ms. Mys confirms (or corrects) the 6th referral value, update the
   flagged "UNCONFIRMED" comments in `PublicInquiryPage.tsx`, `inquiry.dto.ts`,
   and `event-ops.ts` accordingly, and close PA-62.
6. Only after 3-5 are complete is the public-form half ready for
   second-owner review. The on-behalf-form half remains a separate resume
   point tied to S02's merge.
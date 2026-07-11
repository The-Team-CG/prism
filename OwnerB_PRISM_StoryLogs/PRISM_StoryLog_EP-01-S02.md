# Story Log: EP-01-S02, Log Inquiry on Behalf

**Status: Paused**
**Session(s): 2026-07-09**

## What we set out to do
Verified starting point 25% (Option C). Failing ACs: no frontend UI existed to
submit an on-behalf inquiry, admin identity hardcoded to "Ms. Mys" regardless
of who is logged in, channel marking (walk-in/phone) not implemented.

## What we did
Backend: added channel field to schema.prisma, CreateInquiryDto (allowlist
validated), both CreateInquiryInput type declarations, the Prisma write in
createInquiryRecord, the mapper, and PrismInquiry. Added a channel-persistence
test.
Frontend: rewrote logInquiryOnBehalf in prism-api.ts to take a session
parameter and a new withPmcmAdminActor helper, replacing the hardcoded actor
for this call path only. Built the on-behalf submission modal in
inquiry-intake-log.tsx. Wired the new prop at all 4 mount sites.
Ran ecc:security-review before the first edit, confirmed the new field
introduces no injection/validation risk and that scoping the identity fix
without closing the endpoint's broader auth gap is defensible, since it isn't
being sold as a security fix.
Logged PA-275 (HIGH) as a 2026-07-09 addendum to EP-01_Audit_2026-07-02.md.

## What worked
Backend code, types, and tests confirmed with real command output: npx vitest
run, 65 files / 231 tests passing. npx tsc --noEmit, exit 0, both backend and
apps/event. Cross-branch migration conflict check, none found.

## What didn't work
Migration blocked twice. First: Supabase project unreachable. Second, after
Supabase resumed: checksum drift on 5 pre-existing migrations from April/May
2026, unrelated to this story, traced to Anthony hand-editing already-applied
migration files during two rename refactors (e7c77b9, ceec0c9). Diagnosis
confirmed the drift sits on dead files, the tables those migrations created
were dropped and replaced by an unrelated, later-renamed schema lineage, so
this is not live-schema divergence. Still requires Anthony's confirmation
before running migrate resolve, since he authored the edits and this touches
shared infrastructure across 10 schemas. No destructive command was run, no
partial writes. Anthony has been messaged, response expected next day.

## New PA findings
PA-275 (HIGH, EP-01-S02), logged. A second candidate, migration-hygiene issue
(already-applied migrations hand-edited post-application), discussed but not
yet numbered, severity depends on Anthony's resolution, flag for Francis to
log once resolved.

## Remaining gaps
Migration not applied. Docker rebuild, manual browser click-through, and
post-write skill checks (frontend-a11y, react-review, typescript-reviewer,
security-reviewer, verification-before-completion) all pending migration
unblock. Admin-identity-recorded AC is code-traced, not yet runtime-confirmed.

## Resume point, if Paused
Once Anthony confirms the resolution approach for the 5 drifted migrations:
1. Apply only the confirmed approach (likely migrate resolve --applied per
   file), do not run migrate reset under any circumstance.
2. Run npx prisma migrate dev --name add_inquiry_channel.
3. Full docker compose down/up --build cycle.
4. Manual browser click-through: sign in as real PMCM admin, submit one
   Walk-In and one Phone on-behalf inquiry, confirm loggedByName shows the
   real admin's name and channel displays correctly in the detail drawer,
   confirm non-PMCM-admin session is blocked.
5. Run frontend-a11y, react-review, typescript-reviewer, security-reviewer,
   and superpowers:verification-before-completion.
6. Decide whether to log a new PA for the migration-hygiene issue itself.
Only then is this story ready for second-owner review.

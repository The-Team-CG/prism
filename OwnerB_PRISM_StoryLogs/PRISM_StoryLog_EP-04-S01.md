 Story Log: EP-04-S01, Conforme Upload

**Status: Complete — merge to main pending**
**Session(s): 2026-07-11**

## What we set out to do
Close AC-1 (PA-138, actor/role check), AC-2 (PA-139, PDF-only constraint), AC-5 (PA-140, file storage, decided report-only), and AC-9 (PA-142, real actor in audit write) for EP-04-S01, per the confirmed build prompt.

## What we did
- Wired actor resolution and a PmcmAdmin-only role check into uploadConforme through all three layers (controller, workflow service, inner service), matching sibling endpoints' pattern.
- Added fileName's @Matches(/\.pdf$/i) as the sole PDF-format gate; deliberately left mimeType unconstrained (spoofable, no security value, risked rejecting legitimate uploads the client already accepts on either signal).
- Replaced the hardcoded 'PMCM Admin' audit literal with the resolved actor's name/role/email.
- Fixed the SampleCompatibilityService and InquiryCommands port call sites for the new signature.
- AC-5/PA-140: no code changes, per decision; re-verified fresh this session that the STUB(EP-04) comment and the missing storageBucket/storageKey are both still present, unchanged.
- Skills used: superpowers:test-driven-development (3 tests written and verified RED before implementation), security-review (built-in checklist), superpowers:verification-before-completion.

## What worked
- 83/83 tests passing across 11 files, npx vitest run libs/modules/inquiry-onboarding libs/modules/sample-compatibility, raw output confirmed.
- npx tsc --noEmit -p tsconfig.json (apps/api), exit 0, zero errors.
- Audit-actor test uses real EventAccessPolicyService and AuditService (not mocks), asserts actor: 'Ms. Mys', actorEmail: 'mys@pmcm.test', and explicitly actor !== 'PMCM Admin' on the resulting audit row.
- git status/diff --stat confirmed: 9 modified tracked files + 1 new untracked test file, 92 insertions(+)/9 deletions(-), matches plan scope exactly.

## What didn't work
- Verification step 4 (manual/curl-level HTTP check against the running dev API) could not be performed. The dev API cannot boot, confirmed via two independent attempts (npx nest start api and npm run dev:api), both fail on the same pre-existing Node 22 ESM error (ERR_MODULE_NOT_FOUND on packages/types/src/event-ops, missing extension) already blocking EP-01-S04. /sample/seed was consequently unreachable, the API never starts. This is not treated as equivalent to the integration test evidence; it is logged as an unmet verification step, not silently substituted.

## New PA findings
Proposing a new, separate cross-cutting PA: no file-byte persistence capability exists anywhere in the API (not conforme-specific), no multer/FileInterceptor usage repo-wide despite the dependency being present, DocumentVaultService only fabricates a storageKey label. Not numbered yet, not folded into EP-04-S01's own PA list.

## Remaining gaps
- AC-1/AC-2/AC-9 are implementation-complete and test-verified, but the plan's own manual HTTP-level check is unmet, blocking full DoD sign-off.
- Second-owner review has not started, correctly, since DoD isn't met yet.
- AC-5/PA-140 remains open system-wide, tracked as a new PA proposal, out of this story's scope.

## Resume point, if Paused
Blocked on Anthony resolving the same Node 22 ESM boot issue already blocking EP-01-S04. Once the dev API can boot: run the manual curl checks from the plan's verification step 4 (POST/inquiries/:inquiryId/conforme with ?actorRole=client expecting 403, and with ?actorRole=pmcm-admin expecting success with a non-'PMCM Admin' audit actor), ideally against a /sample/seed-created disposable record. Only after that passes should this story move to Complete and get the second-owner review request drafted.

## Update: 2026-07-14 — PA-138/139/140 re-verification against current code

Re-verified all three findings from EP-04_Audit_2026-07-03.md against current branch state (post RBAC-hardening merge, post today's Node 22 ESM fix merge, post force-push reconciliation with a stale origin copy). Full verification performed by Claude Code, read-only, no fixes applied.

**PA-138** (originally flagged 2026-07-03, CRITICAL): A `requireActorRole`
check now exists in the uploadConforme chain
(`inquiry-workflow.service.ts:103-114`, added in commit `d7189a9`,
2026-07-12), resolving the literal "no check exists" claim. However, the
underlying exploit path is unchanged: `actorRole` is `@IsOptional()` on the
request DTO (`inquiry.dto.ts:8-10`), and
`EventAccessPolicyService.resolveActor`
(`event-access-policy.service.ts:34-59`) defaults an omitted `actorRole` to
`PmcmAdmin`, which then trivially passes the role check. An unauthenticated
caller supplying no actor info is still treated as PMCM Admin. Same
fail-open default pattern already tracked as a cross-cutting vulnerability
project-wide, not a new or isolated defect. Severity held at CRITICAL, not
closing. Recommend routing to Anthony given the cross-cutting nature, a fix
scoped only to this endpoint would not close the same default elsewhere
it's used.

**PA-139** (originally flagged 2026-07-03): Partially addressed. `fileName`
now has a server-side extension check (`@Matches(/\.pdf$/i)`,
`inquiry.dto.ts:106-123`, added in commit `d7189a9`). `mimeType` remains
`@IsOptional() @IsString()` with no format constraint
(`inquiry.dto.ts:115-117`). Filename-extension checking is trivially
spoofable by renaming any file; true content-type enforcement still does
not exist. Severity downgraded given partial mitigation, not closed.
Reasonable candidate for deferral with a tracked follow-up given its
narrower, more contained scope after this fix.

**PA-140** (originally flagged 2026-07-03): STILL ACCURATE, no change.
`STUB(EP-04)` comment unchanged at `prism-api.ts:514-515` ("File bytes not
transmitted... Coordinate with Anthony"). No `FormData`/`File` object sent,
metadata only. `opsDocument.create` for the conforme document
(`inquiries.service.ts:277-288`) still sets no `storageBucket`/`storageKey`,
unlike the billing document created two blocks later
(`inquiries.service.ts:328-340`), which sets both. AC-5 ("PMCM Admin can
view the uploaded conforme") remains false. Untouched across the RBAC
hardening merge, today's ESM fix, and the branch force-push reconciliation.

**Status:** EP-04-S01 boots cleanly and is mergeable to main from an
infrastructure standpoint (Node 22 ESM fix confirmed working against this
branch's code, verified 2026-07-14). Story-level Done status remains
blocked pending resolution or explicit acceptance of PA-138 and PA-140.
PA-139 is a reasonable candidate for deferral with a tracked follow-up.

**Pending:** sync these three re-verified findings back into
EP-04_Audit_2026-07-03.md (or a dated addendum to it) when convenient, not
blocking.

## Update: 2026-07-15 — PA-138 fixed for uploadConforme specifically

Per Anthony's explicit direction, `uploadConforme` now requires a verified
session actor instead of trusting client-supplied `actorRole`:
`@UseGuards(EventSessionGuard)` + `@VerifiedEventActor()` on the controller
method (`inquiries.controller.ts`), threaded through
`InquiryWorkflowService.uploadConforme`'s new trailing `verifiedActor`
param into the existing `EventAccessPolicyService.resolveActor(input,
verifiedActor)` bypass (`event-access-policy.service.ts:35`), which never
touches the fail-open `PmcmAdmin` default. The shared `resolveActor`
default itself is deliberately untouched — that remains separate, deferred,
project-wide work (per the same reasoning as the 2026-07-14 note above).
New shared module `EventSessionModule` (`libs/modules/event-session/`, its
own top-level lib, imported by both `identity-ops` and `inquiry-onboarding`
via the plain barrel `@prism/modules/event-session`) extracted so
`inquiry-onboarding` can consume `EventSessionGuard` without a circular
module import with `identity-ops`. (An earlier attempt kept the guard inside
`identity-ops` and reached it via a deep tsconfig-path import from
`inquiry-onboarding`; that failed at Vitest runtime — `vitest.config.ts`
maintains its own separate, exact-string-only alias map, unrelated to
`tsconfig.json`'s wildcard `paths` — so the guard was relocated to its own
lib instead, which only needs one plain alias entry, matching every other
module's existing convention.)

**Tracked follow-up debt (not a new PA):** `uploadConforme` now has two
actor-resolution paths — `verifiedActor` (used by the real HTTP route) and
the legacy `actorInput` (kept only because
`SampleCompatibilityService.uploadConforme` calls
`InquiryWorkflowService.uploadConforme` directly, bypassing the HTTP
controller entirely; that call path is unreachable via any live route, per
`SampleController` only exposing `/sample/state`, `/sample/reset`,
`/sample/seed`). This fork should be removed once
`SampleCompatibilityService` is migrated in the same deferred project-wide
resolveActor sweep referenced above — not filed as an independent PA since
the legacy branch carries no live HTTP exposure.

## Update: 2026-07-16 — Live HTTP verification, severity calls, and closeout

Ran the manual curl-level verification specified in this log's own resume
point, now that the Node 22 ESM boot blocker (fixed 2026-07-14) is no
longer in the way. One correction to the original plan: uploadConforme has
no ?actorRole= query param, it's gated by EventSessionGuard, which requires
a real signed bearer token from /api/auth/login. Logged in as seeded
ana@ayala.test (client) and mys@pmcm.test (pmcm-admin) users and used those
tokens instead. This is an adaptation to how the guard actually works
post-2026-07-15 fix, not a deviation from the check's intent.

Check 1, wrong role (client token): HTTP 403,
{"message":"client cannot access conforme upload","error":"Forbidden","statusCode":403}

Check 2, correct role (pmcm-admin token): HTTP 201, document created
successfully. Matching audit row confirms actor: "Ms. Mys",
actorEmail: "mys@pmcm.test", not the literal string 'PMCM Admin'. The same
query surfaced an older pre-fix audit row for contrast
(actor:"PMCM Admin", actorEmail:null).

Check 3, no session at all: HTTP 401,
{"message":"Missing session token","error":"Unauthorized","statusCode":401},
matching Anthony's confirmed behavior from the 401/403 discussion.

AC-1/PA-138 is now closed, end-to-end, at both the automated-test and live-
HTTP level. AC-9/PA-142 is likewise confirmed closed via the real audit row
above, not just the earlier unit-test assertion.

Two findings surfaced during this verification, out of this story's scope,
reported to Anthony the same day, not fixed here:
1. /api/auth/login 500s on a clean local boot — AuthSessionService.sessionSecret()
   throws unless a session secret or NODE_ENV=development/test is set, and
   neither apps/api/.env nor npm run dev:api sets either. Worked around
   locally with a manual NODE_ENV=development restart to complete today's
   checks; this is an environment-config gap affecting any fresh checkout,
   not specific to this story.
2. prisma-exception.filter.ts silently swallows all non-Prisma exceptions
   into a generic 500 with no server-side logging, which is what made
   finding #1 opaque in the first place. Matches the PA-186/187 silent-
   failure shape already in the tracker, logged as corroborating evidence,
   not a new PA.

Second-owner review: confirmed complete. Anthony's earlier merge approval,
given after reviewing the 401/403 behavior and the PA-138 implementation
directly, is confirmed by him to double as the second-owner review, not a
separate step.

Severity calls on the two remaining findings (Francis, this session):
- PA-139: LOW, conditional. No file bytes are transmitted to this endpoint
  at all (see PA-140), so there is currently no real attack surface for a
  spoofed mimeType or extension to exploit, the gap is real but presently
  theoretical. This rating holds only as long as PA-140 stays open — the
  moment real file transmission is built, PA-139 must be re-assessed
  immediately, likely upward.
- PA-140: MEDIUM. Not an active exploit path, but a genuine functional
  completeness gap (AC-5 is false, a PMCM Admin cannot view an uploaded
  conforme) with an underlying data-integrity concern beneath it
  (DocumentVaultService fabricates a storageKey label rather than
  confirming real persistence, so downstream code may be operating on a
  false assumption that storage occurred).

Both ratings clear this project's CRITICAL/HIGH-blocks-Done threshold.

Anthony's response, same day: Independently confirmed the metadata-only
state via his own read of the code (uploadConforme is metadata-only,
DocumentVaultService only validates declared metadata and fabricates the
storage key shape) and surfaced one detail neither prior session's
verification had found: signed upload URLs are explicitly gated behind a
disabled MetadataOnlySignedUploadUrlFactory, confirming this was a
deliberate, known stopping point, not an oversight. Confirmed real content-
type enforcement (PA-139) cannot honestly be completed until the real
upload path (PA-140) exists, and directed both be closed on this story as
explicitly deferred/tracked follow-up scope, not fixed here.

Architecture direction for the combined follow-up, per Anthony, not scoped
further in this story:
- One shared file-ops upload contract/session path, used by conforme,
  supplier docs, guest/live-ops photos, etc., not a conforme-only patch
- Supabase Storage adapter sitting behind a port, not direct storage calls
  from feature services
- Server-side validation of actual file bytes/content signature where
  feasible, not just client-declared mimeType
- Bucket/key policy, access checks, and retention/delete/audit behavior
  defined before enabling production writes
- Existing metadata-only behavior remains in place until that storage plan
  lands, explicitly not to be built piecemeal per-endpoint in the meantime

Severity calls and deferral are both confirmed correct independently by
Anthony's review. PA-139: LOW, conditional on PA-140 staying open, re-
assess immediately once real upload lands. PA-140: MEDIUM. Tracked
together going forward as one file-ops storage adapter follow-up, not two
separate PA numbers to close independently.

Final AC-by-AC status:
AC-1 (PA-138): Closed — automated (27/27, 249/249) + live HTTP (403/201/401 confirmed)
AC-2 (PA-139): Mitigated, explicitly accepted as deferred (LOW, conditional)
AC-5 (PA-140): Report-only scope met as committed; underlying gap explicitly accepted as deferred (MEDIUM), combined follow-up per Anthony's direction
AC-9 (PA-142): Closed — automated + live audit-log confirmation

Remaining gaps: none blocking Done. PA-139/PA-140 tracked together as a
file-ops storage adapter follow-up per Anthony's architecture direction,
not this story's responsibility to build further.

Resume point: not applicable, story complete pending merge to main.
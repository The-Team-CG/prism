 Story Log: EP-04-S01, Conforme Upload

**Status: Paused**
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

Re-verified all three findings from EP-04_Audit_2026-07-03.md against
current branch state (post RBAC-hardening merge, post today's Node 22 ESM
fix merge, post force-push reconciliation with a stale origin copy). Full
verification performed by Claude Code, read-only, no fixes applied.

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
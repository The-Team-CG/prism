# EP-01 Regression Test Execution — 2026-07-02

## 1. Test files located

All under `apps/api/libs/modules/inquiry-onboarding/src/`:

| File | Tests |
|---|---|
| `services/inquiries.service.test.ts` | 3 |
| `services/inquiry-workflow.service.test.ts` | 1 |
| `services/client-onboarding-workflow.service.test.ts` | 1 |
| `services/inquiry-conforme-reminder.scheduler.test.ts` | 2 |
| `controllers/inquiries.controller.test.ts` | 2 |
| `controllers/onboarding.controller.test.ts` | 2 |
| `controllers/event-briefing.controller.test.ts` | 2 |

No dedicated test file exists for `inquiry.dto.ts` or `inquiry.mappers.ts`, confirmed via glob, not inferred. No frontend test files exist at all under `apps/client/**` or `apps/event/**` (glob returned zero matches for both).

## 2. Suite execution (actual run)

```
npx vitest run libs/modules/inquiry-onboarding/src --reporter=verbose
```
✓ inquiry-workflow.service.test.ts > denies anonymous actors from non-public onboarding reads
✓ client-onboarding-workflow.service.test.ts > replaces the client briefing and advances event readiness
✓ inquiries.service.test.ts > requires privacy consent for public inquiry creation
✓ inquiries.service.test.ts > blocks non-PMCM actors from logging inquiries on behalf of clients
✓ inquiries.service.test.ts > links duplicate and previous declined inquiries by normalized email
✓ inquiry-conforme-reminder.scheduler.test.ts > does not start the reminder interval when disabled
✓ inquiry-conforme-reminder.scheduler.test.ts > runs the conforme reminder sweep on the interval
✓ onboarding.controller.test.ts > keeps the public onboarding route base stable under inquiry-onboarding ownership
✓ onboarding.controller.test.ts > serves onboarding reads through InquiryWorkflowService with inquiry-owned mappers
✓ inquiries.controller.test.ts > keeps the public inquiries route base stable under inquiry-onboarding ownership
✓ inquiries.controller.test.ts > serves inquiry routes through InquiryWorkflowService with inquiry-owned context
✓ event-briefing.controller.test.ts > keeps event briefing routes under the events route base
✓ event-briefing.controller.test.ts > serves client briefing submission through InquiryOnboarding with the legacy response shape
Test Files  7 passed (7)
Tests  13 passed (13)

13/13 pass, 0 failures. No test failure output to report.

## 3. Gap coverage, confirmed by reading test source, not inferred

| Gap from prior audit | Test coverage exists? | Result / evidence |
|---|---|---|
| Referral dropdown rendering on public form | No | No frontend test files exist anywhere under `apps/client/**` (glob: 0 matches). Nothing exercises `PublicInquiryPage.tsx`. |
| Contact/phone-based duplicate detection | No | `inquiries.service.test.ts:113-138` only asserts email-based matching. Test fixture (lines 6-45) has no phone field at all, not even modeled in test data. |
| Prior-rejection flag exclusion from public API response | No | The only related test (`inquiries.service.test.ts:137`) asserts the opposite, confirms the field IS populated on the service return value. No test checks the controller's HTTP response shape or that this field is stripped before reaching the public caller. |
| Server-side role check on uploadConforme | No | `inquiries.controller.test.ts:49` calls `controller.uploadConforme('inq_sample', { fileName: 'signed.pdf' })` with no actor argument, asserts only that it resolves and forwards params. No rejection path tested, consistent with the controller method having no actor parameter at all. `inquiry-workflow.service.test.ts` has exactly one test, covers `listOnboarding`, not `uploadConforme`. |
| Real session-derived actor identity vs. hardcoded "Ms. Mys" | No | The hardcoded actor lives in `apps/event/src/lib/prism-api.ts`, a frontend file. Zero test files exist under `apps/event/**` (glob: 0 matches). |
| Audit log entry containing inquiry ID on onboarding | No | The only audit-assertion test is `client-onboarding-workflow.service.test.ts:49-54`, checks the audit call for briefing submission, unrelated to `uploadConforme`/onboarding. No test anywhere asserts on the audit call in `inquiries.service.ts:410-417`, nothing checks whether `inquiryId` is present. |

All 6 gaps: confirmed zero test coverage, each verified by direct inspection of the relevant test file(s), not inferred from file names or adjacent tests.

---

## ADDENDUM, 2026-07-05

**What this adds:** A cross-reference only. No new regression test execution was performed as part of this addendum. EP-01-S01 through EP-01-S04's status as confirmed Done-story regressions (see `EP-01_Audit_2026-07-02.md`, the file this regression report accompanies) is now backed by specific verified numeric completion percentages, not qualitative mismatch language alone.

**Where to find the numbers:** See the "ADDENDUM, 2026-07-05" section appended to `EP-01_Audit_2026-07-02.md` (same date) for the full per-story verified percentages (EP-01-S01 ~55-60%, EP-01-S02 ~25-30%, EP-01-S03 ~15-20%, EP-01-S04 ~30-35%) and their supporting new PA findings (PA-256 through PA-260). Not duplicated here, to avoid two sources of truth for the same numbers.

**Why this matters for this file specifically:** The 13/13 passing test count and the 6-gap zero-coverage table above remain accurate and unchanged; this addendum does not revise any test-execution finding in this file. It only notes that the qualitative gaps this file already lists (for example, "server-side role check on uploadConforme: No") now have a corresponding quantified completion percentage recorded in the sibling audit file, for anyone using this regression report alongside that file for planning purposes.
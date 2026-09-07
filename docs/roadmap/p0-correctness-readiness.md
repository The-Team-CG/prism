---
type: "Capability Readiness Report"
title: "P0 correctness readiness"
description: "Implementation status, effort, priority, risk, acceptance evidence and remaining blockers for catalog work packages W01-W09."
tags: [roadmap, readiness, catalog, correctness, verification]
status: active
authority: informative
owner: "D (Anthony)"
audience: [product, engineering, reviewers]
scope: "P0 W01-W09 correctness and policy work; broader catalog capability completion remains separately gated"
updated: "2026-09-08"
last_verified: "2026-09-08"
sources:
  - resource: "docs/reference/prism-v4/complete-feature-catalog.md"
    title: "V4 source catalog"
  - resource: "docs/product/feature-ledger.md"
    title: "Current feature decisions"
  - resource: "docs/product/event-authority-and-lifecycle-policy.md"
    title: "Accepted W08 policy"
  - resource: "apps/api/src/modules"
    title: "Corrected commands and regression tests"
  - resource: "apps/api/scripts/p0-session-smoke.cjs"
    title: "Built API session inventory and HTTP acceptance checks"
---
# P0 correctness readiness

## At a glance

- **Purpose:** Show what the P0 corrections deliver and what still prevents complete catalog workflows.
- **Authority:** Evidence-led readiness report; the feature ledger owns product direction.
- **Owner:** D coordinates verification; B owns PMCM operations, C portals/suppliers, A UX.
- **Scope:** W01-W09 from the catalog effort, priority and risk matrix.
- **Use/change:** Review release readiness, reproduce checks or complete a named dependency; update when evidence or blockers change.
- **Verify with:** Shared contract builds, affected portal/API tests and typechecks, boundary/complexity checks, isolated PostgreSQL transactions and the actual built API HTTP sweep.

## Reading the matrix

The catalog review at baseline `3d01c6c95f6955843539c8c3ba0ef3779941de79` counted 137 unique IDs: 11 implemented, 79 partial and 47 not implemented. Ninety IDs had an overlapping blocker; 37 behavior rows were unassessed. Its 52 work packages contained nine P0, 24 P1, 11 P2 and eight P3 packages. Those are historical review counts, not a new whole-catalog score after these corrections.

Effort below preserves the original person-day estimates, not measured agent runtime: S = 2-3, M = 4-7, L = 8-15. Impact is the consequence of leaving the issue; fix risk is the chance or cost of regression. All nine have high impact. Implemented means the bounded P0 acceptance is delivered; a dependent P1/P2/P3 workflow can still be partial or blocked.

## Effort, priority and risk matrix

| Package and owner goal | Priority | Effort | Fix risk | P0 status | Delivered behavior | Remaining capability dependency |
| --- | --- | --- | --- | --- | --- | --- |
| W01 Billing source and totals — B; C/D | P0 | M | Medium | Implemented | Signed conforme unlocks onboarding without inventing an approved 520000 bill. Client headers reconcile actual payments and remaining balances. | W12/W14: real approved CE/proposal sources, generated documents and full billing lifecycle. |
| W02 Proposal decisions — D; B/C | P0 | L | High | Implemented; production issuer blocked | Primary-client identity, portal/lifecycle gates, issued-version binding, revision reason, atomic audit and stable retries. A decision on a reviewed version requires a newer issued version. | W12 must create real issued, reviewable proposal versions. No current production issuer exists; UI/server reject approval until one exists. |
| W03 Staffing conflicts — B; D | P0 | L | High | Implemented | Cancelled/replaced assignments do not consume availability, coverage or event scope. Regular booking and live replacement share a coordinator/day transaction lock. Ownership uses identity, not names. | W18/W20: full availability, notification and designated-operator workflow. |
| W04 Supplier integrity — C; B/D | P0 | L | High | Implemented | Terminal application guards, selected-assignment confirmation, state/identity locks, eligible event reviews and payload-bound replay with one logical audit effect. Confirmed supplier cancellation remains supported. | W15/W16/W40: application conversion, full readiness/selection and assessment depth. |
| W05 Truthful closeout — B; D | P0 | L | High | Implemented; logistics source blocked | Explicit deliverables, billing, logistics, issues and client-feedback gates. Archive rechecks state/gates and commits event, audit and notification intent atomically. | W27: authoritative logistics completion, recorded event end and richer closure workflow. Missing logistics requires a reasoned PMCM override. |
| W06 Privacy execution — D; B | P0 | L | High | Implemented within supported scope | Unsupported access/correction or native-account erasure stays approved, not Executed. Supported operational deletion reconciles normalized/duplicated identity in one audited transaction and preserves event/subject scope. | W29/W10: full native-account erasure, retained audit/legal-hold policy and stored-file lifecycle. Operational soft redaction is not universal erasure. |
| W07 Sessions and ownership — D; B/C | P0 | L | High | Implemented | Sensitive routes use signed sessions and verified actors. Client, supplier and coordinator access is tied to authoritative identity and event/assignment scope; expiry and spoof rejection run through actual HTTP. Raw published layouts are PMCM-only because they contain guest/supplier data. | W28 recovery/per-role TTL enhancements and external IdP remain separate. |
| W08 Authority/lifecycle policy — B; A/C/D | P0 | S | Low | Decided and documented | PMCM official-layout authority, designated attendance operator, recorded-end/wrap-up/close rules, seven-day feedback after end including archive, and catalog client-category mapping. | Engineering remains in W18/W20/W23/W27/W31/W34; see the [accepted policy](../product/event-authority-and-lifecycle-policy.md). |
| W09 Live AI off-switch — D; B | P0 | M | Medium | Implemented | Mock mode remains usable. Live/unknown modes fail before SDK/network calls, including direct agent entry points. Persisted approval/rejection validates the matching request, context and state. | W44/W45: approved provider, retention/governance proof and live PARE implementation. This correction does not enable live AI. |

## Acceptance evidence

The database acceptance uses a fresh schema in an isolated PostgreSQL 18 instance on loopback, with randomized fixture identities and exact fixture cleanup. It uses no production data, reset, external provider or schema migration. The tests exercise real transaction rollback and concurrency; mocks are limited to external effects where identified.

| Area | Executed evidence | What the evidence establishes |
| --- | --- | --- |
| Proposal | Seven PostgreSQL cases plus policy/controller/client retry tests | Issued version and primary client checks, replay binding, concurrent one-effect behavior and audit rollback. It does not prove a production proposal issuer. |
| Staffing | Three PostgreSQL transaction cases plus staffing scope tests | One winner for competing booking, cancelled assignment availability, regular booking versus replacement using the same lock. |
| Supplier | Six PostgreSQL cases plus transition/review tests | Application terminal races, quote confirmation/withdrawal eligibility, identity changes and transactional effects. |
| Closeout | Six PostgreSQL cases plus gate/controller tests | Missing-evidence rejection, reasoned override, audit/outbox rollback, concurrent archive and document-completion rollback. |
| Privacy | Seven PostgreSQL cases plus supported/unsupported scope tests | Normalized and duplicate identity redaction, role/event separation, namesake protection and rollback. |
| Sessions | Built Nest application, runtime controller inventory and missing/malformed/expired signed-session HTTP checks | Guards execute on registered routes; authenticated role checks reject spoofed query/body identity. The sweep also catches unguarded sensitive routes and runtime dependency wiring errors. |
| AI | Mock/preflight and decision-state regressions | Live calls are denied before external effects; invalid or repeated approval transitions cannot authorize an action. |

## Combined verification

| Check | Result |
| --- | --- |
| API suite with isolated PostgreSQL enabled | 103 files, 492 tests passed, including the 65-test sample-compatibility suite. |
| Client portal tests | 11 files, 46 tests passed. |
| Event portal tests | 29 files, 100 tests passed. |
| Shared API-client tests | 23 tests passed. |
| Shared schema tests | Five files, 37 tests passed, including billing approval actor stripping. |
| Typechecks | Types, API-client, API and all four portals passed. |
| API build and actual HTTP | Nest build passed; 113 guarded routes, 361 checks passed, zero failures and zero unexpected public routes. |
| Architecture checks | Boundary check and 11 boundary/complexity test cases passed; 5680 production functions meet the maximum complexity of 10. |
| Database structure and queries | Prisma schema validated; offline schema SQL generated; query audit passed for 242 API source files. Parameterized lock queries carry explicit query-audit reasons. |
| Documentation | Frontmatter, relative links and transient-path audit passed for the changed bundle documents. |

The HTTP suite exercises signed session expiry, actor spoofing, own/foreign client
reads, active coordinator access, cancelled/replaced assignments and inactive
profiles. It explicitly inventories public intake, auth and scoped capability
exceptions. Sample state is denied in production; the smoke never invokes reset.
Portal transport review confirmed bearer-token propagation for the changed APIs.

No complete browser journey, staging deployment, production configuration,
external delivery/provider integration or reset-based legacy API smoke was
executed. The legacy smoke script's token/fixture updates are syntax-checked only.
No schema migration or production database mutation is part of this delivery.

To reproduce the database/HTTP checks, provision a disposable PostgreSQL database
named `prism_p0` on `127.0.0.1:55437`, apply the current Prisma schema to that empty
database, and set `P0_TEST_DATABASE_URL` to its connection URL. The tests reject
other targets and clean their own randomized fixtures. Build `@prism/types`, then
run the API's normal `test` and `build` scripts. From `apps/api`, run
`node scripts/p0-session-smoke.cjs`; optionally set `P0_SMOKE_REPORT` to retain its
JSON inventory/results. Database cases are skipped when the test URL is absent,
so an ordinary unit-only CI pass must not be presented as database proof.

## Blockers and next owner action

| Blocker | Affected complete feature | Owner and next action |
| --- | --- | --- |
| No production proposal issuer/version creation path | Proposal review and source-linked commercial lifecycle | B/D: implement W12 with shared version/issue contracts, then C verifies a real client review journey. |
| No authoritative logistics completion or actual event-end timestamp | Automatic close readiness, wrap-up and timed guest feedback | B/D: implement W27; retain explicit missing gates and audited overrides meanwhile. |
| Native-account/file/retention scope not implemented for privacy execution | Full privacy rights fulfillment | D: specify and implement W29/W10; never relabel unsupported requests as Executed. |
| No approved live AI governance/provider path | Live AI and PARE | D/B: complete W44/W45 before changing the off-switch. |
| Operator/window/taxonomy policy has no downstream implementation yet | Designated attendance, seven-day feedback and catalog category form choices | B/C/D: implement the specific downstream rows; policy acceptance alone is not runtime delivery. |

Human second-owner review remains required before merge. Local automated and agent reviews do not replace the GitHub review record required by the constitution.

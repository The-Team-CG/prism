---
type: "Architecture Design"
title: "Coordinator role catalog and skill-aware staffing suggestions"
description: "Design for canonical coordinator role writes and explainable skill-based candidate ranking."
tags: [coordinators, staffing, contracts, architecture]
status: proposed
updated: "2026-10-02"
authority: proposed
owner: "B (Francis); implementation boundary D (Anthony)"
audience: [product, event operations, engineering]
scope: "Coordinator role writes and staffing candidate matching for FR-13 and FR-89"
last_verified: "2026-10-02"
sources:
  - id: agent-instructions
    resource: "AGENTS.md"
    title: "P.R.I.S.M agent instructions"
  - id: feature-ledger
    resource: "docs/product/feature-ledger.md"
    title: "P.R.I.S.M feature ledger"
  - id: staffing-rules
    resource: "apps/event/src/features/coordinators/desk/model/coordinators-desk-rules.ts"
    title: "Coordinator desk rules"
  - id: assignment-command
    resource: "apps/api/src/modules/operations/application/staffing/coordinator-assignment-command.service.ts"
    title: "Coordinator assignment commands"
  - id: shared-types
    resource: "packages/types/src"
    title: "Shared contracts package"
---
# Coordinator role catalog and skill-aware staffing suggestions

## At a glance

- **Purpose:** Replace provisional coordinator role strings in new writes with one shared catalog and make assignment suggestions explain how candidates fit the event's skill requirements.
- **Decision:** Keep the seven role names already used by the product; publish them from @prism/types; keep historic unknown role strings readable; rank eligible candidates by matched required skills.
- **Owner:** B (Francis) for staffing policy; D (Anthony) for shared contracts and API boundaries.
- **Scope:** Role values written for coordinator staffing, the PMCM assignment desk's skill filter, and API candidate suggestions.
- **Non-goals:** Database enum conversion, historical row rewriting, hard skill gates, automatic reassignment approval, or unrelated coordinator screens.
- **Safety:** A role name never grants Event Day System Operator authority. That authority continues to require a separate, event-specific designation.
- **Verification:** Shared-types build and tests, focused API and event portal behavior tests, touched workspace typechecks, and check:boundaries.

## Current behavior and gap

The event app keeps a provisional role list in coordinator desk rules and repeats role options in other UI and fixture locations. Roles are persisted as strings. The API suggestion command considers role, activity, availability, and same-date assignment conflicts, sorts names alphabetically, and returns at most five candidates. Coordinator skill tags and coverage requirements already exist, but the assignment desk cannot filter on them and the suggestion response does not explain skill fit.

## Considered approaches

1. **Keep role strings and add only a client-side filter.** This changes little, but leaves role lists duplicated and produces incomplete or stale candidate results when the desk only has part of the candidate set.
2. **Use one shared Zod catalog for new writes and rank candidates in the API.** This removes duplicated role lists, preserves old data without a migration, and gives the UI one authoritative suggestion result. This is the recommended approach.
3. **Convert persisted roles to a database enum and make skill matches mandatory.** This would need historical data mapping and deployment coordination; mandatory skill matching could hide otherwise eligible staff when profiles are incomplete. The current product evidence does not justify those costs or restrictions.

## Approved design

### Role catalog and legacy compatibility

Add a coordinator role catalog to @prism/types, backed by a Zod enum schema and an inferred TypeScript type. The canonical values are:

- General Coordinator
- Event Day System Operator
- Registration Staff
- Floor Director
- Stage Director
- Ingress and Egress Assistant
- Usher

All new coordinator-role writes must validate against the shared schema. Role selectors and fixtures import the shared catalog instead of keeping local copies. API and UI read models continue to expose role values as strings so existing rows remain readable, including values outside the catalog. Do not silently rewrite or normalize historical values. When a user edits a legacy value, require them to choose a current catalog value before writing that role.

Role comparisons for matching use trimmed, case-insensitive values so harmless formatting differences in historical rows do not prevent candidates from being found. New writes still use the exact canonical spelling from the catalog. The Event Day System Operator role does not bypass any authorization check: access to operator-only actions remains controlled by the event-specific designation.

### Skill-aware candidate matching

Use the existing event coverage requirement's required-skill tags and coordinator profile skill tags; do not add a new skill store or change the database schema in this slice. Normalize skill tags by Unicode normalization, trimming, collapsing repeated whitespace, and case-insensitive comparison. Preserve the original spelling for display.

The API remains the authoritative candidate source. For each request it:

1. Preserves existing eligibility rules: active coordinator, matching role, no conflicting active assignment on the event date, and no declared unavailability.
2. Computes matched and missing required skills for each otherwise-eligible candidate.
3. Excludes a candidate only when they fail one or more skills explicitly selected in the assignment desk filter. Skill requirements alone remain advisory, so candidates with missing skills can still be suggested.
4. Ranks by number of required skills matched, descending; then normalized display name and stable coordinator ID, ascending.
5. Applies the existing five-candidate limit only after ranking.

Each suggestion includes the matched and missing skill tags and the match counts so the assignment desk can explain the ranking. The UI displays those details and sends selected skill filters to the API; it does not create a second local candidate list or re-rank server results. With no required skills, suggestions retain stable alphabetical ordering. No candidate may be returned outside the request's existing event and staffing authorization scope.

### Contracts and ownership

- Shared role write schema and inferred type live in packages/types/src/schemas and are exported from the package index.
- Any new shared request or response contract is added to @prism/types; do not add app-local copies.
- API matching remains within the Operations staffing bounded context. Existing route and access-control boundaries remain in force.
- Event UI changes stay under the coordinator desk feature; HTTP remains in its feature data layer.
- No direct cross-context service imports, Prisma enum change, or database migration is part of this design.

## Acceptance criteria

- The seven catalog values are defined once and reused by all coordinator role write surfaces and fixtures touched by the implementation.
- A new write with a value outside the catalog is rejected at the shared contract boundary; existing unknown values can still be read and displayed.
- Event-specific operator designation remains required regardless of the selected role.
- Skill tags are normalized consistently for matching, filtering, and ranking while preserving their original display text.
- The API excludes inactive, wrong-role, unavailable, and same-date-conflicted candidates as it does today.
- A selected skill filter requires every selected skill; candidates missing other required skills remain visible with those skills identified.
- Candidate ranking is deterministic and happens before the five-result cap.
- The assignment desk shows match details and uses the API's ordering.
- Behavior tests cover accepted and rejected roles, legacy reads, skill normalization, selected-skill filtering, missing-skill explanation, eligibility exclusions, stable ties, and top-five ranking.
- Shared types build and test, touched workspaces typecheck, and check:boundaries passes.

## Delivery sequence for the remaining coordinator gaps

Each item below is a separate design and implementation slice after this staffing slice. Preserve the established behavior and add evidence-based tests.

1. **#12 Multi-event coordinator home:** show all assigned events with dates, venues, and status; allow switching to each active event and opening historical assignments in their permitted read-only state.
2. **#20 Registration desk and access scoping:** expose guest search, check-in, and verification in the coordinator portal only to appropriately assigned registration roles. First enforce active event assignment and role scope in the API, then wire the UI. Preserve guest consent, audit, and walk-in rules.
3. **#14 Reliability history:** expose late, absent, replacement, and withdrawal reasons in an event-scoped history. Record withdrawals in the reliability timeline using their persisted reason, without creating duplicate entries on retries.
4. **#15 Coordinator event insights:** add coordinator attendance, replacements, and reliability summaries to closure insights; depends on the history semantics in #14.
5. **#16 Live updates:** refresh coordinator event-day tasks, issues, and check-in counts, and the PMCM live desk, using bounded polling consistent with the guest app.
6. **#17 Timed rules:** schedule idempotent acknowledgement follow-ups using a configurable lead time with the current seven-day value as the default; add an idempotent supplier ingress late sweep using the approved 15-minute threshold. Reassignment approval remains manual; never act on the two-minute timestamp automatically.
7. **#18 Postponement availability:** surface date conflicts from the existing postponement check, allow PMCM to choose how to handle them, and revalidate immediately before confirming a reschedule.
8. **#19 Schedules, handoffs, and end-of-day reports:** add coordinator/PMCM screens for existing schedule, shift-handoff, and end-of-day API workflows, with event-scoped authorization and validation.

## Rollout

No migration is expected. Deploy shared types with the API and event app in the same release so write validation and selectors agree. Existing API consumers that omit the optional skill filter keep the current eligibility behavior and receive ranked results. Review any old role values surfaced during rollout; map them deliberately only when a real product decision is made.

This design covers the approved first slice, not completion of the remaining items. Each follow-on slice should begin from a fresh check against staging and get its own focused design and implementation plan.

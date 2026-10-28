---
type: "Product Policy"
title: "Event authority and lifecycle policy"
description: "Accepted authority, event-end, feedback-window and client-category decisions, with current implementation limits."
tags: [product, authority, lifecycle, feedback, taxonomy]
status: canonical
authority: normative
audience: [product, engineering, design, reviewers]
scope: "Event authority, event-end, wrap-up, close/archive, feedback-window and client-category rules"
updated: "2026-10-29"
last_verified: "2026-10-29; operator designation/revoke, event-day start, client snapshot review/annotation and wrap-up reminder routes in apps/api"
sources:
  - resource: "AGENTS.md"
    title: "Role ownership and system goals"
  - resource: "docs/product/feature-ledger.md"
    title: "Active product decisions"
  - resource: "docs/reference/prism-v4/complete-feature-catalog.md"
    title: "V4 catalog terminology and lifecycle intent"
  - resource: "Product owner decisions, 2026-09-08"
    title: "Designated attendance operator, delegated feedback-window choice and catalog category mapping"
---
# Event authority and lifecycle policy

## At a glance

- **Purpose:** Resolve the authority and lifecycle choices that blocked dependent feature design.
- **Authority:** Accepted product policy; an accepted rule does not establish implementation readiness.
- **Scope:** Official layouts, attendance, event end and wrap-up, close/archive, feedback and client categories.
- **Use/change:** Apply when implementing these workflows; revise when the product owner changes a rule.
- **Verify with:** The feature ledger, shared contracts, and role-denial tests.

## Authority and lifecycle matrix

| Concern | Accepted rule | Current behavior and remaining implementation |
| --- | --- | --- |
| Official floorplans | PMCM owns creating, editing, submitting and approving official layouts in `apps/event`. Clients submit preferences and view their submitted/approved official layouts. A future client approval/comment action records a separate decision; it grants no official editing rights. | Role boundaries exist. Clients record snapshot-bound approve/request-revision decisions and object or point annotations against a submitted/approved official snapshot; see [client and supplier workflows](client-supplier-workflows.md#client-decisions). |
| Event Day System Operator | PMCM may designate a coordinator for a specific event to mark other active coordinators' attendance at that event. Ordinary coordinators retain self-attendance only. PMCM retains administrative authority. | Per-event designation and delegated attendance enforcement exist. A role label, display name or caller-supplied field must never grant operator authority. |
| Operator audit | Store who designated/revoked the operator, the event, target coordinator, attendance action, actor identity and time. Revocation ends delegated authority immediately. | Designation, revocation and delegated attendance actions are event-scoped and audited. |
| Start event day | PMCM explicitly starts an unlocked event after signed conforme and official floorplan approval. Repeating the action is safe; cancelled, postponed, ended and archived events cannot start. | `POST /events/:eventId/start-event-day` and the PMCM live-operations desk provide the guarded transition. |
| Recorded event end | PMCM or that event's designated operator records the actual event-end instant. This starts wrap-up. Event date alone is insufficient to compute a deadline. Corrections require a reason and audit. | The event-end capability records the authoritative actual-end timestamp and wrap-up deadline; reasoned corrections are audited. |
| Wrap-up | Allow 24 hours from recorded end for operational wrap-up, with reminders at 12 and 24 hours where work remains. A deadline does not silently archive an event. | Recorded end supplies the 24-hour deadline; a scheduler enqueues wrap-up reminders in the notification outbox. External delivery of those notices stays gated with FL-014. |
| Close and archive | PMCM evaluates deliverables, billing, logistics, unresolved issues and client feedback. Missing evidence prevents archive unless PMCM supplies a recorded override reason. Archive is a guarded, audited action; elapsed time alone cannot trigger it. | Closure evaluates recorded document, billing, logistics, issue and client-feedback evidence before transactional archive; missing evidence requires an explicit override reason. |
| Guest feedback | Feedback stays open until exactly seven days after recorded event end, including after archive. Archive does not extend the deadline. Consent, event-code scope and moderation still apply. Other guest actions, including check-in, do not inherit this exception. | The guest feedback policy uses the recorded end and permits feedback after archive within the seven-day window. If recorded end is unavailable, it does not infer a deadline from event date. |
| Client feedback close gate | Client feedback is its own submitted evidence. Guest feedback does not satisfy that close gate. A reasoned PMCM override may permit close while feedback remains outstanding. | Closure distinguishes the exact client-feedback type/tracked title from unrelated files and guest feedback. |
| New inquiry categories | Use Corporate, Government, Individual and Non-profit. Normalize the legacy Private value to Individual when migrating/editing that field. | The shared schema, form choices and a data migration implement the explicit mapping. Existing School/Other records remain readable and retain their historical value until deliberately reclassified; no invented mapping or bulk deletion. |

These rules are implemented; remaining limits are recorded in the [feature ledger](feature-ledger.md).

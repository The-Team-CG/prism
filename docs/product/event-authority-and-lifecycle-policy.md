---
type: "Product Policy"
title: "Event authority and lifecycle policy"
description: "Accepted authority, event-end, feedback-window and client-category decisions, with current implementation limits."
tags: [product, authority, lifecycle, feedback, taxonomy]
status: canonical
authority: normative
owner: "B (Francis)"
audience: [product, engineering, design, reviewers]
scope: "W08 policy decisions and the dependent W20, W23, W27, W31 and W34 capabilities"
updated: "2026-09-28"
last_verified: "2026-09-08"
sources:
  - resource: "AGENTS.md"
    title: "Role ownership and owner goals"
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
- **Owner:** B; A owns clear role UX, C external portals, D authorization and audit integrity.
- **Scope:** Official layouts, attendance, event end and wrap-up, close/archive, feedback and client categories.
- **Use/change:** Apply when implementing these workflows; revise when the product owner changes a rule.
- **Verify with:** The feature ledger, shared contracts, role-denial tests, and the readiness foundation.

## Authority and lifecycle matrix

| Concern | Accepted rule | Current behavior and remaining implementation |
| --- | --- | --- |
| Official floorplans | PMCM owns creating, editing, submitting and approving official layouts in `apps/event`. Clients submit preferences and view their submitted/approved official layouts. A future client approval/comment action records a separate decision; it grants no official editing rights. | Role boundaries exist. Formal client approval/versioned annotation remains W34. |
| Event Day System Operator | PMCM may designate a coordinator for a specific event to mark other active coordinators' attendance at that event. Ordinary coordinators retain self-attendance only. PMCM retains administrative authority. | Per-event designation and delegated attendance enforcement remain W20/W18. A role label, display name or caller-supplied field must never grant operator authority. |
| Operator audit | Store who designated/revoked the operator, the event, target coordinator, attendance action, actor identity and time. Revocation ends delegated authority immediately. | Requires the designation model, authorization checks and actor/target audit tests in W20. |
| Recorded event end | PMCM or that event's designated operator records the actual event-end instant. This starts wrap-up. Event date alone is insufficient to compute a deadline. Corrections require a reason and audit. | The current event model has no authoritative actual-end timestamp or explicit wrap-up state. W27 supplies these sources. |
| Wrap-up | Allow 24 hours from recorded end for operational wrap-up, with reminders at 12 and 24 hours where work remains. A deadline does not silently archive an event. | State/deadline implementation is W27; scheduled provider delivery is W11. |
| Close and archive | PMCM evaluates deliverables, billing, logistics, unresolved issues and client feedback. Missing evidence prevents archive unless PMCM supplies a recorded override reason. Archive is a guarded, audited action; elapsed time alone cannot trigger it. | W05 implements truthful gates and transactional archive. Logistics completion has no authoritative source yet, so its gate remains missing and requires an explicit override. |
| Guest feedback | Feedback stays open until exactly seven days after recorded event end, including after archive. Archive does not extend the deadline. Consent, event-code scope and moderation still apply. Other guest actions, including check-in, do not inherit this exception. | W23/W27 must implement the timestamp-based window. Today archive closes guest access; this pass does not claim the seven-day window is running. If recorded end is unavailable, do not infer a feedback deadline from event date. |
| Client feedback close gate | Client feedback is its own submitted evidence. Guest feedback does not satisfy that close gate. A reasoned PMCM override may permit close while feedback remains outstanding. | W05 distinguishes the exact client-feedback type/tracked title from unrelated files and guest feedback. |
| New inquiry categories | Use Corporate, Government, Individual and Non-profit. Normalize the legacy Private value to Individual when migrating/editing that field. | W31 implements shared schema, form choices and the explicit mapping. Existing School/Other records remain readable and retain their historical value until deliberately reclassified; no invented mapping or bulk deletion. |

These decisions close the W08 policy dependency. Their downstream engineering work retains its existing priority; operator delegation, the feedback window and category migration are not counted as implemented P0 features.

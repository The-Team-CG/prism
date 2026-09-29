# Hardcoded Inputs and Consent Evidence Design

**Status:** Proposed for implementation
**Date:** 2026-09-29
**Base:** staging at 944f8e90
**Owners:** C (Ethan) for external portal flows; B (Francis) for PMCM; D (Anthony) for API and contracts

## Problem

A single privacy notice version is repeated across the four portals and API modules. The client dashboard new-event request marks privacy consent accepted even though that form has no consent control. The user model has no account-level consent fields; inquiries and approval requests each store their own consent evidence. Sample credentials are included in client, event, and supplier sign-in UI/view-models. Event authenticated requests also pass placeholder actor identities even though the API resolves the actor from the verified session.

## Goal

Keep shared policy identifiers consistent, record consent only when the flow has evidence for it, and remove misleading hardcoded identity and demo credential affordances from normal portal UI.

## Design

Export one PRISM_PRIVACY_NOTICE_VERSION constant from @prism/types and use it in the portals and API defaults that refer to the same notice. Keep its current value and notice copy unchanged. This is a single code source for the version identifier, not a new runtime policy system.

For each consent flow, preserve server validation and store an acceptance only after the user explicitly accepts that flow's notice. Keep marketing consent independent. The existing inquiry form, client access-approval request, supplier application/approval, and guest check-in/feedback controls already capture explicit consent; retain their observable behavior and send the shared version. Remove any default accepted value from request helpers. Add an explicit privacy checkbox to the signed-in client's new-event request because the user record has no consent evidence and each new inquiry stores its own consent. Block submission until accepted. Do not change the legal notice text or infer consent from authentication.

Remove sample-account email/password prefill, sample-account buttons, and credential literals from the client, event, and supplier sign-in application code. Keep seeded demo users and access instructions in the internal portal-account runbook for local/manual testing. Do not move credentials into a public environment variable or browser-exposed config.

For event API requests, remove hardcoded caller actorName and actorEmail only from authenticated routes whose controllers resolve the actor from the verified session. Leave intentional sample/compatibility actor fields where they are part of that compatibility contract.

Keep named, fixed workflow rules, query limits, and synthetic sample fixture values as code constants where they represent deliberate behavior. Do not convert every literal into environment configuration. Change a product rule only when its owner confirms that it needs to vary.

## Alternatives considered

- Move every repeated literal to environment configuration: rejected because identifiers and fixed policy rules are not deployment-specific settings.
- Centralize the shared notice version, require explicit consent evidence, and remove client-bundled demo credentials: selected; this improves consistency and truthfulness without changing notice wording or policy meaning.
- Keep consent defaults and sample sign-in affordances unchanged: rejected because values presented as accepted or as authentication convenience should reflect user action and be scoped to controlled documentation.

## Acceptance

- The current privacy notice version has one definition in @prism/types and callers use it.
- A new signed-in client event inquiry is not submitted unless the client explicitly accepts the notice; API persistence records the submitted evidence.
- Existing consent-gated flows preserve the checked/unchecked and server-rejection behavior, with marketing consent separate.
- No normal sign-in UI prefills credentials or presents sample account actions; seeded accounts remain available through documented local/manual testing.
- Event authenticated writes use verified session identity and do not carry placeholder actor names or email.
- Product thresholds remain named, fixed rules unless a separately approved owner decision changes them.
- Behavior tests, relevant portal/API typechecks, and boundary checks pass; Changelog records the behavior changes.


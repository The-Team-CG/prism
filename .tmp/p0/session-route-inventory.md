# W07 session/route inventory (2026-09-08)

## Verified route posture

| Surface | Registered controller(s) | Guard / actor source | Intentional access |
| --- | --- | --- | --- |
| Auth | `identity-access/api/auth/auth.controller.ts` | Login/TOTP endpoints are public by design | Authentication and approval bootstrap |
| Public onboarding | `event-lifecycle/api/onboarding/inquiries.controller.ts` create; supplier application create | Public create paths; signed-in list/status/conforme paths vary | Public inquiry and supplier intake are preserved |
| Guest | `operations/api/guest/guest.controller.ts` | Access-code scoped, no session | Guest check-in/feedback only |
| Sample compatibility | `compatibility/sample/controllers/sample.controller.ts` | `SampleResetGuard` on reset; verified actor decorator | Demo/reset compatibility leaf only |
| Event portals | `read-models/api/*`, commercial, operations, floorplan, live-ops | Most sensitive methods use `EventSessionGuard` + `@VerifiedEventActor`; several legacy controllers still accept actor query/body DTOs | Must derive identity from verified session |
| Trust/closure/compliance | platform-ops trust and event-lifecycle closure/compliance controllers | Mixed: archive search guarded; several methods still resolve query/body actor values | PMCM-only commands require verified actor hardening |

## High-risk inventory findings

- `commercial/api/suppliers/supplier-pare.controller.ts` exposes manual trigger, pending, approve, and reject methods without `EventSessionGuard`; `approvedBy`/`rejectedBy` are query parameters.
- `event-lifecycle/api/closure/event-closure.controller.ts` guards archive search only; close/archive/insights methods accept query/body actor DTOs or no verified actor.
- `event-lifecycle/api/compliance/*`, commercial billing/withdrawal, platform trust/privacy/audit, and floorplan authoring controllers contain legacy actor query/body patterns. Each needs per-route role and event-scope review before changing signatures.
- EventSessionGuard validates the signed token and expiry; controllers using `@VerifiedEventActor` are the safe seam. Generic body/query rewriting would break public inquiry, supplier intake, and code-scoped guest routes.

## W07 design boundary

Harden registered sensitive routes by adding `EventSessionGuard`, deriving actors only from `@VerifiedEventActor`, and passing explicit event/resource scope to access policy services. Migrate touched shared writes to `@prism/types` Zod schemas. Preserve public inquiry/supplier application creation, auth/TOTP, sample reset guard, and guest access-code flows. Do not change service signatures owned by W01/W04/root without coordination.

# P.R.I.S.M Actual System

Date: 2026-06-20
Status: Repo-grounded map of what the system actually contains today

This document describes the actual system in the repository as of June 20, 2026. It does not describe every target feature from the catalog. For dated status and gaps, use `17-current-state-2026-06-20.md`. For the target architecture, use `18-future-state.md`.

## Actual Monorepo Shape

| Path | Actual role |
| --- | --- |
| `apps/api` | Shared NestJS API on port `4000`, with Prisma persistence and the event-ops module. |
| `apps/client` | Client-facing public and signed-in portal on port `3001`. |
| `apps/event` | PMCM admin and coordinator event command app on port `3004`. |
| `apps/supplier` | Supplier portal on port `3002`. |
| `apps/guest` | Guest portal on port `3003`. |
| `packages/api-client` | Shared client-side API helpers. |
| `packages/types` | Shared Prism role, session, lifecycle, action, and DTO types. |
| `packages/ui` | Shared UI primitives and shell blocks. |
| `packages/tokens` | Shared tokens and theme primitives. |

## Actual App Surfaces

| App | Current route folders | Actual coverage |
| --- | --- | --- |
| `apps/client` | `dashboard`, `inquiry`, `sign-in`, `sign-up`, `components` | Public inquiry, sign-in/sign-up surfaces, conforme-gated client dashboard, client action center, event filtering, client-visible billing/docs/floorplan/activity sections, and access approval request flow. |
| `apps/event` | `dashboard`, `sign-in`, `components`, `lib` | PMCM sign-in, public event-command landing, PMCM dashboard, command inbox, selected event workspace, supplier directory/quotes, billing, coordinator desk, live ops, floorplan editor access, approvals, privacy/audit summary, and route/session helpers. |
| `apps/supplier` | `dashboard`, `sign-in`, `components` | Supplier sign-in, assigned quote requests, quote submit/revise, awarded assignment confirmation, readiness, contract metadata, event-day status, privacy-consented supplier approval requests, and supplier readiness board. |
| `apps/guest` | `open`, `dashboard`, `sign-in`, `components` | Access-code entry, lightweight guest event pass, attendance count, consented name-based check-in, walk-in flagging, and moderated feedback writes. |
| `apps/api` | `libs/modules/event-ops`, `prisma` | Shared event operations API, Prisma schema, workflow services, controllers, DTOs, sample auth/RBAC, seed/demo compatibility, audit, notifications, privacy, AI governance, and tests. |

## Actual API Controllers

| Controller | Actual purpose |
| --- | --- |
| `auth.controller.ts` | Sample auth and auth/security operations. |
| `sample.controller.ts` | Compatibility state, seed/demo/reset style endpoints. |
| `inquiries.controller.ts` | Public inquiry and inquiry workflow endpoints. |
| `events.controller.ts` | Event reads, selected event operations, file requirements, floorplan and lifecycle-facing endpoints. |
| `pmcm-dashboard.controller.ts` | PMCM command inbox and PMCM dashboard read models. |
| `client-workspace.controller.ts` | Client-scoped workspace/action-center reads and client-safe actions. |
| `supplier-workspace.controller.ts` | Supplier-scoped dashboard, quote, readiness, assignment, and status operations. |
| `coordinator-workspace.controller.ts` | Coordinator-safe live/event-day role views. |
| `guest.controller.ts` | Access-code guest pass, guest check-in, walk-in, and feedback operations. |
| `suppliers.controller.ts` | PMCM supplier directory and supplier management operations. |
| `quote-requests.controller.ts` | Supplier quote request and response lifecycle. |
| `billing.controller.ts` | Billing source, statement, milestone, and payment-facing operations. |
| `notifications.controller.ts` | Notification queue/outbox state. |
| `audit-privacy.controller.ts` | Audit, privacy request, retention, redaction, and privacy operations. |
| `ai.controller.ts` | AI governance, sanitizer, audit, approval, and PARE foundation endpoints. |

## Actual Backend Service Areas

| Service area | Actual services |
| --- | --- |
| Inquiry and onboarding | `inquiries.service.ts`, `inquiry-workflow.service.ts`, `client-onboarding-workflow.service.ts` |
| Event read models and lifecycle | `event-read-models.service.ts`, `event-lifecycle.service.ts`, `workflow-command.service.ts`, `event-access-policy.service.ts` |
| PMCM operations | `event-ops.service.ts`, `commercial-workflow.service.ts`, `compliance-workflow.service.ts`, `event-closure.service.ts` |
| Floorplans and documents | `floor-plan-workflow.service.ts`, `document-vault.service.ts`, `file-requirements-matrix.service.ts` |
| Supplier network | `suppliers.service.ts`, `supplier-network-workflow.service.ts` |
| Coordinator and live ops | `coordinators.service.ts`, `live-operations.service.ts` |
| Billing | `billing-operations.service.ts` |
| Guest operations | `guest-workflow.service.ts` |
| Trust and platform | `audit.service.ts`, `notification-outbox.service.ts`, `privacy-operations.service.ts`, `auth-operations.service.ts`, `auth-security.service.ts`, `sample-state.service.ts` |
| AI governance and PARE | `ai-governance.service.ts`, `pare/pare.service.ts`, `pare/data-sanitizer.service.ts`, and PARE agent files |

## Actual Persistence Coverage

The Prisma schema contains models for:

- Floorplans, objects, venue templates, and published snapshots.
- Users, approval requests, inquiries, events, privacy requests, floorplan drafts, documents, and briefings.
- Supplier categories, supplier records, quotes, reviews, reliability notes, and certifications.
- Coordinators, assignments, event-day tasks, urgent issues, event-day logs, and coordinator reliability notes.
- Compliance rules/checks, billing sources/statements/milestones/payments, post-event documents, and event insights.
- Audit logs, notification logs, guest check-ins, guest feedback, AI audit logs, AI approval records, login history, and security alerts.

## Actual Working Feature Families

| Area | Actual state |
| --- | --- |
| Public inquiry | Public inquiry exists with privacy-consented submission and PMCM review support. Duplicate/referral/log-on-behalf metadata exists in partial form. |
| Conforme and onboarding | Client portal access and event creation are gated by accepted inquiry plus signed conforme. Invitation and reminder depth is still simple. |
| PMCM command | PMCM command inbox and selected-event workspace read models exist. The dashboard still has broad route-owned behavior and needs more decomposition. |
| Client portal | Client action center exists and feeds dashboard cards, with fallback derivation still present for uncovered action types. |
| Supplier portal | Supplier readiness board, quote submission/revision, assignment confirmation, readiness, contract metadata, and event-day status exist. |
| Guest portal | Access-code lookup, guest pass, attendance count, check-in, walk-in flagging, and moderated feedback exist. |
| Floorplan | PMCM official ownership and client read-only official snapshot boundary exist. Editor internals remain app-local and need packaging or sync strategy. |
| Files | File Requirements Matrix metadata and role-filtered endpoint coverage exist. Real file storage remains gated. |
| Billing | Approved billing source and milestone/statement pieces exist. Disputes, waivers, corrections, and post-event billing depth remain incomplete. |
| Compliance | Rule-backed compliance checks and override reason audit exist. Full risk/change register remains partial. |
| Closure | Close gates, archive guard, deterministic insights, and lifecycle transition guard exist. Archive search/comparison and testimonial workflows remain incomplete. |
| Notifications | Queue/retry/acknowledgement mechanics exist. Production adapters remain gated. |
| Security/privacy/audit | Sample auth/RBAC, consent persistence, privacy request operations, soft redaction, audit integrity, login/security records, and privacy inventory exist. External auth remains gated. |
| AI | Data sanitizer, AI audit/approval records, and PARE foundation exist. Live AI calls and autonomous actions are not shipped. |

## Actual Compatibility And Gated Areas

| Area | Actual state |
| --- | --- |
| `/api/sample/state` | Compatibility-only for seed/demo/reset paths. New normal features should use scoped contracts. |
| Local sample state | Still exists where compatibility or fallback behavior is needed. It should not become the normal architecture path. |
| Database runtime | Prisma-backed API uses Postgres. Free-tier Supabase session-pooler operation is documented as a runtime workaround when direct IPv4 is unavailable. Do not expose database secrets in docs. |
| File storage | Metadata exists; real object storage, signed URLs, upload progress, retry behavior, and download/delete audit are not actual production features yet. |
| Notifications | Queue exists; SendGrid/Viber or other production delivery adapters are not active production integrations yet. |
| Auth | API-backed sample auth/RBAC exists. External auth provider integration is not complete. |
| QR/camera | Guest code path exists. QR/camera scanning is not complete. |
| Live AI | Governance records exist. Live provider calls, ZDR-approved provider configuration, and autonomous AI action are not complete. |

## Actual Owner System Boundaries

| Owner | Actual system goal | Current repo evidence |
| --- | --- | --- |
| Maxine | Product/UX coherence | Shared `packages/ui`, `packages/tokens`, redesign inventory, readiness foundation, and visual rules. |
| Francis | PMCM/coordinator operability | `apps/event`, PMCM command inbox, selected event workspace, coordinator/live-ops services. |
| Ethan | External portal safety and usefulness | `apps/client`, `apps/supplier`, `apps/guest`, role-scoped portal read models. |
| Anthony | Platform trust and contracts | `apps/api`, Prisma schema, `packages/types`, `packages/api-client`, audit/privacy/AI governance/file matrix/session conventions. |

## Actual Stop List

These are not actual delivered system capabilities as of June 20, 2026:

1. Production external auth.
2. Production file storage with signed URLs.
3. Production notification delivery adapters.
4. QR/camera check-in.
5. Live AI provider calls.
6. Autonomous AI actions.
7. Full PMCM risk/change register.
8. Full coordinator staffing heatmap.
9. Full workflow template builder.
10. Full archive search/comparison and testimonial library.
11. Complete supplier application status center.
12. Complete event health formula and decision log surface.

## Actual Verification Surface

| Evidence type | Current source |
| --- | --- |
| Boundary rules | `scripts/check-prism-boundaries.mjs`, `scripts/check-prism-boundaries.test.mjs`, root `npm run check:boundaries` |
| API event-ops behavior | `apps/api/libs/modules/event-ops/src/**/*.test.ts`, `npm --workspace prism-api run test:event-ops` |
| Prisma model validity | `apps/api/prisma/schema.prisma`, `npm --workspace prism-api run prisma:validate` |
| Role app builds | Workspace build commands for `@prism/client`, `@prism/event`, `@prism/supplier`, and `@prism/guest` |
| UI smoke | `scripts/smoke-prism-ui.mjs` |
| Docs and traceability | `docs/prism-v4/11-feature-ledger.md`, `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`, `docs/superpowers/plans/2026-06-20-prism-system-completion-review.md` |

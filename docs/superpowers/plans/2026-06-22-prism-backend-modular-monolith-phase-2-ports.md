# Prism Backend Modular Monolith Phase 2 Ports Child Plan

> Parent plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`

**Phase:** Phase 2 - Transaction Context And Infrastructure Ports

**Goal:** Introduce the first runtime-safe cross-cutting ports and command context before moving services into separate modules. This phase keeps files in `event-ops`, but forces representative workflow commands to depend on ports instead of concrete audit/outbox services.

**Owner D system goal:** Anthony makes platform behavior trustworthy by making mutation side effects explicit: command context, correlation id, transaction mode, audit writer, notification outbox writer, access policy token, and workflow command token.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Platform trust through explicit mutation context and side-effect ports. |
| Feature-ledger row | FL-008 coordinator/staffing operations, FL-014 notifications, FL-015 audit/privacy/security, plus backend support for route-safe PMCM operations. |
| Route/app/actor | Existing PMCM/event app coordinator assignment and acknowledgement API paths through `apps/api` event-ops routes. |
| Contract touched | No shared app contract changes expected. Backend-only provider contracts are added. |
| Fallback state | `/api/sample/state` remains compatibility-only. No fallback removal in this phase. |
| Forbidden-role test | Existing event-ops role/policy tests must keep passing; no route authorization semantics change. |
| Query budget | Not applicable for the representative command slice. |
| Side-effect mode | `same_tx` for coordinator assignment and acknowledgement audit/outbox side effects. Notification idempotency is added at outbox service level. |
| Route-smoke evidence | `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, and `npm run check:boundaries`. |
| Docs updated | Parent Phase 2 checklist and this child plan updated after verification. |

## Scope

This child plan implements a narrow but real Phase 2 slice:

- Add command context and transaction context primitives.
- Add stable token files for trust, notification, access-control, and event-core concerns.
- Add audit writer and notification outbox writer ports and adapters.
- Register those ports in `EventOpsModule`.
- Update `CoordinatorsService` as the representative command owner to use ports and `same_tx` command execution.
- Add tests proving transaction-scoped side effects and outbox idempotency.

Out of scope:

- Moving files into `trust-ops`, `notification-ops`, `access-control`, or `event-core` modules. That is Phase 3.
- Rewriting every workflow service to use ports. That happens capability by capability after the pattern is verified.
- Adding a domain-event bus.
- Changing public route paths or shared API client contracts.

## Files To Edit

| File | Planned change |
| --- | --- |
| `apps/api/libs/core/shared-kernel/src/transaction/prism-command-context.ts` | Add command and transaction context types. |
| `apps/api/libs/core/shared-kernel/src/transaction/prism-transaction-runner.ts` | Add small Prisma transaction runner. |
| `apps/api/libs/core/shared-kernel/src/index.ts` | Export shared-kernel primitives. |
| `apps/api/libs/modules/event-ops/src/ports/*.ts` | Add token, port, and adapter files for audit/outbox/access/workflow concerns. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Register token providers and adapters. |
| `apps/api/libs/modules/event-ops/src/services/workflow-command.service.ts` | Accept command context, transaction runner, side-effect mode, and transaction-scoped write/side-effect callbacks. |
| `apps/api/libs/modules/event-ops/src/services/audit.service.ts` | Allow audit writes to use a transaction-scoped Prisma client. |
| `apps/api/libs/modules/event-ops/src/services/notification-outbox.service.ts` | Allow transaction-scoped queue writes and idempotency keys. |
| `apps/api/libs/modules/event-ops/src/services/coordinators.service.ts` | Use audit/outbox/workflow ports and command context. |
| `apps/api/libs/modules/event-ops/src/services/coordinators.service.test.ts` | Prove assignment side effects participate in the same transaction context. |
| `apps/api/libs/modules/event-ops/src/services/notification-outbox.service.test.ts` | Prove idempotency key prevents duplicate notification rows. |

## Steps

- [ ] Add shared-kernel command/transaction context primitives.
- [ ] Add stable `Symbol.for(...)` provider tokens in one public file per concern.
- [ ] Add `AuditWriter` and `NotificationOutboxWriter` ports.
- [ ] Add adapters that wrap existing `AuditService.audit` and `NotificationOutboxService.queue` methods.
- [ ] Register `AUDIT_WRITER`, `NOTIFICATION_OUTBOX_WRITER`, `EVENT_ACCESS_POLICY`, and `WORKFLOW_COMMAND_LOG` providers in `EventOpsModule`.
- [ ] Update `WorkflowCommandService` to support `same_tx`, `after_commit`, `durable_outbox`, and `read_only` labels without introducing a domain-event bus.
- [ ] Update coordinator assignment and acknowledgement to use command context and side-effect ports.
- [ ] Add transaction-context and notification-idempotency tests.
- [ ] Run verification commands.
- [ ] Update parent and child plan checkboxes after verification passes.

## Verification

- [ ] `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/coordinators.service.test.ts libs/modules/event-ops/src/services/notification-outbox.service.test.ts libs/modules/event-ops/src/services/workflow-command.service.test.ts`
- [ ] `npm --workspace prism-api run test:event-ops`
- [ ] `npm --workspace prism-api run build`
- [ ] `npm run check:boundaries`
- [ ] `git diff --check`

## Acceptance Criteria

- [ ] Representative coordinator commands no longer call audit/outbox concrete services directly.
- [ ] Coordinator assignment and acknowledgement name `same_tx` in code/tests.
- [ ] Audit and outbox writers can use a transaction-scoped Prisma client.
- [ ] Notification outbox idempotency key prevents duplicate queued work.
- [ ] Provider tokens are exported from exactly one file per concern under `event-ops/src/ports` until Phase 3 moves them.
- [ ] No domain-event bus is introduced.
- [ ] Event-ops tests, API build, boundary check, and diff check pass.

## Stop Rules

Stop and revise if:

1. Transaction context requires changing public route behavior.
2. Prisma transaction typing forces broad database service changes.
3. More than the representative coordinator command slice must be rewritten to make tests pass.
4. Provider tokens require creating real infrastructure modules before Phase 3.
5. A domain-event bus becomes necessary.
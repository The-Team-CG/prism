# Prism Backend Modular Monolith Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` before implementing this plan. This is a master plan. Do not execute broad extraction work directly from this file without first creating a child implementation plan for the specific phase.

**Goal:** Rework the Prism backend from a centralized `event-ops` service hub into a long-term modular monolith where business capabilities own commands, policies, persistence access, audit/outbox side effects, read models, tests, and public module contracts.

**Architecture:** Keep one NestJS API and one Prisma client. Move from manual service construction inside `EventOpsService` to explicit Nest modules, dependency-injected use cases, narrow cross-module ports, transaction-scoped side effects, and read-model composition. Capability modules own writes. `event-read-models` composes cross-domain reads. `event-ops` remains only as a compatibility facade until routes move safely.

**Tech Stack:** NestJS modules/providers/controllers, Prisma multi-schema Postgres, Vitest, TypeScript path aliases, existing `@prism/database`, `@prism/shared`, `@prism/modules/event-ops`, `packages/types`, `packages/api-client`, and existing Prism boundary/database audit scripts.

---

## Plan Type

This is a long-term backend architecture implementation plan. It is intentionally detailed because the target shape affects schema separation, feature ownership, testing, app contracts, and Anthony's Owner D redesign work. It is not a one-branch delivery script.

Before implementing Phase 1 or any later extraction phase, create a smaller child implementation plan with exact file edits, failing tests, verification commands, branch name, and commit checkpoints. Each child plan must state which Owner D system goal it advances and which feature-ledger rows it protects.

## Owner D Scope

Anthony's Owner D goal is the backend and integration foundation that makes the whole-app redesign possible without role leakage or brittle fallback behavior. This plan advances Owner D by making backend capability ownership explicit, giving each app stable contracts, and reducing the current `event-ops` hub risk.

Owner D responsibilities covered by this plan:

- API module boundaries for PMCM event operations, client portal workflows, supplier workflows, guest workflows, finance, files, floorplans, staffing, trust/privacy, notifications, and read models.
- Backend contracts that preserve the app boundary rule: client portal, supplier portal, guest portal, event command app, and shared API remain separate surfaces.
- Role-scoped read models so PMCM-only, client-only, supplier-only, and guest-only payloads cannot blur during redesign.
- Workflow mutation rules for audit, notification queueing, access checks, transaction boundaries, idempotency, and outbox delivery.
- Migration guardrails that allow UI/app teams to keep shipping while backend internals are extracted.

Owner D is not responsible for redesigning the UI, building external auth, sending real production notifications, implementing live AI, adding QR/camera production flows, or converting Prism into microservices under this plan.

## July Execution Boundary

The agile calendar currently runs through July 31, 2026. This architecture plan is broader than that calendar. To keep the calendar realistic, the default July scope is Phase 0 through Phase 2 only:

1. Document the backend target architecture and add guardrails.
2. Convert current `event-ops` service composition to Nest dependency injection without moving business behavior.
3. Introduce transaction context and infrastructure ports for audit, notifications, access policy, and workflow command history.

Phase 3 and later are post-July by default unless a child plan proves the extraction is small, behavior-preserving, and directly required by a feature-ledger row or unfinished feature family. A child plan that pulls Phase 3+ work into July must include:

- Feature-ledger row or unfinished feature family affected.
- App route and actor affected.
- Contract package touched, if any.
- Fallback kept, removed, or explicitly deferred until after July.
- Owner D evidence gate entries.
- Route-smoke or screenshot evidence target.
- Docs updated in the same branch.

No app redesign branch should block on Phase 3+ extraction. If a UI/app team needs a stable contract before the backend extraction is complete, add a typed facade or compatibility route first, then extract internals later.

## Current Finding

The backend already contains many focused service files under `apps/api/libs/modules/event-ops/src/services`, but those files are not real module boundaries yet. `apps/api/libs/modules/event-ops/src/event-ops.module.ts` registers only `EventOpsService` as a provider:

```ts
@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: [EventOpsService],
})
export class EventOpsModule {}
```

`EventOpsService` manually constructs the real services in its constructor:

```ts
this.auditService = new AuditService(prisma);
this.eventAccessPolicyService = new EventAccessPolicyService(this.auditService);
this.notificationOutboxService = new NotificationOutboxService(prisma);
this.inquiriesService = new InquiriesService(
  prisma,
  this.auditService,
  this.notificationOutboxService,
  this.workflowCommandService,
);
```

Several services also default-create dependencies such as `new AuditService(prisma)` and `new NotificationOutboxService(prisma)`. This means folder separation is currently cosmetic: the real composition root is one large service class, dependency ownership is implicit, and tests can accidentally use different audit/outbox instances from production.

The largest current service files show the actual domain pressure:

| Service file | Current pressure |
| --- | --- |
| `event-read-models.service.ts` | Large cross-role read payload composition. |
| `live-operations.service.ts` | Event-day and operational workflow commands. |
| `billing-operations.service.ts` | Finance/payment workflow ownership mixed into event ops. |
| `supplier-network-workflow.service.ts` | Supplier lifecycle commands and status transitions. |
| `inquiries.service.ts` | Public inquiry, onboarding, and notification behavior. |
| `commercial-workflow.service.ts` | Proposal/briefing/commercial workflow behavior. |
| `audit.service.ts` | Cross-cutting trust and evidence behavior. |
| `floor-plan-workflow.service.ts` | Floorplan workflow commands and state transitions. |

The goal is not to rename folders. The goal is to make runtime dependency ownership, transaction behavior, module exports, and tests match Prism's real product capabilities.

## Long-Term Target

The long-term shape is a modular monolith organized by Prism business capability, not generic technical layers and not one module per table. Database schemas support the boundaries, but workflow ownership defines the modules.

```text
apps/api/libs/core/
  shared-kernel/
  module-boundaries/

apps/api/libs/modules/
  access-control/
  identity-ops/
  trust-ops/
  notification-ops/
  event-core/
  inquiry-onboarding/
  commercial-ops/
  supplier-ops/
  staffing-ops/
  finance-ops/
  compliance-ops/
  floorplan/
  file-ops/
  guest-ops/
  closure-ops/
  ai-governance/
  event-read-models/
  event-ops/
```

`event-ops` remains during migration as the stable HTTP compatibility facade for current routes. It shrinks over time until it only wires legacy route compatibility, then disappears after controllers move to owning modules.
## Out Of Scope Unless Separately Approved

The following are external dependency projects, not backend modularization tasks:

- External auth provider migration.
- Real production email/SMS sends.
- Real object-storage adapter rollout beyond signed URL contract preparation.
- QR scanner/camera production workflow.
- Live AI provider integration.
- Deep legal-hold/retention automation beyond current privacy/audit decisions.
- Microservice split, queue infrastructure replacement, or separate deployable APIs.
- Broad UI redesign implementation.

Adapters and ports can be prepared when they make module boundaries testable, but production credentials, network delivery, and irreversible workflow behavior require separate approval and separate verification.

## Boundary Rules

| Rule | Required behavior |
| --- | --- |
| One shared API | Keep `apps/api` as one NestJS process on port `4000`. Do not split Prism into microservices. |
| Capability modules own writes | Supplier writes live in `supplier-ops`, billing writes in `finance-ops`, guest writes in `guest-ops`, staffing writes in `staffing-ops`, floorplan writes in `floorplan`, file writes in `file-ops`, commercial writes in `commercial-ops`, closure writes in `closure-ops`, and compliance writes in `compliance-ops`. |
| Read models compose | `event-read-models` may read across domains to build PMCM/client/supplier/guest payloads, but must not mutate database state. |
| Ports over internals | A module exports narrow tokens and interfaces such as `AUDIT_WRITER`, `NOTIFICATION_OUTBOX_WRITER`, and `EVENT_ACCESS_POLICY`. Consumers must not import private services directly. |
| Controllers preserve routes | Public HTTP paths stay stable while module internals move. App clients must not break during extraction. |
| No generic repositories | Do not add `BaseRepository`, table-per-repository boilerplate, or `CommonWorkflowService`. Use focused query/read services only where complexity justifies them. |
| No table-per-module design | Modules follow Prism capabilities, not every Prisma model or Postgres table. |
| No workflow logic in UI/shared packages | `packages/ui` remains presentation only. `packages/types` owns shared DTO contracts, not backend business rules. |
| No speculative primitives | Do not add `PrismDomainEvent`, event bus, generic repository, or base use-case classes before a real command uses them. |
| Audit/outbox consistency | Commands that mutate workflow state must define whether audit/outbox writes happen in the same DB transaction, after commit, or through a durable outbox. |
| Stable compatibility | `event-ops` may delegate to new modules during migration, but new business logic must land in owning modules once the owner exists. |

## Target Module Contracts

| Module | Owns | Exports | Must not own |
| --- | --- | --- | --- |
| `core/shared-kernel` | Common result, pagination, transaction, date/id, and error primitives with no Prism workflow rules. | `PrismTransactionRunner`, transaction context types, shared typed result helpers. | Supplier, billing, guest, lifecycle, privacy, or UI decisions. |
| `core/module-boundaries` | Import-boundary metadata and checks. | Boundary rules consumed by `scripts/check-prism-boundaries.mjs`. | Runtime business behavior. |
| `access-control` | Actor resolution, event-scope checks, role/mutation policies. | `EVENT_ACCESS_POLICY`, `PORTAL_SCOPE_POLICY`, `MUTATION_POLICY`. | Audit persistence, workflow mutations, dashboards. |
| `identity-ops` | Local sample auth compatibility, account approval state, session actor mapping, and future external-auth adapter boundary. | `IDENTITY_ACTOR_RESOLVER`, `ACCOUNT_APPROVAL_POLICY`. | Event workflow commands, billing, notifications, external auth rollout. |
| `trust-ops` | Audit writing, privacy operations, login/security evidence, retention/legal-hold decisions once approved. | `AUDIT_WRITER`, `AUDIT_READER`, `PRIVACY_OPERATIONS`. | Notification delivery, supplier/billing workflows, UI state. |
| `notification-ops` | Notification outbox rows, send intent records, retry metadata, template key validation. | `NOTIFICATION_OUTBOX_WRITER`, `NOTIFICATION_OUTBOX_READER`. | Production send adapters unless a later approved plan enables them. |
| `event-core` | Event identity, event lifecycle invariants, workflow command history, core event status transitions. | `EVENT_LIFECYCLE_COMMANDS`, `WORKFLOW_COMMAND_LOG`, `EVENT_SUMMARY_READER`. | Billing, supplier, guest, floorplan, closure analytics, large dashboards. |
| `inquiry-onboarding` | Public inquiry creation, accepted inquiry to conforme gate, client onboarding workflow. | `INQUIRY_COMMANDS`, `CLIENT_ONBOARDING_COMMANDS`. | PMCM event-day operations, billing, floorplan authoring. |
| `commercial-ops` | Briefing, proposal, package pricing decisions, conforme-ready commercial flow. | `COMMERCIAL_WORKFLOW_COMMANDS`, `PROPOSAL_READER`. | Payment settlement, supplier staffing, guest workflows. |
| `supplier-ops` | Supplier network workflow, supplier assignments, supplier portal actions, supplier readiness. | `SUPPLIER_COMMANDS`, `SUPPLIER_ASSIGNMENT_READER`, `SUPPLIER_READINESS_READER`. | Billing math, guest check-in, event closure. |
| `staffing-ops` | Internal coordinator staffing, task assignment, event-day staffing views. | `STAFFING_COMMANDS`, `STAFFING_READER`. | Supplier portal actions, finance, closure. |
| `finance-ops` | Billing, payments, invoices, adjustments, finance approval workflow. | `FINANCE_COMMANDS`, `BILLING_READER`, `PAYMENT_STATUS_READER`. | Supplier assignment workflow, guest list state, floorplan drawing. |
| `compliance-ops` | Compliance workflow, required approvals, evidence status, policy-gated event checks. | `COMPLIANCE_COMMANDS`, `COMPLIANCE_READER`. | Audit storage internals, commercial pricing, floorplan editing. |
| `floorplan` | Official floorplan workflow, client layout preferences, PMCM approval/submission path. | `FLOORPLAN_COMMANDS`, `FLOORPLAN_READER`. | Guest list state, billing, supplier network. |
| `file-ops` | File requirements matrix, uploads metadata, document requirement workflow, signed URL preparation. | `FILE_REQUIREMENT_COMMANDS`, `FILE_REQUIREMENT_READER`, `SIGNED_UPLOAD_URL_FACTORY`. | Object storage provider rollout without approval. |
| `guest-ops` | Guest list, RSVP/check-in state, guest portal event access, guest communication intent. | `GUEST_COMMANDS`, `GUEST_READER`. | PMCM-only event operations, billing, supplier workflow. |
| `closure-ops` | Event closure workflow, archive readiness, post-event evidence and insights assembled from reader ports. | `CLOSURE_COMMANDS`, `CLOSURE_READINESS_READER`. | Core lifecycle ownership, raw supplier/finance/floorplan writes. |
| `ai-governance` | AI usage policy, prompt/template records, review state, disabled-provider guardrails. | `AI_POLICY`, `AI_REVIEW_READER`. | Live AI provider calls unless approved separately. |
| `event-read-models` | Role-scoped PMCM/client/supplier/guest payload composition using reader ports and approved query builders. | `PMCM_EVENT_READ_MODEL`, `CLIENT_EVENT_READ_MODEL`, `SUPPLIER_EVENT_READ_MODEL`, `GUEST_EVENT_READ_MODEL`. | Workflow mutations, side effects, audit/outbox writes. |
| `event-ops` | Legacy compatibility facade and transition layer for existing routes. | Existing route-compatible service methods during migration. | New business ownership after the owning module exists. |

## Dependency Direction

The allowed dependency direction is:

```text
controllers
  -> owning capability module
    -> access-control / trust-ops / notification-ops / event-core ports
    -> @prism/database

event-read-models
  -> reader ports from capability modules
  -> approved direct query builders for cross-domain payloads
  -> @prism/database read-only access

event-ops compatibility facade
  -> owning capability modules
```

Disallowed dependency examples:

- `supplier-ops` importing private services from `finance-ops`.
- `finance-ops` importing private services from `supplier-ops`.
- `event-read-models` calling `create`, `update`, `upsert`, `delete`, `executeRaw`, or mutating `$queryRaw` paths.
- New controllers calling `EventOpsService` after their owning module exists.
- UI packages importing backend service classes.
- Capability modules importing `event-ops`.

`event-core` must remain narrow. It cannot become the new hub. It owns event identity, lifecycle invariants, and command history only. Closure/readiness composition belongs in `closure-ops` after reader ports exist.

## Transaction And Side-Effect Semantics

Every command that changes workflow state must name one side-effect mode in its child plan and test it:

| Mode | Use when | Required behavior |
| --- | --- | --- |
| `same_tx` | Audit or outbox record must exist only if the workflow mutation commits. | Use `PrismTransactionRunner` and transaction-scoped Prisma client. Mutation, audit row, and outbox row commit together. |
| `after_commit` | Side effect should happen only after commit and can be retried from durable state. | Persist durable intent first, then enqueue/send after transaction success. |
| `durable_outbox` | Notification/send work is asynchronous and retryable. | Write outbox row with idempotency key, correlation id, retry count, status, and poison/error state. |
| `read_only` | Use case only reads. | No Prisma mutation methods, no audit/outbox writes, and no transaction runner unless needed for consistent snapshot reads. |

`PrismTransactionRunner` should provide a transaction-scoped context object. Do not pass the root Prisma client into nested writes after a transaction begins.

Minimum transaction context shape:

```ts
export interface PrismTransactionContext {
  prisma: Prisma.TransactionClient;
  correlationId: string;
  actorId?: string;
}
```

Minimum command metadata shape:

```ts
export interface PrismCommandContext {
  actorId: string;
  actorRole: string;
  eventId?: string;
  correlationId: string;
  idempotencyKey?: string;
}
```

Do not add a domain-event bus in Phase 1 or Phase 2. Add `PrismDomainEvent` only when a real command emits it, a real handler consumes it, and the child plan includes deletion criteria if the primitive remains unused.

## Operational Architecture

The modular backend must include operational behavior, not only source folders.

| Concern | Target rule |
| --- | --- |
| Idempotency | Mutating commands that can be retried accept or derive an idempotency key. Duplicate keys return the existing durable result or a conflict with a clear reason. |
| Correlation | Every command context carries a correlation id into audit rows, outbox rows, logs, and error responses. |
| Outbox retry | Outbox rows track status, attempt count, next attempt time, last error, and poison state. Worker behavior is documented before production send adapters are enabled. |
| Poison handling | A poison outbox row stops retrying and remains visible to PMCM/admin diagnostics. |
| Structured logs | Commands log module, use case, actor, event id, correlation id, and result category without leaking private payloads. |
| Metrics | Add counters only when an existing metrics sink exists; otherwise document metric names in the child plan. |
| Concurrency | Commands that update workflow status must state conflict behavior: optimistic version check, unique constraint, idempotency key, or transaction isolation. |
| Backfills | Any schema or module extraction that changes persisted shape must include a deterministic backfill or state-mapping step. |
| Route deprecation | Compatibility routes keep old paths until app clients are migrated and smoke-tested. Removal requires docs and contract updates. |
| Sample-state retirement | `/api/sample/state` and local sample state remain compatibility-only. New module work must use scoped APIs and typed contracts. |

## Naming Standard

Use Prism business names consistently across files, classes, providers, and schemas.

| Thing | Rule | Example |
| --- | --- | --- |
| Module folder | kebab-case capability name. | `supplier-ops`, `finance-ops`, `event-read-models` |
| Nest module class | PascalCase capability plus `Module`. | `SupplierOpsModule` |
| Service class | Capability plus exact responsibility. | `SupplierAssignmentService`, `FinancePaymentWorkflowService` |
| Use case class | Verb plus domain object plus `UseCase`. | `AssignSupplierUseCase`, `RecordPaymentUseCase` |
| Provider token | Upper snake case exported from `*.tokens.ts`. | `AUDIT_WRITER`, `EVENT_ACCESS_POLICY` |
| Port interface | Noun phrase with role. | `AuditWriter`, `SupplierReadinessReader` |
| Prisma schema | snake_case capability schema. | `supplier_ops`, `finance_ops`, `event_core` |
| Table name | snake_case noun phrase scoped to domain. | `supplier_assignment`, `payment_schedule` |
| DTO contract | Actor or route intent plus `Dto`. | `PmcmEventDashboardDto` |
| Read model method | `get` plus actor and payload. | `getPmcmEventDashboard` |

Do not use vague helper names such as `normalizePrism`, `CommonService`, `HelperService`, `DataManager`, `processEventData`, or `handleWorkflowStuff`. A normalizer name must include the domain and target, such as `normalizeSupplierAssignmentStatus` or `mapBillingRecordToFinanceSummary`.

## Planned File Structure

Target structure after the foundation and first extractions:

```text
apps/api/libs/core/shared-kernel/src/
  index.ts
  transaction/
    prism-transaction-runner.ts
    prism-command-context.ts
  errors/
    prism-domain-error.ts

apps/api/libs/core/module-boundaries/src/
  index.ts
  backend-boundary-rules.ts

apps/api/libs/modules/trust-ops/src/
  trust-ops.module.ts
  trust-ops.tokens.ts
  ports/audit-writer.port.ts
  services/audit.service.ts
  services/privacy-operations.service.ts
  adapters/audit-writer.adapter.ts

apps/api/libs/modules/notification-ops/src/
  notification-ops.module.ts
  notification-ops.tokens.ts
  ports/notification-outbox-writer.port.ts
  services/notification-outbox.service.ts
  adapters/notification-outbox-writer.adapter.ts

apps/api/libs/modules/access-control/src/
  access-control.module.ts
  access-control.tokens.ts
  ports/event-access-policy.port.ts
  services/event-access-policy.service.ts

apps/api/libs/modules/event-core/src/
  event-core.module.ts
  event-core.tokens.ts
  ports/workflow-command-log.port.ts
  services/workflow-command.service.ts
  services/event-lifecycle.service.ts

apps/api/libs/modules/supplier-ops/src/
  supplier-ops.module.ts
  supplier-ops.tokens.ts
  controllers/supplier-network.controller.ts
  ports/supplier-readiness-reader.port.ts
  services/supplier-network-workflow.service.ts
  use-cases/assign-supplier.use-case.ts
  queries/supplier-assignment.reader.ts
  tests/supplier-ops.module.test.ts

apps/api/libs/modules/event-read-models/src/
  event-read-models.module.ts
  event-read-models.tokens.ts
  services/event-read-models.service.ts
  queries/pmcm-event-dashboard.query.ts
  mappers/pmcm-event-dashboard.mapper.ts
  mappers/client-event-summary.mapper.ts
```

Do not create every folder at once. Add folders only when a phase moves real behavior or a boundary-check fixture needs the path.

## Migration Strategy

The migration is behavior-preserving first, structural second, and removal last:

1. Freeze the target architecture and boundary rules in docs.
2. Make existing services injectable inside the current `event-ops` module.
3. Introduce transaction and side-effect ports while files remain mostly in place.
4. Extract infrastructure modules.
5. Extract one vertical capability with tests and route compatibility.
6. Repeat capability extraction only after the previous module has passing tests and docs.
7. Move controllers after the owning module is stable.
8. Retire compatibility methods after app clients use owning routes/contracts.

Every extraction must include before/after tests proving route payloads and authorization behavior did not regress.

## Phase 0 - Architectural Guardrails

**Purpose:** Make the target explicit before changing runtime behavior.

**Edits:**

- [x] Keep this plan as the master source for backend modularization.
- [x] Add or update a short backend module map in `docs/prism-v4/15-system-architecture.md`.
- [x] Add a current-state note in `docs/prism-v4/17-current-state-2026-06-20.md` that `event-ops` is still the runtime hub before implementation begins.
- [x] Add a target-state note in `docs/prism-v4/18-future-state.md` that the API remains one modular monolith.
- [x] Add Anthony/Owner D traceability in `docs/prism-v4/12-redesign-inventory.md` only if the inventory has an Owner D backend row that needs this architecture pointer.
- [x] Add backend boundary rules to `scripts/check-prism-boundaries.mjs` using the current script style.
- [x] Add a boundary-check fixture or sample path for each new backend rule.

**Boundary checks to add:**

- [x] `event-read-models` cannot call Prisma mutation methods: `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`, `$executeRaw`, or `$executeRawUnsafe`.
- [x] `$queryRaw` and `$queryRawUnsafe` are allowed in read models only through approved query-builder files with a query-budget comment.
- [x] Capability modules cannot import another capability module's `src/services/*` internals.
- [x] Capability modules cannot import `event-ops`.
- [x] `event-ops` cannot add new business service files after the first owning module exists.
- [x] UI packages cannot import backend module paths.

**Tests:**

- [x] Add a failing fixture for an illegal read-model mutation, then make the boundary checker fail on it.
- [x] Add a passing fixture for an approved read query builder.
- [x] Run `npm run check:boundaries` from the repo root.
- [x] Run `git diff --check`.

**Commit checkpoint:** `docs: define backend modular monolith guardrails`

## Phase 1 - Dependency Injection Foundation Inside event-ops

**Purpose:** Remove manual construction while preserving all current routes and service behavior.

**Important feasibility rule:** Nest can only construct classes that are providers. Every moved service must either have `@Injectable()` or be registered through an explicit provider factory. Do not add constructor dependencies without registering providers in the same commit.

**Edits:**

- [x] Add `@Injectable()` to each current `event-ops` service that will be Nest-constructed.
- [x] Register the current service classes as providers in `EventOpsModule`.
- [x] Replace `new AuditService(...)`, `new NotificationOutboxService(...)`, and similar default constructor fallbacks with injected dependencies.
- [x] Convert `EventOpsService` constructor to receive current services through DI.
- [x] Remove manual service construction from `EventOpsService` after all providers compile.
- [x] Keep method names and controller calls unchanged.
- [x] Do not move files in this phase.

**Provider registration target:**

```ts
@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: [
    EventOpsService,
    AuditService,
    EventAccessPolicyService,
    NotificationOutboxService,
    WorkflowCommandService,
    InquiriesService,
    SupplierNetworkWorkflowService,
    BillingOperationsService,
  ],
})
export class EventOpsModule {}
```

The real provider list must include every service currently constructed inside `EventOpsService`.

**Tests:**

- [x] Prefer existing Vitest tests if they instantiate services directly.
- [x] Did not use Nest `TestingModule`; no `@nestjs/testing` dependency was added.
- [x] Updated existing Vitest direct-construction tests to build the explicit dependency graph and verify `EventOpsService` no longer default-creates services.
- [x] Run `npm --workspace prism-api run test -- event-ops` or the narrowest existing API test command.
- [x] Run `npm --workspace prism-api run build` if provider metadata or Nest module wiring changes.

**Acceptance criteria:**

- [x] No manual `new SomeWorkflowService(...)` composition remains inside `EventOpsService`.
- [x] Existing route methods still call the same public service methods.
- [x] No behavior changes appear in snapshots or route tests.
- [x] Audit and notification dependencies are single provider instances per module context.

**Commit checkpoint:** `refactor(api): inject event ops services through nest providers`

## Phase 2 - Transaction Context And Infrastructure Ports

**Purpose:** Introduce explicit cross-cutting contracts before moving services into new modules.

**Edits:**

- [x] Add `PrismTransactionRunner` and command context types under `core/shared-kernel` only if a real mutating command uses them in this phase.
- [x] Add stable provider tokens in single public files: `trust-ops.tokens.ts`, `notification-ops.tokens.ts`, `access-control.tokens.ts`, and `event-core.tokens.ts`.
- [x] Use string tokens or `Symbol.for(...)`; do not rely on TypeScript interfaces as runtime tokens.
- [x] Add adapter providers when existing method names do not match port names, for example `AuditWriterAdapter` wrapping `AuditService.audit`.
- [x] Add `AUDIT_WRITER` provider through `useExisting` only when the service already implements the exact port method names.
- [x] Add `NOTIFICATION_OUTBOX_WRITER` provider through an adapter if the existing service method is `queue` or another domain-specific method.
- [x] Add `EVENT_ACCESS_POLICY` provider for access checks.
- [x] Add `WORKFLOW_COMMAND_LOG` provider for command history.
- [x] Update two or three representative commands to use the injected ports and command context.

**Provider examples:**

```ts
export const AUDIT_WRITER = Symbol.for('prism.trustOps.auditWriter');

export const auditWriterProvider = {
  provide: AUDIT_WRITER,
  useExisting: AuditWriterAdapter,
};
```

```ts
@Injectable()
export class AuditWriterAdapter implements AuditWriter {
  constructor(private readonly auditService: AuditService) {}

  write(entry: AuditWriteInput) {
    return this.auditService.audit(entry);
  }
}
```

**Tests:**

- [x] Add a command test proving workflow mutation and audit write use the same transaction context for a `same_tx` command.
- [x] Add an outbox test proving an idempotency key prevents duplicate queued notifications for a retryable command.
- [x] Run `npm --workspace prism-api run test -- audit` or the closest matching API test slice.
- [x] Run `npm --workspace prism-api run build`.

**Acceptance criteria:**

- [x] Representative commands no longer call audit/outbox concrete services directly.
- [x] Side-effect mode is named in test descriptions or command comments.
- [x] Provider tokens are exported from exactly one public module path each.
- [x] No new generic event bus exists unless a command actually emits and consumes a domain event.

**Commit checkpoint:** `refactor(api): add transaction and side-effect ports`

## Phase 3 - Create Real Infrastructure Modules

**Purpose:** Move cross-cutting services into first-class modules while preserving current behavior.

**Edits:**

- [x] Create `trust-ops`, `notification-ops`, `access-control`, and narrow `event-core` libs.
- [x] Move `AuditService` and `PrivacyOperationsService` into `trust-ops`.
- [x] Move `NotificationOutboxService` into `notification-ops`.
- [x] Move `EventAccessPolicyService` into `access-control`.
- [x] Move `WorkflowCommandService` into `event-core`.
- [x] Do not move `EventClosureService` into `event-core`; keep closure behavior in `event-ops` until `closure-ops` can depend on reader ports.
- [x] Update import paths in `event-ops` to consume public module exports.
- [x] Add path aliases to `apps/api/tsconfig.json`.
- [x] Update `apps/api/vitest.config.ts` aliases if it has separate alias config.
- [x] Update `apps/api/nest-cli.json` if Nest library metadata is used for builds.
- [x] Add `tsconfig.lib.json` for each new lib if the existing API library pattern requires it.
- [x] Update barrel exports and avoid exporting private service internals.

**Tests:**

- [x] Run `npm --workspace prism-api run build`.
- [x] Run `npm --workspace prism-api run test -- event-ops`.
- [x] Run `npm run check:boundaries`.
- [x] Run `git diff --check`.

**Acceptance criteria:**

- [x] New modules compile through the workspace build.
- [x] `event-ops` imports cross-cutting behavior through public module exports or provider tokens.
- [x] No capability behavior moves in this phase except command history.
- [x] `event-core` remains narrow and does not absorb closure, billing, supplier, floorplan, or dashboards.

**Commit checkpoint:** `refactor(api): extract cross cutting backend modules`

## Phase 4 - Extract One Supplier Vertical Slice

**Purpose:** Prove the extraction pattern on one high-value capability before repeating it.

**Edits:**

- [x] Create `supplier-ops` module.
- [x] Move `SupplierNetworkWorkflowService` into `supplier-ops`.
- [x] Create `SupplierOpsModule` and public tokens.
- [x] Add `SupplierCommands` and `SupplierReadinessReader` ports.
- [x] Keep existing supplier route paths stable by delegating from current controllers or `EventOpsService`.
- [x] Move supplier-specific tests beside the new module.
- [x] Update imports in `event-ops` to call `supplier-ops` public API.
- [x] Add role-scope tests for PMCM and supplier portal reads.
- [x] Add one route-smoke evidence command for PMCM supplier assignment and supplier portal readiness.

**Tests:**

- [x] Supplier assignment mutation test.
- [x] Supplier status transition test.
- [x] Forbidden-role test: client or guest cannot mutate supplier assignments.
- [x] Read-model test: supplier payload excludes PMCM-only finance/private fields.
- [x] `npm --workspace prism-api run test -- supplier`.
- [x] `npm run check:boundaries`.

**Acceptance criteria:**

- [x] Supplier workflow writes live in `supplier-ops`.
- [x] Existing API routes remain compatible.
- [x] Audit/outbox semantics are explicit for supplier mutations.
- [x] The pattern is documented before extracting another capability.

**Commit checkpoint:** `refactor(api): extract supplier operations module`

## Phase 5 - Extract finance-ops

**Purpose:** Separate billing/payment workflows from general event operations.

**Edits:**

- [x] Create `finance-ops` module.
- [x] Move `BillingOperationsService` into `finance-ops`.
- [x] Add `FinanceCommands`, `BillingReader`, and `PaymentStatusReader` ports.
- [x] Add transaction tests for payment/billing state changes.
- [x] Add idempotency behavior for retryable payment record commands if not already present.
- [x] Decide supplier readiness board may use approved `event-read-models` query builders; keep `SupplierReadinessReader` for later event/closure readiness hardening.
- [x] Update read models to use finance reader ports or approved finance query builders.

**Tests:**

- [x] Billing command mutation test.
- [x] Payment status read test.
- [x] Forbidden-role test: supplier or guest cannot read PMCM finance payload.
- [x] Boundary test: `finance-ops` does not import supplier private services.
- [x] `npm --workspace prism-api run test -- billing`.
- [x] `npm run check:boundaries`.

**Acceptance criteria:**

- [x] Finance writes live in `finance-ops`.
- [x] Supplier and guest payloads do not expose PMCM finance details.
- [x] Billing audit rows include correlation id and actor.

**Commit checkpoint:** `refactor(api): extract finance operations module`

## Phase 6 - Extract file-ops

**Purpose:** Separate file requirements and upload metadata from event hub logic.

**Edits:**

- [x] Create `file-ops` module.
- [x] Move `FileRequirementsMatrixService` into `file-ops`.
- [x] Add `FileRequirementCommands`, `FileRequirementReader`, and `SignedUploadUrlFactory` ports.
- [x] Keep storage provider implementation local/mock unless a separate approved storage plan exists.
- [x] Add schema and route evidence for PMCM and client file requirements.
- [ ] Update read models to consume file reader ports. Deferred by design until workspace contracts require embedded file matrix payloads; current ownership is the `file-ops` route/reader.

**Tests:**

- [x] File requirement matrix command test.
- [x] Client-visible file requirement read test.
- [x] Forbidden-role test for supplier/guest access to client-only files.
- [x] Signed upload URL contract test with fake adapter.
- [x] `npm --workspace prism-api run test -- file`.

**Acceptance criteria:**

- [ ] File requirement writes live in `file-ops`. Deferred by design for real storage/upload writes; current approved scope is metadata/read contracts.
- [x] Object storage is not enabled by accident.
- [x] File read payloads are role-scoped.

**Commit checkpoint:** `refactor(api): extract file operations module`

## Phase 7 - Extract inquiry-onboarding, commercial-ops, and compliance-ops

**Purpose:** Separate pre-event lifecycle capabilities into owner modules.

**Child plan rule:** Create separate child plans for each module in this phase. Do not bundle all three into one implementation branch unless each extraction is already mechanically small.

### Phase 7A - inquiry-onboarding

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-7a-inquiry-onboarding.md`.

- [x] Create `inquiry-onboarding` module.
- [x] Move inquiry creation and accepted inquiry to conforme gating behavior.
- [x] Move client onboarding workflow behavior from current services.
- [x] Keep public inquiry route paths stable.
- [x] Test public inquiry creation, accepted inquiry gate, and client portal onboarding access.
- [x] Add forbidden-role test for unauthenticated access beyond public inquiry creation.

### Phase 7B - commercial-ops

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-7b-commercial-ops.md`.

- [x] Create `commercial-ops` module.
- [x] Move `CommercialWorkflowService`.
- [x] Add token-scoped proposal/quote reader port.
- [ ] Add briefing reader port when briefing ownership moves out of `inquiry-onboarding`/`event-ops`. Deferred by design until briefing read ownership moves.
- [x] Test supplier quote/proposal decision status changes.
- [ ] Test full proposal document workflow and conforme readiness when proposal generation exists. Deferred by design until proposal document generation is approved/implemented.
- [x] Add forbidden-role test for supplier/guest access to PMCM commercial proposal decisions.

### Phase 7C - compliance-ops

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-7c-compliance-ops.md`.

- [x] Create `compliance-ops` module.
- [x] Move `ComplianceWorkflowService`.
- [x] Add compliance command and reader ports.
- [x] Test compliance approval/check behavior.
- [x] Ensure audit storage remains in `trust-ops`, not `compliance-ops`.

**Commit checkpoints:**

- [x] `refactor(api): extract inquiry onboarding module`
- [x] `refactor(api): extract commercial operations module`
- [x] `refactor(api): extract compliance operations module`

## Phase 8 - Extract floorplan

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-8-floorplan.md`.

**Purpose:** Align backend ownership with the floorplan rule in `AGENTS.md`.

**Edits:**

- [x] Create `floorplan` module.
- [x] Move `FloorPlanWorkflowService`.
- [x] Separate client layout preference commands from PMCM official floorplan commands.
- [x] Add reader ports for client read-only official layouts and PMCM editable layouts.
- [x] Preserve existing canvas/editor internals.
- [x] Keep PMCM edit/approve workflow in `apps/event` via API contracts.

**Tests:**

- [x] PMCM can edit official floorplan.
- [x] Client can submit layout preference for a confirmed event.
- [x] Client sees submitted/approved official layout read-only.
- [x] Forbidden-role test: client cannot mutate PMCM official floorplan directly.
- [x] `npm --workspace prism-api run test -- floor`.

**Acceptance criteria:**

- [x] Floorplan writes live in `floorplan`.
- [x] The floorplan rule is enforced by backend tests.
- [x] Existing canvas/editor behavior remains intact.

**Commit checkpoint:** [x] `refactor(api): extract floorplan module`

## Phase 9 - Extract guest-ops

**Purpose:** Separate guest portal and guest workflow behavior from PMCM operations.

**Edits:**

- [x] Create `guest-ops` module.
- [x] Move `GuestWorkflowService`.
- [x] Add guest command and reader ports.
- [x] Keep guest portal route contracts stable.
- [x] Add guest event access policy checks.
- [x] Update read models to consume guest reader ports.

**Tests:**

- [x] Guest RSVP/check-in state command test if current behavior exists.
- [x] Guest portal payload test.
- [x] Forbidden-role test: guest cannot read PMCM planning payload.
- [x] `npm --workspace prism-api run test -- guest`.

**Acceptance criteria:**

- [x] Guest writes live in `guest-ops`.
- [x] Guest payloads are role-scoped and do not expose PMCM private data.

**Commit checkpoint:** [x] `refactor(api): extract guest operations module`

## Phase 10 - Extract staffing-ops

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-10-staffing-ops.md`

**Purpose:** Separate coordinator staffing and internal task assignment from general event operations.

**Edits:**

- [x] Create `staffing-ops` module.
- [x] Move coordinator/staffing behavior from `CoordinatorsService` and `LiveOperationsService` where ownership is internal staffing rather than event-day operations.
- [x] Add staffing commands and reader ports.
- [x] Keep event-day operational behavior in the owning module named by the child plan when the behavior is not staffing-specific.
- [x] Add PMCM/coordinator role tests.

**Tests:**

- [x] Coordinator assignment command test.
- [x] Internal staffing read test.
- [x] Forbidden-role test: client/supplier/guest cannot access internal staffing payload.
- [x] `npm --workspace prism-api run test -- coordinator` or narrowest matching test command.

**Acceptance criteria:**

- [x] Staffing writes live in `staffing-ops`.
- [x] Internal staffing payloads remain PMCM/coordinator scoped.

**Commit checkpoint:** [x] `refactor(api): extract staffing operations module`

## Phase 11 - Prepare And Extract event-read-models

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-11-event-read-models.md`.

**Purpose:** Move role payload composition into a read-only module after capability reader ports exist.

**Edits:**

- [x] Create `event-read-models` module.
- [x] Move `EventReadModelsService` after supplier, finance, file, floorplan, guest, and staffing reader ports exist.
- [x] Move DTO/read-model mapper callbacks out of capability services and into `event-read-models` mappers or shared backend mapper files.
- [x] Forbid `event-read-models -> event-ops` imports.
- [x] Replace private-service reads with reader ports.
- [x] Allow direct Prisma reads only through named query-builder files with field allowlists, role-scope tests, and query-budget comments.
- [x] Split read-model tests by actor: PMCM, client, supplier, guest.
- [x] Add N+1/query-budget tests for high-volume dashboard payloads where test infrastructure can count Prisma calls.

**Query-builder comment shape:**

```ts
// Query budget: one event summary query plus one scoped relation query per payload, no per-row Prisma loop.
```

**Tests:**

- [x] PMCM dashboard payload includes operational fields.
- [x] Client event payload excludes PMCM-only finance, staffing, and supplier-private fields.
- [x] Supplier payload excludes client-private fields and finance internals.
- [x] Guest payload excludes PMCM planning fields.
- [x] Boundary test: read model cannot call Prisma mutation methods.
- [x] `npm --workspace prism-api run test -- read-model`.
- [x] `npm run check:boundaries`.

**Acceptance criteria:**

- [x] Read-model code is read-only.
- [x] Role payloads are field-allowlisted.
- [x] Cross-domain reads are centralized and query-budgeted.

**Commit checkpoint:** [x] `refactor(api): extract event read models module`

## Phase 12 - Extract closure-ops

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-12-closure-ops.md`.

**Purpose:** Separate event closure/archive readiness after read ports exist.

**Edits:**

- [x] Create `closure-ops` module.
- [x] Move `EventClosureService` into `closure-ops`.
- [x] Add `ClosureCommands` and `ClosureReadinessReader` ports.
- [x] Consume public file readiness composition for closure checks; keep deeper supplier, finance, compliance, floorplan, guest, and staffing reader specialization as later hardening when those closure-specific ports exist.
- [x] Do not import private services from capability modules.
- [x] Add archive readiness tests.

**Tests:**

- [x] Closure command test.
- [x] Archive readiness read test.
- [x] Forbidden-role test: non-PMCM actor cannot close event.
- [x] Boundary test: `closure-ops` depends only on public reader ports.

**Acceptance criteria:**

- [x] Closure writes live in `closure-ops`.
- [x] Closure readiness enters through public module APIs only.
- [x] `event-core` remains narrow.

**Commit checkpoint:** [x] `refactor(api): extract closure operations module`

## Phase 4-12 Reconciliation Gate

Reconciliation artifact: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-4-12-reconciliation.md`.

Before claiming the full backend modular monolith goal complete, use the reconciliation artifact to resolve or explicitly defer stale unchecked items from Phases 4-12. The audit classifies each open item as `completed with evidence`, `covered by later phase`, `still missing`, or `deferred by design`. Items marked `still missing` are not proof blockers for the controller slices already committed, but they are blockers for any final completion claim unless a later commit adds evidence or changes the scope intentionally.

## Phase 13 - Move Controllers To Owning Modules

Child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-13-controller-ownership.md`. Live-ops child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-13-live-ops-routes.md`. PARE child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-13-pare-routes.md`. Supplier withdrawal child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-13-supplier-withdrawal-route.md`. Defense readiness child plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-13-defense-readiness-route.md`.

**Purpose:** Move HTTP ownership after service ownership is stable.

**Edits:**

- [x] Map every current controller method to an owning module.
- [x] Move controller files one module at a time.
- [x] Keep public route paths and request/response DTOs stable.
- [x] Update API client contracts only when the route contract intentionally changes. No route contract changed in the defense-readiness slice.
- [x] Keep compatibility delegates if an app branch still depends on an old controller grouping.

**Controller ownership target:**

| Current controller | Target ownership |
| --- | --- |
| `inquiries.controller.ts` | `inquiry-onboarding` |
| `quote-requests.controller.ts` | `commercial-ops` |
| `supplier-network.controller.ts` | `supplier-ops` |
| `billing.controller.ts` | `event-read-models` for billing reads |
| `files.controller.ts` or file route group | `file-ops` |
| `floor-plan.controller.ts` | `floorplan` |
| `guest.controller.ts` | `guest-ops` |
| `events.controller.ts` | split between `event-core`, `floorplan`, `compliance-ops`, closure/readiness, and read models; event list/detail now moved to `event-read-models`, floorplan routes now moved to `floorplan`, billing command routes now moved to `finance-ops`, closure/archive routes now moved to `closure-ops`, file requirements route now moved to `file-ops`, event commercial quote request/add/select routes now moved to `commercial-ops`, coordinator assignment/acknowledgement routes now moved to `staffing-ops`, supplier portal assignment/readiness/contract commands now moved to `supplier-ops`, event briefing now moved to `inquiry-onboarding`, and compliance execution/resolution now moved to `compliance-ops` |
| dashboard/read endpoints | `event-read-models` |

**Tests:**

- [x] Route smoke tests for each moved controller.
- [x] API client type generation check if client packages are affected. Not affected by the defense-readiness route move because path and response shape stayed stable.
- [x] `npm --workspace prism-api run build`.
- [x] `npm run check:boundaries`.

**Acceptance criteria:**

- [x] Route behavior stays stable.
- [x] Controllers no longer route all business behavior through `EventOpsService`.
- [x] App clients continue to build. API route contract stayed stable and API build passed; no client package changes were required.


> Progress: `guest.controller.ts` has moved to `guest-ops`; `quote-requests.controller.ts` has moved to `commercial-ops`; `inquiries.controller.ts` has moved to `inquiry-onboarding`; `billing.controller.ts` has moved to `event-read-models`; `notifications.controller.ts` has moved to `notification-ops`; `OpsClientController` has moved to `event-read-models`; `OpsCoordinatorsController` has moved to `staffing-ops`; `OpsPmcmCommandInboxController` has moved to `event-read-models`; `OpsOnboardingController` has moved to `inquiry-onboarding`; `OpsAuditController` and `OpsPrivacyController` have moved to `trust-ops`; `OpsAuthController` has moved to `identity-ops`; `OpsAiGovernanceController` has moved AI governance dry-run to `ai-governance`; supplier directory reads have moved to `supplier-ops`; event billing command routes have moved to `finance-ops`; event closure/archive routes have moved to `closure-ops`; event file requirements route has moved to `file-ops`; event commercial quote request/add/select routes have moved to `commercial-ops`; coordinator assignment/acknowledgement routes have moved to `staffing-ops`; supplier portal assignment/readiness/contract commands have moved to `supplier-ops`; event briefing has moved to `inquiry-onboarding`; supplier workspace/readiness-board reads have moved to `event-read-models`; event-day live-ops reads, status feed, event-day task/urgent-issue commands, coordinator attendance/replacement, coordinator role-view, PMCM supplier setup verification, and supplier event-status have moved to `live-ops`; PARE automation has moved to `ai-governance`; `/ai/pare/*` routes and supplier quote-request withdrawal have moved to `supplier-ops`; defense readiness has moved to `event-read-models`; only `/sample/*` compatibility routes remain local to `event-ops`.
**Commit checkpoint:** `refactor(api): move controllers to owning modules`

## Phase 14 - Retire EventOps Facade

**Purpose:** Remove the old hub after routes and clients no longer need it.

**Edits:**

- [x] Inventory remaining `EventOpsService` methods.
- [x] Delete methods that are no longer called from the public facade. Defense-readiness was removed; non-sample delegates are no longer public API, and remaining public calls are sample compatibility.
- [x] Move any remaining behavior to the owning module or document why it remains compatibility-only. `/sample/*` remains a local demo/seed/reset aggregate by design; capability modules are imported by the API root for route ownership.
- [ ] Delete `EventOpsService` only when no controller or test imports it. Not met by design: `SampleController` still imports it for compatibility-only sample state/reset/seed.
- [x] Delete stale path aliases and exports. The local controller registry now exports/registers only `SampleController`, and stale event-ops controller shim files were removed.
- [x] Update docs to state that `event-ops` is retired or compatibility-only.

**Tests:**

- [x] `rg "^  async " apps/api/libs/modules/event-ops/src/event-ops.service.ts` returns only lifecycle plus sample state/reset/seed public methods.
- [x] `npm --workspace prism-api run build`.
- [x] `npm --workspace prism-api run test` if feasible. Focused route/read-model tests passed; full suite remains expensive for this branch.
- [x] `npm run check:boundaries`.

**Acceptance criteria:**

- [x] No business route module depends on `event-ops`; the API root imports capability modules directly. `event-ops` still imports capability modules only to assemble the deferred `/sample/*` compatibility aggregate.
- [x] Docs and architecture diagrams match runtime structure.
- [x] Deletion does not break app clients. API route contracts stayed stable and API build passed.

**Commit checkpoint:** `refactor(api): retire event ops compatibility facade`

## Owner D Evidence Gate For Every Child Plan

Every child plan created from this master plan must include this evidence table before implementation starts and must update it before merge:

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Which backend/integration goal this advances. |
| Feature-ledger row | The exact feature-ledger row, unfinished feature family, or redesign dependency affected. |
| Route/app/actor | The API route, app, and actor role touched. |
| Contract touched | `packages/types`, `packages/api-client`, route DTO, or none. |
| Fallback state | Kept, removed, or deferred after July with reason. |
| Forbidden-role test | The role that must be denied and the test that proves it. |
| Query budget | Expected query shape for read payloads or `not applicable` for pure command work. |
| Side-effect mode | `same_tx`, `after_commit`, `durable_outbox`, or `read_only`. |
| Route-smoke evidence | Command, screenshot, or API test proving the route still works. |
| Docs updated | Exact docs changed in the same branch. |

A child plan without this table is incomplete.

## Testing Strategy

Testing should scale with the phase risk:

| Test layer | Required for | Examples |
| --- | --- | --- |
| Provider construction | Phase 1 and every new module. | Module compiles, provider tokens resolve, no manual fallback dependencies. |
| Command unit tests | Every module that owns writes. | Supplier assignment, payment record, floorplan approval, closure command. |
| Transaction tests | Commands with audit/outbox or multi-row mutations. | Mutation and audit commit together; retry does not duplicate outbox row. |
| Forbidden-role tests | Every actor-facing command/read payload. | Client cannot mutate official floorplan; guest cannot read PMCM dashboard. |
| Read-model tests | `event-read-models` and role dashboards. | Field allowlists per actor, no PMCM-only leakage. |
| Boundary tests | Every extraction phase. | No private service import, no read-model mutation. |
| Route smoke tests | Controller moves and compatibility delegates. | Existing endpoint still returns compatible status/body. |
| Build checks | Every phase that changes modules/path aliases. | `npm --workspace prism-api run build`. |

Do not rely only on TypeScript compilation for these changes. The risk is behavior leakage and role leakage, not just syntax.

## Import Boundary Check Additions

Add concrete checks to `scripts/check-prism-boundaries.mjs` after Phase 0. The exact implementation should follow the current script style.

Target rule metadata:

```js
const backendBoundaryRules = [
  {
    owner: 'supplier-ops',
    disallow: ['modules/finance-ops/src/services/', 'modules/event-read-models/src/'],
  },
  {
    owner: 'finance-ops',
    disallow: ['modules/supplier-ops/src/services/', 'modules/event-read-models/src/'],
  },
  {
    owner: 'event-read-models',
    disallowMutationPrismaCalls: true,
  },
  {
    owner: 'event-ops',
    disallowNewBusinessServices: true,
  },
];
```

Implementation details:

- [x] Use the existing boundary checker's file-walk style and error output format. Evidence: `scripts/check-prism-boundaries.mjs` keeps the `git ls-files` source walk and `P.R.I.S.M boundary violations:` output format.
- [x] Add import-path checks for private service paths. Evidence: `backend capability modules must not import private services from other capability modules`.
- [x] Add an AST-based check if the script already parses TypeScript. If not, add a conservative regex check for Prisma mutation method names in `event-read-models` files. Evidence: `event-read-models must not mutate Prisma state` uses the existing regex checker style.
- [x] Allow `$queryRaw` and `$queryRawUnsafe` only in files under an approved `queries/` path and only when the file contains a `Query budget:` comment. Evidence: `event-read-models raw queries require an approved query builder with a query budget`.
- [x] Add a boundary-check fixture that intentionally violates each new rule. Evidence: `scripts/check-prism-boundaries.test.mjs` asserts illegal private service imports, read-model mutation, and raw-query violations.
- [x] Add a passing fixture for approved read-model query builders. Evidence: `scripts/check-prism-boundaries.test.mjs` includes approved read-model query-builder coverage.
- [x] Print the owning module and offending import or method in every failure message. Evidence: violation output includes the offending file path and rule name; rule names include the owning module boundary.

## Documentation Updates Required During Migration

Update docs in the same branch as the implementation that changes runtime behavior.

| File | Required update |
| --- | --- |
| `docs/prism-v4/00-index.md` | Add or update links to backend architecture/current state/future state docs when this plan becomes active. |
| `docs/prism-v4/07-implemented-feature-revisions.md` | Record implemented backend capability movement only after code lands. |
| `docs/prism-v4/11-feature-ledger.md` | Update affected feature rows when module ownership changes completion or evidence status. |
| `docs/prism-v4/12-redesign-inventory.md` | Update Anthony/Owner D rows when backend module boundaries unblock redesign work. |
| `docs/prism-v4/13-docs-cleanup-checklist.md` | Mark stale backend docs or hub references that need cleanup. |
| `docs/prism-v4/14-redesign-readiness-foundation.md` | Record backend contract readiness changes that affect redesign branches. |
| `docs/prism-v4/15-system-architecture.md` | Add current/target backend module map and update as modules land. |
| `docs/prism-v4/17-current-state-2026-06-20.md` | Add post-snapshot notes when major modules are extracted. |
| `docs/prism-v4/18-future-state.md` | Keep future-state architecture aligned with the modular-monolith direction. |
| `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md` | Reflect changed backend verification expectations if July sprint tasks depend on new modules. |
| `docs/superpowers/plans/2026-06-20-prism-system-completion-review.md` | Update confidence gates if a backend module changes system-completion evidence. |
| `docs/superpowers/MANIFEST.md` | Add new plan/report references if this repo uses the manifest for active plan discovery. |
| `README.md` | Add backend module overview once Phase 3 lands. |
| `AGENTS.md` | Update only if product boundaries or agent defaults change. |

## Rollout Order

1. Document architecture and add import-boundary guardrails.
2. Convert current `event-ops` services to Nest DI without moving files.
3. Introduce transaction context and infrastructure ports.
4. Extract `trust-ops`, `notification-ops`, `access-control`, and narrow `event-core`.
5. Extract one supplier vertical slice and validate the pattern.
6. Extract `finance-ops`.
7. Extract `file-ops`.
8. Extract `inquiry-onboarding`, `commercial-ops`, and `compliance-ops` as separate child plans.
9. Extract `floorplan`.
10. Extract `guest-ops`.
11. Extract `staffing-ops`.
12. Extract `event-read-models` after reader ports exist.
13. Extract `closure-ops` after read models and reader ports are stable.
14. Move controllers to owning modules.
15. Retire or shrink the `event-ops` facade.

## Stop Rules

Stop and revise this plan before continuing if:

1. A module extraction requires changing public HTTP paths.
2. A portal route starts reading PMCM-only data.
3. A capability module needs to import another module's private service internals.
4. A read model needs to mutate data.
5. A use case needs audit/notification side effects but cannot define transaction/outbox semantics.
6. Tests require large fixture rewrites before the first behavior-preserving extraction.
7. The extraction causes app branches to wait on backend churn without a stable shared contract.
8. Real storage, production notifications, external auth, QR/camera, or live AI appears in this refactor without separate approval.
9. `event-core` starts absorbing unrelated workflow ownership.
10. A planned abstraction has no immediate user in the same phase.

## Council Review Feedback Integrated

This revision includes the agent council feedback in the following ways:

| Feedback source | Change made |
| --- | --- |
| Product/QA/docs alignment review | Added July execution boundary, Owner D evidence gate, expanded docs list, external dependency limits, and route/app/actor evidence requirements. |
| Architecture boundary review | Added orphaned domains (`identity-ops`, `commercial-ops`, `compliance-ops`, `closure-ops`), narrowed `event-core`, added operational architecture, and made transaction/outbox semantics explicit. |
| NestJS/DI feasibility review | Added `@Injectable()`/provider requirements, `@nestjs/testing` caveat, provider-token runtime rules, adapter examples, path alias/build requirements, and mapper/read-model extraction details. |
| Naming review | Standardized capability names and corrected `compliance-ops` module naming. |
| Implementation-risk review | Added stop rules for speculative primitives, Phase 3+ July limits, and per-child-plan evidence gates. |

## Self-Review Checklist

| Requirement | Coverage |
| --- | --- |
| Long-term backend structure, not short-term delivery | Target module map, module contracts, and fourteen-phase migration path. |
| Capability modules instead of generic libs | Module contract table, naming standard, and boundary rules. |
| Service separation in libs/modules | Planned file structure and phase-by-phase extraction. |
| Explicit cross-module dependencies | Ports, provider tokens, dependency direction, and import-boundary checks. |
| Read/write separation | Command-side capability modules and read-only `event-read-models`. |
| Audit/outbox/security included | `trust-ops`, `notification-ops`, `access-control`, transaction modes, and operational architecture. |
| Owner D traceability | Owner D scope, July execution boundary, and child-plan evidence gate. |
| Docs alignment | Full docs update table including Prism v4 docs, agile calendar, system-completion review, manifest, README, and AGENTS. |
| Tests and verification | Per-phase commands and capability-specific boundary, role, transaction, build, and route smoke tests. |
| Avoid overengineering | Stop rules, no microservices, no generic repository layer, no table-per-module design, no speculative event bus. |

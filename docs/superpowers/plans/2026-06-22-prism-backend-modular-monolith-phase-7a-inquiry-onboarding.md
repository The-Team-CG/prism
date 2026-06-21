# Prism Backend Modular Monolith Phase 7A Inquiry Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract public inquiry, accepted-inquiry conforme gating, and client briefing onboarding into `inquiry-onboarding` while preserving existing inquiry and event route contracts.

**Architecture:** `inquiry-onboarding` owns public inquiry commands, PMCM log-on-behalf intake, inquiry status transitions, conforme reminder handling, signed conforme upload activation, and client briefing submission. `event-ops` remains the route compatibility facade and keeps cross-domain onboarding reads until `event-read-models` exists. Controller movement is outside this slice.

**Tech Stack:** NestJS modules/providers, PrismaService, Vitest, TypeScript path aliases, existing `event-ops` compatibility facade, `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, `@prism/database`, and current event-ops route tests.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Stable backend ownership for inquiry-to-conforme-to-client-onboarding flow, preserving client portal activation and PMCM intake behavior during redesign. |
| Feature-ledger row | FL-001 public inquiry, FL-002 PMCM inquiry triage, FL-003 signed conforme gate, FL-004 client portal after conforme, FL-005 client briefing/onboarding. |
| Route/app/actor | Existing inquiry controller routes through `apps/api`: public `createInquiry`, PMCM `listInquiries`, PMCM `logInquiryOnBehalf`, PMCM `updateInquiryStatus`, PMCM `sendConformeReminder`, signed conforme upload, and client briefing submission from the client portal/event route. |
| Contract touched | Backend module exports and API TypeScript aliases. No `packages/types` or `packages/api-client` contract changes unless build proves a compatibility export is missing. |
| Fallback state | Existing `event-ops` route facade stays. `listOnboarding` remains in `event-ops` because it is a cross-domain PMCM read over inquiries, events, and documents; it moves only after read-model extraction. |
| Forbidden-role test | Existing `event-ops.service.test.ts` PMCM-only list/log-on-behalf tests keep passing; add focused inquiry-onboarding test that non-PMCM actors cannot log inquiries on behalf. |
| Query budget | Inquiry creation reads up to 100 prior inquiries for normalized-email duplicate/declined checks. Reminder sweep loops over accepted unsigned inquiries only and keeps the existing `QUERY_AUDIT_ALLOW_BOUNDED_LOOP` comment. Client briefing writes one briefing and one event update in one transaction. |
| Side-effect mode | Inquiry create/update/reminder/conforme/client briefing commands use the existing `WorkflowCommandService` side-effect boundary: DB writes first, then audit/outbox side effects through command hooks. `uploadConforme` keeps DB writes inside a Prisma transaction and audit/outbox outside the transaction. |
| Route-smoke evidence | `npm --workspace prism-api run test -- libs/modules/inquiry-onboarding/src/services/inquiries.service.test.ts libs/modules/inquiry-onboarding/src/services/client-onboarding-workflow.service.test.ts`, `npm --workspace prism-api run test -- inquiry`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 7A checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Current Findings

- `InquiriesService` already owns public inquiry creation, PMCM log-on-behalf intake, status transitions, conforme reminders, portal invitation open tracking, and signed conforme upload activation.
- `InquiryWorkflowService` is a route-facade helper that accepts mapping callbacks from `EventOpsService`; it can move with `InquiriesService` while keeping its callback shape to avoid moving route mappers.
- `ClientOnboardingWorkflowService` owns client briefing submission and updates event readiness/status inside one Prisma transaction.
- `EventOpsService.listOnboarding` is a PMCM cross-domain read over inquiries, events, and documents. It stays in `event-ops` until `event-read-models` or a dedicated onboarding read-model child plan exists.
- Existing event-ops tests cover inquiry acceptance, duplicate inquiry linking, declined-inquiry flags, public log-on-behalf spoof rejection, PMCM log-on-behalf metadata, signed conforme upload, reminder sweep timing, portal invitation opened on login, privacy consent, and client briefing behavior.
- The old cross-cutting event-ops paths for audit, notification outbox, and workflow command are already compatibility exports. Moved services must import directly from `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, and `@prism/modules/event-core`.

## Scope Rules

In scope:

- Create `apps/api/libs/modules/inquiry-onboarding`.
- Move `InquiriesService`, `InquiryWorkflowService`, and `ClientOnboardingWorkflowService` into `inquiry-onboarding`.
- Add `InquiryOnboardingModule` that provides/exports moved services plus `INQUIRY_COMMANDS` and `CLIENT_ONBOARDING_COMMANDS` tokens.
- Add public ports: `InquiryCommands` and `ClientOnboardingCommands`.
- Keep `event-ops` compatibility re-exports at old service paths.
- Update `EventOpsModule`, `EventOpsService`, and `event-ops.service.test.ts` to import moved services from `@prism/modules/inquiry-onboarding`.
- Add focused module tests for inquiry privacy/log-on-behalf/duplicate detection and client briefing transaction behavior.
- Preserve existing public HTTP paths and request/response mapping.

Out of scope:

- Moving `inquiries.controller.ts` or `events.controller.ts`.
- Moving `EventOpsService.listOnboarding`.
- Moving `EventReadModelsService`, public inquiry DTOs, API client generation, external auth, production email/SMS, billing calculations, or document storage behavior.
- Changing accepted inquiry, signed conforme, billing statement generation, or client briefing route payload shapes.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/inquiry-onboarding/src/services/inquiries.service.ts` | Moved public inquiry and conforme workflow command owner. |
| `apps/api/libs/modules/inquiry-onboarding/src/services/inquiries.service.test.ts` | Focused inquiry privacy/log-on-behalf/duplicate detection tests. |
| `apps/api/libs/modules/inquiry-onboarding/src/services/inquiry-workflow.service.ts` | Moved route-facade helper preserving EventOps mapper callbacks. |
| `apps/api/libs/modules/inquiry-onboarding/src/services/client-onboarding-workflow.service.ts` | Moved client briefing command owner. |
| `apps/api/libs/modules/inquiry-onboarding/src/services/client-onboarding-workflow.service.test.ts` | Focused client briefing transaction/readiness test. |
| `apps/api/libs/modules/inquiry-onboarding/src/ports/inquiry-onboarding.tokens.ts` | `INQUIRY_COMMANDS` and `CLIENT_ONBOARDING_COMMANDS` tokens. |
| `apps/api/libs/modules/inquiry-onboarding/src/ports/inquiry-commands.port.ts` | Public inquiry command interface. |
| `apps/api/libs/modules/inquiry-onboarding/src/ports/client-onboarding-commands.port.ts` | Public client onboarding command interface. |
| `apps/api/libs/modules/inquiry-onboarding/src/inquiry-onboarding.module.ts` | Runtime module exporting moved services and public tokens. |
| `apps/api/libs/modules/inquiry-onboarding/src/index.ts` | Public inquiry-onboarding exports. |
| `apps/api/libs/modules/inquiry-onboarding/tsconfig.lib.json` | Library tsconfig. |
| `apps/api/libs/modules/event-ops/src/services/inquiries.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/services/inquiry-workflow.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/services/client-onboarding-workflow.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `InquiryOnboardingModule`; remove local inquiry/onboarding providers. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Import moved services/types from `@prism/modules/inquiry-onboarding`. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Import moved services from `@prism/modules/inquiry-onboarding`. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add inquiry-onboarding aliases and Nest metadata. |
| `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` | Mark only proven Phase 7A tasks after verification. |
| `docs/prism-v4/15-system-architecture.md`, `docs/prism-v4/17-current-state-2026-06-20.md` | Record runtime state and remaining limitations. |

## Task 1 - Add Focused Inquiry Service Tests Before Moving

**Files:**

- Create: `apps/api/libs/modules/event-ops/src/services/inquiries.service.test.ts`

- [ ] Create a focused test file at the old path before moving the service:

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from './workflow-command.service';
import { InquiriesService } from './inquiries.service';

function inquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inq_existing',
    clientName: 'Ana Reyes',
    companyName: 'Ayala Corp',
    email: 'ana@ayala.test',
    normalizedEmail: 'ana@ayala.test',
    eventName: 'Ayala Summit',
    eventType: 'Corporate',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
    clientType: 'Corporate',
    source: 'Website',
    referralDetails: '',
    loggedByRole: null,
    loggedByName: null,
    duplicateOfInquiryId: null,
    previousDeclinedInquiryId: null,
    previousDeclineReason: null,
    message: 'Planning inquiry',
    privacyConsentAccepted: true,
    privacyNoticeVersion: '2026-05-01',
    marketingConsentAccepted: false,
    status: 'new',
    acceptedAt: null,
    pendingAt: null,
    declinedAt: null,
    declineReason: null,
    conformeSentAt: null,
    conformeSignedAt: null,
    portalActivatedAt: null,
    portalInvitationStatus: 'not_sent',
    portalInvitationSentAt: null,
    portalInvitationOpenedAt: null,
    portalInvitationExpiresAt: null,
    followUpIntervalDays: 3,
    lastConformeReminderAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(existing = [inquiry()]) {
  const records: any[] = [...existing];
  const notifications: any[] = [];
  const audits: any[] = [];
  const prisma = {
    opsInquiry: {
      findMany: vi.fn(async () => records),
      create: vi.fn(async ({ data }) => {
        const row = { ...inquiry(), ...data, createdAt: new Date('2026-05-02T00:00:00.000Z') };
        records.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }) => records.find((item) => item.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const index = records.findIndex((item) => item.id === where.id);
        records[index] = { ...records[index], ...data };
        return records[index];
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  const auditService = { audit: vi.fn(async (...entry: unknown[]) => audits.push(entry)) };
  const notificationOutboxService = { queue: vi.fn(async (...entry: unknown[]) => notifications.push(entry)) };
  const service = new InquiriesService(
    prisma as any,
    auditService as any,
    notificationOutboxService as any,
    new WorkflowCommandService(),
  );
  return { service, records, notifications, audits, prisma };
}

describe('InquiriesService', () => {
  it('requires privacy consent for public inquiry creation', async () => {
    const { service } = createService([]);

    await expect(
      service.createInquiry({
        clientName: 'Mia Cruz',
        email: 'mia@example.test',
        eventName: 'Privacy Event',
        eventDate: '2026-07-01',
        clientType: 'Corporate',
        message: 'Planning inquiry',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks non-PMCM actors from logging inquiries on behalf of clients', async () => {
    const { service } = createService([]);

    await expect(
      service.logInquiryOnBehalf(
        {
          clientName: 'Walk In Client',
          email: 'walkin@example.test',
          eventName: 'Walk In Product Launch',
          eventDate: '2026-07-10',
          clientType: 'Corporate',
          message: 'Client gave details at PMCM office',
        },
        { actorRole: 'client', actorName: 'Ana Reyes' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('links duplicate and previous declined inquiries by normalized email', async () => {
    const { service } = createService([
      inquiry({ id: 'inq_same_window', eventDate: new Date('2026-07-01T00:00:00.000Z') }),
      inquiry({
        id: 'inq_declined',
        status: 'declined',
        declineReason: 'Date unavailable',
        declinedAt: new Date('2026-05-01T00:00:00.000Z'),
        eventDate: new Date('2026-04-01T00:00:00.000Z'),
      }),
    ]);

    const created = await service.createInquiry({
      clientName: 'Ana Reyes',
      email: ' ANA@ayala.test ',
      eventName: 'Ayala Summit Follow-up',
      eventDate: '2026-07-08',
      clientType: 'Corporate',
      message: 'Second submission for same planning window',
      privacyConsentAccepted: true,
    });

    expect((created as any).normalizedEmail).toBe('ana@ayala.test');
    expect((created as any).duplicateOfInquiryId).toBe('inq_same_window');
    expect((created as any).previousDeclinedInquiryId).toBe('inq_declined');
  });
});
```

- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/inquiries.service.test.ts`.
  Expected before move: PASS.

## Task 2 - Add Focused Client Briefing Test Before Moving

**Files:**

- Create: `apps/api/libs/modules/event-ops/src/services/client-onboarding-workflow.service.test.ts`

- [ ] Create a focused test for the briefing command and event readiness update:

```ts
import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from './workflow-command.service';
import { ClientOnboardingWorkflowService } from './client-onboarding-workflow.service';

function createService() {
  const event = { id: 'evt_onboarding', status: 'briefing', readiness: 'Client briefing open' };
  const briefings: any[] = [];
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async () => event),
      update: vi.fn(async ({ data }) => Object.assign(event, data)),
    },
    opsBriefing: {
      deleteMany: vi.fn(async () => ({ count: briefings.length })),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, submittedAt: new Date('2026-05-03T00:00:00.000Z') };
        briefings.push(row);
        return row;
      }),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const auditService = { audit: vi.fn(async () => undefined) };
  const notificationOutboxService = { queue: vi.fn(async () => undefined) };
  const service = new ClientOnboardingWorkflowService(
    prisma as any,
    auditService as any,
    notificationOutboxService as any,
    new WorkflowCommandService(),
  );
  return { service, event, briefings, auditService, notificationOutboxService };
}

describe('ClientOnboardingWorkflowService', () => {
  it('replaces the client briefing and advances event readiness', async () => {
    const { service, event, briefings, auditService, notificationOutboxService } = createService();

    const briefing = await service.submitBriefing('evt_onboarding', {
      venue: 'BGC Convention Hall',
      guestCount: 250,
      budgetRange: '500000-750000',
      serviceRequirements: ['registration', 'stage', 'documentation'],
      notes: 'Executive audience with VIP arrivals.',
    });

    expect(briefing.eventId).toBe('evt_onboarding');
    expect(briefings).toHaveLength(1);
    expect(event).toMatchObject({ readiness: 'Supplier quotes pending', status: 'planning' });
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_onboarding',
      'Client',
      'Submitted client briefing',
      expect.objectContaining({ affectedType: 'briefing' }),
    );
    expect(notificationOutboxService.queue).toHaveBeenCalledWith(
      'evt_onboarding',
      'PMCM Admin',
      'Client briefing submitted',
    );
  });
});
```

- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/client-onboarding-workflow.service.test.ts`.
  Expected before move: PASS.

## Task 3 - Create Inquiry-Onboarding Module Shell

- [ ] Create directories `apps/api/libs/modules/inquiry-onboarding/src/ports` and `apps/api/libs/modules/inquiry-onboarding/src/services`.
- [ ] Add `apps/api/libs/modules/inquiry-onboarding/tsconfig.lib.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../../dist/libs/modules/inquiry-onboarding"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

- [ ] Add `@prism/modules/inquiry-onboarding` and `@prism/modules/inquiry-onboarding/*` to `apps/api/tsconfig.json`.
- [ ] Add the Vitest alias:

```ts
  '@prism/modules/inquiry-onboarding': resolve(__dirname, './libs/modules/inquiry-onboarding/src/index.ts'),
```

- [ ] Add `inquiry-onboarding` to `apps/api/nest-cli.json` with root `libs/modules/inquiry-onboarding`, entry `index`, source root `libs/modules/inquiry-onboarding/src`, and tsconfig `libs/modules/inquiry-onboarding/tsconfig.lib.json`.
- [ ] Create `inquiry-onboarding.tokens.ts`:

```ts
export const INQUIRY_COMMANDS = Symbol('INQUIRY_COMMANDS');
export const CLIENT_ONBOARDING_COMMANDS = Symbol('CLIENT_ONBOARDING_COMMANDS');
```

- [ ] Create `inquiry-commands.port.ts`:

```ts
import type { OpsDocument, OpsInquiry } from '@prisma/client';
import type { PrismEventOpsActorContext } from '@prism/types';
import type { CreateInquiryInput, UpdateInquiryStatusInput } from '../services/inquiries.service';

export interface InquiryCommands {
  createInquiry(input: CreateInquiryInput): Promise<OpsInquiry>;
  logInquiryOnBehalf(input: CreateInquiryInput, actorInput?: PrismEventOpsActorContext): Promise<OpsInquiry>;
  updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput): Promise<OpsInquiry>;
  sendConformeReminder(inquiryId: string): Promise<OpsInquiry>;
  runConformeReminderSweep(): Promise<void>;
  markPortalInvitationOpenedByEmail(email: string): Promise<void>;
  uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number },
  ): Promise<OpsDocument>;
}
```

- [ ] Create `client-onboarding-commands.port.ts`:

```ts
import type { OpsBriefing } from '@prisma/client';
import type { SubmitBriefingInput } from '../services/client-onboarding-workflow.service';

export interface ClientOnboardingCommands {
  submitBriefing(eventId: string, input: SubmitBriefingInput): Promise<OpsBriefing>;
}
```

- [ ] Create `inquiry-onboarding.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { CLIENT_ONBOARDING_COMMANDS, INQUIRY_COMMANDS } from './ports/inquiry-onboarding.tokens';
import { ClientOnboardingWorkflowService } from './services/client-onboarding-workflow.service';
import { InquiriesService } from './services/inquiries.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
  providers: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    { provide: INQUIRY_COMMANDS, useExisting: InquiriesService },
    { provide: CLIENT_ONBOARDING_COMMANDS, useExisting: ClientOnboardingWorkflowService },
  ],
  exports: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    INQUIRY_COMMANDS,
    CLIENT_ONBOARDING_COMMANDS,
  ],
})
export class InquiryOnboardingModule {}
```

- [ ] Create `index.ts`:

```ts
export * from './inquiry-onboarding.module';
export * from './ports/client-onboarding-commands.port';
export * from './ports/inquiry-commands.port';
export * from './ports/inquiry-onboarding.tokens';
export * from './services/client-onboarding-workflow.service';
export * from './services/inquiries.service';
export * from './services/inquiry-workflow.service';
```

## Task 4 - Move Inquiry-Onboarding Services

- [ ] Move `inquiries.service.ts`, `inquiry-workflow.service.ts`, and `client-onboarding-workflow.service.ts` from `event-ops/src/services` to `inquiry-onboarding/src/services`.
- [ ] Move the focused tests from Tasks 1 and 2 into `inquiry-onboarding/src/services`.
- [ ] Update moved service imports to use `@prism/modules/event-core`, `@prism/modules/trust-ops`, and `@prism/modules/notification-ops` instead of local event-ops paths.
- [ ] Create old-path compatibility re-exports:

```ts
export * from '@prism/modules/inquiry-onboarding';
```

Use that exact one-line content in each old service path:

- `apps/api/libs/modules/event-ops/src/services/inquiries.service.ts`
- `apps/api/libs/modules/event-ops/src/services/inquiry-workflow.service.ts`
- `apps/api/libs/modules/event-ops/src/services/client-onboarding-workflow.service.ts`

## Task 5 - Wire Event-Ops Compatibility To Inquiry-Onboarding

- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.module.ts`:
  - Import `InquiryOnboardingModule`, `InquiriesService`, `InquiryWorkflowService`, and `ClientOnboardingWorkflowService` from `@prism/modules/inquiry-onboarding`.
  - Remove local imports for those three services.
  - Remove those three services from `EVENT_OPS_PROVIDERS`.
  - Add `InquiryOnboardingModule` to `imports`.

- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.ts` to import moved services and types from `@prism/modules/inquiry-onboarding`:

```ts
import {
  ClientOnboardingWorkflowService,
  InquiriesService,
  InquiryWorkflowService,
  type CreateInquiryInput,
  type SubmitBriefingInput,
  type UpdateInquiryStatusInput,
} from '@prism/modules/inquiry-onboarding';
```

- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` to import moved services from `@prism/modules/inquiry-onboarding`:

```ts
import { ClientOnboardingWorkflowService, InquiriesService, InquiryWorkflowService } from '@prism/modules/inquiry-onboarding';
```

- [ ] Leave `EventOpsService.listOnboarding` unchanged.

## Task 6 - Verification And Docs Closeout

- [ ] Run `npm --workspace prism-api run test -- libs/modules/inquiry-onboarding/src/services/inquiries.service.test.ts libs/modules/inquiry-onboarding/src/services/client-onboarding-workflow.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- inquiry`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run build`.
- [ ] Run `npm run check:boundaries`.
- [ ] Run `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/finance-ops|modules/finance-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/file-ops|modules/file-ops" apps/api/libs/modules/inquiry-onboarding`; expected result: no matches.
- [ ] Run `git diff --check`.
- [ ] Update the parent Phase 7A checklist only for items proven by this slice.
- [ ] Add verification evidence to this child plan.
- [ ] Update `docs/prism-v4/15-system-architecture.md` and `docs/prism-v4/17-current-state-2026-06-20.md` with inquiry-onboarding extraction state and remaining limitations.
- [ ] Commit checkpoint: `refactor(api): extract inquiry onboarding module`.

## Acceptance Criteria

- [ ] `InquiriesService`, `InquiryWorkflowService`, and `ClientOnboardingWorkflowService` live under `inquiry-onboarding` and are provided/exported by `InquiryOnboardingModule`.
- [ ] `INQUIRY_COMMANDS` and `CLIENT_ONBOARDING_COMMANDS` resolve to the owning services.
- [ ] Existing inquiry controller route behavior remains reachable through `EventOpsService` compatibility methods.
- [ ] Public inquiry privacy consent, PMCM log-on-behalf authorization, duplicate/declined inquiry detection, accepted inquiry conforme gate, reminder sweep, signed conforme portal unlock, and client briefing tests pass.
- [ ] `EventOpsService.listOnboarding` remains in `event-ops` and is documented as a cross-domain read pending read-model extraction.
- [ ] `inquiry-onboarding` does not import `event-ops`, supplier, finance, or file module internals.
- [ ] API build, event-ops compatibility tests, boundary check, no-private-import scan, and diff check pass.

## Stop Rules

Stop and revise before implementation if:

1. `InquiryOnboardingModule` cannot provide the moved services without importing `EventOpsModule`.
2. Moving the services forces changes to public inquiry HTTP paths or request/response DTOs.
3. `listOnboarding` must move to make the service extraction compile.
4. Billing statement generation inside `uploadConforme` must be rewritten to a finance port in the same branch.
5. A moved service needs to import private `event-ops` services instead of public `event-core`, `trust-ops`, or `notification-ops` exports.
6. PMCM-only inquiry or onboarding reads become visible to client, supplier, or guest actors in tests.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Phase 7A child plan exists before implementation | This plan defines the separate inquiry-onboarding extraction and does not bundle commercial or compliance work. |
| Owner D evidence gate | The evidence table names Owner D goal, feature-ledger rows, routes, contracts, fallback, forbidden-role test, query budget, side-effect mode, route smoke, and docs. |
| Behavior-preserving extraction | Tasks 1, 2, 5, and 6 preserve existing tests and route facade wiring. |
| Public ports | Task 3 adds `INQUIRY_COMMANDS` and `CLIENT_ONBOARDING_COMMANDS` with concrete interfaces. |
| Cross-module dependency rule | Task 4 imports only public cross-cutting modules and Task 6 scans for forbidden private imports. |
| Read-model restraint | `listOnboarding` is explicitly left in `event-ops` until read-model extraction. |
| Verification | Task 6 includes focused service tests, inquiry filter, full event-ops compatibility, build, boundaries, no-private-import scan, and diff check. |
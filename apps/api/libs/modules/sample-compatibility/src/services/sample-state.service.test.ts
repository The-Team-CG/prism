import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SampleStateService, type SampleStateContext } from './sample-state.service';

function createContext(): SampleStateContext {
  const map = (value: unknown) => value;
  return {
    runConformeReminderSweep: vi.fn(async () => undefined),
    runPaymentRiskSweep: vi.fn(async () => undefined),
    listSupplierCategories: vi.fn(async () => [{ id: 'cat_technical' }]),
    listSuppliers: vi.fn(async () => [{ id: 'sup_technical' }]),
    coordinatorRoleRequirements: [{ role: 'Floor Director' }],
    mapUser: map,
    mapInquiry: map,
    mapEvent: map,
    mapDocument: map,
    mapBriefing: map,
    mapSupplierQuoteRequest: map,
    mapSupplierQuote: map,
    mapCoordinator: map,
    mapCoordinatorAssignment: map,
    mapComplianceRule: map,
    mapComplianceCheck: map,
    mapBillingSource: map,
    mapBillingStatement: map,
    mapPaymentMilestone: (payment, history) => ({ payment, history }),
    mapPaymentRecord: map,
    mapPostEventDocument: map,
    mapEventInsight: map,
    mapFloorPlanDraft: map,
    mapAuditLog: map,
    mapNotificationLog: map,
  };
}

function createPrisma() {
  const findMany = vi.fn(async () => []);
  return {
    opsUser: { findMany },
    opsInquiry: { findMany },
    opsEvent: { findMany },
    opsDocument: { findMany },
    opsBriefing: { findMany },
    opsSupplierQuoteRequest: { findMany },
    opsSupplierQuote: { findMany },
    opsCoordinator: { findMany },
    opsCoordinatorAssignment: { findMany },
    opsComplianceRule: { findMany },
    opsComplianceCheck: { findMany },
    opsBillingSource: { findMany },
    opsBillingStatement: { findMany },
    opsPaymentMilestone: { findMany },
    opsPaymentRecord: { findMany },
    opsPostEventDocument: { findMany },
    opsEventInsight: { findMany },
    opsFloorPlanDraft: { findMany },
    opsAuditLog: { findMany },
    opsNotificationLog: { findMany },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<void>) => callback({
      opsFloorPlanDraft: { findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => undefined) },
      floorPlanObject: { deleteMany: vi.fn(async () => undefined) },
      floorPlan: { deleteMany: vi.fn(async () => undefined) },
      opsNotificationLog: { deleteMany: vi.fn(async () => undefined) },
      opsAuditLog: { deleteMany: vi.fn(async () => undefined) },
      opsEventInsight: { deleteMany: vi.fn(async () => undefined) },
      opsEventDayLog: { deleteMany: vi.fn(async () => undefined) },
      opsUrgentIssue: { deleteMany: vi.fn(async () => undefined) },
      opsEventDayTask: { deleteMany: vi.fn(async () => undefined) },
      opsCoordinatorReliabilityNote: { deleteMany: vi.fn(async () => undefined) },
      opsPostEventDocument: { deleteMany: vi.fn(async () => undefined) },
      opsPaymentRecord: { deleteMany: vi.fn(async () => undefined) },
      opsPaymentMilestone: { deleteMany: vi.fn(async () => undefined) },
      opsBillingStatement: { deleteMany: vi.fn(async () => undefined) },
      opsBillingSource: { deleteMany: vi.fn(async () => undefined) },
      opsComplianceCheck: { deleteMany: vi.fn(async () => undefined) },
      opsComplianceRule: { deleteMany: vi.fn(async () => undefined) },
      opsCoordinatorAssignment: { deleteMany: vi.fn(async () => undefined) },
      opsCoordinator: { deleteMany: vi.fn(async () => undefined) },
      opsSupplierQuote: { deleteMany: vi.fn(async () => undefined) },
      opsSupplierQuoteRequest: { deleteMany: vi.fn(async () => undefined) },
      opsSupplierCertification: { deleteMany: vi.fn(async () => undefined) },
      opsSupplierReliabilityNote: { deleteMany: vi.fn(async () => undefined) },
      opsSupplierReview: { deleteMany: vi.fn(async () => undefined) },
      opsSupplier: { deleteMany: vi.fn(async () => undefined) },
      opsSupplierCategory: { deleteMany: vi.fn(async () => undefined) },
      opsBriefing: { deleteMany: vi.fn(async () => undefined) },
      opsDocument: { deleteMany: vi.fn(async () => undefined) },
      opsEvent: { deleteMany: vi.fn(async () => undefined) },
      opsInquiry: { deleteMany: vi.fn(async () => undefined) },
      opsApprovalRequest: { deleteMany: vi.fn(async () => undefined) },
      opsUser: { deleteMany: vi.fn(async () => undefined) },
    })),
  };
}

describe('SampleStateService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowSampleState = process.env.PRISM_ALLOW_SAMPLE_STATE;
  const originalAllowSampleReset = process.env.PRISM_ALLOW_SAMPLE_RESET;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PRISM_ALLOW_SAMPLE_STATE = originalAllowSampleState;
    process.env.PRISM_ALLOW_SAMPLE_RESET = originalAllowSampleReset;
  });

  it('blocks sample state reads in production unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PRISM_ALLOW_SAMPLE_STATE;
    delete process.env.PRISM_ALLOW_SAMPLE_RESET;

    const service = new SampleStateService(createPrisma() as any);

    await expect(service.state(createContext())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows seed compatibility to delegate then read state outside production', async () => {
    process.env.NODE_ENV = 'test';
    const service = new SampleStateService(createPrisma() as any);
    const ensureSeeded = vi.fn(async () => undefined);
    const readState = vi.fn(async () => ({ ok: true }));

    await expect(service.seedSampleState(ensureSeeded, readState)).resolves.toEqual({ ok: true });
    expect(ensureSeeded).toHaveBeenCalledTimes(1);
    expect(readState).toHaveBeenCalledTimes(1);
  });
});
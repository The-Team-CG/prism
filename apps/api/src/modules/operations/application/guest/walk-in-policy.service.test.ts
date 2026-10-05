import { describe, expect, it, vi } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { WalkInPolicyService } from './walk-in-policy.service';

function fixture() {
  const state = { id: 'evt_1', eventName: 'Summit', walkInPolicy: 'closed', walkInThreshold: 200 };
  const database = {};
  const prisma = {
    $transaction: vi.fn(async (work: (tx: typeof database) => Promise<unknown>) => work(database)),
  };
  const eventReferences = {
    findOperationsEvent: vi.fn(async () => ({
      id: state.id,
      eventName: state.eventName,
      eventDate: new Date('2026-10-01T00:00:00Z'),
      status: 'active',
      archived: false,
      actualEndedAt: null,
      walkInPolicy: state.walkInPolicy,
      walkInThreshold: state.walkInThreshold,
    })),
  };
  const policyOwner = {
    updateWalkInPolicy: vi.fn(async (_eventId: string, input: { policy: string; threshold?: number }, context: { prisma: typeof database }) => {
      expect(context.prisma).toBe(database);
      const before = { eventId: state.id, eventName: state.eventName, policy: state.walkInPolicy, threshold: state.walkInThreshold };
      state.walkInPolicy = input.policy;
      if (input.threshold !== undefined) state.walkInThreshold = input.threshold;
      const after = { eventId: state.id, eventName: state.eventName, policy: state.walkInPolicy, threshold: state.walkInThreshold };
      return { before, after };
    }),
  };
  const auditWriter = { write: vi.fn(async (_entry: unknown, context?: { prisma?: typeof database }) => {
    expect(context?.prisma).toBe(database);
  }) };
  const service = new WalkInPolicyService(
    eventReferences as never,
    policyOwner as never,
    new WorkflowCommandService(new PrismTransactionRunner(prisma as never)),
    auditWriter as never,
  );
  return { service, state, prisma, eventReferences, policyOwner, auditWriter };
}

describe('WalkInPolicyService', () => {
  it('updates Lifecycle-owned policy through its owner port and audits in the same transaction', async () => {
    const { service, state, prisma, policyOwner, auditWriter } = fixture();
    await expect(service.update('evt_1', { policy: 'threshold', threshold: 50 }, { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never)).resolves.toEqual({ eventId: 'evt_1', policy: 'threshold', threshold: 50 });
    expect(state).toMatchObject({ walkInPolicy: 'threshold', walkInThreshold: 50 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(policyOwner.updateWalkInPolicy).toHaveBeenCalledTimes(1);
    expect(auditWriter.write).toHaveBeenCalledTimes(1);
  });

  it('rejects a threshold policy without a threshold before invoking the owner writer', async () => {
    const { service, policyOwner } = fixture();
    await expect(service.update('evt_1', { policy: 'threshold' } as never, { name: 'PMCM', role: 'pmcm-admin' } as never)).rejects.toThrow('threshold');
    expect(policyOwner.updateWalkInPolicy).not.toHaveBeenCalled();
  });
});
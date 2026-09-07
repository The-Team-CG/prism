import { describe, expect, it, vi } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { WalkInPolicyService } from './walk-in-policy.service';

function fixture() {
  const state: any = { id: 'evt_1', eventName: 'Summit', walkInPolicy: 'closed', walkInThreshold: 200 };
  const prisma: any = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ ...state })),
      update: vi.fn(async ({ data }: any) => Object.assign(state, data)),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (work: (tx: any) => Promise<unknown>) => work(prisma)),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const service = new WalkInPolicyService(prisma, new WorkflowCommandService(new PrismTransactionRunner(prisma)), auditWriter as any);
  return { service, state, prisma, auditWriter };
}

describe('WalkInPolicyService', () => {
  it('updates the PMCM-authoritative policy transactionally and audits the change', async () => {
    const { service, state, prisma, auditWriter } = fixture();
    await expect(service.update('evt_1', { policy: 'threshold', threshold: 50 }, { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as any)).resolves.toEqual({ eventId: 'evt_1', policy: 'threshold', threshold: 50 });
    expect(state).toMatchObject({ walkInPolicy: 'threshold', walkInThreshold: 50 });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(auditWriter.write).toHaveBeenCalled();
  });

  it('rejects a threshold policy without a threshold', async () => {
    const { service } = fixture();
    await expect(service.update('evt_1', { policy: 'threshold' } as any, { name: 'PMCM', role: 'pmcm-admin' } as any)).rejects.toThrow('threshold');
  });
});

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismaService } from '@prism/kernel/database';
import type { NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { AddendumWithdrawalService } from './addendum-withdrawal.service';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T09:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

const pmcm = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, email: 'pmcm@example.test', name: 'PMCM Admin', explicit: true, verified: true } satisfies ResolvedEventOpsActor;
const withdrawInput = { reason: 'Venue cannot take the rig' };

// Stateful addendum and conforme rows: the conditional updates succeed only when the status they expect still holds.
function harness({ status = 'pending', conforme = 'awaiting_client' as string | null }: { status?: string; conforme?: string | null } = {}) {
  const addendum = { id: 'addendum_1', eventId: 'evt_1', versionNumber: 2, title: 'Add stage lighting', status, plannedImpacts: status === 'pending' ? { financialDelta: 0, billing: null, quotes: [] } : null, effectiveAt: null as Date | null, withdrawnAt: null as Date | null, withdrawalReason: null as string | null, withdrawnBy: null as string | null, documentId: 'doc_1', documentState: 'pending', signatureMethod: 'scanned_document', comparison: { contract: [], quotes: [] }, financialDelta: 0, summary: '', issuedAt: new Date('2026-10-19T09:00:00.000Z') };
  const execution = conforme ? { id: 'acx_1', addendumId: 'addendum_1', eventId: 'evt_1', versionNumber: 2, status: conforme, documentContent: 'doc', documentSha256: 'a'.repeat(64), createdAt: new Date('2026-10-19T09:00:00.000Z'), completedAt: null, signatures: [] } : null;
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'locked' }]),
    opsAddendum: {
      findFirst: vi.fn(async () => ({ ...addendum, conformeExecution: execution, event: { id: 'evt_1', inquiry: { email: 'client@example.test' } } })),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
        if (where.status !== addendum.status) return { count: 0 };
        Object.assign(addendum, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => ({ ...addendum, conformeExecution: execution ? { ...execution, status: execution.status } : null })),
    },
    opsAddendumConformeExecution: {
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (!execution || !['awaiting_client', 'awaiting_pmcm'].includes(execution.status)) return { count: 0 };
        Object.assign(execution, data);
        return { count: 1 };
      }),
    },
  };
  const prisma = { $transaction: async (work: (t: typeof tx) => Promise<unknown>) => work(tx) };
  const auditWrite = vi.fn(async () => undefined);
  const notificationWrite = vi.fn(async () => undefined);
  const audit = { write: auditWrite } as unknown as AuditWriter;
  const notifications = { write: notificationWrite } as unknown as NotificationOutboxWriter;
  const service = new AddendumWithdrawalService(prisma as unknown as PrismaService, new EventAccessPolicyService(audit), audit, notifications);
  return { service, addendum, execution, tx, auditWrite, notificationWrite };
}

describe('AddendumWithdrawalService', () => {
  it('closes a pending addendum with its reason, voids its conforme, and tells the client', async () => {
    const { service, addendum, execution, notificationWrite, auditWrite } = harness({ conforme: 'awaiting_pmcm' });

    const withdrawn = await service.withdraw('evt_1', 'addendum_1', withdrawInput, pmcm);

    expect(addendum).toMatchObject({ status: 'withdrawn', withdrawalReason: 'Venue cannot take the rig', withdrawnBy: 'PMCM Admin', withdrawnAt: new Date('2026-10-20T09:00:00.000Z') });
    expect(execution!.status).toBe('withdrawn');
    expect(withdrawn).toMatchObject({ status: 'withdrawn', withdrawalReason: 'Venue cannot take the rig', effectiveAt: null });
    expect(JSON.stringify(notificationWrite.mock.calls)).toContain('client@example.test');
    expect(JSON.stringify(notificationWrite.mock.calls)).toContain('Venue cannot take the rig');
    expect(auditWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'Withdrew addendum', metadata: expect.objectContaining({ reason: 'Venue cannot take the rig', commercialEffect: 'none' }) }), expect.anything());
  });

  it('closes a pending addendum that never reached conforme without notifying anyone', async () => {
    const { service, addendum, notificationWrite } = harness({ conforme: null });

    await service.withdraw('evt_1', 'addendum_1', withdrawInput, pmcm);

    expect(addendum.status).toBe('withdrawn');
    expect(notificationWrite).not.toHaveBeenCalled();
  });

  it('refuses to withdraw an effective addendum, whose commercial effect is already applied', async () => {
    const { service, addendum, notificationWrite } = harness({ status: 'effective', conforme: 'completed' });

    await expect(service.withdraw('evt_1', 'addendum_1', withdrawInput, pmcm)).rejects.toThrow('An effective addendum cannot be withdrawn');
    expect(addendum.status).toBe('effective');
    expect(notificationWrite).not.toHaveBeenCalled();
  });

  it('refuses a second withdrawal of the same addendum', async () => {
    const { service, addendum } = harness({ status: 'withdrawn', conforme: 'withdrawn' });

    await expect(service.withdraw('evt_1', 'addendum_1', withdrawInput, pmcm)).rejects.toBeInstanceOf(ConflictException);
    expect(addendum.withdrawalReason).toBeNull();
  });

  it('reports an unknown addendum on the event without writing anything', async () => {
    const { service, tx } = harness();
    tx.opsAddendum.findFirst.mockResolvedValueOnce(null as never);

    await expect(service.withdraw('evt_1', 'addendum_missing', withdrawInput, pmcm)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.opsAddendum.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['the client', OpsUserRole.Client],
    ['a supplier', OpsUserRole.Supplier],
    ['a coordinator', OpsUserRole.Coordinator],
    ['a guest', OpsUserRole.Guest],
    ['the system actor', OpsUserRole.System],
  ])('rejects withdrawal by %s without touching the addendum', async (_label, role) => {
    const { service, addendum, tx, notificationWrite } = harness();
    const who = { ...pmcm, id: 'someone', role, name: 'Someone' } satisfies ResolvedEventOpsActor;

    await expect(service.withdraw('evt_1', 'addendum_1', withdrawInput, who)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.opsAddendum.updateMany).not.toHaveBeenCalled();
    expect(addendum.status).toBe('pending');
    expect(notificationWrite).not.toHaveBeenCalled();
  });
});

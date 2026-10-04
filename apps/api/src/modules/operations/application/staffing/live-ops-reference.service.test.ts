import { describe, expect, it, vi } from 'vitest';
import { LiveOpsReferenceService } from './live-ops-reference.service';

const operatorAssignment = {
  id: 'assignment_1',
  eventId: 'event_1',
  coordinatorId: 'coordinator_1',
  coordinatorName: 'Historical Coordinator Name',
  role: 'Registration Staff',
  status: 'acknowledged',
};

function transactionContext(prisma: Record<string, unknown>) {
  return { prisma, actorId: 'pmcm_1', correlationId: 'live-ops-reference-test' } as never;
}

describe('LiveOpsReferenceService', () => {
  it('returns an eligible operator assignment using the caller transaction', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      opsCoordinator: { findUnique: vi.fn(async () => ({ id: 'coordinator_1', name: 'Coordinator One', active: true })) },
      opsCoordinatorAssignment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 'assignment_1' }])
          .mockResolvedValueOnce([operatorAssignment]),
      },
    };
    const rootCoordinatorRead = vi.fn();
    const service = new LiveOpsReferenceService({
      opsCoordinator: { findUnique: rootCoordinatorRead },
    } as never);

    await expect(service.findEligibleOperatorAssignment(
      'event_1', 'coordinator_1', transactionContext(tx),
    )).resolves.toEqual({ ...operatorAssignment, coordinatorName: 'Coordinator One' });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.opsCoordinator.findUnique).toHaveBeenCalledWith({
      where: { id: 'coordinator_1' },
      select: { id: true, name: true, active: true },
    });
    expect(tx.opsCoordinatorAssignment.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { eventId: 'event_1', coordinatorId: 'coordinator_1', status: { notIn: ['cancelled', 'replaced', 'declined'] } },
      select: { id: true },
    }));
    expect(tx.opsCoordinatorAssignment.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { eventId: 'event_1', coordinatorId: 'coordinator_1', status: { notIn: ['cancelled', 'replaced', 'declined'] } },
      select: { id: true, eventId: true, coordinatorId: true, coordinatorName: true, role: true, status: true },
    }));
    expect(rootCoordinatorRead).not.toHaveBeenCalled();
  });

  it('rejects an inactive profile before considering its assignments', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      opsCoordinator: { findUnique: vi.fn(async () => ({ id: 'coordinator_1', active: false })) },
      opsCoordinatorAssignment: { findMany: vi.fn() },
    };
    const service = new LiveOpsReferenceService({} as never);

    await expect(service.findEligibleOperatorAssignment(
      'event_1', 'coordinator_1', transactionContext(tx),
    )).resolves.toBeNull();

    expect(tx.opsCoordinatorAssignment.findMany).not.toHaveBeenCalled();
  });

  it('rechecks operator eligibility after locking candidates', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      opsCoordinator: { findUnique: vi.fn(async () => ({ id: 'coordinator_1', name: 'Coordinator One', active: true })) },
      opsCoordinatorAssignment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 'assignment_1' }])
          .mockResolvedValueOnce([]),
      },
    };
    const service = new LiveOpsReferenceService({} as never);

    await expect(service.findEligibleOperatorAssignment(
      'event_1', 'coordinator_1', transactionContext(tx),
    )).resolves.toBeNull();

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.opsCoordinatorAssignment.findMany).toHaveBeenCalledTimes(2);
  });

  it('returns handoff assignments only while both profiles and assignments remain eligible', async () => {
    const secondAssignment = { ...operatorAssignment, id: 'assignment_2', coordinatorId: 'coordinator_2', coordinatorName: 'Coordinator Two' };
    const tx = {
      $queryRaw: vi.fn(async () => []),
      opsCoordinator: {
        findMany: vi.fn(async () => [{ id: 'coordinator_1' }, { id: 'coordinator_2' }]),
      },
      opsCoordinatorAssignment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { id: 'assignment_1', coordinatorId: 'coordinator_1' },
            { id: 'assignment_2', coordinatorId: 'coordinator_2' },
          ])
          .mockResolvedValueOnce([operatorAssignment, secondAssignment]),
      },
    };
    const service = new LiveOpsReferenceService({} as never);

    await expect(service.findEligibleHandoffAssignments(
      'event_1', ['assignment_1', 'assignment_2'], transactionContext(tx),
    )).resolves.toEqual([operatorAssignment, secondAssignment]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.opsCoordinatorAssignment.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: { in: ['assignment_1', 'assignment_2'] }, eventId: 'event_1' },
    }));
    expect(tx.opsCoordinatorAssignment.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['assignment_1', 'assignment_2'] },
        eventId: 'event_1',
      }),
    }));
  });

  it('rejects a handoff when an assignment becomes ineligible or a coordinator is inactive', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      opsCoordinator: { findMany: vi.fn(async () => [{ id: 'coordinator_1' }]) },
      opsCoordinatorAssignment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { id: 'assignment_1', coordinatorId: 'coordinator_1' },
            { id: 'assignment_2', coordinatorId: 'coordinator_2' },
          ])
          .mockResolvedValueOnce([operatorAssignment]),
      },
    };
    const service = new LiveOpsReferenceService({} as never);

    await expect(service.findEligibleHandoffAssignments(
      'event_1', ['assignment_1', 'assignment_2'], transactionContext(tx),
    )).resolves.toEqual([]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('fails closed for duplicate handoff assignment IDs without querying Operations', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      opsCoordinator: { findMany: vi.fn() },
      opsCoordinatorAssignment: { findMany: vi.fn() },
    };
    const service = new LiveOpsReferenceService({} as never);

    await expect(service.findEligibleHandoffAssignments(
      'event_1', ['assignment_1', 'assignment_1'], transactionContext(tx),
    )).resolves.toEqual([]);

    expect(tx.opsCoordinatorAssignment.findMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
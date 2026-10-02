import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismaService } from '@prism/kernel/database';
import type { AuditWriter, EventAccessPolicyService } from '@prism/kernel/access-control';
import { SupplierIngressLateMonitorService } from './supplier-ingress-late-monitor.service';

const systemActor = {
  id: 'system:supplier-ingress-late-monitor',
  name: 'Supplier Ingress Monitor',
  email: 'system@prism.local',
  role: OpsUserRole.System,
  explicit: true,
  verified: true,
};

type TestRequest = {
  id: string;
  eventId: string;
  supplierName: string;
  status: string;
  assignmentStatus: string;
  eventDayStatus: string;
  eventDayStatusAt?: Date | null;
};

type TestSchedule = {
  id: string;
  eventId: string;
  requestId: string;
  ingressAt: Date;
  status: string;
  request: TestRequest;
};

function createMonitor(
  schedules: TestSchedule[],
  afterCandidateFetch?: () => void,
) {
  const auditWrite = vi.fn(async () => undefined);
  const requireActorRole = vi.fn(async () => undefined);
  const tx = {
    $queryRaw: vi.fn(async () => []),
    opsSupplierSchedule: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        schedules.find((schedule) => schedule.id === where.id) ?? null,
      ),
      findMany: vi.fn(),
    },
    opsSupplierQuoteRequest: {
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: string; eventDayStatus?: { in: string[] } };
        data: Record<string, unknown>;
      }) => {
        const request = schedules.find((schedule) => schedule.requestId === where.id)?.request;
        if (!request || (where.eventDayStatus?.in && !where.eventDayStatus.in.includes(request.eventDayStatus))) {
          return { count: 0 };
        }
        Object.assign(request, data);
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)),
  };
  tx.opsSupplierSchedule.findMany = vi.fn(async ({ where, take }: {
    where: { id?: { gt?: string }; status: string; ingressAt: { lte: Date } };
    take: number;
  }) => {
    const page = schedules
      .filter((schedule) => !where.id?.gt || schedule.id > where.id.gt)
      .filter((schedule) => schedule.status === where.status && schedule.ingressAt <= where.ingressAt.lte)
      .filter((schedule) =>
        ['not_started', 'planned'].includes(schedule.request.eventDayStatus) &&
        schedule.request.status === 'selected' &&
        schedule.request.assignmentStatus === 'confirmed',
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, take);
    afterCandidateFetch?.();
    return page;
  });
  const monitor = new SupplierIngressLateMonitorService(
    tx as unknown as PrismaService,
    { write: auditWrite } as unknown as AuditWriter,
    { requireActorRole } as unknown as EventAccessPolicyService,
  );
  return { monitor, tx, auditWrite, requireActorRole };
}

function schedule(
  id: string,
  ingressAt: Date,
  eventDayStatus = 'not_started',
  scheduleStatus = 'planned',
) {
  return {
    id,
    eventId: 'evt_1',
    requestId: `request_${id}`,
    ingressAt,
    status: scheduleStatus,
    request: {
      id: `request_${id}`,
      eventId: 'evt_1',
      supplierName: `Supplier ${id}`,
      status: 'selected',
      assignmentStatus: 'confirmed',
      eventDayStatus,
    },
  };
}

describe('SupplierIngressLateMonitorService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('flags only planned, unreported suppliers at or beyond the 15-minute grace period', async () => {
    const now = new Date('2026-10-02T10:15:00.000Z');
    vi.stubEnv('PRISM_SUPPLIER_INGRESS_LATE_GRACE_MINUTES', '15');
    const due = schedule('due', new Date('2026-10-02T10:00:00.000Z'));
    const justEarly = schedule('early', new Date('2026-10-02T10:01:00.000Z'));
    const arrived = schedule('arrived', new Date('2026-10-02T09:00:00.000Z'), 'arrived');
    const rescheduled = schedule('rescheduled', new Date('2026-10-02T09:00:00.000Z'), 'not_started', 'cancelled');
    const { monitor, tx, auditWrite, requireActorRole } = createMonitor([due, justEarly, arrived, rescheduled]);

    const result = await monitor.markLateSupplierIngresses(systemActor, now);

    expect(result).toEqual({ graceMinutes: 15, marked: 1 });
    expect(due.request).toMatchObject({
      eventDayStatus: 'late',
      eventDayStatusAt: now,
    });
    expect(justEarly.request.eventDayStatus).toBe('not_started');
    expect(arrived.request.eventDayStatus).toBe('arrived');
    expect(rescheduled.request.eventDayStatus).toBe('not_started');
    expect(requireActorRole).toHaveBeenCalledWith(systemActor, [OpsUserRole.System], 'supplier ingress late monitor');
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_1',
        actor: systemActor.name,
        action: 'Supplier ingress late: Supplier due',
        affectedId: 'request_due',
        metadata: expect.objectContaining({ ingressAt: '2026-10-02T10:00:00.000Z', graceMinutes: 15 }),
      }),
      expect.objectContaining({ prisma: tx, actorId: systemActor.id }),
    );
  });

  it('does not overwrite an arrival reported after the candidate scan', async () => {
    const now = new Date('2026-10-02T10:15:00.000Z');
    const candidate = schedule('race', new Date('2026-10-02T09:00:00.000Z'));
    const { monitor, tx, auditWrite } = createMonitor([candidate], () => {
      candidate.request.eventDayStatus = 'arrived';
    });

    const result = await monitor.markLateSupplierIngresses(systemActor, now);

    expect(result.marked).toBe(0);
    expect(candidate.request.eventDayStatus).toBe('arrived');
    expect(tx.opsSupplierQuoteRequest.updateMany).not.toHaveBeenCalled();
    expect(auditWrite).not.toHaveBeenCalled();
  });

  it('caps each run at two keyset pages so sustained inserts cannot extend one scheduler tick', async () => {
    const now = new Date('2026-10-02T10:15:00.000Z');
    const schedules = Array.from({ length: 1201 }, (_, index) =>
      schedule(`schedule_${String(index).padStart(3, '0')}`, new Date('2026-10-02T09:00:00.000Z')),
    );
    const { monitor, tx } = createMonitor(schedules);

    const result = await monitor.markLateSupplierIngresses(systemActor, now);

    expect(result.marked).toBe(1000);
    expect(tx.opsSupplierSchedule.findMany).toHaveBeenCalledTimes(2);
    expect(schedules.filter((item) => item.request.eventDayStatus === 'late')).toHaveLength(1000);
    expect(schedules.filter((item) => item.request.eventDayStatus === 'not_started')).toHaveLength(201);
  });
});

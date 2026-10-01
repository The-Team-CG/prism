import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { describe, expect, it, vi } from 'vitest';
import { OcularVisitService } from './ocular-visit.service';

const eventId = 'evt_ocular_visit';
const requestedAt = new Date('2026-10-01T08:00:00.000Z');
const scheduledAt = new Date('2026-10-05T01:00:00.000Z');
const client = {
  id: 'client_1',
  role: OpsUserRole.Client,
  name: 'Client One',
  email: 'client@example.test',
  explicit: true,
  verified: true,
};
const admin = {
  id: 'pmcm_1',
  role: OpsUserRole.PmcmAdmin,
  name: 'Maxine',
  email: 'maxine@pmcm.test',
  explicit: true,
  verified: true,
};

function createService(options: { signedAt?: Date | null; locked?: boolean; email?: string; record?: Record<string, unknown> | null } = {}) {
  const event = {
    id: eventId,
    clientName: 'Client One',
    eventName: 'Launch event',
    eventDate: new Date('2026-10-20T00:00:00.000Z'),
    archived: false,
    clientPortalStatus: options.locked ? 'locked' : 'unlocked',
    inquiry: {
      email: options.email ?? 'client@example.test',
      conformeSignedAt: options.signedAt === undefined ? new Date('2026-09-30T08:00:00.000Z') : options.signedAt,
    },
  };
  const state: { record: Record<string, unknown> | null } = { record: options.record ?? null };
  const prisma: Record<string, any> = {};
  prisma.opsEvent = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === eventId ? event : null)),
  };
  prisma.opsOcularVisitRequest = {
    findUnique: vi.fn(async () => state.record),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      state.record = { id: 'ovr_1', ...data };
      return state.record;
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      state.record = { ...state.record, ...data };
      return state.record;
    }),
  };
  prisma.$transaction = vi.fn(async (callback: (tx: Record<string, any>) => unknown) => callback(prisma));
  const audit = { write: vi.fn(async () => undefined) };
  const notifications = { write: vi.fn(async () => undefined) };
  const accessPolicy = new EventAccessPolicyService(audit as never);
  const service = new OcularVisitService(prisma as never, accessPolicy, audit as never, notifications as never);
  return { service, prisma, state, audit, notifications };
}

describe('OcularVisitService', () => {
  it('rejects submission before signed conforme', async () => {
    const { service, prisma } = createService({ signedAt: null });

    await expect(service.submitClientRequest(eventId, { clientNote: 'Need to visit' }, client as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsOcularVisitRequest.create).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'locked event', options: { locked: true } },
    { name: 'different assigned email', options: { email: 'other@example.test' } },
  ])('rejects client access for a $name', async ({ options }) => {
    const { service, prisma } = createService(options);

    await expect(service.submitClientRequest(eventId, {}, client as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsOcularVisitRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate client request', async () => {
    const { service, prisma } = createService({
      record: { id: 'ovr_existing', eventId, status: 'requested', requestedAt },
    });

    await expect(service.submitClientRequest(eventId, {}, client as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsOcularVisitRequest.create).not.toHaveBeenCalled();
  });

  it('creates the requested PMCM task for an assigned client', async () => {
    const { service, prisma, audit } = createService();

    await service.submitClientRequest(eventId, { clientNote: 'Check access before booking' }, client as never);

    expect(prisma.opsOcularVisitRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId,
        status: 'requested',
        clientNote: 'Check access before booking',
        requestedAt: expect.any(Date),
      }),
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ eventId, actor: 'Client One', affectedType: 'ocular_visit_request' }),
      expect.objectContaining({ prisma }),
    );
  });

  it('schedules the visit and queues one client notification in the transaction', async () => {
    const { service, prisma, state, notifications, audit } = createService({
      record: { id: 'ovr_1', eventId, status: 'requested', clientNote: null, requestedAt },
    });

    await service.scheduleOcularVisit(eventId, { scheduledAt: '2026-10-05T09:00:00+08:00' }, admin as never);

    expect(state.record).toMatchObject({ status: 'scheduled', scheduledAt });
    expect(notifications.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        recipient: 'client@example.test',
        channel: 'email',
        idempotencyKey: 'ocular-visit-scheduled:ovr_1',
      }),
      expect.objectContaining({ prisma }),
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'Maxine', affectedId: 'ovr_1' }),
      expect.objectContaining({ prisma }),
    );
  });

  it('rejects completion before scheduling', async () => {
    const { service, state } = createService({
      record: { id: 'ovr_1', eventId, status: 'requested', requestedAt },
    });

    await expect(service.completeOcularVisit(eventId, admin as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.record?.status).toBe('requested');
  });

  it('completes a scheduled visit', async () => {
    const { service, prisma, state, audit } = createService({
      record: { id: 'ovr_1', eventId, status: 'scheduled', scheduledAt },
    });

    await service.completeOcularVisit(eventId, admin as never);

    expect(state.record).toMatchObject({ status: 'completed', completedAt: expect.any(Date) });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Completed ocular visit', actorRole: OpsUserRole.PmcmAdmin }),
      expect.objectContaining({ prisma }),
    );
  });

  it('waives without a prior request and audits the required reason', async () => {
    const { service, prisma, state, audit } = createService();

    await service.waiveOcularVisit(eventId, { reason: 'Site plan already confirmed' }, admin as never);

    expect(prisma.opsOcularVisitRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId,
        status: 'waived',
        requestedAt: null,
        waiverReason: 'Site plan already confirmed',
        waivedBy: 'Maxine',
      }),
    });
    expect(state.record).toMatchObject({ status: 'waived', waiverReason: 'Site plan already confirmed' });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Waived ocular visit',
        metadata: expect.objectContaining({ reason: 'Site plan already confirmed' }),
      }),
      expect.objectContaining({ prisma }),
    );
  });

  it.each([
    { state: 'completed', action: 'waiver' },
    { state: 'waived', action: 'completion' },
  ])('rejects terminal state transition from $state', async ({ state, action }) => {
    const { service, prisma } = createService({
      record: { id: 'ovr_1', eventId, status: state, requestedAt, scheduledAt },
    });

    const transition = action === 'waiver'
      ? service.waiveOcularVisit(eventId, { reason: 'Change in plan' }, admin as never)
      : service.completeOcularVisit(eventId, admin as never);

    await expect(transition).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsOcularVisitRequest.update).not.toHaveBeenCalled();
  });
});

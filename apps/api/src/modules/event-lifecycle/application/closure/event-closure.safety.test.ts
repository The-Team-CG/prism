import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventLifecycleService, WorkflowCommandService } from '@prism/kernel/event-core';
import { EventClosureService } from './event-closure.service';

function harness() {
  const state = { event: { id: 'event_1', inquiryId: 'inquiry_1', clientName: 'Client', archived: false, status: 'event_day', floorPlanStatus: 'approved', clientPortalStatus: 'unlocked' } };
  const failures = { audit: false, notification: false };
  const gates = { ready: false, missingKeys: ['logistics'], gates: [{ key: 'logistics', passed: false }] };
  const fileMatrix = { closeGates: vi.fn(async () => gates) };
  const audit = { write: vi.fn(async () => { if (failures.audit) throw new Error('Audit failed'); }) };
  const notification = {
    write: vi.fn(async () => { if (failures.notification) throw new Error('Outbox failed'); }),
    writeGuestPassDelivery: vi.fn(async () => ({ notificationId: 'not_test', status: 'queued' as const })),
    retryGuestPassDelivery: vi.fn(async () => undefined),
    cancelGuestPassDelivery: vi.fn(async () => undefined),
  };
  const eventModel = (draft: typeof state) => ({
    findUnique: vi.fn(async () => draft.event),
    update: vi.fn(async ({ data }: { data: Partial<typeof state.event> }) => { Object.assign(draft.event, data); return draft.event; }),
  });
  const foreignDocument = { id: 'doc_other', eventId: 'event_2', title: 'Completion report', status: 'pending' };
  const inquiries = { findUnique: vi.fn(async () => ({ email: 'client@example.test' })) };
  const documents = {
    update: vi.fn(async ({ where }: { where: { id: string; eventId?: string } }) => {
      if (where.eventId && where.eventId !== foreignDocument.eventId) throw new Error('Not found');
      foreignDocument.status = 'submitted'; return foreignDocument;
    }),
  };
  const prisma = {
    opsEvent: eventModel(state), opsPostEventDocument: documents, opsInquiry: inquiries,
    $transaction: vi.fn(async <T>(work: (tx: { opsEvent: ReturnType<typeof eventModel>; opsPostEventDocument: typeof documents; opsInquiry: typeof inquiries }) => Promise<T>) => {
      const draft = structuredClone(state);
      const result = await work({ opsEvent: eventModel(draft), opsPostEventDocument: documents, opsInquiry: inquiries });
      state.event = draft.event; return result;
    }),
  };
  const access = {
    resolveActor: (input: { actorRole?: string; actorName?: string }) => ({ role: input.actorRole ?? 'unknown', name: input.actorName ?? 'Verified PMCM', email: 'pmcm@example.test' }),
    requireActorRole: vi.fn(async (actor: { role: string }) => { if (actor.role !== 'pmcm-admin') throw new ForbiddenException(); }),
  };
  const guestQrPassLifecycleOwner = { expireEventGuestQrPasses: vi.fn(async () => undefined) };
  const service = new EventClosureService(prisma as never, fileMatrix as never, new EventLifecycleService(), audit, access as never, notification, new WorkflowCommandService(), { getLifecycleFacts: vi.fn() } as never, { getClosureFacts: vi.fn() } as never, guestQrPassLifecycleOwner as never);
  return { service, prisma, state, failures, fileMatrix, audit, notification, guestQrPassLifecycleOwner, foreignDocument };
}

describe('archive command safety', () => {
  it('rejects missing gates and whitespace-only overrides without mutation', async () => {
    const { service, state } = harness();
    await expect(service.archiveEvent('event_1', { actorRole: 'pmcm-admin', overrideReason: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(state.event.archived).toBe(false);
  });

  it.each(['audit', 'notification'] as const)('does not archive when %s persistence fails', async failure => {
    const { service, state, failures } = harness();
    failures[failure] = true;
    await expect(service.archiveEvent('event_1', { actorRole: 'pmcm-admin', overrideReason: 'Asset returns verified offline' })).rejects.toThrow(/failed/);
    expect(state.event.archived).toBe(false);
    expect(state.event.status).toBe('event_day');
  });

  it('records the exact failed gates, actor and reason in the archive transaction', async () => {
    const { service, prisma, fileMatrix, audit, notification, guestQrPassLifecycleOwner } = harness();
    const saved = await service.archiveEvent('event_1', { actorRole: 'pmcm-admin', actorName: 'Verified PMCM', overrideReason: ' Asset returns verified offline ' });
    expect(saved).toMatchObject({ archived: true, archiveOverrideReason: 'Asset returns verified offline', archiveOverrideBy: 'Verified PMCM' });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(fileMatrix.closeGates).toHaveBeenCalledOnce();
    expect(fileMatrix.closeGates).toHaveBeenCalledWith('event_1', expect.objectContaining({ opsEvent: expect.anything() }));
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ actor: 'Verified PMCM', actorRole: 'pmcm-admin', metadata: expect.objectContaining({ missingKeys: ['logistics'] }) }), expect.objectContaining({ prisma: expect.anything() }));
    expect(notification.write).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ prisma: expect.anything() }));
    expect(guestQrPassLifecycleOwner.expireEventGuestQrPasses).toHaveBeenCalledWith('event_1', 'event-archived', expect.objectContaining({ prisma: expect.anything() }));
  });

  it('cannot skip planning even with an override', async () => {
    const { service, state } = harness(); state.event.status = 'planning';
    await expect(service.archiveEvent('event_1', { actorRole: 'pmcm-admin', overrideReason: 'Override' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids client archive', async () => {
    const { service, state } = harness();
    await expect(service.archiveEvent('event_1', { actorRole: 'client', overrideReason: 'Override' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.event.archived).toBe(false);
  });

  it('cannot complete another event document through the selected event', async () => {
    const { service, foreignDocument } = harness();
    await expect(service.completePostEventDocument('event_1', 'doc_other', { role: 'pmcm-admin', name: 'Verified PMCM', explicit: true })).rejects.toThrow(/not found/i);
    expect(foreignDocument.status).toBe('pending');
  });
  it('denies deliverable completion without an actor', async () => {
    const { service, foreignDocument } = harness();
    await expect(service.completePostEventDocument('event_1', 'doc_other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(foreignDocument.status).toBe('pending');
  });
});

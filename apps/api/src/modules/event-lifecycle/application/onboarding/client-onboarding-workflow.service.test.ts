import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { ClientOnboardingWorkflowService } from './client-onboarding-workflow.service';
import { OcularVisitService } from '../ocular-visit/ocular-visit.service';

function createService() {
  const event = { id: 'evt_onboarding', status: 'briefing', readiness: 'Client briefing open', archived: false, clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.test' } };
  const briefings: any[] = [];
  const ocularRequests: any[] = [];
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
    opsOcularVisitRequest: {
      findUnique: vi.fn(async () => ocularRequests[0] ?? null),
      create: vi.fn(async ({ data }) => {
        ocularRequests.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
  const access = { requireActorRole: vi.fn(async () => undefined), requireCanReadEvent: vi.fn(async () => undefined) };
  const ocularVisitService = new OcularVisitService(prisma as any, access as any, auditWriter as any, notificationOutboxWriter as any);
  const service = new ClientOnboardingWorkflowService(
    prisma as any,
    auditWriter as any,
    notificationOutboxWriter as any,
    new WorkflowCommandService(),
    ocularVisitService,
    access as any,
  );
  return { service, event, briefings, ocularRequests, auditWriter, notificationOutboxWriter, prisma };
}

describe('ClientOnboardingWorkflowService', () => {
  it('preserves client briefing history and advances event readiness with atomic audit/outbox', async () => {
    const { service, event, briefings, auditWriter, notificationOutboxWriter } = createService();

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
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_onboarding',
        actor: 'System',
        action: 'Submitted client briefing',
        affectedType: 'briefing',
      }),
      expect.objectContaining({ prisma: expect.anything(), correlationId: briefing.id }),
    );
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_onboarding',
        recipient: 'PMCM Admin',
        message: 'Client briefing submitted',
      }),
      expect.objectContaining({ prisma: expect.anything(), correlationId: briefing.id }),
    );
  });
  const input = { venue: 'Venue', guestCount: 100, budgetRange: '100000', serviceRequirements: ['stage'], notes: '' };
  it('keeps prior submissions when the client submits again', async () => {
    const { service, briefings, prisma } = createService();
    await service.submitBriefing('evt_onboarding', input);
    await service.submitBriefing('evt_onboarding', { ...input, venue: 'Updated venue' });
    expect(briefings).toHaveLength(2);
    expect(prisma.opsBriefing.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['event_day', 'closure_archive', 'archived'])('rejects a submission during %s', async (status) => {
    const { service, event, briefings, auditWriter } = createService();
    event.status = status;
    await expect(service.submitBriefing('evt_onboarding', input)).rejects.toThrow(/before event day/);
    expect(briefings).toHaveLength(0);
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
  const primaryClient = { id: 'client-1', role: OpsUserRole.Client, email: 'client@example.test', name: 'Client' } as any;
  const pmcm = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, email: 'pmcm@example.test', name: 'PMCM' } as any;
  it('opens one venue ocular task when the primary client submits venue details and leaves it alone on resubmission', async () => {
    const { service, ocularRequests } = createService();
    await service.submitBriefing('evt_onboarding', input, primaryClient);
    await service.submitBriefing('evt_onboarding', { ...input, venue: 'Other venue' }, primaryClient);
    expect(ocularRequests).toHaveLength(1);
    expect(ocularRequests[0]).toMatchObject({ eventId: 'evt_onboarding', status: 'requested' });
    expect(ocularRequests[0].requestedAt).toBeInstanceOf(Date);
  });
  it('confirms the styling budget only when the primary client submits it, and opens no ocular task for PMCM-entered briefings', async () => {
    const { service, briefings, ocularRequests } = createService();
    await service.submitBriefing('evt_onboarding', { ...input, stylingBudget: 80000 }, pmcm);
    expect(briefings[0].stylingBudgetConfirmedAt).toBeNull();
    expect(ocularRequests).toHaveLength(0);
    await service.submitBriefing('evt_onboarding', { ...input, stylingBudget: 80000 }, primaryClient);
    expect(briefings[1].stylingBudgetConfirmedAt).toBeInstanceOf(Date);
    await service.submitBriefing('evt_onboarding', { ...input }, primaryClient);
    expect(briefings[2].stylingBudgetConfirmedAt).toBeNull();
  });
  it('rejects a locked portal even when its event status is planning', async () => {
    const { service, event } = createService();
    event.clientPortalStatus = 'locked';
    event.status = 'planning';
    await expect(service.submitBriefing('evt_onboarding', input)).rejects.toThrow(/unlocked/);
  });
});

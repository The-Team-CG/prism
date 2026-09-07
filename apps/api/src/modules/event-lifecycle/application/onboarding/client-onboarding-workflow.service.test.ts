import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { ClientOnboardingWorkflowService } from './client-onboarding-workflow.service';

function createService() {
  const event = { id: 'evt_onboarding', status: 'briefing', readiness: 'Client briefing open', archived: false, clientPortalStatus: 'unlocked' };
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
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
  const service = new ClientOnboardingWorkflowService(
    prisma as any,
    auditWriter as any,
    notificationOutboxWriter as any,
    new WorkflowCommandService(),
  );
  return { service, event, briefings, auditWriter, notificationOutboxWriter, prisma };
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
  it('rejects a locked portal even when its event status is planning', async () => {
    const { service, event } = createService();
    event.clientPortalStatus = 'locked';
    event.status = 'planning';
    await expect(service.submitBriefing('evt_onboarding', input)).rejects.toThrow(/unlocked/);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { ClientOnboardingWorkflowService } from './client-onboarding-workflow.service';

function createService() {
  const event = { id: 'evt_onboarding', status: 'briefing', readiness: 'Client briefing open' };
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
  return { service, event, briefings, auditWriter, notificationOutboxWriter };
}

describe('ClientOnboardingWorkflowService', () => {
  it('replaces the client briefing and advances event readiness', async () => {
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
        actor: 'Client',
        action: 'Submitted client briefing',
        affectedType: 'briefing',
      }),
      undefined,
    );
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_onboarding',
        recipient: 'PMCM Admin',
        message: 'Client briefing submitted',
      }),
      undefined,
    );
  });
});

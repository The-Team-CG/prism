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
  const auditService = { audit: vi.fn(async () => undefined) };
  const notificationOutboxService = { queue: vi.fn(async () => undefined) };
  const service = new ClientOnboardingWorkflowService(
    prisma as any,
    auditService as any,
    notificationOutboxService as any,
    new WorkflowCommandService(),
  );
  return { service, event, briefings, auditService, notificationOutboxService };
}

describe('ClientOnboardingWorkflowService', () => {
  it('replaces the client briefing and advances event readiness', async () => {
    const { service, event, briefings, auditService, notificationOutboxService } = createService();

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
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_onboarding',
      'Client',
      'Submitted client briefing',
      expect.objectContaining({ affectedType: 'briefing' }),
    );
    expect(notificationOutboxService.queue).toHaveBeenCalledWith(
      'evt_onboarding',
      'PMCM Admin',
      'Client briefing submitted',
    );
  });
});
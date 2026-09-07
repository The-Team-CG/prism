import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsEventBriefingController } from './event-briefing.controller';
import { EventSessionGuard } from '@prism/kernel/event-session';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsEventBriefingController', () => {
  it('requires a verified event session for briefing writes', () => {
    expect(Reflect.getMetadata('__guards__', OpsEventBriefingController.prototype.submitBriefing)).toContain(EventSessionGuard);
  });
  it('keeps event briefing routes under the events route base', () => {
    expect(controllerPath(OpsEventBriefingController)).toBe('events');
  });

  it('serves client briefing submission through InquiryOnboarding with the legacy response shape', async () => {
    const briefing = {
      eventId: 'evt_sample',
      venue: 'Ayala Hall',
      guestCount: 180,
      budgetRange: 'PHP 500k-700k',
      serviceRequirements: ['Registration', 'Supplier coordination'],
      notes: 'Client prefers PM ingress support.',
      submittedAt: new Date('2026-06-20T08:00:00.000Z'),
    };
    const clientOnboardingWorkflowService = {
      submitBriefing: vi.fn(async () => briefing),
    };
    const controller = new OpsEventBriefingController(clientOnboardingWorkflowService as any, { resolveActor: vi.fn() } as any);
    const dto = {
      venue: 'Ayala Hall',
      guestCount: 180,
      budgetRange: 'PHP 500k-700k',
      serviceRequirements: ['Registration', 'Supplier coordination'],
      notes: 'Client prefers PM ingress support.',
    };

    await expect(controller.submitBriefing('evt_sample', dto)).resolves.toEqual({
      eventId: 'evt_sample',
      venue: 'Ayala Hall',
      guestCount: 180,
      budgetRange: 'PHP 500k-700k',
      serviceRequirements: ['Registration', 'Supplier coordination'],
      notes: 'Client prefers PM ingress support.',
      submittedAt: '2026-06-20T08:00:00.000Z',
    });
    expect(clientOnboardingWorkflowService.submitBriefing).toHaveBeenCalledWith('evt_sample', dto);
  });
});

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OpsGuestController } from './guest.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsGuestController', () => {
  it('keeps the public guest route base stable under guest-ops ownership', () => {
    expect(controllerPath(OpsGuestController)).toBe('guest');
  });

  it('serves guest event, check-in, and feedback routes through GuestWorkflowService', async () => {
    const guestWorkflowService = {
      getEventByAccessCode: vi.fn(async () => ({ id: 'evt_sample', eventName: 'Ayala Summit' })),
      countCheckInsForEvent: vi.fn(async () => 2),
      mapGuestEvent: vi.fn((event, attendanceCount) => ({ id: event.id, attendanceCount })),
      checkInByAccessCode: vi.fn(async () => ({ id: 'gci_1', guestName: 'Sofia Lim' })),
      mapGuestCheckIn: vi.fn((checkIn) => ({ id: checkIn.id, guestName: checkIn.guestName })),
      submitFeedbackByAccessCode: vi.fn(async () => ({ id: 'gfb_1', guestName: 'Sofia Lim' })),
      mapGuestFeedback: vi.fn((feedback) => ({ id: feedback.id, guestName: feedback.guestName })),
    };
  const controller = new OpsGuestController(guestWorkflowService as any, { resolveActor: vi.fn(() => ({ role: OpsUserRole.PmcmAdmin, name: 'Maxine' })), requireActorRole: vi.fn(async () => undefined) } as any);

    await expect(controller.eventByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({ id: 'evt_sample', attendanceCount: 2 });
    await expect(controller.checkIn('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', privacyConsentAccepted: true })).resolves.toEqual({ id: 'gci_1', guestName: 'Sofia Lim' });
    await expect(controller.submitFeedback('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5, privacyConsentAccepted: true })).resolves.toEqual({ id: 'gfb_1', guestName: 'Sofia Lim' });
    expect(guestWorkflowService.getEventByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE');
    expect(guestWorkflowService.countCheckInsForEvent).toHaveBeenCalledWith('evt_sample');
    expect(guestWorkflowService.checkInByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', privacyConsentAccepted: true });
    expect(guestWorkflowService.submitFeedbackByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5, privacyConsentAccepted: true });
  });
});

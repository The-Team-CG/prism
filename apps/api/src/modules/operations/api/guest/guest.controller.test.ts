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
      getEventWatermarkByAccessCode: vi.fn(async () => ({ watermark: '2026-06-01T00:00:00.000Z:2' })),
      countCheckInsForEvent: vi.fn(async () => 2),
      mapGuestEvent: vi.fn((event, attendanceCount) => ({ id: event.id, attendanceCount })),
      checkInByAccessCode: vi.fn(async () => ({ id: 'gci_1', guestName: 'Sofia Lim' })),
      mapGuestCheckIn: vi.fn((checkIn) => ({ id: checkIn.id, guestName: checkIn.guestName })),
      submitFeedbackByAccessCode: vi.fn(async () => ({ id: 'gfb_1', guestName: 'Sofia Lim' })),
      mapGuestFeedback: vi.fn((feedback) => ({ id: feedback.id, guestName: feedback.guestName })),
    };
  const controller = new OpsGuestController(guestWorkflowService as any, { resolveActor: vi.fn(() => ({ role: OpsUserRole.PmcmAdmin, name: 'Maxine' })), requireActorRole: vi.fn(async () => undefined) } as any);

    await expect(controller.eventByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({ id: 'evt_sample', attendanceCount: 2 });
    await expect(controller.eventWatermarkByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({ watermark: '2026-06-01T00:00:00.000Z:2' });
    await expect(controller.checkIn('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', privacyConsentAccepted: true })).resolves.toEqual({ id: 'gci_1', guestName: 'Sofia Lim' });
    await expect(controller.submitFeedback('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5, privacyConsentAccepted: true })).resolves.toEqual({ id: 'gfb_1', guestName: 'Sofia Lim' });
    expect(guestWorkflowService.getEventByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE');
    expect(guestWorkflowService.getEventWatermarkByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE');
    expect(guestWorkflowService.countCheckInsForEvent).toHaveBeenCalledWith('evt_sample');
    expect(guestWorkflowService.checkInByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', privacyConsentAccepted: true });
    expect(guestWorkflowService.submitFeedbackByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5, privacyConsentAccepted: true });
  });

  it('forbids non-PMCM actors from moderation mutations', async () => {
    const guestWorkflowService = { moderateFeedback: vi.fn() };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => ({ role: 'coordinator', name: 'Coordinator' })),
      requireActorRole: vi.fn(async () => { throw new Error('forbidden'); }),
    };
    const controller = new OpsGuestController(guestWorkflowService as any, eventAccessPolicyService as any);
    await expect(controller.moderateFeedback('evt_sample', 'gfb_1', { action: 'approve' }, { actorId: 'coord-1' } as any)).rejects.toThrow('forbidden');
    expect(guestWorkflowService.moderateFeedback).not.toHaveBeenCalled();
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'coordinator' }),
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'guest feedback moderation',
      'evt_sample',
    );
  });

  it('uses the reduced roster projection for coordinator searches', async () => {
    const actor = { id: 'usr_coord', email: 'reg@example.test', name: 'Registration Staff', role: OpsUserRole.Coordinator };
    const guestWorkflowService = {
      searchCoordinatorRoster: vi.fn(async () => [{ id: 'gre_1', guestName: 'Mia Santos' }]),
      searchRoster: vi.fn(),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsGuestController(guestWorkflowService as any, eventAccessPolicyService as any);

    await expect(controller.searchRosterWithFilters('evt_1', 'Mia', '', undefined, undefined, {} as any)).resolves.toEqual([
      { id: 'gre_1', guestName: 'Mia Santos' },
    ]);

    expect(guestWorkflowService.searchCoordinatorRoster).toHaveBeenCalledWith('evt_1', actor, {
      query: 'Mia', namePrefix: '', eligibility: undefined, checkedIn: undefined,
    });
    expect(guestWorkflowService.searchRoster).not.toHaveBeenCalled();
  });

  it('exposes the event-id walk-in route only to coordinator actors and records through the workflow service', async () => {
    const actor = { id: 'usr_coord', email: 'reg@example.test', name: 'Registration Staff', role: OpsUserRole.Coordinator };
    const guestWorkflowService = {
      registerWalkIn: vi.fn(async () => ({ id: 'gre_1', eventId: 'evt_1', guestName: 'Walk-In', walkIn: true })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsGuestController(guestWorkflowService as any, eventAccessPolicyService as any);
    const input = { guestName: 'Walk-In', privacyConsentAccepted: true } as const;

    await expect(controller.registerWalkIn('evt_1', input, {} as any)).resolves.toEqual({ id: 'gre_1', eventId: 'evt_1', guestName: 'Walk-In', walkIn: true });
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      actor,
      [OpsUserRole.Coordinator],
      'coordinator walk-in registration',
      'evt_1',
    );
    expect(guestWorkflowService.registerWalkIn).toHaveBeenCalledWith('evt_1', input, actor);
  });
});

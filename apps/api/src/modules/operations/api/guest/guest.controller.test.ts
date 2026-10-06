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
    const checkInInput = {
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      checkInMode: 'name_search' as const,
      guestName: 'Sofia Lim',
      privacyConsentAccepted: true as const,
    };
    const guestWorkflowService = {
      getEventByAccessCode: vi.fn(async () => ({ id: 'evt_sample', eventName: 'Ayala Summit' })),
      getEventWatermarkByAccessCode: vi.fn(async () => ({ watermark: '2026-06-01T00:00:00.000Z' })),
      countCheckInsForEvent: vi.fn(async () => 2),
      mapGuestEvent: vi.fn((event) => ({ id: event.id })),
      checkInByAccessCode: vi.fn(async () => ({ accepted: true })),
      submitFeedbackByAccessCode: vi.fn(async () => ({
        id: 'gfb_1',
        eventId: 'evt_sample',
        submittedAt: '2026-06-18T10:00:00.000Z',
      })),
    };
  const controller = new OpsGuestController(guestWorkflowService as any, { resolveActor: vi.fn(() => ({ role: OpsUserRole.PmcmAdmin, name: 'Maxine' })), requireActorRole: vi.fn(async () => undefined) } as any);

    await expect(controller.eventByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({ id: 'evt_sample' });
    await expect(controller.eventWatermarkByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({ watermark: '2026-06-01T00:00:00.000Z' });
    await expect(controller.checkIn('AYALA-TECH-MPLE', checkInInput)).resolves.toEqual({ accepted: true });
    const feedbackReceipt = await controller.submitFeedback('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5, privacyConsentAccepted: true });
    expect(feedbackReceipt).toEqual({
      id: 'gfb_1',
      eventId: 'evt_sample',
      submittedAt: '2026-06-18T10:00:00.000Z',
    });
    expect(feedbackReceipt).not.toHaveProperty('moderationStatus');
    expect(feedbackReceipt).not.toHaveProperty('moderationReason');
    expect(feedbackReceipt).not.toHaveProperty('privacyConsentAccepted');
    expect(feedbackReceipt).not.toHaveProperty('mediaAttachments');
    expect(guestWorkflowService.getEventByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE');
    expect(guestWorkflowService.getEventWatermarkByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE');
    expect(guestWorkflowService.countCheckInsForEvent).not.toHaveBeenCalled();
    expect(guestWorkflowService.checkInByAccessCode).toHaveBeenCalledWith('AYALA-TECH-MPLE', checkInInput);
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

    await expect(controller.searchRosterWithFilters('evt_1', 'Mia', '', undefined, undefined, 'true', {} as any)).resolves.toEqual([
      { id: 'gre_1', guestName: 'Mia Santos' },
    ]);

    expect(guestWorkflowService.searchCoordinatorRoster).toHaveBeenCalledWith('evt_1', actor, {
      query: 'Mia', namePrefix: '', eligibility: undefined, checkedIn: undefined, reviewQueue: true,
    });
    expect(guestWorkflowService.searchRoster).not.toHaveBeenCalled();
  });

  it('rejects malformed review queue filters', async () => {
    const actor = { id: 'usr_coord', name: 'Registration Staff', role: OpsUserRole.Coordinator };
    const guestWorkflowService = { searchCoordinatorRoster: vi.fn(), searchRoster: vi.fn() };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsGuestController(guestWorkflowService as any, eventAccessPolicyService as any);

    await expect(controller.searchRosterWithFilters('evt_1', undefined, undefined, undefined, undefined, 'yes', {} as any))
      .rejects.toThrow('Invalid guest review queue filter');
    expect(guestWorkflowService.searchCoordinatorRoster).not.toHaveBeenCalled();
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

import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsEventClosureController } from './event-closure.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const event = {
    id: 'evt_sample',
    inquiryId: 'inq_sample',
    clientName: 'Ana Reyes',
    eventName: 'Sample Gala',
    eventDate: new Date('2026-07-20T00:00:00.000Z'),
    status: 'archived',
    clientPortalStatus: 'unlocked',
    readiness: 'Closed',
    archived: true,
    floorPlanStatus: 'approved',
    floorPlanId: 'fp_main',
  };
  const document = { id: 'post_1', eventId: 'evt_sample', title: 'Feedback', status: 'submitted' };
  const insight = {
    id: 'ins_1',
    eventId: 'evt_sample',
    summary: 'Closed cleanly',
    highlights: ['Paid'],
    risks: [],
    supplierNotes: [],
    financialSummary: { totalBilled: 100000 },
    documentSummary: { total: 2 },
    feedbackSummary: { supplierReviews: 1 },
    privateNotes: 'PMCM-only',
    generatedAt: new Date('2026-07-21T00:00:00.000Z'),
    updatedAt: new Date('2026-07-21T01:00:00.000Z'),
  };
  const eventClosureService = {
    completePostEventDocument: vi.fn(async () => document),
    closeGates: vi.fn(async () => ({ ready: true, missingKeys: [] })),
    archiveEvent: vi.fn(async () => event),
    listEventInsights: vi.fn(async () => [insight]),
    generateEventInsights: vi.fn(async () => insight),
    searchArchive: vi.fn(async () => [{ id: 'evt_sample', eventName: 'Sample Gala', venue: 'Ballroom' }]),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}, verifiedActor) => ({
      role: verifiedActor?.actorRole ?? input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: verifiedActor?.actorName ?? input.actorName ?? 'PMCM Admin',
      email: verifiedActor?.actorEmail ?? input.actorEmail,
    })),
    requireActorRole: vi.fn(async () => undefined),
  };
  const guestReader = { guestAccessCode: vi.fn(() => 'SAMPLE-GALA-EVT') };
  const floorplanReader = { mapFloorPlanDraft: vi.fn((draft) => draft) };
  const controller = new OpsEventClosureController(
    eventClosureService as any,
    eventAccessPolicyService as any,
    guestReader as any,
    floorplanReader as any,
  );
  return { controller, eventClosureService, eventAccessPolicyService, guestReader };
}

describe('OpsEventClosureController', () => {
  it('requires a verified session to search the archive', () => {
    const guards = Reflect.getMetadata('__guards__', OpsEventClosureController.prototype.searchArchive);
    expect(guards).toContain(EventSessionGuard);
  });

  it('searches archived events with the verified actor', async () => {
    const { controller, eventClosureService, eventAccessPolicyService } = createController();
    const actor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine', actorEmail: 'maxine@pmcm.test' };
    await expect(controller.searchArchive({ venue: 'Ballroom' }, actor as never)).resolves.toEqual([
      { id: 'evt_sample', eventName: 'Sample Gala', venue: 'Ballroom' },
    ]);
    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, actor);
    expect(eventClosureService.searchArchive).toHaveBeenCalledWith(
      { venue: 'Ballroom' },
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test' },
    );
  });

  it('keeps event closure routes under the events route base', () => {
    expect(controllerPath(OpsEventClosureController)).toBe('events');
  });

  it('serves closeout commands through ClosureOps mappers', async () => {
    const { controller, eventClosureService, guestReader } = createController();

    const verifiedActor = { id: 'pmcm_1', actorId: 'pmcm_1', role: OpsUserRole.PmcmAdmin, actorRole: OpsUserRole.PmcmAdmin, name: 'Maxine', actorName: 'Maxine', email: 'maxine@pmcm.test', actorEmail: 'maxine@pmcm.test' } as never;
    await expect(controller.completePostEventDocument('evt_sample', 'post_1', verifiedActor)).resolves.toEqual({
      id: 'post_1',
      eventId: 'evt_sample',
      title: 'Feedback',
      status: 'submitted',
    });
    await expect(controller.closeGates('evt_sample', verifiedActor)).resolves.toEqual({ ready: true, missingKeys: [] });
    await expect(controller.archiveEvent('evt_sample', { actorName: 'Maxine' }, verifiedActor)).resolves.toEqual(
      expect.objectContaining({
        id: 'evt_sample',
        eventDate: '2026-07-20',
        archived: true,
        guestAccessCode: 'SAMPLE-GALA-EVT',
        floorPlanDrafts: [],
      }),
    );

    expect(eventClosureService.completePostEventDocument).toHaveBeenCalledWith('evt_sample', 'post_1', expect.objectContaining({ role: OpsUserRole.PmcmAdmin }));
    expect(eventClosureService.archiveEvent).toHaveBeenCalledWith('evt_sample', expect.objectContaining({ actorName: 'Maxine', actorRole: OpsUserRole.PmcmAdmin }));
    expect(guestReader.guestAccessCode).toHaveBeenCalled();
  });

  it('serves event insights through ClosureOps with resolved actor context', async () => {
    const { controller, eventClosureService, eventAccessPolicyService } = createController();
    const actor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine', actorEmail: 'maxine@pmcm.test' };

    await expect(controller.eventInsights('evt_sample', actor as never)).resolves.toEqual([
      expect.objectContaining({
        id: 'ins_1',
        summary: 'Closed cleanly',
        privateNotes: 'PMCM-only',
        generatedAt: '2026-07-21T00:00:00.000Z',
        updatedAt: '2026-07-21T01:00:00.000Z',
      }),
    ]);
    await expect(controller.generateEventInsights('evt_sample', actor as never)).resolves.toEqual(
      expect.objectContaining({ id: 'ins_1', privateNotes: 'PMCM-only' }),
    );

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, actor);
    expect(eventClosureService.listEventInsights).toHaveBeenCalledWith(
      'evt_sample',
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test' },
    );
    expect(eventClosureService.generateEventInsights).toHaveBeenCalledWith(
      'evt_sample',
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test' },
    );
  });

  it('does not swallow forbidden closure insight access', async () => {
    const { controller, eventClosureService } = createController();
    eventClosureService.listEventInsights.mockRejectedValueOnce(
      new ForbiddenException('client cannot access event insights'),
    );

    await expect(
      controller.eventInsights('evt_sample', { actorRole: OpsUserRole.Client, actorName: 'Ana Reyes' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

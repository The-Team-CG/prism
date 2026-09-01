import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
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
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}) => ({
      role: input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: input.actorName ?? 'PMCM Admin',
      email: input.actorEmail,
    })),
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
  it('keeps event closure routes under the events route base', () => {
    expect(controllerPath(OpsEventClosureController)).toBe('events');
  });

  it('serves closeout commands through ClosureOps mappers', async () => {
    const { controller, eventClosureService, guestReader } = createController();

    await expect(controller.completePostEventDocument('evt_sample', 'post_1')).resolves.toEqual({
      id: 'post_1',
      eventId: 'evt_sample',
      title: 'Feedback',
      status: 'submitted',
    });
    await expect(controller.closeGates('evt_sample')).resolves.toEqual({ ready: true, missingKeys: [] });
    await expect(controller.archiveEvent('evt_sample', { actorName: 'Maxine' })).resolves.toEqual(
      expect.objectContaining({
        id: 'evt_sample',
        eventDate: '2026-07-20',
        archived: true,
        guestAccessCode: 'SAMPLE-GALA-EVT',
        floorPlanDrafts: [],
      }),
    );

    expect(eventClosureService.completePostEventDocument).toHaveBeenCalledWith('evt_sample', 'post_1');
    expect(eventClosureService.archiveEvent).toHaveBeenCalledWith('evt_sample', { actorName: 'Maxine' });
    expect(guestReader.guestAccessCode).toHaveBeenCalled();
  });

  it('serves event insights through ClosureOps with resolved actor context', async () => {
    const { controller, eventClosureService, eventAccessPolicyService } = createController();
    const actor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine', actorEmail: 'maxine@pmcm.test' };

    await expect(controller.eventInsights('evt_sample', actor)).resolves.toEqual([
      expect.objectContaining({
        id: 'ins_1',
        summary: 'Closed cleanly',
        privateNotes: 'PMCM-only',
        generatedAt: '2026-07-21T00:00:00.000Z',
        updatedAt: '2026-07-21T01:00:00.000Z',
      }),
    ]);
    await expect(controller.generateEventInsights('evt_sample', actor)).resolves.toEqual(
      expect.objectContaining({ id: 'ins_1', privateNotes: 'PMCM-only' }),
    );

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith(actor);
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
      controller.eventInsights('evt_sample', { actorRole: OpsUserRole.Client, actorName: 'Ana Reyes' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

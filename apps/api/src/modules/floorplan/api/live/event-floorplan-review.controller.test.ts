import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { createFloorPlanRevisionCommentSchema } from '@prism/types';
import { EventFloorPlanReviewController } from './event-floorplan-review.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

const verifiedClientActor = {
  id: 'client_ana',
  actorId: 'client_ana',
  role: OpsUserRole.Client,
  actorRole: OpsUserRole.Client,
  email: 'ana@example.test',
  actorEmail: 'ana@example.test',
  name: 'Ana Reyes',
  actorName: 'Ana Reyes',
  expiresAt: '2026-07-03T12:00:00.000Z',
};

function createController() {
  const floorPlanReviewService = {
    submitRevisionComment: vi.fn(async () => ({ id: 'fpd_review', status: 'revision_requested' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input: any = {}, verified?: any) => ({
      id: verified?.actorId,
      role: verified?.actorRole ?? input.actorRole ?? OpsUserRole.Client,
      email: verified?.actorEmail ?? input.actorEmail,
      name: verified?.actorName ?? input.actorName ?? 'Ana Reyes',
      explicit: true,
      verified: true,
    })),
  };
  const controller = new EventFloorPlanReviewController(
    floorPlanReviewService as any,
    eventAccessPolicyService as any,
  );
  return { controller, floorPlanReviewService, eventAccessPolicyService };
}

describe('EventFloorPlanReviewController', () => {
  it('keeps the floorplan review route under the events route base', () => {
    expect(controllerPath(EventFloorPlanReviewController)).toBe('events');
  });

  it('serves client revision comments through FloorPlanReviewService with the resolved actor', async () => {
    const { controller, floorPlanReviewService, eventAccessPolicyService } = createController();
    const input = createFloorPlanRevisionCommentSchema.parse({
      revisionNote: 'Please move the mingle space next to the bar.',
    });

    await expect(
      controller.submitRevisionComment('evt_sample', 'fpd_review', input, verifiedClientActor as any),
    ).resolves.toEqual({ id: 'fpd_review', status: 'revision_requested' });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedClientActor);
    expect(floorPlanReviewService.submitRevisionComment).toHaveBeenCalledWith(
      'evt_sample',
      'fpd_review',
      input,
      {
        id: 'client_ana',
        role: OpsUserRole.Client,
        email: 'ana@example.test',
        name: 'Ana Reyes',
        explicit: true,
        verified: true,
      },
    );
  });
});
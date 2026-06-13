import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { EventLifecycleService, EventLifecycleStage } from './event-lifecycle.service';

describe('EventLifecycleService', () => {
  const service = new EventLifecycleService();

  it('allows only configured forward lifecycle transitions', () => {
    expect(service.nextAllowedStages(EventLifecycleStage.Inquiry)).toEqual([EventLifecycleStage.Conforme]);
    expect(service.nextAllowedStages(EventLifecycleStage.Conforme)).toEqual([EventLifecycleStage.BriefingProposal]);
    expect(() =>
      service.assertCanTransition(EventLifecycleStage.Inquiry, EventLifecycleStage.Planning),
    ).toThrow(BadRequestException);
  });

  it('blocks archive before the event-day lifecycle stage even when close gates are ready', () => {
    expect(() =>
      service.assertCanArchive(
        {
          status: 'planning',
          archived: false,
          clientPortalStatus: 'unlocked',
          floorPlanStatus: 'approved',
        },
        { ready: true, missingKeys: [] },
      ),
    ).toThrow(BadRequestException);
  });
});

import { BadRequestException } from '@nestjs/common';
import type { OpsEvent } from '@prisma/client';
import {
  nextPrismLifecycleStages,
  type PrismLifecycleStage,
} from '@prism/types';

export const EventLifecycleStage = {
  Inquiry: 'inquiry',
  Conforme: 'conforme',
  BriefingProposal: 'briefing_proposal',
  Planning: 'planning',
  EventDay: 'event_day',
  ClosureArchive: 'closure_archive',
} as const;

export type EventLifecycleStage = PrismLifecycleStage;

export type CloseGateResult = {
  ready: boolean;
  missingKeys: string[];
};

export class EventLifecycleService {
  stageForEvent(event: Pick<OpsEvent, 'status' | 'clientPortalStatus' | 'archived' | 'floorPlanStatus'>): EventLifecycleStage {
    if (event.archived || event.status === 'archived') return EventLifecycleStage.ClosureArchive;
    if (event.status === 'event_day') return EventLifecycleStage.EventDay;
    if (event.floorPlanStatus === 'approved') return EventLifecycleStage.Planning;
    if (event.clientPortalStatus === 'unlocked') return EventLifecycleStage.BriefingProposal;
    if (event.status === 'planning') return EventLifecycleStage.Conforme;
    return EventLifecycleStage.Inquiry;
  }

  nextAllowedStages(stage: EventLifecycleStage): EventLifecycleStage[] {
    return nextPrismLifecycleStages(stage);
  }

  assertCanTransition(from: EventLifecycleStage, to: EventLifecycleStage) {
    if (from === to) return;
    if (this.nextAllowedStages(from).includes(to)) return;

    throw new BadRequestException(`Cannot move event lifecycle from ${from} to ${to}`);
  }

  assertCanArchive(
    event: Pick<OpsEvent, 'status' | 'archived' | 'clientPortalStatus' | 'floorPlanStatus'>,
    closeGates: CloseGateResult,
    overrideReason?: string,
  ) {
    if (event.archived || event.status === 'archived') {
      throw new BadRequestException('Event is already archived');
    }
    this.assertCanTransition(this.stageForEvent(event), EventLifecycleStage.ClosureArchive);
    if (!closeGates.ready && !overrideReason) {
      throw new BadRequestException('Close gates must pass before archive, or PMCM must provide an override reason');
    }
  }
}

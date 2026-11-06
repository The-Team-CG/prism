import { Injectable, BadRequestException } from '@nestjs/common';
import type { OpsEvent } from '@prisma/client';
import { derivePrismLifecycleStage, type PrismLifecycleStage } from '@prism/types';

export const EventLifecycleStage = {
  Inquiry: 'inquiry',
  Conforme: 'conforme',
  BriefingProposal: 'briefing_proposal',
  Planning: 'planning',
  EventDay: 'event_day',
  ClosureArchive: 'closure_archive',
} as const;

export type EventLifecycleStage = PrismLifecycleStage;

type StageFacts = Pick<OpsEvent, 'status' | 'archived' | 'clientPortalStatus' | 'proposalClientStatus' | 'actualEndedAt'>;

export type CloseGateResult = {
  ready: boolean;
  missingKeys: string[];
};

const NEXT_LIFECYCLE_STAGES: Record<EventLifecycleStage, EventLifecycleStage[]> = {
  [EventLifecycleStage.Inquiry]: [EventLifecycleStage.Conforme],
  [EventLifecycleStage.Conforme]: [EventLifecycleStage.BriefingProposal],
  [EventLifecycleStage.BriefingProposal]: [EventLifecycleStage.Planning],
  [EventLifecycleStage.Planning]: [EventLifecycleStage.EventDay],
  [EventLifecycleStage.EventDay]: [EventLifecycleStage.ClosureArchive],
  [EventLifecycleStage.ClosureArchive]: [],
};

@Injectable()
export class EventLifecycleService {
  /** Same rule the portals display: planning starts when the client approves the proposal. */
  stageForEvent(event: StageFacts): EventLifecycleStage {
    return derivePrismLifecycleStage(event);
  }

  nextAllowedStages(stage: EventLifecycleStage): EventLifecycleStage[] {
    return NEXT_LIFECYCLE_STAGES[stage] ?? [];
  }

  assertCanTransition(from: EventLifecycleStage, to: EventLifecycleStage) {
    if (from === to) return;
    if (this.nextAllowedStages(from).includes(to)) return;

    throw new BadRequestException(`Cannot move event lifecycle from ${from} to ${to}`);
  }

  assertCanArchive(
    event: StageFacts,
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

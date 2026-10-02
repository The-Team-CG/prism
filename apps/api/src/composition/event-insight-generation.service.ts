import { Inject, Injectable } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { CLOSURE_COMMANDS } from '@prism/contexts/event-lifecycle';
import type { ClosureCommands } from '@prism/contexts/event-lifecycle';
import { COORDINATOR_INSIGHT_FACTS_READER } from '@prism/contexts/operations';
import type { CoordinatorInsightFactsReader } from '@prism/contexts/operations';
import type { PrismCoordinatorInsightFacts } from '@prism/types';

@Injectable()
export class EventInsightGenerationService {
  constructor(
    @Inject(CLOSURE_COMMANDS) private readonly closureCommands: ClosureCommands,
    @Inject(COORDINATOR_INSIGHT_FACTS_READER) private readonly coordinatorFactsReader: CoordinatorInsightFactsReader,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  async generate(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'event insights',
      eventId,
    );
    const coordinatorFacts: PrismCoordinatorInsightFacts = await this.coordinatorFactsReader.getForEvent(eventId);
    return this.closureCommands.generateEventInsights(eventId, actor, coordinatorFacts);
  }
}

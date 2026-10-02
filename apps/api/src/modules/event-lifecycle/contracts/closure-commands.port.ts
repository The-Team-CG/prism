import type { OpsEvent, OpsEventInsight, OpsPostEventDocument } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { ArchiveEventInput } from '../application/closure/event-closure.service';
import type { PrismCoordinatorInsightFacts, StartEventWrapUpInput, UpdateEventWrapUpInput } from '@prism/types';

export interface ClosureCommands {
  archiveEvent(eventId: string, input?: ArchiveEventInput): Promise<OpsEvent>;
  completePostEventDocument(eventId: string, documentId: string, actor?: ResolvedEventOpsActor): Promise<OpsPostEventDocument>;
  generateEventInsights(
    eventId: string,
    actor: ResolvedEventOpsActor,
    coordinatorFacts: PrismCoordinatorInsightFacts,
  ): Promise<OpsEventInsight>;
  startWrapUp(eventId: string, input: StartEventWrapUpInput, actor: ResolvedEventOpsActor): Promise<unknown>;
  updateWrapUp(eventId: string, input: UpdateEventWrapUpInput, actor: ResolvedEventOpsActor): Promise<unknown>;
}

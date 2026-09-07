import type { OpsEvent, OpsEventInsight, OpsPostEventDocument } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { ArchiveEventInput } from '../application/closure/event-closure.service';

export interface ClosureCommands {
  archiveEvent(eventId: string, input?: ArchiveEventInput): Promise<OpsEvent>;
  completePostEventDocument(eventId: string, documentId: string, actor?: ResolvedEventOpsActor): Promise<OpsPostEventDocument>;
  generateEventInsights(eventId: string, actor: ResolvedEventOpsActor): Promise<OpsEventInsight>;
}

import type { OpsEvent, OpsEventInsight, OpsPostEventDocument } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/modules/access-control';
import type { ArchiveEventInput } from '../services/event-closure.service';

export interface ClosureCommands {
  archiveEvent(eventId: string, input?: ArchiveEventInput): Promise<OpsEvent>;
  completePostEventDocument(eventId: string, documentId: string): Promise<OpsPostEventDocument>;
  generateEventInsights(eventId: string, actor: ResolvedEventOpsActor): Promise<OpsEventInsight>;
}
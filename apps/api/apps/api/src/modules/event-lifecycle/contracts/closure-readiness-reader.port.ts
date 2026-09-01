import type { OpsEventInsight } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

export interface ClosureReadinessReader {
  closeGates(eventId: string): Promise<unknown>;
  listEventInsights(eventId: string, actor: ResolvedEventOpsActor): Promise<OpsEventInsight[]>;
}
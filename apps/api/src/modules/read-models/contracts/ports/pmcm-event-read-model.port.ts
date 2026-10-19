import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PmcmDashboardMappers } from '../../application/services/event-read-models.service';

export interface PmcmEventReadModel {
  pmcmCommandInbox(actor: ResolvedEventOpsActor): Promise<unknown>;
  pmcmEventWorkspace(actor: ResolvedEventOpsActor, eventId: string, mappers: PmcmDashboardMappers): Promise<unknown>;
  pmcmDashboard(actor: ResolvedEventOpsActor, mappers: PmcmDashboardMappers): Promise<unknown>;
  pmcmSupplierReadinessBoard(actor: ResolvedEventOpsActor, eventId: string): Promise<unknown>;
}

import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { ClientWorkspaceMappers } from '../../application/services/event-read-models.service';

export interface ClientEventReadModel {
  clientWorkspace(actor: ResolvedEventOpsActor, mappers: ClientWorkspaceMappers): Promise<unknown>;
  clientActionCenter(actor: ResolvedEventOpsActor): Promise<unknown>;
}

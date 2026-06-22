import type { ResolvedEventOpsActor } from '@prism/modules/access-control';
import type { ClientWorkspaceMappers } from '../services/event-read-models.service';

export interface ClientEventReadModel {
  clientWorkspace(actor: ResolvedEventOpsActor, mappers: ClientWorkspaceMappers): Promise<unknown>;
  clientActionCenter(actor: ResolvedEventOpsActor): Promise<unknown>;
}
import type { ResolvedEventOpsActor } from '@prism/modules/access-control';
import type { SupplierWorkspaceMappers } from '../services/event-read-models.service';

export interface SupplierEventReadModel {
  supplierWorkspace(actor: ResolvedEventOpsActor, mappers: SupplierWorkspaceMappers): Promise<unknown>;
  supplierReadinessBoard(actor: ResolvedEventOpsActor): Promise<unknown>;
}
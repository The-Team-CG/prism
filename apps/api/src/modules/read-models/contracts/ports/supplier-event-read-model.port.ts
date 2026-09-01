import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { SupplierWorkspaceMappers } from '../../application/services/event-read-models.service';

export interface SupplierEventReadModel {
  supplierWorkspace(actor: ResolvedEventOpsActor, mappers: SupplierWorkspaceMappers): Promise<unknown>;
  supplierReadinessBoard(actor: ResolvedEventOpsActor): Promise<unknown>;
}

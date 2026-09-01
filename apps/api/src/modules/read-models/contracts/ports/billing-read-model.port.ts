import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { BillingReadModelMappers } from '../../application/services/event-read-models.service';

export interface BillingReadModel {
  billing(actor: ResolvedEventOpsActor, mappers: BillingReadModelMappers): Promise<unknown>;
}

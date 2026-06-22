import type { ResolvedEventOpsActor } from '@prism/modules/access-control';
import type { BillingReadModelMappers } from '../services/event-read-models.service';

export interface BillingReadModel {
  billing(actor: ResolvedEventOpsActor, mappers: BillingReadModelMappers): Promise<unknown>;
}
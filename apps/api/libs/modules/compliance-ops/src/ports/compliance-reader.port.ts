import type { OpsComplianceRule } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/modules/access-control';

export interface ComplianceReader {
  listComplianceRules(actor: ResolvedEventOpsActor): Promise<OpsComplianceRule[]>;
}
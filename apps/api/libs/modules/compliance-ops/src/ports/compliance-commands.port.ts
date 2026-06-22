import type { OpsComplianceCheck, OpsComplianceRule } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/modules/access-control';
import type {
  ComplianceRunInput,
  CreateComplianceRuleInput,
  ResolveComplianceInput,
  UpdateComplianceRuleInput,
} from '../services/compliance-workflow.service';

export interface ComplianceCommands {
  createComplianceRule(input: CreateComplianceRuleInput, actor: ResolvedEventOpsActor): Promise<OpsComplianceRule>;
  updateComplianceRule(
    ruleId: string,
    input: UpdateComplianceRuleInput,
    actor: ResolvedEventOpsActor,
  ): Promise<OpsComplianceRule>;
  runCompliance(eventId: string, input?: ComplianceRunInput): Promise<OpsComplianceCheck[]>;
  resolveCompliance(
    eventId: string,
    checkId: string,
    input?: string | ResolveComplianceInput,
  ): Promise<OpsComplianceCheck>;
}
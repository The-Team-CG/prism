import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsComplianceController } from './controllers/compliance-rules.controller';
import { OpsEventComplianceController } from './controllers/event-compliance.controller';
import { COMPLIANCE_COMMANDS, COMPLIANCE_READER } from './ports/compliance-ops.tokens';
import { ComplianceWorkflowService } from './services/compliance-workflow.service';

/**
 * Owned tables: OpsComplianceCheck, OpsComplianceRule, OpsEvent (compliance-status fields only; primary event lifecycle owned by inquiry-onboarding).
 * Read-only: OpsInquiry (via inquiry-onboarding).
 */
@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, AccessControlModule],
  controllers: [OpsComplianceController, OpsEventComplianceController],
  providers: [
    ComplianceWorkflowService,
    { provide: COMPLIANCE_COMMANDS, useExisting: ComplianceWorkflowService },
    { provide: COMPLIANCE_READER, useExisting: ComplianceWorkflowService },
  ],
  exports: [ComplianceWorkflowService, COMPLIANCE_COMMANDS, COMPLIANCE_READER],
})
export class ComplianceOpsModule {}

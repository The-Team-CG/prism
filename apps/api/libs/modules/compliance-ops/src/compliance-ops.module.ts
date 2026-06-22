import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsComplianceController } from './controllers/compliance-rules.controller';
import { COMPLIANCE_COMMANDS, COMPLIANCE_READER } from './ports/compliance-ops.tokens';
import { ComplianceWorkflowService } from './services/compliance-workflow.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, AccessControlModule],
  controllers: [OpsComplianceController],
  providers: [
    ComplianceWorkflowService,
    { provide: COMPLIANCE_COMMANDS, useExisting: ComplianceWorkflowService },
    { provide: COMPLIANCE_READER, useExisting: ComplianceWorkflowService },
  ],
  exports: [ComplianceWorkflowService, COMPLIANCE_COMMANDS, COMPLIANCE_READER],
})
export class ComplianceOpsModule {}
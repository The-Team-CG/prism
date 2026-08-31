import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { OpsAiGovernanceController } from './controllers/ai-governance.controller';
import { AiGovernanceService } from './services/ai-governance.service';
import { PAREService } from './services/pare/pare.service';

/**
 * Owned tables: OpsAiApprovalRecord, OpsAiAuditLog.
 * Read-only: OpsBriefing (via inquiry-onboarding), OpsSupplier (via supplier-ops), OpsSupplierCategory (sample-seeded only; no owning module), OpsSupplierQuote (via commercial-ops), OpsSupplierQuoteRequest (via commercial-ops).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [OpsAiGovernanceController],
  providers: [AiGovernanceService, PAREService],
  exports: [AiGovernanceService, PAREService],
})
export class AiGovernanceModule {}

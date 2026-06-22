import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { OpsAiGovernanceController } from './controllers/ai-governance.controller';
import { AiGovernanceService } from './services/ai-governance.service';
import { PAREService } from './services/pare/pare.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OpsAiGovernanceController],
  providers: [AiGovernanceService, PAREService],
  exports: [AiGovernanceService, PAREService],
})
export class AiGovernanceModule {}

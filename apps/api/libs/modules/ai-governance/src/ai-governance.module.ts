import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { OpsAiGovernanceController } from './controllers/ai-governance.controller';
import { AiGovernanceService } from './services/ai-governance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OpsAiGovernanceController],
  providers: [AiGovernanceService],
  exports: [AiGovernanceService],
})
export class AiGovernanceModule {}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AiGovernanceDryRunDto } from './ai-governance.dto';
import { AiGovernanceService } from '../../application/ai-governance/ai-governance.service';

@Controller('ai')
export class OpsAiGovernanceController {
  constructor(private readonly aiGovernanceService: AiGovernanceService) {}

  @Post('governance/dry-run')
  @HttpCode(HttpStatus.CREATED)
  dryRun(@Body() dto: AiGovernanceDryRunDto) {
    return this.aiGovernanceService.runDryRun(dto);
  }
}

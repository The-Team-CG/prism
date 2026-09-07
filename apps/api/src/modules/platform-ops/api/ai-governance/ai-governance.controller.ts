import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { aiGovernanceDryRunSchema, type AiGovernanceDryRunInput, type PrismVerifiedEventActor } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { AiGovernanceService } from '../../application/ai-governance/ai-governance.service';

@Controller('ai')
export class OpsAiGovernanceController {
  constructor(private readonly aiGovernanceService: AiGovernanceService) {}

  @Post('governance/dry-run')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  dryRun(@Body(zodBody(aiGovernanceDryRunSchema)) dto: AiGovernanceDryRunInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin' && actor.role !== 'system') {
      throw new ForbiddenException('Only trust operators can run AI governance dry-runs');
    }
    return this.aiGovernanceService.runDryRun(dto);
  }
}

import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
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
    if (actor.actorRole !== OpsUserRole.PmcmAdmin && actor.actorRole !== OpsUserRole.System) {
      throw new ForbiddenException('Only trust operators can run AI governance dry-runs');
    }
    const resolvedActor: ResolvedEventOpsActor = {
      id: actor.actorId,
      role: actor.actorRole,
      email: actor.actorEmail,
      name: actor.actorName,
      explicit: true,
      verified: true,
    };
    return this.aiGovernanceService.runDryRun(dto, resolvedActor);
  }
}

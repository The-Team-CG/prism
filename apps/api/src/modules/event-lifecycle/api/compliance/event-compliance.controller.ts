import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  resolveComplianceSchema,
  runComplianceSchema,
  type ResolveComplianceInput,
  type RunComplianceInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { mapComplianceCheck } from '../../application/compliance/compliance.mappers';
import { ComplianceWorkflowService } from '../../application/compliance/compliance-workflow.service';

@Controller('events')
export class OpsEventComplianceController {
  constructor(private readonly complianceWorkflowService: ComplianceWorkflowService, private readonly eventAccessPolicyService: EventAccessPolicyService) {}

  @Post(':eventId/compliance')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async runCompliance(@Param('eventId') eventId: string, @Body(zodBody(runComplianceSchema)) dto: RunComplianceInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireOperator(eventId, verifiedActor);
    const checks = await this.complianceWorkflowService.runCompliance(eventId, dto, actor);
    return checks.map(mapComplianceCheck);
  }

  @Patch(':eventId/compliance/:checkId')
  @UseGuards(EventSessionGuard)
  async resolveCompliance(
    @Param('eventId') eventId: string,
    @Param('checkId') checkId: string,
    @Body(zodBody(resolveComplianceSchema)) dto: ResolveComplianceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireOperator(eventId, verifiedActor);
    const check = await this.complianceWorkflowService.resolveCompliance(eventId, checkId, dto, actor);
    return mapComplianceCheck(check);
  }

  private async requireOperator(eventId: string, verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance', eventId);
    return actor;
  }
}

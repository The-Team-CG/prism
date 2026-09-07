import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { ResolveComplianceDto, RunComplianceDto } from './compliance.dto';
import { mapComplianceCheck } from '../../application/compliance/compliance.mappers';
import { ComplianceWorkflowService } from '../../application/compliance/compliance-workflow.service';

@Controller('events')
export class OpsEventComplianceController {
  constructor(private readonly complianceWorkflowService: ComplianceWorkflowService, private readonly eventAccessPolicyService: EventAccessPolicyService) {}

  @Post(':eventId/compliance')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async runCompliance(@Param('eventId') eventId: string, @Body() dto: RunComplianceDto = {}, @VerifiedEventActor() verifiedActor: unknown) {
    await this.requireOperator(eventId, verifiedActor);
    const checks = await this.complianceWorkflowService.runCompliance(eventId, dto);
    return checks.map(mapComplianceCheck);
  }

  @Patch(':eventId/compliance/:checkId')
  @UseGuards(EventSessionGuard)
  async resolveCompliance(
    @Param('eventId') eventId: string,
    @Param('checkId') checkId: string,
    @Body() dto: ResolveComplianceDto,
    @VerifiedEventActor() verifiedActor: unknown,
  ) {
    await this.requireOperator(eventId, verifiedActor);
    const check = await this.complianceWorkflowService.resolveCompliance(eventId, checkId, dto);
    return mapComplianceCheck(check);
  }

  private requireOperator(eventId: string, verifiedActor: unknown) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor as PrismVerifiedEventActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance', eventId);
  }
}

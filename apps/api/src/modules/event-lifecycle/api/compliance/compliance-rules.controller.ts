import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createComplianceRuleSchema,
  updateComplianceRuleSchema,
  type CreateComplianceRuleInput,
  type PrismVerifiedEventActor,
  type UpdateComplianceRuleInput,
} from '@prism/types';
import { mapComplianceRule } from '../../application/compliance/compliance.mappers';
import { ComplianceWorkflowService } from '../../application/compliance/compliance-workflow.service';

@Controller('compliance')
export class OpsComplianceController {
  constructor(
    private readonly complianceWorkflowService: ComplianceWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('rules')
  @UseGuards(EventSessionGuard)
  async listRules(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const rules = await this.complianceWorkflowService.listComplianceRules(actor);
    return rules.map(mapComplianceRule);
  }

  @Post('rules')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRule(@Body(zodBody(createComplianceRuleSchema)) dto: CreateComplianceRuleInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const rule = await this.complianceWorkflowService.createComplianceRule(dto, actor);
    return mapComplianceRule(rule);
  }

  @Patch('rules/:ruleId')
  @UseGuards(EventSessionGuard)
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body(zodBody(updateComplianceRuleSchema)) dto: UpdateComplianceRuleInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const rule = await this.complianceWorkflowService.updateComplianceRule(ruleId, dto, actor);
    return mapComplianceRule(rule);
  }
}

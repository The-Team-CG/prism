import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { ComplianceActorDto, CreateComplianceRuleDto, UpdateComplianceRuleDto } from './compliance.dto';
import { mapComplianceRule } from '../../application/compliance/compliance.mappers';
import { ComplianceWorkflowService } from '../../application/compliance/compliance-workflow.service';

@Controller('compliance')
export class OpsComplianceController {
  constructor(
    private readonly complianceWorkflowService: ComplianceWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('rules')
  async listRules(@Query() actorInput: ComplianceActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const rules = await this.complianceWorkflowService.listComplianceRules(actor);
    return rules.map(mapComplianceRule);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  async createRule(@Body() dto: CreateComplianceRuleDto, @Query() actorInput: ComplianceActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const rule = await this.complianceWorkflowService.createComplianceRule(dto, actor);
    return mapComplianceRule(rule);
  }

  @Patch('rules/:ruleId')
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateComplianceRuleDto,
    @Query() actorInput: ComplianceActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const rule = await this.complianceWorkflowService.updateComplianceRule(ruleId, dto, actor);
    return mapComplianceRule(rule);
  }
}

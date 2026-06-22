import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ResolveComplianceDto, RunComplianceDto } from '../dto/compliance.dto';
import { mapComplianceCheck } from '../mappers/compliance.mappers';
import { ComplianceWorkflowService } from '../services/compliance-workflow.service';

@Controller('events')
export class OpsEventComplianceController {
  constructor(private readonly complianceWorkflowService: ComplianceWorkflowService) {}

  @Post(':eventId/compliance')
  @HttpCode(HttpStatus.CREATED)
  async runCompliance(@Param('eventId') eventId: string, @Body() dto: RunComplianceDto = {}) {
    const checks = await this.complianceWorkflowService.runCompliance(eventId, dto);
    return checks.map(mapComplianceCheck);
  }

  @Patch(':eventId/compliance/:checkId')
  async resolveCompliance(
    @Param('eventId') eventId: string,
    @Param('checkId') checkId: string,
    @Body() dto: ResolveComplianceDto,
  ) {
    const check = await this.complianceWorkflowService.resolveCompliance(eventId, checkId, dto);
    return mapComplianceCheck(check);
  }
}
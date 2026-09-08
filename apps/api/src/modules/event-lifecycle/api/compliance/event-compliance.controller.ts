import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  resolveComplianceSchema,
  runComplianceSchema,
  createComplianceRiskSchema,
  updateComplianceRiskSchema,
  type ResolveComplianceInput,
  type RunComplianceInput,
  type PrismVerifiedEventActor,
  type CreateComplianceRiskInput,
  type UpdateComplianceRiskInput,
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

  @Get(':eventId/compliance/runs')
  @UseGuards(EventSessionGuard)
  async listRuns(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return (await this.complianceWorkflowService.listComplianceRuns(eventId, await this.requireOperator(eventId, verifiedActor))).map((run) => ({
      ...run, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null, createdAt: run.createdAt.toISOString(),
      checks: run.checks.map((check) => ({ ...check, createdAt: check.createdAt.toISOString(), resolvedAt: check.resolvedAt?.toISOString() ?? null, overrideAt: check.overrideAt?.toISOString() ?? null, evidence: Array.isArray(check.evidence) ? check.evidence : [] })),
    }));
  }

  @Get(':eventId/compliance/risks')
  @UseGuards(EventSessionGuard)
  async listRisks(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return (await this.complianceWorkflowService.listComplianceRisks(eventId, await this.requireOperator(eventId, verifiedActor))).map((risk) => ({
      ...risk, createdAt: risk.createdAt.toISOString(), updatedAt: risk.updatedAt.toISOString(), closedAt: risk.closedAt?.toISOString() ?? null,
      history: risk.history.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    }));
  }

  @Post(':eventId/compliance/risks')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRisk(@Param('eventId') eventId: string, @Body(zodBody(createComplianceRiskSchema)) dto: CreateComplianceRiskInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const risk = await this.complianceWorkflowService.createComplianceRisk(eventId, dto, await this.requireOperator(eventId, verifiedActor));
    return { ...risk, createdAt: risk.createdAt.toISOString(), updatedAt: risk.updatedAt.toISOString(), closedAt: risk.closedAt?.toISOString() ?? null };
  }

  @Patch(':eventId/compliance/risks/:riskId')
  @UseGuards(EventSessionGuard)
  async updateRisk(@Param('eventId') eventId: string, @Param('riskId') riskId: string, @Body(zodBody(updateComplianceRiskSchema)) dto: UpdateComplianceRiskInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const risk = await this.complianceWorkflowService.updateComplianceRisk(eventId, riskId, dto, await this.requireOperator(eventId, verifiedActor));
    return { ...risk, createdAt: risk.createdAt.toISOString(), updatedAt: risk.updatedAt.toISOString(), closedAt: risk.closedAt?.toISOString() ?? null };
  }

  private async requireOperator(eventId: string, verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance', eventId);
    return actor;
  }
}

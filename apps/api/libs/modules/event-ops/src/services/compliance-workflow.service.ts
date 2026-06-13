import { NotFoundException } from '@nestjs/common';
import type { OpsComplianceCheck, OpsComplianceRule, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory } from '../ops.constants';
import { AuditService } from './audit.service';
import { WorkflowCommandService } from './workflow-command.service';

export type ComplianceRunInput = {
  phase?: string;
};

export class ComplianceWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async runCompliance(eventId: string, input: ComplianceRunInput = {}): Promise<OpsComplianceCheck[]> {
    let phase = 'planning';
    let eventType = '';
    let matchingRules: OpsComplianceRule[] = [];

    return this.workflowCommandService.execute<OpsComplianceCheck[]>({
      name: 'run_compliance_checks',
      eventId,
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');

        phase = input.phase?.trim() || 'planning';
        const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } });
        eventType = inquiry?.eventType ?? '';

        const rules = await this.prisma.opsComplianceRule.findMany({
          where: { active: true, phase },
          orderBy: [{ severity: 'asc' }, { title: 'asc' }],
        });
        matchingRules = rules.filter((rule) => this.ruleAppliesToEvent(rule, eventId, eventType));
      },
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.opsComplianceCheck.deleteMany({ where: { eventId } });
          if (matchingRules.length > 0) {
            await tx.opsComplianceCheck.createMany({
              data: matchingRules.map((rule) => ({
                id: `chk_${randomUUID()}`,
                eventId,
                ruleId: rule.id,
                layer: rule.layer,
                severity: rule.severity,
                phase: rule.phase,
                conditionKey: rule.conditionKey,
                title: rule.title,
                status: 'open',
                note: rule.note,
              })),
            });
          }
          await tx.opsEvent.update({
            where: { id: eventId },
            data: {
              readiness: matchingRules.some((rule) => rule.severity === 'must_fix')
                ? 'Must-Fix item open'
                : 'Compliance review open',
            },
          });
          return tx.opsComplianceCheck.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
        }),
      sideEffects: async () => {
        await this.auditService.audit(eventId, 'PMCM Admin', 'Ran compliance checks', {
          actionType: AuditActionType.Create,
          category: AuditCategory.Compliance,
          metadata: { phase, eventType, ruleCount: matchingRules.length },
        });
      },
    });
  }

  private ruleAppliesToEvent(rule: OpsComplianceRule, eventId: string, eventType: string) {
    const eventScoped = !rule.eventId || rule.eventId === eventId;
    const typeScoped = !rule.eventType || this.sameText(rule.eventType, eventType);
    return eventScoped && typeScoped;
  }

  private sameText(left?: string | null, right?: string | null) {
    return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
  }
}

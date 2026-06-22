import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsComplianceCheck, OpsComplianceRule, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/modules/event-core';
import { AuditService } from '@prism/modules/trust-ops';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/modules/access-control';

export type ComplianceRunInput = {
  phase?: string;
};

export type ResolveComplianceInput = {
  action?: string;
  note?: string;
  overrideReason?: string;
  actorName?: string;
};

export type CreateComplianceRuleInput = {
  eventId?: string;
  eventType?: string;
  phase?: string;
  severity?: string;
  layer?: string;
  conditionKey: string;
  title: string;
  note?: string;
  active?: boolean;
};

export type UpdateComplianceRuleInput = Partial<CreateComplianceRuleInput>;

@Injectable()
export class ComplianceWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async listComplianceRules(actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'compliance rules',
    );
    return this.prisma.opsComplianceRule.findMany({
      take: 200,
      orderBy: [{ active: 'desc' }, { phase: 'asc' }, { title: 'asc' }],
    });
  }

  async createComplianceRule(input: CreateComplianceRuleInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<OpsComplianceRule>({
      name: 'create_compliance_rule',
      eventId: input.eventId,
      validatePermission: () =>
        this.eventAccessPolicyService.requireActorRole(
          actor,
          [OpsUserRole.PmcmAdmin, OpsUserRole.System],
          'compliance rules',
          input.eventId,
        ),
      validateState: () => {
        if (!input.conditionKey?.trim()) throw new BadRequestException('Condition key is required');
        if (!input.title?.trim()) throw new BadRequestException('Compliance rule title is required');
      },
      write: () =>
        this.prisma.opsComplianceRule.create({
          data: {
            id: `crule_${randomUUID()}`,
            eventId: input.eventId ?? null,
            eventType: input.eventType?.trim() ?? '',
            phase: input.phase?.trim() || 'planning',
            severity: input.severity?.trim() || 'must_fix',
            layer: input.layer?.trim() || this.layerForSeverity(input.severity),
            conditionKey: input.conditionKey.trim(),
            title: input.title.trim(),
            note: input.note?.trim() ?? '',
            active: input.active ?? true,
          },
        }),
      sideEffects: async (rule) => {
        await this.auditService.audit(input.eventId, actor.name, `Created compliance rule: ${rule.title}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Create,
          category: AuditCategory.Compliance,
          affectedType: 'compliance_rule',
          affectedId: rule.id,
          affectedLabel: rule.title,
        });
      },
    });
  }

  async updateComplianceRule(ruleId: string, input: UpdateComplianceRuleInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<OpsComplianceRule>({
      name: 'update_compliance_rule',
      validatePermission: () =>
        this.eventAccessPolicyService.requireActorRole(
          actor,
          [OpsUserRole.PmcmAdmin, OpsUserRole.System],
          'compliance rules',
        ),
      write: () =>
        this.prisma.opsComplianceRule
          .update({ where: { id: ruleId }, data: this.updateComplianceRuleData(input) })
          .catch(() => {
            throw new NotFoundException('Compliance rule not found');
          }),
      sideEffects: async (rule) => {
        await this.auditService.audit(rule.eventId ?? undefined, actor.name, `Updated compliance rule: ${rule.title}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Compliance,
          affectedType: 'compliance_rule',
          affectedId: rule.id,
          affectedLabel: rule.title,
        });
      },
    });
  }

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
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
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

  async resolveCompliance(eventId: string, checkId: string, input: string | ResolveComplianceInput = {}) {
    const resolvedInput: ResolveComplianceInput = typeof input === 'string' ? { note: input } : input;
    const action = resolvedInput.action ?? 'resolve';
    const actorName = resolvedInput.actorName?.trim() || 'PMCM Admin';
    const now = new Date();

    return this.workflowCommandService.execute<OpsComplianceCheck>({
      name: action === 'override' ? 'override_compliance_item' : 'resolve_compliance_item',
      eventId,
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
        if (action === 'override' && !resolvedInput.overrideReason?.trim()) {
          throw new BadRequestException('Override reason is required');
        }
      },
      write: () =>
        this.prisma.opsComplianceCheck
          .update({
            where: { id: checkId },
            data:
              action === 'override'
                ? {
                    status: 'overridden',
                    note: resolvedInput.note ?? 'PMCM override recorded.',
                    overrideReason: resolvedInput.overrideReason!.trim(),
                    overrideAt: now,
                    overrideBy: actorName,
                  }
                : {
                    status: 'resolved',
                    note: resolvedInput.note ?? 'Compliance item resolved during PMCM review.',
                    resolvedAt: now,
                    resolvedBy: actorName,
                  },
          })
          .catch(() => {
            throw new NotFoundException('Compliance check not found');
          }),
      sideEffects: async (check) => {
        await this.auditService.audit(
          eventId,
          actorName,
          action === 'override' ? 'Overrode compliance item' : 'Resolved compliance item',
          {
            actionType: AuditActionType.Resolve,
            category: AuditCategory.Compliance,
            affectedType: 'compliance_check',
            affectedId: checkId,
            affectedLabel: check.title,
            severity: action === 'override' ? 'warning' : 'info',
            metadata: action === 'override' ? { overrideReason: resolvedInput.overrideReason } : { note: resolvedInput.note },
          },
        );
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

  private updateComplianceRuleData(input: UpdateComplianceRuleInput) {
    const data: Record<string, unknown> = {};
    if (input.eventId !== undefined) data.eventId = input.eventId || null;
    if (input.eventType !== undefined) data.eventType = input.eventType.trim();
    if (input.phase !== undefined) data.phase = input.phase.trim() || 'planning';
    if (input.severity !== undefined) data.severity = input.severity.trim() || 'must_fix';
    if (input.layer !== undefined) data.layer = input.layer.trim() || this.layerForSeverity(input.severity);
    if (input.conditionKey !== undefined) data.conditionKey = input.conditionKey.trim();
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.note !== undefined) data.note = input.note.trim();
    if (input.active !== undefined) data.active = input.active;
    return data;
  }

  private layerForSeverity(severity?: string) {
    if (severity === 'watch_out' || severity === 'should_fix') return 'Should-Fix';
    if (severity === 'advisory') return 'Advisory';
    return 'Must-Fix';
  }
}

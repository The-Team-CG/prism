import { Inject, BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { OpsComplianceCheck, OpsComplianceRule, OpsComplianceRisk, OpsComplianceRun, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit, EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FileRequirementsMatrixService } from '../files/file-requirements-matrix.service';
import { COMPLIANCE_RULE_REGISTRY, evaluateComplianceRuleForPhase, type ComplianceEvaluationContext } from './compliance-rule-registry';

export type ComplianceRunInput = { phase?: string; trigger?: 'manual' | 'scheduled' | 'state_change' };
export type ResolveComplianceInput = { action?: string; note?: string; overrideReason?: string };
export type CreateComplianceRuleInput = { eventId?: string; eventType?: string; phase?: string; severity?: string; layer?: string; conditionKey: string; title: string; note?: string; active?: boolean };
export type UpdateComplianceRuleInput = Partial<CreateComplianceRuleInput>;
export type CreateComplianceRiskInput = { phase: string; title: string; severity?: string; owner?: string; mitigation?: string; status?: string; reason?: string };
export type UpdateComplianceRiskInput = Partial<CreateComplianceRiskInput>;

function setDefinedField(data: Record<string, unknown>, key: string, value: unknown, map?: (value: unknown) => unknown) {
  if (value !== undefined) data[key] = map ? map(value) : value;
}

@Injectable()
export class ComplianceWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
    @Optional() private readonly fileRequirementsMatrixService?: FileRequirementsMatrixService,
  ) {}

  async listComplianceRules(actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance rules');
    const persisted = await this.prisma.opsComplianceRule.findMany({ take: 200, orderBy: [{ active: 'desc' }, { phase: 'asc' }, { title: 'asc' }] });
    const known = new Set(persisted.map((rule) => rule.conditionKey));
    const registryRules = COMPLIANCE_RULE_REGISTRY.filter((rule) => !known.has(rule.conditionKey)).map((rule) => ({
      id: rule.id, eventId: null, eventType: '', phase: rule.phases.join(','), severity: rule.severity, layer: rule.layer,
      conditionKey: rule.conditionKey, title: rule.title, note: rule.remediation, remediation: rule.remediation,
      definitionStatus: rule.definitionStatus, active: true, createdAt: new Date(0), updatedAt: new Date(0),
    }));
    return [...registryRules, ...persisted];
  }

  async createComplianceRule(input: CreateComplianceRuleInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<OpsComplianceRule>({
      name: 'create_compliance_rule', eventId: input.eventId,
      validatePermission: () => this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance rules', input.eventId),
      validateState: () => { if (!input.conditionKey?.trim()) throw new BadRequestException('Condition key is required'); if (!input.title?.trim()) throw new BadRequestException('Compliance rule title is required'); },
      write: () => this.prisma.opsComplianceRule.create({ data: {
        id: `crule_${randomUUID()}`, eventId: input.eventId ?? null, eventType: input.eventType?.trim() ?? '', phase: input.phase?.trim() || 'planning',
        severity: input.severity?.trim() || 'must_fix', layer: input.layer?.trim() || this.layerForSeverity(input.severity), conditionKey: input.conditionKey.trim(),
        title: input.title.trim(), note: input.note?.trim() ?? '', active: input.active ?? true, definitionStatus: 'PROVISIONAL', remediation: input.note?.trim() ?? '',
      } }),
      sideEffects: async (rule) => { await writeAudit(this.auditWriter, input.eventId, actor.name, `Created compliance rule: ${rule.title}`, { actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Compliance, affectedType: 'compliance_rule', affectedId: rule.id, affectedLabel: rule.title }); },
    });
  }

  async updateComplianceRule(ruleId: string, input: UpdateComplianceRuleInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<OpsComplianceRule>({
      name: 'update_compliance_rule', validatePermission: () => this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance rules'),
      write: () => this.prisma.opsComplianceRule.update({ where: { id: ruleId }, data: this.updateComplianceRuleData(input) }).catch(() => { throw new NotFoundException('Compliance rule not found'); }),
      sideEffects: async (rule) => { await writeAudit(this.auditWriter, rule.eventId ?? undefined, actor.name, `Updated compliance rule: ${rule.title}`, { actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Compliance, affectedType: 'compliance_rule', affectedId: rule.id, affectedLabel: rule.title }); },
    });
  }

  async runCompliance(eventId: string, input: ComplianceRunInput = {}, actor: ResolvedEventOpsActor): Promise<OpsComplianceCheck[]> {
    const phase = input.phase?.trim() || 'planning';
    const now = new Date();
    if (!this.prisma.opsComplianceRun) return this.runLegacyCompliance(eventId, phase, actor);
    const context = await this.loadContext(eventId);
    context.phase = phase;
    const registry = COMPLIANCE_RULE_REGISTRY;
    const persisted = (await this.prisma.opsComplianceRule.findMany({ where: { active: true, phase }, orderBy: [{ severity: 'asc' }, { title: 'asc' }] })).filter((rule) => this.ruleAppliesToEvent(rule, eventId, context.inquiry?.eventType ?? ''));
    const persistedByKey = new Map(persisted.map((rule) => [rule.conditionKey, rule]));
    const evaluations = registry.map((rule) => ({ rule, evaluation: evaluateComplianceRuleForPhase(rule, phase, context, now), persisted: persistedByKey.get(rule.conditionKey) }));
    const custom = persisted.filter((rule) => !COMPLIANCE_RULE_REGISTRY.some((known) => known.conditionKey === rule.conditionKey));
    return this.workflowCommandService.execute<OpsComplianceCheck[]>({
      name: 'run_compliance_checks', eventId,
      validatePermission: () => this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance', eventId),
      validateState: async () => { if (!context.event) throw new NotFoundException('Event not found'); },
      write: () => this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const run = await tx.opsComplianceRun.create({ data: { id: `crun_${randomUUID()}`, eventId, phase, trigger: input.trigger ?? 'manual', status: 'completed', startedAt: now, completedAt: new Date(), ruleCount: evaluations.length + custom.length } });
        const data = [...evaluations.map(({ rule, evaluation, persisted: dbRule }) => ({
          id: `chk_${randomUUID()}`, eventId, ruleId: dbRule?.id ?? rule.id, runId: run.id, layer: rule.layer, severity: rule.severity, phase,
          conditionKey: rule.conditionKey, title: rule.title, status: evaluation.status === 'not_satisfied' ? 'open' : 'resolved', evaluationStatus: evaluation.status,
          evidence: evaluation.evidence, definitionStatus: rule.definitionStatus, remediation: rule.remediation, note: rule.remediation,
        })), ...custom.map((rule) => ({
          id: `chk_${randomUUID()}`, eventId, ruleId: rule.id, runId: run.id, layer: rule.layer, severity: rule.severity, phase: rule.phase, conditionKey: rule.conditionKey,
          title: rule.title, status: 'open', evaluationStatus: 'not_applicable', evidence: ['No evaluator is registered for this custom condition key.'], definitionStatus: 'PROVISIONAL', remediation: rule.note, note: rule.note,
        }))];
        if (data.length) await tx.opsComplianceCheck.createMany({ data });
        for (const item of evaluations.filter(({ evaluation }) => evaluation.status === 'not_satisfied')) {
          const riskId = `crisk_rule_${eventId}_${phase}_${item.rule.id}`;
          const risk = await tx.opsComplianceRisk.upsert({
            where: { id: riskId },
            create: { id: riskId, eventId, phase, ruleId: item.persisted?.id ?? null, title: item.rule.title, severity: item.rule.severity === 'must_fix' ? 'high' : 'medium', owner: 'PMCM', mitigation: item.rule.remediation, status: 'open', source: 'rule' },
            update: { severity: item.rule.severity === 'must_fix' ? 'high' : 'medium', mitigation: item.rule.remediation, status: 'open' },
          });
          await tx.opsComplianceRiskHistory.create({ data: { id: `criskh_${randomUUID()}`, riskId: risk.id, action: 'raised', phase: risk.phase, severity: risk.severity, owner: risk.owner, mitigation: risk.mitigation, status: risk.status, actor: 'Compliance Engine', reason: item.evaluation.evidence.join(' ') } });
        }
        await tx.opsEvent.update({ where: { id: eventId }, data: { readiness: data.some((item) => item.evaluationStatus === 'not_satisfied' && item.severity === 'must_fix') ? 'Must-Fix item open' : 'Compliance review complete' } });
        return tx.opsComplianceCheck.findMany({ where: { runId: run.id }, orderBy: { createdAt: 'desc' } }) as Promise<OpsComplianceCheck[]>;
      }),
      sideEffects: async () => { await writeAudit(this.auditWriter, eventId, actor.name, 'Ran compliance checks', { actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Compliance, metadata: { phase, trigger: input.trigger ?? 'manual', ruleCount: evaluations.length + custom.length } }); },
    });
  }

  async listComplianceRuns(eventId: string, actor: ResolvedEventOpsActor): Promise<Array<OpsComplianceRun & { checks: OpsComplianceCheck[] }>> {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance runs', eventId);
    return this.prisma.opsComplianceRun.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 50, include: { checks: true } });
  }

  async listComplianceRisks(eventId: string, actor: ResolvedEventOpsActor): Promise<Array<OpsComplianceRisk & { history: Array<{ id: string; action: string; phase: string; severity: string; owner: string; mitigation: string; status: string; actor: string; reason: string; createdAt: Date }> }>> {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance risks', eventId);
    return this.prisma.opsComplianceRisk.findMany({ where: { eventId }, orderBy: { updatedAt: 'desc' }, include: { history: { orderBy: { createdAt: 'desc' } } } });
  }

  async createComplianceRisk(eventId: string, input: CreateComplianceRiskInput, actor: ResolvedEventOpsActor) { return this.mutateRisk(eventId, input, actor, 'create'); }
  async updateComplianceRisk(eventId: string, riskId: string, input: UpdateComplianceRiskInput, actor: ResolvedEventOpsActor) { return this.mutateRisk(eventId, input, actor, 'update', riskId); }

  async resolveCompliance(eventId: string, checkId: string, input: string | ResolveComplianceInput = {}, actor: ResolvedEventOpsActor) {
    const resolvedInput: ResolveComplianceInput = typeof input === 'string' ? { note: input } : input;
    const action = resolvedInput.action ?? 'resolve';
    const now = new Date();
    return this.workflowCommandService.execute<OpsComplianceCheck>({
      name: action === 'override' ? 'override_compliance_item' : 'resolve_compliance_item', eventId,
      validateState: async () => { if (!(await this.prisma.opsEvent.findUnique({ where: { id: eventId } }))) throw new NotFoundException('Event not found'); if (action === 'override' && !resolvedInput.overrideReason?.trim()) throw new BadRequestException('Override reason is required'); },
      write: () => this.prisma.opsComplianceCheck.update({ where: { id: checkId, eventId }, data: action === 'override' ? { status: 'overridden', note: resolvedInput.note ?? 'PMCM override recorded.', overrideReason: resolvedInput.overrideReason!.trim(), overrideAt: now, overrideBy: actor.name } : { status: 'resolved', note: resolvedInput.note ?? 'Compliance item resolved during PMCM review.', resolvedAt: now, resolvedBy: actor.name } }).catch(() => { throw new NotFoundException('Compliance check not found'); }),
      sideEffects: async (check) => { await writeAudit(this.auditWriter, eventId, actor.name, action === 'override' ? 'Overrode compliance item' : 'Resolved compliance item', { actionType: AuditActionType.Resolve, category: AuditCategory.Compliance, affectedType: 'compliance_check', affectedId: checkId, affectedLabel: check.title, severity: action === 'override' ? 'warning' : 'info', metadata: action === 'override' ? { overrideReason: resolvedInput.overrideReason, evaluationStatus: check.evaluationStatus } : { note: resolvedInput.note } }); },
    });
  }

  async runScheduledReevaluations(now = new Date()) {
    const events = await this.prisma.opsEvent.findMany({ where: { archived: false, eventDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } }, orderBy: [{ eventDate: 'asc' }, { id: 'asc' }], take: 100 });
    const actor = { role: OpsUserRole.System, name: 'Compliance Scheduler', email: 'system@prism.local', explicit: true } as ResolvedEventOpsActor;
    for (const event of events) { // Bounded by take above; one event is isolated from the next failure.
      try {
        const latest = await this.prisma.opsComplianceRun.findFirst({ where: { eventId: event.id, status: 'completed' }, orderBy: { createdAt: 'desc' } });
        const stateChanged = Boolean(latest?.completedAt && event.updatedAt > latest.completedAt);
        const due = !latest?.completedAt || now.getTime() - latest.completedAt.getTime() >= 60 * 60 * 1000;
        if (stateChanged || due) await this.runCompliance(event.id, { phase: this.phaseForEvent(event.status), trigger: stateChanged ? 'state_change' : 'scheduled' }, actor);
      } catch { /* unavailable dependencies leave persisted history untouched */ }
    }
  }

  private async loadContext(eventId: string): Promise<ComplianceEvaluationContext> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const [inquiry, briefings, documents, suppliers, coverageRequirements, coordinatorAssignments, billingSources, matrix, guestRoster] = await Promise.all([
      this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } }),
      this.prisma.opsBriefing.findMany({ where: { eventId } }),
      this.prisma.opsDocument.findMany({ where: { eventId } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, select: { id: true, supplierName: true, assignmentStatus: true, readinessStatus: true } }),
      this.prisma.opsEventCoverageRequirement.findMany({ where: { eventId }, select: { role: true, required: true } }),
      this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId }, select: { role: true, status: true, withdrawnAt: true } }),
      this.prisma.opsBillingSource.findMany({ where: { eventId }, select: { id: true, status: true } }),
      this.fileRequirementsMatrixService?.buildForEvent(eventId) ?? Promise.resolve({ eventId, items: [] }),
      this.prisma.opsGuestRosterEntry.count({ where: { eventId } }),
    ]);
    return { event: { id: event.id, status: event.status, eventDate: event.eventDate, walkInPolicy: event.walkInPolicy, walkInThreshold: event.walkInThreshold }, inquiry, briefings, documents, suppliers, coverageRequirements, coordinatorAssignments, billingSources, fileRequirements: matrix.items, guestRosterCount: guestRoster };
  }

  private async mutateRisk(eventId: string, input: CreateComplianceRiskInput | UpdateComplianceRiskInput, actor: ResolvedEventOpsActor, action: 'create' | 'update', riskId?: string) {
    return this.workflowCommandService.execute<OpsComplianceRisk>({
      name: `${action}_compliance_risk`, eventId,
      validatePermission: () => this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance risks', eventId),
      validateState: () => { if (action === 'create' && (!input.phase?.trim() || !input.title?.trim())) throw new BadRequestException('Risk phase and title are required'); if (input.status === 'closed' && !actor.name?.trim()) throw new BadRequestException('Closing actor is required'); },
      write: () => this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const data = { phase: input.phase?.trim(), title: input.title?.trim(), severity: input.severity?.trim(), owner: input.owner?.trim(), mitigation: input.mitigation?.trim(), status: input.status?.trim(), source: action === 'create' ? 'pmcm' : undefined, closedAt: input.status === 'closed' ? new Date() : undefined, closedBy: input.status === 'closed' ? actor.name : undefined };
        const risk = action === 'create' ? await tx.opsComplianceRisk.create({ data: { id: `crisk_${randomUUID()}`, eventId, phase: data.phase!, title: data.title!, severity: data.severity ?? 'medium', owner: data.owner ?? '', mitigation: data.mitigation ?? '', status: data.status ?? 'open', source: data.source!, closedAt: data.closedAt, closedBy: data.closedBy } }) : await tx.opsComplianceRisk.update({ where: { id: riskId!, eventId }, data });
        await tx.opsComplianceRiskHistory.create({ data: { id: `criskh_${randomUUID()}`, riskId: risk.id, action, phase: risk.phase, severity: risk.severity, owner: risk.owner, mitigation: risk.mitigation, status: risk.status, actor: actor.name, reason: input.reason?.trim() ?? '' } });
        return risk;
      }),
      sideEffects: async (risk) => { await writeAudit(this.auditWriter, eventId, actor.name, `${action === 'create' ? 'Created' : 'Updated'} compliance risk: ${risk.title}`, { actionType: action === 'create' ? AuditActionType.Create : AuditActionType.Update, category: AuditCategory.Compliance, affectedType: 'compliance_risk', affectedId: risk.id, affectedLabel: risk.title }); },
    });
  }

  private async runLegacyCompliance(eventId: string, phase: string, actor: ResolvedEventOpsActor) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } });
    const rules = (await this.prisma.opsComplianceRule.findMany({ where: { active: true, phase }, orderBy: [{ severity: 'asc' }, { title: 'asc' }] })).filter((rule) => this.ruleAppliesToEvent(rule, eventId, inquiry?.eventType ?? ''));
    return this.workflowCommandService.execute<OpsComplianceCheck[]>({ name: 'run_compliance_checks', eventId, write: () => this.prisma.$transaction(async (tx: Prisma.TransactionClient) => { await tx.opsComplianceCheck.deleteMany({ where: { eventId } }); if (rules.length) await tx.opsComplianceCheck.createMany({ data: rules.map((rule) => ({ id: `chk_${randomUUID()}`, eventId, ruleId: rule.id, layer: rule.layer, severity: rule.severity, phase: rule.phase, conditionKey: rule.conditionKey, title: rule.title, status: 'open', note: rule.note })) }); if (tx.opsEvent?.update) await tx.opsEvent.update({ where: { id: eventId }, data: { readiness: rules.some((rule) => rule.severity === 'must_fix') ? 'Must-Fix item open' : 'Compliance review open' } }); return tx.opsComplianceCheck.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }) as Promise<OpsComplianceCheck[]>; }), sideEffects: async () => { await writeAudit(this.auditWriter, eventId, actor.name, 'Ran compliance checks', { actionType: AuditActionType.Create, category: AuditCategory.Compliance, metadata: { phase, ruleCount: rules.length } }); } });
  }

  private phaseForEvent(status: string) { return ['pre_event', 'event_day', 'closure'].includes(status) ? status : 'planning'; }
  private ruleAppliesToEvent(rule: OpsComplianceRule, eventId: string, eventType: string) { return (!rule.eventId || rule.eventId === eventId) && (!rule.eventType || rule.eventType.trim().toLowerCase() === eventType.trim().toLowerCase()); }
  private updateComplianceRuleData(input: UpdateComplianceRuleInput) { const data: Record<string, unknown> = {}; setDefinedField(data, 'eventId', input.eventId, (value) => value || null); setDefinedField(data, 'eventType', input.eventType, (value) => String(value).trim()); setDefinedField(data, 'phase', input.phase, (value) => String(value).trim() || 'planning'); setDefinedField(data, 'severity', input.severity, (value) => String(value).trim() || 'must_fix'); setDefinedField(data, 'layer', input.layer, (value) => String(value).trim() || this.layerForSeverity(input.severity)); setDefinedField(data, 'conditionKey', input.conditionKey, (value) => String(value).trim()); setDefinedField(data, 'title', input.title, (value) => String(value).trim()); setDefinedField(data, 'note', input.note, (value) => String(value).trim()); setDefinedField(data, 'remediation', input.note, (value) => String(value).trim()); setDefinedField(data, 'active', input.active); return data; }
  private layerForSeverity(severity?: string) { return severity === 'watch_out' || severity === 'should_fix' ? 'Should-Fix' : severity === 'advisory' ? 'Advisory' : 'Must-Fix'; }
}

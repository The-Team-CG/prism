import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEventRisk } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { EVENT_RISK_PHASES, STANDARD_EVENT_RISKS, type CreateEventRiskInput, type PrismEventRisk, type UpdateEventRiskInput } from '@prism/types';

function mapRisk(row: OpsEventRisk): PrismEventRisk {
  return {
    id: row.id, eventId: row.eventId, phase: row.phase as PrismEventRisk['phase'], title: row.title,
    likelihood: row.likelihood, impact: row.impact, score: row.likelihood * row.impact,
    mitigation: row.mitigation, owner: row.owner, status: row.status as PrismEventRisk['status'],
    catalogKey: row.catalogKey, updatedBy: row.updatedBy, updatedAt: row.updatedAt.toISOString(),
  };
}

/** FR-07: PMCM's phase-organized risk register; the overall risk assessment stays separate. */
@Injectable()
export class EventRiskRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  private async requirePmcm(eventId: string, actor: ResolvedEventOpsActor, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventRisk[]> {
    await this.requirePmcm(eventId, actor, 'risk register');
    // QUERY_AUDIT_ALLOW_UNBOUNDED: one event's risk register.
    const rows = await this.prisma.opsEventRisk.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(mapRisk).sort((left, right) => EVENT_RISK_PHASES.indexOf(left.phase) - EVENT_RISK_PHASES.indexOf(right.phase) || right.score - left.score);
  }

  /** Adds any standard risk the event does not have yet; repeated loads change nothing. */
  async loadStandardRisks(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventRisk[]> {
    const event = await this.requirePmcm(eventId, actor, 'risk register');
    if (event.archived) throw new BadRequestException('Archived events cannot change the risk register');
    const result = await this.prisma.opsEventRisk.createMany({
      data: STANDARD_EVENT_RISKS.map((risk) => ({
        id: `risk_${randomUUID()}`, eventId, phase: risk.phase, title: risk.title, likelihood: risk.likelihood, impact: risk.impact,
        mitigation: risk.mitigation, catalogKey: risk.key, updatedBy: actor.name,
      })),
      skipDuplicates: true,
    });
    if (result.count > 0) await this.audit(eventId, actor, `Loaded ${result.count} standard risks`, AuditActionType.Create, 'risk_register', eventId);
    return this.list(eventId, actor);
  }

  async create(eventId: string, input: CreateEventRiskInput, actor: ResolvedEventOpsActor): Promise<PrismEventRisk> {
    const event = await this.requirePmcm(eventId, actor, 'risk register');
    if (event.archived) throw new BadRequestException('Archived events cannot change the risk register');
    const row = await this.prisma.opsEventRisk.create({ data: {
      id: `risk_${randomUUID()}`, eventId, phase: input.phase, title: input.title, likelihood: input.likelihood, impact: input.impact,
      mitigation: input.mitigation ?? '', owner: input.owner ?? '', updatedBy: actor.name,
    } });
    await this.audit(eventId, actor, `Added risk: ${row.title}`, AuditActionType.Create, 'event_risk', row.id);
    return mapRisk(row);
  }

  async update(eventId: string, riskId: string, input: UpdateEventRiskInput, actor: ResolvedEventOpsActor): Promise<PrismEventRisk> {
    const event = await this.requirePmcm(eventId, actor, 'risk register');
    if (event.archived) throw new BadRequestException('Archived events cannot change the risk register');
    const existing = await this.prisma.opsEventRisk.findFirst({ where: { id: riskId, eventId } });
    if (!existing) throw new NotFoundException('Risk not found');
    const row = await this.prisma.opsEventRisk.update({ where: { id: riskId }, data: { ...input, updatedBy: actor.name } });
    await this.audit(eventId, actor, `Updated risk: ${row.title}`, AuditActionType.Update, 'event_risk', row.id);
    return mapRisk(row);
  }

  private audit(eventId: string, actor: ResolvedEventOpsActor, action: string, actionType: string, affectedType: string, affectedId: string) {
    return writeAudit(this.auditWriter, eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType, affectedType, affectedId,
      metadata: { actorId: actor.id ?? null },
    });
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsAccreditationRequirement } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import type { CreateAccreditationRequirementInput, PrismAccreditationRequirement, UpdateAccreditationRequirementInput } from '@prism/types';

export function mapAccreditation(row: OpsAccreditationRequirement, now: Date): PrismAccreditationRequirement {
  return {
    id: row.id, eventId: row.eventId, documentName: row.documentName, status: row.status as PrismAccreditationRequirement['status'],
    dueAt: row.dueAt.toISOString(), submittedAt: row.submittedAt?.toISOString() ?? null, note: row.note,
    overdue: row.status !== 'accepted' && row.dueAt.getTime() < now.getTime(), updatedBy: row.updatedBy,
  };
}

/** FR-70: accreditation documents for large corporate clients, each with its own SLA. Planning never waits on them. */
@Injectable()
export class AccreditationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor, now = new Date()): Promise<PrismAccreditationRequirement[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'accreditation tracker', eventId);
    const rows = await this.prisma.opsAccreditationRequirement.findMany({ where: { eventId }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 100 });
    return rows.map((row) => mapAccreditation(row, now));
  }

  async create(eventId: string, input: CreateAccreditationRequirementInput, actor: ResolvedEventOpsActor, now = new Date()): Promise<PrismAccreditationRequirement> {
    await this.requireEvent(eventId, actor);
    const row = await this.prisma.opsAccreditationRequirement.create({ data: {
      id: `accr_${randomUUID()}`, eventId, documentName: input.documentName, note: input.note ?? '',
      dueAt: new Date(now.getTime() + (input.dueInDays ?? 7) * 86_400_000), updatedBy: actor.name,
    } });
    await this.audit(eventId, actor, `Requested accreditation document: ${row.documentName}`, AuditActionType.Create, row.id);
    return mapAccreditation(row, now);
  }

  async update(eventId: string, requirementId: string, input: UpdateAccreditationRequirementInput, actor: ResolvedEventOpsActor, now = new Date()): Promise<PrismAccreditationRequirement> {
    await this.requireEvent(eventId, actor);
    const existing = await this.prisma.opsAccreditationRequirement.findFirst({ where: { id: requirementId, eventId } });
    if (!existing) throw new NotFoundException('Accreditation requirement not found');
    const submittedAt = input.status === 'pending' ? null : existing.submittedAt ?? now;
    const row = await this.prisma.opsAccreditationRequirement.update({ where: { id: requirementId }, data: {
      status: input.status, submittedAt, ...(input.note !== undefined ? { note: input.note } : {}), updatedBy: actor.name,
    } });
    await this.audit(eventId, actor, `Accreditation ${row.documentName}: ${input.status}`, AuditActionType.Update, row.id);
    return mapAccreditation(row, now);
  }

  private async requireEvent(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'accreditation tracker', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');
  }

  private audit(eventId: string, actor: ResolvedEventOpsActor, action: string, actionType: string, affectedId: string) {
    return writeAudit(this.auditWriter, eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Compliance, actionType,
      affectedType: 'accreditation_requirement', affectedId, metadata: { actorId: actor.id ?? null },
    });
  }
}

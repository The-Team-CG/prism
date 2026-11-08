import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinatorRoleBrief } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES, OpsUserRole } from '@prism/kernel/event-core';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import { canonicalCoordinatorRole, type CoordinatorRole, type PrismCoordinatorRoleBrief, type UpsertCoordinatorRoleBriefInput } from '@prism/types';
import { STAFFING_READER } from '../../contracts/staffing-ops.tokens';
import type { StaffingReader } from '../../contracts/staffing-reader.port';

function mapBrief(row: OpsCoordinatorRoleBrief): PrismCoordinatorRoleBrief {
  return {
    eventId: row.eventId,
    role: row.role as CoordinatorRole,
    callTime: row.callTime?.toISOString() ?? null,
    attire: row.attire,
    script: row.script,
    instructions: row.instructions,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

/** New-CO2: PMCM writes one brief per event role; an assigned coordinator reads only the brief for their own role. */
@Injectable()
export class CoordinatorRoleBriefService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleBrief[]> {
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) {
      // QUERY_AUDIT_ALLOW_UNBOUNDED: at most one row per catalog coordinator role for the event.
      const rows = await this.prisma.opsCoordinatorRoleBrief.findMany({ where: { eventId }, orderBy: { role: 'asc' } });
      return rows.map(mapBrief);
    }
    if (actor.role !== OpsUserRole.Coordinator) throw new ForbiddenException('Only PMCM or an assigned coordinator can read role briefs');
    const assignment = await this.staffingReader.findAssignmentForEventActor(eventId, actor);
    const inactiveStatuses: readonly string[] = INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES;
    if (!assignment || inactiveStatuses.includes(assignment.status) || assignment.status === CoordinatorAssignmentStatus.Declined) {
      throw new ForbiddenException('Only a coordinator assigned to this event can read its role brief');
    }
    const role = canonicalCoordinatorRole(assignment.role);
    if (!role) return [];
    const row = await this.prisma.opsCoordinatorRoleBrief.findUnique({ where: { eventId_role: { eventId, role } } });
    return row ? [mapBrief(row)] : [];
  }

  async upsert(eventId: string, role: CoordinatorRole, input: UpsertCoordinatorRoleBriefInput, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleBrief> {
    const event = await this.eventReferences.findOperationsEvent(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived events cannot change role briefs');
    const data = { callTime: input.callTime ? new Date(input.callTime) : null, attire: input.attire, script: input.script, instructions: input.instructions, updatedBy: actor.name };
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.opsCoordinatorRoleBrief.upsert({
        where: { eventId_role: { eventId, role } },
        create: { id: `crb_${randomUUID()}`, eventId, role, ...data },
        update: data,
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Updated the ${role} brief`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Events,
        actionType: AuditActionType.Update,
        affectedType: 'coordinator_role_brief',
        affectedId: row.id,
        affectedLabel: role,
        metadata: { role, callTime: input.callTime, actorId: actor.id ?? null },
      }, { prisma: tx, correlationId: `coordinator-role-brief:${eventId}:${role}`, actorId: actor.id });
      return mapBrief(row);
    });
  }
}

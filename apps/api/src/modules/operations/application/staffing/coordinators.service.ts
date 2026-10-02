import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment, Prisma } from '@prisma/client';
import type { CreateCoordinatorAvailabilityInput, CreateCoordinatorCoverageRequirementInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import type { CoordinatorAssignmentListOptions } from '../../contracts/staffing-reader.port';
import { mapCoordinator as mapCoordinatorRecord, mapCoordinatorAssignment as mapCoordinatorAssignmentRecord } from './coordinators.mappers';
import { isoDate, sameText, timestamp } from './staffing.utils';
import { resolveCoordinatorForActor } from './coordinator-actor-lookup';
import { coordinatorAcknowledgementLeadTimeDays } from './coordinator-reminder-policy';

export type StaffingCoverageRow = {
  role: string;
  required: number;
  assigned: number;
  acknowledged: number;
  requiredSkills: string[];
  assignedSkills: string[];
  satisfied: boolean;
};

const MAX_STAFFING_COORDINATORS = 500;
const MAX_STAFFING_ASSIGNMENTS = 500;
const MAX_ACKNOWLEDGEMENT_HISTORY = 100;
const MAX_STAFFING_AVAILABILITY = 500;

type AvailabilityRow = {
  id: string;
  coordinatorId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  note: string;
  declaredBy: string;
  createdAt: Date;
};

function mapAvailability(row: AvailabilityRow) {
  return {
    id: row.id,
    coordinatorId: row.coordinatorId,
    startsAt: timestamp(row.startsAt),
    endsAt: timestamp(row.endsAt),
    kind: row.kind,
    note: row.note,
    declaredBy: row.declaredBy,
    createdAt: timestamp(row.createdAt),
  };
}

@Injectable()
export class CoordinatorsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  async listCoordinators() {
    const coordinators = await this.prisma.opsCoordinator.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: MAX_STAFFING_COORDINATORS,
    });
    return coordinators.map((coordinator: OpsCoordinator) => this.mapCoordinator(coordinator));
  }


  async listAssignmentsForCoordinator(
    coordinatorId?: string | null,
    options: CoordinatorAssignmentListOptions = {},
  ) {
    const includeHistorical = options.includeHistorical === true;
    return coordinatorId
      ? this.prisma.opsCoordinatorAssignment.findMany({
          where: includeHistorical
            ? { coordinatorId }
            : { coordinatorId, status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_STAFFING_ASSIGNMENTS,
          include: { acknowledgmentHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_ACKNOWLEDGEMENT_HISTORY } },
        })
      : [] as OpsCoordinatorAssignment[];
  }

  listAssignmentsForEvent(eventId: string) {
    return this.prisma.opsCoordinatorAssignment.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_STAFFING_ASSIGNMENTS,
      include: { acknowledgmentHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_ACKNOWLEDGEMENT_HISTORY } },
    });
  }

  countAssignmentsForEvent(eventId: string) {
    return this.prisma.opsCoordinatorAssignment.count({ where: { eventId } });
  }

  countPendingAssignmentsForEvent(eventId: string) {
    return this.prisma.opsCoordinatorAssignment.count({
      where: { eventId, status: { in: ['pending', CoordinatorAssignmentStatus.PendingAcknowledgement] } },
    });
  }

  async listAvailability(coordinatorId: string) {
    const rows = await this.prisma.opsCoordinatorAvailability.findMany({
      where: { coordinatorId },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: MAX_STAFFING_AVAILABILITY,
    });
    return rows.map(mapAvailability);
  }

  async createAvailability(
    coordinatorId: string,
    input: CreateCoordinatorAvailabilityInput,
    actor: ResolvedEventOpsActor,
    eventId?: string,
  ) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator availability');
    const coordinator = await this.prisma.opsCoordinator.findUnique({ where: { id: coordinatorId } });
    if (!coordinator) throw new NotFoundException('Coordinator not found');
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.opsCoordinatorAvailability.create({
        data: {
          id: `coord_avail_${randomUUID()}`,
          coordinatorId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          kind: input.kind,
          note: input.note ?? '',
          declaredBy: actor.name,
        },
      });
      await this.auditWriter.write({
        eventId,
        actor: actor.name,
        action: `Declared ${coordinator.name} ${input.kind} from ${isoDate(created.startsAt)} to ${isoDate(created.endsAt)}`,
        actionType: AuditActionType.Create,
        category: AuditCategory.Events,
        affectedType: 'coordinator_availability',
        affectedId: created.id,
        affectedLabel: coordinator.name,
        metadata: { kind: input.kind, startsAt: timestamp(created.startsAt), endsAt: timestamp(created.endsAt), note: input.note ?? '' },
      }, { prisma: tx, actorId: actor.id ?? actor.name, correlationId: `coord-availability:${created.id}` });
      return mapAvailability(created);
    });
  }

  async deleteAvailability(
    coordinatorId: string,
    availabilityId: string,
    actor: ResolvedEventOpsActor,
    eventId?: string,
  ) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator availability');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.opsCoordinatorAvailability.findFirst({
        where: { id: availabilityId, coordinatorId },
        include: { coordinator: { select: { name: true } } },
      });
      if (!existing) throw new NotFoundException('Availability entry not found');
      await tx.opsCoordinatorAvailability.delete({ where: { id: availabilityId } });
      await this.auditWriter.write({
        eventId,
        actor: actor.name,
        action: `Removed ${existing.kind} entry for ${existing.coordinator.name} (${isoDate(existing.startsAt)} to ${isoDate(existing.endsAt)})`,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'coordinator_availability',
        affectedId: existing.id,
        affectedLabel: existing.coordinator.name,
        metadata: { removed: true, kind: existing.kind, startsAt: timestamp(existing.startsAt), endsAt: timestamp(existing.endsAt), note: existing.note },
      }, { prisma: tx, actorId: actor.id ?? actor.name, correlationId: `coord-availability-removed:${existing.id}` });
      return { id: existing.id };
    });
  }

  async listCoverageForEvent(eventId: string): Promise<StaffingCoverageRow[]> {
    const [requirements, assignments, assignmentCounts] = await Promise.all([
      this.prisma.opsEventCoverageRequirement.findMany({ where: { eventId }, orderBy: [{ role: 'asc' }, { id: 'asc' }], take: MAX_STAFFING_ASSIGNMENTS }),
      this.prisma.opsCoordinatorAssignment.findMany({
        where: { eventId, status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] } },
        include: { coordinator: { select: { skillsTags: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_STAFFING_ASSIGNMENTS,
      }),
      this.prisma.opsCoordinatorAssignment.groupBy({
        by: ['role', 'status'],
        where: { eventId, status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] } },
        _count: { _all: true },
      }),
    ]);
    const countsByRole = new Map<string, { assigned: number; acknowledged: number }>();
    for (const row of assignmentCounts) {
      const current = countsByRole.get(row.role) ?? { assigned: 0, acknowledged: 0 };
      current.assigned += row._count._all;
      if (row.status === CoordinatorAssignmentStatus.Acknowledged) current.acknowledged += row._count._all;
      countsByRole.set(row.role, current);
    }
    return requirements.map((requirement) => {
      const roleAssignments = assignments.filter((item) => item.role === requirement.role);
      const exactCounts = countsByRole.get(requirement.role) ?? { assigned: 0, acknowledged: 0 };
      const assignedSkills = Array.from(new Set(
        roleAssignments.flatMap((assignment) => assignment.coordinator?.skillsTags ?? []),
      ));
      return {
        role: requirement.role,
        required: requirement.required,
        assigned: exactCounts.assigned,
        acknowledged: exactCounts.acknowledged,
        requiredSkills: requirement.requiredSkills,
        assignedSkills,
        satisfied:
          exactCounts.assigned >= requirement.required &&
          exactCounts.acknowledged >= requirement.required &&
          requirement.requiredSkills.every((skill) => assignedSkills.includes(skill)),
      };
    });
  }

  async upsertCoverageRequirement(
    eventId: string,
    input: CreateCoordinatorCoverageRequirementInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator coverage');
    await this.requireEvent(eventId);
    if (input.mapFromRole) {
      const mapFromRole = input.mapFromRole;
      return this.prisma.$transaction(async (transaction) => {
        const existingLegacyTarget = await transaction.opsEventCoverageRequirement.findUnique({
          where: { eventId_role: { eventId, role: mapFromRole } },
        });
        if (!existingLegacyTarget) {
          throw new NotFoundException('Historical coordinator coverage target not found');
        }

        const existingCatalogTarget = await transaction.opsEventCoverageRequirement.findUnique({
          where: { eventId_role: { eventId, role: input.role } },
        });
        if (existingCatalogTarget) {
          throw new ConflictException(`A coverage target for ${input.role} already exists; edit that target instead`);
        }

        return transaction.opsEventCoverageRequirement.update({
          where: { id: existingLegacyTarget.id },
          data: {
            role: input.role,
            required: input.required,
            requiredSkills: input.requiredSkills,
            updatedBy: actor.name,
          },
        });
      });
    }

    return this.prisma.opsEventCoverageRequirement.upsert({
      where: { eventId_role: { eventId, role: input.role } },
      create: {
        id: `coord_cov_${randomUUID()}`,
        eventId,
        role: input.role,
        required: input.required,
        requiredSkills: input.requiredSkills,
        createdBy: actor.name,
        updatedBy: actor.name,
      },
      update: {
        required: input.required,
        requiredSkills: input.requiredSkills,
        updatedBy: actor.name,
      },
    });
  }

  async enqueueAcknowledgementReminders(
    eventId: string | undefined,
    actor: ResolvedEventOpsActor,
    now = new Date(),
  ) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'coordinator acknowledgement reminders',
      eventId,
    );
    const leadTimeDays = coordinatorAcknowledgementLeadTimeDays();
    const firstReminderDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endExclusive = new Date(firstReminderDate);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + leadTimeDays + 1);
    const results = [] as Array<{ assignmentId: string; status: string; reason: string | null }>;
    let cursorAfter: string | undefined;
    while (true) {
      const assignments = await this.prisma.opsCoordinatorAssignment.findMany({
        where: {
          ...(eventId ? { eventId } : {}),
          ...(cursorAfter ? { id: { gt: cursorAfter } } : {}),
          status: { in: ['pending', CoordinatorAssignmentStatus.PendingAcknowledgement] },
          OR: [
            { eventDate: { gte: firstReminderDate, lt: endExclusive } },
            {
              eventDate: null,
              event: { is: { eventDate: { gte: firstReminderDate, lt: endExclusive } } },
            },
          ],
        },
        include: { event: { select: { eventName: true, eventDate: true } }, coordinator: { select: { email: true } } },
        orderBy: { id: 'asc' },
        take: MAX_STAFFING_ASSIGNMENTS,
      });
      for (const assignment of assignments) {
        const cycle = isoDate(assignment.eventDate ?? assignment.event.eventDate);
        const queued = await this.notificationOutboxWriter.write({
          eventId: assignment.eventId,
          recipient: assignment.coordinator?.email ?? assignment.coordinatorName,
          message: `Acknowledgment reminder: confirm your ${assignment.role} assignment for ${assignment.event.eventName}.`,
          channel: 'email',
          correlationId: `coord-ack-reminder:${assignment.id}:${cycle}`,
          idempotencyKey: `coord-ack-reminder:${assignment.id}:${cycle}`,
        });
        const delivered = queued as { status?: string; failureReason?: string } | null;
        results.push({
          assignmentId: assignment.id,
          status: delivered?.status ?? 'queued',
          reason: delivered?.failureReason ?? null,
        });
      }
      if (assignments.length < MAX_STAFFING_ASSIGNMENTS) break;
      cursorAfter = assignments[assignments.length - 1].id;
    }
    return { leadTimeDays, reminders: results };
  }

  async resolveCoordinatorForActor(
    actor: { id?: string | null; coordinatorId?: string | null; email?: string | null },
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return resolveCoordinatorForActor(prisma, actor);
  }

  async findAssignmentForEventActor(
    eventId: string,
    actor: { id?: string | null; coordinatorId?: string | null; email?: string | null },
  ) {
    const coordinator = await this.resolveCoordinatorForActor(actor);
    const assignments = (await this.listAssignmentsForEvent(eventId)).filter(
      (item) => item.status !== CoordinatorAssignmentStatus.Cancelled && item.status !== CoordinatorAssignmentStatus.Replaced,
    );
    return (
      assignments.find(
        (item) =>
          sameText(item.coordinatorId, coordinator.id),
      ) ?? null
    );
  }

  mapCoordinator(coordinator: OpsCoordinator) {
    return mapCoordinatorRecord(coordinator);
  }

  mapCoordinatorAssignment(assignment: OpsCoordinatorAssignment) {
    return mapCoordinatorAssignmentRecord(assignment);
  }

  private async requireEvent(eventId: string, prisma: Prisma.TransactionClient | PrismaService = this.prisma) {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

}

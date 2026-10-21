import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { CoordinatorAssignmentStatus, INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  LiveOpsAssignmentReference,
  LiveOpsCoordinatorReference,
  OperationsLiveOpsReferenceReader,
} from '../../contracts/live-ops-reference.port';

const LIVE_OPS_INELIGIBLE_ASSIGNMENT_STATUSES = [
  ...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES,
  CoordinatorAssignmentStatus.Declined,
] as const;

@Injectable()
export class LiveOpsReferenceService implements OperationsLiveOpsReferenceReader {
  constructor(private readonly prisma: PrismaService) {}

  findCoordinatorProfile(coordinatorId: string): Promise<LiveOpsCoordinatorReference | null> {
    return this.prisma.opsCoordinator.findUnique({
      where: { id: coordinatorId },
      select: { id: true, name: true, active: true },
    });
  }

  async findEligibleOperatorAssignment(
    eventId: string,
    coordinatorId: string,
    transaction: PrismTransactionContext,
  ): Promise<LiveOpsAssignmentReference | null> {
    const prisma = transaction.prisma;

    // QUERY_AUDIT_RAW_SQL: serialize operator eligibility with Operations profile deactivation.
    await prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "operations"."coordinators" WHERE "id" = ${coordinatorId} FOR UPDATE`);
    const coordinator = await prisma.opsCoordinator.findUnique({
      where: { id: coordinatorId },
      select: { id: true, name: true, active: true },
    });
    if (!coordinator?.active) return null;

    const candidates = await prisma.opsCoordinatorAssignment.findMany({
      where: {
        eventId,
        coordinatorId,
        status: { notIn: [...LIVE_OPS_INELIGIBLE_ASSIGNMENT_STATUSES] },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (candidates.length === 0) return null;

    const assignmentIds = candidates.map(({ id }) => id);
    // QUERY_AUDIT_RAW_SQL: lock candidate assignments before LiveOps records the operator designation.
    await prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "operations"."coordinator_assignments" WHERE "id" IN (${Prisma.join(assignmentIds)}) ORDER BY "id" FOR UPDATE`);

    const [assignment] = await prisma.opsCoordinatorAssignment.findMany({
      where: {
        eventId,
        coordinatorId,
        status: { notIn: [...LIVE_OPS_INELIGIBLE_ASSIGNMENT_STATUSES] },
      },
      select: { id: true, eventId: true, coordinatorId: true, coordinatorName: true, role: true, status: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1,
    });
    return assignment ? { ...assignment, coordinatorName: coordinator.name } : null;
  }

  async findEligibleHandoffAssignments(
    eventId: string,
    assignmentIds: readonly string[],
    transaction: PrismTransactionContext,
  ): Promise<LiveOpsAssignmentReference[]> {
    const ids = [...new Set(assignmentIds)].sort();
    if (ids.length !== assignmentIds.length || ids.length < 2) return [];

    const prisma = transaction.prisma;
    const initial = await prisma.opsCoordinatorAssignment.findMany({
      where: { id: { in: ids }, eventId },
      select: { id: true, coordinatorId: true },
      orderBy: { id: 'asc' },
    });
    if (initial.length !== ids.length || initial.some(({ coordinatorId }) => !coordinatorId)) return [];

    const coordinatorIds = [...new Set(initial.map(({ coordinatorId }) => coordinatorId!))].sort();
    // QUERY_AUDIT_RAW_SQL: lock Operations profiles before referenced assignments in a LiveOps handoff.
    await prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "operations"."coordinators" WHERE "id" IN (${Prisma.join(coordinatorIds)}) ORDER BY "id" FOR UPDATE`);
    // QUERY_AUDIT_RAW_SQL: serialize handoff eligibility with Operations cancellation and replacement.
    await prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "operations"."coordinator_assignments" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);

    const [assignments, activeCoordinators] = await Promise.all([
      prisma.opsCoordinatorAssignment.findMany({
        where: {
          id: { in: ids },
          eventId,
          status: { notIn: [...LIVE_OPS_INELIGIBLE_ASSIGNMENT_STATUSES] },
        },
        select: { id: true, eventId: true, coordinatorId: true, coordinatorName: true, role: true, status: true },
        orderBy: { id: 'asc' },
      }),
      prisma.opsCoordinator.findMany({
        where: { id: { in: coordinatorIds }, active: true },
        select: { id: true },
      }),
    ]);
    const activeCoordinatorIds = new Set(activeCoordinators.map(({ id }) => id));
    if (assignments.length !== ids.length || assignments.some(({ coordinatorId }) => !coordinatorId || !activeCoordinatorIds.has(coordinatorId))) {
      return [];
    }
    return assignments;
  }
}

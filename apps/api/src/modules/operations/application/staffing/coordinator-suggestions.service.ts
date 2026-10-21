import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent, Prisma } from '@prisma/client';
import { CoordinatorAssignmentStatus } from '@prism/kernel/event-core';
import { PrismaService } from '@prism/kernel/database';
import type { CoordinatorSuggestionsQueryInput, PrismCoordinatorSuggestion } from '@prism/types';
import { canonicalCoordinatorRole } from '@prism/types';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import { rankCoordinatorSuggestions } from './coordinator-suggestion-rules';

const STAFFING_QUERY_LIMIT = 500;

@Injectable()
export class CoordinatorSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
  ) {}

  async listForEvent(eventId: string, query: CoordinatorSuggestionsQueryInput): Promise<PrismCoordinatorSuggestion[]> {
    const event = await this.eventReferences.findOperationsEvent(eventId);
    if (!event) throw new NotFoundException('Event not found');

    return this.listForConflict(event, query.role, undefined, this.prisma, query.skills);
  }

  async listForConflict(
    event: Pick<OpsEvent, 'id' | 'eventDate'>,
    role: string,
    excludeCoordinatorId: string | undefined,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    selectedSkills: string[] = [],
  ): Promise<PrismCoordinatorSuggestion[]> {
    const canonicalRole = canonicalCoordinatorRole(role);
    if (!canonicalRole) return [];

    const eventDateEnd = new Date(event.eventDate.getTime() + 24 * 60 * 60 * 1000);
    const [coverageRequirements, coordinators] = await Promise.all([
      prisma.opsEventCoverageRequirement.findMany({
        where: { eventId: event.id },
        select: { role: true, requiredSkills: true },
        orderBy: [{ role: 'asc' }, { id: 'asc' }],
        take: STAFFING_QUERY_LIMIT,
      }),
      prisma.opsCoordinator.findMany({
        where: { active: true },
        select: { id: true, name: true, roleTags: true, skillsTags: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: STAFFING_QUERY_LIMIT,
      }),
    ]);

    const coordinatorIds = coordinators.map((coordinator) => coordinator.id);
    const [assignments, unavailable] = await Promise.all([
      prisma.opsCoordinatorAssignment.groupBy({
        by: ['coordinatorId'],
        where: {
          coordinatorId: { in: coordinatorIds },
          eventDate: event.eventDate,
          status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] },
        },
      }),
      prisma.opsCoordinatorAvailability.groupBy({
        by: ['coordinatorId'],
        where: {
          coordinatorId: { in: coordinatorIds },
          startsAt: { lt: eventDateEnd },
          endsAt: { gt: event.eventDate },
        },
      }),
    ]);

    const coverage = coverageRequirements.find((item) => canonicalCoordinatorRole(item.role) === canonicalRole);
    const busyIds = new Set(assignments.map((assignment) => assignment.coordinatorId).filter((id): id is string => Boolean(id)));
    const unavailableIds = new Set(unavailable.map((entry) => entry.coordinatorId));

    return rankCoordinatorSuggestions({
      coordinators: coordinators.filter(
        (coordinator) => !busyIds.has(coordinator.id) && !unavailableIds.has(coordinator.id),
      ),
      role: canonicalRole,
      requiredSkills: coverage?.requiredSkills ?? [],
      selectedSkills,
      excludeCoordinatorId,
    });
  }
}

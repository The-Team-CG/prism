import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CoordinatorSuggestionsService } from './coordinator-suggestions.service';

const event = {
  id: 'evt_main',
  eventDate: new Date('2026-06-18T00:00:00.000Z'),
};

const coordinators = [
  { id: 'coord_best', name: 'Rhea Santos', roleTags: [' floor   director '], skillsTags: [' registration ', 'first aid'], active: true },
  { id: 'coord_tie_a', name: 'Taylor Lee', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_tie_b', name: 'Taylor Lee', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_outside_availability', name: 'Alex Ng', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_missing_filter', name: 'Avery Cruz', roleTags: ['Floor Director'], skillsTags: ['first aid'], active: true },
  { id: 'coord_busy', name: 'Casey Lim', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_unavailable', name: 'Drew Reyes', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_inactive', name: 'Morgan Yu', roleTags: ['Floor Director'], skillsTags: ['registration'], active: false },
  { id: 'coord_wrong_role', name: 'Jordan Tan', roleTags: ['Stage Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_zeta_a', name: 'Zeta Avery', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_zeta_b', name: 'Zeta Blake', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_zeta_c', name: 'Zeta Cruz', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
  { id: 'coord_zeta_d', name: 'Zeta Diaz', roleTags: ['Floor Director'], skillsTags: ['registration'], active: true },
];

const assignments = [
  {
    eventId: 'evt_other',
    coordinatorId: 'coord_busy',
    eventDate: event.eventDate,
    status: 'acknowledged',
  },
];

const availability = [
  {
    coordinatorId: 'coord_unavailable',
    startsAt: new Date('2026-06-18T10:00:00.000Z'),
    endsAt: new Date('2026-06-18T14:00:00.000Z'),
  },
  {
    coordinatorId: 'coord_outside_availability',
    startsAt: new Date('2026-06-19T10:00:00.000Z'),
    endsAt: new Date('2026-06-19T14:00:00.000Z'),
  },
];

function createPrisma(eventResult: typeof event | null = event) {
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async () => eventResult),
    },
    opsEventCoverageRequirement: {
      findMany: vi.fn(async () => [{
          eventId: event.id,
          role: 'Floor Director',
          requiredSkills: ['Registration', 'First Aid'],
        }]),
    },
    opsCoordinator: {
      findMany: vi.fn(async (args: { where?: { active?: boolean } }) =>
        args.where?.active ? coordinators.filter((coordinator) => coordinator.active) : coordinators,
      ),
    },
    opsCoordinatorAssignment: {
      groupBy: vi.fn(async (args: {
        where?: {
          coordinatorId?: { in?: string[] };
          eventDate?: Date;
          status?: { notIn?: string[] };
        };
      }) => assignments
        .filter((assignment) => !args.where?.coordinatorId?.in || args.where.coordinatorId.in.includes(assignment.coordinatorId))
        .filter((assignment) => !args.where?.eventDate || assignment.eventDate.getTime() === args.where.eventDate.getTime())
        .filter((assignment) => !args.where?.status?.notIn?.includes(assignment.status))
        .map((assignment) => ({ coordinatorId: assignment.coordinatorId }))),
    },
    opsCoordinatorAvailability: {
      groupBy: vi.fn(async (args: {
        where?: {
          coordinatorId?: { in?: string[] };
          startsAt?: { lt?: Date };
          endsAt?: { gt?: Date };
        };
      }) => availability
        .filter((entry) => !args.where?.coordinatorId?.in || args.where.coordinatorId.in.includes(entry.coordinatorId))
        .filter((entry) => !args.where?.startsAt?.lt || entry.startsAt < args.where.startsAt.lt)
        .filter((entry) => !args.where?.endsAt?.gt || entry.endsAt > args.where.endsAt.gt)
        .map((entry) => ({ coordinatorId: entry.coordinatorId }))),
    },
  };
  const eventReferences = {
    findOperationsEvent: vi.fn(async () => eventResult ? {
      id: eventResult.id,
      eventName: 'Main Event',
      eventDate: eventResult.eventDate,
      status: 'planning',
      archived: false,
      actualEndedAt: null,
      walkInPolicy: 'closed',
      walkInThreshold: 0,
    } : null),
    findOperationsEvents: vi.fn(async () => []),
    findEventReadAccess: vi.fn(async () => null),
  };
  return { prisma, eventReferences };
}

describe('CoordinatorSuggestionsService', () => {
  it('returns eligible role matches filtered by every selected skill and ranked by coverage fit', async () => {
    const { prisma, eventReferences } = createPrisma();
    const service = new CoordinatorSuggestionsService(prisma as never, eventReferences as never);

    const suggestions = await service.listForEvent(event.id, {
      role: 'Floor Director',
      skills: ['registration'],
    });

    expect(suggestions.map((item) => item.id)).toEqual([
      'coord_best',
      'coord_outside_availability',
      'coord_tie_a',
      'coord_tie_b',
      'coord_zeta_a',
    ]);
    expect(suggestions).toHaveLength(5);
    expect(suggestions[0]).toMatchObject({
      role: 'Floor Director',
      matchedSkills: ['Registration', 'First Aid'],
      missingSkills: [],
      matchedSkillCount: 2,
      requiredSkillCount: 2,
    });
    expect(suggestions[1]).toMatchObject({
      matchedSkills: ['Registration'],
      missingSkills: ['First Aid'],
      matchedSkillCount: 1,
      requiredSkillCount: 2,
    });
    expect(eventReferences.findOperationsEvent).toHaveBeenCalledWith(event.id);
    expect(prisma.opsCoordinatorAssignment.groupBy).toHaveBeenCalledWith({
      by: ['coordinatorId'],
      where: {
        coordinatorId: { in: coordinators.filter((coordinator) => coordinator.active).map((coordinator) => coordinator.id) },
        eventDate: event.eventDate,
        status: { notIn: ['cancelled', 'replaced'] },
      },
    });
    expect(prisma.opsCoordinatorAvailability.groupBy).toHaveBeenCalledWith({
      by: ['coordinatorId'],
      where: {
        coordinatorId: { in: coordinators.filter((coordinator) => coordinator.active).map((coordinator) => coordinator.id) },
        startsAt: { lt: new Date('2026-06-19T00:00:00.000Z') },
        endsAt: { gt: event.eventDate },
      },
    });

    const fullyFiltered = await service.listForEvent(event.id, {
      role: 'Floor Director',
      skills: ['registration', 'first aid'],
    });
    expect(fullyFiltered.map((item) => item.id)).toEqual(['coord_best']);
  });

  it('returns not found when the event is outside the requested scope', async () => {
    const { prisma, eventReferences } = createPrisma(null);
    const service = new CoordinatorSuggestionsService(prisma as never, eventReferences as never);

    await expect(service.listForEvent(event.id, { role: 'Floor Director', skills: [] })).rejects.toBeInstanceOf(NotFoundException);
  });
});

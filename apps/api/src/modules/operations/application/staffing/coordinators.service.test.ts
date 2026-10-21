import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { AuditService, AuditWriterAdapter, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { NotificationOutboxService, NotificationOutboxWriterAdapter } from '@prism/contexts/platform-ops';
import { CoordinatorAssignmentStatus, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { CoordinatorsService } from './coordinators.service';
import { CoordinatorAssignmentCommandService } from './coordinator-assignment-command.service';
import { CoordinatorReliabilityNoteWriterService } from './coordinator-reliability-note-writer.service';
import { CoordinatorSuggestionsService } from './coordinator-suggestions.service';

const event = {
  id: 'evt_main',
  eventName: 'Main Event',
  eventDate: new Date('2026-06-18T00:00:00.000Z'),
};

const coordinator = {
  id: 'coord_marco',
  userId: 'usr_coord',
  name: 'Marco Santos',
  email: 'marco@pmcm.test',
  photoUrl: null,
  roleTags: ['Floor Director'],
  skillsTags: ['floorplan execution'],
  active: true,
  createdAt: new Date('2026-04-29T00:00:00.000Z'),
};

const pmcmAdminActor = { id: 'admin_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };
const coordinatorActor = { id: 'coord_marco', role: OpsUserRole.Coordinator, name: 'Marco Santos', email: 'marco@pmcm.test', explicit: true };
const clientActor = { id: 'client_1', role: OpsUserRole.Client, name: 'Some Client', explicit: true };

function createAccessPolicy() {
  return {
    resolveActor: (_input: unknown, verifiedActor?: unknown) => verifiedActor ?? pmcmAdminActor,
    requireActorRole: async (actor: { role: string }, roles: string[], resource: string) => {
      if (!roles.includes(actor.role)) {
        throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
      }
    },
    sameText: (left?: string | null, right?: string | null) =>
      Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase()),
    recordForbiddenAccess: async () => undefined,
  };
}

function createPrisma(coverageRequirements: { role: string; requiredSkills: string[] }[] = [], archived = false, eventStatus = 'planning') {
  const assignments: any[] = [
    {
      id: 'coord_asg_conflict',
      eventId: 'evt_conflict',
      coordinatorId: coordinator.id,
      coordinatorName: coordinator.name,
      role: 'Floor Director',
      status: 'pending_acknowledgement',
      doubleBookingWarning: false,
      eventDate: event.eventDate,
      conflictEventId: null,
      conflictEventName: null,
      acknowledgedAt: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      event: { id: 'evt_conflict', eventName: 'Other Event' },
    },
  ];
  const notifications: any[] = [];
  const audits: any[] = [];
  const availability: any[] = [];
  const acknowledgments: any[] = [];
  const reliabilityNotes: any[] = [];
  const transactionCalls: string[] = [];
  const queryOrder: string[] = [];
  const matchesValue = (value: unknown, condition: unknown): boolean => {
    if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
    if (condition && typeof condition === 'object') {
      const filter = condition as { in?: unknown[]; notIn?: unknown[]; not?: unknown; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
      const compare = (left: unknown, right: unknown) => left instanceof Date && right instanceof Date
        ? left.getTime() - right.getTime()
        : String(left).localeCompare(String(right));
      if (filter.in && !filter.in.includes(value)) return false;
      if (filter.notIn && filter.notIn.includes(value)) return false;
      if ('not' in filter && value === filter.not) return false;
      if (filter.lt && compare(value, filter.lt) >= 0) return false;
      if (filter.lte && compare(value, filter.lte) > 0) return false;
      if (filter.gt && compare(value, filter.gt) <= 0) return false;
      if (filter.gte && compare(value, filter.gte) < 0) return false;
      return true;
    }
    return value === condition;
  };
  const matchesWhere = (row: Record<string, any>, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, condition]) => key === 'OR' || matchesValue(row[key], condition));

  const prisma = {
    opsEvent: { findUnique: async ({ where }: { where?: { id?: string } } = {}) => ({ ...event, id: where?.id ?? event.id, status: eventStatus, archived }) },
    opsEventCoverageRequirement: { findMany: async () => coverageRequirements },
    opsCoordinator: {
      findUnique: async () => coordinator,
      findMany: async () => [coordinator],
    },
    opsCoordinatorAvailability: {
      findFirst: async ({ where }: { where?: { coordinatorId?: string; startsAt?: { lte?: Date; lt?: Date }; endsAt?: { gt?: Date } } } = {}) =>
        availability.find((row) => {
          if (where?.coordinatorId && row.coordinatorId !== where.coordinatorId) return false;
          if (where?.startsAt?.lte && row.startsAt > where.startsAt.lte) return false;
          if (where?.startsAt?.lt && row.startsAt >= where.startsAt.lt) return false;
          if (where?.endsAt?.gt && row.endsAt <= where.endsAt.gt) return false;
          return true;
        }) ?? null,
      findMany: async ({ where }: { where?: any } = {}) =>
        availability.filter((row) => {
          if (where?.coordinatorId?.in && !where.coordinatorId.in.includes(row.coordinatorId)) return false;
          if (where?.coordinatorId && typeof where.coordinatorId === 'string' && row.coordinatorId !== where.coordinatorId) return false;
          if (where?.startsAt?.lte && row.startsAt > where.startsAt.lte) return false;
          if (where?.startsAt?.lt && row.startsAt >= where.startsAt.lt) return false;
          if (where?.endsAt?.gt && row.endsAt <= where.endsAt.gt) return false;
          return true;
        }),
      groupBy: async ({ where }: { where?: { coordinatorId?: { in?: string[] }; startsAt?: { lt?: Date }; endsAt?: { gt?: Date } } } = {}) =>
        availability.filter((row) => {
          if (where?.coordinatorId?.in && !where.coordinatorId.in.includes(row.coordinatorId)) return false;
          if (where?.startsAt?.lt && row.startsAt >= where.startsAt.lt) return false;
          if (where?.endsAt?.gt && row.endsAt <= where.endsAt.gt) return false;
          return true;
        }).map((row) => ({ coordinatorId: row.coordinatorId })),
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: new Date() };
        availability.push(row);
        return row;
      },
    },
    opsCoordinatorAssignment: {
      findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        queryOrder.push('assignment.findFirst');
        return assignments.find((item) => matchesWhere(item, where)) ?? null;
      },
      findMany: async ({ where, take }: { where?: Record<string, any>; take?: number } = {}) => assignments.filter((assignment) => {
          if (!matchesWhere(assignment, where)) return false;
          if (where?.id?.gt && assignment.id <= where.id.gt) return false;
          if (where?.OR) {
            const matchesWindow = where.OR.some((condition: any) => {
              if (condition.eventDate === null && assignment.eventDate !== null) return false;
              if (condition.eventDate === null) return Boolean(condition.eventId?.in?.includes(assignment.eventId));
              const range = condition.eventDate;
              const date = assignment.eventDate;
              return Boolean(
                date && range &&
                (!range.gte || date >= range.gte) &&
                (!range.lt || date < range.lt),
              );
            });
            if (!matchesWindow) return false;
          }
          return true;
        }).sort((left, right) => left.id.localeCompare(right.id)).slice(0, take ?? Number.MAX_SAFE_INTEGER),
      groupBy: async ({ where }: {
        where?: { coordinatorId?: { in?: string[] }; eventDate?: Date; status?: { notIn?: string[] } };
      } = {}) => assignments
        .filter((assignment) => !where?.coordinatorId?.in || where.coordinatorId.in.includes(assignment.coordinatorId))
        .filter((assignment) => !where?.eventDate || assignment.eventDate.getTime() === where.eventDate.getTime())
        .filter((assignment) => !where?.status?.notIn?.includes(assignment.status))
        .map((assignment) => ({ coordinatorId: assignment.coordinatorId })),
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: new Date(), event };
        assignments.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => assignments.find((item) => item.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const targets = assignments.filter((item) => matchesWhere(item, where));
        targets.forEach((item) => Object.assign(item, data));
        return { count: targets.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = assignments.findIndex((item) => item.id === where.id);
        if (index < 0) throw new Error('not found');
        assignments[index] = { ...assignments[index], ...data };
        return assignments[index];
      },
    },
    opsCoordinatorAssignmentAcknowledgment: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: new Date() };
        acknowledgments.push(row);
        return row;
      },
    },
    opsCoordinatorReliabilityNote: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: new Date() };
        reliabilityNotes.push(row);
        return row;
      },
    },
    opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
    opsAuditLog: {
      findFirst: async () => null,
      create: async ({ data }: { data: unknown }) => {
        audits.push(data);
        return data;
      },
    },
    opsNotificationLog: {
      findFirst: async ({ where }: { where: { correlationId?: string } }) =>
        notifications.find((notification) => notification.correlationId === where.correlationId && notification.idempotencyKey == null) ?? null,
      upsert: async ({ where, create }: { where: { idempotencyKey: string }; create: Record<string, unknown> }) => {
        const existing = notifications.find((notification) => notification.idempotencyKey === where.idempotencyKey);
        if (existing) return existing;
        notifications.push(create);
        return create;
      },
      create: async ({ data }: { data: unknown }) => {
        notifications.push(data);
        return data;
      },
    },
    $transaction: async (callback: (tx: unknown) => unknown) => {
      transactionCalls.push('same_tx');
      return callback(prisma);
    },
    $queryRaw: vi.fn(async () => []),
    $executeRaw: async () => {
      queryOrder.push('pg_advisory_xact_lock');
      return 0;
    },
  };

  const eventReferences = {
    findOperationsEvent: vi.fn(async (eventId: string, context?: { prisma: any }) => {
      const source = await (context?.prisma ?? prisma).opsEvent.findUnique({ where: { id: eventId } });
      if (!source) return null;
      const linkedEvent = assignments.find((item) => item.eventId === eventId)?.event;
      return {
        id: eventId,
        eventName: linkedEvent?.eventName ?? source.eventName,
        eventDate: linkedEvent?.eventDate ?? source.eventDate,
        status: source.status,
        archived: source.archived,
        actualEndedAt: null,
        walkInPolicy: 'closed',
        walkInThreshold: 0,
      };
    }),
    findOperationsEvents: vi.fn(async (eventIds: readonly string[]) => Promise.all(eventIds.map(async (eventId) => {
      const source = await prisma.opsEvent.findUnique({ where: { id: eventId } });
      const linkedEvent = assignments.find((item) => item.eventId === eventId)?.event;
      return {
        id: eventId,
        eventName: linkedEvent?.eventName ?? source.eventName,
        eventDate: linkedEvent?.eventDate ?? source.eventDate,
        status: source.status,
        archived: source.archived,
        actualEndedAt: null,
        walkInPolicy: 'closed',
        walkInThreshold: 0,
      };
    }))),
    findEventIdsByDateRange: vi.fn(async (startsAt: Date, endsBefore: Date) => [...new Set(assignments
      .filter((item) => item.event?.eventDate && item.event.eventDate >= startsAt && item.event.eventDate < endsBefore)
      .map((item) => item.eventId))]),
    findEventReadAccess: vi.fn(),
  };
  (prisma as any).eventReferences = eventReferences;

  return {
    assignments,
    notifications,
    audits,
    availability,
    acknowledgments,
    reliabilityNotes,
    transactionCalls,
    queryOrder,
    prisma,
    eventReferences,
  };
}

function createServiceWriters(prisma: any) {
  const auditService = new AuditService(prisma);
  return {
    auditWriter: new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService)),
    notificationWriter: new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma)),
  };
}

function eventReferencesFor(prisma: any) {
  if (prisma.eventReferences) return prisma.eventReferences;
  const read = async (eventId: string, context?: { prisma: any }) => {
    const database = context?.prisma ?? prisma;
    const source = await database.opsEvent?.findUnique?.({ where: { id: eventId } });
    if (source === null) return null;
    return {
      id: eventId,
      eventName: source?.eventName ?? event.eventName,
      eventDate: source?.eventDate ?? event.eventDate,
      status: source?.status ?? 'planning',
      archived: source?.archived ?? false,
      actualEndedAt: null,
      walkInPolicy: 'closed',
      walkInThreshold: 0,
    };
  };
  return {
    findOperationsEvent: vi.fn(read),
    findOperationsEvents: vi.fn(async (eventIds: readonly string[]) => Promise.all(eventIds.map((eventId) => read(eventId)))),
    findEventIdsByDateRange: vi.fn(async () => []),
    findEventReadAccess: vi.fn(async () => null),
  };
}

function createService(prisma: any, accessPolicy: any = createAccessPolicy(), coordinatorAccountEligibility: any = { isCoordinatorAccountEligible: vi.fn(async () => true) }) {
  const writers = createServiceWriters(prisma);
  const eventReferences = eventReferencesFor(prisma);
  return new CoordinatorAssignmentCommandService(
    prisma,
    writers.auditWriter,
    writers.notificationWriter,
    new WorkflowCommandService(new PrismTransactionRunner(prisma)),
    accessPolicy,
    new CoordinatorSuggestionsService(prisma, eventReferences),
    new CoordinatorReliabilityNoteWriterService(prisma),
    eventReferences,
    coordinatorAccountEligibility,
  );
}

function createReaderService(prisma: any, accessPolicy: any = createAccessPolicy()) {
  const writers = createServiceWriters(prisma);
  return new CoordinatorsService(prisma, writers.auditWriter, writers.notificationWriter, accessPolicy, eventReferencesFor(prisma));
}

describe('Coordinator staffing workflows', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rechecks linked Identity eligibility under the assignment transaction', async () => {
    const fake = createPrisma();
    const coordinatorAccountEligibility = {
      isCoordinatorAccountEligible: vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    const service = createService(fake.prisma, createAccessPolicy(), coordinatorAccountEligibility);

    await expect(service.assignCoordinator('evt_main', {
      coordinatorId: coordinator.id,
      role: 'Floor Director',
      overrideConflict: true,
    }, pmcmAdminActor)).rejects.toThrow('Coordinator account is not currently eligible for assignment');

    expect(coordinatorAccountEligibility.isCoordinatorAccountEligible).toHaveBeenCalledTimes(2);
    expect(coordinatorAccountEligibility.isCoordinatorAccountEligible).toHaveBeenNthCalledWith(1, coordinator.userId, undefined);
    expect(coordinatorAccountEligibility.isCoordinatorAccountEligible).toHaveBeenNthCalledWith(2, coordinator.userId, expect.objectContaining({ prisma: fake.prisma }));
    expect(fake.assignments.some((assignment) => assignment.eventId === 'evt_main')).toBe(false);
  });

  describe('acknowledgement reminder scheduling', () => {
    it('queues one idempotent reminder for pending assignments within the configured lead window', async () => {
      vi.stubEnv('PRISM_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS', '7');
      const fake = createPrisma();
      const now = new Date('2026-10-02T08:30:00.000Z');
      const dueAssignment = {
        id: 'coord_asg_due',
        eventId: 'evt_due',
        eventDate: new Date('2026-10-09T00:00:00.000Z'),
        status: CoordinatorAssignmentStatus.PendingAcknowledgement,
        role: 'Floor Director',
        coordinatorName: 'Marco Santos',
        coordinator: { email: 'marco@pmcm.test' },
        event: { eventName: 'Upcoming Event', eventDate: new Date('2026-10-09T00:00:00.000Z') },
      };
      fake.assignments.push(
        dueAssignment,
        { ...dueAssignment, id: 'coord_asg_today', eventDate: new Date('2026-10-02T00:00:00.000Z') },
        {
          ...dueAssignment,
          id: 'coord_asg_legacy_null_date',
          eventDate: null,
          event: { eventName: 'Upcoming Event', eventDate: new Date('2026-10-09T00:00:00.000Z') },
        },
        { ...dueAssignment, id: 'coord_asg_too_late', eventDate: new Date('2026-10-01T00:00:00.000Z') },
        { ...dueAssignment, id: 'coord_asg_too_early', eventDate: new Date('2026-10-10T00:00:00.000Z') },
        { ...dueAssignment, id: 'coord_asg_acknowledged', status: CoordinatorAssignmentStatus.Acknowledged },
      );
      const service = createReaderService(fake.prisma as any);

      const result = await service.enqueueAcknowledgementReminders(undefined, {
        role: OpsUserRole.System,
        name: 'Scheduler',
        explicit: true,
      }, now);

      expect(result.leadTimeDays).toBe(7);
      expect(result.reminders).toHaveLength(3);
      expect(result.reminders.map((reminder) => reminder.assignmentId).sort()).toEqual([
        'coord_asg_due',
        'coord_asg_legacy_null_date',
        'coord_asg_today',
      ]);
      expect(result.reminders).toEqual(expect.arrayContaining([
        expect.objectContaining({ assignmentId: 'coord_asg_due', status: 'queued' }),
        expect.objectContaining({ assignmentId: 'coord_asg_legacy_null_date', status: 'queued' }),
        expect.objectContaining({ assignmentId: 'coord_asg_today', status: 'queued' }),
      ]));
      expect(fake.notifications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          eventId: 'evt_due',
          recipient: 'marco@pmcm.test',
          idempotencyKey: 'coord-ack-reminder:coord_asg_today:2026-10-02',
        }),
        expect.objectContaining({
          eventId: 'evt_due',
          recipient: 'marco@pmcm.test',
          idempotencyKey: 'coord-ack-reminder:coord_asg_due:2026-10-09',
        }),
        expect.objectContaining({
          eventId: 'evt_due',
          recipient: 'marco@pmcm.test',
          idempotencyKey: 'coord-ack-reminder:coord_asg_legacy_null_date:2026-10-09',
        }),
      ]));
    });

    it('continues through bounded pages so later assignments receive reminders', async () => {
      vi.stubEnv('PRISM_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS', '7');
      const fake = createPrisma();
      const now = new Date('2026-10-02T00:00:00.000Z');
      for (let index = 0; index < 501; index += 1) {
        fake.assignments.push({
          id: `coord_asg_${String(index).padStart(3, '0')}`,
          eventId: 'evt_due',
          eventDate: new Date('2026-10-09T00:00:00.000Z'),
          status: CoordinatorAssignmentStatus.PendingAcknowledgement,
          role: 'Floor Director',
          coordinatorName: `Coordinator ${index}`,
          coordinator: { email: `coordinator-${index}@pmcm.test` },
          event: { eventName: 'Upcoming Event', eventDate: new Date('2026-10-09T00:00:00.000Z') },
        });
      }
      const service = createReaderService(fake.prisma as any);

      const result = await service.enqueueAcknowledgementReminders(undefined, {
        role: OpsUserRole.System,
        name: 'Scheduler',
        explicit: true,
      }, now);

      expect(result.reminders).toHaveLength(501);
      expect(fake.notifications).toHaveLength(501);
    });
  });

  describe('upsertCoverageRequirement legacy role mapping', () => {
    it('renames the existing historical target atomically and preserves its identity', async () => {
      const coverageTargets = [{
        id: 'coverage_legacy',
        eventId: event.id,
        role: 'Volunteer Lead',
        required: 1,
        requiredSkills: ['crowd flow'],
        createdBy: 'original admin',
        updatedBy: 'original admin',
      }];
      const prisma = {
        opsEvent: { findUnique: async () => event },
        opsEventCoverageRequirement: {
          findUnique: async ({ where }: { where: { eventId_role: { eventId: string; role: string } } }) =>
            coverageTargets.find((target) => target.eventId === where.eventId_role.eventId && target.role === where.eventId_role.role) ?? null,
          update: async ({ where, data }: { where: { id: string }; data: Partial<(typeof coverageTargets)[number]> }) => {
            const target = coverageTargets.find((item) => item.id === where.id);
            if (!target) throw new Error('Coverage target not found');
            Object.assign(target, data);
            return target;
          },
        },
        $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
      };
      const service = createReaderService(prisma);

      const result = await service.upsertCoverageRequirement(event.id, {
        role: 'Usher',
        mapFromRole: 'Volunteer Lead',
        required: 2,
        requiredSkills: ['registration'],
      }, pmcmAdminActor);

      expect(result).toMatchObject({
        id: 'coverage_legacy',
        role: 'Usher',
        required: 2,
        requiredSkills: ['registration'],
        createdBy: 'original admin',
        updatedBy: pmcmAdminActor.name,
      });
      expect(coverageTargets).toHaveLength(1);
    });

    it('rejects mapping over an existing catalog target without changing either row', async () => {
      const coverageTargets = [
        { id: 'coverage_legacy', eventId: event.id, role: 'Volunteer Lead', required: 1, requiredSkills: ['crowd flow'] },
        { id: 'coverage_catalog', eventId: event.id, role: 'Usher', required: 3, requiredSkills: ['guest flow'] },
      ];
      let updateCount = 0;
      const prisma = {
        opsEvent: { findUnique: async () => event },
        opsEventCoverageRequirement: {
          findUnique: async ({ where }: { where: { eventId_role: { eventId: string; role: string } } }) =>
            coverageTargets.find((target) => target.eventId === where.eventId_role.eventId && target.role === where.eventId_role.role) ?? null,
          update: async () => {
            updateCount += 1;
            throw new Error('Unexpected update');
          },
        },
        $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
      };
      const service = createReaderService(prisma);

      await expect(service.upsertCoverageRequirement(event.id, {
        role: 'Usher',
        mapFromRole: 'Volunteer Lead',
        required: 2,
        requiredSkills: ['registration'],
      }, pmcmAdminActor)).rejects.toBeInstanceOf(ConflictException);
      expect(updateCount).toBe(0);
      expect(coverageTargets[0].role).toBe('Volunteer Lead');
      expect(coverageTargets[1]).toMatchObject({ required: 3, requiredSkills: ['guest flow'] });
    });

    it('rejects an actor without PMCM coverage rights', async () => {
      const service = createReaderService({} as never);

      await expect(service.upsertCoverageRequirement(event.id, {
        role: 'Usher',
        mapFromRole: 'Volunteer Lead',
        required: 2,
        requiredSkills: [],
      }, coordinatorActor)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('uses the canonical role spelling when a historical coordinator tag differs only by formatting', async () => {
    const fake = createPrisma();
    fake.assignments.splice(0);
    fake.prisma.opsCoordinator.findUnique = async () => ({ ...coordinator, roleTags: [' floor   director '] });
    const service = createService(fake.prisma as any);

    const assignment = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, overrideConflict: true },
      pmcmAdminActor,
    );

    expect(assignment.role).toBe('Floor Director');
  });

  it('rejects an omitted role when a coordinator only has legacy non-catalog tags', async () => {
    const fake = createPrisma();
    fake.assignments.splice(0);
    fake.prisma.opsCoordinator.findUnique = async () => ({ ...coordinator, roleTags: ['Volunteer Lead'] });
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(event.id, { coordinatorId: coordinator.id, overrideConflict: true }, pmcmAdminActor),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fake.assignments).toHaveLength(0);
  });

  it('rejects assignments when declared unavailability overlaps any time on the event date', async () => {
    const fake = createPrisma();
    fake.availability.push({
      id: 'coord_avail_blocked',
      coordinatorId: coordinator.id,
      startsAt: new Date('2026-06-18T13:00:00.000Z'),
      endsAt: new Date('2026-06-18T16:00:00.000Z'),
      kind: 'blocked',
      note: 'Medical leave',
    });
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director' }, pmcmAdminActor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COORDINATOR_UNAVAILABLE', availabilityId: 'coord_avail_blocked' }),
    });
  });

  it('computes persisted coverage from required roles, active assignments and coordinator skills', async () => {
    const requirements = [{ role: 'Floor Director', required: 1, requiredSkills: ['floorplan execution'] }];
    const assignments = [{
      role: 'Floor Director',
      status: CoordinatorAssignmentStatus.Acknowledged,
      coordinator: { skillsTags: ['floorplan execution'] },
    }];
    const prisma = {
      opsEventCoverageRequirement: { findMany: async () => requirements },
      opsCoordinatorAssignment: {
        findMany: async () => assignments,
        groupBy: async () => [{ role: 'Floor Director', status: CoordinatorAssignmentStatus.Acknowledged, _count: { _all: 1 } }],
      },
    };
    const service = createReaderService(prisma as any);

    await expect(service.listCoverageForEvent(event.id)).resolves.toEqual([{
      role: 'Floor Director',
      required: 1,
      assigned: 1,
      acknowledged: 1,
      requiredSkills: ['floorplan execution'],
      assignedSkills: ['floorplan execution'],
      satisfied: true,
    }]);
  });

  it('blocks a same-date conflict until PMCM overrides it', async () => {
    const fake = createPrisma([{
      role: 'Floor Director',
      requiredSkills: ['floorplan execution', 'registration'],
    }]);
    const replacementCandidate = {
      ...coordinator,
      id: 'coord_replacement',
      name: 'Rhea Santos',
      roleTags: ['Floor Director'],
      skillsTags: ['floorplan execution'],
    };
    fake.prisma.opsCoordinator.findMany = async () => [coordinator, replacementCandidate];
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director' }, pmcmAdminActor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'COORDINATOR_DOUBLE_BOOKING',
        sameRoleSuggestions: [{
          id: 'coord_replacement',
          name: 'Rhea Santos',
          role: 'Floor Director',
          matchedSkills: ['floorplan execution'],
          missingSkills: ['registration'],
          matchedSkillCount: 1,
          requiredSkillCount: 2,
        }],
      }),
    });

    const assignment = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    expect(assignment.doubleBookingWarning).toBe(true);
    expect(assignment.conflictEventName).toBe('Other Event');
    expect(fake.notifications).toHaveLength(2);
    expect(fake.audits).toHaveLength(1);
    expect(fake.transactionCalls).toEqual(['same_tx']);
    expect(fake.queryOrder.lastIndexOf('pg_advisory_xact_lock')).toBeLessThan(
      fake.queryOrder.lastIndexOf('assignment.findFirst'),
    );
  });

  it('rejects assignCoordinator for a non-PmcmAdmin actor', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        clientActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['cancelled', false],
    ['planning', true],
    ['archived', false],
  ] as const)('rejects assignment changes for status %s with archived=%s', async (eventStatus, archived) => {
    const fake = createPrisma([], archived, eventStatus);
    const service = createService(fake.prisma as never);

    await expect(service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    )).rejects.toThrow('Event is not active for coordinator assignment changes');

    expect(fake.assignments).toHaveLength(1);
  });

  it('reads active coordinator directory and coordinator assignments for workspace payloads', async () => {
    const fake = createPrisma();
    const service = createReaderService(fake.prisma as any);
    const assignmentCommands = createService(fake.prisma as any);
    await assignmentCommands.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    await expect(service.listCoordinators()).resolves.toEqual([
      expect.objectContaining({ id: 'coord_marco', name: 'Marco Santos' }),
    ]);
    const assignments = await service.listAssignmentsForCoordinator(coordinator.id);
    expect(assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinatorId: 'coord_marco',
          eventId: 'evt_main',
          role: 'Floor Director',
        }),
      ]),
    );
  });

  it('resolves coordinator identity by verified email or user identity, never a namesake', async () => {
    const fake = createPrisma();
    const namesake = { ...coordinator, id: 'coord_namesake', userId: 'usr_namesake', email: 'namesake@pmcm.test' };
    (fake.prisma.opsCoordinator as unknown as { findMany: () => Promise<typeof coordinator[]> }).findMany = async () => [coordinator, namesake];
    const service = createReaderService(fake.prisma as unknown);

    await expect(service.resolveCoordinatorForActor({ email: 'unknown@pmcm.test' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.resolveCoordinatorForActor({ id: coordinator.userId })).resolves.toMatchObject({ id: coordinator.id });
  });

  it('omits cancelled and replaced assignments from coordinator scope', async () => {
    const fake = createPrisma();
    fake.assignments.push(
      { ...fake.assignments[0], id: 'coord_asg_cancelled', status: 'cancelled' },
      { ...fake.assignments[0], id: 'coord_asg_replaced', status: 'replaced' },
    );
    const service = createReaderService(fake.prisma as unknown);
    const assignments = await service.listAssignmentsForCoordinator(coordinator.id);
    expect(assignments.map((item) => item.id)).not.toEqual(expect.arrayContaining(['coord_asg_cancelled', 'coord_asg_replaced']));
  });

  it('includes cancelled and replaced assignments when loading assigned event history', async () => {
    const fake = createPrisma();
    fake.assignments.push(
      { ...fake.assignments[0], id: 'coord_asg_cancelled', status: 'cancelled' },
      { ...fake.assignments[0], id: 'coord_asg_replaced', status: 'replaced' },
    );
    const service = createReaderService(fake.prisma as unknown);
    const assignments = await service.listAssignmentsForCoordinator(coordinator.id, { includeHistorical: true });
    expect(assignments.map((item) => item.id)).toEqual(
      expect.arrayContaining(['coord_asg_cancelled', 'coord_asg_replaced']),
    );
  });

  it('acknowledges a pending coordinator assignment for a PmcmAdmin actor', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    const acknowledged = await service.acknowledgeCoordinator(event.id, created.id, pmcmAdminActor);

    expect(acknowledged.status).toBe('acknowledged');
    expect(acknowledged.acknowledgedAt).toBeTruthy();
    expect(fake.transactionCalls).toEqual(['same_tx', 'same_tx']);
  });


  it('prevents a coordinator from acknowledging or withdrawing an archived event assignment', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as never);
    const created = await service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true }, pmcmAdminActor);
    const findEvent = fake.prisma.opsEvent.findUnique;
    fake.prisma.opsEvent.findUnique = async (args) => ({ ...(await findEvent(args)), archived: true });
    await expect(service.acknowledgeCoordinator(event.id, created.id, coordinatorActor)).rejects.toThrow('Archived coordinator events are read-only');
    await expect(service.withdrawCoordinator(event.id, created.id, { reason: 'Unavailable' }, coordinatorActor)).rejects.toThrow('Archived coordinator events are read-only');
    expect(fake.assignments.find((assignment) => assignment.id === created.id)?.status).toBe('pending_acknowledgement');
  });

  it('prevents PMCM from acknowledging or withdrawing an archived event assignment', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as never);
    const created = await service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true }, pmcmAdminActor);
    const findEvent = fake.prisma.opsEvent.findUnique;
    fake.prisma.opsEvent.findUnique = async (args) => ({ ...(await findEvent(args)), archived: true });

    await expect(service.acknowledgeCoordinator(event.id, created.id, pmcmAdminActor))
      .rejects.toThrow('Archived coordinator events are read-only');
    await expect(service.withdrawCoordinator(event.id, created.id, { reason: 'Event archived' }, pmcmAdminActor))
      .rejects.toThrow('Archived coordinator events are read-only');
    expect(fake.assignments.find((assignment) => assignment.id === created.id)?.status).toBe('pending_acknowledgement');
  });

  it('allows a Coordinator actor to acknowledge their own assignment (AC8 scoping decision)', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    const acknowledged = await service.acknowledgeCoordinator(event.id, created.id, coordinatorActor);

    expect(acknowledged.status).toBe('acknowledged');
  });

  it('records a coordinator decline reason and acknowledgement history', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );

    const declined = await service.acknowledgeCoordinator(
      event.id,
      created.id,
      coordinatorActor,
      { decision: 'declined', reason: 'Unavailable for this event' },
    );

    expect(declined).toMatchObject({ status: 'declined', acknowledgedBy: coordinatorActor.id, acknowledgementReason: 'Unavailable for this event' });
    expect(fake.acknowledgments).toEqual([
      expect.objectContaining({ assignmentId: created.id, state: 'declined', actor: coordinatorActor.id }),
    ]);
  });

  it('applies concurrent identical acknowledgments once and replays the resulting state', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );

    const [first, concurrentRetry] = await Promise.all([
      service.acknowledgeCoordinator(event.id, created.id, coordinatorActor),
      service.acknowledgeCoordinator(event.id, created.id, coordinatorActor),
    ]);

    expect(first.status).toBe('acknowledged');
    expect(concurrentRetry.status).toBe('acknowledged');
    expect(fake.acknowledgments.filter((entry) => entry.assignmentId === created.id)).toHaveLength(1);
    expect(fake.audits.filter((entry: any) => entry.action === 'Acknowledged coordinator assignment')).toHaveLength(1);
  });

  it('rejects acknowledgeCoordinator for an actor that is neither PmcmAdmin nor Coordinator', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    await expect(service.acknowledgeCoordinator(event.id, created.id, clientActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects acknowledgeCoordinator when a Coordinator actor is not the assignment owner (PA-276)', async () => {
    const fake = createPrisma();
    const coordinatorB = { ...coordinator, id: 'coord_taylor', name: 'Taylor Cruz', email: 'taylor@pmcm.test' };

    // Local override: this test needs two resolvable coordinators; other tests in this
    // file rely on createPrisma()'s single-coordinator fixture and must stay unaffected.
    (fake.prisma.opsCoordinator as any).findMany = async () => [coordinator, coordinatorB];
    (fake.prisma.opsCoordinator as any).findUnique = async ({ where }: { where: { id: string } }) =>
      [coordinator, coordinatorB].find((item) => item.id === where.id) ?? null;

    const service = createService(fake.prisma as any);
    const assignmentForB = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinatorB.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );

    await expect(
      service.acknowledgeCoordinator(event.id, assignmentForB.id, coordinatorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects acknowledgeCoordinator when the assignment does not belong to the route eventId (PA-276)', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );

    await expect(
      service.acknowledgeCoordinator('evt_conflict', created.id, pmcmAdminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects acknowledgeCoordinator when the assignment is already withdrawn or replaced', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );
    await service.withdrawCoordinator(event.id, created.id, { reason: 'No longer available' }, pmcmAdminActor);

    await expect(
      service.acknowledgeCoordinator(event.id, created.id, pmcmAdminActor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-owning Coordinator with Forbidden even when the assignment is withdrawn or replaced, ownership checked before status', async () => {
    const fake = createPrisma();
    const coordinatorB = { ...coordinator, id: 'coord_taylor', name: 'Taylor Cruz', email: 'taylor@pmcm.test' };
    (fake.prisma.opsCoordinator as any).findMany = async () => [coordinator, coordinatorB];
    (fake.prisma.opsCoordinator as any).findUnique = async ({ where }: { where: { id: string } }) =>
      [coordinator, coordinatorB].find((item) => item.id === where.id) ?? null;

    const service = createService(fake.prisma as any);
    const assignmentForB = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinatorB.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );
    await service.withdrawCoordinator(event.id, assignmentForB.id, { reason: 'No longer available' }, pmcmAdminActor);

    await expect(
      service.acknowledgeCoordinator(event.id, assignmentForB.id, coordinatorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('withdrawCoordinator', () => {
    it('withdraws a pending assignment', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      const withdrawn = await service.withdrawCoordinator(event.id, created.id, { reason: 'No longer available' }, pmcmAdminActor);

      expect(withdrawn.status).toBe('cancelled');
      expect(fake.reliabilityNotes).toHaveLength(1);
      expect(fake.reliabilityNotes[0]).toMatchObject({
        eventId: event.id,
        coordinatorId: coordinator.id,
        assignmentId: created.id,
        note: 'Marco Santos withdrew from Floor Director: No longer available',
        severity: 'warning',
      });
      expect(fake.notifications.length).toBeGreaterThan(0);
      expect(fake.audits.some((entry: any) => entry.action?.includes('Withdrew'))).toBe(true);
    });

    it('allows the owning Coordinator to withdraw with a required reason', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      await expect(
        service.withdrawCoordinator(event.id, created.id, { reason: 'No longer available' }, coordinatorActor),
      ).resolves.toMatchObject({ status: 'cancelled', withdrawalReason: 'No longer available' });
    });

    it('rejects withdrawing an assignment that is already cancelled or replaced', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );
      await service.withdrawCoordinator(event.id, created.id, { reason: 'No longer available' }, pmcmAdminActor);

      await expect(
        service.withdrawCoordinator(event.id, created.id, { reason: 'Already withdrawn' }, pmcmAdminActor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects withdrawing an assignment that does not exist', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);

      await expect(
        service.withdrawCoordinator(event.id, 'coord_asg_missing', { reason: 'No longer available' }, pmcmAdminActor),
      ).rejects.toThrow('Coordinator assignment not found');
    });
  });

  describe('replaceCoordinator', () => {
    it('replaces an assignment with a new coordinator atomically', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );
      fake.transactionCalls.length = 0;

      const result = await service.replaceCoordinator(
        event.id,
        created.id,
        { replacementCoordinatorId: coordinator.id, replacementRole: 'Floor Director', reason: 'Scheduling conflict', overrideConflict: true },
        pmcmAdminActor,
      );

      expect(result.outgoing.status).toBe('replaced');
      expect(result.outgoing.replacedByAssignmentId).toBe(result.incoming.id);
      expect(result.outgoing.replacementReason).toBe('Scheduling conflict');
      expect(result.outgoing.replacedBy).toBe(pmcmAdminActor.name);
      expect(result.incoming.status).toBe('pending_acknowledgement');
      expect(fake.transactionCalls).toEqual(['same_tx']);
    });

    it('rejects a non-PmcmAdmin actor', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      await expect(
        service.replaceCoordinator(
          event.id,
          created.id,
          { replacementCoordinatorId: coordinator.id, reason: 'PMCM reassignment', overrideConflict: true },
          coordinatorActor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects replacement after the event is archived without creating a replacement', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );
      const assignmentCountBeforeReplacement = fake.assignments.length;
      const findEvent = fake.prisma.opsEvent.findUnique;
      fake.prisma.opsEvent.findUnique = async (args) => ({ ...(await findEvent(args)), archived: true });

      await expect(service.replaceCoordinator(
        event.id,
        created.id,
        { replacementCoordinatorId: coordinator.id, replacementRole: 'Floor Director', reason: 'Archived event' },
        pmcmAdminActor,
      )).rejects.toThrow('Archived coordinator events are read-only');

      expect(fake.assignments).toHaveLength(assignmentCountBeforeReplacement);
      expect(fake.assignments.find((assignment) => assignment.id === created.id)?.status).toBe('pending_acknowledgement');
    });

    it('rejects a same-date conflict on the replacement coordinator until overridden', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      await expect(
        service.replaceCoordinator(
          event.id,
          created.id,
          { replacementCoordinatorId: coordinator.id, replacementRole: 'Floor Director', reason: 'Scheduling conflict' },
          pmcmAdminActor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Operations assignment ownership commands', () => {
    const activeAssignment = (overrides: Record<string, unknown> = {}) => ({
      id: 'coord_asg_event_day',
      eventId: event.id,
      coordinatorId: coordinator.id,
      coordinatorName: coordinator.name,
      role: 'Floor Director',
      status: CoordinatorAssignmentStatus.Acknowledged,
      attendanceStatus: 'pending',
      attendanceMarkedAt: null,
      attendanceNotes: '',
      doubleBookingWarning: false,
      eventDate: event.eventDate,
      conflictEventId: null,
      conflictEventName: null,
      acknowledgedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      event,
      ...overrides,
    });

    it('owns attendance updates and suppresses duplicate reliability and audit effects on an exact retry', async () => {
      const fake = createPrisma();
      const row = activeAssignment();
      fake.assignments.push(row);
      const service = createService(fake.prisma as any);
      const input = { status: 'late', notes: 'Arrived after call time' } as const;

      const first = await service.updateCoordinatorAttendance(event.id, row.id, input, coordinatorActor);
      const retry = await service.updateCoordinatorAttendance(event.id, row.id, input, coordinatorActor);

      expect(first).toMatchObject({ changed: true, assignment: { id: row.id, attendanceStatus: 'late', attendanceNotes: input.notes } });
      expect(retry).toMatchObject({ changed: false, assignment: first.assignment });
      expect(fake.reliabilityNotes).toHaveLength(1);
      expect(fake.reliabilityNotes[0]).toMatchObject({
        eventId: event.id,
        coordinatorId: coordinator.id,
        assignmentId: row.id,
        severity: 'warning',
      });
      expect(fake.audits.filter((entry: any) => entry.action?.includes('Updated coordinator attendance'))).toHaveLength(1);
    });

    it('rejects attendance updates after the event is archived without changing the assignment', async () => {
      const fake = createPrisma();
      const row = activeAssignment();
      fake.assignments.push(row);
      const service = createService(fake.prisma as any);
      const findEvent = fake.prisma.opsEvent.findUnique;
      fake.prisma.opsEvent.findUnique = async (args) => ({ ...(await findEvent(args)), archived: true });

      await expect(service.updateCoordinatorAttendance(
        event.id,
        row.id,
        { status: 'present', notes: 'Marked after archive' },
        pmcmAdminActor,
      )).rejects.toThrow('Archived coordinator events are read-only');

      expect(row).toMatchObject({ attendanceStatus: 'pending', attendanceNotes: '' });
      expect(fake.reliabilityNotes).toHaveLength(0);
      expect(fake.audits.filter((entry: any) => entry.action?.includes('Updated coordinator attendance'))).toHaveLength(0);
    });

    it('rejects a coordinator attempting to mark another coordinator attendance', async () => {
      const fake = createPrisma();
      fake.assignments.push(activeAssignment());
      const coordinatorB = { ...coordinator, id: 'coord_taylor', userId: 'usr_taylor', name: 'Taylor Cruz', email: 'taylor@pmcm.test' };
      (fake.prisma.opsCoordinator as any).findMany = async () => [coordinator, coordinatorB];
      const service = createService(fake.prisma as any);
      const actor = { id: coordinatorB.userId, role: OpsUserRole.Coordinator, name: coordinatorB.name, email: coordinatorB.email, explicit: true };

      await expect(service.updateCoordinatorAttendance(
        event.id,
        'coord_asg_event_day',
        { status: 'present' },
        actor,
      )).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('releases only active assignments owned by the cancelled event', async () => {
      const fake = createPrisma();
      const active = activeAssignment({ id: 'coord_asg_active' });
      const alreadyCancelled = activeAssignment({ id: 'coord_asg_cancelled', status: CoordinatorAssignmentStatus.Cancelled, withdrawalReason: 'Coordinator withdrew' });
      const otherEvent = activeAssignment({ id: 'coord_asg_other_event', eventId: 'evt_other' });
      fake.assignments.push(active, alreadyCancelled, otherEvent);
      const service = createService(fake.prisma as any);

      const impact = await service.applyEventDecisionAssignments(
        event.id,
        { decision: 'cancelled', reason: 'Client confirmed', supplierImpact: 'pending_review' },
        event.eventDate.toISOString(),
        event.eventDate.toISOString(),
        pmcmAdminActor,
        { prisma: fake.prisma as any, actorId: pmcmAdminActor.id, correlationId: 'test-cancel-decision' },
      );

      expect(impact.releasedAssignmentIds).toEqual(['coord_asg_active']);
      expect(active).toMatchObject({ status: CoordinatorAssignmentStatus.Cancelled, withdrawalReason: 'Event cancelled: Client confirmed' });
      expect(fake.assignments.find((row) => row.id === alreadyCancelled.id)?.withdrawalReason).toBe('Coordinator withdrew');
      expect(otherEvent.status).toBe(CoordinatorAssignmentStatus.Acknowledged);
    });

    it('reschedules owned assignments and returns a cross-event booking conflict', async () => {
      const fake = createPrisma();
      const moved = activeAssignment({ id: 'coord_asg_to_move' });
      const booking = activeAssignment({
        id: 'coord_asg_conflicting_booking',
        eventId: 'evt_other',
        eventDate: new Date('2026-07-18T00:00:00.000Z'),
        event: { id: 'evt_other', eventName: 'Other Event' },
      });
      fake.assignments.push(moved, booking);
      const service = createService(fake.prisma as any);

      const impact = await service.applyEventDecisionAssignments(
        event.id,
        { decision: 'postponed', reason: 'Venue unavailable', supplierImpact: 'preserve_obligations', newEventDate: '2026-07-18' },
        event.eventDate.toISOString(),
        '2026-07-18T00:00:00.000Z',
        pmcmAdminActor,
        { prisma: fake.prisma as any, actorId: pmcmAdminActor.id, correlationId: 'test-postpone-decision' },
      );

      expect(moved.eventDate).toEqual(new Date('2026-07-18T00:00:00.000Z'));
      expect(moved).toMatchObject({ doubleBookingWarning: true, conflictEventId: 'evt_other', conflictEventName: 'Other Event' });
      expect(impact.reschedule?.conflicts).toEqual([{
        assignmentId: moved.id,
        coordinatorName: coordinator.name,
        reason: 'double_booking',
        conflictEventId: 'evt_other',
        conflictEventName: 'Other Event',
      }]);
    });

    it('rejects an assignment date that does not match the event decision', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);

      await expect(service.applyEventDecisionAssignments(
        event.id,
        { decision: 'postponed', reason: 'Venue unavailable', supplierImpact: 'preserve_obligations', newEventDate: '2026-08-18' },
        event.eventDate.toISOString(),
        '2026-07-18T00:00:00.000Z',
        pmcmAdminActor,
        { prisma: fake.prisma as any, actorId: pmcmAdminActor.id, correlationId: 'test-invalid-postpone' },
      )).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

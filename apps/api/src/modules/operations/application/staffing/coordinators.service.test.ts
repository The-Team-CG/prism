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

function createPrisma(coverageRequirements: { role: string; requiredSkills: string[] }[] = []) {
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

  const prisma = {
    opsEvent: { findUnique: async () => event },
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
      findMany: async ({ where }: { where?: { coordinatorId?: string; startsAt?: { lte?: Date; lt?: Date }; endsAt?: { gt?: Date } } } = {}) =>
        availability.filter((row) => {
          if (where?.coordinatorId && row.coordinatorId !== where.coordinatorId) return false;
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
      findFirst: async ({ where }: { where?: { id?: string } } = {}) => {
        queryOrder.push('assignment.findFirst');
        if (where?.id) {
          return assignments.find((item) => item.id === where.id) ?? null;
        }
        return assignments[0] ?? null;
      },
      findMany: async ({ where, take }: {
        where?: {
          eventId?: string;
          id?: { gt?: string };
          coordinatorId?: string;
          coordinatorName?: string;
          status?: { notIn?: string[]; in?: string[] };
          OR?: Array<{
            eventDate?: { gte?: Date; lt?: Date } | null;
            event?: { is?: { eventDate?: { gte?: Date; lt?: Date } } };
          }>;
        };
        take?: number;
      } = {}) => assignments.filter((assignment) => {
          if (where?.eventId && assignment.eventId !== where.eventId) return false;
          if (where?.id?.gt && assignment.id <= where.id.gt) return false;
          if (where?.coordinatorId && assignment.coordinatorId !== where.coordinatorId) return false;
          if (where?.coordinatorName && assignment.coordinatorName !== where.coordinatorName) return false;
          if (where?.status?.notIn?.includes(assignment.status)) return false;
          if (where?.status?.in && !where.status.in.includes(assignment.status)) return false;
          if (where?.OR) {
            const matchesWindow = where.OR.some((condition) => {
              if (condition.eventDate === null && assignment.eventDate !== null) return false;
              const date = condition.eventDate === null ? assignment.event?.eventDate : assignment.eventDate;
              const range = condition.eventDate === null ? condition.event?.is?.eventDate : condition.eventDate;
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
    $executeRaw: async () => {
      queryOrder.push('pg_advisory_xact_lock');
      return 0;
    },
  };

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
  };
}

function createServiceWriters(prisma: any) {
  const auditService = new AuditService(prisma);
  return {
    auditWriter: new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService)),
    notificationWriter: new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma)),
  };
}

function createService(prisma: any, accessPolicy: any = createAccessPolicy()) {
  const writers = createServiceWriters(prisma);
  return new CoordinatorAssignmentCommandService(
    prisma,
    writers.auditWriter,
    writers.notificationWriter,
    new WorkflowCommandService(new PrismTransactionRunner(prisma)),
    accessPolicy,
    new CoordinatorSuggestionsService(prisma),
    new CoordinatorReliabilityNoteWriterService(prisma),
  );
}

function createReaderService(prisma: any, accessPolicy: any = createAccessPolicy()) {
  const writers = createServiceWriters(prisma);
  return new CoordinatorsService(prisma, writers.auditWriter, writers.notificationWriter, accessPolicy);
}

describe('Coordinator staffing workflows', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
});

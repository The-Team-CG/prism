import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { OpsEventEodReport, OpsEventHandoff, OpsEventScheduleSegment, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor, writeAudit, AUDIT_WRITER, type AuditWriter } from '@prism/kernel/access-control';
import { CoordinatorAssignmentStatus, INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES, OpsUserRole } from '@prism/kernel/event-core';
import { STAFFING_READER, type StaffingReader } from '@prism/contexts/operations';
import { LIVE_OPS_READ_MODEL, type LiveOpsReadModel } from '@prism/contexts/read-models';
import type {
  CreateEventEodReplyInput,
  CreateEventEodReportInput,
  CreateEventHandoffInput,
  CreateEventOperatorDesignationInput,
  CreateEventScheduleDayInput,
  CreateEventScheduleSegmentInput,
  PrismEventEodReport,
  PrismEventHandoff,
  PrismEventOperatorDesignation,
  PrismEventRunSheet,
  PrismEventSchedule,
  PrismEventScheduleDay,
  PrismEventScheduleSegment,
  PrismLiveOpsTimer,
  UpdateEventScheduleSegmentStatusInput,
} from '@prism/types';

export type LiveOpsClock = { now(): Date };

/** A coordinator who left, was replaced, or declined cannot run the event, so they cannot be its operator. */
const OPERATOR_INELIGIBLE_ASSIGNMENT_STATUSES = [
  ...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES,
  CoordinatorAssignmentStatus.Declined,
];

export class SystemLiveOpsClock implements LiveOpsClock {
  now() { return new Date(); }
}

export function deriveLiveOpsTimer(schedule: PrismEventSchedule, now: Date): PrismLiveOpsTimer {
  const serverTime = now.toISOString();
  const segments = schedule.days.flatMap((day) => day.segments).sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt));
  if (!segments.length) return { status: 'no_schedule', label: 'No schedule authored', serverTime };
  const active = segments.find((segment) => {
    const start = new Date(segment.actualStartedAt ?? segment.plannedStartAt).getTime();
    const end = new Date(segment.actualEndedAt ?? segment.plannedEndAt).getTime();
    return now.getTime() >= start && now.getTime() < end && segment.status !== 'skipped';
  });
  if (active) {
    const start = new Date(active.actualStartedAt ?? active.plannedStartAt).getTime();
    const end = new Date(active.actualEndedAt ?? active.plannedEndAt).getTime();
    return { status: 'active', label: active.title, segmentId: active.id, secondsElapsed: Math.max(0, Math.floor((now.getTime() - start) / 1000)), secondsRemaining: Math.max(0, Math.ceil((end - now.getTime()) / 1000)), serverTime };
  }
  const next = segments.find((segment) => new Date(segment.actualEndedAt ?? segment.plannedEndAt).getTime() > now.getTime() && segment.status !== 'skipped');
  if (next && now.getTime() < new Date(next.actualStartedAt ?? next.plannedStartAt).getTime()) {
    return { status: segments.indexOf(next) === 0 ? 'before_start' : 'between_segments', label: next.title, segmentId: next.id, secondsRemaining: Math.max(0, Math.ceil((new Date(next.actualStartedAt ?? next.plannedStartAt).getTime() - now.getTime()) / 1000)), serverTime };
  }
  return { status: 'complete', label: 'Schedule complete', serverTime };
}

function mapSegment(segment: OpsEventScheduleSegment): PrismEventScheduleSegment {
  return {
    id: segment.id, dayId: segment.dayId, sequence: segment.sequence, title: segment.title,
    plannedStartAt: segment.plannedStartAt.toISOString(), plannedEndAt: segment.plannedEndAt.toISOString(),
    ownerRole: segment.ownerRole, location: segment.location, status: segment.status,
    actualStartedAt: segment.actualStartedAt?.toISOString() ?? null, actualEndedAt: segment.actualEndedAt?.toISOString() ?? null,
    startVarianceMinutes: segment.actualStartedAt ? Math.round((segment.actualStartedAt.getTime() - segment.plannedStartAt.getTime()) / 60000) : null,
    endVarianceMinutes: segment.actualEndedAt ? Math.round((segment.actualEndedAt.getTime() - segment.plannedEndAt.getTime()) / 60000) : null,
  };
}

function strings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function mapHandoff(handoff: OpsEventHandoff): PrismEventHandoff {
  return {
    id: handoff.id,
    eventId: handoff.eventId,
    dayId: handoff.dayId,
    role: handoff.role,
    fromAssignmentId: handoff.fromAssignmentId,
    toAssignmentId: handoff.toAssignmentId,
    handedOffBy: handoff.handedOffBy,
    receivedBy: handoff.receivedBy,
    handedOffAt: handoff.handedOffAt.toISOString(),
    outstandingItems: strings(handoff.outstandingItems),
  };
}

function mapEodReport(report: OpsEventEodReport & { replies?: Array<{ id: string; reportId: string; authorId: string; authorRole: string; body: string; createdAt: Date }> }, actor: ResolvedEventOpsActor): PrismEventEodReport {
  return {
    id: report.id,
    eventId: report.eventId,
    dayId: report.dayId,
    authoredBy: report.authoredBy,
    authoredByRole: report.authoredByRole,
    canEdit: actor.role === OpsUserRole.Coordinator && report.authoredBy === (actor.id ?? actor.name),
    progress: strings(report.progress),
    issues: strings(report.issues),
    risksForTomorrow: strings(report.risksForTomorrow),
    submittedAt: report.submittedAt.toISOString(),
    replies: (report.replies ?? []).map((reply) => ({
      id: reply.id,
      reportId: reply.reportId,
      authorId: reply.authorId,
      authorRole: reply.authorRole,
      body: reply.body,
      createdAt: reply.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class EventScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
    @Inject(LIVE_OPS_READ_MODEL) private readonly liveOpsReadModel: LiveOpsReadModel,
    @Optional() private readonly clock: LiveOpsClock = new SystemLiveOpsClock(),
  ) {}

  async getSchedule(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventSchedule> {
    const liveOps = await this.liveOpsReadModel.getEventLiveOps(eventId, actor);
    return liveOps.schedule ?? { eventId, authored: false, days: [], serverTime: this.clock.now().toISOString() };
  }

  async createDay(eventId: string, input: CreateEventScheduleDayInput, actor: ResolvedEventOpsActor) {
    await this.requireScheduleWriter(eventId, actor);
    const day = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opsEventScheduleDay.create({ data: { id: `esd_${randomUUID()}`, eventId, dayDate: new Date(`${input.dayDate}T00:00:00.000Z`), label: input.label?.trim() ?? '' } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Authored event schedule day: ${input.dayDate}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'create', category: 'live_ops', affectedType: 'event_schedule_day', affectedId: created.id }, { prisma: tx, actorId: actor.id, correlationId: `schedule-day:${created.id}` });
      return created;
    });
    return { id: day.id, eventId: day.eventId, dayDate: day.dayDate.toISOString().slice(0, 10), label: day.label, status: day.status, segments: [] } as PrismEventScheduleDay;
  }

  async createSegment(eventId: string, dayId: string, input: CreateEventScheduleSegmentInput, actor: ResolvedEventOpsActor) {
    await this.requireScheduleWriter(eventId, actor);
    const start = new Date(input.plannedStartAt); const end = new Date(input.plannedEndAt);
    const segment = await this.prisma.$transaction(async (tx) => {
      const day = await tx.opsEventScheduleDay.findFirst({ where: { id: dayId, eventId } });
      if (!day) throw new NotFoundException('Schedule day not found');
      const sequence = input.sequence ?? ((await tx.opsEventScheduleSegment.count({ where: { dayId } })));
      const created = await tx.opsEventScheduleSegment.create({ data: { id: `ess_${randomUUID()}`, dayId, sequence, title: input.title.trim(), plannedStartAt: start, plannedEndAt: end, ownerRole: input.ownerRole.trim(), location: input.location?.trim() ?? '' } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Authored schedule segment: ${created.title}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'create', category: 'live_ops', affectedType: 'event_schedule_segment', affectedId: created.id }, { prisma: tx, actorId: actor.id, correlationId: `schedule-segment:${created.id}` });
      return created;
    });
    return mapSegment(segment);
  }

  async updateSegmentStatus(eventId: string, segmentId: string, input: UpdateEventScheduleSegmentStatusInput, actor: ResolvedEventOpsActor) {
    await this.requireScheduleWriter(eventId, actor);
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.opsEventScheduleSegment.findFirst({ where: { id: segmentId, day: { eventId } } });
      if (!current) throw new NotFoundException('Schedule segment not found');
      const transitionAllowed = current.status === 'planned'
        ? input.action === 'start' || input.action === 'skip'
        : current.status === 'active'
          ? input.action === 'stop' || input.action === 'skip'
          : false;
      if (!transitionAllowed) throw new BadRequestException(`Cannot ${input.action} a ${current.status} schedule segment`);
      const data: Prisma.OpsEventScheduleSegmentUpdateInput = input.action === 'start'
        ? { status: 'active', actualStartedAt: current.actualStartedAt ?? now }
        : input.action === 'stop' ? { status: 'complete', actualEndedAt: current.actualEndedAt ?? now }
          : { status: 'skipped', ...(current.status === 'active' ? { actualEndedAt: current.actualEndedAt ?? now } : {}) };
      const transition = await tx.opsEventScheduleSegment.updateMany({ where: { id: segmentId, status: current.status }, data });
      if (transition.count !== 1) throw new ConflictException('Schedule segment changed while you were updating it. Reload and try again.');
      const updated = await tx.opsEventScheduleSegment.findFirst({ where: { id: segmentId, day: { eventId } } });
      if (!updated) throw new NotFoundException('Schedule segment not found');
      const dayStatus = input.action === 'start' ? 'active'
        : (await tx.opsEventScheduleSegment.count({ where: { dayId: current.dayId, status: { notIn: ['complete', 'skipped'] } } })) === 0 ? 'complete' : 'active';
      await tx.opsEventScheduleDay.update({ where: { id: current.dayId }, data: { status: dayStatus } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Updated schedule segment: ${input.action}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'update', category: 'live_ops', affectedType: 'event_schedule_segment', affectedId: segmentId, metadata: { action: input.action, at: now.toISOString() } }, { prisma: tx, actorId: actor.id, correlationId: `schedule-segment-status:${segmentId}:${input.action}:${now.toISOString()}` });
      return mapSegment(updated);
    });
  }

  async designateOperator(eventId: string, input: CreateEventOperatorDesignationInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'event day system operator designation', eventId);
    const designation = await this.prisma.$transaction(async (tx) => {
      const coordinator = await tx.opsCoordinator.findFirst({ where: { id: input.coordinatorId, active: true } });
      if (!coordinator) throw new NotFoundException('Coordinator not found');
      // Designating replaces the current operator, so an unassigned pick would strip a working operator and then be refused every operator action.
      const working = await tx.opsCoordinatorAssignment.findFirst({
        where: { eventId, coordinatorId: coordinator.id, status: { notIn: [...OPERATOR_INELIGIBLE_ASSIGNMENT_STATUSES] } },
        select: { id: true },
      });
      if (!working) throw new BadRequestException('The Event Day System Operator must be a coordinator assigned to this event');
      await tx.opsEventOperatorDesignation.updateMany({ where: { eventId, revokedAt: null }, data: { revokedAt: this.clock.now(), revokedBy: actor.id ?? actor.name } });
      const created = await tx.opsEventOperatorDesignation.create({ data: { id: `eodsg_${randomUUID()}`, eventId, coordinatorId: coordinator.id, designatedBy: actor.id ?? actor.name } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Designated event day system operator: ${coordinator.name}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'assign', category: 'live_ops', affectedType: 'event_operator_designation', affectedId: created.id }, { prisma: tx, actorId: actor.id, correlationId: `operator-designation:${created.id}` });
      return created;
    });
    return designation;
  }

  async getOperatorDesignation(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventOperatorDesignation> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event day system operator designation', eventId);
    const current = await this.prisma.opsEventOperatorDesignation.findFirst({
      where: { eventId, revokedAt: null },
      include: { coordinator: { select: { name: true } } },
      orderBy: [{ designatedAt: 'desc' }, { id: 'desc' }],
    });
    return {
      eventId,
      operator: current
        ? { coordinatorId: current.coordinatorId, coordinatorName: current.coordinator.name, designatedAt: current.designatedAt.toISOString() }
        : null,
    };
  }

  async createHandoff(eventId: string, input: CreateEventHandoffInput, actor: ResolvedEventOpsActor): Promise<PrismEventHandoff> {
    await this.requireEventDayAuthority(eventId, actor, input.fromAssignmentId);
    const at = input.handedOffAt ? new Date(input.handedOffAt) : this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const [day, from, to] = await Promise.all([
        tx.opsEventScheduleDay.findFirst({ where: { id: input.dayId, eventId } }),
        tx.opsCoordinatorAssignment.findFirst({ where: { id: input.fromAssignmentId, eventId, status: { notIn: OPERATOR_INELIGIBLE_ASSIGNMENT_STATUSES } } }),
        tx.opsCoordinatorAssignment.findFirst({ where: { id: input.toAssignmentId, eventId, status: { notIn: OPERATOR_INELIGIBLE_ASSIGNMENT_STATUSES } } }),
      ]);
      if (!day) throw new NotFoundException('Schedule day not found');
      if (!from || !to) throw new NotFoundException('Coordinator assignment not found');
      if (from.id === to.id) throw new BadRequestException('Handoff must transfer to a different coordinator assignment');
      if (from.role !== input.role || to.role !== input.role) throw new BadRequestException('Handoff assignments must share the requested role');
      const created = await tx.opsEventHandoff.create({ data: { id: `eh_${randomUUID()}`, eventId, dayId: input.dayId, role: input.role.trim(), fromAssignmentId: from.id, toAssignmentId: to.id, handedOffBy: actor.id ?? actor.name, receivedBy: to.coordinatorId ?? to.coordinatorName, handedOffAt: at, outstandingItems: toPrismaJson(input.outstandingItems) } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Recorded coordinator handoff: ${input.role}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'update', category: 'live_ops', affectedType: 'event_handoff', affectedId: created.id, metadata: { fromAssignmentId: from.id, toAssignmentId: to.id, outstandingItems: input.outstandingItems } }, { prisma: tx, actorId: actor.id, correlationId: `handoff:${created.id}` });
      return mapHandoff(created);
    });
  }

  async listHandoffs(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventHandoff[]> {
    await this.requireEventDayAuthority(eventId, actor);
    const handoffs = await this.prisma.opsEventHandoff.findMany({
      where: { eventId },
      orderBy: [{ handedOffAt: 'desc' }, { id: 'desc' }],
    });
    return handoffs.map(mapHandoff);
  }

  async submitEodReport(eventId: string, input: CreateEventEodReportInput, actor: ResolvedEventOpsActor): Promise<PrismEventEodReport> {
    await this.access.requireActorRole(actor, [OpsUserRole.Coordinator], 'EOD report submission', eventId);
    await this.requireEventDayAuthority(eventId, actor);
    const submittedAt = input.submittedAt ? new Date(input.submittedAt) : this.clock.now();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const day = await tx.opsEventScheduleDay.findFirst({ where: { id: input.dayId, eventId } });
        if (!day) throw new NotFoundException('Schedule day not found');
        const author = actor.id ?? actor.name;
        const existing = await tx.opsEventEodReport.findUnique({ where: { eventId_dayId: { eventId, dayId: input.dayId } } });
        if (existing && existing.authoredBy !== author) throw new ForbiddenException('Only the original coordinator can update this end-of-day report');
        const report = existing
          ? await tx.opsEventEodReport.update({ where: { id: existing.id }, data: { progress: toPrismaJson(input.progress), issues: toPrismaJson(input.issues), risksForTomorrow: toPrismaJson(input.risksForTomorrow), submittedAt } })
          : await tx.opsEventEodReport.create({ data: { id: `eod_${randomUUID()}`, eventId, dayId: input.dayId, authoredBy: author, authoredByRole: actor.role, progress: toPrismaJson(input.progress), issues: toPrismaJson(input.issues), risksForTomorrow: toPrismaJson(input.risksForTomorrow), submittedAt } });
        const action = existing ? 'Updated' : 'Submitted';
        await writeAudit(this.auditWriter, eventId, actor.name, `${action} EOD report for ${day.dayDate.toISOString().slice(0, 10)}`, { actorRole: actor.role, actorEmail: actor.email, actionType: existing ? 'update' : 'create', category: 'live_ops', affectedType: 'event_eod_report', affectedId: report.id }, { prisma: tx, actorId: actor.id, correlationId: `eod-report:${report.id}:${submittedAt.toISOString()}` });
        return mapEodReport(report, actor);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictException('An end-of-day report was saved for this day. Reload before submitting again.');
      throw error;
    }
  }

  async replyToEodReport(eventId: string, reportId: string, input: CreateEventEodReplyInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'EOD report reply', eventId);
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.opsEventEodReport.findFirst({ where: { id: reportId, eventId } });
      if (!report) throw new NotFoundException('EOD report not found');
      const reply = await tx.opsEventEodReply.create({ data: { id: `eodr_${randomUUID()}`, reportId, authorId: actor.id ?? actor.name, authorRole: actor.role, body: input.body.trim() } });
      await writeAudit(this.auditWriter, eventId, actor.name, 'Replied to EOD report', { actorRole: actor.role, actorEmail: actor.email, actionType: 'create', category: 'live_ops', affectedType: 'event_eod_reply', affectedId: reply.id, metadata: { reportId } }, { prisma: tx, actorId: actor.id, correlationId: `eod-reply:${reply.id}` });
      return { id: reply.id, reportId, authorId: reply.authorId, authorRole: reply.authorRole, body: reply.body, createdAt: reply.createdAt.toISOString() };
    });
  }

  async getRunSheet(eventId: string, dayId: string | undefined, actor: ResolvedEventOpsActor): Promise<PrismEventRunSheet | { eventId: string; authored: false; reason: 'no_schedule' }> {
    const liveOps = await this.liveOpsReadModel.getEventLiveOps(eventId, actor);
    const days = liveOps.schedule?.days ?? [];
    const day = days.find((candidate) => candidate.id === dayId) ?? days[0];
    if (!day) return { eventId, authored: false, reason: 'no_schedule' };
    return {
      eventId,
      day,
      coordinators: liveOps.coordinatorAssignments,
      supplierCommitments: liveOps.supplierStatuses.map((request) => ({
        id: request.id,
        supplierName: request.supplierName,
        category: request.category,
        status: request.eventDayStatus ?? request.readinessStatus ?? 'unknown',
        notes: request.eventDayNotes ?? '',
      })),
      openTasks: liveOps.tasks.filter((task) => !['done', 'cancelled'].includes(task.status)),
      openIssues: liveOps.urgentIssues.filter((issue) => !['resolved', 'cancelled'].includes(issue.status)),
    };
  }

  async listEodReports(eventId: string, actor: ResolvedEventOpsActor) {
    await this.requireEventDayAuthority(eventId, actor);
    const reports = await this.prisma.opsEventEodReport.findMany({ where: { eventId }, include: { replies: { orderBy: { createdAt: 'asc' } } }, orderBy: { submittedAt: 'desc' } });
    return reports.map((report) => mapEodReport(report, actor));
  }

  private async requireScheduleWriter(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'event schedule write', eventId);
    if (actor.role === OpsUserRole.Coordinator) await this.requireDesignatedOperator(eventId, actor);
  }

  private async requireEventDayAuthority(eventId: string, actor: ResolvedEventOpsActor, assignmentId?: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'event day handoff/report', eventId);
    if (actor.role === OpsUserRole.Coordinator) {
      const assignment = await this.staffingReader.findAssignmentForEventActor(eventId, actor);
      if (!assignment) throw new ForbiddenException('Coordinator may only act for their own assignment');
      if (assignmentId && assignment.id !== assignmentId) {
        const designated = assignment.coordinatorId
          ? await this.prisma.opsEventOperatorDesignation.findFirst({ where: { eventId, coordinatorId: assignment.coordinatorId, revokedAt: null } })
          : null;
        if (!designated) throw new ForbiddenException('Coordinator may only act for their own assignment');
      }
    }
  }

  private async requireDesignatedOperator(eventId: string, actor: ResolvedEventOpsActor) {
    const assignment = await this.staffingReader.findAssignmentForEventActor(eventId, actor);
    if (!assignment?.coordinatorId) throw new ForbiddenException('Coordinator is not assigned to this event');
    const designation = await this.prisma.opsEventOperatorDesignation.findFirst({ where: { eventId, coordinatorId: assignment.coordinatorId, revokedAt: null } });
    if (!designation) throw new ForbiddenException('Only the designated Event Day System Operator may author this schedule');
  }
}

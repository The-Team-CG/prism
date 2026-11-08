import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PrismCoordinatorLiveOps,
  PrismEventRunSheet,
  PrismEventRunSheetResult,
  PrismCoordinatorAssignment,
  PrismLiveOps,
  PrismRunSheetScope,
} from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  GUEST_READER,
  REGISTRATION_PLATFORM_READER,
  type GuestReader,
  type RegistrationPlatformReader,
} from '@prism/contexts/operations';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import {
  buildGuestOperations,
  buildRunSheetEntries,
  canSeeGuestOperations,
  canSeeSupplierReadiness,
  isOpenRunSheetIssue,
  isOpenRunSheetTask,
  selectRunSheetDay,
} from '../mappers/run-sheet.mappers';
import { LiveOpsReadModelsService } from './live-ops-read-models.service';

/**
 * Read-only Event Day Run Sheet (FL-026). Composes the live-ops read model (which enforces
 * PMCM/coordinator event scope, unassigned-coordinator denial, and per-role task/issue/supplier
 * projection) with supplier ingress/egress windows into one time-ordered list, plus an untimed guest
 * operations block for PMCM, the designated operator, and registration/usher roles. Coordinator scope
 * never receives supplier event-day notes, PMCM escalation notes, or coordinator attendance/replacement notes.
 */
@Injectable()
export class RunSheetReadModelsService {
  constructor(
    private readonly queries: EventReadModelQueries,
    private readonly liveOps: LiveOpsReadModelsService,
    @Inject(REGISTRATION_PLATFORM_READER) private readonly registrationPlatforms: RegistrationPlatformReader,
    @Inject(GUEST_READER) private readonly guests: GuestReader,
  ) {}

  async getRunSheet(eventId: string, dayId: string | undefined, actor: ResolvedEventOpsActor): Promise<PrismEventRunSheetResult> {
    const scope: PrismRunSheetScope = actor.role === OpsUserRole.Coordinator ? 'coordinator' : 'pmcm';
    const liveOps = await this.liveOps.getEventLiveOps(eventId, actor);
    const days = liveOps.schedule?.days ?? [];
    if (!days.length) return { eventId, authored: false, reason: 'no_schedule' };

    const now = new Date();
    const day = selectRunSheetDay(days, dayId, now);
    if (!day) throw new NotFoundException('Schedule day not found');

    const supplierWindowsVisible = canSeeSupplierReadiness(liveOps, scope);
    const visibleSuppliers = supplierWindowsVisible ? liveOps.supplierStatuses : [];
    const supplierWindows = visibleSuppliers.length ? await this.queries.supplierSchedulesForEvent(eventId) : [];
    const openTasks = liveOps.tasks.filter(isOpenRunSheetTask);
    const openIssues = liveOps.urgentIssues.filter(isOpenRunSheetIssue);
    const guestOperations = canSeeGuestOperations(liveOps, scope)
      ? await this.loadGuestOperations(eventId, liveOps)
      : null;

    return {
      eventId,
      scope,
      generatedAt: now.toISOString(),
      day,
      days: days.map(({ id, dayDate, label }) => ({ id, dayDate, label })),
      supplierWindowsVisible,
      entries: buildRunSheetEntries({ day, supplierWindows, visibleSuppliers, tasks: openTasks, issues: openIssues }),
      coordinators: scope === 'pmcm'
        ? liveOps.coordinatorAssignments
        : liveOps.coordinatorAssignments.map(withoutPrivateAssignmentNotes),
      supplierCommitments: visibleSuppliers.map((request) => ({
        id: request.id,
        supplierName: request.supplierName,
        category: request.category,
        status: request.eventDayStatus ?? request.readinessStatus ?? 'unknown',
        notes: scope === 'pmcm' ? request.eventDayNotes ?? '' : '',
      })),
      guestOperations,
      ...this.projectOpenWork(openTasks, openIssues, scope),
    };
  }

  private async loadGuestOperations(eventId: string, liveOps: PrismLiveOps | PrismCoordinatorLiveOps) {
    const [platform, roster] = await Promise.all([
      this.registrationPlatforms.getByEventId(eventId),
      this.guests.countRosterVerificationForEvent(eventId),
    ]);
    return buildGuestOperations({
      event: liveOps.event,
      platform: platform ? this.registrationPlatforms.mapRegistrationPlatform(platform) : null,
      roster,
      assignments: liveOps.coordinatorAssignments,
    });
  }

  private projectOpenWork(
    tasks: (PrismLiveOps | PrismCoordinatorLiveOps)['tasks'],
    issues: (PrismLiveOps | PrismCoordinatorLiveOps)['urgentIssues'],
    scope: PrismRunSheetScope,
  ): Pick<PrismEventRunSheet, 'openTasks' | 'openIssues'> {
    if (scope === 'pmcm') return { openTasks: tasks, openIssues: issues };
    return {
      openTasks: tasks.map((task) => ({ ...task, escalationNotes: '' })),
      openIssues: issues.map((issue) => ({ ...issue, escalationNotes: '' })),
    };
  }
}

function withoutPrivateAssignmentNotes(assignment: PrismCoordinatorAssignment): PrismCoordinatorAssignment {
  const { attendanceNotes, replacementReason, ...visible } = assignment;
  void attendanceNotes;
  void replacementReason;
  return visible;
}

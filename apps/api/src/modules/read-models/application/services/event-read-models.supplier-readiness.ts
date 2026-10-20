import type {
  PrismCommandInboxSeverity,
  PrismPmcmSupplierReadinessItem,
  PrismSupplierReadinessConcern,
  PrismSupplierReadinessItem,
  PrismSupplierReadinessSchedule,
  PrismSupplierReadinessSetupStatus,
} from '@prism/types';
import { priorityRank, toIso } from './event-read-models.inbox';

/** Event-day statuses the late-ingress sweep treats as "not yet reported". */
const UNREPORTED_EVENT_DAY_STATUSES = new Set(['not_started', 'planned']);

export type SupplierReadinessScheduleSource = {
  ingressAt: Date;
  egressAt: Date;
  location: string;
  status: string;
  revision: number;
  acknowledgedRevision: number | null;
  acknowledgedAt: Date | null;
  changeRequestNote: string | null;
  changeRequestedAt: Date | null;
};

export type SupplierReadinessRequestSource = {
  id: string;
  eventId: string;
  supplierId: string | null;
  supplierName: string;
  category: string;
  status: string;
  dueDate: Date | null;
  assignmentStatus: string | null;
  readinessStatus: string | null;
  readinessNotes?: string | null;
  eventDayStatus: string | null;
  eventDayStatusAt?: Date | null;
  eventDayNotes?: string | null;
  eventDayVerificationStatus: string | null;
  eventDayVerifiedAt?: Date | null;
  eventDayVerifiedBy?: string | null;
  eventDayVerificationNotes?: string | null;
  contractVersions?: Array<{ reviewStatus: string; reviewReason?: string | null; reviewedAt?: Date | null }>;
  schedule?: SupplierReadinessScheduleSource | null;
};

export type SupplierReadinessEventRef = { eventName?: string | null; clientName?: string | null } | undefined;

export type SupplierReadinessClock = { now: Date; ingressLateGraceMinutes: number };

function contractStatusOf(request: SupplierReadinessRequestSource): PrismSupplierReadinessItem['contractStatus'] {
  const latest = request.contractVersions?.[0]?.reviewStatus;
  return latest === 'submitted' || latest === 'accepted' || latest === 'changes_requested' ? latest : 'missing';
}

function mapSchedule(schedule: SupplierReadinessScheduleSource): PrismSupplierReadinessSchedule {
  return {
    ingressAt: schedule.ingressAt.toISOString(),
    egressAt: schedule.egressAt.toISOString(),
    location: schedule.location,
    status: schedule.status,
    revision: schedule.revision,
    acknowledged: schedule.acknowledgedRevision === schedule.revision,
    acknowledgedAt: toIso(schedule.acknowledgedAt),
    changeRequestNote: schedule.changeRequestNote,
    changeRequestedAt: toIso(schedule.changeRequestedAt),
  };
}

/**
 * Mirrors SupplierIngressLateMonitorService: a confirmed, selected supplier with a planned schedule whose
 * ingress passed the grace window and who has not reported arrival is late, even before the sweep runs.
 */
export function isSupplierIngressLate(request: SupplierReadinessRequestSource, clock: SupplierReadinessClock) {
  const eventDayStatus = request.eventDayStatus ?? 'not_started';
  if (eventDayStatus === 'late') return true;
  const schedule = request.schedule;
  if (!schedule || schedule.status !== 'planned') return false;
  if (request.status !== 'selected' || request.assignmentStatus !== 'confirmed') return false;
  if (!UNREPORTED_EVENT_DAY_STATUSES.has(eventDayStatus)) return false;
  const dueBefore = clock.now.getTime() - clock.ingressLateGraceMinutes * 60_000;
  return schedule.ingressAt.getTime() <= dueBefore;
}

export function supplierSetupStatus(eventDayStatus: string, ingressLate: boolean): PrismSupplierReadinessSetupStatus {
  if (eventDayStatus === 'done_leaving') return 'complete';
  if (eventDayStatus === 'set_up_ready') return 'ready';
  if (eventDayStatus === 'arrived') return 'arrived';
  if (ingressLate) return 'late';
  return 'not_started';
}

function collectConcerns(request: SupplierReadinessRequestSource): PrismSupplierReadinessConcern[] {
  const concerns: PrismSupplierReadinessConcern[] = [];
  const schedule = request.schedule;
  if (schedule?.changeRequestedAt) {
    concerns.push({
      kind: 'schedule_change_request',
      message: schedule.changeRequestNote?.trim() || 'Schedule change requested',
      at: schedule.changeRequestedAt.toISOString(),
    });
  }
  const latestContract = request.contractVersions?.[0];
  if (latestContract?.reviewStatus === 'changes_requested') {
    concerns.push({
      kind: 'contract_correction',
      message: latestContract.reviewReason?.trim() || 'PMCM requested contract changes',
      at: toIso(latestContract.reviewedAt ?? null),
    });
  }
  const eventDayNote = request.eventDayNotes?.trim();
  if (eventDayNote) {
    concerns.push({ kind: 'event_day_note', message: eventDayNote, at: toIso(request.eventDayStatusAt ?? null) });
  }
  return concerns;
}

function isOverdueUnselected(request: SupplierReadinessRequestSource, clock: SupplierReadinessClock) {
  return request.dueDate != null
    && request.dueDate.getTime() < clock.now.getTime()
    && request.status !== 'selected';
}

function supplierReadinessPriority(input: {
  overdueOrLate: boolean;
  contractStatus: string;
  readinessStatus: string;
  verificationStatus: string;
  concernCount: number;
  scheduleNeedsResponse: boolean;
}): PrismCommandInboxSeverity {
  if (input.overdueOrLate) return 'critical';
  if (input.contractStatus !== 'accepted' || input.readinessStatus !== 'confirmed') return 'warning';
  if (input.verificationStatus === 'rejected' || input.concernCount > 0 || input.scheduleNeedsResponse) return 'attention';
  return 'info';
}

/** Supplier-safe readiness item. Never includes PMCM verification notes or reviewer identity. */
export function buildSupplierReadinessItem(
  request: SupplierReadinessRequestSource,
  event: SupplierReadinessEventRef,
  clock: SupplierReadinessClock,
): PrismSupplierReadinessItem {
  const contractStatus = contractStatusOf(request);
  const assignmentStatus = request.assignmentStatus ?? 'pending';
  const readinessStatus = request.readinessStatus ?? 'not_confirmed';
  const verificationStatus = request.eventDayVerificationStatus ?? 'unverified';
  const eventDayStatus = request.eventDayStatus ?? 'not_started';
  const schedule = request.schedule ? mapSchedule(request.schedule) : null;
  const ingressLate = isSupplierIngressLate(request, clock);
  const concerns = collectConcerns(request);
  const scheduleNeedsResponse = request.status === 'selected' && schedule != null && !schedule.acknowledged;
  const priority = supplierReadinessPriority({
    overdueOrLate: isOverdueUnselected(request, clock) || ingressLate,
    contractStatus,
    readinessStatus,
    verificationStatus,
    concernCount: concerns.length,
    scheduleNeedsResponse,
  });

  return {
    id: `supplier-readiness:${request.id}`,
    requestId: request.id,
    eventId: request.eventId,
    eventName: event?.eventName ?? null,
    clientName: event?.clientName ?? null,
    supplierId: request.supplierId,
    supplierName: request.supplierName,
    category: request.category,
    quoteStatus: request.status,
    assignmentStatus,
    readinessStatus,
    contractStatus,
    eventDayStatus,
    verificationStatus,
    schedule,
    ingressLate,
    setupStatus: supplierSetupStatus(eventDayStatus, ingressLate),
    concerns,
    priority,
    dueAt: toIso(request.dueDate),
  };
}

/** PMCM projection: the same item the supplier sees plus quote lock and private review notes. */
export function buildPmcmSupplierReadinessItem(
  request: SupplierReadinessRequestSource,
  event: SupplierReadinessEventRef,
  clock: SupplierReadinessClock,
): PrismPmcmSupplierReadinessItem {
  return {
    ...buildSupplierReadinessItem(request, event, clock),
    quoteLocked: request.status === 'selected',
    pmcmReview: {
      verificationNotes: request.eventDayVerificationNotes ?? '',
      verifiedBy: request.eventDayVerifiedBy ?? null,
      verifiedAt: toIso(request.eventDayVerifiedAt ?? null),
      readinessNotes: request.readinessNotes ?? '',
    },
  };
}

export function sortSupplierReadinessItems<T extends PrismSupplierReadinessItem>(items: T[]) {
  return items.sort((left, right) => {
    const priority = priorityRank(left.priority) - priorityRank(right.priority);
    if (priority !== 0) return priority;
    const due = (left.dueAt ?? '').localeCompare(right.dueAt ?? '');
    if (due !== 0) return due;
    return left.id.localeCompare(right.id);
  });
}

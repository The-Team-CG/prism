import type {
  PrismCoordinatorLiveOps,
  PrismEventDayTask,
  PrismEventScheduleDay,
  PrismLiveOps,
  PrismRunSheetEntry,
  PrismRunSheetEntryKind,
  PrismRunSheetScope,
  PrismSupplierQuoteRequest,
  PrismUrgentIssue,
} from '@prism/types';
import { EventDayTaskStatus, UrgentIssueStatus } from '@prism/kernel/event-core';

/** Supplier ingress/egress window as read for the run sheet; schedule notes are never selected. */
export interface RunSheetSupplierWindow {
  id: string;
  requestId: string;
  ingressAt: Date;
  egressAt: Date;
  location: string;
  status: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Same-time tie-break order: program first, then arrivals, departures, task deadlines, issues. */
const KIND_RANK: Record<PrismRunSheetEntryKind, number> = {
  segment: 0,
  ingress: 1,
  egress: 2,
  task_due: 3,
  issue: 4,
};

const CLOSED_TASK_STATUSES: readonly string[] = [EventDayTaskStatus.Done, 'cancelled'];
const CLOSED_ISSUE_STATUSES: readonly string[] = [UrgentIssueStatus.Resolved, UrgentIssueStatus.Cancelled];

/**
 * Mirrors the live-ops rule: PMCM/system, the designated Event Day System Operator,
 * and ingress/egress roles see supplier readiness (and therefore supplier windows).
 */
export function canSeeSupplierReadiness(liveOps: PrismLiveOps | PrismCoordinatorLiveOps, scope: PrismRunSheetScope) {
  if (scope === 'pmcm') return true;
  return Boolean(liveOps.isDesignatedOperator) || isIngressRole(liveOps.role);
}

export function isIngressRole(role?: string | null) {
  const value = role?.toLowerCase() ?? '';
  return value.includes('ingress') || value.includes('egress');
}

/**
 * Explicit day id wins (undefined when unknown). Without one, prefer the schedule day
 * matching today's UTC date, then the next upcoming day, then the first day.
 */
export function selectRunSheetDay(days: PrismEventScheduleDay[], dayId: string | undefined, now: Date) {
  if (dayId) return days.find((day) => day.id === dayId);
  const today = now.toISOString().slice(0, 10);
  return days.find((day) => day.dayDate === today)
    ?? days.find((day) => day.dayDate > today)
    ?? days[0];
}

/** UTC calendar day of the schedule day, widened to cover that day's authored segments. */
export function runSheetWindow(day: PrismEventScheduleDay) {
  let start = Date.parse(`${day.dayDate}T00:00:00.000Z`);
  let end = start + DAY_MS;
  for (const segment of day.segments) {
    start = Math.min(start, Date.parse(segment.plannedStartAt));
    end = Math.max(end, Date.parse(segment.plannedEndAt));
  }
  return { start, end };
}

export interface RunSheetEntrySources {
  day: PrismEventScheduleDay;
  supplierWindows: RunSheetSupplierWindow[];
  /** Supplier statuses already projected for the actor; windows for other requests are dropped. */
  visibleSuppliers: Pick<PrismSupplierQuoteRequest, 'id' | 'supplierName' | 'category'>[];
  tasks: PrismEventDayTask[];
  issues: PrismUrgentIssue[];
}

export function isOpenRunSheetTask(task: PrismEventDayTask) {
  return !CLOSED_TASK_STATUSES.includes(task.status) && !task.completedAt;
}

export function isOpenRunSheetIssue(issue: PrismUrgentIssue) {
  return !CLOSED_ISSUE_STATUSES.includes(issue.status) && !issue.resolvedAt;
}

/**
 * Builds the merged, time-ordered run sheet for one schedule day:
 * - every segment of the day;
 * - supplier ingress/egress times inside the day window, for visible suppliers only;
 * - open task due times and open issue creation times up to the window end. Items
 *   before the window start are still open and are marked `carriedOver`.
 */
export function buildRunSheetEntries(sources: RunSheetEntrySources): PrismRunSheetEntry[] {
  const window = runSheetWindow(sources.day);
  return [
    ...segmentEntries(sources.day),
    ...supplierWindowEntries(sources, window),
    ...taskEntries(sources.tasks, window),
    ...issueEntries(sources.issues, window),
  ].sort(compareRunSheetEntries);
}

type RunSheetWindow = ReturnType<typeof runSheetWindow>;

function isInWindow(ms: number, window: RunSheetWindow) {
  return ms >= window.start && ms < window.end;
}

function segmentEntries(day: PrismEventScheduleDay): PrismRunSheetEntry[] {
  return day.segments.map((segment) => entry('segment', segment.id, {
    at: segment.plannedStartAt,
    endAt: segment.plannedEndAt,
    title: segment.title,
    status: segment.status,
    ownerLabel: segment.ownerRole,
    location: segment.location,
  }));
}

function supplierWindowEntries(sources: RunSheetEntrySources, window: RunSheetWindow): PrismRunSheetEntry[] {
  const suppliers = new Map(sources.visibleSuppliers.map((supplier) => [supplier.id, supplier]));
  const entries: PrismRunSheetEntry[] = [];
  for (const supplierWindow of sources.supplierWindows) {
    const supplier = suppliers.get(supplierWindow.requestId);
    if (!supplier) continue;
    const shared = { status: supplierWindow.status, ownerLabel: supplier.category, location: supplierWindow.location };
    if (isInWindow(supplierWindow.ingressAt.getTime(), window)) {
      entries.push(entry('ingress', supplierWindow.id, { ...shared, at: supplierWindow.ingressAt.toISOString(), endAt: null, title: `${supplier.supplierName} ingress` }));
    }
    if (isInWindow(supplierWindow.egressAt.getTime(), window)) {
      entries.push(entry('egress', supplierWindow.id, { ...shared, at: supplierWindow.egressAt.toISOString(), endAt: null, title: `${supplier.supplierName} egress` }));
    }
  }
  return entries;
}

function taskEntries(tasks: PrismEventDayTask[], window: RunSheetWindow): PrismRunSheetEntry[] {
  const entries: PrismRunSheetEntry[] = [];
  for (const task of tasks) {
    if (!task.dueAt || !isOpenRunSheetTask(task)) continue;
    const at = Date.parse(task.dueAt);
    if (Number.isNaN(at) || at >= window.end) continue;
    entries.push(entry('task_due', task.id, {
      at: new Date(at).toISOString(),
      endAt: null,
      title: task.title,
      status: task.status,
      ownerLabel: ownerLabel(task.assignedRole, task.ownerName),
      location: '',
      severity: task.priority || null,
      carriedOver: at < window.start,
    }));
  }
  return entries;
}

function issueEntries(issues: PrismUrgentIssue[], window: RunSheetWindow): PrismRunSheetEntry[] {
  const entries: PrismRunSheetEntry[] = [];
  for (const issue of issues) {
    if (!isOpenRunSheetIssue(issue)) continue;
    const at = Date.parse(issue.createdAt);
    if (Number.isNaN(at) || at >= window.end) continue;
    entries.push(entry('issue', issue.id, {
      at: new Date(at).toISOString(),
      endAt: null,
      title: issue.title,
      status: issue.status,
      ownerLabel: ownerLabel(issue.ownerRole, issue.ownerName),
      location: issue.affectedArea,
      severity: issue.severity || null,
      carriedOver: at < window.start,
    }));
  }
  return entries;
}

export function compareRunSheetEntries(left: PrismRunSheetEntry, right: PrismRunSheetEntry) {
  return Date.parse(left.at) - Date.parse(right.at)
    || KIND_RANK[left.kind] - KIND_RANK[right.kind]
    || (left.referenceId < right.referenceId ? -1 : left.referenceId > right.referenceId ? 1 : 0);
}

function entry(
  kind: PrismRunSheetEntryKind,
  referenceId: string,
  fields: Omit<PrismRunSheetEntry, 'id' | 'kind' | 'referenceId' | 'severity' | 'carriedOver'> & Partial<Pick<PrismRunSheetEntry, 'severity' | 'carriedOver'>>,
): PrismRunSheetEntry {
  return {
    id: `${kind}:${referenceId}`,
    kind,
    referenceId,
    severity: null,
    carriedOver: false,
    ...fields,
  };
}

function ownerLabel(role?: string | null, name?: string | null) {
  return [role?.trim(), name?.trim()].filter(Boolean).join(' · ');
}

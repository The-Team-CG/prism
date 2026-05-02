import { LiveOpsSlaStatus } from '../ops.constants';

type SlaRecord = {
  status?: string | null;
  slaStatus?: string | null;
  slaDueAt?: Date | null;
  dueAt?: Date | null;
  resolvedAt?: Date | null;
  completedAt?: Date | null;
};

const CLOSED_STATUSES = new Set(['done', 'resolved', 'cancelled', 'closed']);
const DUE_SOON_MS = 60 * 60 * 1000;

export class LiveOperationsService {
  computeSlaStatus(record: SlaRecord, now = new Date()) {
    if (record.resolvedAt || record.completedAt || CLOSED_STATUSES.has(record.status ?? '')) {
      return LiveOpsSlaStatus.Resolved;
    }

    const dueAt = record.slaDueAt ?? record.dueAt ?? null;
    if (!dueAt) return record.slaStatus && record.slaStatus !== 'on_track' ? record.slaStatus : LiveOpsSlaStatus.OnTrack;
    if (dueAt.getTime() < now.getTime()) return LiveOpsSlaStatus.Overdue;
    if (dueAt.getTime() - now.getTime() <= DUE_SOON_MS) return LiveOpsSlaStatus.DueSoon;
    return LiveOpsSlaStatus.OnTrack;
  }

  buildStatusFeed(input: {
    event: unknown;
    role?: string;
    tasks: Array<any>;
    urgentIssues: Array<any>;
    supplierStatuses: Array<any>;
    coordinatorAssignments: Array<any>;
    eventDayLogs: Array<any>;
    guestAttendanceCount: number;
    guestCheckIns: Array<any>;
    includeGuestDetails: boolean;
  }) {
    const items = [
      ...input.tasks.map((task) => ({
        id: task.id,
        type: 'task',
        title: task.title,
        status: task.status,
        role: task.assignedRole,
        slaStatus: task.slaStatus,
        escalationLevel: task.escalationLevel,
      })),
      ...input.urgentIssues.map((issue) => ({
        id: issue.id,
        type: 'urgent_issue',
        title: issue.title,
        status: issue.status,
        role: issue.ownerRole,
        slaStatus: issue.slaStatus,
        escalationLevel: issue.escalationLevel,
      })),
      ...input.supplierStatuses.map((supplier) => ({
        id: supplier.id,
        type: 'supplier_status',
        title: supplier.supplierName,
        status: supplier.eventDayStatus ?? 'not_started',
        role: supplier.category,
        verificationStatus: supplier.eventDayVerificationStatus ?? supplier.verificationStatus ?? 'self_reported',
      })),
    ];

    return {
      event: input.event,
      role: input.role,
      items,
      coordinatorAssignments: input.coordinatorAssignments,
      eventDayLogs: input.eventDayLogs,
      guestAttendanceCount: input.guestAttendanceCount,
      guestCheckIns: input.includeGuestDetails ? input.guestCheckIns : [],
    };
  }
}

import { LiveOpsSlaStatus } from '@prism/kernel/event-core';

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

export function computeSlaStatus(record: SlaRecord, now = new Date()) {
  if (record.resolvedAt || record.completedAt || CLOSED_STATUSES.has(record.status ?? '')) {
    return LiveOpsSlaStatus.Resolved;
  }

  const dueAt = record.slaDueAt ?? record.dueAt ?? null;
  if (!dueAt) return record.slaStatus && record.slaStatus !== 'on_track' ? record.slaStatus : LiveOpsSlaStatus.OnTrack;
  if (dueAt.getTime() < now.getTime()) return LiveOpsSlaStatus.Overdue;
  if (dueAt.getTime() - now.getTime() <= DUE_SOON_MS) return LiveOpsSlaStatus.DueSoon;
  return LiveOpsSlaStatus.OnTrack;
}

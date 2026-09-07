import type { OpsEventScheduleDay, OpsEventScheduleSegment } from '@prisma/client';
import type { PrismEventSchedule, PrismEventScheduleDay, PrismEventScheduleSegment, PrismLiveOpsTimer } from '@prism/types';

export function mapScheduleDay(day: OpsEventScheduleDay & { segments: OpsEventScheduleSegment[] }): PrismEventScheduleDay {
  return { id: day.id, eventId: day.eventId, dayDate: day.dayDate.toISOString().slice(0, 10), label: day.label, status: day.status, segments: day.segments.map((segment) => ({
    id: segment.id, dayId: segment.dayId, sequence: segment.sequence, title: segment.title,
    plannedStartAt: segment.plannedStartAt.toISOString(), plannedEndAt: segment.plannedEndAt.toISOString(), ownerRole: segment.ownerRole, location: segment.location, status: segment.status,
    actualStartedAt: segment.actualStartedAt?.toISOString() ?? null, actualEndedAt: segment.actualEndedAt?.toISOString() ?? null,
    startVarianceMinutes: segment.actualStartedAt ? Math.round((segment.actualStartedAt.getTime() - segment.plannedStartAt.getTime()) / 60000) : null,
    endVarianceMinutes: segment.actualEndedAt ? Math.round((segment.actualEndedAt.getTime() - segment.plannedEndAt.getTime()) / 60000) : null,
  })) };
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
  if (next && now.getTime() < new Date(next.actualStartedAt ?? next.plannedStartAt).getTime()) return { status: segments.indexOf(next) === 0 ? 'before_start' : 'between_segments', label: next.title, segmentId: next.id, secondsRemaining: Math.max(0, Math.ceil((new Date(next.actualStartedAt ?? next.plannedStartAt).getTime() - now.getTime()) / 1000)), serverTime };
  return { status: 'complete', label: 'Schedule complete', serverTime };
}

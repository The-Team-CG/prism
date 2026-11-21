import type { PrismEventSchedule, PrismLiveOpsTimer } from "@prism/types";

export type LiveSegment = { id: string; title: string; startAt: string; endAt: string; location: string };
export type LiveNowNext = { now: LiveSegment | null; next: LiveSegment | null; minutesToNext: number | null };

/**
 * What is on the run sheet now and what comes next, for the live desk's lead. The timer's current segment wins when
 * it names one; otherwise the segment whose planned window holds the moment. Next is the first segment starting later.
 */
export function liveNowNext(schedule: PrismEventSchedule | undefined, timer: PrismLiveOpsTimer | undefined, nowIso: string): LiveNowNext {
  const segments = (schedule?.authored ? schedule.days ?? [] : [])
    .flatMap((day) => day.segments ?? [])
    .filter((segment) => segment.status !== "skipped")
    .map((segment) => ({ id: segment.id, title: segment.title, startAt: segment.plannedStartAt, endAt: segment.plannedEndAt, location: segment.location }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const now = Date.parse(nowIso);
  const current = (timer?.segmentId ? segments.find((segment) => segment.id === timer.segmentId) : undefined)
    ?? segments.find((segment) => Date.parse(segment.startAt) <= now && now < Date.parse(segment.endAt))
    ?? null;
  const next = segments.find((segment) => Date.parse(segment.startAt) > now && segment.id !== current?.id) ?? null;
  return { now: current, next, minutesToNext: next ? Math.max(0, Math.round((Date.parse(next.startAt) - now) / 60_000)) : null };
}

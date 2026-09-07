import type { PrismEventSchedule } from '@prism/types';

export function LiveOpsRunSheet({ schedule }: { schedule: PrismEventSchedule }) {
  if (!schedule.authored) return <p className="text-sm text-muted-foreground">No schedule authored for this event yet.</p>;
  return <div className="space-y-4" aria-label="Event run sheet">{schedule.days.map((day) => <section key={day.id}><h3 className="font-semibold">{day.label || day.dayDate}</h3><ol className="mt-2 space-y-2">{day.segments.map((segment) => <li key={segment.id} className="grid grid-cols-[8rem_1fr_auto] gap-3 text-sm"><time dateTime={segment.plannedStartAt}>{new Date(segment.plannedStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>{segment.title}<small className="ml-2 text-muted-foreground">{segment.ownerRole}{segment.location ? ` · ${segment.location}` : ''}</small></span><span>{segment.status}</span></li>)}</ol></section>)}</div>;
}

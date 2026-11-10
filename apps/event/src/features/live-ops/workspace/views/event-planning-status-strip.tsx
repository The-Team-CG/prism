import type { PrismEvent } from "@prism/types";
import { eventPlanningStatus } from "../model/event-planning-status";

/** FR-05: the planning milestones the command station needs alongside event-day work. */
export function EventPlanningStatusStrip({ event }: { event: PrismEvent }) {
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 text-xs sm:grid-cols-4" aria-label="Planning status">
      {eventPlanningStatus(event).map((item) => (
        <div key={item.label}>
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className={item.warn ? "font-semibold text-destructive" : "font-semibold text-foreground"}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

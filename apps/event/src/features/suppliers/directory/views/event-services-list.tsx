import { CheckCircle2, CircleDashed, Clock3, Scale } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { cx } from "@/features/pmcm-kit";
import type { EventService, ServiceStage } from "../model/event-services";

const LOOK: Record<ServiceStage, { icon: typeof CheckCircle2; tone: string; status: string; action: string }> = {
  compare: { icon: Scale, tone: "bg-attention-soft text-attention", status: "Quotes to compare", action: "Compare" },
  not_requested: { icon: CircleDashed, tone: "bg-muted text-muted-foreground", status: "Not requested", action: "Request quotes" },
  waiting: { icon: Clock3, tone: "bg-info-soft text-info", status: "Waiting for quotes", action: "Open" },
  booked: { icon: CheckCircle2, tone: "bg-success-soft text-success", status: "Booked", action: "Open" },
};

/**
 * The services the event needs, one row each, from not requested to booked; a row opens that service's quotes
 * below. The first service waiting on PMCM carries the page's filled button.
 */
export function EventServicesList({ services, activeCategoryId, onOpen }: { services: EventService[]; activeCategoryId?: string; onOpen: (categoryId: string) => void }) {
  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">The briefing names no services yet. Choose a category below to request quotes.</p>;
  }
  const lead = services.find((service) => service.stage === "compare" || service.stage === "not_requested");
  const booked = services.filter((service) => service.stage === "booked").length;
  return (
    <section aria-labelledby="event-services-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-4">
        <h2 id="event-services-title" className="text-base font-semibold text-foreground">Services for this event</h2>
        <p className="text-sm text-muted-foreground">{booked} of {services.length} booked</p>
      </header>
      <ul className="divide-y divide-border border-t border-border">
        {services.map((service) => {
          const look = LOOK[service.stage];
          const Icon = look.icon;
          const primary = service === lead;
          return (
            <li key={service.categoryId} className={cx("grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3", activeCategoryId === service.categoryId && "bg-primary/5")}>
              <span aria-hidden className={cx("grid size-8 place-items-center rounded-md", look.tone)}><Icon className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{service.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{look.status} · {service.detail}</span>
              </span>
              <Button type="button" size="sm" variant={primary ? "default" : "outline"} aria-label={`${look.action}: ${service.name}`} onClick={() => onOpen(service.categoryId)}>
                {look.action}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { derivePrismLifecycleStage, type PrismEvent } from "@prism/types";
import { useResource } from "@prism/portal-query";
import { EventCardGrid, EventCover } from "@prism/ui/event-cards";
import { FileEventCard, fileEventHref } from "@prism/ui/file-library";
import { manilaDateKey } from "@prism/ui/format-date";
import { useEventCoverUrl } from "../../events/view-models/use-event-cover-url";
import { isPastClientEvent } from "../../home/model/client-home-summary";
import { clientEventFileRequirements } from "../data/client-file-library-resources";
import { clientFileTally } from "../model/client-document-checklist";
import { clientEventDateLabel } from "../../workspace/model/client-dashboard-view-rules";

function ClientFileEventCard({ event, todayKey, onOpen }: { event: PrismEvent; todayKey: string; onOpen: (eventId: string) => void }) {
  const coverUrl = useEventCoverUrl(event.id, event.coverObjectId);
  const requirements = useResource(clientEventFileRequirements, event.id);
  return (
    <FileEventCard
      cover={<EventCover eventType={event.eventType} imageUrl={coverUrl} />}
      date={event.eventDate}
      title={event.eventName}
      titleLabel={`Open files: ${event.eventName}`}
      href={fileEventHref(event.id)}
      onNavigate={() => onOpen(event.id)}
      details={[clientEventDateLabel(event), event.venue || "Venue to be confirmed"].join(" · ")}
      todayKey={todayKey}
      finished={isPastClientEvent(event)}
      stage={derivePrismLifecycleStage(event)}
      tally={requirements.status === "ready" ? clientFileTally(requirements.data.items) : null}
    />
  );
}

function CardSection({ id, title, events, todayKey, onOpen }: { id: string; title: string; events: PrismEvent[]; todayKey: string; onOpen: (eventId: string) => void }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-foreground">{title}<span className="text-sm font-normal tabular-nums text-muted-foreground">{events.length}</span></h2>
      <EventCardGrid>{events.map((event) => <ClientFileEventCard key={event.id} event={event} todayKey={todayKey} onOpen={onOpen} />)}</EventCardGrid>
    </section>
  );
}

/** Files' start page: each event as the Files card every portal shares, upcoming first, then past ones for reference. */
export function ClientFileEventCards({ events, onOpen }: { events: PrismEvent[]; onOpen: (eventId: string) => void }) {
  const todayKey = manilaDateKey();
  return (
    <div className="grid gap-6">
      <CardSection id="client-files-upcoming" title="Upcoming" events={events.filter((event) => !isPastClientEvent(event))} todayKey={todayKey} onOpen={onOpen} />
      <CardSection id="client-files-past" title="Past" events={events.filter(isPastClientEvent)} todayKey={todayKey} onOpen={onOpen} />
    </div>
  );
}

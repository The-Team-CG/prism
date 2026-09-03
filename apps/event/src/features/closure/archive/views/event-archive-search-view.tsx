"use client";

import { Archive } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useEventArchiveSearchViewModel } from "../view-models/use-event-archive-search-view-model";

export function EventArchiveSearchView() {
  const vm = useEventArchiveSearchViewModel();

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Archive className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Archived events</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Search closed records by venue, event type, or month. Full-record retain stays on the event record.</p>
      </div>
      <div className="space-y-4 px-6 py-5">
        {vm.error ? <p className="text-sm font-semibold text-(--prism-amber)">{vm.error}</p> : null}
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold text-muted-foreground">
            Venue
            <input
              value={vm.venue}
              onChange={(event) => vm.setVenue(event.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Event type
            <input
              value={vm.eventType}
              onChange={(event) => vm.setEventType(event.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Month
            <input
              type="month"
              value={vm.month}
              onChange={(event) => vm.setMonth(event.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <div className="flex items-end">
            <Button className="h-9 rounded-lg font-bold" disabled={vm.busy} onClick={vm.search}>
              Search archive
            </Button>
          </div>
        </div>
        {vm.hits.length === 0 ? (
          <EmptyState icon={Archive} title="No archived events" description={vm.emptyCopy ?? "Archived events will appear here after close."} />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {vm.hits.map((hit) => (
              <div key={hit.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{hit.eventName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {hit.clientName} · {hit.eventType || "Type pending"} · {hit.venue || "Venue pending"}
                  </p>
                </div>
                <p className="text-xs font-semibold text-muted-foreground">{hit.eventDate}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

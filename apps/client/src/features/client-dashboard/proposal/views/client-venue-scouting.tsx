"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import type { PrismVenueScoutingOption } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card, CardBody, CardHeader } from "../../shared/tab-ui";
import { useVenueScouting } from "../view-models/use-venue-scouting";

/** FR-10: the venues PMCM scouted for this event; the client marks the one they prefer. */
export function ClientVenueScouting({ eventId }: { eventId: string }) {
  const vm = useVenueScouting(eventId);
  const [note, setNote] = useState("");
  if (vm.options.length === 0 && !vm.error) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Venue options</h2></div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">PMCM scouted these venues for your event. Mark the one you prefer. You can change it until PMCM confirms the venue.</p>
      </CardHeader>
      <CardBody>
        {vm.error ? <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{vm.error}</p> : null}
        <div className="grid gap-3 md:grid-cols-3">
          {vm.options.map((option) => (
            <VenueOptionCard key={option.id} option={option} preferred={vm.preferredOptionId === option.id} busy={vm.busy} onChoose={() => void vm.choose(option.id, note)} />
          ))}
        </div>
        <label className="mt-4 block text-xs font-semibold text-muted-foreground">Note for PMCM (optional)
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} className="mt-1.5 min-h-16 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" placeholder="Why this venue, or anything PMCM should check." />
        </label>
      </CardBody>
    </Card>
  );
}

function VenueOptionCard({ option, preferred, busy, onChoose }: { option: PrismVenueScoutingOption; preferred: boolean; busy: boolean; onChoose: () => void }) {
  return (
    <article className={`rounded-xl border p-4 ${preferred ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}>
      <p className="font-bold text-foreground">{option.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{option.location}</p>
      <dl className="mt-3 space-y-1 text-xs">
        <div><dt className="inline font-semibold">Capacity: </dt><dd className="inline">{option.capacity} guests</dd></div>
        <div><dt className="inline font-semibold">Price range: </dt><dd className="inline">{option.priceRange}</dd></div>
        <div><dt className="inline font-semibold">Available: </dt><dd className="inline">{option.availableDates.join(", ")}</dd></div>
      </dl>
      {option.notes ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{option.notes}</p> : null}
      {preferred
        ? <p className="mt-3 text-xs font-bold text-primary">Your preferred venue{option.clientPreferenceNote ? ` · ${option.clientPreferenceNote}` : ""}</p>
        : <Button disabled={busy} onClick={onChoose} variant="outline" className="mt-3 rounded-lg font-semibold">Prefer this venue</Button>}
    </article>
  );
}

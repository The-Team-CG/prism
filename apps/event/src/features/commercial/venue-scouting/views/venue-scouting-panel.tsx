"use client";

import { useState, type FormEvent } from "react";
import { VENUE_SCOUTING_MIN_OPTIONS, type PrismVenueScoutingOption } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { useVenueScoutingPanel } from "../view-models/use-venue-scouting-panel";

const field = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2";
const empty = { name: "", location: "", capacity: "", priceRange: "", availableDates: "", notes: "" };

function optionState(option: PrismVenueScoutingOption) {
  if (option.status === "draft") return "Not shared yet";
  if (!option.clientPreferredAt) return "Shared with client";
  return `Client prefers this${option.clientPreferenceNote ? ` · ${option.clientPreferenceNote}` : ""}`;
}

/** FR-10: PMCM scouts at least three venues for a client without one, then shares them. The client's preference shows here. */
export function VenueScoutingPanel({ eventId }: { eventId: string }) {
  const vm = useVenueScoutingPanel(eventId);
  const [form, setForm] = useState(empty);
  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await vm.add({
      name: form.name, location: form.location, capacity: Number(form.capacity), priceRange: form.priceRange, notes: form.notes,
      availableDates: form.availableDates.split(",").map((date) => date.trim()).filter(Boolean),
    });
    if (saved) setForm(empty);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Venue scouting</h2>
      <p className="mt-1 text-sm text-muted-foreground">For a client without a venue: add at least {VENUE_SCOUTING_MIN_OPTIONS} options, then share them. The client marks one preference.</p>
      {vm.error && <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p>}
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {vm.options.map((option) => (
          <li key={option.id} className={`rounded-md border p-3 text-sm ${option.clientPreferredAt ? "border-primary" : "border-border"}`}>
            <p className="font-semibold">{option.name}</p>
            <p className="text-xs text-muted-foreground">{option.location} · {option.capacity} guests · {option.priceRange}</p>
            <p className="mt-1 text-xs">Available: {option.availableDates.join(", ")}</p>
            <p className="mt-1 text-xs font-semibold">{optionState(option)}</p>
            <button type="button" disabled={vm.busy} onClick={() => void vm.withdraw(option.id)} className="mt-2 text-xs font-semibold text-destructive">Withdraw</button>
          </li>
        ))}
      </ul>
      <Button type="button" className="mt-3" disabled={vm.busy || !vm.canPublish} onClick={() => void vm.publish()}>Share new options with the client</Button>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">Venue name<input required value={form.name} onChange={set("name")} className={field} /></label>
        <label className="text-sm">Location<input required value={form.location} onChange={set("location")} className={field} /></label>
        <label className="text-sm">Capacity (guests)<input required type="number" min={1} value={form.capacity} onChange={set("capacity")} className={field} /></label>
        <label className="text-sm">Price range<input required value={form.priceRange} onChange={set("priceRange")} placeholder="PHP 300,000 – 400,000" className={field} /></label>
        <label className="text-sm md:col-span-2">Available dates (YYYY-MM-DD, comma separated)<input required value={form.availableDates} onChange={set("availableDates")} className={field} /></label>
        <label className="text-sm md:col-span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} className={field} /></label>
        <div><button type="submit" disabled={vm.busy} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Add venue option</button></div>
      </form>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createLogisticsBookingSchema, LOGISTICS_PROVIDER_LABELS, LOGISTICS_PROVIDERS, parseContract, type PrismLogisticsBooking } from "@prism/types";
import { logisticsBookingsRepository } from "../data/logistics-bookings-repository";

type Provider = (typeof LOGISTICS_PROVIDERS)[number];
const field = "mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

export function logisticsBrief(booking: PrismLogisticsBooking, eventName: string): string {
  return `Logistics brief: ${eventName}\n${LOGISTICS_PROVIDER_LABELS[booking.provider]} booking ${booking.bookingReference}\nItems: ${booking.description}`;
}

/** New-P4: courier bookings for returning client assets, with a shareable brief; a priced booking adds a draft billing item. */
export function LogisticsBookingsPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [items, setItems] = useState<PrismLogisticsBooking[]>([]);
  const [form, setForm] = useState({ provider: "lalamove" as Provider, bookingReference: "", description: "", amount: "0" });
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setItems(await logisticsBookingsRepository.list(eventId)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load bookings."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setError(null);
    try {
      await logisticsBookingsRepository.create(eventId, parseContract(createLogisticsBookingSchema, { ...form, amount: Number(form.amount) }, "Logistics booking"));
      setForm({ provider: form.provider, bookingReference: "", description: "", amount: "0" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the booking.");
    }
  }

  function print(brief: string) {
    const page = window.open("", "_blank", "width=480,height=600");
    if (!page) return;
    page.document.body.innerText = brief;
    page.print();
  }

  return (
    <div className="space-y-3 text-sm">
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      <ul className="space-y-2">
        {items.map((booking) => {
          const brief = logisticsBrief(booking, eventName);
          return (
            <li key={booking.id} className="rounded-md border border-border p-2">
              <p className="font-semibold">{LOGISTICS_PROVIDER_LABELS[booking.provider]} · {booking.bookingReference}</p>
              <p className="text-xs text-muted-foreground">{booking.description}{booking.amount ? ` · PHP ${booking.amount.toLocaleString("en-PH")} (draft billing item)` : ""}</p>
              <div className="mt-1 flex gap-3 text-xs font-semibold">
                <a href={`viber://forward?text=${encodeURIComponent(brief)}`} className="text-primary">Share on Viber</a>
                <button type="button" onClick={() => print(brief)} className="text-primary">Print slip</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Courier<select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as Provider })} className={field}>{LOGISTICS_PROVIDERS.map((value) => <option key={value} value={value}>{LOGISTICS_PROVIDER_LABELS[value]}</option>)}</select></label>
        <label>Booking reference<input value={form.bookingReference} onChange={(event) => setForm({ ...form, bookingReference: event.target.value })} className={field} /></label>
        <label className="sm:col-span-2">Items being returned<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={field} /></label>
        <label>Cost to bill (PHP, 0 for none)<input type="number" min={0} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={field} /></label>
        <div className="self-end"><button type="button" disabled={!form.bookingReference.trim() || !form.description.trim()} onClick={() => void add()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Record booking</button></div>
      </div>
    </div>
  );
}

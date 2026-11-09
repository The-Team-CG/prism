"use client";

import { useCallback, useEffect, useState } from "react";
import { createLogisticsBookingSchema, LOGISTICS_PROVIDER_LABELS, LOGISTICS_PROVIDERS, parseContract, type PrismLogisticsBooking } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { logisticsBookingsRepository } from "../data/logistics-bookings-repository";

type Provider = (typeof LOGISTICS_PROVIDERS)[number];

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

  const canRecord = form.bookingReference.trim().length > 0 && form.description.trim().length > 0;

  function print(brief: string) {
    const page = window.open("", "_blank", "width=480,height=600");
    if (!page) return;
    page.document.body.innerText = brief;
    page.print();
  }

  return (
    <div className="grid gap-4 text-sm">
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {items.length > 0 ? (
        <ul className="grid gap-2">
          {items.map((booking) => {
            const brief = logisticsBrief(booking, eventName);
            return (
              <li key={booking.id} className="grid gap-1 rounded-md border border-border p-3">
                <p className="font-semibold text-foreground">{LOGISTICS_PROVIDER_LABELS[booking.provider]} · {booking.bookingReference}</p>
                <p className="text-xs text-muted-foreground">{booking.description}{booking.amount ? ` · PHP ${booking.amount.toLocaleString("en-PH")} (draft billing item)` : ""}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                  <a href={`viber://forward?text=${encodeURIComponent(brief)}`} className="text-primary hover:underline">Share on Viber</a>
                  <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-primary" onClick={() => print(brief)}>Print slip</Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Book a courier</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="logistics-courier">Courier</FieldLabel>
              <Select value={form.provider} onValueChange={(value) => setForm({ ...form, provider: value as Provider })}>
                <SelectTrigger id="logistics-courier" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGISTICS_PROVIDERS.map((value) => (
                    <SelectItem key={value} value={value}>{LOGISTICS_PROVIDER_LABELS[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="logistics-reference">Booking reference</FieldLabel>
              <Input id="logistics-reference" value={form.bookingReference} onChange={(event) => setForm({ ...form, bookingReference: event.target.value })} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="logistics-items">Items being returned</FieldLabel>
              <Input id="logistics-items" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="logistics-amount">Cost to bill (PHP)</FieldLabel>
              <Input id="logistics-amount" type="number" min={0} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              <FieldDescription>Enter 0 when the courier cost is not billed.</FieldDescription>
            </Field>
            <Field className="self-end">
              <Button
                type="button"
                disabled={!canRecord}
                onClick={() => void add()}
              >
                Record booking
              </Button>
              {canRecord ? null : <FieldDescription>Add a booking reference and the items being returned to record it.</FieldDescription>}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}

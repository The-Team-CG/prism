import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";

/** Addenda for one event. The finance workspace reads it only to say which billing changes await countersignature. */
export const financeEventAddenda = defineResource({
  name: "finance.event-addenda",
  fetch: (eventId: string) => eventApi.events.addenda(eventId),
});

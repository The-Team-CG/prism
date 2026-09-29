import type { PrismEventWrapUp, StartEventWrapUpInput, UpdateEventWrapUpInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const wrapUpRepository = {
  get(eventId: string): Promise<PrismEventWrapUp | null> {
    return eventApiRequest<PrismEventWrapUp | null>(`/api/events/${eventId}/wrap-up`);
  },
  start(eventId: string, input: StartEventWrapUpInput): Promise<PrismEventWrapUp> {
    return eventApiRequest<PrismEventWrapUp>(`/api/events/${eventId}/wrap-up`, { method: "POST", body: input });
  },
  update(eventId: string, input: UpdateEventWrapUpInput): Promise<PrismEventWrapUp> {
    return eventApiRequest<PrismEventWrapUp>(`/api/events/${eventId}/wrap-up`, { method: "PATCH", body: input });
  },
};

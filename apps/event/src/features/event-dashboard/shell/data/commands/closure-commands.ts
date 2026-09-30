import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { PrismCloseGates, PrismEventInsight, PrismEventWrapUp, StartEventWrapUpInput, UpdateEventWrapUpInput } from "@prism/types";

export const closureCommands = {
closeGates: (eventId: string) => request<PrismCloseGates>(`/api/events/${eventId}/close-gates`),
eventInsights: (eventId: string) => request<PrismEventInsight[]>(`/api/events/${eventId}/insights`),
generateEventInsights: (eventId: string) =>
    request<PrismEventInsight>(`/api/events/${eventId}/insights/generate`, { method: "POST" }),
getEventWrapUp: (eventId: string) => request<PrismEventWrapUp | null>(`/api/events/${eventId}/wrap-up`),
startEventWrapUp: (eventId: string, input: StartEventWrapUpInput) => request<PrismEventWrapUp>(`/api/events/${eventId}/wrap-up`, { method: "POST", body: input }),
updateEventWrapUp: (eventId: string, input: UpdateEventWrapUpInput) => request<PrismEventWrapUp>(`/api/events/${eventId}/wrap-up`, { method: "PATCH", body: input }),
};

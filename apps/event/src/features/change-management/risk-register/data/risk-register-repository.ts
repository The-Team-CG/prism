import type { CreateEventRiskInput, PrismEventRisk, UpdateEventRiskInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const path = (eventId: string) => `/api/events/${eventId}/risks`;

export const riskRegisterRepository = {
  list: (eventId: string) => eventApiRequest<PrismEventRisk[]>(path(eventId)),
  loadStandard: (eventId: string) => eventApiRequest<PrismEventRisk[]>(`${path(eventId)}/standard`, { method: "POST" }),
  create: (eventId: string, input: CreateEventRiskInput) => eventApiRequest<PrismEventRisk>(path(eventId), { method: "POST", body: input }),
  update: (eventId: string, riskId: string, input: UpdateEventRiskInput) => eventApiRequest<PrismEventRisk>(`${path(eventId)}/${riskId}`, { method: "PATCH", body: input }),
};

import type {
  CompleteExternalCreativeTicketInput,
  CreateExternalCreativeTicketInput,
  PrismExternalCreativeTicket,
  UpdateExternalCreativeTicketInput,
} from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const path = (eventId: string) => `/api/events/${eventId}/external-creative-tickets`;

export const externalCreativeRepository = {
  list: (eventId: string) => eventApiRequest<PrismExternalCreativeTicket[]>(path(eventId)),
  create: (eventId: string, input: CreateExternalCreativeTicketInput) => eventApiRequest<PrismExternalCreativeTicket>(path(eventId), { method: "POST", body: input }),
  update: (eventId: string, ticketId: string, input: UpdateExternalCreativeTicketInput) => eventApiRequest<PrismExternalCreativeTicket>(`${path(eventId)}/${ticketId}`, { method: "PATCH", body: input }),
  complete: (eventId: string, ticketId: string, input: CompleteExternalCreativeTicketInput) => eventApiRequest<PrismExternalCreativeTicket>(`${path(eventId)}/${ticketId}/complete`, { method: "POST", body: input }),
};

import type { CompleteExternalCreativeTicketInput, CreateExternalCreativeTicketInput, UpdateExternalCreativeTicketInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const externalCreativeRepository = {
  list: (eventId: string) => eventApi.commercial.externalCreativeTickets(eventId),
  create: (eventId: string, input: CreateExternalCreativeTicketInput) => eventApi.commercial.createExternalCreativeTicket(eventId, input),
  update: (eventId: string, ticketId: string, input: UpdateExternalCreativeTicketInput) => eventApi.commercial.updateExternalCreativeTicket(eventId, ticketId, input),
  complete: (eventId: string, ticketId: string, input: CompleteExternalCreativeTicketInput) => eventApi.commercial.completeExternalCreativeTicket(eventId, ticketId, input),
};

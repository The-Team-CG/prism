import type { CreateInquiryContextNoteInput, PrismInquiryContextNote } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const contextNotesRepository = {
  list: (inquiryId: string) => eventApiRequest<PrismInquiryContextNote[]>(`/api/inquiries/${inquiryId}/context-notes`),
  add: (inquiryId: string, input: CreateInquiryContextNoteInput) => eventApiRequest<PrismInquiryContextNote>(`/api/inquiries/${inquiryId}/context-notes`, { method: "POST", body: input }),
  forEvent: (eventId: string) => eventApiRequest<PrismInquiryContextNote[]>(`/api/events/${eventId}/pre-conforme-context`),
};

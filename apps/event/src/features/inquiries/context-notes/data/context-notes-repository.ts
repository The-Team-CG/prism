import type { CreateInquiryContextNoteInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const contextNotesRepository = {
  list: (inquiryId: string) => eventApi.inquiries.contextNotes(inquiryId),
  add: (inquiryId: string, input: CreateInquiryContextNoteInput) => eventApi.inquiries.addContextNote(inquiryId, input),
  forEvent: (eventId: string) => eventApi.inquiries.preConformeContext(eventId),
};

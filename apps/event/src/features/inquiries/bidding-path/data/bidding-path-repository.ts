import type { PrismInquiry, SetInquiryIntakePathInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const biddingPathRepository = {
  set: (inquiryId: string, input: SetInquiryIntakePathInput) =>
    eventApiRequest<PrismInquiry>(`/api/inquiries/${inquiryId}/intake-path`, { method: "PATCH", body: input }),
  /** FR-43: the bid workspace is the inquiry's locked pre-conforme record; it becomes the event when the client signs. */
  workspace: (inquiryId: string) =>
    eventApiRequest<{ eventId: string }>(`/api/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, { method: "POST" }),
};

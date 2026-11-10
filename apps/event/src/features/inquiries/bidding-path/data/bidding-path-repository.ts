import type { SetInquiryIntakePathInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const biddingPathRepository = {
  set: (inquiryId: string, input: SetInquiryIntakePathInput) => eventApi.inquiries.setIntakePath(inquiryId, input),
  /** FR-43: the bid workspace is the inquiry's locked pre-conforme record; it becomes the event when the client signs. */
  workspace: (inquiryId: string) => eventApi.inquiries.createPreConformeWorkspace(inquiryId),
};

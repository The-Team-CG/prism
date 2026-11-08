import type { PrismInquiry, SetInquiryIntakePathInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const biddingPathRepository = {
  set: (inquiryId: string, input: SetInquiryIntakePathInput) =>
    eventApiRequest<PrismInquiry>(`/api/inquiries/${inquiryId}/intake-path`, { method: "PATCH", body: input }),
};

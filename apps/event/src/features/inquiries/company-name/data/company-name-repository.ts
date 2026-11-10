import type { UpdateInquiryCompanyNameInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const companyNameRepository = {
  history: (inquiryId: string) => eventApi.inquiries.companyNameChanges(inquiryId),
  update: (inquiryId: string, input: UpdateInquiryCompanyNameInput) => eventApi.inquiries.updateCompanyName(inquiryId, input),
};

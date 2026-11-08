import type { PrismCompanyNameChange, UpdateInquiryCompanyNameInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const companyNameRepository = {
  history: (inquiryId: string) => eventApiRequest<PrismCompanyNameChange[]>(`/api/inquiries/${inquiryId}/company-name-changes`),
  update: (inquiryId: string, input: UpdateInquiryCompanyNameInput) =>
    eventApiRequest<PrismCompanyNameChange>(`/api/inquiries/${inquiryId}/company-name`, { method: "PATCH", body: input }),
};

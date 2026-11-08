import { parseContract, setClientLanguageSchema, type ClientLanguage, type PrismInquiry } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const clientLanguageRepository = {
  save: (inquiryId: string, language: ClientLanguage) =>
    eventApiRequest<PrismInquiry>(`/api/inquiries/${encodeURIComponent(inquiryId)}/language`, { method: "PATCH", body: parseContract(setClientLanguageSchema, { language }, "Client language") }),
};

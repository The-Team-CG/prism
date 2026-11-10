import { parseContract, setClientLanguageSchema, type ClientLanguage } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const clientLanguageRepository = {
  save: (inquiryId: string, language: ClientLanguage) =>
    eventApi.inquiries.setLanguage(inquiryId, parseContract(setClientLanguageSchema, { language }, "Client language")),
};

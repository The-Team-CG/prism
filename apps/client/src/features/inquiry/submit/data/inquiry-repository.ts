import { prismApi, type CreatePrismInquiryInput, type PrismInquiry } from "@/lib/prism-api";

export const inquiryRepository = {
  create(input: CreatePrismInquiryInput): Promise<PrismInquiry> {
    return prismApi.createInquiry(input);
  },
};

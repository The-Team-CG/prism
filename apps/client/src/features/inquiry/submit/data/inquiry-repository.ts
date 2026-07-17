import { prismApi } from "@/lib/prism-api";
import type { CreatePrismInquiryInput, PrismInquiry } from "@prism/types";

export const inquiryRepository = {
  create(input: CreatePrismInquiryInput): Promise<PrismInquiry> {
    return prismApi.createInquiry(input);
  },
};

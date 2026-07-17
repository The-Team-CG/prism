import { prismApi } from "@/lib/prism-api";
import type { PrismInquiry } from "@prism/types";
import type { CreatePrismInquiryInput } from "@prism/api-client";

export const inquiryRepository = {
  create(input: CreatePrismInquiryInput): Promise<PrismInquiry> {
    return prismApi.createInquiry(input);
  },
};

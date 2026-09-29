import { clientApi, isClientLocalDemoMode } from "@/lib/prism-api";
import { prismApi as samplePrismApi } from "@/compatibility/sample/prism-api";
import type { CreatePrismInquiryInput, PrismInquiry } from "@prism/types";

export const inquiryRepository = {
  create(input: CreatePrismInquiryInput): Promise<PrismInquiry> {
    if (isClientLocalDemoMode) return samplePrismApi.createInquiry(input);
    return clientApi.inquiries.create(input);
  },
};

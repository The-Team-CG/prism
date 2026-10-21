import type {
  AiGatewayStreamEvent,
  CommsDraftRequest,
  CommsDraftResult,
  CreatePrismInquiryInput,
  PrismInquiry,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsInquiryContract {
  inquiries: {
    list(actor?: EventOpsActorQuery): Promise<PrismInquiry[]>;
    create(input: CreatePrismInquiryInput): Promise<PrismInquiry>;
  };

  conformeDrafts: {
    getForInquiry(inquiryId: string): Promise<unknown>;
    stream(
      input: CommsDraftRequest,
      signal?: AbortSignal,
    ): AsyncIterable<AiGatewayStreamEvent<CommsDraftResult>>;
    saveManual(inquiryId: string, draft: CommsDraftResult): Promise<unknown>;
    approve(draftId: string, draft: CommsDraftResult): Promise<unknown>;
    cancel(draftId: string): Promise<unknown>;
  };
}

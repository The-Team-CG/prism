import type {
  AiGatewayStreamEvent,
  CommsDraftRequest,
  CommsDraftResult,
  CreatePrismInquiryInput,
  LogInquiryOnBehalfInput,
  PrismDocument,
  PrismInquiryMergeRecord,
  UpdateInquiryStatusInput,
  UploadConformeInput,
  PrismInquiry,
  PrismPortalInvitationResend,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsInquiryContract {
  inquiries: {
    list(actor?: EventOpsActorQuery): Promise<PrismInquiry[]>;
    create(input: CreatePrismInquiryInput): Promise<PrismInquiry>;
    resendPortalInvitation(inquiryId: string): Promise<PrismPortalInvitationResend>;
    updateStatus(inquiryId: string, input: UpdateInquiryStatusInput, actor?: EventOpsActorQuery): Promise<PrismInquiry>;
    merge(primaryInquiryId: string, input: { sourceInquiryId: string; reason: string }, actor?: EventOpsActorQuery): Promise<PrismInquiryMergeRecord>;
    logOnBehalf(input: LogInquiryOnBehalfInput, actor?: EventOpsActorQuery): Promise<PrismInquiry>;
    sendConformeReminder(inquiryId: string, actor?: EventOpsActorQuery): Promise<PrismInquiry>;
    uploadConforme(inquiryId: string, input: UploadConformeInput, actor?: EventOpsActorQuery): Promise<PrismDocument>;
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

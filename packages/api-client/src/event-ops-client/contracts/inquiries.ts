import type {
  AiGatewayStreamEvent,
  CommsDraftRequest,
  CommsDraftResult,
  CreateConformeExecutionInput,
  CreateInquiryContextNoteInput,
  CreatePrismInquiryInput,
  PrismCompanyNameChange,
  PrismConformeExecution,
  PrismInquiryContextNote,
  SetClientLanguageInput,
  SetInquiryIntakePathInput,
  SignConformeExecutionInput,
  UpdateInquiryCompanyNameInput,
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
    setIntakePath(inquiryId: string, input: SetInquiryIntakePathInput, actor?: EventOpsActorQuery): Promise<PrismInquiry>;
    setLanguage(inquiryId: string, input: SetClientLanguageInput, actor?: EventOpsActorQuery): Promise<PrismInquiry>;
    companyNameChanges(inquiryId: string, actor?: EventOpsActorQuery): Promise<PrismCompanyNameChange[]>;
    updateCompanyName(inquiryId: string, input: UpdateInquiryCompanyNameInput, actor?: EventOpsActorQuery): Promise<PrismCompanyNameChange>;
    contextNotes(inquiryId: string, actor?: EventOpsActorQuery): Promise<PrismInquiryContextNote[]>;
    addContextNote(inquiryId: string, input: CreateInquiryContextNoteInput, actor?: EventOpsActorQuery): Promise<PrismInquiryContextNote>;
    /** Context notes carried from the inquiry into its pre-conforme event record. */
    preConformeContext(eventId: string, actor?: EventOpsActorQuery): Promise<PrismInquiryContextNote[]>;
    /** The locked pre-conforme record of an inquiry, or `eventId: null` when none exists yet. */
    existingPreConformeWorkspace(inquiryId: string, actor?: EventOpsActorQuery): Promise<{ eventId: string | null }>;
    createPreConformeWorkspace(inquiryId: string, actor?: EventOpsActorQuery): Promise<{ eventId: string }>;
    latestConformeExecution(inquiryId: string, actor?: EventOpsActorQuery): Promise<PrismConformeExecution>;
    createConformeExecution(inquiryId: string, input: CreateConformeExecutionInput, actor?: EventOpsActorQuery): Promise<PrismConformeExecution>;
    signConformeExecution(inquiryId: string, executionId: string, input: SignConformeExecutionInput, actor?: EventOpsActorQuery): Promise<PrismConformeExecution>;
    /** The AI triage review as the API returns it; the caller parses it into its own model. */
    triageReview(inquiryId: string, actor?: EventOpsActorQuery): Promise<unknown>;
    runTriage(inquiryId: string, actor?: EventOpsActorQuery): Promise<unknown>;
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

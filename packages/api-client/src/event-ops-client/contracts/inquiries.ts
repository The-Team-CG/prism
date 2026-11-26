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

export interface EventOpsInquiryContract {
  inquiries: {
    list(): Promise<PrismInquiry[]>;
    create(input: CreatePrismInquiryInput): Promise<PrismInquiry>;
    resendPortalInvitation(inquiryId: string): Promise<PrismPortalInvitationResend>;
    updateStatus(inquiryId: string, input: UpdateInquiryStatusInput): Promise<PrismInquiry>;
    merge(primaryInquiryId: string, input: { sourceInquiryId: string; reason: string }): Promise<PrismInquiryMergeRecord>;
    logOnBehalf(input: LogInquiryOnBehalfInput): Promise<PrismInquiry>;
    sendConformeReminder(inquiryId: string): Promise<PrismInquiry>;
    uploadConforme(inquiryId: string, input: UploadConformeInput): Promise<PrismDocument>;
    setIntakePath(inquiryId: string, input: SetInquiryIntakePathInput): Promise<PrismInquiry>;
    setLanguage(inquiryId: string, input: SetClientLanguageInput): Promise<PrismInquiry>;
    companyNameChanges(inquiryId: string): Promise<PrismCompanyNameChange[]>;
    updateCompanyName(inquiryId: string, input: UpdateInquiryCompanyNameInput): Promise<PrismCompanyNameChange>;
    contextNotes(inquiryId: string): Promise<PrismInquiryContextNote[]>;
    addContextNote(inquiryId: string, input: CreateInquiryContextNoteInput): Promise<PrismInquiryContextNote>;
    /** Context notes carried from the inquiry into its pre-conforme event record. */
    preConformeContext(eventId: string): Promise<PrismInquiryContextNote[]>;
    /** The locked pre-conforme record of an inquiry, or `eventId: null` when none exists yet. */
    existingPreConformeWorkspace(inquiryId: string): Promise<{ eventId: string | null }>;
    createPreConformeWorkspace(inquiryId: string): Promise<{ eventId: string }>;
    latestConformeExecution(inquiryId: string): Promise<PrismConformeExecution>;
    createConformeExecution(inquiryId: string, input: CreateConformeExecutionInput): Promise<PrismConformeExecution>;
    signConformeExecution(inquiryId: string, executionId: string, input: SignConformeExecutionInput): Promise<PrismConformeExecution>;
    /** The AI triage review as the API returns it; the caller parses it into its own model. */
    triageReview(inquiryId: string): Promise<unknown>;
    runTriage(inquiryId: string): Promise<unknown>;
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

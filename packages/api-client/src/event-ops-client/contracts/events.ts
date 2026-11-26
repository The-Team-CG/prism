import type { PrismFile } from "../../http";
import type {
  ArchiveSearchFilters,
  ReviewEventProposalInput,
  PrismArchivedEventSearchHit,
  PrismEvent,
  PrismEventPage,
  PrismFileRequirementsMatrix,
  PrismFileRequirementReminder,
  PrismFileRequirementTemplate,
  PrismStoredObject,
  PrismAddendum,
  PrismStatementOfAccount,
  PrismAddendumConformeExecution,
  SignAddendumConformeExecutionInput,
  PrismEventFreezeException,
  UpsertFileRequirementTemplateInput,
  PrismEventDecision,
  PrismClientChangeRequest,
  PrismScopeChangeRequest,
  PrismEventRiskView,
} from "@prism/types";
import type { EventOpsReadInit } from "./primitives";

export interface EventOpsEventsContract {
  events: {
    list(cursor?: string): Promise<PrismEventPage>;
    detail(eventId: string): Promise<PrismEvent>;
    decisionHistory(eventId: string): Promise<PrismEventDecision[]>;
    recordDecision(
      eventId: string,
      input: import("@prism/types").RecordEventDecisionInput,
    ): Promise<PrismEventDecision>;
    changeRequests(eventId: string): Promise<PrismClientChangeRequest[]>;
    scopeChangeRequests(eventId: string): Promise<PrismScopeChangeRequest[]>;
    submitScopeChangeRequest(
      eventId: string,
      input: import("@prism/types").SubmitScopeChangeRequestInput,
    ): Promise<PrismScopeChangeRequest>;
    withdrawScopeChangeRequest(eventId: string, requestId: string): Promise<PrismScopeChangeRequest>;
    reviewScopeChangeRequest(
      eventId: string,
      requestId: string,
      input: import("@prism/types").ReviewScopeChangeRequestInput,
    ): Promise<PrismScopeChangeRequest>;
    riskAssessment(eventId: string): Promise<PrismEventRiskView>;
    recordRiskAssessment(
      eventId: string,
      input: import("@prism/types").RecordEventRiskAssessmentInput,
    ): Promise<PrismEventRiskView>;
    fileRequirements(
      eventId: string,
    ): Promise<PrismFileRequirementsMatrix>;
    createFileRequirement(
      eventId: string,
      input: import("@prism/types").CreateFileRequirementInput,
    ): Promise<import("@prism/types").PrismFileRequirementItem>;
    updateFileRequirement(
      eventId: string,
      key: string,
      input: import("@prism/types").UpdateFileRequirementInput,
    ): Promise<import("@prism/types").PrismFileRequirementItem>;
    sendFileRequirementReminders(eventId: string): Promise<{ reminders: PrismFileRequirementReminder[] }>;
    listFileRequirementTemplates(): Promise<PrismFileRequirementTemplate[]>;
    upsertFileRequirementTemplate(input: UpsertFileRequirementTemplateInput): Promise<PrismFileRequirementTemplate>;
    applyFileRequirementTemplate(eventId: string): Promise<{ eventId: string; eventType: string; templateId: string; createdKeys: string[]; skippedExistingCount: number }>;
    bindFileRequirementUpload(eventId: string, key: string, input: import("@prism/types").BindFileRequirementUploadInput): Promise<import("@prism/types").PrismFileRequirementItem>;
    reviewRequirementFile(eventId: string, key: string, input: import("@prism/types").ReviewRequirementFileInput): Promise<import("@prism/types").PrismFileRequirementItem>;
    reviewProposal(
      eventId: string,
      input: ReviewEventProposalInput,
    ): Promise<PrismEvent>;
    searchArchive(
      filters?: ArchiveSearchFilters,
    ): Promise<PrismArchivedEventSearchHit[]>;
    /** Every stored object that belongs to an event, whatever record owns it. */
    storageObjects(eventId: string): Promise<PrismStoredObject[]>;
    addenda(
      eventId: string,
    ): Promise<PrismAddendum[]>;
    /** What a client sees of one event's money: billed, received, refunds, credit held and what is still owed. */
    statementOfAccount(eventId: string, init?: EventOpsReadInit): Promise<PrismStatementOfAccount>;
    /** The statement of account as a printable PDF. */
    statementOfAccountPdf(eventId: string): Promise<PrismFile>;
    /** A payment QR image the client's statement shows, for scanning from their own banking app. */
    paymentQrImage(eventId: string, imageId: string): Promise<PrismFile>;
    /** A receipt for one payment on the statement. */
    paymentReceiptPdf(eventId: string, recordId: string): Promise<PrismFile>;
    freezeExceptions(
      eventId: string,
    ): Promise<PrismEventFreezeException[]>;
    freeze(
      eventId: string,
      input: import("@prism/types").FreezeEventInput,
    ): Promise<unknown>;
    requestFreezeException(
      eventId: string,
      input: import("@prism/types").RequestFreezeExceptionInput,
    ): Promise<PrismEventFreezeException>;
    decideFreezeException(
      eventId: string,
      exceptionId: string,
      input: import("@prism/types").DecideFreezeExceptionInput,
    ): Promise<PrismEventFreezeException>;
    issueAddendum(
      eventId: string,
      input: import("@prism/types").IssueAddendumInput,
    ): Promise<PrismAddendum>;
    requestAddendumConforme(
      eventId: string,
      addendumId: string,
    ): Promise<PrismAddendumConformeExecution>;
    acknowledgeAddendumConforme(
      eventId: string,
      addendumId: string,
      input: SignAddendumConformeExecutionInput,
    ): Promise<PrismAddendumConformeExecution>;
    countersignAddendumConforme(
      eventId: string,
      addendumId: string,
      input: SignAddendumConformeExecutionInput,
    ): Promise<PrismAddendumConformeExecution>;
    withdrawAddendum(
      eventId: string,
      addendumId: string,
      input: import("@prism/types").WithdrawAddendumInput,
    ): Promise<PrismAddendum>;
  };
}

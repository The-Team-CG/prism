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
  PrismAddendumConformeExecution,
  SignAddendumConformeExecutionInput,
  PrismEventFreezeException,
  RequestStorageUploadInput,
  UpsertFileRequirementTemplateInput,
  ConfirmStorageUploadInput,
  PrismEventDecision,
  PrismClientChangeRequest,
  PrismScopeChangeRequest,
  PrismEventRiskView,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsEventsContract {
  events: {
    list(actor?: EventOpsActorQuery, cursor?: string): Promise<PrismEventPage>;
    detail(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEvent>;
    decisionHistory(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventDecision[]>;
    recordDecision(
      eventId: string,
      input: import("@prism/types").RecordEventDecisionInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventDecision>;
    changeRequests(eventId: string, actor?: EventOpsActorQuery): Promise<PrismClientChangeRequest[]>;
    scopeChangeRequests(eventId: string, actor?: EventOpsActorQuery): Promise<PrismScopeChangeRequest[]>;
    submitScopeChangeRequest(
      eventId: string,
      input: import("@prism/types").SubmitScopeChangeRequestInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismScopeChangeRequest>;
    withdrawScopeChangeRequest(eventId: string, requestId: string, actor?: EventOpsActorQuery): Promise<PrismScopeChangeRequest>;
    reviewScopeChangeRequest(
      eventId: string,
      requestId: string,
      input: import("@prism/types").ReviewScopeChangeRequestInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismScopeChangeRequest>;
    riskAssessment(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventRiskView>;
    recordRiskAssessment(
      eventId: string,
      input: import("@prism/types").RecordEventRiskAssessmentInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventRiskView>;
    fileRequirements(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismFileRequirementsMatrix>;
    createFileRequirement(
      eventId: string,
      input: import("@prism/types").CreateFileRequirementInput,
      actor?: EventOpsActorQuery,
    ): Promise<import("@prism/types").PrismFileRequirementItem>;
    updateFileRequirement(
      eventId: string,
      key: string,
      input: import("@prism/types").UpdateFileRequirementInput,
      actor?: EventOpsActorQuery,
    ): Promise<import("@prism/types").PrismFileRequirementItem>;
    sendFileRequirementReminders(eventId: string, actor?: EventOpsActorQuery): Promise<{ reminders: PrismFileRequirementReminder[] }>;
    listFileRequirementTemplates(actor?: EventOpsActorQuery): Promise<PrismFileRequirementTemplate[]>;
    upsertFileRequirementTemplate(input: UpsertFileRequirementTemplateInput, actor?: EventOpsActorQuery): Promise<PrismFileRequirementTemplate>;
    applyFileRequirementTemplate(eventId: string, actor?: EventOpsActorQuery): Promise<{ eventId: string; eventType: string; templateId: string; createdKeys: string[]; skippedExistingCount: number }>;
    bindFileRequirementUpload(eventId: string, key: string, input: import("@prism/types").BindFileRequirementUploadInput, actor?: EventOpsActorQuery): Promise<import("@prism/types").PrismFileRequirementItem>;
    reviewProposal(
      eventId: string,
      input: ReviewEventProposalInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEvent>;
    searchArchive(
      filters?: ArchiveSearchFilters,
      actor?: EventOpsActorQuery,
    ): Promise<PrismArchivedEventSearchHit[]>;
    documents(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismStoredObject[]>;
    requestDocumentUpload(
      input: RequestStorageUploadInput,
      actor?: EventOpsActorQuery,
    ): Promise<unknown>;
    confirmDocumentUpload(
      eventId: string,
      objectId: string,
      input: ConfirmStorageUploadInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismStoredObject>;
    documentDownloadAuthorization(
      objectId: string,
      actor?: EventOpsActorQuery,
    ): Promise<unknown>;
    addenda(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismAddendum[]>;
    freezeExceptions(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventFreezeException[]>;
    freeze(
      eventId: string,
      input: import("@prism/types").FreezeEventInput,
      actor?: EventOpsActorQuery,
    ): Promise<unknown>;
    requestFreezeException(
      eventId: string,
      input: import("@prism/types").RequestFreezeExceptionInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventFreezeException>;
    decideFreezeException(
      eventId: string,
      exceptionId: string,
      input: import("@prism/types").DecideFreezeExceptionInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventFreezeException>;
    issueAddendum(
      eventId: string,
      input: import("@prism/types").IssueAddendumInput,
      actor?: EventOpsActorQuery,
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
  };
}

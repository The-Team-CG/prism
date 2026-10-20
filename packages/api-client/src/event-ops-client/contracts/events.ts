import type {
  ArchiveSearchFilters,
  ReviewEventProposalInput,
  CreateFloorPlanRevisionCommentInput,
  PrismArchivedEventSearchHit,
  PrismFloorPlanDraft,
  PrismEvent,
  PrismEventPage,
  PrismFileRequirementsMatrix,
  PrismStoredObject,
  PrismAddendum,
  PrismAddendumConformeExecution,
  SignAddendumConformeExecutionInput,
  PrismEventFreezeException,
  RequestStorageUploadInput,
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
    reviewProposal(
      eventId: string,
      input: ReviewEventProposalInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEvent>;
    reviewFloorPlanDraft(
      eventId: string,
      draftId: string,
      input: CreateFloorPlanRevisionCommentInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismFloorPlanDraft>;
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

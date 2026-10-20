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

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
  PrismEventFreezeException,
  RequestStorageUploadInput,
  ConfirmStorageUploadInput,
  PrismEventDecision,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsEventsContract {
  events: {
    list(actor?: EventOpsActorQuery, cursor?: string): Promise<PrismEventPage>;
    detail(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEvent>;
    decisionHistory(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventDecision[]>;
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
  };
}

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
  PrismClientChangeRequest,
  PrismAddendumConformeExecution,
  PrismClientAddendumConforme,
  IssueAddendumConformeInput,
  SignAddendumConformeInput,
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
    /** PMCM register: every addendum conforme version for the event, newest version first per addendum. */
    addendumConformes(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismAddendumConformeExecution[]>;
    /** Primary client projection of addendum conformes awaiting or carrying their acknowledgement. */
    clientAddendumConformes(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismClientAddendumConforme[]>;
    issueAddendumConforme(
      eventId: string,
      addendumId: string,
      input: IssueAddendumConformeInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismAddendumConformeExecution>;
    acknowledgeAddendumConforme(
      eventId: string,
      addendumId: string,
      input: SignAddendumConformeInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismClientAddendumConforme>;
    countersignAddendumConforme(
      eventId: string,
      addendumId: string,
      input: SignAddendumConformeInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismAddendumConformeExecution>;
  };
}

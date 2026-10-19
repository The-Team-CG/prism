import type {
  PrismArchivedEventSearchHit,
  PrismFloorPlanDraft,
  PrismEvent,
  PrismEventPage,
  PrismFileRequirementsMatrix,
  PrismStoredObject,
  PrismAddendum,
  PrismEventFreezeException,
  PrismEventDecision,
  PrismClientChangeRequest,
  PrismAddendumConformeExecution,
  PrismClientAddendumConforme,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createEventsClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "events"> {
  return {
    events: {
      list: (actor = {}, cursor?: string) => {
        const query = toQueryString({ ...actor, cursor });
        return prismRequest<PrismEventPage>(query ? `/events?${query}` : "/events", withBase(options),
        );
      },
      detail: (eventId, actor = {}) =>
        prismRequest<PrismEvent>(
          actorPath(`/events/${eventId}`, actor),
          withBase(options),
        ),
      decisionHistory: (eventId, actor = {}) =>
        prismRequest<PrismEventDecision[]>(
          actorPath(`/events/${eventId}/decisions`, actor),
          withBase(options),
        ),
      recordDecision: (eventId, input, actor = {}) =>
        prismRequest<PrismEventDecision>(
          actorPath(`/events/${eventId}/decisions`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      changeRequests: (eventId, actor = {}) =>
        prismRequest<PrismClientChangeRequest[]>(
          actorPath(`/events/${eventId}/change-requests`, actor),
          withBase(options),
        ),
      fileRequirements: (eventId, actor = {}) =>
        prismRequest<PrismFileRequirementsMatrix>(
          actorPath(`/events/${eventId}/file-requirements`, actor),
          withBase(options),
        ),
      reviewProposal: (eventId, input, actor = {}) =>
        prismRequest<PrismEvent>(
          actorPath(`/events/${eventId}/proposal/review`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      reviewFloorPlanDraft: (eventId, draftId, input, actor = {}) =>
        prismRequest<PrismFloorPlanDraft>(
          actorPath(`/events/${eventId}/floorplans/${draftId}/review`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      searchArchive: (filters = {}, actor = {}) => {
        const query = toQueryString({ ...actor, ...filters });
        return prismRequest<PrismArchivedEventSearchHit[]>(
          query ? `/events/archive?${query}` : "/events/archive",
          withBase(options),
        );
      },
      documents: (eventId, actor = {}) =>
        prismRequest<PrismStoredObject[]>(
          actorPath(`/events/${eventId}/documents`, actor),
          withBase(options),
        ),
      requestDocumentUpload: (input, actor = {}) =>
        prismRequest(
          actorPath(`/events/${input.eventId}/documents/upload-request`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      confirmDocumentUpload: (eventId, objectId, input, actor = {}) =>
        prismRequest<PrismStoredObject>(
          actorPath(`/events/${eventId}/documents/${objectId}/confirm`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      documentDownloadAuthorization: (objectId, actor = {}) =>
        prismRequest(
          actorPath(
            `/storage/objects/${objectId}/download-authorization`,
            actor,
          ),
          withBase(options),
        ),
      addenda: (eventId, actor = {}) =>
        prismRequest<PrismAddendum[]>(
          actorPath(`/events/${eventId}/addenda`, actor),
          withBase(options),
        ),
      freezeExceptions: (eventId, actor = {}) =>
        prismRequest<PrismEventFreezeException[]>(
          actorPath(`/events/${eventId}/freeze-exceptions`, actor),
          withBase(options),
        ),
      freeze: (eventId, input, actor = {}) =>
        prismRequest(
          actorPath(`/events/${eventId}/freeze`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      requestFreezeException: (eventId, input, actor = {}) =>
        prismRequest<PrismEventFreezeException>(
          actorPath(`/events/${eventId}/freeze-exceptions`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      decideFreezeException: (eventId, exceptionId, input, actor = {}) =>
        prismRequest<PrismEventFreezeException>(
          actorPath(
            `/events/${eventId}/freeze-exceptions/${exceptionId}`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      issueAddendum: (eventId, input, actor = {}) =>
        prismRequest<PrismAddendum>(
          actorPath(`/events/${eventId}/addenda`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      addendumConformes: (eventId, actor = {}) =>
        prismRequest<PrismAddendumConformeExecution[]>(
          actorPath(`/events/${eventId}/addenda/conformes`, actor),
          withBase(options),
        ),
      clientAddendumConformes: (eventId, actor = {}) =>
        prismRequest<PrismClientAddendumConforme[]>(
          actorPath(`/events/${eventId}/addenda/client-conformes`, actor),
          withBase(options),
        ),
      issueAddendumConforme: (eventId, addendumId, input, actor = {}) =>
        prismRequest<PrismAddendumConformeExecution>(
          actorPath(`/events/${eventId}/addenda/${addendumId}/conforme`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      acknowledgeAddendumConforme: (eventId, addendumId, input, actor = {}) =>
        prismRequest<PrismClientAddendumConforme>(
          actorPath(`/events/${eventId}/addenda/${addendumId}/conforme/${input.executionId}/acknowledge`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      countersignAddendumConforme: (eventId, addendumId, input, actor = {}) =>
        prismRequest<PrismAddendumConformeExecution>(
          actorPath(`/events/${eventId}/addenda/${addendumId}/conforme/${input.executionId}/countersign`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}

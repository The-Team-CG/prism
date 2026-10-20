import type {
  PrismArchivedEventSearchHit,
  PrismFloorPlanDraft,
  PrismEvent,
  PrismEventPage,
  PrismFileRequirementItem,
  PrismFileRequirementsMatrix,
  PrismStoredObject,
  PrismAddendum,
  PrismAddendumConformeExecution,
  PrismEventFreezeException,
  PrismEventDecision,
  PrismClientChangeRequest,
  PrismScopeChangeRequest,
  PrismEventRiskView,
  SignAddendumConformeExecutionInput,
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
      scopeChangeRequests: (eventId, actor = {}) =>
        prismRequest<PrismScopeChangeRequest[]>(
          actorPath(`/events/${eventId}/scope-changes`, actor),
          withBase(options),
        ),
      submitScopeChangeRequest: (eventId, input, actor = {}) =>
        prismRequest<PrismScopeChangeRequest>(
          actorPath(`/events/${eventId}/scope-changes`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      withdrawScopeChangeRequest: (eventId, requestId, actor = {}) =>
        prismRequest<PrismScopeChangeRequest>(
          actorPath(`/events/${eventId}/scope-changes/${requestId}/withdraw`, actor),
          withBase(options, { method: "POST" }),
        ),
      reviewScopeChangeRequest: (eventId, requestId, input, actor = {}) =>
        prismRequest<PrismScopeChangeRequest>(
          actorPath(`/events/${eventId}/scope-changes/${requestId}`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      riskAssessment: (eventId, actor = {}) =>
        prismRequest<PrismEventRiskView>(
          actorPath(`/events/${eventId}/risk-assessment`, actor),
          withBase(options),
        ),
      recordRiskAssessment: (eventId, input, actor = {}) =>
        prismRequest<PrismEventRiskView>(
          actorPath(`/events/${eventId}/risk-assessment`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      fileRequirements: (eventId, actor = {}) =>
        prismRequest<PrismFileRequirementsMatrix>(
          actorPath(`/events/${eventId}/file-requirements`, actor),
          withBase(options),
        ),
      createFileRequirement: (eventId, input, actor = {}) =>
        prismRequest<PrismFileRequirementItem>(
          actorPath(`/events/${eventId}/file-requirements`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateFileRequirement: (eventId, key, input, actor = {}) =>
        prismRequest<PrismFileRequirementItem>(
          actorPath(`/events/${eventId}/file-requirements/${encodeURIComponent(key)}`, actor),
          withBase(options, { method: "PATCH", body: input }),
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
      // Identity comes from the verified bearer token; these routes take no actor query.
      requestAddendumConforme: (eventId, addendumId) =>
        prismRequest<PrismAddendumConformeExecution>(
          `/events/${eventId}/addenda/${addendumId}/conforme-execution`,
          withBase(options, { method: "POST" }),
        ),
      acknowledgeAddendumConforme: (eventId, addendumId, input) =>
        prismRequest<PrismAddendumConformeExecution>(
          `/events/${eventId}/addenda/${addendumId}/conforme-execution/acknowledge`,
          withBase(options, { method: "POST", body: input }),
        ),
      countersignAddendumConforme: (eventId, addendumId, input) =>
        prismRequest<PrismAddendumConformeExecution>(
          `/events/${eventId}/addenda/${addendumId}/conforme-execution/countersign`,
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}

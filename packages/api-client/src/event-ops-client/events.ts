import type {
  PrismArchivedEventSearchHit,
  PrismEvent,
  PrismEventPage,
  PrismFileRequirementItem,
  PrismFileRequirementsMatrix,
  PrismStoredObject,
  PrismAddendum,
  PrismStatementOfAccount,
  PrismAddendumConformeExecution,
  PrismEventFreezeException,
  PrismEventDecision,
  PrismClientChangeRequest,
  PrismScopeChangeRequest,
  PrismEventRiskView,
  SignAddendumConformeExecutionInput,
} from "@prism/types";
import { prismFile, prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createEventsClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "events"> {
  return {
    events: {
      list: (cursor?: string) => {
        const query = toQueryString({ cursor });
        return prismRequest<PrismEventPage>(query ? `/events?${query}` : "/events", withBase(options),
        );
      },
      detail: (eventId) =>
        prismRequest<PrismEvent>(
          `/events/${eventId}`,
          withBase(options),
        ),
      decisionHistory: (eventId) =>
        prismRequest<PrismEventDecision[]>(
          `/events/${eventId}/decisions`,
          withBase(options),
        ),
      recordDecision: (eventId, input) =>
        prismRequest<PrismEventDecision>(
          `/events/${eventId}/decisions`,
          withBase(options, { method: "POST", body: input }),
        ),
      changeRequests: (eventId) =>
        prismRequest<PrismClientChangeRequest[]>(
          `/events/${eventId}/change-requests`,
          withBase(options),
        ),
      scopeChangeRequests: (eventId) =>
        prismRequest<PrismScopeChangeRequest[]>(
          `/events/${eventId}/scope-changes`,
          withBase(options),
        ),
      submitScopeChangeRequest: (eventId, input) =>
        prismRequest<PrismScopeChangeRequest>(
          `/events/${eventId}/scope-changes`,
          withBase(options, { method: "POST", body: input }),
        ),
      withdrawScopeChangeRequest: (eventId, requestId) =>
        prismRequest<PrismScopeChangeRequest>(
          `/events/${eventId}/scope-changes/${requestId}/withdraw`,
          withBase(options, { method: "POST" }),
        ),
      reviewScopeChangeRequest: (eventId, requestId, input) =>
        prismRequest<PrismScopeChangeRequest>(
          `/events/${eventId}/scope-changes/${requestId}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      riskAssessment: (eventId) =>
        prismRequest<PrismEventRiskView>(
          `/events/${eventId}/risk-assessment`,
          withBase(options),
        ),
      recordRiskAssessment: (eventId, input) =>
        prismRequest<PrismEventRiskView>(
          `/events/${eventId}/risk-assessment`,
          withBase(options, { method: "POST", body: input }),
        ),
      fileRequirements: (eventId) =>
        prismRequest<PrismFileRequirementsMatrix>(
          `/events/${eventId}/file-requirements`,
          withBase(options),
        ),
      createFileRequirement: (eventId, input) =>
        prismRequest<PrismFileRequirementItem>(
          `/events/${eventId}/file-requirements`,
          withBase(options, { method: "POST", body: input }),
        ),
      updateFileRequirement: (eventId, key, input) =>
        prismRequest<PrismFileRequirementItem>(
          `/events/${eventId}/file-requirements/${encodeURIComponent(key)}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      sendFileRequirementReminders: (eventId) =>
        prismRequest<{ reminders: import("@prism/types").PrismFileRequirementReminder[] }>(
          `/events/${eventId}/file-requirements/reminders`,
          withBase(options, { method: "POST" }),
        ),
      listFileRequirementTemplates: () =>
        prismRequest<import("@prism/types").PrismFileRequirementTemplate[]>("/file-requirement-templates", withBase(options)),
      upsertFileRequirementTemplate: (input) =>
        prismRequest<import("@prism/types").PrismFileRequirementTemplate>("/file-requirement-templates", withBase(options, { method: "POST", body: input })),
      applyFileRequirementTemplate: (eventId) =>
        prismRequest<{ eventId: string; eventType: string; templateId: string; createdKeys: string[]; skippedExistingCount: number }>(
          `/events/${eventId}/file-requirements/apply-template`, withBase(options, { method: "POST" })),
      bindFileRequirementUpload: (eventId, key, input) =>
        prismRequest<PrismFileRequirementItem>(`/events/${eventId}/file-requirements/${encodeURIComponent(key)}/upload`, withBase(options, { method: "POST", body: input })),
      reviewRequirementFile: (eventId, key, input) =>
        prismRequest<PrismFileRequirementItem>(`/events/${eventId}/file-requirements/${encodeURIComponent(key)}/review`, withBase(options, { method: "POST", body: input })),
      reviewProposal: (eventId, input) =>
        prismRequest<PrismEvent>(
          `/events/${eventId}/proposal/review`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      searchArchive: (filters = {}) => {
        const query = toQueryString({ ...filters });
        return prismRequest<PrismArchivedEventSearchHit[]>(
          query ? `/events/archive?${query}` : "/events/archive",
          withBase(options),
        );
      },
      storageObjects: (eventId) =>
        prismRequest<PrismStoredObject[]>(
          `/storage/objects/events/${encodeURIComponent(eventId)}`,
          withBase(options),
        ),
      addenda: (eventId) =>
        prismRequest<PrismAddendum[]>(
          `/events/${eventId}/addenda`,
          withBase(options),
        ),
      statementOfAccount: (eventId, init = {}) =>
        prismRequest<PrismStatementOfAccount>(`/events/${eventId}/statement-of-account`, withBase(options, { signal: init.signal })),
      statementOfAccountPdf: (eventId) =>
        prismFile(`/events/${encodeURIComponent(eventId)}/statement-of-account/pdf`, withBase(options), "statement-of-account.pdf"),
      paymentQrImage: (eventId, imageId) =>
        prismFile(`/events/${encodeURIComponent(eventId)}/statement-of-account/payment-qr/${encodeURIComponent(imageId)}`, withBase(options), "payment-qr"),
      paymentReceiptPdf: (eventId, recordId) =>
        prismFile(`/events/${encodeURIComponent(eventId)}/payment-records/${encodeURIComponent(recordId)}/receipt`, withBase(options), "payment-receipt.pdf"),
      freezeExceptions: (eventId) =>
        prismRequest<PrismEventFreezeException[]>(
          `/events/${eventId}/freeze-exceptions`,
          withBase(options),
        ),
      freeze: (eventId, input) =>
        prismRequest(
          `/events/${eventId}/freeze`,
          withBase(options, { method: "POST", body: input }),
        ),
      requestFreezeException: (eventId, input) =>
        prismRequest<PrismEventFreezeException>(
          `/events/${eventId}/freeze-exceptions`,
          withBase(options, { method: "POST", body: input }),
        ),
      decideFreezeException: (eventId, exceptionId, input) =>
        prismRequest<PrismEventFreezeException>(
          `/events/${eventId}/freeze-exceptions/${exceptionId}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      issueAddendum: (eventId, input) =>
        prismRequest<PrismAddendum>(
          `/events/${eventId}/addenda`,
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
      // PMCM only. Refused once the addendum is effective, because its billing and quote effect has been applied.
      withdrawAddendum: (eventId, addendumId, input) =>
        prismRequest<PrismAddendum>(
          `/events/${eventId}/addenda/${addendumId}/withdraw`,
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}

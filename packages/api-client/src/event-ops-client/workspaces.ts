import type {
  PrismSupplierQuote,
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismDecisionLog,
  PrismPmcmCommandInbox,
  PrismPmcmCalendar,
  PrismPmcmCommandInboxQueryInput,
  PrismPmcmEventSummaries,
  PrismPmcmFileSummaries,
  PmcmCalendarQuery,
  PrismPmcmReference,
  PrismPmcmEventWorkspace,
  PrismPmcmSupplierReadinessBoard,
  PrismRegistrationPlatform,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createWorkspacesClient(
  options: EventOpsClientOptions,
): Pick<
  EventOpsClient,
  "clientWorkspace" | "supplierWorkspace" | "billing" | "pmcm"
> {
  return {
    clientWorkspace: {
      detail: (actor = {}, cursor?: string) => {
        const query = toQueryString({ ...actor, cursor });
        return prismRequest<PrismClientWorkspace>(
          query ? `/client/workspace?${query}` : "/client/workspace",
          withBase(options),
        );
      },
      actionCenter: (actor = {}) =>
        prismRequest<PrismClientActionCenter>(
          actorPath("/client/action-center", actor),
          withBase(options),
        ),
    },
    supplierWorkspace: {
      detail: () =>
        prismRequest<PrismSupplierWorkspace>(
          "/supplier/workspace",
          withBase(options),
        ),
      readinessBoard: () =>
        prismRequest<PrismSupplierReadinessBoard>(
          "/supplier/readiness-board",
          withBase(options),
        ),
      confirmAssignment: (requestId, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(
            `/supplier/quote-requests/${requestId}/assignment/confirm`,
            actor,
          ),
          withBase(options, { method: "PATCH" }),
        ),
      confirmReadiness: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(
            `/supplier/quote-requests/${requestId}/readiness/confirm`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateEventStatus: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(
            `/supplier/quote-requests/${requestId}/event-status`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      // The link's token is the credential, so an `authToken` of "" keeps a stored session token off the request
      // (a session that has since expired must not trigger a sign-out on a public page).
      submitQuoteByLink: (token, input) =>
        prismRequest<PrismSupplierQuote>(
          `/quote-requests/${encodeURIComponent(token)}/quote`,
          withBase(options, { method: "POST", body: input, authToken: "" }),
        ),
      reviseQuoteByLink: (token, input) =>
        prismRequest<PrismSupplierQuote>(
          `/quote-requests/${encodeURIComponent(token)}/quote`,
          withBase(options, { method: "PATCH", body: input, authToken: "" }),
        ),
    },
    billing: {
      list: (actor = {}) =>
        prismRequest<PrismBillingWorkspace>(
          actorPath("/billing", actor),
          withBase(options),
        ),
    },
    pmcm: {
      reference: () => prismRequest<PrismPmcmReference>("/pmcm/reference", withBase(options)),
      commandInbox: (query: PrismPmcmCommandInboxQueryInput = { page: 0 }) => {
        const params = toQueryString(query);
        return prismRequest<PrismPmcmCommandInbox>(
          params ? `/pmcm/command-inbox?${params}` : "/pmcm/command-inbox",
          withBase(options),
        );
      },
      eventSummaries: () => prismRequest<PrismPmcmEventSummaries>("/pmcm/event-summaries", withBase(options)),
      fileSummaries: () => prismRequest<PrismPmcmFileSummaries>("/pmcm/file-summaries", withBase(options)),
      calendar: (query: PmcmCalendarQuery) => prismRequest<PrismPmcmCalendar>(`/pmcm/calendar?${toQueryString(query)}`, withBase(options)),
      decisionLog: (eventId, query = {}) => {
        const params = toQueryString(query);
        const path = `/events/${encodeURIComponent(eventId)}/decision-log`;
        return prismRequest<PrismDecisionLog>(
          params ? `${path}?${params}` : path,
          withBase(options),
        );
      },
      eventWorkspace: (eventId, actor = {}) =>
        prismRequest<PrismPmcmEventWorkspace>(
          actorPath(`/pmcm/events/${eventId}/workspace`, actor),
          withBase(options),
        ),
      supplierReadiness: (eventId) =>
        prismRequest<PrismPmcmSupplierReadinessBoard>(
          `/pmcm/events/${encodeURIComponent(eventId)}/supplier-readiness`,
          withBase(options),
        ),
      registrationPlatform: (eventId, actor = {}) =>
        prismRequest<PrismRegistrationPlatform | null>(
          actorPath(`/events/${eventId}/registration-platform`, actor),
          withBase(options),
        ),
      upsertRegistrationPlatform: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(`/events/${eventId}/registration-platform`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateRegistrationPlatform: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(`/events/${eventId}/registration-platform`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateRegistrationPlatformSetup: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(`/events/${eventId}/registration-platform/setup-confirmation`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      importHeadcount: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(
            `/events/${eventId}/registration-platform/headcount-import`,
            actor,
          ),
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}

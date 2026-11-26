import type {
  PrismSupplierQuote,
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismDecisionLog,
  PrismPmcmCommandInbox,
  PrismPmcmCalendar,
  PrismPmcmCommandInboxQueryInput,
  PrismPmcmEventAttentionList,
  PrismPmcmClientActivity,
  PrismPmcmClientFacts,
  PrismPmcmEventSummaries,
  PrismPmcmSupplierNextBookings,
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
import { withBase } from "./shared";

export function createWorkspacesClient(
  options: EventOpsClientOptions,
): Pick<
  EventOpsClient,
  "clientWorkspace" | "supplierWorkspace" | "billing" | "pmcm"
> {
  return {
    clientWorkspace: {
      detail: (cursor?: string) => {
        const query = toQueryString({ cursor });
        return prismRequest<PrismClientWorkspace>(
          query ? `/client/workspace?${query}` : "/client/workspace",
          withBase(options),
        );
      },
      actionCenter: () =>
        prismRequest<PrismClientActionCenter>(
          "/client/action-center",
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
      confirmAssignment: (requestId) =>
        prismRequest<PrismSupplierQuoteRequest>(
          `/supplier/quote-requests/${requestId}/assignment/confirm`,
          withBase(options, { method: "PATCH" }),
        ),
      confirmReadiness: (requestId, input) =>
        prismRequest<PrismSupplierQuoteRequest>(
          `/supplier/quote-requests/${requestId}/readiness/confirm`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateEventStatus: (requestId, input) =>
        prismRequest<PrismSupplierQuoteRequest>(
          `/supplier/quote-requests/${requestId}/event-status`,
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
      list: () =>
        prismRequest<PrismBillingWorkspace>(
          "/billing",
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
      eventAttention: (eventId) => prismRequest<PrismPmcmEventAttentionList>(eventId ? `/pmcm/event-attention?eventId=${encodeURIComponent(eventId)}` : "/pmcm/event-attention", withBase(options)),
      clientActivity: (eventId) => prismRequest<PrismPmcmClientActivity>(`/pmcm/events/${encodeURIComponent(eventId)}/client-activity`, withBase(options)),
      eventSummaries: () => prismRequest<PrismPmcmEventSummaries>("/pmcm/event-summaries", withBase(options)),
      clientFacts: () => prismRequest<PrismPmcmClientFacts>("/pmcm/client-facts", withBase(options)),
      supplierNextBookings: () => prismRequest<PrismPmcmSupplierNextBookings>("/pmcm/supplier-next-bookings", withBase(options)),
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
      eventWorkspace: (eventId) =>
        prismRequest<PrismPmcmEventWorkspace>(
          `/pmcm/events/${eventId}/workspace`,
          withBase(options),
        ),
      supplierReadiness: (eventId) =>
        prismRequest<PrismPmcmSupplierReadinessBoard>(
          `/pmcm/events/${encodeURIComponent(eventId)}/supplier-readiness`,
          withBase(options),
        ),
      registrationPlatform: (eventId) =>
        prismRequest<PrismRegistrationPlatform | null>(
          `/events/${eventId}/registration-platform`,
          withBase(options),
        ),
      upsertRegistrationPlatform: (eventId, input) =>
        prismRequest<PrismRegistrationPlatform>(
          `/events/${eventId}/registration-platform`,
          withBase(options, { method: "POST", body: input }),
        ),
      updateRegistrationPlatform: (eventId, input) =>
        prismRequest<PrismRegistrationPlatform>(
          `/events/${eventId}/registration-platform`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateRegistrationPlatformSetup: (eventId, input) =>
        prismRequest<PrismRegistrationPlatform>(
          `/events/${eventId}/registration-platform/setup-confirmation`,
          withBase(options, { method: "POST", body: input }),
        ),
      importHeadcount: (eventId, input) =>
        prismRequest<PrismRegistrationPlatform>(
          `/events/${eventId}/registration-platform/headcount-import`,
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}

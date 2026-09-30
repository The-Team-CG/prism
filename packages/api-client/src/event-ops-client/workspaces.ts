import type {
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismPmcmCommandInbox,
  PrismPmcmCommandInboxQueryInput,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
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
  "clientWorkspace" | "supplierWorkspace" | "billing" | "pmcmDashboard" | "pmcm"
> {
  return {
    clientWorkspace: {
      detail: (actor = {}) =>
        prismRequest<PrismClientWorkspace>(
          actorPath("/client/workspace", actor),
          withBase(options),
        ),
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
      uploadContract: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(`/supplier/quote-requests/${requestId}/contract`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateEventStatus: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(
            `/supplier/quote-requests/${requestId}/event-status`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
    },
    billing: {
      list: (actor = {}) =>
        prismRequest<PrismBillingWorkspace>(
          actorPath("/billing", actor),
          withBase(options),
        ),
    },
    pmcmDashboard: {
      detail: (actor = {}) =>
        prismRequest<PrismPmcmDashboardWorkspace>(
          actorPath("/pmcm/dashboard", actor),
          withBase(options),
        ),
    },
    pmcm: {
      commandInbox: (query: PrismPmcmCommandInboxQueryInput = { page: 0 }) => {
        const params = toQueryString(query);
        return prismRequest<PrismPmcmCommandInbox>(
          params ? `/pmcm/command-inbox?${params}` : "/pmcm/command-inbox",
          withBase(options),
        );
      },
      eventWorkspace: (eventId, actor = {}) =>
        prismRequest<PrismPmcmEventWorkspace>(
          actorPath(`/pmcm/events/${eventId}/workspace`, actor),
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

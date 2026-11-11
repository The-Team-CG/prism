import type {
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismLoginHistory,
  PrismPrivacyExecutionResult,
  PrismPrivacyInventory,
  PrismPrivacyLegalHold,
  PrismPrivacyRequest,
  PrismPrivacyRequestPage,
  PrismRetentionExecutionResult,
  PrismRetentionPolicy,
  PrismRetentionReviewItem,
  PrismSecurityAlert,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

/** `?a=b` for a non-empty query, nothing otherwise. */
const search = (values: Parameters<typeof toQueryString>[0]) => {
  const text = toQueryString(values);
  return text ? `?${text}` : "";
};

/** One event, or every event when none is named or "all" is. */
const eventScope = (eventId?: string) => (eventId && eventId !== "all" ? search({ eventId }) : "");

export function createTrustClient(options: EventOpsClientOptions): Pick<EventOpsClient, "audit" | "privacyAdmin"> {
  return {
    audit: {
      requestNotificationAcknowledgment: (deliveryId, input) => prismRequest<{ id: string; acknowledgmentDueAt: string }>(`/notification-inbox/${encodeURIComponent(deliveryId)}/deadline`, withBase(options, { method: 'POST', body: input })),
      refreshNotificationOutcome: (notificationId, deliveryId) => prismRequest<{ id: string; providerOutcome: string }>(`/notification-provider-outcomes/${encodeURIComponent(notificationId)}/${encodeURIComponent(deliveryId)}/refresh`, withBase(options, { method: 'POST' })),
      notificationDeliveries: (notificationId, actor = {}) =>
        prismRequest<import("@prism/types").PrismNotificationRecipientDelivery[]>(actorPath(`/notifications/${encodeURIComponent(notificationId)}/deliveries`, actor), withBase(options)),
      retryNotification: (notificationId, input, actor = {}) =>
        prismRequest<{ id: string; status: "queued" }>(actorPath(`/notifications/${encodeURIComponent(notificationId)}/retry`, actor), withBase(options, { method: "POST", body: input })),
      integrity: (actor = {}) => prismRequest<PrismAuditIntegrity>(actorPath("/audit/integrity", actor), withBase(options)),
      logs: (filters, actor = {}) => {
        const set = Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== "all"));
        return prismRequest<PrismAuditLog[]>(actorPath(`/audit/logs${search(set as Record<string, string>)}`, actor), withBase(options));
      },
      exportLogs: (filters, actor = {}) =>
        prismRequest<PrismAuditExport>(actorPath("/audit/export", actor), withBase(options, { method: "POST", body: filters })),
      alerts: (actor = {}) => prismRequest<PrismSecurityAlert[]>(actorPath("/audit/alerts", actor), withBase(options)),
      loginHistory: (userId, actor = {}) =>
        prismRequest<PrismLoginHistory[]>(actorPath(`/auth/users/${userId}/login-history`, actor), withBase(options)),
      privacyInventory: (eventId, actor = {}) =>
        prismRequest<PrismPrivacyInventory>(actorPath(`/privacy/inventory${eventScope(eventId)}`, actor), withBase(options)),
    },
    privacyAdmin: {
      requests: (query = {}, actor = {}) =>
        prismRequest<PrismPrivacyRequestPage>(actorPath(`/privacy/requests${search(query as Record<string, string | number | boolean>)}`, actor), withBase(options)),
      createRequest: (input, actor = {}) =>
        prismRequest<PrismPrivacyRequest>(actorPath("/privacy/requests", actor), withBase(options, { method: "POST", body: input })),
      assignRequest: (requestId, input, actor = {}) =>
        prismRequest<PrismPrivacyRequest>(actorPath(`/privacy/requests/${requestId}/assignment`, actor), withBase(options, { method: "PATCH", body: input })),
      reviewRequest: (requestId, input, actor = {}) =>
        prismRequest<PrismPrivacyRequest>(actorPath(`/privacy/requests/${requestId}/review`, actor), withBase(options, { method: "PATCH", body: input })),
      executeRequest: (requestId, notes, correction, actor = {}) =>
        prismRequest<PrismPrivacyExecutionResult>(
          actorPath(`/privacy/requests/${requestId}/execute`, actor),
          withBase(options, { method: "POST", body: { executionNotes: notes, ...(correction ? { correction } : {}) } }),
        ),
      legalHolds: (eventId, actor = {}) =>
        prismRequest<PrismPrivacyLegalHold[]>(actorPath(`/privacy/legal-holds${eventScope(eventId)}`, actor), withBase(options)),
      createLegalHold: (input, actor = {}) =>
        prismRequest<PrismPrivacyLegalHold>(actorPath("/privacy/legal-holds", actor), withBase(options, { method: "POST", body: input })),
      releaseLegalHold: (holdId, input, actor = {}) =>
        prismRequest<PrismPrivacyLegalHold>(actorPath(`/privacy/legal-holds/${holdId}/release`, actor), withBase(options, { method: "POST", body: input })),
      retentionPolicies: (actor = {}) =>
        prismRequest<PrismRetentionPolicy[]>(actorPath("/privacy/retention-policies", actor), withBase(options)),
      updateRetentionPolicy: (category, input, actor = {}) =>
        prismRequest<PrismRetentionPolicy>(actorPath(`/privacy/retention-policies/${encodeURIComponent(category)}`, actor), withBase(options, { method: "PATCH", body: input })),
      retentionReviewItems: (query, actor = {}) =>
        prismRequest<PrismRetentionReviewItem[]>(
          actorPath(`/privacy/retention-review-items${search({ status: query.status, category: query.category, eventId: query.eventId, limit: query.limit, after: query.after })}`, actor),
          withBase(options),
        ),
      executeRetentionReviewItem: (itemId, input, actor = {}) =>
        prismRequest<PrismRetentionExecutionResult>(actorPath(`/privacy/retention-review-items/${encodeURIComponent(itemId)}/execute`, actor), withBase(options, { method: "POST", body: input })),
      dismissRetentionReviewItem: (itemId, input, actor = {}) =>
        prismRequest<PrismRetentionReviewItem>(actorPath(`/privacy/retention-review-items/${encodeURIComponent(itemId)}/dismiss`, actor), withBase(options, { method: "POST", body: input })),
    },
  };
}

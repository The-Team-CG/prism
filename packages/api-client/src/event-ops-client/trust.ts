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
import { withBase } from "./shared";

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
      notificationDeliveries: (notificationId) =>
        prismRequest<import("@prism/types").PrismNotificationRecipientDelivery[]>(`/notifications/${encodeURIComponent(notificationId)}/deliveries`, withBase(options)),
      retryNotification: (notificationId, input) =>
        prismRequest<{ id: string; status: "queued" }>(`/notifications/${encodeURIComponent(notificationId)}/retry`, withBase(options, { method: "POST", body: input })),
      integrity: () => prismRequest<PrismAuditIntegrity>("/audit/integrity", withBase(options)),
      logs: (filters) => {
        const set = Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== "all"));
        return prismRequest<PrismAuditLog[]>(`/audit/logs${search(set as Record<string, string>)}`, withBase(options));
      },
      exportLogs: (filters) =>
        prismRequest<PrismAuditExport>("/audit/export", withBase(options, { method: "POST", body: filters })),
      alerts: () => prismRequest<PrismSecurityAlert[]>("/audit/alerts", withBase(options)),
      loginHistory: (userId) =>
        prismRequest<PrismLoginHistory[]>(`/auth/users/${userId}/login-history`, withBase(options)),
      privacyInventory: (eventId) =>
        prismRequest<PrismPrivacyInventory>(`/privacy/inventory${eventScope(eventId)}`, withBase(options)),
    },
    privacyAdmin: {
      requests: (query = {}) =>
        prismRequest<PrismPrivacyRequestPage>(`/privacy/requests${search(query as Record<string, string | number | boolean>)}`, withBase(options)),
      createRequest: (input) =>
        prismRequest<PrismPrivacyRequest>("/privacy/requests", withBase(options, { method: "POST", body: input })),
      assignRequest: (requestId, input) =>
        prismRequest<PrismPrivacyRequest>(`/privacy/requests/${requestId}/assignment`, withBase(options, { method: "PATCH", body: input })),
      reviewRequest: (requestId, input) =>
        prismRequest<PrismPrivacyRequest>(`/privacy/requests/${requestId}/review`, withBase(options, { method: "PATCH", body: input })),
      executeRequest: (requestId, notes, correction) =>
        prismRequest<PrismPrivacyExecutionResult>(
          `/privacy/requests/${requestId}/execute`,
          withBase(options, { method: "POST", body: { executionNotes: notes, ...(correction ? { correction } : {}) } }),
        ),
      legalHolds: (eventId) =>
        prismRequest<PrismPrivacyLegalHold[]>(`/privacy/legal-holds${eventScope(eventId)}`, withBase(options)),
      createLegalHold: (input) =>
        prismRequest<PrismPrivacyLegalHold>("/privacy/legal-holds", withBase(options, { method: "POST", body: input })),
      releaseLegalHold: (holdId, input) =>
        prismRequest<PrismPrivacyLegalHold>(`/privacy/legal-holds/${holdId}/release`, withBase(options, { method: "POST", body: input })),
      retentionPolicies: () =>
        prismRequest<PrismRetentionPolicy[]>("/privacy/retention-policies", withBase(options)),
      updateRetentionPolicy: (category, input) =>
        prismRequest<PrismRetentionPolicy>(`/privacy/retention-policies/${encodeURIComponent(category)}`, withBase(options, { method: "PATCH", body: input })),
      retentionReviewItems: (query) =>
        prismRequest<PrismRetentionReviewItem[]>(
          `/privacy/retention-review-items${search({ status: query.status, category: query.category, eventId: query.eventId, limit: query.limit, after: query.after })}`,
          withBase(options),
        ),
      executeRetentionReviewItem: (itemId, input) =>
        prismRequest<PrismRetentionExecutionResult>(`/privacy/retention-review-items/${encodeURIComponent(itemId)}/execute`, withBase(options, { method: "POST", body: input })),
      dismissRetentionReviewItem: (itemId, input) =>
        prismRequest<PrismRetentionReviewItem>(`/privacy/retention-review-items/${encodeURIComponent(itemId)}/dismiss`, withBase(options, { method: "POST", body: input })),
    },
  };
}

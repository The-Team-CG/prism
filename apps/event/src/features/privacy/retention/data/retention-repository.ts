import type {
  DismissPrivacyRetentionReviewItemInput,
  ExecutePrivacyRetentionReviewItemInput,
  ListPrivacyRetentionReviewItemsQuery,
  PrismRetentionExecutionResult,
  PrismRetentionPolicy,
  PrismRetentionReviewItem,
  UpdatePrivacyRetentionPolicyInput,
} from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export type RetentionCommands = {
  listPolicies(): Promise<PrismRetentionPolicy[]>;
  updatePolicy(category: string, input: UpdatePrivacyRetentionPolicyInput): Promise<PrismRetentionPolicy>;
  listReviewItems(query: ListPrivacyRetentionReviewItemsQuery): Promise<PrismRetentionReviewItem[]>;
  executeReviewItem(itemId: string, input: ExecutePrivacyRetentionReviewItemInput): Promise<PrismRetentionExecutionResult>;
  dismissReviewItem(itemId: string, input: DismissPrivacyRetentionReviewItemInput): Promise<PrismRetentionReviewItem>;
};

function queryString(query: ListPrivacyRetentionReviewItemsQuery) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.eventId) params.set("eventId", query.eventId);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const retentionCommands: RetentionCommands = {
  listPolicies: () => eventApiRequest<PrismRetentionPolicy[]>("/api/privacy/retention-policies"),
  updatePolicy: (category, input) =>
    eventApiRequest<PrismRetentionPolicy>(`/api/privacy/retention-policies/${encodeURIComponent(category)}`, {
      method: "PATCH",
      body: input,
    }),
  listReviewItems: (query) =>
    eventApiRequest<PrismRetentionReviewItem[]>(`/api/privacy/retention-review-items${queryString(query)}`),
  executeReviewItem: (itemId, input) =>
    eventApiRequest<PrismRetentionExecutionResult>(`/api/privacy/retention-review-items/${encodeURIComponent(itemId)}/execute`, {
      method: "POST",
      body: input,
    }),
  dismissReviewItem: (itemId, input) =>
    eventApiRequest<PrismRetentionReviewItem>(`/api/privacy/retention-review-items/${encodeURIComponent(itemId)}/dismiss`, {
      method: "POST",
      body: input,
    }),
};

import type {
  DismissPrivacyRetentionReviewItemInput,
  ExecutePrivacyRetentionReviewItemInput,
  ListPrivacyRetentionReviewItemsQuery,
  PrismRetentionExecutionResult,
  PrismRetentionPolicy,
  PrismRetentionReviewItem,
  UpdatePrivacyRetentionPolicyInput,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export type RetentionCommands = {
  listPolicies(): Promise<PrismRetentionPolicy[]>;
  updatePolicy(category: string, input: UpdatePrivacyRetentionPolicyInput): Promise<PrismRetentionPolicy>;
  listReviewItems(query: ListPrivacyRetentionReviewItemsQuery): Promise<PrismRetentionReviewItem[]>;
  executeReviewItem(itemId: string, input: ExecutePrivacyRetentionReviewItemInput): Promise<PrismRetentionExecutionResult>;
  dismissReviewItem(itemId: string, input: DismissPrivacyRetentionReviewItemInput): Promise<PrismRetentionReviewItem>;
};

export const retentionCommands: RetentionCommands = {
  listPolicies: () => eventApi.privacyAdmin.retentionPolicies(),
  updatePolicy: (category, input) => eventApi.privacyAdmin.updateRetentionPolicy(category, input),
  listReviewItems: (query) => eventApi.privacyAdmin.retentionReviewItems(query),
  executeReviewItem: (itemId, input) => eventApi.privacyAdmin.executeRetentionReviewItem(itemId, input),
  dismissReviewItem: (itemId, input) => eventApi.privacyAdmin.dismissRetentionReviewItem(itemId, input),
};

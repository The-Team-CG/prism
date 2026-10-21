import {
  dismissPrivacyRetentionReviewItemSchema,
  executePrivacyRetentionReviewItemSchema,
  listPrivacyRetentionReviewItemsQuerySchema,
  parseContract,
  updatePrivacyRetentionPolicySchema,
  type ListPrivacyRetentionReviewItemsQuery,
  type PrismRetentionPolicy,
  type PrismRetentionReviewItem,
} from "@prism/types";
import { retentionCommands, type RetentionCommands } from "../data/retention-repository";

export type ReviewStatusFilter = NonNullable<ListPrivacyRetentionReviewItemsQuery["status"]>;

/** Validates every write with the shared @prism/types schema before it reaches the data layer. */
export function createRetentionUseCases(commands: RetentionCommands = retentionCommands) {
  return {
    async load(status: ReviewStatusFilter): Promise<{ policies: PrismRetentionPolicy[]; items: PrismRetentionReviewItem[] }> {
      const query = parseContract(listPrivacyRetentionReviewItemsQuerySchema, { status }, "Retention review filter");
      const [policies, items] = await Promise.all([commands.listPolicies(), commands.listReviewItems(query)]);
      return { policies, items };
    },

    updatePolicy(policy: PrismRetentionPolicy, change: { enabled?: boolean; periodDays?: number; reason: string }) {
      const input = parseContract(
        updatePrivacyRetentionPolicySchema,
        { ...change, expectedRevision: policy.revision },
        "Retention policy edit",
      );
      return commands.updatePolicy(policy.category, input);
    },

    executeItem(item: PrismRetentionReviewItem, executionNotes: string) {
      const input = parseContract(executePrivacyRetentionReviewItemSchema, { executionNotes }, "Retention execution");
      return commands.executeReviewItem(item.id, input);
    },

    dismissItem(item: PrismRetentionReviewItem, reason: string) {
      const input = parseContract(dismissPrivacyRetentionReviewItemSchema, { reason }, "Retention dismissal");
      return commands.dismissReviewItem(item.id, input);
    },
  };
}

export const retentionUseCases = createRetentionUseCases();

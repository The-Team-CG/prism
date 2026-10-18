import type { PrismHandoffBrief } from "@prism/types";

const SETTLED_FILE_STATUSES = new Set(["approved", "complete"]);

export type HandoffBriefSummary = {
  openIssueCount: number;
  outstandingFileCount: number;
  latestHandoffOutstandingCount: number;
};

/** Counts drawn only from the brief payload; the view never re-derives scope or permissions. */
export function summarizeHandoffBrief(brief: PrismHandoffBrief): HandoffBriefSummary {
  return {
    openIssueCount: brief.openIssues.length,
    outstandingFileCount: brief.files.filter((file) => !SETTLED_FILE_STATUSES.has(file.status)).length,
    latestHandoffOutstandingCount: brief.handoffs[0]?.outstandingItems.length ?? 0,
  };
}

import type { PrismPmcmSupplierWorkflowWorkspace } from "@prism/types";
import { formatPortalDateTime } from "@prism/ui/format-date";

export type SummaryTone = "attention" | "done" | "idle";
export type SummaryCell = { text: string; tone: SummaryTone };

export type SupplierWorkflowSummary = {
  schedule: SummaryCell;
  contract: SummaryCell;
  deliverables: SummaryCell;
  payables: SummaryCell;
  /** Something in the row waits on PMCM: the row is tinted and sorts first. */
  needsPmcm: boolean;
};

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

function scheduleCell(row: PrismPmcmSupplierWorkflowWorkspace): SummaryCell {
  if (!row.schedule) return { text: "Not set", tone: "attention" };
  if (row.schedule.changeRequestNote) return { text: "Change requested", tone: "attention" };
  return { text: formatPortalDateTime(row.schedule.ingressAt), tone: "done" };
}

function contractCell(row: PrismPmcmSupplierWorkflowWorkspace): SummaryCell {
  const latest = [...row.contracts].sort((a, b) => b.version - a.version)[0];
  if (!latest) return { text: "None yet", tone: "idle" };
  if (latest.quoteMismatch) return { text: `v${latest.version} differs from quote`, tone: "attention" };
  if (latest.reviewStatus === "submitted") return { text: `v${latest.version} to review`, tone: "attention" };
  if (latest.reviewStatus === "changes_requested") return { text: `v${latest.version} sent back`, tone: "idle" };
  return { text: `v${latest.version} accepted`, tone: "done" };
}

function deliverablesCell(row: PrismPmcmSupplierWorkflowWorkspace): SummaryCell {
  const live = row.creativeTasks.filter((task) => task.status !== "cancelled");
  if (live.length === 0) return { text: "None", tone: "idle" };
  const toReview = live.filter((task) => task.status === "submitted").length;
  if (toReview) return { text: `${toReview} to review`, tone: "attention" };
  const accepted = live.filter((task) => task.status === "accepted").length;
  return { text: `${accepted} of ${live.length} accepted`, tone: accepted === live.length ? "done" : "idle" };
}

function payablesCell(row: PrismPmcmSupplierWorkflowWorkspace): SummaryCell {
  const live = row.payables.filter((milestone) => milestone.status !== "cancelled");
  if (live.length === 0) return { text: "No milestones", tone: "idle" };
  const total = live.reduce((sum, milestone) => sum + milestone.amount, 0);
  const released = live.reduce((sum, milestone) => sum + milestone.amountReleased, 0);
  return { text: `${peso(released)} of ${peso(total)}`, tone: released >= total ? "done" : "idle" };
}

/** One booked supplier's delivery, contract, deliverables and money as four short cells, for its row. */
export function summarizeSupplierWorkflow(row: PrismPmcmSupplierWorkflowWorkspace): SupplierWorkflowSummary {
  const cells = { schedule: scheduleCell(row), contract: contractCell(row), deliverables: deliverablesCell(row), payables: payablesCell(row) };
  return { ...cells, needsPmcm: Object.values(cells).some((cell) => cell.tone === "attention") };
}

import type { PrismComplianceRun } from "@prism/types";
import { formatPortalDateTime } from "@prism/ui/format-date";

const TRIGGER_LABEL: Record<string, string> = { manual: "run by PMCM", scheduled: "scheduled", state_change: "after an event change" };

/**
 * One line answering "when was this last checked, and what did it find?". The checks themselves are listed
 * once, in the compliance checks section above.
 */
export function complianceRunSummary(runs: PrismComplianceRun[]): string {
  const [latest] = runs;
  if (!latest) return "No compliance runs yet. Run checks above to record the first one.";
  const checks = latest.checks ?? [];
  const open = checks.filter((check) => check.status === "open").length;
  const trigger = TRIGGER_LABEL[latest.trigger] ?? latest.trigger.replaceAll("_", " ");
  const when = formatPortalDateTime(latest.completedAt ?? latest.startedAt);
  return [
    `Last run ${when} (${trigger})`,
    `${checks.length} check${checks.length === 1 ? "" : "s"}`,
    `${open} open`,
    `${runs.length} run${runs.length === 1 ? "" : "s"} so far`,
  ].join(" · ");
}

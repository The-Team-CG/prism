import type { PrismComplianceCheck, PrismComplianceRisk, PrismComplianceRun } from "@prism/types";

export type ReadinessVerdict = "no_run" | "ready" | "ready_with_follow_ups" | "not_ready";

export interface ReadinessLayerRow {
  layer: PrismComplianceCheck["layer"];
  total: number;
  outstanding: number;
  resolved: number;
  overridden: number;
}

export interface ComplianceReadinessReport {
  verdict: ReadinessVerdict;
  headline: string;
  layers: ReadinessLayerRow[];
  blockers: Array<{ id: string; title: string; remediation: string }>;
  openSeriousRisks: number;
}

const LAYERS: PrismComplianceCheck["layer"][] = ["Must-Fix", "Should-Fix", "Advisory"];

/** A check still needs work when it is open and the rule is not already satisfied or irrelevant to this event. */
function isOutstanding(check: PrismComplianceCheck): boolean {
  return check.status === "open" && check.evaluationStatus !== "satisfied" && check.evaluationStatus !== "not_applicable";
}

/**
 * The go/no-go reading of the latest compliance run: any outstanding Must-Fix blocks readiness, outstanding
 * Should-Fix or Advisory checks and open high or critical risks leave it ready with follow-ups. Overridden checks
 * count as handled, since an override already needs a reason on record.
 */
export function complianceReadinessReport(runs: PrismComplianceRun[], risks: PrismComplianceRisk[]): ComplianceReadinessReport {
  const latest = runs.find((run) => run.status === "completed") ?? runs[0];
  const openSeriousRisks = risks.filter((risk) => risk.status === "open" && (risk.severity === "high" || risk.severity === "critical")).length;
  if (!latest) {
    return { verdict: "no_run", headline: "Not assessed yet. Run the compliance checks to get a readiness report.", layers: [], blockers: [], openSeriousRisks };
  }

  const checks = latest.checks ?? [];
  const layers = LAYERS.map((layer): ReadinessLayerRow => {
    const inLayer = checks.filter((check) => check.layer === layer);
    return {
      layer,
      total: inLayer.length,
      outstanding: inLayer.filter(isOutstanding).length,
      resolved: inLayer.filter((check) => check.status === "resolved").length,
      overridden: inLayer.filter((check) => check.status === "overridden").length,
    };
  });
  const blockers = checks
    .filter((check) => check.layer === "Must-Fix" && isOutstanding(check))
    .map((check) => ({ id: check.id, title: check.title, remediation: check.remediation }));
  const followUps = layers.filter((row) => row.layer !== "Must-Fix").reduce((sum, row) => sum + row.outstanding, 0) + openSeriousRisks;

  if (blockers.length > 0) {
    return { verdict: "not_ready", headline: `Not ready: ${blockers.length} Must-Fix item${blockers.length === 1 ? "" : "s"} to clear.`, layers, blockers, openSeriousRisks };
  }
  if (followUps > 0) {
    return { verdict: "ready_with_follow_ups", headline: `Ready, with ${followUps} follow-up${followUps === 1 ? "" : "s"} to watch.`, layers, blockers, openSeriousRisks };
  }
  return { verdict: "ready", headline: "Ready: every check is cleared and no serious risks are open.", layers, blockers, openSeriousRisks };
}

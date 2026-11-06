"use client";

import { useState } from "react";
import { RISK_RATINGS, riskSeverityFromRatings, type CreateComplianceRiskInput, type RiskRating } from "@prism/types";
import { complianceReadinessReport } from "../model/compliance-readiness-report";
import { complianceRunSummary } from "../model/compliance-run-summary";
import { useComplianceReviewViewModel } from "../view-models/use-compliance-review-view-model";

const RISK_STATUS: Record<string, string> = { open: "Open", mitigated: "Mitigated", accepted: "Accepted", closed: "Closed" };
const RISK_SEVERITY: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const RATING_LABEL: Record<RiskRating, string> = { low: "Low", medium: "Medium", high: "High" };

function ratingsText(risk: { likelihood?: string | null; impact?: string | null }) {
  const parts = [
    risk.likelihood ? `likelihood ${risk.likelihood}` : null,
    risk.impact ? `impact ${risk.impact}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` · ${parts.join(", ")}` : "";
}

/** Run history as one summary line, plus PMCM-recorded risks for this event. */
export function ComplianceReviewPanel({ eventId }: { eventId: string }) {
  const vm = useComplianceReviewViewModel(eventId);
  const readiness = complianceReadinessReport(vm.runs, vm.risks);
  const [riskTitle, setRiskTitle] = useState("");
  const [riskMitigation, setRiskMitigation] = useState("");
  const [likelihood, setLikelihood] = useState<RiskRating>("medium");
  const [impact, setImpact] = useState<RiskRating>("medium");
  const saveRisk = async () => {
    // Severity is left to the API, which derives it from the two ratings.
    const input: CreateComplianceRiskInput = { phase: "closure", title: riskTitle, mitigation: riskMitigation, likelihood, impact, owner: "PMCM", status: "open" };
    await vm.addRisk(input);
    setRiskTitle("");
    setRiskMitigation("");
    setLikelihood("medium");
    setImpact("medium");
  };
  return (
    <section aria-labelledby="compliance-history-title" className="rounded-lg border border-border bg-card p-5">
      <h2 id="compliance-history-title" className="text-lg font-semibold">History and risks</h2>
      <p className="mt-1 text-sm text-muted-foreground">{complianceRunSummary(vm.runs)}</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}

      <h3 className="mt-5 text-sm font-semibold text-foreground">Readiness</h3>
      <p role="status" className="mt-1 text-sm text-foreground">{readiness.headline}</p>
      {readiness.layers.length > 0 ? (
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted-foreground"><tr><th className="py-1 font-medium">Layer</th><th className="font-medium">Checks</th><th className="font-medium">Outstanding</th><th className="font-medium">Resolved</th><th className="font-medium">Overridden</th></tr></thead>
          <tbody>
            {readiness.layers.map((row) => (
              <tr key={row.layer} className="border-t border-border"><th scope="row" className="py-1 font-medium">{row.layer}</th><td>{row.total}</td><td>{row.outstanding}</td><td>{row.resolved}</td><td>{row.overridden}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {readiness.blockers.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground">
          {readiness.blockers.map((blocker) => <li key={blocker.id}><span className="font-medium">{blocker.title}</span>{blocker.remediation ? `: ${blocker.remediation}` : ""}</li>)}
        </ul>
      ) : null}

      <h3 className="mt-5 text-sm font-semibold text-foreground">Recorded risks</h3>
      {vm.risks.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No risks recorded for this event.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {vm.risks.map((risk) => (
            <li key={risk.id} className="px-4 py-2.5 text-sm">
              <p className="font-medium text-foreground">{risk.title}</p>
              <p className="text-xs text-muted-foreground">
                {RISK_SEVERITY[risk.severity] ?? risk.severity}{ratingsText(risk)} · {RISK_STATUS[risk.status] ?? risk.status} · Owner: {risk.owner || "Unassigned"}
              </p>
              {risk.mitigation ? <p className="mt-1 text-muted-foreground">{risk.mitigation}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3 rounded-md border border-border bg-background p-4">
        <summary className="cursor-pointer text-sm font-semibold">Record a risk</summary>
        <div className="mt-3 grid gap-2">
          <label htmlFor="compliance-risk-title" className="text-sm font-medium">Risk</label>
          <input id="compliance-risk-title" value={riskTitle} onChange={(event) => setRiskTitle(event.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
          <label htmlFor="compliance-risk-mitigation" className="text-sm font-medium">Mitigation</label>
          <textarea id="compliance-risk-mitigation" value={riskMitigation} onChange={(event) => setRiskMitigation(event.target.value)} className="min-h-16 rounded-md border border-border bg-card p-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm font-medium">
              Likelihood
              <select aria-label="Likelihood" value={likelihood} onChange={(event) => setLikelihood(event.target.value as RiskRating)} className="h-10 rounded-md border border-border bg-card px-2 text-sm">
                {RISK_RATINGS.map((rating) => <option key={rating} value={rating}>{RATING_LABEL[rating]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Impact
              <select aria-label="Impact" value={impact} onChange={(event) => setImpact(event.target.value as RiskRating)} className="h-10 rounded-md border border-border bg-card px-2 text-sm">
                {RISK_RATINGS.map((rating) => <option key={rating} value={rating}>{RATING_LABEL[rating]}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Recorded as {RISK_SEVERITY[riskSeverityFromRatings(likelihood, impact)]} severity.</p>
          <button disabled={vm.busy || !riskTitle.trim() || !riskMitigation.trim()} onClick={() => void saveRisk()} className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-ink-foreground disabled:opacity-60">
            Record risk
          </button>
        </div>
      </details>
    </section>
  );
}

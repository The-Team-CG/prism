"use client";

import { useState } from "react";
import type { CreateComplianceRiskInput } from "@prism/types";
import { complianceRunSummary } from "../model/compliance-run-summary";
import { useComplianceReviewViewModel } from "../view-models/use-compliance-review-view-model";

const RISK_STATUS: Record<string, string> = { open: "Open", mitigated: "Mitigated", accepted: "Accepted", closed: "Closed" };
const RISK_SEVERITY: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/** Run history as one summary line, plus PMCM-recorded risks for this event. */
export function ComplianceReviewPanel({ eventId }: { eventId: string }) {
  const vm = useComplianceReviewViewModel(eventId);
  const [riskTitle, setRiskTitle] = useState("");
  const [riskMitigation, setRiskMitigation] = useState("");
  const saveRisk = async () => {
    const input: CreateComplianceRiskInput = { phase: "closure", title: riskTitle, mitigation: riskMitigation, severity: "medium", owner: "PMCM", status: "open" };
    await vm.addRisk(input);
    setRiskTitle("");
    setRiskMitigation("");
  };
  return (
    <section aria-labelledby="compliance-history-title" className="rounded-lg border border-border bg-card p-5">
      <h2 id="compliance-history-title" className="text-lg font-semibold">History and risks</h2>
      <p className="mt-1 text-sm text-muted-foreground">{complianceRunSummary(vm.runs)}</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}

      <h3 className="mt-5 text-sm font-semibold text-foreground">Recorded risks</h3>
      {vm.risks.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No risks recorded for this event.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {vm.risks.map((risk) => (
            <li key={risk.id} className="px-4 py-2.5 text-sm">
              <p className="font-medium text-foreground">{risk.title}</p>
              <p className="text-xs text-muted-foreground">
                {RISK_SEVERITY[risk.severity] ?? risk.severity} · {RISK_STATUS[risk.status] ?? risk.status} · Owner: {risk.owner || "Unassigned"}
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
          <button disabled={vm.busy || !riskTitle.trim() || !riskMitigation.trim()} onClick={() => void saveRisk()} className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-ink-foreground disabled:opacity-60">
            Record risk
          </button>
        </div>
      </details>
    </section>
  );
}

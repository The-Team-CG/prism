"use client";

import { useState } from "react";
import type { CreateComplianceRiskInput } from "@prism/types";
import { useComplianceReviewViewModel } from "../view-models/use-compliance-review-view-model";

export function ComplianceReviewPanel({ eventId }: { eventId: string }) {
  const vm = useComplianceReviewViewModel(eventId);
  const [riskTitle, setRiskTitle] = useState("");
  const [riskMitigation, setRiskMitigation] = useState("");
  const saveRisk = async () => {
    const input: CreateComplianceRiskInput = { phase: "closure", title: riskTitle, mitigation: riskMitigation, severity: "medium", owner: "PMCM", status: "open" };
    await vm.addRisk(input); setRiskTitle(""); setRiskMitigation("");
  };
  return <section className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-attention">Compliance history</p><h2 className="mt-1 text-xl font-black">Explainable checks and phase risks</h2><p className="mt-1 text-sm text-muted-foreground">Every result records its trigger, definition status, and persisted evidence. Overrides remain visible as overrides.</p></div><span className="text-sm font-bold text-muted-foreground">{vm.runs.length} run(s)</span></div>
    {vm.error ? <p className="mt-4 text-sm text-destructive">{vm.error}</p> : null}
    <div className="mt-4 space-y-3">{vm.latestRun?.checks?.map((check) => <article key={check.id} className="rounded-md border border-border bg-background p-4"><div className="flex justify-between gap-3"><p className="font-bold">{check.title}</p><span className="text-xs font-bold">{check.evaluationStatus}{check.status === "overridden" ? " · overridden" : ""}</span></div><p className="mt-2 text-xs text-muted-foreground">{check.definitionStatus} · {check.remediation}</p><ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{check.evidence.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
    <div className="mt-5 rounded-md border border-border bg-background p-4"><p className="font-bold">Add PMCM risk</p><div className="mt-3 grid gap-2"><input value={riskTitle} onChange={(event) => setRiskTitle(event.target.value)} placeholder="Risk title" className="h-10 rounded-md border border-border bg-card px-3 text-sm" /><textarea value={riskMitigation} onChange={(event) => setRiskMitigation(event.target.value)} placeholder="Mitigation" className="min-h-16 rounded-md border border-border bg-card p-3 text-sm" /><button disabled={vm.busy || !riskTitle.trim() || !riskMitigation.trim()} onClick={() => void saveRisk()} className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-bold text-white">Record risk</button></div></div>
    <div className="mt-4 space-y-2">{vm.risks.map((risk) => <div key={risk.id} className="rounded-md border border-border bg-background p-3 text-sm"><span className="font-bold">{risk.title}</span><span className="ml-2 text-muted-foreground">{risk.severity} · {risk.status} · owner {risk.owner || "unassigned"}</span><p className="mt-1 text-muted-foreground">{risk.mitigation}</p></div>)}</div>
  </section>;
}

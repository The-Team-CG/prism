"use client";

import { useState } from "react";
import { RISK_RATINGS, riskSeverityFromRatings, type CreateComplianceRiskInput, type RiskRating } from "@prism/types";
import { complianceReadinessReport } from "../model/compliance-readiness-report";
import { complianceRunSummary } from "../model/compliance-run-summary";
import { useComplianceReviewViewModel } from "../view-models/use-compliance-review-view-model";
import { ComplianceAdvisory } from "@/features/ai-advisory/views/ai-advisory-panels";
import { Button } from "@prism/ui/components/button";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";

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
      <ComplianceAdvisory eventId={eventId} />
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}

      <h3 className="mt-5 text-sm font-semibold text-foreground">Readiness</h3>
      <p role="status" className="mt-1 text-sm text-foreground">{readiness.headline}</p>
      {readiness.layers.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Layer</TableHead>
                <TableHead scope="col" className="text-right">Checks</TableHead>
                <TableHead scope="col" className="text-right">Outstanding</TableHead>
                <TableHead scope="col" className="text-right">Resolved</TableHead>
                <TableHead scope="col" className="text-right">Overridden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readiness.layers.map((row) => (
                <TableRow key={row.layer}>
                  <TableHead scope="row" className="h-auto font-medium text-foreground">{row.layer}</TableHead>
                  <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.outstanding}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.resolved}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.overridden}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
            <Field>
              <FieldLabel htmlFor="compliance-risk-likelihood">Likelihood</FieldLabel>
              <Select value={likelihood} onValueChange={(value) => setLikelihood(value as RiskRating)}>
                <SelectTrigger id="compliance-risk-likelihood" className="w-full min-w-0 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_RATINGS.map((rating) => <SelectItem key={rating} value={rating}>{RATING_LABEL[rating]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="compliance-risk-impact">Impact</FieldLabel>
              <Select value={impact} onValueChange={(value) => setImpact(value as RiskRating)}>
                <SelectTrigger id="compliance-risk-impact" className="w-full min-w-0 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_RATINGS.map((rating) => <SelectItem key={rating} value={rating}>{RATING_LABEL[rating]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Recorded as {RISK_SEVERITY[riskSeverityFromRatings(likelihood, impact)]} severity.</p>
          <Button className="w-fit" disabled={vm.busy || !riskTitle.trim() || !riskMitigation.trim()} onClick={() => void saveRisk()}>
            Record risk
          </Button>
        </div>
      </details>
    </section>
  );
}

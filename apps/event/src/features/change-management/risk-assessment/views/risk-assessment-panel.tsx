"use client";
import { formatPortalDate } from "@prism/ui/format-date";

import { useState, type FormEvent } from "react";
import type { RecordEventRiskAssessmentInput, RiskLevel } from "@prism/types";
import { isLoweringRiskLevel, riskLevelLabel, riskLevelOptions } from "../model/risk-assessment-rules";
import { useRiskAssessmentViewModel } from "../view-models/use-risk-assessment-view-model";

/** PMCM-only. The suggestion comes from open compliance risks; the recorded level is the authoritative one. */
export function RiskAssessmentPanel({ eventId }: { eventId: string }) {
  const vm = useRiskAssessmentViewModel(eventId);
  const view = vm.view;

  return (
    <section aria-labelledby="risk-assessment-heading" className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 id="risk-assessment-heading" className="text-sm font-semibold text-foreground">Event risk level</h3>
        <p className="mt-1 text-sm text-muted-foreground">Visible to PMCM only. Clients, suppliers, coordinators, and guests never see this level.</p>
      </div>
      {vm.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading risk assessment…</p> : null}
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {view ? (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Recorded level</dt>
              <dd className="font-semibold text-foreground">{riskLevelLabel(view.assessment?.level)}</dd>
              {view.assessment ? <dd className="text-xs text-muted-foreground">Revision {view.assessment.revision}</dd> : null}
            </div>
            <div>
              <dt className="text-muted-foreground">Suggested from open compliance risks</dt>
              <dd className="font-semibold text-foreground">{riskLevelLabel(view.suggestedLevel)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Open compliance risks</dt>
              <dd className="text-foreground">
                {riskLevelOptions.map((option) => `${option.label} ${view.openRiskCounts[option.value]}`).join(" · ")}
              </dd>
            </div>
          </dl>
          {view.assessment?.summary ? <p className="text-sm text-foreground">{view.assessment.summary}</p> : null}
          <RiskAssessmentForm
            recordedLevel={view.assessment?.level ?? null}
            expectedRevision={view.assessment?.revision ?? 0}
            busy={vm.busy}
            onSubmit={(draft) => vm.record(draft)}
          />
          {view.history.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-foreground">History</h4>
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
                {view.history.map((entry) => (
                  <li key={entry.id} className="space-y-1 p-3">
                    <p className="font-medium text-foreground">
                      Revision {entry.revision}: {riskLevelLabel(entry.level)}
                      {entry.previousLevel ? ` (was ${riskLevelLabel(entry.previousLevel)})` : ""}
                    </p>
                    <p className="text-muted-foreground">Suggested at the time: {riskLevelLabel(entry.suggestedLevel)} · {formatPortalDate(entry.assessedAt)}</p>
                    {entry.reason ? <p className="text-muted-foreground">Reason: {entry.reason}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function RiskAssessmentForm({
  recordedLevel,
  expectedRevision,
  busy,
  onSubmit,
}: {
  recordedLevel: RiskLevel | null;
  expectedRevision: number;
  busy: boolean;
  onSubmit: (draft: RecordEventRiskAssessmentInput) => Promise<boolean>;
}) {
  const [level, setLevel] = useState<RiskLevel>(recordedLevel ?? "medium");
  const [summary, setSummary] = useState("");
  const [mitigations, setMitigations] = useState("");
  const [reason, setReason] = useState("");
  const lowering = isLoweringRiskLevel(recordedLevel, level);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({ level, summary, mitigations: mitigations || undefined, expectedRevision, reason: reason || undefined });
    if (saved) { setSummary(""); setMitigations(""); setReason(""); }
  }

  return (
    <form onSubmit={submit} aria-label="Record event risk level" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Recorded level</span>
          <select value={level} onChange={(event) => setLevel(event.target.value as RiskLevel)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {riskLevelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Summary</span>
          <input required value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">Mitigations (optional)</span>
        <input value={mitigations} onChange={(event) => setMitigations(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      {lowering ? (
        <label className="block text-sm">
          <span className="text-muted-foreground">Reason for lowering the level</span>
          <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </label>
      ) : null}
      <button type="submit" disabled={busy || !summary.trim() || (lowering && !reason.trim())} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        Record risk level
      </button>
    </form>
  );
}

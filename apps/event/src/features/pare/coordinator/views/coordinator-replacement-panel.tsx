"use client";

import { useState } from "react";
import type { PrismCoordinatorReplacementRecommendation } from "@prism/types";
import { useCoordinatorReplacements } from "../view-models/use-coordinator-replacements";

/** FR-AI-04 PARE coordinator mode: an emergency withdrawal raises a package here; nothing is assigned until PMCM approves. */
export function CoordinatorReplacementPanel({ eventId }: { eventId: string }) {
  const vm = useCoordinatorReplacements(eventId);
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold text-foreground">Emergency coordinator replacements</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">When a coordinator withdraws within 48 hours of the event, PARE prepares a replacement package. Approve a coordinator to assign them, or reject the package.</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      {vm.items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No emergency withdrawals for this event.</p> : null}
      <div className="mt-4 space-y-3">
        {vm.items.map((item) => <RecommendationCard key={item.id} item={item} busy={vm.busyId === item.id} onDecide={(input) => void vm.decide(item.id, input)} />)}
      </div>
    </section>
  );
}

function RecommendationCard({ item, busy, onDecide }: {
  item: PrismCoordinatorReplacementRecommendation;
  busy: boolean;
  onDecide: (input: { action: "approve" | "reject"; coordinatorId?: string; note?: string }) => void;
}) {
  const [choice, setChoice] = useState(item.candidates[0]?.coordinatorId ?? "");
  const pending = item.status === "pending";
  return (
    <article className={`rounded-md border p-4 text-sm ${item.riskLevel === "critical" ? "border-destructive/40" : "border-border"}`}>
      <p className="font-semibold">{item.role}: {item.withdrawnCoordinatorName} withdrew · {item.hoursToEvent} hours to the event · {item.riskLevel} risk</p>
      <p className="mt-1 text-muted-foreground">{item.riskSummary}</p>
      {item.candidates.length ? (
        <fieldset className="mt-3 space-y-1" disabled={!pending || busy}>
          <legend className="text-xs font-semibold">Recommended replacements</legend>
          {item.candidates.map((candidate) => (
            <label key={candidate.coordinatorId} className="flex items-center gap-2">
              <input type="radio" name={`pare-${item.id}`} checked={choice === candidate.coordinatorId} onChange={() => setChoice(candidate.coordinatorId)} />
              {candidate.name}{candidate.missingSkills.length ? ` · missing ${candidate.missingSkills.join(", ")}` : " · all skills"}
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="mt-3 rounded-md bg-muted/40 p-2 text-xs"><span className="font-semibold">Draft message:</span> {item.draftMessage}</p>
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !choice} onClick={() => onDecide({ action: "approve", coordinatorId: choice })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Approve and assign</button>
          <button type="button" disabled={busy} onClick={() => onDecide({ action: "reject" })} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Reject</button>
        </div>
      ) : <p className="mt-3 text-xs font-semibold">{item.status === "approved" ? "Approved" : "Rejected"} by {item.reviewedBy}</p>}
    </article>
  );
}

"use client";

import { useState } from "react";
import { EVENT_RISK_PHASES, type EventRiskPhase, type PrismEventRisk } from "@prism/types";
import { useRiskRegister } from "../view-models/use-risk-register";

const PHASE_LABELS: Record<EventRiskPhase, string> = { planning: "Planning", pre_event: "Pre-event", event_day: "Event day", post_event: "Post-event" };
const FIELD = "rounded-md border border-border bg-background px-2 py-1 text-sm";
const RATINGS = [1, 2, 3, 4, 5];

/** FR-07: risks by event phase, rated by likelihood and impact, with mitigation and owner. */
export function RiskRegisterPanel({ eventId }: { eventId: string }) {
  const vm = useRiskRegister(eventId);
  const [draft, setDraft] = useState({ phase: "planning" as EventRiskPhase, title: "", likelihood: 3, impact: 3, mitigation: "", owner: "" });

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="risk-register-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="risk-register-heading" className="font-semibold text-foreground">Risk register</h2>
        <button type="button" disabled={vm.busy} onClick={() => void vm.loadStandard()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Add standard risks</button>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">Score is likelihood × impact (1 to 25). Review the register again before event day.</p>
      {vm.error ? <p role="alert" className="mt-2 text-sm text-destructive">{vm.error}</p> : null}
      {EVENT_RISK_PHASES.map((phase) => {
        const items = vm.risks.filter((risk) => risk.phase === phase);
        if (items.length === 0) return null;
        return (
          <div key={phase} className="mt-4">
            <h3 className="text-sm font-semibold text-foreground">{PHASE_LABELS[phase]}</h3>
            <ul className="mt-2 space-y-2">{items.map((risk) => <RiskRow key={risk.id} risk={risk} busy={vm.busy} onUpdate={vm.update} />)}</ul>
          </div>
        );
      })}
      <form className="mt-4 grid gap-2 md:grid-cols-6" onSubmit={(event) => { event.preventDefault(); void vm.create(draft).then((ok) => { if (ok) setDraft({ ...draft, title: "", mitigation: "", owner: "" }); }); }}>
        <select aria-label="Phase" value={draft.phase} onChange={(event) => setDraft({ ...draft, phase: event.target.value as EventRiskPhase })} className={FIELD}>{EVENT_RISK_PHASES.map((phase) => <option key={phase} value={phase}>{PHASE_LABELS[phase]}</option>)}</select>
        <input aria-label="Risk" placeholder="Risk" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={`${FIELD} md:col-span-2`} />
        <select aria-label="Likelihood" value={draft.likelihood} onChange={(event) => setDraft({ ...draft, likelihood: Number(event.target.value) })} className={FIELD}>{RATINGS.map((value) => <option key={value} value={value}>Likelihood {value}</option>)}</select>
        <select aria-label="Impact" value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: Number(event.target.value) })} className={FIELD}>{RATINGS.map((value) => <option key={value} value={value}>Impact {value}</option>)}</select>
        <button type="submit" disabled={vm.busy || !draft.title.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add risk</button>
        <input aria-label="Mitigation" placeholder="Mitigation" value={draft.mitigation} onChange={(event) => setDraft({ ...draft, mitigation: event.target.value })} className={`${FIELD} md:col-span-4`} />
        <input aria-label="Owner" placeholder="Owner" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} className={`${FIELD} md:col-span-2`} />
      </form>
    </section>
  );
}

function RiskRow({ risk, busy, onUpdate }: { risk: PrismEventRisk; busy: boolean; onUpdate: (riskId: string, input: { likelihood?: number; impact?: number; status?: PrismEventRisk["status"] }) => Promise<boolean> }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
      <span className="mr-auto"><span className="font-semibold">{risk.title}</span>{risk.mitigation ? <span className="block text-xs text-muted-foreground">{risk.mitigation}</span> : null}</span>
      <span className="text-xs font-semibold">Score {risk.score}</span>
      <select aria-label={`Likelihood of ${risk.title}`} disabled={busy} value={risk.likelihood} onChange={(event) => void onUpdate(risk.id, { likelihood: Number(event.target.value) })} className={FIELD}>{RATINGS.map((value) => <option key={value} value={value}>L{value}</option>)}</select>
      <select aria-label={`Impact of ${risk.title}`} disabled={busy} value={risk.impact} onChange={(event) => void onUpdate(risk.id, { impact: Number(event.target.value) })} className={FIELD}>{RATINGS.map((value) => <option key={value} value={value}>I{value}</option>)}</select>
      <select aria-label={`Status of ${risk.title}`} disabled={busy} value={risk.status} onChange={(event) => void onUpdate(risk.id, { status: event.target.value as PrismEventRisk["status"] })} className={FIELD}>
        <option value="open">Open</option><option value="mitigated">Mitigated</option><option value="closed">Closed</option>
      </select>
    </li>
  );
}

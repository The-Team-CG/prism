"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { EVENT_RISK_PHASES, type EventRiskPhase, type PrismEventRisk } from "@prism/types";
import { useRiskRegister } from "../view-models/use-risk-register";

const PHASE_LABELS: Record<EventRiskPhase, string> = { planning: "Planning", pre_event: "Pre-event", event_day: "Event day", post_event: "Post-event" };
const FIELD = "rounded-md border border-border bg-background px-2 py-1 text-sm";
const RATINGS = [1, 2, 3, 4, 5];
const RISK_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "closed", label: "Closed" },
] as const satisfies ReadonlyArray<{ value: PrismEventRisk["status"]; label: string }>;

/** FR-07: risks by event phase, rated by likelihood and impact, with mitigation and owner. */
export function RiskRegisterPanel({ eventId }: { eventId: string }) {
  const vm = useRiskRegister(eventId);
  const [draft, setDraft] = useState({ phase: "planning" as EventRiskPhase, title: "", likelihood: 3, impact: 3, mitigation: "", owner: "" });

  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="risk-register-heading">
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
        <Select value={draft.phase} onValueChange={(value) => { const phase = EVENT_RISK_PHASES.find((candidate) => candidate === value); if (phase) setDraft({ ...draft, phase }); }}>
          <SelectTrigger aria-label="Phase" className={`${FIELD} w-full min-w-0`}><SelectValue /></SelectTrigger>
          <SelectContent>{EVENT_RISK_PHASES.map((phase) => <SelectItem key={phase} value={phase}>{PHASE_LABELS[phase]}</SelectItem>)}</SelectContent>
        </Select>
        <input aria-label="Risk" placeholder="Risk" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={`${FIELD} md:col-span-2`} />
        <Select value={String(draft.likelihood)} onValueChange={(value) => setDraft({ ...draft, likelihood: Number(value) })}>
          <SelectTrigger aria-label="Likelihood" className={`${FIELD} w-full min-w-0`}><SelectValue /></SelectTrigger>
          <SelectContent>{RATINGS.map((value) => <SelectItem key={value} value={String(value)}>Likelihood {value}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(draft.impact)} onValueChange={(value) => setDraft({ ...draft, impact: Number(value) })}>
          <SelectTrigger aria-label="Impact" className={`${FIELD} w-full min-w-0`}><SelectValue /></SelectTrigger>
          <SelectContent>{RATINGS.map((value) => <SelectItem key={value} value={String(value)}>Impact {value}</SelectItem>)}</SelectContent>
        </Select>
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
      <Select disabled={busy} value={String(risk.likelihood)} onValueChange={(value) => void onUpdate(risk.id, { likelihood: Number(value) })}>
        <SelectTrigger aria-label={`Likelihood of ${risk.title}`} className={`${FIELD} w-auto min-w-20`}><SelectValue /></SelectTrigger>
        <SelectContent>{RATINGS.map((value) => <SelectItem key={value} value={String(value)}>L{value}</SelectItem>)}</SelectContent>
      </Select>
      <Select disabled={busy} value={String(risk.impact)} onValueChange={(value) => void onUpdate(risk.id, { impact: Number(value) })}>
        <SelectTrigger aria-label={`Impact of ${risk.title}`} className={`${FIELD} w-auto min-w-20`}><SelectValue /></SelectTrigger>
        <SelectContent>{RATINGS.map((value) => <SelectItem key={value} value={String(value)}>I{value}</SelectItem>)}</SelectContent>
      </Select>
      <Select disabled={busy} value={risk.status} onValueChange={(value) => { const status = RISK_STATUS_OPTIONS.find((option) => option.value === value)?.value; if (status) void onUpdate(risk.id, { status }); }}>
        <SelectTrigger aria-label={`Status of ${risk.title}`} className={`${FIELD} w-auto min-w-28`}><SelectValue /></SelectTrigger>
        <SelectContent>{RISK_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </li>
  );
}

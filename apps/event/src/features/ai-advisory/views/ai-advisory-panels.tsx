"use client";

import { useEffect, useState } from "react";
import type { ComplianceAdvisoryResult, EventIntelligenceResult, PrismSupplierReliabilityScore, ThemeSuggestionResult } from "@prism/types";
import { aiAdvisoryRepository } from "../data/ai-advisory-repository";

/** Runs one AI request on demand; nothing is saved or sent, and PMCM reads the result. */
function useOnDemand<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try { setResult(await load()); } catch (caught) { setError(caught instanceof Error ? caught.message : "The AI request did not complete."); } finally { setBusy(false); }
  }
  return { result, busy, error, run };
}

const button = "rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

/** FR-10+: plain-language explanation and priority order for the open compliance items. Advice only. */
export function ComplianceAdvisory({ eventId }: { eventId: string }) {
  const vm = useOnDemand<ComplianceAdvisoryResult>(() => aiAdvisoryRepository.compliance(eventId));
  return (
    <div className="mt-3 space-y-2 rounded-md border border-border p-3 text-sm">
      <button type="button" disabled={vm.busy} onClick={() => void vm.run()} className={button}>{vm.busy ? "Explaining…" : "Explain open items with AI"}</button>
      {vm.error ? <p role="alert" className="text-destructive">{vm.error}</p> : null}
      {vm.result ? (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap">{vm.result.explanation}</p>
          <ol className="list-decimal space-y-1 pl-5">{vm.result.actions.map((action) => <li key={`${action.priority}-${action.checkTitle}`}><span className="font-semibold">{action.checkTitle}:</span> {action.action}</li>)}</ol>
          <p className="text-xs text-muted-foreground">AI advice. The rule results above stay the record, and overrides still need a reason.</p>
        </div>
      ) : null}
    </div>
  );
}

/** FR-11: two or three theme concepts from the briefing; words and colors only. */
export function ThemeSuggestionsPanel({ eventId }: { eventId: string }) {
  const vm = useOnDemand<ThemeSuggestionResult>(() => aiAdvisoryRepository.themes(eventId));
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Theme ideas</h2>
        <button type="button" disabled={vm.busy} onClick={() => void vm.run()} className={button}>{vm.busy ? "Thinking…" : "Suggest themes with AI"}</button>
      </div>
      <p className="mt-1 text-muted-foreground">Built from the briefing&apos;s mood, guest count, venue type and styling budget. A starting point for the stylist, not a design.</p>
      {vm.error ? <p role="alert" className="mt-2 text-destructive">{vm.error}</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {vm.result?.concepts.map((concept) => (
          <article key={concept.name} className="rounded-md border border-border p-3">
            <p className="font-semibold">{concept.name}</p>
            <div className="mt-2 flex gap-1" aria-label={`Palette ${concept.palette.join(", ")}`}>{concept.palette.map((color) => <span key={color} title={color} className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: color }} />)}</div>
            <p className="mt-2 text-xs">{concept.moodboardDescription}</p>
            <p className="mt-2 text-xs text-muted-foreground">Search: {concept.referenceSearchTerms.join(", ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** FR-AI-08 PEIL: the three-section post-event intelligence report, from the insights card. */
export function EventIntelligencePanel({ eventId, hasInsight }: { eventId: string; hasInsight: boolean }) {
  const vm = useOnDemand<EventIntelligenceResult>(() => aiAdvisoryRepository.intelligence(eventId));
  return (
    <div className="space-y-3 text-sm">
      <button type="button" disabled={vm.busy || !hasInsight} onClick={() => void vm.run()} className={button}>{vm.busy ? "Analysing…" : "Write the intelligence report with AI"}</button>
      {!hasInsight ? <p className="text-xs text-muted-foreground">Generate the insights card first; the report is built from it.</p> : null}
      {vm.error ? <p role="alert" className="text-destructive">{vm.error}</p> : null}
      {vm.result ? (
        <div className="grid gap-3 md:grid-cols-3">
          <section><h3 className="font-semibold">What worked</h3><ul className="mt-1 list-disc space-y-1 pl-5">{vm.result.whatWorked.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><h3 className="font-semibold">What failed and why</h3><ul className="mt-1 list-disc space-y-1 pl-5">{vm.result.whatFailed.length ? vm.result.whatFailed.map((item) => <li key={item.issue}><span className="font-semibold">{item.issue}:</span> {item.why}</li>) : <li>Nothing significant recorded.</li>}</ul></section>
          <section><h3 className="font-semibold">Recommended actions</h3><ul className="mt-1 list-disc space-y-1 pl-5">{vm.result.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ul></section>
        </div>
      ) : null}
    </div>
  );
}

const FACTOR_LABELS = { onTime: "On time", noComplaints: "No complaints", responsive: "Quotes within 48 hours", contractAccuracy: "Contract accuracy" } as const;

/** FR-AI-06: the supplier's reliability score with its 95% band. */
export function SupplierReliabilityScoreLine({ supplierId }: { supplierId: string }) {
  const [score, setScore] = useState<PrismSupplierReliabilityScore | null>(null);
  useEffect(() => {
    void aiAdvisoryRepository.reliabilityScore(supplierId).then(setScore).catch(() => setScore(null));
  }, [supplierId]);
  if (!score) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <p>Reliability score: <span className="font-semibold text-foreground">{score.score}</span> (likely {score.low} to {score.high}){score.observations === 0 ? " · no history yet" : ` · from ${score.observations} records`}</p>
      <p>{score.factors.map((factor) => `${FACTOR_LABELS[factor.factor]} ${factor.rate}%`).join(" · ")}</p>
    </div>
  );
}

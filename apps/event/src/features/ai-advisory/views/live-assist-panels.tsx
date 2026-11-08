"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import type { OperationsAssistantResult, PrismEventDayCopilot } from "@prism/types";
import { aiAdvisoryRepository } from "../data/ai-advisory-repository";

const COPILOT_POLL_MS = 60_000;
const PRIORITY_CLASS: Record<PrismEventDayCopilot["alerts"][number]["priority"], string> = {
  critical: "border-destructive/60 bg-destructive/10",
  high: "border-attention/60 bg-attention/10",
  medium: "border-border",
};
const AREA_LABEL: Record<PrismEventDayCopilot["alerts"][number]["area"], string> = {
  suppliers: "Suppliers", tasks: "Tasks", staffing: "Coordinators", check_in: "Check-in", issues: "Issues",
};

/** FR-AI-07: prioritized alerts for the event-day operator, refreshed every minute while the panel is open. Advice only. */
export function EventDayCopilotPanel({ eventId }: { eventId: string }) {
  const [advice, setAdvice] = useState<PrismEventDayCopilot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  const refresh = useCallback(async () => {
    try { setAdvice(await aiAdvisoryRepository.eventDayCopilot(eventId)); setError(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "The copilot did not respond."); }
  }, [eventId]);

  useEffect(() => {
    if (!watching) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), COPILOT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [watching, refresh]);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Event-day copilot</h2>
        <button type="button" onClick={() => setWatching(!watching)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">{watching ? "Stop watching" : "Start watching"}</button>
      </div>
      <p className="text-xs text-muted-foreground">Checks suppliers, tasks, coordinators, check-in and issues every minute and suggests what to do. It does not change anything; you act on the board.</p>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {advice ? (
        <div className="space-y-2">
          <p>{advice.summary}</p>
          <ul className="space-y-2">
            {advice.alerts.map((alert, index) => (
              <li key={`${alert.area}-${index}`} className={`rounded-md border p-2 ${PRIORITY_CLASS[alert.priority]}`}>
                <p className="font-semibold">{AREA_LABEL[alert.area]} · {alert.priority}: {alert.alert}</p>
                <p className="text-xs">{alert.recommendation}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Updated {formatPortalDateTime(advice.generatedAt)}</p>
        </div>
      ) : null}
    </section>
  );
}

type AssistantTurn = { question: string; answer: string; nextSteps: string[] };

/** FR-AI-05: PMCM asks about this event in plain language. The assistant cannot act; next steps are suggestions. */
export function OperationsAssistantPanel({ eventId }: { eventId: string }) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setTurns([]); }, [eventId]);

  async function ask() {
    const asked = question.trim();
    if (asked.length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const result: OperationsAssistantResult = await aiAdvisoryRepository.askAssistant(eventId, asked, turns.slice(-3).map(({ question: q, answer }) => ({ question: q, answer })));
      setTurns([...turns, { question: asked, answer: result.answer, nextSteps: result.suggestedNextSteps }]);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant did not respond.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
      <h2 className="text-base font-bold">Ask P.R.I.S.M</h2>
      <p className="text-xs text-muted-foreground">Answers come from this event's counts and statuses only. The assistant cannot change records or send messages.</p>
      <ol className="space-y-3">
        {turns.map((turn, index) => (
          <li key={index} className="space-y-1">
            <p className="font-semibold">{turn.question}</p>
            <p className="whitespace-pre-line">{turn.answer}</p>
            {turn.nextSteps.length ? <ul className="list-disc pl-5 text-xs text-muted-foreground">{turn.nextSteps.map((step) => <li key={step}>{step}</li>)}</ul> : null}
          </li>
        ))}
      </ol>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
        <input value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Which suppliers are still unconfirmed?" className="h-10 flex-1 rounded-md border border-border bg-background px-3" />
        <button type="submit" disabled={busy || question.trim().length < 3} className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Asking…" : "Ask"}</button>
      </form>
    </section>
  );
}

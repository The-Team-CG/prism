"use client";

import { useState, type ReactElement } from "react";
import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";

/** FR-40: guest controls for Live Poll, Word Cloud and Open Q and A. */
type GameData = NonNullable<PrismGamePublicState["participant"]["gameData"]>;
type PollData = Extract<GameData, { kind: "live-poll" }>;
type TextData = Extract<GameData, { kind: "word-cloud" | "open-qa" }>;
type Submit = (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
type ControlsInput = { state: PrismGamePublicState; roundKey: string; key: string; busy: boolean; onSubmit: Submit };

const card = "mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7";

export function audienceControls({ state, roundKey, key, busy, onSubmit }: ControlsInput): ReactElement | null {
  const data = state.participant.gameData;
  if (data?.kind === "live-poll" && state.game.kind === "live-poll") return <LivePollControls key={key} state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
  if ((data?.kind === "word-cloud" || data?.kind === "open-qa") && state.game.kind === data.kind) {
    return <AudienceTextControls key={key} state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
  }
  return null;
}

function LivePollControls({ state, roundKey, data, busy, onSubmit }: Omit<ControlsInput, "key"> & { data: PollData }) {
  const canVote = state.status === "live" && !state.participant.hasVoted && Boolean(roundKey);
  return <section className={card} aria-label="Live poll">
    <h2 className="font-bold">{state.currentPrompt ?? "Vote"}</h2>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {data.options.map((option) => <Button key={option} type="button" variant="outline" disabled={!canVote || busy} onClick={() => void onSubmit({
        templateId: "live-poll", roundKey, actionKind: "vote", payload: { option },
      })}>{option}</Button>)}
    </div>
    <p role="status" className="mt-3 text-sm text-muted-foreground">{state.participant.hasVoted ? "Your vote is in. The host shows the room's totals when voting closes." : "Your vote is anonymous and counted in the room's totals."}</p>
  </section>;
}

const TEXT_COPY = {
  "word-cloud": { title: "Share a word", label: "Your word or phrase", sent: "Your answer is in." },
  "open-qa": { title: "Ask a question", label: "Your question", sent: "Your question is with the host." },
} as const;

function AudienceTextControls({ state, roundKey, data, busy, onSubmit }: Omit<ControlsInput, "key"> & { data: TextData }) {
  const copy = TEXT_COPY[data.kind];
  return <section className={card} aria-label={copy.title}>
    <h2 className="font-bold">{state.currentPrompt ?? copy.title}</h2>
    {state.participant.hasSubmitted
      ? <p role="status" className="mt-3 text-sm">{copy.sent} Approved answers appear when the host pauses.</p>
      : <AudienceTextForm state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />}
    {data.kind === "open-qa" ? <ApprovedQuestions responses={state.approvedResponses} /> : <WordCloud responses={state.approvedResponses} />}
  </section>;
}

function AudienceTextForm({ state, roundKey, data, busy, onSubmit }: Omit<ControlsInput, "key"> & { data: TextData }) {
  const [response, setResponse] = useState("");
  const canSend = state.status === "live" && Boolean(roundKey) && !busy;
  const field = { value: response, maxLength: data.maxResponseLength, disabled: !canSend, onChange: (event: { target: { value: string } }) => setResponse(event.target.value) };
  return <form className="mt-3" onSubmit={(event) => {
    event.preventDefault();
    if (canSend && response.trim()) void onSubmit({ templateId: data.kind, roundKey, actionKind: "answer", payload: { response: response.trim() } });
  }}>
    <label className="grid gap-1.5 text-sm font-semibold">{TEXT_COPY[data.kind].label}
      {data.kind === "open-qa"
        ? <textarea {...field} rows={3} className="rounded-md border border-border bg-background px-3 py-2" />
        : <input {...field} autoComplete="off" className="min-h-10 rounded-md border border-border bg-background px-3" />}
    </label>
    <p className="mt-1 text-xs text-muted-foreground">The host approves answers before the room sees them.</p>
    <Button type="submit" className="mt-3" disabled={!response.trim() || !canSend}>{busy ? "Sending…" : "Send"}</Button>
  </form>;
}

/** Counts approved answers case-insensitively; the most frequent show largest. */
export function wordCloudTerms(responses: readonly string[]): Array<{ term: string; count: number }> {
  const counts = new Map<string, { term: string; count: number }>();
  for (const response of responses) {
    const term = response.trim();
    const id = term.toLocaleLowerCase();
    if (!term) continue;
    const entry = counts.get(id) ?? { term, count: 0 };
    entry.count += 1;
    counts.set(id, entry);
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.term.localeCompare(right.term)).slice(0, 50);
}

function WordCloud({ responses }: { responses?: readonly string[] }) {
  const terms = wordCloudTerms(responses ?? []);
  if (!terms.length) return null;
  const top = terms[0]!.count;
  return <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border bg-background p-4" aria-label="Approved word cloud">
    {terms.map(({ term, count }) => <span key={term} style={{ fontSize: `${0.875 + (count / top) * 1.25}rem` }} className="font-semibold text-foreground">{term}</span>)}
  </div>;
}

function ApprovedQuestions({ responses }: { responses?: readonly string[] }) {
  if (!responses?.length) return null;
  return <section className="mt-4 rounded-md border border-border bg-background p-3" aria-label="Approved questions">
    <h3 className="text-sm font-semibold">Questions for the room</h3>
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{responses.map((response, index) => <li key={index} className="whitespace-pre-wrap">{response}</li>)}</ol>
  </section>;
}

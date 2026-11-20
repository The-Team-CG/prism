"use client";

import { useState, type ReactElement } from "react";
import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";

/** FR-40: guest controls for Live Poll, Word Cloud and Open Q and A; Presenter Deck prompts reuse the same patterns. */
type GameData = NonNullable<PrismGamePublicState["participant"]["gameData"]>;
type PollData = Extract<GameData, { kind: "live-poll" }>;
type TextData = Extract<GameData, { kind: "word-cloud" | "open-qa" }>;
type PresenterData = Extract<GameData, { kind: "presenter-deck" }>;
type TextMode = "word-cloud" | "open-qa";
type TextSpec = { templateId: "word-cloud" | "open-qa" | "presenter-deck"; mode: TextMode; maxResponseLength: number };
type Submit = (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
type ControlsInput = { state: PrismGamePublicState; roundKey: string; key: string; busy: boolean; onSubmit: Submit };

const card = "mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7";

/** Answers are open while live, except during a Presenter Deck slide's results window. */
function answersOpen(state: PrismGamePublicState): boolean {
  return state.status === "live" && !state.currentRound?.resultsOpen;
}

export function audienceControls({ state, roundKey, key, busy, onSubmit }: ControlsInput): ReactElement | null {
  const data = state.participant.gameData;
  if (data?.kind === "live-poll" && state.game.kind === "live-poll") return <LivePollControls key={key} state={state} roundKey={roundKey} options={data.options} templateId="live-poll" label="Live poll" busy={busy} onSubmit={onSubmit} />;
  if ((data?.kind === "word-cloud" || data?.kind === "open-qa") && state.game.kind === data.kind) {
    const text: TextSpec = { templateId: data.kind, mode: data.kind, maxResponseLength: data.maxResponseLength };
    return <AudienceTextControls key={key} state={state} roundKey={roundKey} text={text} busy={busy} onSubmit={onSubmit} />;
  }
  if (data?.kind === "presenter-deck" && state.game.kind === "presenter-deck") {
    return <PresenterDeckControls key={key} state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
  }
  return null;
}

function PresenterDeckControls({ state, roundKey, data, busy, onSubmit }: Omit<ControlsInput, "key"> & { data: PresenterData }) {
  if (data.roundType === "choice") {
    return <LivePollControls state={state} roundKey={roundKey} options={data.options} templateId="presenter-deck" label="Choice prompt" busy={busy} onSubmit={onSubmit} />;
  }
  if (data.roundType === "scale") {
    return <ScaleControls state={state} roundKey={roundKey} scaleMax={data.scaleMax} busy={busy} onSubmit={onSubmit} />;
  }
  const text: TextSpec = { templateId: "presenter-deck", mode: "word-cloud", maxResponseLength: data.maxResponseLength };
  return <AudienceTextControls state={state} roundKey={roundKey} text={text} busy={busy} onSubmit={onSubmit} />;
}

function LivePollControls({ state, roundKey, options, templateId, label, busy, onSubmit }: Omit<ControlsInput, "key"> & { options: readonly string[]; templateId: "live-poll" | "presenter-deck"; label: string }) {
  const canVote = answersOpen(state) && !state.participant.hasVoted && Boolean(roundKey);
  return <section className={card} aria-label={label}>
    <h2 className="font-bold">{state.currentPrompt ?? "Vote"}</h2>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {options.map((option) => <Button key={option} type="button" variant="outline" disabled={!canVote || busy} onClick={() => void onSubmit({
        templateId, roundKey, actionKind: "vote", payload: { option },
      })}>{option}</Button>)}
    </div>
    <p role="status" className="mt-3 text-sm text-muted-foreground">{state.participant.hasVoted ? "Your vote is in. The host shows the room's totals when voting closes." : "Your vote is anonymous and counted in the room's totals."}</p>
  </section>;
}

/** Presenter Deck rating scale: one button per integer from 1 to scaleMax, sent as the option label. */
function ScaleControls({ state, roundKey, scaleMax, busy, onSubmit }: Omit<ControlsInput, "key"> & { scaleMax: number }) {
  const canVote = answersOpen(state) && !state.participant.hasVoted && Boolean(roundKey);
  const values = Array.from({ length: scaleMax }, (_, index) => String(index + 1));
  return <section className={card} aria-label="Rating scale">
    <h2 className="font-bold">{state.currentPrompt ?? "Rate it"}</h2>
    <div className="mt-3 flex flex-wrap gap-2">
      {values.map((option) => <Button key={option} type="button" variant="outline" className="min-w-10 flex-1" disabled={!canVote || busy} onClick={() => void onSubmit({
        templateId: "presenter-deck", roundKey, actionKind: "vote", payload: { option },
      })}>{option}</Button>)}
    </div>
    <p role="status" className="mt-3 text-sm text-muted-foreground">{state.participant.hasVoted ? "Your rating is in. The host shows the room's results when voting closes." : "Your rating is anonymous and counted in the room's results."}</p>
  </section>;
}

const TEXT_COPY = {
  "word-cloud": { title: "Share a word", label: "Your word or phrase", sent: "Your answer is in." },
  "open-qa": { title: "Ask a question", label: "Your question", sent: "Your question is with the host." },
} as const;

function AudienceTextControls({ state, roundKey, text, busy, onSubmit }: Omit<ControlsInput, "key"> & { text: TextSpec }) {
  const copy = TEXT_COPY[text.mode];
  const approvedNote = text.templateId === "presenter-deck" ? "Approved answers appear on screen as they are accepted." : "Approved answers appear when the host pauses.";
  return <section className={card} aria-label={copy.title}>
    <h2 className="font-bold">{state.currentPrompt ?? copy.title}</h2>
    {state.participant.hasSubmitted
      ? <p role="status" className="mt-3 text-sm">{copy.sent} {approvedNote}</p>
      : <AudienceTextForm state={state} roundKey={roundKey} text={text} busy={busy} onSubmit={onSubmit} />}
    {text.mode === "open-qa" ? <ApprovedQuestions responses={state.approvedResponses} /> : <WordCloud responses={state.approvedResponses} />}
  </section>;
}

function AudienceTextForm({ state, roundKey, text, busy, onSubmit }: Omit<ControlsInput, "key"> & { text: TextSpec }) {
  const [response, setResponse] = useState("");
  const canSend = answersOpen(state) && Boolean(roundKey) && !busy;
  const field = { value: response, maxLength: text.maxResponseLength, disabled: !canSend, onChange: (event: { target: { value: string } }) => setResponse(event.target.value) };
  return <form className="mt-3" onSubmit={(event) => {
    event.preventDefault();
    if (canSend && response.trim()) void onSubmit({ templateId: text.templateId, roundKey, actionKind: "answer", payload: { response: response.trim() } });
  }}>
    <label className="grid gap-1.5 text-sm font-semibold">{TEXT_COPY[text.mode].label}
      {text.mode === "open-qa"
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

"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import type { PrismGamePublicState } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { GameChoiceGrid } from "@prism/ui/event-games";
import { GAME_PANEL, type GameControlProps, type GameDataOf } from "./game-control-types";

/** FR-40: guest controls for Live Poll, Word Cloud and Open Q and A; Presenter Deck prompts reuse the same patterns. */
type TextMode = "word-cloud" | "open-qa";
type TextSpec = { templateId: "word-cloud" | "open-qa" | "presenter-deck"; mode: TextMode; maxResponseLength: number };
type ControlsInput = Pick<GameControlProps, "state" | "roundKey" | "busy" | "onSubmit">;

/** Answers are open while live, except during a Presenter Deck slide's results window. */
function answersOpen(state: PrismGamePublicState): boolean {
  return state.status === "live" && !state.currentRound?.resultsOpen;
}

export function audienceControls({ state, roundKey, key, busy, onSubmit }: ControlsInput & { key: string }): ReactElement | null {
  const data = state.participant.gameData;
  if (data?.kind === "live-poll" && state.game.kind === "live-poll") return <VoteControls key={key} state={state} roundKey={roundKey} options={data.options} templateId="live-poll" label="Live poll" busy={busy} onSubmit={onSubmit} />;
  if ((data?.kind === "word-cloud" || data?.kind === "open-qa") && state.game.kind === data.kind) {
    const text: TextSpec = { templateId: data.kind, mode: data.kind, maxResponseLength: data.maxResponseLength };
    return <AudienceTextControls key={key} state={state} roundKey={roundKey} text={text} busy={busy} onSubmit={onSubmit} />;
  }
  if (data?.kind === "presenter-deck" && state.game.kind === "presenter-deck") {
    return <PresenterDeckControls key={key} state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
  }
  return null;
}

function PresenterDeckControls({ state, roundKey, data, busy, onSubmit }: ControlsInput & { data: GameDataOf<"presenter-deck"> }) {
  if (data.roundType === "choice") {
    return <VoteControls state={state} roundKey={roundKey} options={data.options} templateId="presenter-deck" label="Choice prompt" busy={busy} onSubmit={onSubmit} />;
  }
  if (data.roundType === "scale") {
    return <ScaleControls state={state} roundKey={roundKey} scaleMax={data.scaleMax} busy={busy} onSubmit={onSubmit} />;
  }
  const text: TextSpec = { templateId: "presenter-deck", mode: "word-cloud", maxResponseLength: data.maxResponseLength };
  return <AudienceTextControls state={state} roundKey={roundKey} text={text} busy={busy} onSubmit={onSubmit} />;
}

function VoteStatus({ voted, kind }: { voted: boolean; kind: "vote" | "rating" }) {
  const copy = voted
    ? `Your ${kind} is in. The room’s results show when voting closes.`
    : `Your ${kind} is anonymous and counted in the room’s totals.`;
  return <p role="status" className="px-1 text-sm text-muted-foreground">{copy}</p>;
}

function VoteControls({ state, roundKey, options, templateId, label, busy, onSubmit }: ControlsInput & { options: readonly string[]; templateId: "live-poll" | "presenter-deck"; label: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const canVote = answersOpen(state) && !state.participant.hasVoted && Boolean(roundKey);
  const vote = (option: string) => {
    setChosen(option);
    void onSubmit({ templateId, roundKey, actionKind: "vote", payload: { option } }).then((next) => { if (!next) setChosen(null); });
  };
  return (
    <section className="grid gap-3" aria-label={label}>
      <GameChoiceGrid options={options} chosen={chosen} counts={state.aggregateResults.length ? state.aggregateResults : null} disabled={busy} onChoose={canVote ? vote : undefined} />
      <VoteStatus voted={Boolean(state.participant.hasVoted)} kind="vote" />
    </section>
  );
}

/** Presenter Deck rating scale: one tile per whole number from 1 to scaleMax, sent as the option label. */
function ScaleControls({ state, roundKey, scaleMax, busy, onSubmit }: ControlsInput & { scaleMax: number }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const canVote = answersOpen(state) && !state.participant.hasVoted && Boolean(roundKey);
  const values = Array.from({ length: scaleMax }, (_, index) => String(index + 1));
  const rate = (option: string) => {
    setChosen(option);
    void onSubmit({ templateId: "presenter-deck", roundKey, actionKind: "vote", payload: { option } }).then((next) => { if (!next) setChosen(null); });
  };
  return (
    <section className={`${GAME_PANEL} grid gap-3`} aria-label="Rating scale">
      <div className="flex gap-2">
        {values.map((option) => (
          <Button key={option} type="button" variant={chosen === option ? "default" : "outline"} className="h-16 min-w-0 flex-1 rounded-2xl text-2xl font-bold" disabled={!canVote || busy} onClick={() => rate(option)}>{option}</Button>
        ))}
      </div>
      <div className="flex justify-between px-1 text-xs text-muted-foreground" aria-hidden="true"><span>Low</span><span>High</span></div>
      <VoteStatus voted={Boolean(state.participant.hasVoted)} kind="rating" />
    </section>
  );
}

const TEXT_COPY = {
  "word-cloud": { title: "Share a word", label: "Your word or phrase", sent: "Your answer is in." },
  "open-qa": { title: "Ask a question", label: "Your question", sent: "Your question is with the host." },
} as const;

function AudienceTextControls({ state, roundKey, text, busy, onSubmit }: ControlsInput & { text: TextSpec }) {
  const copy = TEXT_COPY[text.mode];
  const approvedNote = text.templateId === "presenter-deck" ? "Approved answers appear on screen as they are accepted." : "Approved answers appear when the host pauses.";
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label={copy.title}>
      {state.participant.hasSubmitted
        ? <p role="status" className="rounded-2xl bg-muted px-4 py-3 text-sm">{copy.sent} {approvedNote}</p>
        : <AudienceTextForm state={state} roundKey={roundKey} text={text} busy={busy} onSubmit={onSubmit} />}
      {text.mode === "open-qa" ? <ApprovedQuestions responses={state.approvedResponses} /> : <WordCloud responses={state.approvedResponses} />}
    </section>
  );
}

function AudienceTextForm({ state, roundKey, text, busy, onSubmit }: ControlsInput & { text: TextSpec }) {
  const [response, setResponse] = useState("");
  const canSend = answersOpen(state) && Boolean(roundKey) && !busy;
  const fieldClass = "rounded-2xl border border-border bg-background px-4 text-base";
  const field = { value: response, maxLength: text.maxResponseLength, disabled: !canSend, onChange: (event: { target: { value: string } }) => setResponse(event.target.value) };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend && response.trim()) void onSubmit({ templateId: text.templateId, roundKey, actionKind: "answer", payload: { response: response.trim() } });
  }
  return (
    <form className="grid gap-3" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm font-semibold">{TEXT_COPY[text.mode].label}
        {text.mode === "open-qa"
          ? <textarea {...field} rows={3} className={`${fieldClass} py-3`} />
          : <input {...field} autoComplete="off" className={`${fieldClass} min-h-14`} />}
      </label>
      <p className="text-xs text-muted-foreground">The host approves answers before the room sees them.</p>
      <Button type="submit" className="h-14 rounded-2xl text-lg" disabled={!response.trim() || !canSend}>{busy ? "Sending…" : "Send"}</Button>
    </form>
  );
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

const CLOUD_TONES = ["text-[var(--prism-magenta)]", "text-[var(--prism-info)]", "text-[var(--prism-orange-deep)]", "text-[var(--prism-teal)]"];

function WordCloud({ responses }: { responses?: readonly string[] }) {
  const terms = wordCloudTerms(responses ?? []);
  if (!terms.length) return null;
  const top = terms[0]!.count;
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 rounded-2xl bg-background p-4" aria-label="Approved word cloud">
      {terms.map(({ term, count }, index) => <span key={term} style={{ fontSize: `${0.875 + (count / top) * 1.25}rem` }} className={`font-bold ${CLOUD_TONES[index % CLOUD_TONES.length]}`}>{term}</span>)}
    </div>
  );
}

function ApprovedQuestions({ responses }: { responses?: readonly string[] }) {
  if (!responses?.length) return null;
  return (
    <section className="grid gap-2" aria-label="Approved questions">
      <h3 className="text-sm font-semibold">Questions for the room</h3>
      <ol className="grid gap-2 text-sm">{responses.map((response, index) => <li key={index} className="whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5">{response}</li>)}</ol>
    </section>
  );
}

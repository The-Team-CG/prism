"use client";

import { useState } from "react";
import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from "@prism/types";
import { GameChoiceGrid, type GameChoiceCount } from "@prism/ui/event-games";
import { gameDataOf, type GameControlProps } from "./game-control-types";

/** One tap sends the choice; the tile stays highlighted while the server confirms it, and clears if it fails. */
function useOneTapChoice(onSubmit: GameControlProps["onSubmit"]) {
  const [chosen, setChosen] = useState<string | null>(null);
  function choose(option: string, action: PrismSubmitEventGameActionInput) {
    setChosen(option);
    void onSubmit(action).then((next) => { if (!next) setChosen(null); });
  }
  return { chosen, choose };
}

function countsOrNull(results: readonly GameChoiceCount[] | undefined): readonly GameChoiceCount[] | null {
  return results?.length ? results : null;
}

function ChoiceSection({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="grid gap-3">
      <h2 className="sr-only">{label}</h2>
      {children}
      {note ? <p className="px-1 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

export function LiveTriviaControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "live-trivia");
  const { chosen, choose } = useOneTapChoice(onSubmit);
  if (!data) return null;
  const revealed = state.currentRound?.revealedAnswer ?? null;
  return (
    <ChoiceSection label="Choose your answer">
      <GameChoiceGrid
        options={data.options}
        chosen={state.participant.roundOutcome?.answer ?? chosen}
        correctAnswer={revealed}
        counts={revealed ? countsOrNull(state.aggregateResults) : null}
        disabled={busy}
        onChoose={canSubmit ? (answer) => choose(answer, { templateId: "live-trivia", roundKey, actionKind: "answer", payload: { answer } }) : undefined}
      />
    </ChoiceSection>
  );
}

export function ThisOrThatControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "this-or-that");
  const { chosen, choose } = useOneTapChoice(onSubmit);
  if (!data) return null;
  const voted = state.participant.hasSubmitted;
  return (
    <ChoiceSection label="Choose one" note="This is a poll. Only the room’s combined totals are shown.">
      <GameChoiceGrid
        options={data.options}
        chosen={chosen}
        counts={voted ? countsOrNull(state.aggregateResults) : null}
        disabled={busy}
        onChoose={canSubmit ? (option) => choose(option, { templateId: "this-or-that", roundKey, actionKind: "vote", payload: { option } }) : undefined}
      />
    </ChoiceSection>
  );
}

function ownChoice(state: PrismGamePublicState): string | null {
  return state.participant.result?.kind === "singleplayer-choice" ? state.participant.result.option : null;
}

export function WouldYouRatherControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "would-you-rather");
  const { chosen, choose } = useOneTapChoice(onSubmit);
  if (!data) return null;
  const done = state.participant.hasSubmitted;
  const note = data.aggregateResults
    ? "Your choice joins the anonymous event poll. No points in this game."
    : "Your choice stays private to you. No points in this game.";
  return (
    <ChoiceSection label="Choose what you would rather do" note={note}>
      <GameChoiceGrid
        options={data.options}
        chosen={ownChoice(state) ?? chosen}
        counts={done && data.aggregateResults ? countsOrNull(state.aggregateResults) : null}
        disabled={busy}
        onChoose={canSubmit ? (option) => choose(option, {
          templateId: "would-you-rather", roundKey, actionKind: data.aggregateResults ? "vote" : "complete", payload: { option },
        }) : undefined}
      />
      {done ? <p role="status" className="px-1 text-sm font-semibold">Your choice was recorded.</p> : null}
    </ChoiceSection>
  );
}

export function ThisOrThatSoloControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "this-or-that-solo");
  const { chosen, choose } = useOneTapChoice(onSubmit);
  const [shareWithPoll, setShareWithPoll] = useState(false);
  if (!data) return null;
  const done = state.participant.hasSubmitted;
  return (
    <ChoiceSection label="Your private choice" note="Your answer is private unless you share it. No points in this game.">
      {done ? null : (
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <input type="checkbox" checked={shareWithPoll} onChange={(event) => setShareWithPoll(event.target.checked)} className="mt-0.5 size-4" disabled={!canSubmit} />
          <span>Share my answer in the anonymous event poll</span>
        </label>
      )}
      <GameChoiceGrid
        options={data.options}
        chosen={ownChoice(state) ?? chosen}
        counts={done && state.participant.hasVoted ? countsOrNull(state.aggregateResults) : null}
        disabled={busy}
        onChoose={canSubmit ? (option) => choose(option, {
          templateId: "this-or-that-solo", roundKey, actionKind: shareWithPoll ? "vote" : "complete", payload: { option },
        }) : undefined}
      />
      {done ? <p role="status" className="px-1 text-sm font-semibold">{state.participant.hasVoted ? "Your choice was recorded and shared in the anonymous poll." : "Your choice was recorded and stays private."}</p> : null}
    </ChoiceSection>
  );
}

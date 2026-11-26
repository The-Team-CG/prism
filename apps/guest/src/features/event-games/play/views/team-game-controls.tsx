"use client";

import { useState, type FormEvent } from "react";
import { PRISM_AUTH_INPUT_CLASS_NAME } from "@prism/ui/auth-shell";
import { Button } from "@prism/ui/components/button";
import { GameChoiceGrid, PrizeWheel } from "@prism/ui/event-games";
import { GAME_PANEL, gameDataOf, type GameControlProps } from "./game-control-types";
import { TypedAnswerForm } from "./puzzle-game-controls";

export function FamilyFeudControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "family-feud");
  if (!data) return null;
  const waiting = state.participant.hasSubmitted && !state.participant.roundOutcome;
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Family Feud">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--prism-info)] px-4 py-3 text-white">
        <span className="text-xs font-semibold opacity-80">Your team</span>
        <h2 className="font-heading text-xl font-bold">{data.teamLabel}</h2>
      </div>
      {waiting
        ? <p className="rounded-2xl bg-muted px-4 py-3 text-sm">Your answer is in. The host scores it against the survey board.</p>
        : <TypedAnswerForm
            label="Your answer" submitLabel="Submit answer" canSubmit={canSubmit} busy={busy}
            sentAnswer={state.participant.roundOutcome?.answer}
            onAnswer={(answer) => { void onSubmit({ templateId: "family-feud", roundKey, actionKind: "answer", payload: { answer } }); }}
          />}
    </section>
  );
}

function StepTrack({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Share your take", "Pick a side"];
  return (
    <ol className="flex gap-2 text-xs font-semibold" aria-label="Split the Room steps">
      {steps.map((label, index) => {
        const done = step > index + 1;
        const current = step === index + 1;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className={`flex flex-1 items-center gap-2 rounded-full px-3 py-1.5 ${current ? "bg-primary text-primary-foreground" : done ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}>
            <span className="grid size-5 place-items-center rounded-full bg-white/25">{index + 1}</span>{label}
          </li>
        );
      })}
    </ol>
  );
}

function ApprovedResponses({ responses }: { responses?: readonly string[] }) {
  if (!responses?.length) return null;
  return (
    <section className="grid gap-2" aria-label="Host-approved responses">
      <h3 className="text-sm font-semibold">What the room said</h3>
      <ul className="grid gap-2">
        {responses.map((response, index) => <li key={index} className="whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm">{response}</li>)}
      </ul>
    </section>
  );
}

function SplitResponseForm({ canSubmit, busy, maxLength, onSend }: { canSubmit: boolean; busy: boolean; maxLength: number; onSend: (response: string) => void }) {
  const [response, setResponse] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit && !busy && response.trim()) onSend(response.trim());
  }
  return (
    <form className="grid gap-3" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm font-semibold">Your response
        <textarea value={response} onChange={(event) => setResponse(event.target.value)} maxLength={maxLength} rows={3} autoComplete="off" className={`rounded-2xl bg-background px-4 py-3 text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`} disabled={!canSubmit || busy} />
      </label>
      <p className="text-xs text-muted-foreground">Only the host sees your words unless they approve them for the room.</p>
      <Button type="submit" className="h-14 w-full rounded-2xl text-lg" disabled={!response.trim() || !canSubmit || busy}>{busy ? "Sending…" : "Submit response"}</Button>
    </form>
  );
}

function splitStep(hasSubmitted: boolean, hasVoted: boolean | undefined): 1 | 2 | 3 {
  if (!hasSubmitted) return 1;
  return hasVoted ? 3 : 2;
}

function SplitVoteStep({ state, roundKey, step, open, busy, onSubmit, options }: Pick<GameControlProps, "state" | "roundKey" | "busy" | "onSubmit"> & {
  step: 2 | 3; open: boolean; options: readonly string[];
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const voting = step === 2;
  const vote = (option: string) => {
    setChosen(option);
    void onSubmit({ templateId: "split-the-room", roundKey, actionKind: "vote", payload: { option } }).then((next) => { if (!next) setChosen(null); });
  };
  return (
    <>
      {voting ? <h2 className="font-heading text-lg font-bold">Choose the side you agree with</h2> : <p role="status" className="font-semibold">Your response and vote are recorded.</p>}
      <GameChoiceGrid
        options={options}
        chosen={chosen}
        counts={state.aggregateResults.length ? state.aggregateResults : null}
        disabled={busy}
        onChoose={voting && open ? vote : undefined}
      />
      {voting && !open ? <p role="status" className="text-sm text-muted-foreground">The host will reveal the room’s combined result after voting closes.</p> : null}
    </>
  );
}

export function SplitTheRoomControls({ state, roundKey, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "split-the-room");
  if (!data) return null;
  const open = state.status === "live" && Boolean(roundKey);
  const step = splitStep(state.participant.hasSubmitted, state.participant.hasVoted);
  const respond = (response: string) => { void onSubmit({ templateId: "split-the-room", roundKey, actionKind: "answer", payload: { response } }); };
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Split the Room">
      <StepTrack step={step} />
      {step === 1
        ? <SplitResponseForm canSubmit={open} busy={busy} maxLength={data.maxResponseLength} onSend={respond} />
        : <SplitVoteStep state={state} roundKey={roundKey} step={step} open={open} busy={busy} onSubmit={onSubmit} options={data.options} />}
      <ApprovedResponses responses={state.approvedResponses} />
    </section>
  );
}

export function SpinWheelControls({ state }: GameControlProps) {
  const data = gameDataOf(state, "spin-wheel");
  const result = state.sessionResult ?? null;
  // A guest who opens the page after the spin sees the result straight away; one watching sees it after the wheel stops.
  const [settledId, setSettledId] = useState<string | null>(result?.outcomeId ?? null);
  const showResult = result && settledId === result.outcomeId;
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Spin the Wheel">
      {data?.outcomes.length ? <PrizeWheel segments={data.outcomes} landedId={result?.outcomeId ?? null} className="max-w-xs" onSettled={() => setSettledId(result?.outcomeId ?? null)} /> : null}
      {showResult ? (
        <div role="status" className="rounded-2xl bg-[var(--prism-ink)] px-5 py-4 text-center text-white">
          <p className="text-sm opacity-80">The wheel landed on</p>
          <p className="font-heading text-2xl font-bold">{result.label}</p>
          {result.points > 0 ? <p className="text-sm text-[#f2b134]">{result.points} points</p> : null}
        </div>
      ) : <p role="status" className="text-center text-sm text-muted-foreground">{result ? "Spinning…" : "Watch the wheel. The host spins it."}</p>}
    </section>
  );
}

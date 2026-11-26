"use client";

import { useState, type FormEvent, type MouseEvent } from "react";
import type { PrismSubmitEventGameActionInput } from "@prism/types";
import { PRISM_AUTH_INPUT_CLASS_NAME } from "@prism/ui/auth-shell";
import { Button } from "@prism/ui/components/button";
import { GAME_PANEL, gameDataOf, type GameControlProps } from "./game-control-types";

const INPUT_CLASS = `min-h-14 rounded-2xl bg-background px-4 text-lg ${PRISM_AUTH_INPUT_CLASS_NAME}`;

/** A single typed answer: the shared form behind Word Scramble, both picture games and Family Feud. */
export function TypedAnswerForm({ label, submitLabel, canSubmit, busy, onAnswer, sentAnswer }: {
  label: string;
  submitLabel: string;
  canSubmit: boolean;
  busy: boolean;
  onAnswer: (answer: string) => void;
  /** What this guest already sent, once the server shares it back. */
  sentAnswer?: string;
}) {
  const [answer, setAnswer] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit && !busy && answer.trim()) onAnswer(answer.trim());
  }
  if (sentAnswer) return <p className="rounded-2xl bg-muted px-4 py-3 text-sm">You answered <strong>{sentAnswer}</strong></p>;
  // Once answers close, an empty box that cannot be used only adds noise.
  if (!canSubmit && !busy) return null;
  return (
    <form className="grid gap-3" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm font-semibold">{label}
        <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={120} autoComplete="off" className={INPUT_CLASS} disabled={!canSubmit || busy} />
      </label>
      <Button type="submit" className="h-14 w-full rounded-2xl text-lg" disabled={!answer.trim() || !canSubmit || busy}>{busy ? "Sending…" : submitLabel}</Button>
    </form>
  );
}

function sender(onSubmit: GameControlProps["onSubmit"], build: (answer: string) => PrismSubmitEventGameActionInput) {
  return (answer: string) => { void onSubmit(build(answer)); };
}

export function WordScrambleControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  if (!gameDataOf(state, "word-scramble")) return null;
  return (
    <section className={GAME_PANEL} aria-label="Word Scramble">
      <TypedAnswerForm
        label="Unscrambled word" submitLabel="Submit answer" canSubmit={canSubmit} busy={busy}
        sentAnswer={state.participant.roundOutcome?.answer}
        onAnswer={sender(onSubmit, (answer) => ({ templateId: "word-scramble", roundKey, actionKind: "answer", payload: { answer } }))}
      />
    </section>
  );
}

/** The picture uncovers left to right, one stage at a time; the stage track shows how much is left to see. */
function PictureReveal({ mediaUrl, mediaError, stage, totalStages, label }: {
  mediaUrl: string | null; mediaError: string | null; stage: number; totalStages: number; label: string;
}) {
  const stages = Math.max(1, totalStages);
  const visibleWidth = Math.min(100, Math.max(1, Math.round((stage / stages) * 100)));
  return (
    <figure className="grid gap-2">
      {mediaUrl ? (
        <div className="overflow-hidden rounded-2xl bg-[repeating-linear-gradient(45deg,var(--prism-tint),var(--prism-tint)_10px,var(--prism-page-strong)_10px,var(--prism-page-strong)_20px)]" aria-label={`Picture reveal stage ${stage} of ${stages}`}>
          <img src={mediaUrl} alt="Progressively revealed event game picture" data-reveal-stage={stage} style={{ clipPath: `inset(0 ${100 - visibleWidth}% 0 0)` }} className="block max-h-96 w-full object-contain transition-[clip-path] duration-700" />
        </div>
      ) : <p role={mediaError ? "alert" : "status"} className="rounded-2xl bg-secondary px-3 py-10 text-center text-sm text-muted-foreground">{mediaError ?? "Loading the picture…"}</p>}
      <figcaption className="flex items-center gap-3 text-sm font-semibold">
        <span className="shrink-0">{label} {stage} of {stages}</span>
        <span className="flex flex-1 gap-1" aria-hidden="true">
          {Array.from({ length: stages }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < stage ? "bg-primary" : "bg-muted"}`} />)}
        </span>
      </figcaption>
    </figure>
  );
}

type PictureMedia = { mediaUrl: string | null; mediaError: string | null };

export function GuessPictureControls({ state, roundKey, canSubmit, busy, onSubmit, mediaUrl, mediaError }: GameControlProps & PictureMedia) {
  const data = gameDataOf(state, "guess-picture");
  if (!data) return null;
  const waiting = state.participant.hasSubmitted && !state.participant.roundOutcome;
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Guess the Picture">
      <PictureReveal mediaUrl={mediaUrl} mediaError={mediaError} stage={data.stage} totalStages={state.currentRound?.total ?? data.stage} label="Revealed picture · Stage" />
      {waiting
        ? <p className="rounded-2xl bg-muted px-4 py-3 text-sm">Your guess is in. You get one guess per picture, and the answer shows when the host reveals it.</p>
        : <TypedAnswerForm
            label="Your guess" submitLabel="Submit guess" canSubmit={canSubmit} busy={busy}
            sentAnswer={state.participant.roundOutcome?.answer}
            onAnswer={sender(onSubmit, (answer) => ({ templateId: "guess-picture", roundKey, actionKind: "guess", payload: { answer } }))}
          />}
    </section>
  );
}

export function PictureSoloControls({ state, roundKey, canSubmit, busy, onSubmit, mediaUrl, mediaError }: GameControlProps & PictureMedia) {
  const data = gameDataOf(state, "guess-picture-solo");
  if (!data) return null;
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Guess the Picture">
      <PictureReveal mediaUrl={mediaUrl} mediaError={mediaError} stage={data.stage} totalStages={data.totalStages} label="Private picture reveal · Hint" />
      <TypedAnswerForm
        label="Your guess" submitLabel="Submit guess" canSubmit={canSubmit} busy={busy}
        sentAnswer={state.participant.roundOutcome?.answer}
        onAnswer={sender(onSubmit, (answer) => ({ templateId: "guess-picture-solo", roundKey, actionKind: "answer", payload: { answer } }))}
      />
    </section>
  );
}

type DifferenceMark = { x: number; y: number };

function pointerMark(event: MouseEvent<HTMLButtonElement>): DifferenceMark | null {
  // A keyboard "click" has no pointer position; keyboard players use the position form instead.
  if (event.detail === 0) return null;
  const bounds = event.currentTarget.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  };
}

function clampPercent(value: string): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function KeyboardMarkForm({ disabled, onAdd }: { disabled: boolean; onAdd: (mark: DifferenceMark) => void }) {
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const inputClass = `min-h-10 rounded-lg bg-background px-3 ${PRISM_AUTH_INPUT_CLASS_NAME}`;
  return (
    <details className="rounded-2xl border border-border px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">Mark by position instead</summary>
      <fieldset disabled={disabled} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <legend className="sr-only">Keyboard selection</legend>
        <label className="grid gap-1">Horizontal position (%)
          <input aria-label="Horizontal position (%)" type="number" min={0} max={100} step={1} value={x} onChange={(event) => setX(clampPercent(event.target.value))} className={inputClass} />
        </label>
        <label className="grid gap-1">Vertical position (%)
          <input aria-label="Vertical position (%)" type="number" min={0} max={100} step={1} value={y} onChange={(event) => setY(clampPercent(event.target.value))} className={inputClass} />
        </label>
        <Button type="button" variant="outline" onClick={() => onAdd({ x: x / 100, y: y / 100 })}>Add selected location</Button>
      </fieldset>
    </details>
  );
}

function MarkedImage({ src, marks, disabled, onMark }: { src: string; marks: readonly DifferenceMark[]; disabled: boolean; onMark: (mark: DifferenceMark) => void }) {
  function mark(event: MouseEvent<HTMLButtonElement>) {
    const position = pointerMark(event);
    if (position) onMark(position);
  }
  return (
    <button type="button" aria-label="Mark a difference on the comparison image" disabled={disabled} onClick={mark} className="relative block w-full cursor-crosshair overflow-hidden rounded-2xl bg-secondary p-0 text-left disabled:cursor-default">
      <img src={src} alt="Comparison event game image" className="block h-auto w-full" />
      {marks.map((position, index) => (
        <span key={`${position.x}-${position.y}-${index}`} aria-hidden="true" className="pointer-events-none absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-primary text-sm font-bold text-primary-foreground shadow-lg" style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}>{index + 1}</span>
      ))}
    </button>
  );
}

function SpotProgress({ found, total }: { found: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex flex-1 gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => <span key={index} className={`h-2.5 flex-1 rounded-full ${index < found ? "bg-primary" : "bg-muted"}`} />)}
      </span>
      <span role="status" className="shrink-0 text-sm font-semibold">{found} of {total} marks selected.</span>
    </div>
  );
}

type SpotMedia = PictureMedia & { comparisonMediaUrl: string | null };

function ImagePair({ mediaUrl, comparisonMediaUrl, mediaError, marks, marking, onMark }: SpotMedia & {
  marks: readonly DifferenceMark[]; marking: boolean; onMark: (mark: DifferenceMark) => void;
}) {
  if (!mediaUrl || !comparisonMediaUrl) {
    return <p role={mediaError ? "alert" : "status"} className="rounded-2xl bg-secondary px-3 py-10 text-center text-sm text-muted-foreground">{mediaError ?? "Loading the image pair…"}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <figure><figcaption className="mb-1 text-xs font-semibold">Original</figcaption><img src={mediaUrl} alt="Original event game image" className="block h-auto w-full rounded-2xl bg-secondary" /></figure>
      <figure><figcaption className="mb-1 text-xs font-semibold">Comparison · tap to mark</figcaption><MarkedImage src={comparisonMediaUrl} marks={marks} disabled={!marking} onMark={onMark} /></figure>
    </div>
  );
}

export function SpotTheDifferenceControls({ state, roundKey, canSubmit, busy, onSubmit, ...media }: GameControlProps & SpotMedia) {
  const data = gameDataOf(state, "spot-the-difference");
  const [marks, setMarks] = useState<DifferenceMark[]>([]);
  if (!data) return null;
  const marking = canSubmit && !busy && marks.length < data.totalDifferences;
  const addMark = (mark: DifferenceMark) => { if (marking) setMarks((current) => [...current, mark]); };
  const check = () => void onSubmit({ templateId: "spot-the-difference", roundKey, actionKind: "select", payload: { selections: marks } });
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Spot the Difference puzzle">
      <p className="text-sm text-muted-foreground">Tap each difference in the comparison image. The answers stay hidden until you check.</p>
      <ImagePair {...media} marks={marks} marking={marking} onMark={addMark} />
      <SpotProgress found={marks.length} total={data.totalDifferences} />
      {canSubmit ? (
        <>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 rounded-2xl" disabled={!marks.length || busy} onClick={() => setMarks((current) => current.slice(0, -1))}>Undo</Button>
            <Button type="button" className="h-12 flex-1 rounded-2xl text-base" disabled={!marks.length || busy} onClick={check}>{busy ? "Checking…" : "Check my answer"}</Button>
          </div>
          <KeyboardMarkForm disabled={!marking} onAdd={addMark} />
        </>
      ) : null}
    </section>
  );
}

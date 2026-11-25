"use client";

import { Check, X } from "lucide-react";
import { cn } from "../utils";
import { gameChoiceTone } from "./choice-tones";

export interface GameChoiceCount {
  label: string;
  count: number;
}

export interface GameChoiceGridProps {
  options: readonly string[];
  /** `phone` for a guest's hand, `stage` for the room screen read from the back of a hall. */
  size?: "phone" | "stage";
  /** The guest's own pick; the other tiles fade once it is locked in. */
  chosen?: string | null;
  /** Once answers close, the right answer keeps its colour and the rest fade. */
  correctAnswer?: string | null;
  /** How the room answered, shown as a bar inside each tile. */
  counts?: readonly GameChoiceCount[] | null;
  disabled?: boolean;
  /** When set, tiles are buttons and one tap submits. */
  onChoose?: (option: string) => void;
}

type TileState = "idle" | "chosen" | "faded" | "correct" | "wrong-choice";

function tileState(option: string, chosen: string | null | undefined, correctAnswer: string | null | undefined): TileState {
  if (correctAnswer) {
    if (option === correctAnswer) return "correct";
    return option === chosen ? "wrong-choice" : "faded";
  }
  if (!chosen) return "idle";
  return option === chosen ? "chosen" : "faded";
}

const STATE_CLASSES: Record<TileState, string> = {
  idle: "",
  chosen: "ring-4 ring-offset-2 scale-[1.02]",
  faded: "opacity-30 saturate-50",
  correct: "ring-4 ring-[var(--prism-success)] ring-offset-2",
  "wrong-choice": "opacity-60",
};

function shareOf(option: string, counts: readonly GameChoiceCount[] | null | undefined) {
  if (!counts?.length) return null;
  const total = counts.reduce((sum, { count }) => sum + count, 0);
  const count = counts.find(({ label }) => label === option)?.count ?? 0;
  return { count, percent: total > 0 ? Math.round((count / total) * 100) : 0 };
}

function TileMark({ state, size }: { state: TileState; size: "phone" | "stage" }) {
  const iconSize = size === "stage" ? "size-10" : "size-6";
  if (state === "correct") return <Check aria-label="Correct answer" className={cn(iconSize, "shrink-0")} strokeWidth={3} />;
  if (state === "wrong-choice") return <X aria-label="Your answer" className={cn(iconSize, "shrink-0")} strokeWidth={3} />;
  if (state === "chosen") return <span className="shrink-0 rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-semibold">Locked in</span>;
  return null;
}

/** Big, colour-coded answer tiles shared by guests' phones and the room screen. */
export function GameChoiceGrid({ options, size = "phone", chosen, correctAnswer, counts, disabled, onChoose }: GameChoiceGridProps) {
  const stage = size === "stage";
  return (
    <ul className={cn("grid gap-3", options.length > 2 || stage ? "grid-cols-2" : "grid-cols-1", stage && "gap-5")}>
      {options.map((option, index) => {
        const tone = gameChoiceTone(index);
        const state = tileState(option, chosen, correctAnswer);
        const share = shareOf(option, counts);
        const body = (
          <>
            <span className={cn("grid shrink-0 place-items-center rounded-xl bg-white/20 font-bold", stage ? "size-16 text-4xl" : "size-9 text-lg")} aria-hidden="true">
              {tone.letter}
            </span>
            <span className="min-w-0 flex-1 break-words text-left">{option}</span>
            <TileMark state={state} size={size} />
            {share ? (
              <span className="absolute inset-x-0 bottom-0 flex h-full items-end" aria-hidden="true">
                <span className="h-1.5 bg-white/70 transition-[width] duration-700 ease-out" style={{ width: `${share.percent}%` }} />
              </span>
            ) : null}
          </>
        );
        const classes = cn(
          "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl text-white shadow-sm transition-all duration-300",
          stage ? "min-h-32 px-6 py-5 text-4xl font-semibold" : "min-h-20 px-4 py-3 text-lg font-semibold",
          tone.fill, tone.ring, STATE_CLASSES[state],
          stage ? "ring-offset-[var(--prism-ink)]" : "ring-offset-background",
        );
        return (
          <li key={option}>
            {onChoose ? (
              <button type="button" disabled={disabled} onClick={() => onChoose(option)} className={cn(classes, "enabled:active:scale-[0.98] disabled:cursor-default")}>
                {body}
              </button>
            ) : (
              <div className={classes}>{body}</div>
            )}
            {share ? <p className={cn("mt-1 px-1 tabular-nums text-muted-foreground", stage ? "text-2xl text-white/70" : "text-xs")}>{share.count} · {share.percent}%</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@prism/ui/components/button";
import { bingoProgress, type BingoProgress } from "../model/bingo-progress";
import { GAME_PANEL, gameDataOf, type GameControlProps } from "./game-control-types";

const RECENT_CALLS = 5;

/** The latest call, large, with the few before it, so a guest who looked away can catch up. */
function RecentCalls({ calledNumbers }: { calledNumbers: readonly number[] }) {
  const recent = calledNumbers.slice(-RECENT_CALLS).reverse();
  if (!recent.length) return <p className="text-sm text-muted-foreground">The first number is on its way.</p>;
  return (
    <div className="flex items-center gap-2" aria-label="Recently called numbers">
      {recent.map((number, index) => (
        <span
          key={number}
          className={index === 0
            ? "grid size-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-black text-primary-foreground shadow-md ring-4 ring-primary-soft"
            : "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-muted-foreground"}
        >
          {number}
        </span>
      ))}
      <span className="ml-auto text-right text-xs text-muted-foreground">{calledNumbers.length} called</span>
    </div>
  );
}

function cellClass(called: boolean, marked: boolean): string {
  const base = "relative grid aspect-square place-items-center rounded-xl text-base font-bold transition-all duration-200";
  if (marked) return `${base} bg-primary text-primary-foreground shadow-inner`;
  if (called) return `${base} border-2 border-primary bg-primary-soft text-foreground ring-2 ring-primary/30 animate-pulse`;
  return `${base} border border-border bg-background text-muted-foreground`;
}

function BingoCell({ cell, called, marked, enabled, onToggle }: {
  cell: number | "FREE"; called: boolean; marked: boolean; enabled: boolean; onToggle: (number: number) => void;
}) {
  if (cell === "FREE") {
    return <span aria-label="Free space" className="grid aspect-square place-items-center rounded-xl bg-primary text-[0.65rem] font-black tracking-wider text-primary-foreground">FREE</span>;
  }
  return (
    <button type="button" aria-pressed={marked} disabled={!enabled || !called} onClick={() => onToggle(cell)} className={cellClass(called, marked)}>
      {cell}
    </button>
  );
}

const PROGRESS_HINTS: Record<BingoProgress["kind"], string | null> = {
  claimable: "That's a Bingo! Claim it before anyone else.",
  "unmarked-win": "You have a winning line. Tap its glowing numbers, then claim.",
  "one-away": "One away! Watch for the next call.",
  playing: null,
};

function ProgressHint({ progress }: { progress: BingoProgress }) {
  const hint = PROGRESS_HINTS[progress.kind];
  if (!hint) return null;
  const strong = progress.kind !== "one-away";
  return (
    <p role="status" className={`rounded-2xl px-4 py-2.5 text-center text-sm font-bold ${strong ? "bg-[var(--prism-success)] text-white" : "bg-[#f2b134]/25 text-foreground"}`}>
      {hint}
    </p>
  );
}

function ClaimButton({ progress, busy, disabled, onClaim }: { progress: BingoProgress; busy: boolean; disabled: boolean; onClaim: () => void }) {
  const ready = progress.kind === "claimable";
  return (
    <Button
      type="button"
      className={`h-14 rounded-2xl text-lg ${ready ? "animate-pulse bg-[var(--prism-success)] hover:bg-[var(--prism-success)]" : ""}`}
      disabled={disabled}
      onClick={onClaim}
    >
      {busy ? "Checking…" : ready ? "Claim Bingo!" : "Claim Bingo"}
    </Button>
  );
}

export function BingoControls({ state, roundKey, canSubmit, busy, onSubmit }: GameControlProps) {
  const data = gameDataOf(state, "bingo");
  const [marked, setMarked] = useState<number[]>([]);
  if (!data) return null;
  const called = new Set(data.calledNumbers);
  const progress = bingoProgress(data.card, data.calledNumbers, marked, data.winPattern);
  const toggle = (number: number) => setMarked((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number]);
  const claim = () => void onSubmit({
    templateId: "bingo", roundKey, actionKind: "mark",
    payload: { claim: "bingo", markedNumbers: [...marked].sort((left, right) => left - right) },
  });
  return (
    <section className={`${GAME_PANEL} grid gap-4`} aria-label="Your Bingo card">
      <RecentCalls calledNumbers={data.calledNumbers} />
      <div>
        <h2 className="font-heading text-lg font-bold">Your card</h2>
        <p className="text-sm text-muted-foreground">Tap the glowing numbers as they are called, then claim Bingo when you complete {data.winPattern === "full-card" ? "the whole card" : "a line"}.</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {data.card.map((cell, index) => (
          <BingoCell key={`${cell}-${index}`} cell={cell} called={typeof cell === "number" && called.has(cell)} marked={typeof cell === "number" && marked.includes(cell)} enabled={canSubmit && !busy} onToggle={toggle} />
        ))}
      </div>
      {canSubmit ? <ProgressHint progress={progress} /> : null}
      {canSubmit ? <ClaimButton progress={progress} busy={busy} disabled={busy || marked.length === 0} onClaim={claim} /> : null}
    </section>
  );
}

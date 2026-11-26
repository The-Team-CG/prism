"use client";

import { useEffect, useState } from "react";
import { cn } from "../utils";
import { prefersReducedMotion } from "./motion";
import type { GameStandingEntry } from "./game-standings";

/** Third, then second, then first: each step rises after the one before, so the winner lands last. */
const STEPS = [
  { place: 2, height: "h-40 md:h-48", tone: "bg-[#cfd4dc] text-[var(--prism-ink)]", delay: 2400 },
  { place: 1, height: "h-56 md:h-72", tone: "bg-[#f2b134] text-[var(--prism-ink)]", delay: 4000 },
  { place: 3, height: "h-28 md:h-36", tone: "bg-[#d98c5f] text-white", delay: 800 },
] as const;

function usePodiumClock(): number {
  const [elapsed, setElapsed] = useState(() => (typeof window === "undefined" || prefersReducedMotion() ? Infinity : 0));
  useEffect(() => {
    if (elapsed === Infinity) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now() - start;
      setElapsed(now);
      if (now > 4500) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
    // The clock starts once, when the podium appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return elapsed;
}

/** The room screen's finale: the top three rise onto a podium, one at a time. Ties share a step. */
export function GamePodium({ entries }: { entries: readonly GameStandingEntry[] }) {
  const elapsed = usePodiumClock();
  return (
    <ol className="mx-auto grid w-full max-w-5xl grid-cols-3 items-end gap-4 md:gap-8" aria-label="Podium">
      {STEPS.map(({ place, height, tone, delay }) => {
        const holders = entries.filter((entry) => entry.rank === place);
        const shown = elapsed >= delay;
        return (
          <li key={place} className="flex flex-col items-center gap-4">
            <div className={cn("grid min-h-24 content-end gap-1 text-center transition-all duration-700", shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
              {holders.map((entry) => (
                <p key={entry.label} className="text-2xl font-bold md:text-4xl">
                  {entry.label}
                  <span className="block text-xl font-semibold tabular-nums text-white/70 md:text-2xl">{entry.score} points</span>
                </p>
              ))}
            </div>
            <div className={cn("grid w-full origin-bottom place-items-start justify-center rounded-t-3xl pt-4 text-6xl font-black shadow-2xl transition-transform duration-700 md:text-7xl", height, tone, shown ? "scale-y-100" : "scale-y-0")}>
              {place}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

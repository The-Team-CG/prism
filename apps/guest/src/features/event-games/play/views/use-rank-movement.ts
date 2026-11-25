"use client";

import { useState } from "react";

type RankMark = { roundKey: string; rank: number };

/**
 * How many places the guest moved since the previous round: positive is up. The phone remembers the rank it last
 * saw in each round, so this needs no history from the server; it is null until a second round has been seen.
 */
export function useRankMovement(roundKey: string | undefined, rank: number | null): number | null {
  const [trail, setTrail] = useState<readonly RankMark[]>([]);
  const last = trail[trail.length - 1];
  // Adjusting state while rendering keeps the movement right on the first frame of a reveal.
  if (roundKey && rank !== null) {
    if (!last || last.roundKey !== roundKey) setTrail([...trail.slice(-1), { roundKey, rank }]);
    else if (last.rank !== rank) setTrail([...trail.slice(0, -1), { roundKey, rank }]);
  }
  const previous = trail.length >= 2 ? trail[trail.length - 2] : undefined;
  if (!previous || !last || last.roundKey !== roundKey) return null;
  return previous.rank - last.rank;
}

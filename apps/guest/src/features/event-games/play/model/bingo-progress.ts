/** What a guest's Bingo card is closest to, from the numbers called so far and the ones they have marked. */
export type BingoProgress =
  /** Their marks complete a winning pattern: claim now. */
  | { kind: "claimable" }
  /** The called numbers complete a pattern, but they have not marked it all yet. */
  | { kind: "unmarked-win" }
  /** One more call completes a pattern. */
  | { kind: "one-away" }
  | { kind: "playing" };

type Cell = number | "FREE";
type WinPattern = "line" | "full-card";

const SIZE = 5;

/** Rows, columns and both diagonals of the 5×5 card, as cell indexes. */
const LINES: readonly (readonly number[])[] = [
  ...Array.from({ length: SIZE }, (_, row) => Array.from({ length: SIZE }, (_, column) => row * SIZE + column)),
  ...Array.from({ length: SIZE }, (_, column) => Array.from({ length: SIZE }, (_, row) => row * SIZE + column)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];
const FULL_CARD: readonly number[] = Array.from({ length: SIZE * SIZE }, (_, index) => index);

/** How many cells of a pattern are still open, counting the free space and the given numbers as filled. */
function missing(card: readonly Cell[], cells: readonly number[], filled: ReadonlySet<number>): number {
  return cells.filter((index) => {
    const cell = card[index];
    return cell !== "FREE" && (cell === undefined || !filled.has(cell));
  }).length;
}

function fewestMissing(card: readonly Cell[], patterns: readonly (readonly number[])[], filled: ReadonlySet<number>): number {
  return Math.min(...patterns.map((cells) => missing(card, cells, filled)));
}

export function bingoProgress(
  card: readonly Cell[],
  calledNumbers: readonly number[],
  markedNumbers: readonly number[],
  winPattern: WinPattern = "line",
): BingoProgress {
  const patterns = winPattern === "full-card" ? [FULL_CARD] : LINES;
  // Only called numbers can count, even if a mark somehow survives on an uncalled one.
  const called = new Set(calledNumbers);
  const marked = new Set(markedNumbers.filter((number) => called.has(number)));
  if (fewestMissing(card, patterns, marked) === 0) return { kind: "claimable" };
  const toGo = fewestMissing(card, patterns, called);
  if (toGo === 0) return { kind: "unmarked-win" };
  return toGo === 1 ? { kind: "one-away" } : { kind: "playing" };
}

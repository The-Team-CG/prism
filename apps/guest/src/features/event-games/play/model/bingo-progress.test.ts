import { describe, expect, it } from "vitest";
import { bingoProgress } from "./bingo-progress";

// Row-major 5×5 card, free space in the middle: row 0 is 1..5, row 2 is 11, 12, FREE, 13, 14.
const card: ReadonlyArray<number | "FREE"> = [
  1, 2, 3, 4, 5,
  6, 7, 8, 9, 10,
  11, 12, "FREE", 13, 14,
  15, 16, 17, 18, 19,
  20, 21, 22, 23, 24,
];

describe("bingoProgress", () => {
  it("says one away when a single call would finish a line", () => {
    expect(bingoProgress(card, [1, 2, 3, 4], [])).toEqual({ kind: "one-away" });
    expect(bingoProgress(card, [11, 12, 13], [])).toEqual({ kind: "one-away" });
    expect(bingoProgress(card, [1, 7], [])).toEqual({ kind: "playing" });
  });

  it("spots a called line the guest has not marked, then lets them claim once it is marked", () => {
    expect(bingoProgress(card, [1, 2, 3, 4, 5], [1, 2])).toEqual({ kind: "unmarked-win" });
    expect(bingoProgress(card, [1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toEqual({ kind: "claimable" });
    // The free space completes the middle row.
    expect(bingoProgress(card, [11, 12, 13, 14], [11, 12, 13, 14])).toEqual({ kind: "claimable" });
  });

  it("ignores marks on uncalled numbers and needs the whole card for a full-card game", () => {
    expect(bingoProgress(card, [1, 2, 3, 4], [1, 2, 3, 4, 5])).toEqual({ kind: "one-away" });
    expect(bingoProgress(card, [1, 2, 3, 4, 5], [1, 2, 3, 4, 5], "full-card")).toEqual({ kind: "playing" });
    const allButOne = card.filter((cell): cell is number => typeof cell === "number" && cell !== 24);
    expect(bingoProgress(card, allButOne, allButOne, "full-card")).toEqual({ kind: "one-away" });
  });
});

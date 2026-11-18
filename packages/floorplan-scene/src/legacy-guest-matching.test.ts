import { describe, expect, it } from "vitest";
import { matchLegacyGuests } from "./legacy-guest-matching.js";

describe("matchLegacyGuests", () => {
  it("pairs exact names once each, so a repeated legacy name never doubles up on one roster guest", () => {
    const legacy = [
      { id: "g1", name: "Ana Reyes" },
      { id: "g2", name: " Ana Reyes " },
      { id: "g3", name: "Ben Cruz" },
      { id: "g4", name: "ana reyes" },
    ];
    const roster = [
      { id: "r1", name: "Ana Reyes" },
      { id: "r3", name: "Ben Cruz" },
    ];
    expect([...matchLegacyGuests(legacy, roster)]).toEqual([
      ["g1", "r1"],
      ["g3", "r3"],
    ]);
  });
});
